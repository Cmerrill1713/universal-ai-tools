# Multi-stage build for Swift application
FROM swift:5.9-focal AS builder

# Set working directory
WORKDIR /app

# Copy Package.swift and Package.resolved
COPY Package.swift ./
COPY Package.resolved* ./

# Copy source code
COPY Sources/ ./Sources/

# Build the application
RUN swift build --configuration release

# Runtime stage
FROM ubuntu:22.04

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    libc6 \
    libatomic1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN useradd --create-home --shell /bin/bash app

# Set working directory
WORKDIR /app

# Copy the built binary from builder stage
COPY --from=builder /app/.build/release/UniversalAITools /app/universal-ai-tools

# Create logs directory
RUN mkdir -p /var/log/frontend && chown app:app /var/log/frontend

# Switch to app user
USER app

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run the application
CMD ["./universal-ai-tools"]
