FROM alpine:3.18

# Install runtime dependencies
RUN apk add --no-cache ca-certificates curl

# Create non-root user
RUN addgroup -g 1001 -S aimodels && \
    adduser -u 1001 -S aimodels -G aimodels

# Set working directory
WORKDIR /app

# Create placeholder script
RUN echo '#!/bin/sh\necho "AI Model Monitor service placeholder"\nwhile true; do sleep 30; done' > /app/model-monitor && \
    chmod +x /app/model-monitor

# Create necessary directories
RUN mkdir -p /var/log/model-monitor && \
    chown -R aimodels:aimodels /app /var/log/model-monitor

# Switch to non-root user
USER aimodels

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run the placeholder
CMD ["/app/model-monitor"]
