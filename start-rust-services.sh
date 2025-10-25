#!/bin/bash

# Universal AI Tools - Start All Services Script
# Starts all Rust services and Go API Gateway

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to start a service
start_service() {
    local service_name=$1
    local port=$2
    local command=$3
    
    if check_port $port; then
        print_warning "$service_name is already running on port $port"
        return 0
    fi
    
    print_status "Starting $service_name on port $port..."
    nohup $command > logs/$service_name.log 2>&1 &
    local pid=$!
    echo $pid > logs/$service_name.pid
    
    # Wait a moment and check if it started successfully
    sleep 2
    if check_port $port; then
        print_success "$service_name started successfully (PID: $pid)"
    else
        print_error "Failed to start $service_name"
        return 1
    fi
}

# Create logs directory
mkdir -p logs

print_status "🚀 Starting Universal AI Tools Services..."

# Check if services are already built
if [ ! -f "rust-services/mlx-rust-service/target/release/mlx-server" ]; then
    print_error "MLX Service not built. Run ./build-rust-services.sh first"
    exit 1
fi

if [ ! -f "rust-services/dspy-rust-service/target/release/dspy-server" ]; then
    print_error "DSPy Orchestrator not built. Run ./build-rust-services.sh first"
    exit 1
fi

if [ ! -f "rust-services/vision-rust-service/target/release/vision-server" ]; then
    print_error "Vision Service not built. Run ./build-rust-services.sh first"
    exit 1
fi

if [ ! -f "go-services/api-gateway/api-gateway" ]; then
    print_error "API Gateway not built. Run ./build-rust-services.sh first"
    exit 1
fi

# Start services in order
start_service "MLX Service" 8001 "./rust-services/mlx-rust-service/target/release/mlx-server"
start_service "DSPy Orchestrator" 8002 "./rust-services/dspy-rust-service/target/release/dspy-server"
start_service "Vision Service" 8003 "./rust-services/vision-rust-service/target/release/vision-server"
start_service "API Gateway" 9999 "./go-services/api-gateway/api-gateway"

echo ""
print_success "🎉 All services started successfully!"
echo ""
echo "📋 Service Status:"
echo "  • MLX Service:      http://localhost:8001"
echo "  • DSPy Orchestrator: http://localhost:8002"
echo "  • Vision Service:   http://localhost:8003"
echo "  • API Gateway:      http://localhost:9999"
echo ""
echo "🔍 Health Checks:"
echo "  • MLX Health:       curl http://localhost:8001/health"
echo "  • DSPy Health:      curl http://localhost:8002/health"
echo "  • Vision Health:    curl http://localhost:8003/health"
echo "  • Gateway Health:   curl http://localhost:9999/health"
echo ""
echo "📊 Service Logs:"
echo "  • MLX Logs:         tail -f logs/MLX\ Service.log"
echo "  • DSPy Logs:        tail -f logs/DSPy\ Orchestrator.log"
echo "  • Vision Logs:      tail -f logs/Vision\ Service.log"
echo "  • Gateway Logs:     tail -f logs/API\ Gateway.log"
echo ""
echo "🛑 To stop all services:"
echo "  ./stop-rust-services.sh"
echo ""

# Wait a moment for all services to fully start
sleep 3

# Test the API Gateway
print_status "Testing API Gateway..."
if curl -s http://localhost:9999/health > /dev/null; then
    print_success "API Gateway is responding!"
else
    print_warning "API Gateway may not be fully ready yet"
fi

print_success "Universal AI Tools is now running on Go/Rust! 🚀"