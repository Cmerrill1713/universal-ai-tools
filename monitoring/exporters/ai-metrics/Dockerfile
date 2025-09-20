FROM golang:1.21-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Set working directory
WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o ai-metrics-exporter .

# =============================================================================
# RUNTIME STAGE
# =============================================================================

FROM alpine:3.18

# Install runtime dependencies
RUN apk add --no-cache ca-certificates curl tzdata

# Create non-root user
RUN addgroup -g 1001 -S ai-metrics && \
    adduser -u 1001 -S ai-metrics -G ai-metrics

# Set working directory
WORKDIR /app

# Copy binary from builder stage
COPY --from=builder /app/ai-metrics-exporter .

# Copy configuration files
COPY config/ ./config/

# Create necessary directories
RUN mkdir -p /var/log/ai-metrics && \
    chown -R ai-metrics:ai-metrics /app /var/log/ai-metrics

# Switch to non-root user
USER ai-metrics

# Expose port
EXPOSE 9092

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:9092/metrics || exit 1

# Run the application
CMD ["./ai-metrics-exporter"]
