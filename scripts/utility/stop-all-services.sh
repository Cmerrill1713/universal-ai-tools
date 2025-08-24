#!/bin/bash

# Stop All Universal AI Tools Services

echo "🛑 Stopping Universal AI Tools Services"
echo "======================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Stop services by PID if available
if [ -f .pids/llm-router.pid ]; then
    PID=$(cat .pids/llm-router.pid)
    if kill $PID 2>/dev/null; then
        echo -e "${GREEN}✓${NC} Stopped LLM Router (PID: $PID)"
    fi
    rm .pids/llm-router.pid
fi

if [ -f .pids/websocket.pid ]; then
    PID=$(cat .pids/websocket.pid)
    if kill $PID 2>/dev/null; then
        echo -e "${GREEN}✓${NC} Stopped WebSocket Service (PID: $PID)"
    fi
    rm .pids/websocket.pid
fi

if [ -f .pids/api-gateway.pid ]; then
    PID=$(cat .pids/api-gateway.pid)
    if kill $PID 2>/dev/null; then
        echo -e "${GREEN}✓${NC} Stopped API Gateway (PID: $PID)"
    fi
    rm .pids/api-gateway.pid
fi

# Fallback: Kill by name
pkill -f "llm-router" 2>/dev/null && echo -e "${GREEN}✓${NC} Stopped remaining LLM Router processes"
pkill -f "websocket-service" 2>/dev/null && echo -e "${GREEN}✓${NC} Stopped remaining WebSocket processes"
pkill -f "go-api-gateway/main" 2>/dev/null && echo -e "${GREEN}✓${NC} Stopped remaining API Gateway processes"

echo ""
echo "All services stopped."
echo ""

# Optional: Stop Docker services
read -p "Stop Docker services (Tracing, Databases)? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    cd distributed-tracing
    docker-compose -f docker-compose-minimal.yml down
    cd ..
    echo -e "${GREEN}✓${NC} Docker services stopped"
fi

echo ""
echo "======================================="