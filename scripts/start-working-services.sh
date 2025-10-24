#!/bin/bash

# Universal AI Tools - Start Working Services Only
# This script starts only the services that are confirmed to work

set -e

echo "🚀 Universal AI Tools - Starting Working Services"
echo "================================================"

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

print_status $BLUE "🚀 Starting working services..."

# Start the services that we know work
start_go_service "api-gateway" 8081 "go-services/api-gateway"
start_go_service "auth-service" 8015 "go-services/auth-service"

# Try to start additional services
start_go_service "load-balancer" 8011 "go-services/load-balancer"
start_go_service "metrics-aggregator" 8013 "go-services/metrics-aggregator"

# Try to start Rust services (skip if they fail)
if start_rust_service "llm-router" 3033 "crates/llm-router"; then
    print_status $GREEN "✅ LLM Router started successfully"
else
    print_status $YELLOW "⚠️  LLM Router failed to start - continuing without it"
fi

if start_rust_service "assistantd" 3032 "crates/assistantd"; then
    print_status $GREEN "✅ Assistantd started successfully"
else
    print_status $YELLOW "⚠️  Assistantd failed to start - continuing without it"
fi

print_status $GREEN "🎉 Working services started!"

# Verify working services
print_status $BLUE "🔍 Verifying working services..."

services=(
    "API Gateway:8081"
    "Auth Service:8015"
    "Load Balancer:8011"
    "Metrics Aggregator:8013"
    "LLM Router:3033"
    "Assistantd:3032"
)

healthy_count=0
total_count=${#services[@]}

for service in "${services[@]}"; do
    name=$(echo $service | cut -d: -f1)
    port=$(echo $service | cut -d: -f2)

    if curl -s -m 5 "http://localhost:$port/health" >/dev/null 2>&1; then
        print_status $GREEN "✅ $name (port $port) - Healthy"
        healthy_count=$((healthy_count + 1))
    else
        print_status $RED "❌ $name (port $port) - Unhealthy"
    fi
done

echo ""
print_status $BLUE "📊 Service Status: $healthy_count/$total_count services healthy"

if [ $healthy_count -gt 0 ]; then
    print_status $GREEN "🎉 Universal AI Tools is partially operational!"
    print_status $BLUE "📊 Working Service Summary:"

    # Show only the working services
    if curl -s -m 5 "http://localhost:8081/health" >/dev/null 2>&1; then
        print_status $BLUE "   🚪 API Gateway (Go):     http://localhost:8081"
    fi
    if curl -s -m 5 "http://localhost:8015/health" >/dev/null 2>&1; then
        print_status $BLUE "   🔐 Auth Service (Go):    http://localhost:8015"
    fi
    if curl -s -m 5 "http://localhost:8011/health" >/dev/null 2>&1; then
        print_status $BLUE "   ⚖️  Load Balancer (Go):  http://localhost:8011"
    fi
    if curl -s -m 5 "http://localhost:8013/health" >/dev/null 2>&1; then
        print_status $BLUE "   📊 Metrics (Go):        http://localhost:8013"
    fi
    if curl -s -m 5 "http://localhost:3033/health" >/dev/null 2>&1; then
        print_status $BLUE "   🔀 LLM Router (Rust):    http://localhost:3033"
    fi
    if curl -s -m 5 "http://localhost:3032/health" >/dev/null 2>&1; then
        print_status $BLUE "   🤖 Assistantd (Rust):   http://localhost:3032"
    fi

    echo ""
    print_status $GREEN "🚀 Primary API endpoint: http://localhost:8081"

    echo ""
    print_status $BLUE "📋 Quick Commands:"
    print_status $BLUE "   Health Check: curl http://localhost:8081/health"
    if curl -s -m 5 "http://localhost:3032/health" >/dev/null 2>&1; then
        print_status $BLUE "   AI Chat: curl -X POST http://localhost:3032/chat"
    fi
    if curl -s -m 5 "http://localhost:3033/health" >/dev/null 2>&1; then
        print_status $BLUE "   LLM Models: curl http://localhost:3033/models"
    fi
    print_status $BLUE "   Stop All: pkill -f 'go run main.go' && pkill -f 'cargo run'"
else
    print_status $RED "❌ No services are healthy. Check logs for details."
fi
