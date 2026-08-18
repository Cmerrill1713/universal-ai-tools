#!/bin/bash

# Modern Rust Services Stop Script
# Gracefully stops all services with proper cleanup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# PID file directory
PID_DIR="/tmp/universal-ai-tools"

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

# Stop a service by PID file
stop_service() {
    local name=$1
    local pid_file="$PID_DIR/${name,,}.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            print_status "Stopping $name (PID: $pid)..."
            kill -TERM "$pid"
            
            # Wait for graceful shutdown
            local count=0
            while kill -0 "$pid" 2>/dev/null && [ $count -lt 10 ]; do
                sleep 1
                count=$((count + 1))
            done
            
            # Force kill if still running
            if kill -0 "$pid" 2>/dev/null; then
                print_warning "Force killing $name..."
                kill -KILL "$pid"
            fi
            
            print_success "$name stopped"
        else
            print_warning "$name was not running"
        fi
        rm -f "$pid_file"
    else
        print_warning "No PID file found for $name"
    fi
}

# Stop service by port
stop_service_by_port() {
    local port=$1
    local name=$2
    
    local pid=$(lsof -ti :$port 2>/dev/null)
    if [ -n "$pid" ]; then
        print_status "Stopping service on port $port ($name)..."
        kill -TERM "$pid" 2>/dev/null || true
        
        # Wait for graceful shutdown
        local count=0
        while kill -0 "$pid" 2>/dev/null && [ $count -lt 10 ]; do
            sleep 1
            count=$((count + 1))
        done
        
        # Force kill if still running
        if kill -0 "$pid" 2>/dev/null; then
            print_warning "Force killing service on port $port..."
            kill -KILL "$pid" 2>/dev/null || true
        fi
        
        print_success "Service on port $port stopped"
    else
        print_warning "No service found on port $port"
    fi
}

# Main stop process
main() {
    echo "🛑 Stopping Modern Universal AI Tools Services..."
    echo "==============================================="
    
    # Stop services by PID files
    stop_service "MLX-Service"
    stop_service "DSPy-Service"
    stop_service "Vision-Service"
    stop_service "API-Gateway"
    
    # Stop any remaining services by port
    stop_service_by_port 8001 "MLX HTTP"
    stop_service_by_port 8002 "MLX gRPC"
    stop_service_by_port 8003 "DSPy HTTP"
    stop_service_by_port 8004 "DSPy gRPC"
    stop_service_by_port 8005 "Vision HTTP"
    stop_service_by_port 8006 "Vision gRPC"
    stop_service_by_port 9999 "API Gateway"
    
    # Clean up PID directory
    if [ -d "$PID_DIR" ]; then
        print_status "Cleaning up PID files..."
        rm -rf "$PID_DIR"
        print_success "Cleanup complete"
    fi
    
    echo ""
    print_success "All services stopped successfully! 🎉"
    echo ""
    echo "📝 Log files are preserved in:"
    echo "  • MLX:              $PID_DIR/mlx-service.log"
    echo "  • DSPy:             $PID_DIR/dspy-service.log"
    echo "  • Vision:           $PID_DIR/vision-service.log"
    echo "  • API Gateway:      $PID_DIR/api-gateway.log"
    echo ""
    echo "🚀 To start services again:"
    echo "  ./start-modern-rust-services.sh"
}

# Run main function
main "$@"