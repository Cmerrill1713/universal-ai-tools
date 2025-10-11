FROM alpine:3.18

# Install runtime dependencies
RUN apk add --no-cache ca-certificates curl

# Create non-root user
RUN addgroup -g 1001 -S datagov && \
    adduser -u 1001 -S datagov -G datagov

# Set working directory
WORKDIR /app

# Create placeholder script
RUN echo '#!/bin/sh\necho "Data Integrity service placeholder"\nwhile true; do sleep 30; done' > /app/data-integrity && \
    chmod +x /app/data-integrity

# Create necessary directories
RUN mkdir -p /var/log/data-integrity && \
    chown -R datagov:datagov /app /var/log/data-integrity

# Switch to non-root user
USER datagov

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run the placeholder
CMD ["/app/data-integrity"]
