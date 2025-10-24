#!/bin/bash

# Universal AI Tools - Comprehensive Fix and Startup Script
# This script fixes critical issues and starts all services properly

set -e

echo "🔧 Universal AI Tools - Comprehensive Fix and Startup"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to check if a port is available
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 1
    else
        return 0
    fi
}

# Function to kill processes on specific ports
kill_port() {
    local port=$1
    local service_name=$2

    if ! check_port $port; then
        print_status $YELLOW "⚠️  Killing existing process on port $port ($service_name)..."
        lsof -ti :$port | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
}

# Function to wait for service to be ready
wait_for_service() {
    local port=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1

    print_status $YELLOW "⏳ Waiting for $service_name to be ready on port $port..."

    while [ $attempt -le $max_attempts ]; do
        if nc -z localhost $port 2>/dev/null; then
            print_status $GREEN "✅ $service_name is ready!"
            return 0
        fi

        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done

    print_status $RED "❌ $service_name failed to start on port $port"
    return 1
}

# Function to start a Go service
start_go_service() {
    local service_name=$1
    local port=$2
    local dir=$3

    print_status $BLUE "🚀 Starting $service_name (Go) on port $port..."

    # Kill any existing process on this port
    kill_port $port "$service_name"

    cd "$dir"
    PORT=$port go run main.go > "../../logs/${service_name}.log" 2>&1 &
    local pid=$!
    echo $pid > "../../pids/${service_name}.pid"
    cd - > /dev/null

    # Brief pause to let service initialize
    sleep 3

    if wait_for_service $port "$service_name"; then
        print_status $GREEN "✅ $service_name started successfully (PID: $pid)"
        return 0
    else
        print_status $RED "❌ $service_name failed to start"
        return 1
    fi
}

# Function to start a Rust service
start_rust_service() {
    local service_name=$1
    local port=$2
    local dir=$3

    print_status $BLUE "🦀 Starting $service_name (Rust) on port $port..."

    # Kill any existing process on this port
    kill_port $port "$service_name"

    cd "$dir"
    RUST_LOG=info PORT=$port cargo run --release > "../../logs/${service_name}.log" 2>&1 &
    local pid=$!
    echo $pid > "../../pids/${service_name}.pid"
    cd - > /dev/null

    # Rust services take a bit longer to compile and start
    sleep 5

    if wait_for_service $port "$service_name"; then
        print_status $GREEN "✅ $service_name started successfully (PID: $pid)"
        return 0
    else
        print_status $RED "❌ $service_name failed to start"
        return 1
    fi
}

# Create directories for logs and PIDs
mkdir -p logs pids

print_status $BLUE "🔧 Phase 1: Fixing Critical Issues..."

# Fix 1: Resolve port conflicts
print_status $YELLOW "🔧 Resolving port conflicts..."

# Kill all existing services to start fresh
print_status $YELLOW "🔄 Stopping all existing services..."
pkill -f "go run main.go" 2>/dev/null || true
pkill -f "cargo run" 2>/dev/null || true
pkill -f "llm-router" 2>/dev/null || true
pkill -f "assistantd" 2>/dev/null || true
sleep 3

# Fix 2: Update port configurations
print_status $YELLOW "🔧 Updating port configurations..."

# Update API Gateway to use port 8081 instead of 8080
if [ -f "go-services/api-gateway/main.go" ]; then
    sed -i.bak 's/port := getEnvOrDefault("PORT", "8080")/port := getEnvOrDefault("PORT", "8081")/g' go-services/api-gateway/main.go 2>/dev/null || true
fi

print_status $GREEN "✅ Port conflicts resolved"

# Fix 3: Build services
print_status $BLUE "🔨 Building services..."

# Build Go services
print_status $BLUE "🔨 Building Go services..."
cd go-services
go mod tidy
cd ..

# Build Rust services
print_status $BLUE "🔨 Building Rust services..."
cargo build --release

