#!/bin/bash

# Universal AI Tools - Stop Go/Rust Services

set -e

echo "🛑 Stopping Universal AI Tools Services..."
echo "======================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to stop service by PID file
stop_service() {
    local service_name=$1
    local pid_file="pids/${service_name}.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p $pid > /dev/null 2>&1; then
            print_status $YELLOW "🛑 Stopping $service_name (PID: $pid)..."
            kill -TERM $pid 2>/dev/null || kill -9 $pid 2>/dev/null
            
            # Wait for graceful shutdown
            local count=0
            while ps -p $pid > /dev/null 2>&1 && [ $count -lt 10 ]; do
                sleep 1
                count=$((count + 1))
            done
            
            if ps -p $pid > /dev/null 2>&1; then
                kill -9 $pid 2>/dev/null
                print_status $RED "⚠️  Force killed $service_name"
            else
                print_status $GREEN "✅ $service_name stopped gracefully"
            fi
        else
            print_status $YELLOW "⚠️  $service_name process not running"
        fi
        rm -f "$pid_file"
    else
        print_status $YELLOW "⚠️  No PID file found for $service_name"
    fi
}

# Stop services in reverse order (last started, first stopped)
print_status $YELLOW "🔄 Stopping services..."

stop_service "legacy-bridge"
stop_service "agent-coordination"
stop_service "websocket-hub"
stop_service "metrics-aggregator"
stop_service "cache-coordinator"
stop_service "load-balancer"
stop_service "memory-service"
stop_service "chat-service"
stop_service "parameter-analytics"
stop_service "llm-router"
stop_service "ml-inference"
stop_service "auth-service"
stop_service "api-gateway"

# Kill any remaining processes on our ports
print_status $YELLOW "🧹 Cleaning up any remaining processes..."

PORTS=(8080 8015 8084 3031 3032 8016 8017 8011 8012 8013 8018 3034 9999)

for port in "${PORTS[@]}"; do
    local pids=$(lsof -ti :$port 2>/dev/null || true)
    if [ ! -z "$pids" ]; then
        print_status $YELLOW "🔫 Killing processes on port $port: $pids"
        echo $pids | xargs kill -9 2>/dev/null || true
    fi
done

# Clean up directories
rm -rf pids/*.pid 2>/dev/null || true

print_status $GREEN "✅ All services stopped"
print_status $GREEN "🧹 Cleanup complete"