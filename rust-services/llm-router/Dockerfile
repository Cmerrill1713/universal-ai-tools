# Production Dockerfile for Rust LLM Router with OpenTelemetry
# Multi-stage build optimized for security, performance, and minimal size

# Build stage - Use latest Rust with comprehensive build tools
FROM rust:1.82-slim AS builder

# Install system dependencies for compilation and security
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    libpq-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get autoremove -y \
    && apt-get autoclean

# Set working directory
WORKDIR /app

# Copy dependency manifests for optimal layer caching
COPY Cargo.toml Cargo.lock ./

# Create dummy source structure for dependency pre-compilation
RUN mkdir -p src && \
    echo "fn main() {}" > src/main.rs && \
    echo "// dummy" > src/lib.rs

# Build dependencies (cached when source code changes)
RUN cargo build --release && rm -rf src

# Copy actual source code
COPY src/ ./src/

# Build with maximum optimizations and security features
RUN cargo build --release --locked && \
    strip target/release/llm-router

# Runtime stage - Use minimal distroless image for maximum security
FROM gcr.io/distroless/cc-debian12:latest AS runtime

# Copy CA certificates for HTTPS requests
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Copy the optimized binary from builder stage
COPY --from=builder /app/target/release/llm-router /usr/local/bin/llm-router

# Use non-root user for security (distroless default)
USER nonroot:nonroot

# Expose LLM Router API and metrics ports
EXPOSE 8001 9001

# Production environment variables for optimal performance
ENV RUST_LOG=info
ENV RUST_BACKTRACE=0
ENV SERVICE_NAME=llm-router
ENV SERVICE_VERSION=1.0.0
ENV LLM_ROUTER_HOST=0.0.0.0
ENV LLM_ROUTER_PORT=8001
ENV METRICS_PORT=9001
ENV LLM_ROUTER_WORKERS=4
ENV LLM_ROUTER_MAX_CONNECTIONS=1000
ENV LLM_ROUTER_TIMEOUT=30s
ENV LLM_ROUTER_RATE_LIMIT=100

# Health check with proper configuration
HEALTHCHECK --interval=30s --timeout=15s --start-period=20s --retries=3 \
    CMD ["/usr/local/bin/llm-router", "--health-check"] || exit 1

# Container metadata for better management
LABEL maintainer="Universal AI Tools Team" \
      version="1.0.0" \
      description="LLM Router Rust Service - High-performance AI model routing with load balancing" \
      org.opencontainers.image.title="llm-router" \
      org.opencontainers.image.description="Intelligent LLM request routing and load balancing service" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.source="https://github.com/universal-ai-tools/llm-router" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.vendor="Universal AI Tools" \
      com.universal-ai-tools.service-type="llm-router" \
      com.universal-ai-tools.runtime="rust"

# Default command
ENTRYPOINT ["/usr/local/bin/llm-router"]