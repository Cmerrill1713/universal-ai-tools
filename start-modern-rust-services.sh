#!/bin/bash

# Modern Rust Services Start Script
# Starts all services with proper logging, health checks, and monitoring

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# PID file directory
PID_DIR="/tmp/universal-ai-tools"

# Create PID directory
mkdir -p "$PID_DIR"

# Helper functions
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if service is already running
is_port_in_use() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Start a service with proper logging
start_service() {
    local name=$1
    local port=$2
    local grpc_port=$3
    local binary_path=$4
    local config_path=$5
    
    print_status "Starting $name..."
    
    # Check if port is already in use
    if is_port_in_use $port; then
        print_warning "$name HTTP port $port is already in use, skipping..."
        return 0
    fi
    
    if is_port_in_use $grpc_port; then
        print_warning "$name gRPC port $grpc_port is already in use, skipping..."
        return 0
    fi
    
    # Check if binary exists
    if [ ! -f "$binary_path" ]; then
        print_error "$name binary not found at $binary_path"
        print_error "Please run ./build-modern-rust-services.sh first"
        exit 1
    fi
    
    # Set environment variables
    export RUST_LOG=info
    export CONFIG_PATH="$config_path"
    
    # Start the service
    nohup "$binary_path" > "$PID_DIR/${name,,}.log" 2>&1 &
    local pid=$!
    echo $pid > "$PID_DIR/${name,,}.pid"
    
    # Wait a moment for the service to start
    sleep 2
    
    # Check if the service is still running
    if kill -0 $pid 2>/dev/null; then
        print_success "$name started successfully (PID: $pid)"
        print_status "  HTTP: http://localhost:$port"
        print_status "  gRPC: localhost:$grpc_port"
        print_status "  Logs: $PID_DIR/${name,,}.log"
    else
        print_error "$name failed to start"
        print_error "Check logs: $PID_DIR/${name,,}.log"
        return 1
    fi
}

# Health check function
health_check() {
    local name=$1
    local port=$2
    local max_attempts=30
    local attempt=1
    
    print_status "Waiting for $name to be healthy..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "http://localhost:$port/health" >/dev/null 2>&1; then
            print_success "$name is healthy!"
            return 0
        fi
        
        print_status "Attempt $attempt/$max_attempts - waiting for $name..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "$name health check failed after $max_attempts attempts"
    return 1
}

# Main start process
main() {
    echo "🚀 Starting Modern Universal AI Tools Services..."
    echo "================================================"
    
    # Check if services are built
    if [ ! -f "rust-services/mlx-rust-service/target/release/mlx-server" ]; then
        print_error "Services not built. Please run ./build-modern-rust-services.sh first"
        exit 1
    fi
    
    # Start services in order
    start_service "MLX-Service" 8001 8002 \
        "rust-services/mlx-rust-service/target/release/mlx-server" \
        "rust-services/mlx-rust-service/config/default.toml"
    
    start_service "DSPy-Service" 8003 8004 \
        "rust-services/dspy-rust-service/target/release/dspy-server" \
        "rust-services/dspy-rust-service/config/default.toml"
    
    start_service "Vision-Service" 8005 8006 \
        "rust-services/vision-rust-service/target/release/vision-server" \
        "rust-services/vision-rust-service/config/default.toml"
    
    # Start API Gateway
    print_status "Starting API Gateway..."
    if is_port_in_use 9999; then
        print_warning "API Gateway port 9999 is already in use, skipping..."
    else
        if [ ! -f "go-services/api-gateway/api-gateway" ]; then
            print_error "API Gateway not built. Please run ./build-modern-rust-services.sh first"
            exit 1
        fi
        
        nohup ./go-services/api-gateway/api-gateway > "$PID_DIR/api-gateway.log" 2>&1 &
        local gateway_pid=$!
        echo $gateway_pid > "$PID_DIR/api-gateway.pid"
        
        sleep 2
        
        if kill -0 $gateway_pid 2>/dev/null; then
            print_success "API Gateway started successfully (PID: $gateway_pid)"
        else
            print_error "API Gateway failed to start"
        fi
    fi
    
    # Health checks
    echo ""
    print_status "Performing health checks..."
    
    health_check "MLX-Service" 8001
    health_check "DSPy-Service" 8003
    health_check "Vision-Service" 8005
    health_check "API-Gateway" 9999
    
    echo ""
    print_success "All services started successfully! 🎉"
    echo ""
    echo "📋 Service Status:"
    echo "  • MLX Service:      http://localhost:8001 (gRPC: 8002)"
    echo "  • DSPy Service:     http://localhost:8003 (gRPC: 8004)"
    echo "  • Vision Service:   http://localhost:8005 (gRPC: 8006)"
    echo "  • API Gateway:      http://localhost:9999"
    echo ""
    echo "📊 Monitoring:"
    echo "  • MLX Metrics:      http://localhost:9090"
    echo "  • DSPy Metrics:      http://localhost:9091"
    echo "  • Vision Metrics:    http://localhost:9092"
    echo ""
    echo "📝 Logs:"
    echo "  • MLX:              $PID_DIR/mlx-service.log"
    echo "  • DSPy:             $PID_DIR/dspy-service.log"
    echo "  • Vision:           $PID_DIR/vision-service.log"
    echo "  • API Gateway:      $PID_DIR/api-gateway.log"
    echo ""
    echo "🛑 To stop all services:"
    echo "  ./stop-modern-rust-services.sh"
    echo ""
    print_success "Modern Universal AI Tools is running! 🚀"
}

# Run main function
main "$@"