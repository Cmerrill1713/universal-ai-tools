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
    dumb-init \
    tini

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# ========================================
# Development stage
# ========================================
FROM base AS development

# Install all dependencies including devDependencies
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Expose port
EXPOSE 9999

# Development command with hot reload
CMD ["npm", "run", "dev"]

# ========================================
# Build stage
# ========================================
FROM base AS build

# Install all dependencies
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Ensure knowledge directory exists
RUN mkdir -p knowledge

# Build the application
RUN npm run build

# Remove development dependencies
RUN npm prune --production

# ========================================
# Production stage
# ========================================
FROM node:20-alpine AS production

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
    adduser -S aitools -u 1001

# Set working directory
WORKDIR /app

# Copy built application from build stage
COPY --from=build --chown=aitools:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=aitools:nodejs /app/dist ./dist
COPY --from=build --chown=aitools:nodejs /app/package.json ./
COPY --from=build --chown=aitools:nodejs /app/knowledge ./knowledge 2>/dev/null || mkdir -p knowledge

# Create necessary directories
RUN mkdir -p logs cache models data && \
    chown -R aitools:nodejs logs cache models data

# Set production environment
ENV NODE_ENV=production \
    PORT=9999 \
    NODE_OPTIONS="--max-old-space-size=2048"

# Switch to non-root user
USER aitools

# Expose port
EXPOSE 9999

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:9999/api/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/server.js"]

# Labels
LABEL org.opencontainers.image.title="Universal AI Tools"
LABEL org.opencontainers.image.description="Production-ready AI Tools Service"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.vendor="Universal AI Tools"
LABEL org.opencontainers.image.licenses="MIT"
