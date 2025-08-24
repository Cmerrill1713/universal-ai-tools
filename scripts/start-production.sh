#!/bin/bash
# Production startup script with memory optimization and monitoring
# Universal AI Tools - Production Environment

set -e

echo "=€ Starting Universal AI Tools in Production Mode..."

# Production environment variables
export NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=2048 --expose-gc"

# Production memory optimization settings
export MEMORY_WARNING_MB=512
export MEMORY_CRITICAL_MB=768
export MEMORY_EMERGENCY_MB=1024
export MAX_RESPONSE_TIME_MS=2000
export MAX_ERROR_RATE=0.05
export MAX_CPU_USAGE=80

# Enable all production optimizations
export ENABLE_AUTO_GC=true
export GC_INTERVAL_MS=30000
export ENABLE_CONNECTION_POOLING=true
export ENABLE_MEMORY_PRESSURE_RESPONSE=true
export MAX_REQUEST_SIZE_MB=10

# Enable comprehensive monitoring
export ENABLE_DETAILED_METRICS=true
export METRICS_RETENTION_MINUTES=60
export ENABLE_LIVE_METRICS=true

# HTTP optimization settings
export HTTP_KEEP_ALIVE_TIMEOUT=180000
export HTTP_HEADERS_TIMEOUT=181000
export HTTP_REQUEST_TIMEOUT=300000
export HTTP_SOCKET_TIMEOUT=300000
export HTTP_MAX_CONNECTIONS=1000
export HTTP_SHUTDOWN_DRAIN_TIMEOUT=30000

# Database and service optimization
export DB_POOL_SIZE=20
export REDIS_RETRY_ATTEMPTS=5

# Security and rate limiting
export ENABLE_RATE_LIMITING=true
export RATE_LIMIT_WINDOW_MS=900000
export RATE_LIMIT_MAX_REQUESTS=1000

# Disable heavy services for production performance
export DISABLE_HEAVY_SERVICES=false
export DISABLE_BACKGROUND_SERVICES=false

# Container detection
if [ -f /.dockerenv ]; then
    export DOCKER_ENV=true
    echo "=æ Docker environment detected"
fi

# Check for required services
echo "= Checking system requirements..."

# Check Node.js version
NODE_VERSION=$(node --version)
echo " Node.js version: $NODE_VERSION"

# Check memory availability
AVAILABLE_MEMORY=$(free -m | awk 'NR==2{printf "%.1fGB", $7/1024}' 2>/dev/null || echo "Unknown")
echo "=¾ Available memory: $AVAILABLE_MEMORY"

# Check if Redis is available
if command -v redis-cli &> /dev/null; then
    if redis-cli ping &> /dev/null; then
        echo " Redis is running"
    else
        echo "   Redis is installed but not running"
    fi
else
    echo "   Redis is not installed"
fi

# Check if Ollama is available
if command -v ollama &> /dev/null; then
    echo " Ollama is available"
else
    echo "   Ollama is not installed"
fi

# Pre-warm V8 engine
echo "=% Pre-warming V8 engine..."
node -e "console.log('V8 engine ready')"

# Start the application with production optimizations
echo "=€ Starting production server..."
echo "=Ê Production monitoring available at:"
echo "   - Health: http://localhost:9999/api/production/health"
echo "   - Metrics: http://localhost:9999/api/production/metrics"
echo "   - Performance: http://localhost:9999/api/production/performance"
echo "   - Status: http://localhost:9999/api/production/status"
echo "   - Live stream: http://localhost:9999/api/production/live"
echo ""

# Monitor startup performance
START_TIME=$(date +%s)

# Run the application
npm run build && npm start &

# Get the PID of the server
SERVER_PID=$!

# Wait for server to start
echo "ñ  Waiting for server startup..."
sleep 5

# Check if server is running
if kill -0 $SERVER_PID 2>/dev/null; then
    END_TIME=$(date +%s)
    STARTUP_TIME=$((END_TIME - START_TIME))
    
    # Test health endpoint
    if curl -s http://localhost:9999/health > /dev/null; then
        echo " Server started successfully in ${STARTUP_TIME} seconds"
        echo "= Server running at: http://localhost:9999"
        echo "=Ê Production dashboard: http://localhost:9999/api/production/health"
        
        # Display initial performance metrics
        echo ""
        echo "=È Initial Performance Metrics:"
        curl -s http://localhost:9999/api/production/performance | jq '.performance.overall' 2>/dev/null || echo "Metrics loading..."
        
    else
        echo "L Server health check failed"
        exit 1
    fi
else
    echo "L Server failed to start"
    exit 1
fi

# Setup signal handlers for graceful shutdown
trap 'echo "=Ñ Graceful shutdown initiated..."; kill -TERM $SERVER_PID; wait $SERVER_PID; echo " Server shutdown complete"' SIGINT SIGTERM

# Wait for the server process
wait $SERVER_PID