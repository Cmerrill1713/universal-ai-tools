#!/bin/bash

# Universal AI Tools - Go/Rust Optimized Startup
# This script starts services prioritizing Go and Rust over TypeScript

set -e

export PROJECT_ROOT="$(pwd)"

echo "🚀 Universal AI Tools - Go/Rust Optimized Platform"
echo "================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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
    
    if ! check_port $port; then
        print_status $YELLOW "⚠️  Port $port is already in use, skipping $service_name"
        return 0
    fi
    
    print_status $BLUE "🚀 Starting $service_name (Go) on port $port..."
    
    cd "$dir"
    PORT=$port go run main.go > "../logs/${service_name}.log" 2>&1 &
    local pid=$!
    echo $pid > "../pids/${service_name}.pid"
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
    
    if ! check_port $port; then
        print_status $YELLOW "⚠️  Port $port is already in use, skipping $service_name"
        return 0
    fi
    
    print_status $BLUE "🦀 Starting $service_name (Rust) on port $port..."
    
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

print_status $BLUE "🔧 Preparing Go and Rust services..."

# Build Go services
print_status $BLUE "🔨 Building Go services..."
cd go-services
go mod tidy
cd ..

# Build Rust services  
print_status $BLUE "🔨 Building Rust services..."
cargo build --release

print_status $GREEN "📊 Starting services in priority order..."

# Start core infrastructure first (Go)
start_go_service "api-gateway" 8080 "go-services/api-gateway"
start_go_service "auth-service" 8015 "go-services/auth-service"

# Start high-performance ML services (Rust)
start_rust_service "ml-inference" 8084 "rust-services/ml-inference-service"
start_rust_service "llm-router" 3031 "crates/llm-router"
start_rust_service "parameter-analytics" 3032 "rust-services/parameter-analytics-service"

# Start additional Go services
start_go_service "chat-service" 8016 "go-services/chat-service"
start_go_service "memory-service" 8017 "go-services/memory-service"
start_go_service "load-balancer" 8011 "go-services/load-balancer"
start_go_service "cache-coordinator" 8012 "go-services/cache-coordinator"
start_go_service "metrics-aggregator" 8013 "go-services/metrics-aggregator"
start_go_service "websocket-hub" 8018 "go-services/websocket-hub"

# Start additional Rust services
start_rust_service "agent-coordination" 3034 "rust-services/agent-coordination-service"

# Start minimal TypeScript bridge last (only if needed)
if [ "$ENABLE_LEGACY_BRIDGE" = "true" ]; then
    print_status $YELLOW "🟨 Starting minimal TypeScript legacy bridge..."
    PORT=9999 npm run start:bridge > logs/legacy-bridge.log 2>&1 &
    echo $! > pids/legacy-bridge.pid
    
    if wait_for_service 9999 "legacy-bridge"; then
        print_status $GREEN "✅ Legacy TypeScript bridge started (minimal functionality)"
    else
        print_status $RED "❌ Legacy bridge failed to start"
    fi
else
    print_status $BLUE "ℹ️  Legacy TypeScript bridge disabled (Go/Rust only mode)"
fi

print_status $GREEN "🎉 Service startup complete!"
print_status $BLUE "📊 Service Summary:"
print_status $BLUE "   🚪 API Gateway (Go):     http://localhost:8080"
print_status $BLUE "   🔐 Auth Service (Go):    http://localhost:8015"
print_status $BLUE "   🧠 ML Inference (Rust):  http://localhost:8084"
print_status $BLUE "   🔀 LLM Router (Rust):    http://localhost:3031"
print_status $BLUE "   📊 Analytics (Rust):     http://localhost:3032"
print_status $BLUE "   💬 Chat Service (Go):    http://localhost:8016"
print_status $BLUE "   🧠 Memory Service (Go):  http://localhost:8017"

if [ "$ENABLE_LEGACY_BRIDGE" = "true" ]; then
    print_status $YELLOW "   🟨 Legacy Bridge (TS):   http://localhost:9999"
fi

print_status $GREEN ""
print_status $GREEN "🔥 All services are now running with Go/Rust optimization!"
print_status $GREEN "🚀 Primary API endpoint: http://localhost:8080"
print_status $GREEN ""
print_status $BLUE "To stop all services: ./stop-go-rust.sh"
print_status $BLUE "To check status: ./status-go-rust.sh"
