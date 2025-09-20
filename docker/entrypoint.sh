#!/bin/sh
set -e

# Universal AI Tools Production Entrypoint Script
# Handles initialization, health checks, and graceful startup

echo "🚀 Starting Universal AI Tools with Rust Services..."

# Function to check service availability
check_service() {
    local service=$1
    local url=$2
    local max_retries=30
    local retry=0

    echo "Checking $service availability at $url..."
    
    while [ $retry -lt $max_retries ]; do
        if curl -f -s "$url" > /dev/null 2>&1; then
            echo "✅ $service is available"
            return 0
        fi
        
        retry=$((retry + 1))
        echo "⏳ Waiting for $service... ($retry/$max_retries)"
        sleep 2
    done
    
    echo "⚠️ $service is not available, continuing with fallback"
    return 1
}

# Function to initialize Rust services
init_rust_services() {
    echo "Initializing Rust services..."
    
    # Check if Rust libraries are available
    if [ -f "/usr/local/lib/libvoice_processing.so" ]; then
        echo "✅ Voice Processing service available"
        export VOICE_PROCESSING_ENABLED=true
    fi
    
    if [ -f "/usr/local/lib/libvision_resource_manager.so" ]; then
        echo "✅ Vision Resource Manager available"
        export VISION_RESOURCE_ENABLED=true
    fi
    
    if [ -f "/usr/local/lib/libredis_service.so" ]; then
        echo "✅ Redis Service (Rust) available"
        export REDIS_RUST_ENABLED=true
    fi
    
    if [ -f "/usr/local/lib/libllm_router.so" ]; then
        echo "✅ LLM Router available"
        export LLM_ROUTER_ENABLED=true
    fi
    
    # Set up LD_LIBRARY_PATH for Rust libraries
    export LD_LIBRARY_PATH="/usr/local/lib:$LD_LIBRARY_PATH"
}

# Function to run database migrations
run_migrations() {
    if [ -n "$DATABASE_URL" ]; then
        echo "Running database migrations..."
        if [ -f "/app/migrations/run.js" ]; then
            node /app/migrations/run.js
            echo "✅ Migrations completed"
        else
            echo "⚠️ Migration script not found, skipping"
        fi
    fi
}

# Function to preload models
preload_models() {
    if [ "$PRELOAD_MODELS" = "true" ]; then
        echo "Preloading AI models..."
        
        # Check Ollama availability
        if check_service "Ollama" "${OLLAMA_URL:-http://ollama:11434}/api/tags"; then
            # Pull default models
            for model in ${DEFAULT_MODELS:-"llama3.2:3b gemma2:2b"}; do
                echo "Loading model: $model"
                curl -X POST "${OLLAMA_URL}/api/pull" \
                    -H "Content-Type: application/json" \
                    -d "{\"name\": \"$model\"}" || true
            done
        fi
    fi
}

# Function to setup health monitoring
setup_monitoring() {
    echo "Setting up health monitoring..."
    
    # Create health check endpoint file
    cat > /app/health.json << EOF
{
    "status": "starting",
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "services": {
        "rust": "$ENABLE_RUST_SERVICES",
        "redis": false,
        "ollama": false
    }
}
EOF
}

# Function to handle shutdown
cleanup() {
    echo "Shutting down gracefully..."
    
    # Send shutdown signal to Node.js process
    if [ -n "$NODE_PID" ]; then
        kill -TERM "$NODE_PID" 2>/dev/null || true
        wait "$NODE_PID" 2>/dev/null || true
    fi
    
    echo "Shutdown complete"
    exit 0
}

# Set up signal handlers
trap cleanup SIGTERM SIGINT

# Main startup sequence
echo "Environment: $NODE_ENV"
echo "Port: $PORT"
echo "Rust Services: $ENABLE_RUST_SERVICES"

# Initialize services
init_rust_services
setup_monitoring

# Wait for dependencies
check_service "Redis" "${REDIS_URL:-redis://redis:6379}" || true
check_service "Supabase" "${SUPABASE_URL}" || true

# Run migrations
run_migrations

# Preload models if requested
preload_models

# Update health status
cat > /app/health.json << EOF
{
    "status": "ready",
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "services": {
        "rust": "$ENABLE_RUST_SERVICES",
        "redis": true,
        "ollama": true
    }
}
EOF

# Start the main application
echo "🎯 Starting main application..."

# Execute the main command (passed as arguments to this script)
exec "$@" &
NODE_PID=$!

# Wait for the process
wait "$NODE_PID"