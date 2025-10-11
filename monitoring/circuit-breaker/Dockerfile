FROM alpine:3.18

# Install runtime dependencies
RUN apk add --no-cache ca-certificates curl

# Create non-root user
RUN addgroup -g 1001 -S circuit && \
    adduser -u 1001 -S circuit -G circuit

# Set working directory
WORKDIR /app

# Create placeholder script
RUN echo '#!/bin/sh\necho "Circuit breaker service placeholder"\nwhile true; do sleep 30; done' > /app/circuit-breaker && \
    chmod +x /app/circuit-breaker

# Create necessary directories
RUN mkdir -p /var/log/circuit-breaker && \
    chown -R circuit:circuit /app /var/log/circuit-breaker

# Switch to non-root user
USER circuit

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run the placeholder
CMD ["/app/circuit-breaker"]