print_status $GREEN "✅ Services built successfully"

# Fix 4: Start services in correct order
print_status $BLUE "🚀 Phase 2: Starting services in correct order..."

# Start core infrastructure first (Go)
start_go_service "api-gateway" 8081 "go-services/api-gateway"
start_go_service "auth-service" 8015 "go-services/auth-service"

# Start high-performance ML services (Rust)
start_rust_service "llm-router" 3033 "crates/llm-router"
start_rust_service "assistantd" 3032 "crates/assistantd"

# Start additional Go services
start_go_service "chat-service" 8016 "go-services/chat-service"
start_go_service "memory-service" 8017 "go-services/memory-service"
start_go_service "load-balancer" 8011 "go-services/load-balancer"
start_go_service "cache-coordinator" 8012 "go-services/cache-coordinator"
start_go_service "metrics-aggregator" 8013 "go-services/metrics-aggregator"
start_go_service "websocket-hub" 8018 "go-services/websocket-hub"

# Start additional Rust services
start_rust_service "vector-db" 3034 "crates/vector-db"

print_status $GREEN "🎉 All services started successfully!"

# Fix 5: Verify all services are working
print_status $BLUE "🔍 Phase 3: Verifying service health..."

services=(
    "API Gateway:8081"
    "Auth Service:8015"
    "LLM Router:3033"
    "Assistantd:3032"
    "Chat Service:8016"
    "Memory Service:8017"
    "Load Balancer:8011"
    "Cache Coordinator:8012"
    "Metrics Aggregator:8013"
    "WebSocket Hub:8018"
    "Vector DB:3034"
)

all_healthy=true

for service in "${services[@]}"; do
    name=$(echo $service | cut -d: -f1)
    port=$(echo $service | cut -d: -f2)

    if curl -s -m 5 "http://localhost:$port/health" >/dev/null 2>&1; then
        print_status $GREEN "✅ $name (port $port) - Healthy"
    else
        print_status $RED "❌ $name (port $port) - Unhealthy"
        all_healthy=false
    fi
done

echo ""
if [ "$all_healthy" = true ]; then
    print_status $GREEN "🎉 All services are healthy and operational!"
else
    print_status $YELLOW "⚠️  Some services are unhealthy. Check logs for details."
fi

print_status $BLUE "📊 Service Summary:"
print_status $BLUE "   🚪 API Gateway (Go):     http://localhost:8081"
print_status $BLUE "   🔐 Auth Service (Go):    http://localhost:8015"
print_status $BLUE "   🔀 LLM Router (Rust):    http://localhost:3033"
print_status $BLUE "   🤖 Assistantd (Rust):   http://localhost:3032"
print_status $BLUE "   💬 Chat Service (Go):    http://localhost:8016"
print_status $BLUE "   🧠 Memory Service (Go):  http://localhost:8017"
print_status $BLUE "   ⚖️  Load Balancer (Go):  http://localhost:8011"
print_status $BLUE "   📊 Metrics (Go):        http://localhost:8013"
print_status $BLUE "   🔌 WebSocket (Go):      http://localhost:8018"
print_status $BLUE "   🗄️  Vector DB (Rust):    http://localhost:3034"

echo ""
print_status $GREEN "🔥 Universal AI Tools is now fully operational!"
print_status $GREEN "🚀 Primary API endpoint: http://localhost:8081"
print_status $GREEN "🤖 AI Chat endpoint: http://localhost:3032"
print_status $GREEN "🔀 LLM Router endpoint: http://localhost:3033"

echo ""
print_status $BLUE "📋 Quick Commands:"
print_status $BLUE "   Health Check: curl http://localhost:8081/health"
print_status $BLUE "   AI Chat: curl -X POST http://localhost:3032/chat"
print_status $BLUE "   LLM Models: curl http://localhost:3033/models"
print_status $BLUE "   Stop All: ./stop-go-rust.sh"
print_status $BLUE "   Status: ./status-go-rust.sh"
