# Multi-stage build for Rust Assistantd
FROM rust:1.70 as builder

# Set working directory
WORKDIR /app

# Copy Cargo files
COPY Cargo.toml Cargo.lock ./
COPY crates/assistantd/Cargo.toml ./crates/assistantd/

# Create a dummy main.rs to build dependencies
RUN mkdir -p crates/assistantd/src && \
    echo "fn main() {}" > crates/assistantd/src/main.rs

# Build dependencies
RUN cargo build --release --bin assistantd

# Copy source code
COPY crates/assistantd/src ./crates/assistantd/src/

# Build the application
RUN cargo build --release --bin assistantd

# Final stage
FROM debian:bullseye-slim

# Install ca-certificates and curl for health checks
RUN apt-get update && apt-get install -y ca-certificates curl && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -r -s /bin/false appuser

# Set working directory
WORKDIR /app

# Copy binary from builder stage
COPY --from=builder /app/target/release/assistantd /usr/local/bin/

# Change ownership to appuser
RUN chown appuser:appuser /usr/local/bin/assistantd

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8086

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8086/health || exit 1

# Run the application
CMD ["assistantd"]
