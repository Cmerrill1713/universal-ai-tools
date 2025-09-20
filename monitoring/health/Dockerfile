FROM alpine:3.18

# Install runtime dependencies
RUN apk add --no-cache ca-certificates curl

# Create non-root user
RUN addgroup -g 1001 -S healthmon && \
    adduser -u 1001 -S healthmon -G healthmon

# Set working directory
WORKDIR /app

# Create simple health monitor script
RUN echo '#!/bin/sh\necho "Health Monitor service placeholder"\nwhile true; do sleep 30; done' > /app/health-monitor && \
    chmod +x /app/health-monitor

# Create necessary directories
RUN mkdir -p /var/log/health-monitor && \
    chown -R healthmon:healthmon /app /var/log/health-monitor

# Switch to non-root user
USER healthmon

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run the application
CMD ["./health-monitor"]
