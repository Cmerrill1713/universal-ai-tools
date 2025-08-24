# Production Dockerfile for Go WebSocket Service with OpenTelemetry
# Multi-stage build optimized for security and performance

# Build stage - Use official Go image with build tools
FROM golang:1.21-alpine AS builder

# Install build dependencies and security tools
RUN apk add --no-cache \
    git \
    ca-certificates \
    tzdata \
    && update-ca-certificates

# Set working directory
WORKDIR /app

# Copy go mod files for dependency caching
COPY go.mod go.sum ./

# Download and verify dependencies (cached layer)
RUN go mod download && go mod verify

# Copy source code
COPY *.go ./

# Build with comprehensive optimizations and security flags
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags='-w -s -extldflags "-static" -X main.version=1.0.0' \
    -a -installsuffix cgo \
    -trimpath \
    -o websocket-service .

# Runtime stage - Use minimal distroless image for maximum security
FROM gcr.io/distroless/static-debian12:latest AS runtime

# Copy CA certificates and timezone data
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo

# Copy the optimized binary
COPY --from=builder /app/websocket-service /usr/local/bin/websocket-service

# Use non-root user for security (distroless provides this)
USER nonroot:nonroot

# Expose WebSocket and metrics ports
EXPOSE 8080 9003

# Production environment variables
ENV GIN_MODE=release
ENV SERVICE_NAME=websocket-service
ENV SERVICE_VERSION=1.0.0
ENV WEBSOCKET_PORT=8080
ENV METRICS_PORT=9003
ENV WS_MAX_CONNECTIONS=10000
ENV WS_READ_BUFFER_SIZE=1024
ENV WS_WRITE_BUFFER_SIZE=1024
ENV WS_PING_PERIOD=54s
ENV WS_PONG_WAIT=60s
ENV WS_WRITE_WAIT=10s

# Health check with proper timeout and retries
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD ["/usr/local/bin/websocket-service", "--health-check"] || exit 1

# Container metadata labels
LABEL maintainer="Universal AI Tools Team" \
      version="1.0.0" \
      description="Go WebSocket Service - High-performance real-time communication with OpenTelemetry" \
      org.opencontainers.image.title="websocket-service" \
      org.opencontainers.image.description="WebSocket service for real-time communication" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.source="https://github.com/universal-ai-tools/websocket-service" \
      org.opencontainers.image.licenses="MIT"

# Set default command
ENTRYPOINT ["/usr/local/bin/websocket-service"]