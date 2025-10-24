#!/bin/bash

# Minimal startup script focusing on core services only
# This avoids complex dependencies and potential conflicts

set -e

echo "🚀 Starting Universal AI Tools (Minimal Mode)"
echo "=============================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        return 0
    else
        return 1
    fi
}

echo -e "${YELLOW}Checking services...${NC}"

# Check if backend is already running
if check_port 9999; then
    echo -e "✅ ${GREEN}Backend${NC} already running on port 9999"
else
    echo -e "🚀 ${YELLOW}Starting backend...${NC}"
    # Start backend with minimal services
    NODE_ENV=development \
    ENABLE_MLX=false \
    ENABLE_VISION=false \
    npm run dev &
    
    # Wait for backend to start
    echo -n "Waiting for backend to start"
    for i in {1..30}; do
        if check_port 9999; then
            echo -e "\n✅ ${GREEN}Backend${NC} started on port 9999"
            break
        fi
        echo -n "."
        sleep 1
    done
    
    if ! check_port 9999; then
        echo -e "\n❌ ${RED}Backend failed to start${NC}"
        exit 1
    fi
fi

# Check if frontend is running
if check_port 5173; then
    echo -e "✅ ${GREEN}Frontend${NC} already running on port 5173"
elif check_port 3000; then
    echo -e "✅ ${GREEN}Frontend${NC} already running on port 3000"
else
    echo -e "⚠️ ${YELLOW}Frontend not running${NC}"
    echo -e "Please start frontend manually: ${GREEN}cd ui && npm run dev${NC}"
fi

echo -e "\n${GREEN}Services Status:${NC}"
echo -e "Backend API: http://localhost:9999"
echo -e "Health Check: http://localhost:9999/health"
echo -e "Frontend: http://localhost:5173 (or http://localhost:3000)"

echo -e "\n${YELLOW}Testing connection...${NC}"
if curl -s http://localhost:9999/health >/dev/null; then
    echo -e "✅ ${GREEN}Backend is responding${NC}"
else
    echo -e "❌ ${RED}Backend health check failed${NC}"
fi

echo -e "\n✨ ${GREEN}Ready to test!${NC}"