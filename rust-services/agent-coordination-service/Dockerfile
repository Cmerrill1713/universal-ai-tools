# Multi-stage build for agent coordination service
FROM rust:1.75-slim as builder

# Install dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy workspace configuration
COPY Cargo.toml Cargo.lock ./

# Copy the agent coordination service source
COPY rust-services/agent-coordination-service ./rust-services/agent-coordination-service/

# Build the service
RUN cargo build --release --bin agent-coordinator -p agent-coordination-service

# Runtime stage
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN useradd -r -s /bin/false app

# Copy the binary
COPY --from=builder /app/target/release/agent-coordinator /usr/local/bin/agent-coordinator

# Set ownership
RUN chown app:app /usr/local/bin/agent-coordinator

# Switch to app user
USER app

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Run the service
CMD ["agent-coordinator"]