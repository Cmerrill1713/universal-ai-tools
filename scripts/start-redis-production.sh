#!/bin/bash
# Universal AI Tools - Redis Production Startup Script

set -e

echo "🚀 Starting Redis for Universal AI Tools (Production Mode)"

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Set production environment variables
export REDIS_PASSWORD=${REDIS_PASSWORD:-$(openssl rand -base64 32)}
export REDIS_MAX_MEMORY=${REDIS_MAX_MEMORY:-2gb}
export COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-universal-ai-tools}

# Create .env file for Redis if it doesn't exist
if [ ! -f .env.redis ]; then
    echo "📝 Creating Redis environment configuration..."
    cat > .env.redis << EOF
REDIS_PASSWORD=${REDIS_PASSWORD}
REDIS_MAX_MEMORY=${REDIS_MAX_MEMORY}
COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME}
EOF
    echo "✅ Created .env.redis with secure password"
fi

# Start Redis with Docker Compose
echo "📦 Starting Redis container..."
docker-compose -f docker-compose.redis.yml --env-file .env.redis up -d

# Wait for Redis to be ready
echo "⏳ Waiting for Redis to be ready..."
max_attempts=30
attempt=1

while [ $attempt -le $max_attempts ]; do
    if docker exec universal-ai-tools-redis redis-cli ping >/dev/null 2>&1; then
        echo "✅ Redis is ready!"
        break
    fi
    
    if [ $attempt -eq $max_attempts ]; then
        echo "❌ Redis failed to start within 30 seconds"
        docker-compose -f docker-compose.redis.yml logs redis
        exit 1
    fi
    
    echo "   Attempt $attempt/$max_attempts..."
    sleep 1
    ((attempt++))
done

# Display connection information
echo ""
echo "🎉 Redis is running successfully!"
echo "📊 Connection Details:"
echo "   Host: localhost"
echo "   Port: 6379"
echo "   Password: ${REDIS_PASSWORD}"
echo "   URL: redis://:${REDIS_PASSWORD}@localhost:6379"
echo ""
echo "🔧 Management:"
echo "   View logs: docker-compose -f docker-compose.redis.yml logs -f redis"
echo "   Stop Redis: docker-compose -f docker-compose.redis.yml down"
echo "   Redis CLI: docker exec -it universal-ai-tools-redis redis-cli"
echo ""
echo "⚠️  IMPORTANT: Save the Redis password above for your application configuration!"

# Test connection
echo "🧪 Testing Redis connection..."
if docker exec universal-ai-tools-redis redis-cli ping | grep -q "PONG"; then
    echo "✅ Redis connection test successful"
else
    echo "❌ Redis connection test failed"
    exit 1
fi

echo ""
echo "🚀 Redis infrastructure is ready for production!"
echo "   Add this to your environment variables:"
echo "   export REDIS_URL=\"redis://:${REDIS_PASSWORD}@localhost:6379\""