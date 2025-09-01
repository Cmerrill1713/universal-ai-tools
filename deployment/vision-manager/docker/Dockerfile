# Multi-stage Rust build for Vision Resource Manager
# Optimized for production deployment with minimal runtime dependencies

# Build stage
FROM rust:1.75-bookworm as builder

# Install system dependencies for compilation
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    build-essential \
    cmake \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy Rust project files
COPY crates/vision-resource-manager/Cargo.toml ./crates/vision-resource-manager/
COPY crates/vision-resource-manager/src ./crates/vision-resource-manager/src
COPY Cargo.toml ./
COPY Cargo.lock ./

# Build the Rust library and NAPI module
WORKDIR /app/crates/vision-resource-manager
RUN cargo build --release

# Build the standalone benchmark for validation
RUN cargo build --release --example standalone_benchmark

# Runtime stage - Node.js for NAPI integration
FROM node:20-bookworm-slim as runtime

# Install runtime dependencies for GPU monitoring
RUN apt-get update && apt-get install -y \
    libssl3 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create app user for security
RUN groupadd -r app && useradd -r -g app app

# Create app directory
WORKDIR /app

# Copy built artifacts from builder stage
COPY --from=builder /app/crates/vision-resource-manager/target/release/libvision_resource_manager.so ./lib/
COPY --from=builder /app/crates/vision-resource-manager/target/release/examples/standalone_benchmark ./bin/

# Copy Node.js integration files
COPY src/services/vision-resource-manager-rust.ts ./src/services/
COPY src/services/vision-resource-manager-enhanced.ts ./src/services/
COPY src/utils/logger.ts ./src/utils/

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Set ownership
RUN chown -R app:app /app

# Switch to non-root user
USER app

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "const { rustVisionResourceManager } = require('./src/services/vision-resource-manager-rust.js'); rustVisionResourceManager.getGPUMetrics().then(() => process.exit(0)).catch(() => process.exit(1))"

# Default command - can be overridden for different services
CMD ["node", "-e", "console.log('Vision Resource Manager container ready')"]

# Metadata
LABEL version="1.0.0"
LABEL description="Universal AI Tools - Vision Resource Manager (Rust Backend)"
LABEL maintainer="Universal AI Tools <dev@universal-ai-tools.com>"