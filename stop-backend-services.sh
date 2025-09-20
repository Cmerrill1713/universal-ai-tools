#!/bin/bash

echo "🛑 STOPPING BACKEND SERVICES"
echo "============================"
echo ""

# Function to stop services by port
stop_service_by_port() {
    local port=$1
    local service_name=$2
    
    echo "🔧 Stopping $service_name on port $port..."
    
    # Find and kill process using the port
    local pid=$(lsof -ti :$port)
    if [ ! -z "$pid" ]; then
        echo "   Killing process $pid..."
        kill $pid
        sleep 1
        
        # Check if still running
        if lsof -i :$port >/dev/null 2>&1; then
            echo "   Force killing process..."
            kill -9 $pid
        fi
        
        echo "   ✅ $service_name stopped"
    else
        echo "   $service_name was not running"
    fi
    echo ""
}

# Stop services by port
stop_service_by_port 8028 "Research Service"
stop_service_by_port 8029 "Implementation Service"
stop_service_by_port 8016 "Chat Service"
stop_service_by_port 9999 "Node.js Athena Server"

# Also kill any remaining Go processes
echo "🔧 Cleaning up any remaining Go processes..."
pkill -f "go run main.go" 2>/dev/null || true
pkill -f "npm start" 2>/dev/null || true

echo "🎉 ALL BACKEND SERVICES STOPPED!"
echo "================================"
echo ""
echo "All services have been stopped."
echo "To restart, run: ./start-backend-services.sh"
