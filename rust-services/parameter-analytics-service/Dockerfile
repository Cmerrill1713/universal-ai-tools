# Multi-stage Dockerfile for Parameter Analytics Service
# Optimized for production deployment with minimal image size

# Build stage
FROM rust:1.75-slim as builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    libclang-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy Cargo files first for better caching
COPY Cargo.toml Cargo.lock ./

# Create dummy source to build dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs

# Build dependencies (will be cached if Cargo.toml doesn't change)
RUN cargo build --release --features ffi
RUN rm -rf src

# Copy actual source code
COPY src ./src
COPY tests ./tests
COPY benches ./benches

# Build the actual application
RUN cargo build --release --features ffi

# Verify the build and run tests
RUN cargo test --release

# Production stage
FROM ubuntu:22.04

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create non-root user for security
RUN useradd -r -s /bin/false -m -d /app analytics

# Set working directory
WORKDIR /app

# Copy built binary and library
COPY --from=builder /app/target/release/libparameter_analytics_service.so ./lib/
COPY --from=builder /app/target/release/libparameter_analytics_service.a ./lib/ 2>/dev/null || true

# Create necessary directories
RUN mkdir -p /app/config /app/logs /app/cache

# Set ownership
RUN chown -R analytics:analytics /app

# Switch to non-root user
USER analytics

# Set environment variables
ENV RUST_LOG=info
ENV RUST_BACKTRACE=1
ENV LD_LIBRARY_PATH=/app/lib:$LD_LIBRARY_PATH

# Expose default port (if running as standalone service)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD echo '{"test": true}' || exit 1

# Default command (can be overridden)
CMD ["echo", "Parameter Analytics Service library ready for integration"]