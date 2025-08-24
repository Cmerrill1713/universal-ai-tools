# Production Dockerfile for GraphRAG Rust Service
# Multi-stage build with optimized caching and security

# Build stage - Use latest Rust with all build tools
FROM rust:1.82-slim AS builder

# Install system dependencies for compilation
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    libpq-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy dependency manifests first (for Docker layer caching)
COPY Cargo.toml Cargo.lock ./

# Create dummy source structure for dependency pre-compilation
RUN mkdir -p src/bin src/load_test && \
    echo "fn main() {}" > src/main.rs && \
    echo "fn main() {}" > src/bin/load_test.rs && \
    echo "pub mod load_test;" > src/lib.rs && \
    echo "// dummy" > src/load_test/mod.rs

# Build dependencies (this layer will be cached when source changes)
RUN cargo build --release --bins && \
    rm -rf src

# Copy actual source code
COPY src/ ./src/

# Build the application with optimizations
RUN cargo build --release --bin minimal && \
    cargo build --release --bin load_test

# Runtime stage - Use minimal distroless image for security
FROM gcr.io/distroless/cc-debian12:latest AS runtime

# Copy CA certificates for HTTPS requests
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Copy binaries from builder stage
COPY --from=builder /app/target/release/minimal /usr/local/bin/graphrag-service
COPY --from=builder /app/target/release/load_test /usr/local/bin/load_test

# Use non-root user for security (distroless default)
USER nonroot:nonroot

# Expose port (updated to match new service configuration)
EXPOSE 8000

# Production environment variables
ENV RUST_LOG=info
ENV RUST_BACKTRACE=0
ENV GRAPHRAG_HOST=0.0.0.0
ENV GRAPHRAG_PORT=8000
ENV GRAPHRAG_WORKERS=4

# Health check using built-in health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD ["/usr/local/bin/graphrag-service", "--health-check"] || exit 1

# Labels for better container management
LABEL maintainer="Universal AI Tools Team" \
      version="1.0.0" \
      description="GraphRAG Rust Service - High-performance graph-based RAG with Redis caching" \
      org.opencontainers.image.source="https://github.com/universal-ai-tools/graphrag-service"

# Default command
ENTRYPOINT ["/usr/local/bin/graphrag-service"]