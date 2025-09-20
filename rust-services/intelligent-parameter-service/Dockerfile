# Multi-stage Dockerfile for Intelligent Parameter Service
# Optimized for production deployment with minimal image size

# Stage 1: Builder
FROM rust:1.82-slim AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /usr/src/app

# Copy Cargo files first for dependency caching
COPY Cargo.toml Cargo.lock ./

# Build dependencies (this layer will be cached)
RUN mkdir -p src/bin && \
    echo "fn main() {}" > src/bin/http_server.rs && \
    echo "pub fn dummy() {}" > src/lib.rs && \
    cargo build --release && \
    rm -rf src

# Copy source code
COPY src ./src

# Build the application
RUN touch src/lib.rs && \
    cargo build --release

# Stage 2: Runtime
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1001 appuser

# Copy binary from builder
COPY --from=builder /usr/src/app/target/release/http_server /usr/local/bin/intelligent-parameter-service

# Create necessary directories
RUN mkdir -p /var/log/intelligent-parameter-service && \
    chown -R appuser:appuser /var/log/intelligent-parameter-service

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8022

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8022/api/v1/health || exit 1

# Set environment variables
ENV RUST_LOG=intelligent_parameter_service=info,actix_web=info
ENV HOST=0.0.0.0
ENV PORT=8022

# Run the service
CMD ["intelligent-parameter-service"]