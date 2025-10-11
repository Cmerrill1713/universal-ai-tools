# Multi-stage build for Rust ML Inference
FROM rust:1.70 as builder

# Set working directory
WORKDIR /app

# Copy Cargo files
COPY Cargo.toml Cargo.lock ./
COPY crates/ml-inference/Cargo.toml ./crates/ml-inference/

# Create a dummy main.rs to build dependencies
RUN mkdir -p crates/ml-inference/src && \
    echo "fn main() {}" > crates/ml-inference/src/main.rs

# Build dependencies
RUN cargo build --release --bin ml-inference

# Copy source code
COPY crates/ml-inference/src ./crates/ml-inference/src/

# Build the application
RUN cargo build --release --bin ml-inference

# Final stage
FROM debian:bullseye-slim

# Install ca-certificates and curl for health checks
RUN apt-get update && apt-get install -y ca-certificates curl && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -r -s /bin/false appuser

# Set working directory
WORKDIR /app

# Copy binary from builder stage
COPY --from=builder /app/target/release/ml-inference /usr/local/bin/

# Change ownership to appuser
RUN chown appuser:appuser /usr/local/bin/ml-inference

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8091

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8091/health || exit 1

# Run the application
CMD ["ml-inference"]
