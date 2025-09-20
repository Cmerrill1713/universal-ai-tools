# Multi-stage Dockerfile for the main orchestrator
FROM golang:1.24-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata curl

# Set working directory
WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the orchestrator binary
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o orchestrator .

# Final stage
FROM alpine:latest

# Install runtime dependencies
RUN apk --no-cache add ca-certificates tzdata curl bash

WORKDIR /root/

# Copy the orchestrator binary
COPY --from=builder /app/orchestrator .

# Copy configuration files
COPY --from=builder /app/config.yaml ./config.yaml

# Copy all service directories for the orchestrator to run them
COPY --from=builder /app/go-services ./go-services
COPY --from=builder /app/rust-services ./rust-services

# Install Go for running services (temporary - in production, use pre-built binaries)
COPY --from=golang:1.24-alpine /usr/local/go /usr/local/go
ENV PATH=$PATH:/usr/local/go/bin

# Create non-root user
RUN adduser -D -s /bin/bash appuser
RUN chown -R appuser:appuser /root
USER appuser

# Expose port for health checks
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Run the orchestrator
CMD ["./orchestrator"]
