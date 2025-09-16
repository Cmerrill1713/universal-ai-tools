# Multi-stage build for Rust Vision Service
FROM rust:1.70 as builder

# Set working directory
WORKDIR /app

# Copy Cargo files
COPY Cargo.toml Cargo.lock ./
COPY crates/vision-service/Cargo.toml ./crates/vision-service/

# Create a dummy main.rs to build dependencies
RUN mkdir -p crates/vision-service/src && \
    echo "fn main() {}" > crates/vision-service/src/main.rs

# Build dependencies
RUN cargo build --release --bin vision-service

# Copy source code
COPY crates/vision-service/src ./crates/vision-service/src/

# Build the application
RUN cargo build --release --bin vision-service

# Final stage
FROM debian:bullseye-slim

# Install ca-certificates, curl, and image processing libraries
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    libjpeg-dev \
    libpng-dev \
    libtiff-dev \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -r -s /bin/false appuser

# Set working directory
WORKDIR /app

# Copy binary from builder stage
COPY --from=builder /app/target/release/vision-service /usr/local/bin/

# Change ownership to appuser
RUN chown appuser:appuser /usr/local/bin/vision-service

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8084

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8084/health || exit 1

# Run the application
CMD ["vision-service"]
