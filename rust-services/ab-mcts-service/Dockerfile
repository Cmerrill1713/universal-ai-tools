# Production Dockerfile for AB-MCTS Rust Service
FROM rust:1.75-slim as builder

# Install system dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy manifests
COPY Cargo.toml Cargo.lock ./

# Create dummy source to build dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release && rm src/main.rs

# Copy source code
COPY src ./src
COPY benches ./benches
COPY tests ./tests

# Build the application
RUN touch src/lib.rs && cargo build --release

# Runtime stage
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN useradd -m -u 1001 appuser

# Create app directory
WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/target/release/libab_mcts_service.so ./
COPY --from=builder /app/target/release/libab_mcts_service.rlib ./

# Set permissions
RUN chown -R appuser:appuser /app
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD echo '{}' > /tmp/health_check || exit 1

# Expose port (if running as HTTP service)
EXPOSE 8080

# Default command (placeholder - will be overridden by integration)
CMD ["echo", "AB-MCTS Rust service ready for integration"]