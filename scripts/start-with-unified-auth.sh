#!/bin/bash
# Universal AI Tools - Unified Authentication Startup Script
# Starts all services with shared JWT configuration

set -e

echo "🚀 Starting Universal AI Tools with Unified JWT Authentication"

# Load shared environment variables
if [ -f ".env.shared" ]; then
    echo "📋 Loading shared environment configuration..."
    export $(grep -v '^#' .env.shared | xargs)
else
    echo "❌ .env.shared file not found!"
    exit 1
fi

# Function to check if port is available
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        echo "⚠️ Port $port is already in use"
        return 1
    fi
    return 0
}

# Function to wait for service
wait_for_service() {
    local url=$1
    local name=$2
    local max_attempts=30
    local attempt=0
    
    echo "⏳ Waiting for $name to be ready..."
    while [ $attempt -lt $max_attempts ]; do
        if curl -sf "$url" >/dev/null 2>&1; then
            echo "✅ $name is ready!"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 1
    done
    echo "❌ $name failed to start within 30 seconds"
    return 1
}

# Kill existing services
echo "🧹 Cleaning up existing processes..."
pkill -f "go run.*main.go" || true
pkill -f "cargo run" || true
pkill -f "go-websocket" || true

# Check required ports
echo "🔍 Checking port availability..."
check_port $GO_API_GATEWAY_PORT || exit 1
check_port $RUST_LLM_ROUTER_PORT || exit 1
check_port $GO_WEBSOCKET_PORT || exit 1

# Start Redis if not running
if ! pgrep redis-server > /dev/null; then
    echo "🚀 Starting Redis..."
    redis-server --daemonize yes --port $REDIS_PORT
fi

# Start Go API Gateway
echo "🚀 Starting Go API Gateway (Port: $GO_API_GATEWAY_PORT)..."
cd go-api-gateway
go run cmd/main.go > ../logs/go-api-gateway.log 2>&1 &
GO_API_PID=$!
cd ..

# Start Rust LLM Router
echo "🚀 Starting Rust LLM Router (Port: $RUST_LLM_ROUTER_PORT)..."
cd rust-services/llm-router
RUST_LOG=info cargo run --release > ../../logs/llm-router.log 2>&1 &
LLM_ROUTER_PID=$!
cd ../..

# Start Go WebSocket Service
echo "🚀 Starting Go WebSocket Service (Port: $GO_WEBSOCKET_PORT)..."
cd rust-services/go-websocket
go run *.go > ../../logs/websocket.log 2>&1 &
WEBSOCKET_PID=$!
cd ../..

# Create logs directory if it doesn't exist
mkdir -p logs

# Wait for services to be ready
echo "⏳ Waiting for services to initialize..."
sleep 3

# Test service connectivity
echo "🔍 Testing service health..."

if wait_for_service "http://localhost:$GO_API_GATEWAY_PORT/api/v1/health" "Go API Gateway"; then
    echo "✅ Go API Gateway is healthy"
else
    echo "❌ Go API Gateway health check failed"
fi

if wait_for_service "http://localhost:$RUST_LLM_ROUTER_PORT/health" "Rust LLM Router"; then
    echo "✅ Rust LLM Router is healthy"
else
    echo "❌ Rust LLM Router health check failed"
fi

if wait_for_service "http://localhost:$GO_WEBSOCKET_PORT/health" "Go WebSocket Service"; then
    echo "✅ Go WebSocket Service is healthy"
else
    echo "❌ Go WebSocket Service health check failed"
fi

# Test JWT token generation and validation across services
echo "🔐 Testing unified JWT authentication..."

echo "📝 Generating demo token from Go API Gateway..."
TOKEN_RESPONSE=$(curl -s -X POST http://localhost:$GO_API_GATEWAY_PORT/api/v1/auth/demo-token \
    -H "Content-Type: application/json" \
    -d '{"name":"Unified Auth Test","duration":"1h"}')

TOKEN=$(echo $TOKEN_RESPONSE | jq -r '.data.token')

if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
    echo "✅ JWT token generated successfully"
    
    # Test token with LLM Router (if it has a protected endpoint)
    echo "🔍 Testing JWT token validation across services..."
    
    # Test with Go API Gateway chat endpoint
    echo "Testing Go API Gateway with JWT..."
    CHAT_RESPONSE=$(curl -s -X POST http://localhost:$GO_API_GATEWAY_PORT/api/v1/chat/ \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{"message":"JWT test","agentName":"lm-studio"}' | jq -r '.success')
    
    if [ "$CHAT_RESPONSE" = "true" ]; then
        echo "✅ JWT authentication working with Go API Gateway"
    else
        echo "❌ JWT authentication failed with Go API Gateway"
    fi
    
else
    echo "❌ Failed to generate JWT token"
fi

echo ""
echo "🎉 Universal AI Tools with Unified JWT Authentication is running!"
echo ""
echo "📋 Service Status:"
echo "  🔐 Go API Gateway:     http://localhost:$GO_API_GATEWAY_PORT (PID: $GO_API_PID)"
echo "  🤖 Rust LLM Router:    http://localhost:$RUST_LLM_ROUTER_PORT (PID: $LLM_ROUTER_PID)"
echo "  🔌 Go WebSocket:       ws://localhost:$GO_WEBSOCKET_PORT (PID: $WEBSOCKET_PID)"
echo ""
echo "🔑 JWT Configuration:"
echo "  Issuer: $JWT_ISSUER"
echo "  Audience: $JWT_AUDIENCE"
echo "  Auth Required: $REQUIRE_AUTH"
echo "  Anonymous Allowed: $ALLOW_ANONYMOUS"
echo ""
echo "📚 API Endpoints:"
echo "  Demo Token: POST http://localhost:$GO_API_GATEWAY_PORT/api/v1/auth/demo-token"
echo "  Chat API:   POST http://localhost:$GO_API_GATEWAY_PORT/api/v1/chat/"
echo "  Health:     GET  http://localhost:$GO_API_GATEWAY_PORT/api/v1/health"
echo ""
echo "📝 Logs available in:"
echo "  - logs/go-api-gateway.log"
echo "  - logs/llm-router.log"
echo "  - logs/websocket.log"
echo ""
echo "🛑 To stop all services: ./scripts/stop-services.sh"

# Save PIDs for cleanup
echo "GO_API_PID=$GO_API_PID" > .service_pids
echo "LLM_ROUTER_PID=$LLM_ROUTER_PID" >> .service_pids
echo "WEBSOCKET_PID=$WEBSOCKET_PID" >> .service_pids

echo ""
echo "✅ All services started with unified JWT authentication!"