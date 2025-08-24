# syntax=docker/dockerfile:1.6

ARG NODE_VERSION=20.15.1

# ========================================
# Base stage with common dependencies
# ========================================
FROM node:${NODE_VERSION}-alpine AS base

# Install only essential system dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    make \
    g++ \
    git \
    curl \
    libc6-compat \
    dumb-init \
    tini \
    && npm config set fetch-retries 3 \
    && npm config set fetch-retry-mintimeout 10000 \
    && npm config set fetch-retry-maxtimeout 60000

# Set working directory
WORKDIR /app

# Copy package files for better layer caching
COPY package*.json ./
COPY tsconfig*.json ./

# ========================================
# Dependencies stage (production only)
# ========================================
FROM base AS deps
RUN npm ci --omit=dev --frozen-lockfile --prefer-offline \
    && npm cache clean --force \
    && rm -rf /tmp/* /var/cache/apk/*

# ========================================
# Development stage
# ========================================
FROM base AS development
ENV NODE_ENV=development

# Install all dependencies including devDependencies
RUN npm ci

# Copy source code
COPY . .

# Expose development port
EXPOSE 8080

# Development command with hot reload
CMD ["npm", "run", "dev"]

# ========================================
# Build stage
# ========================================
FROM base AS build

# Install all dependencies (needed for build)
RUN npm ci --frozen-lockfile --prefer-offline

# Copy source code (with .dockerignore optimization)
COPY . .

# Build the application with optimizations (FIXED: use correct build script)
RUN npm run build \
    && rm -rf node_modules \
    && npm ci --omit=dev --frozen-lockfile --prefer-offline \
    && npm cache clean --force

# ========================================
# Testing stage
# ========================================
FROM build AS testing
ENV NODE_ENV=test

# Run tests
CMD ["npm", "test"]

# ========================================
# Production stage
# ========================================
FROM node:${NODE_VERSION}-alpine AS production

# Install minimal runtime dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    curl \
    dumb-init \
    tini \
    libc6-compat \
    && rm -rf /var/cache/apk/* \
    # Create non-root user
    && addgroup -g 1001 -S nodejs \
    && adduser -S universalai -u 1001

# Set working directory
WORKDIR /app

# Copy production dependencies from build stage (already pruned)
COPY --from=build --chown=universalai:nodejs /app/node_modules ./node_modules

# Copy built application from build stage
COPY --from=build --chown=universalai:nodejs /app/dist ./dist
COPY --from=build --chown=universalai:nodejs /app/package*.json ./

# Create required directories with proper permissions
RUN mkdir -p logs tmp cache models data \
    && chown -R universalai:nodejs logs tmp cache models data \
    && chmod -R 755 logs tmp cache models data

# Switch to non-root user
USER universalai

# Set optimized environment variables (FIXED: align with memory optimization)
ENV NODE_ENV=production \
    PORT=9999 \
    DOCKER_ENV=true \
    CONTAINER_NAME=universal-ai-tools \
    ENABLE_CONTAINER_OPTIMIZATION=true \
    NODE_OPTIONS="--max-old-space-size=1536 --optimize-for-size --gc-interval=100" \
    ENABLE_PERF_LOGS=false \
    ENABLE_CONTEXT=false \
    MEMORY_MONITORING_INTERVAL=120000 \
    GC_INTERVAL_MS=120000 \
    CACHE_CLEANUP_INTERVAL_MS=180000

# Health check with proper endpoint (FIXED: use correct health endpoint)
HEALTHCHECK --interval=60s --timeout=10s --start-period=60s --retries=2 \
    CMD curl -f http://localhost:9999/health || exit 1

# Expose port
EXPOSE 9999

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application
CMD ["node", "dist/server.js"]

# ========================================
# Metadata
# ========================================
LABEL maintainer="Universal AI Tools Team"
LABEL version="1.0.0"
LABEL description="Universal AI Tools - Multi-model LLM platform with agent orchestration"
LABEL org.opencontainers.image.source="https://github.com/your-org/universal-ai-tools"
LABEL org.opencontainers.image.description="Universal AI Tools Service"
LABEL org.opencontainers.image.licenses="MIT"
