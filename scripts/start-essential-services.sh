#!/bin/bash

# Universal AI Tools - Start Essential Services Only
# This script starts only the core services needed for basic functionality

set -e

echo "🚀 Universal AI Tools - Starting Essential Services"
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

print_status $BLUE "🔧 Stopping existing services..."

# Kill all existing services to start fresh
pkill -f "go run main.go" 2>/dev/null || true
pkill -f "cargo run" 2>/dev/null || true
pkill -f "llm-router" 2>/dev/null || true
pkill -f "assistantd" 2>/dev/null || true
sleep 3

print_status $BLUE "🚀 Starting essential services..."

# Start only the essential services that are working
start_go_service "api-gateway" 8081 "go-services/api-gateway"
start_go_service "auth-service" 8015 "go-services/auth-service"
start_go_service "memory-service" 8017 "go-services/memory-service"
start_go_service "load-balancer" 8011 "go-services/load-balancer"
start_go_service "metrics-aggregator" 8013 "go-services/metrics-aggregator"

# Start Rust services (only the ones that compile successfully)
start_rust_service "llm-router" 3033 "crates/llm-router"
start_rust_service "assistantd" 3032 "crates/assistantd"

print_status $GREEN "🎉 Essential services started!"

# Verify essential services
print_status $BLUE "🔍 Verifying essential services..."

services=(
    "API Gateway:8081"
    "Auth Service:8015"
    "Memory Service:8017"
    "Load Balancer:8011"
    "Metrics Aggregator:8013"
    "LLM Router:3033"
    "Assistantd:3032"
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
    print_status $GREEN "🎉 All essential services are healthy and operational!"
else
    print_status $YELLOW "⚠️  Some services are unhealthy. Check logs for details."
fi

print_status $BLUE "📊 Essential Service Summary:"
print_status $BLUE "   🚪 API Gateway (Go):     http://localhost:8081"
print_status $BLUE "   🔐 Auth Service (Go):    http://localhost:8015"
print_status $BLUE "   🧠 Memory Service (Go):  http://localhost:8017"
print_status $BLUE "   ⚖️  Load Balancer (Go):  http://localhost:8011"
print_status $BLUE "   📊 Metrics (Go):        http://localhost:8013"
print_status $BLUE "   🔀 LLM Router (Rust):    http://localhost:3033"
print_status $BLUE "   🤖 Assistantd (Rust):   http://localhost:3032"

echo ""
print_status $GREEN "🔥 Universal AI Tools essential services are now operational!"
print_status $GREEN "🚀 Primary API endpoint: http://localhost:8081"
print_status $GREEN "🤖 AI Chat endpoint: http://localhost:3032"
print_status $GREEN "🔀 LLM Router endpoint: http://localhost:3033"

echo ""
print_status $BLUE "📋 Quick Commands:"
print_status $BLUE "   Health Check: curl http://localhost:8081/health"
print_status $BLUE "   AI Chat: curl -X POST http://localhost:3032/chat"
print_status $BLUE "   LLM Models: curl http://localhost:3033/models"
print_status $BLUE "   Stop All: pkill -f 'go run main.go' && pkill -f 'cargo run'"
