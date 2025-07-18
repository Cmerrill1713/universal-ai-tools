# Multi-stage Docker build for Universal AI Tools
FROM node:20-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    make \
    g++ \
    git \
    curl \
    libc6-compat \
    dumb-init

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY jest.config.js ./

# Development stage
FROM base AS development

# Install all dependencies
RUN npm ci

# Copy source code
COPY . .

# Expose port
EXPOSE 9999

# Development command
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS build

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# Production stage
FROM node:20-alpine AS production

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S universalai -u 1001

# Install runtime dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    curl \
    dumb-init \
    libc6-compat

# Set working directory
WORKDIR /app

# Copy built application from build stage
COPY --from=build --chown=universalai:nodejs /app/dist ./dist
COPY --from=build --chown=universalai:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=universalai:nodejs /app/package.json ./package.json

# Copy public assets
COPY --from=build --chown=universalai:nodejs /app/public ./public

# Create required directories
RUN mkdir -p /app/logs /app/tmp /app/cache /app/models /app/data && \
    chown -R universalai:nodejs /app/logs /app/tmp /app/cache /app/models /app/data

# Switch to non-root user
USER universalai

# Set environment
ENV NODE_ENV=production
ENV PORT=9999

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:9999/api/health || exit 1

# Expose port
EXPOSE 9999

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/server.js"]

# Metadata
LABEL maintainer="Universal AI Tools Team"
LABEL version="1.0.0"
LABEL description="Universal AI Tools Service - Supabase-powered tools for any LLM"
LABEL org.opencontainers.image.source="https://github.com/your-org/universal-ai-tools"
LABEL org.opencontainers.image.description="Universal AI Tools Service"
LABEL org.opencontainers.image.licenses="MIT"