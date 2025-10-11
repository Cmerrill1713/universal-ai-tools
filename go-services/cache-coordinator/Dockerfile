# Dockerfile for Cache Coordinator service
FROM golang:1.24-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Set working directory
WORKDIR /app

# Copy go mod files
COPY ../../../go.mod ../../../go.sum ./

# Copy shared package
COPY ../../../go-services/shared ./shared

# Copy service source
COPY . .

# Download dependencies
RUN go mod download

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o cache-coordinator .

# Final stage
FROM alpine:latest

# Install runtime dependencies
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /root/

# Copy the binary
COPY --from=builder /app/cache-coordinator .

# Create non-root user
RUN adduser -D -s /bin/sh appuser
USER appuser

# Expose port
EXPOSE 8012

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8012/health || exit 1

# Environment variables
ENV PORT=8012
ENV SERVICE_NAME=cache-coordinator
ENV REDIS_ADDR=redis:6379

# Run the service
CMD ["./cache-coordinator"]
