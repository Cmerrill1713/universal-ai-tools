FROM alpine:3.18

# Install runtime dependencies
RUN apk add --no-cache ca-certificates curl

# Create non-root user
RUN addgroup -g 1001 -S biasdet && \
    adduser -u 1001 -S biasdet -G biasdet

# Set working directory
WORKDIR /app

# Create placeholder script
RUN echo '#!/bin/sh\necho "Bias Detection service placeholder"\nwhile true; do sleep 30; done' > /app/bias-detector && \
    chmod +x /app/bias-detector

# Create necessary directories
RUN mkdir -p /var/log/bias-detector && \
    chown -R biasdet:biasdet /app /var/log/bias-detector

# Switch to non-root user
USER biasdet

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run the placeholder
CMD ["/app/bias-detector"]
