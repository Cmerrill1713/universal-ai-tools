#!/bin/bash

# Universal AI Tools - Stop All Services
# This script stops all running Go services

echo "🛑 Stopping Universal AI Tools Services..."

# Function to stop services by name pattern
stop_services() {
    local pattern=$1
    local pids=$(pgrep -f "$pattern")

    if [ -n "$pids" ]; then
        echo "Stopping services matching '$pattern'..."
        echo "$pids" | xargs kill
        echo "✅ Services stopped"
    else
        echo "No services found matching '$pattern'"
    fi
}

# Stop all Go services
stop_services "auth-service"
stop_services "monitoring-service"
stop_services "shared-memory-binary"
stop_services "message-broker"
stop_services "load-balancer"
stop_services "ml-stream-processor"
stop_services "service-discovery"
stop_services "api-gateway"

# Stop any remaining Go processes
stop_services "go-services"

echo ""
echo "🎉 All services stopped!"
echo ""
echo "To start services again, run: ./start-working-services.sh"
