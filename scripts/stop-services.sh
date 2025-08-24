#!/bin/bash
# Universal AI Tools - Stop All Services Script

echo "🛑 Stopping Universal AI Tools services..."

# Kill services by PID if available
if [ -f ".service_pids" ]; then
    source .service_pids
    
    echo "📝 Stopping services by PID..."
    
    if [ -n "$GO_API_PID" ]; then
        echo "🛑 Stopping Go API Gateway (PID: $GO_API_PID)..."
        kill $GO_API_PID 2>/dev/null || echo "   Already stopped"
    fi
    
    if [ -n "$LLM_ROUTER_PID" ]; then
        echo "🛑 Stopping Rust LLM Router (PID: $LLM_ROUTER_PID)..."
        kill $LLM_ROUTER_PID 2>/dev/null || echo "   Already stopped"
    fi
    
    if [ -n "$WEBSOCKET_PID" ]; then
        echo "🛑 Stopping Go WebSocket Service (PID: $WEBSOCKET_PID)..."
        kill $WEBSOCKET_PID 2>/dev/null || echo "   Already stopped"
    fi
    
    rm .service_pids
fi

# Fallback: kill by process name/pattern
echo "🧹 Cleaning up any remaining processes..."

# Kill Go API Gateway processes
pkill -f "go run.*main.go" || true

# Kill Rust processes
pkill -f "cargo run" || true
pkill -f "llm-router" || true

# Kill WebSocket processes
pkill -f "go-websocket" || true

# Kill any processes on our known ports
for port in 8081 8001 8080; do
    PID=$(lsof -ti :$port 2>/dev/null)
    if [ -n "$PID" ]; then
        echo "🛑 Killing process on port $port (PID: $PID)..."
        kill $PID 2>/dev/null || true
    fi
done

echo "✅ All services stopped!"