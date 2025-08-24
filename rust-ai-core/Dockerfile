# Multi-stage Rust build for production optimization
# Phase 1: Planner stage (for cargo-chef optimization)
FROM lukemathwalker/cargo-chef:latest-rust-1.75 AS chef
WORKDIR /app

# Phase 2: Dependency caching stage
FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

# Phase 3: Build dependencies stage
FROM chef AS builder

# Install system dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency recipe and build dependencies
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json

# Copy source code and build application
COPY . .
RUN cargo build --release --bin ai-engine

# Phase 4: Production stage
FROM debian:bookworm-slim AS runtime

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r rust && useradd -r -g rust rust

# Set working directory
WORKDIR /app

# Copy binary from builder stage
COPY --from=builder /app/target/release/ai-engine /usr/local/bin/ai-engine

# Copy configuration files
COPY --from=builder /app/config/ /app/config/

# Change ownership
RUN chown -R rust:rust /app

# Switch to non-root user
USER rust

# Expose ports
EXPOSE 8082 50051 9091

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD ["/usr/local/bin/ai-engine", "health-check"]

# Run the binary
ENTRYPOINT ["/usr/local/bin/ai-engine"]