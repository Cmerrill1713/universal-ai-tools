FROM alpine:3.18

# Install runtime dependencies
RUN apk add --no-cache ca-certificates curl

# Create non-root user
RUN addgroup -g 1001 -S audit && \
    adduser -u 1001 -S audit -G audit

# Set working directory
WORKDIR /app

# Create placeholder script
RUN echo '#!/bin/sh\necho "Audit Trail service placeholder"\nwhile true; do sleep 30; done' > /app/audit-trail && \
    chmod +x /app/audit-trail

# Create necessary directories
RUN mkdir -p /var/log/audit-trail && \
    chown -R audit:audit /app /var/log/audit-trail

# Switch to non-root user
USER audit

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run the placeholder
CMD ["/app/audit-trail"]
