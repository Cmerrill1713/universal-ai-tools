#!/bin/bash

# Universal AI Tools - Stop All Services Script
# Stops all running services

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

# Function to stop a service
stop_service() {
    local service_name=$1
    local port=$2
    local pid_file="logs/$service_name.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 $pid 2>/dev/null; then
            print_status "Stopping $service_name (PID: $pid)..."
            kill $pid
            sleep 1
            if kill -0 $pid 2>/dev/null; then
                print_warning "Force killing $service_name..."
                kill -9 $pid
            fi
            print_success "$service_name stopped"
        else
            print_warning "$service_name was not running"
        fi
        rm -f "$pid_file"
    else
        print_warning "No PID file found for $service_name"
    fi
}

print_status "🛑 Stopping Universal AI Tools Services..."

# Stop services in reverse order
stop_service "API Gateway" 9999
stop_service "Vision Service" 8003
stop_service "DSPy Orchestrator" 8002
stop_service "MLX Service" 8001

# Clean up any remaining processes
print_status "Cleaning up any remaining processes..."

# Kill any remaining processes on our ports
for port in 9999 8003 8002 8001; do
    local pid=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$pid" ]; then
        print_warning "Killing process on port $port (PID: $pid)"
        kill -9 $pid 2>/dev/null || true
    fi
done

# Clean up log files
if [ -d "logs" ]; then
    print_status "Cleaning up log files..."
    rm -f logs/*.pid
    print_success "Log files cleaned up"
fi

print_success "🎉 All services stopped successfully!"
echo ""
echo "📊 Service Status:"
echo "  • MLX Service:      Stopped"
echo "  • DSPy Orchestrator: Stopped"
echo "  • Vision Service:   Stopped"
echo "  • API Gateway:      Stopped"
echo ""
echo "🚀 To start services again:"
echo "  ./start-rust-services.sh"
echo ""
print_success "Universal AI Tools services stopped! 🛑"