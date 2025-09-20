#!/bin/bash

echo "🚀 STARTING BACKEND SERVICES"
echo "============================"
echo ""

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -i :$port >/dev/null 2>&1; then
        echo "✅ Port $port is already in use"
        return 0
    else
        echo "❌ Port $port is free"
        return 1
    fi
}

# Function to start a service
start_service() {
    local service_name=$1
    local port=$2
    local directory=$3
    local command=$4
    
    echo "🔧 Starting $service_name on port $port..."
    
    if check_port $port; then
        echo "   $service_name is already running on port $port"
    else
        cd "$directory"
        echo "   Starting $service_name..."
        $command &
        sleep 2
        
        # Check if service started successfully
        if check_port $port; then
            echo "   ✅ $service_name started successfully"
        else
            echo "   ❌ Failed to start $service_name"
        fi
    fi
    echo ""
}

# Start Research Service (port 8028)
start_service "Research Service" 8028 "/Users/christianmerrill/Desktop/universal-ai-tools/go-services/research-service" "go run main.go"

# Start Implementation Service (port 8029)
start_service "Implementation Service" 8029 "/Users/christianmerrill/Desktop/universal-ai-tools/go-services/implementation-service" "go run main.go"

# Start Chat Service (port 8016)
start_service "Chat Service" 8016 "/Users/christianmerrill/Desktop/universal-ai-tools/go-services/chat-service" "go run main.go"

# Start Node.js server for Athena (port 9999)
start_service "Node.js Athena Server" 9999 "/Users/christianmerrill/Desktop/universal-ai-tools" "npm start"

echo "🎉 BACKEND SERVICES STARTUP COMPLETE!"
echo "====================================="
echo ""
echo "Services running:"
echo "   - Research Service: http://localhost:8028"
echo "   - Implementation Service: http://localhost:8029"
echo "   - Chat Service: http://localhost:8016"
echo "   - Athena Server: http://localhost:9999"
echo ""
echo "You can now start the Swift frontend!"
echo ""
echo "To stop all services, run: ./stop-backend-services.sh"
