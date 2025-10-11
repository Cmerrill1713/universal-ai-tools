# Multi-stage build for Rust LLM Router
FROM rust:1.70 as builder

# Set working directory
WORKDIR /app

# Copy Cargo files
COPY Cargo.toml ./
COPY src/ ./src/

# Build the application
RUN cargo build --release

# Final stage
FROM debian:bullseye-slim

# Install ca-certificates and curl for health checks
RUN apt-get update && apt-get install -y ca-certificates curl && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -r -s /bin/false appuser

# Set working directory
WORKDIR /app

# Copy binary from builder stage
COPY --from=builder /app/target/release/llm-router /usr/local/bin/

# Change ownership to appuser
RUN chown appuser:appuser /usr/local/bin/llm-router

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3033

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3033/health || exit 1

# Run the application
CMD ["llm-router"]
