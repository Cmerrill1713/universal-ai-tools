# Multi-stage Docker build for Rust services
# Optimized for production deployment with minimal image size

FROM rust:1.75-alpine AS rust-builder

# Install system dependencies for Rust compilation
RUN apk add --no-cache \
    musl-dev \
    pkgconfig \
    openssl-dev \
    libc6-compat \
    build-base \
    redis

# Set up build environment
WORKDIR /build
ENV RUSTFLAGS="-C target-cpu=generic -C opt-level=3 -C link-arg=-s"
ENV CARGO_REGISTRIES_CRATES_IO_PROTOCOL=sparse

# Copy Rust service sources
COPY rust-services/ ./rust-services/
COPY Cargo.toml Cargo.lock ./

# Build all Rust services in release mode
RUN cd rust-services && \
    for service in ab-mcts-service parameter-analytics-service multimodal-fusion-service intelligent-parameter-service; do \
        echo "Building $service..."; \
        cd "$service" && \
        cargo build --release && \
        cd ..; \
    done

# Production image with Node.js for TypeScript integration
FROM node:20-alpine AS production

# Install system dependencies
RUN apk add --no-cache \
    dumb-init \
    redis \
    curl \
    ca-certificates

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001 -G nodejs

# Set up application directory
WORKDIR /app
RUN chown -R nodeuser:nodejs /app

# Copy built Rust libraries
COPY --from=rust-builder --chown=nodeuser:nodejs \
    /build/rust-services/ab-mcts-service/target/release/libab_mcts_service.so \
    /build/rust-services/parameter-analytics-service/target/release/libparameter_analytics_service.so \
    /build/rust-services/multimodal-fusion-service/target/release/libmultimodal_fusion_service.so \
    /build/rust-services/intelligent-parameter-service/target/release/libintelligent_parameter_service.so \
    ./rust-services/libs/

# Copy package files
COPY --chown=nodeuser:nodejs package*.json ./

# Install Node.js dependencies
USER nodeuser
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application source
COPY --chown=nodeuser:nodejs . .

# Build TypeScript
RUN npm run build

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:9999/api/v1/health || exit 1

# Expose port
EXPOSE 9999

# Set environment variables
ENV NODE_ENV=production
ENV RUST_SERVICES_PATH=/app/rust-services/libs
ENV ENABLE_NATIVE_OPTIMIZATION=true

# Start application with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]