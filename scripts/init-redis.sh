#!/bin/bash

# Redis Initialization Script for Universal AI Tools
# This script sets up Redis with proper configuration for both development and production

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions for colored output
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Determine environment
ENV=${NODE_ENV:-development}
REDIS_PASSWORD=${REDIS_PASSWORD:-}

log_info "Initializing Redis for $ENV environment..."

# Check if Redis is installed
if ! command -v redis-server &> /dev/null; then
    log_error "Redis is not installed. Please install Redis first."
    echo "On macOS: brew install redis"
    echo "On Ubuntu: sudo apt-get install redis-server"
    exit 1
fi

# Check if Docker is installed for container setup
if command -v docker &> /dev/null; then
    HAS_DOCKER=true
    log_info "Docker detected. Will set up Redis container."
else
    HAS_DOCKER=false
    log_warning "Docker not found. Will use local Redis installation."
fi

# Function to wait for Redis
wait_for_redis() {
    local host=$1
    local port=$2
    local password=$3
    local max_attempts=30
    local attempt=0
    
    log_info "Waiting for Redis at $host:$port..."
    
    while [ $attempt -lt $max_attempts ]; do
        if [ -n "$password" ]; then
            if redis-cli -h "$host" -p "$port" -a "$password" ping &> /dev/null; then
                log_success "Redis is ready!"
                return 0
            fi
        else
            if redis-cli -h "$host" -p "$port" ping &> /dev/null; then
                log_success "Redis is ready!"
                return 0
            fi
        fi
        
        attempt=$((attempt + 1))
        sleep 1
    done
    
    log_error "Redis failed to start after $max_attempts seconds"
    return 1
}

# Function to test Redis connection
test_redis_connection() {
    local host=$1
    local port=$2
    local password=$3
    
    log_info "Testing Redis connection..."
    
    if [ -n "$password" ]; then
        REDIS_RESPONSE=$(redis-cli -h "$host" -p "$port" -a "$password" ping 2>&1)
    else
        REDIS_RESPONSE=$(redis-cli -h "$host" -p "$port" ping 2>&1)
    fi
    
    if [ "$REDIS_RESPONSE" = "PONG" ]; then
        log_success "Redis connection test passed!"
        return 0
    else
        log_error "Redis connection test failed: $REDIS_RESPONSE"
        return 1
    fi
}

# Function to initialize Redis data
init_redis_data() {
    local host=$1
    local port=$2
    local password=$3
    
    log_info "Initializing Redis data structures..."
    
    # Create initialization script
    cat > /tmp/redis-init.txt << 'EOF'
# Initialize cache namespaces
SET cache:version "1.0.0"
SET cache:initialized "$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Set up default TTLs
SET config:cache:default_ttl "3600"
SET config:cache:max_ttl "86400"

# Initialize counters
SET stats:cache:hits "0"
SET stats:cache:misses "0"
SET stats:cache:errors "0"

# Create index for monitoring
SADD cache:namespaces "ai-responses"
SADD cache:namespaces "embeddings"
SADD cache:namespaces "models"
SADD cache:namespaces "sessions"
SADD cache:namespaces "rate-limits"

# Health check key
SET health:redis "OK"
EXPIRE health:redis 60
EOF
    
    # Replace date placeholder
    sed -i.bak "s/\$(date -u +%Y-%m-%dT%H:%M:%SZ)/$(date -u +%Y-%m-%dT%H:%M:%SZ)/g" /tmp/redis-init.txt
    rm -f /tmp/redis-init.txt.bak
    
    # Execute initialization
    if [ -n "$password" ]; then
        cat /tmp/redis-init.txt | redis-cli -h "$host" -p "$port" -a "$password" --pipe
    else
        cat /tmp/redis-init.txt | redis-cli -h "$host" -p "$port" --pipe
    fi
    
    rm -f /tmp/redis-init.txt
    
    log_success "Redis data initialized!"
}

# Start Redis based on environment
if [ "$HAS_DOCKER" = true ]; then
    # Use Docker Compose
    log_info "Starting Redis with Docker Compose..."
    
    # Check which docker-compose file to use
    if [ "$ENV" = "production" ]; then
        COMPOSE_FILE="docker-compose.prod.yml"
    else
        COMPOSE_FILE="docker-compose.redis.yml"
    fi
    
    if [ -f "$COMPOSE_FILE" ]; then
        docker-compose -f "$COMPOSE_FILE" up -d redis
        
        # Wait for Redis to be ready
        wait_for_redis "localhost" "6379" "$REDIS_PASSWORD"
        
        # Test connection
        test_redis_connection "localhost" "6379" "$REDIS_PASSWORD"
        
        # Initialize data
        init_redis_data "localhost" "6379" "$REDIS_PASSWORD"
        
        log_success "Redis is running in Docker container"
    else
        log_error "Docker Compose file $COMPOSE_FILE not found"
        exit 1
    fi
else
    # Use local Redis installation
    log_info "Starting local Redis server..."
    
    # Check if Redis is already running
    if pgrep -x "redis-server" > /dev/null; then
        log_warning "Redis is already running"
    else
        # Start Redis with config file if it exists
        if [ -f "redis/redis.conf" ]; then
            log_info "Starting Redis with custom configuration..."
            redis-server redis/redis.conf --daemonize yes
        else
            log_info "Starting Redis with default configuration..."
            redis-server --daemonize yes
        fi
    fi
    
    # Wait for Redis to be ready
    wait_for_redis "localhost" "6379" "$REDIS_PASSWORD"
    
    # Test connection
    test_redis_connection "localhost" "6379" "$REDIS_PASSWORD"
    
    # Initialize data
    init_redis_data "localhost" "6379" "$REDIS_PASSWORD"
    
    log_success "Local Redis server is running"
fi

# Display Redis info
log_info "Redis Information:"
if [ -n "$REDIS_PASSWORD" ]; then
    redis-cli -a "$REDIS_PASSWORD" INFO server | grep -E "redis_version|tcp_port|config_file"
else
    redis-cli INFO server | grep -E "redis_version|tcp_port|config_file"
fi

# Create .env.redis file with connection details
cat > .env.redis << EOF
# Redis Connection Details
REDIS_URL=redis://${REDIS_PASSWORD:+:$REDIS_PASSWORD@}localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
${REDIS_PASSWORD:+REDIS_PASSWORD=$REDIS_PASSWORD}
REDIS_DB=0
REDIS_POOL_SIZE=10
REDIS_CONNECTION_TIMEOUT=5000
REDIS_COMMAND_TIMEOUT=5000
REDIS_ENABLE_AUTORESYNC=true
REDIS_ENABLE_OFFLINE_QUEUE=true
EOF

log_success "Redis initialization complete!"
log_info "Redis connection details saved to .env.redis"
echo ""
echo "To connect to Redis CLI:"
if [ -n "$REDIS_PASSWORD" ]; then
    echo "  redis-cli -a $REDIS_PASSWORD"
else
    echo "  redis-cli"
fi
echo ""
echo "To stop Redis:"
if [ "$HAS_DOCKER" = true ]; then
    echo "  docker-compose -f $COMPOSE_FILE down"
else
    echo "  redis-cli shutdown"
fi