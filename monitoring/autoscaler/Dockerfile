FROM alpine:3.18

# Install runtime dependencies
RUN apk add --no-cache ca-certificates curl

# Create non-root user
RUN addgroup -g 1001 -S autoscaler && \
    adduser -u 1001 -S autoscaler -G autoscaler

# Set working directory
WORKDIR /app

# Create placeholder script
RUN echo '#!/bin/sh\necho "Auto-scaler service placeholder"\nwhile true; do sleep 30; done' > /app/autoscaler && \
    chmod +x /app/autoscaler

# Create necessary directories
RUN mkdir -p /var/log/autoscaler && \
    chown -R autoscaler:autoscaler /app /var/log/autoscaler

# Switch to non-root user
USER autoscaler

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run the placeholder
CMD ["/app/autoscaler"]
