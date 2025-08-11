# syntax=docker/dockerfile:1.6

ARG NODE_VERSION=20.15.1

# ========================================
# Base stage with common dependencies
# ========================================
FROM node:${NODE_VERSION}-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    make \
    g++ \
    git \
    curl \
    libc6-compat \
    dumb-init \
    tini

# Set working directory
WORKDIR /app

# Copy package files and TypeScript config
COPY package*.json ./
COPY tsconfig*.json ./

# ========================================
# Dependencies stage (production only)
# ========================================
FROM base AS deps
RUN npm ci --omit=dev && npm cache clean --force

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
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

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

# Install runtime dependencies only
RUN apk add --no-cache \
    python3 \
    py3-pip \
    curl \
    dumb-init \
    tini \
    libc6-compat && \
    # Create non-root user
    addgroup -g 1001 -S nodejs && \
    adduser -S universalai -u 1001

# Set working directory
WORKDIR /app

# Copy production dependencies from deps stage
COPY --from=deps --chown=universalai:nodejs /app/node_modules ./node_modules

# Copy built application from build stage
COPY --from=build --chown=universalai:nodejs /app/dist ./dist
COPY --from=build --chown=universalai:nodejs /app/package*.json ./

# Copy necessary files (if they exist)
COPY --chown=universalai:nodejs public ./public 2>/dev/null || :
COPY --chown=universalai:nodejs views ./views 2>/dev/null || :

# Create required directories
RUN mkdir -p logs tmp cache models data && \
    chown -R universalai:nodejs logs tmp cache models data

# Switch to non-root user
USER universalai

# Set environment
ENV NODE_ENV=production \
    PORT=9999 \
    ENABLE_PERF_LOGS=false \
    ENABLE_CONTEXT=false

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
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
