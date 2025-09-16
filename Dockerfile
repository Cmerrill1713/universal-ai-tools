# Multi-stage Docker build for Universal AI Tools
FROM node:22-alpine AS base

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
    tini  # cSpell:disable-line libc6-compat tini

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# ========================================
# Development stage
# ========================================
FROM base AS development

# Copy package files again for development stage
COPY package*.json ./
COPY tsconfig*.json ./

# Install all dependencies including devDependencies
RUN npm ci

# Copy source code (excluding node_modules for better caching)
COPY . .

# Expose port
EXPOSE 8080

# Development command with hot reload
CMD ["npm", "run", "dev"]

# ========================================
# Build stage
# ========================================
FROM base AS build

# Copy package files for build stage
COPY package*.json ./
COPY tsconfig*.json ./

# Install all dependencies
RUN npm ci --legacy-peer-deps

# Copy source code (excluding node_modules for better caching)
COPY . .

# Build the application
RUN npm run build

# Remove development dependencies
RUN npm prune --production

# ========================================
# Production stage
# ========================================
FROM node:22-alpine AS production

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
    adduser -S universalai -u 1001  # cSpell:disable-line addgroup adduser universalai

# Set working directory
WORKDIR /app

# Copy built application from build stage
COPY --from=build --chown=universalai:nodejs /app/dist ./dist
COPY --from=build --chown=universalai:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=universalai:nodejs /app/package*.json ./

# Copy necessary files (create directories first if they don't exist)
RUN mkdir -p public views
COPY --chown=universalai:nodejs public ./public
COPY --chown=universalai:nodejs views ./views

# Create required directories
RUN mkdir -p logs tmp cache models data && \
    chown -R universalai:nodejs logs tmp cache models data

# Switch to non-root user
USER universalai

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8080/api/health || exit 1

# Expose port
EXPOSE 8080

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application
CMD ["node", "dist/server.js"]

# ========================================
# Testing stage
# ========================================
FROM base AS testing

# Install all dependencies
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Run tests
CMD ["npm", "test"]

# ========================================
# Metadata
# ========================================
LABEL maintainer="Universal AI Tools Team"
LABEL version="1.0.0"
LABEL description="Universal AI Tools - Multi-model LLM platform with agent orchestration"
LABEL org.opencontainers.image.source="https://github.com/your-org/universal-ai-tools"
LABEL org.opencontainers.image.description="Universal AI Tools Service"
LABEL org.opencontainers.image.licenses="MIT"
