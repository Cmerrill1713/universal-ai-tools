#!/bin/bash

echo "🛑 Stopping Universal AI Tools Services"
echo "======================================="

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Stop Go/Rust services by PID
echo -e "${BLUE}🛑 Stopping Go/Rust services...${NC}"
for pidfile in pids/*.pid; do
    if [ -f "$pidfile" ]; then
        pid=$(cat "$pidfile")
        service_name=$(basename "$pidfile" .pid)
        if kill $pid 2>/dev/null; then
            echo -e "${GREEN}✅ Stopped $service_name (PID: $pid)${NC}"
        else
            echo -e "${RED}❌ Failed to stop $service_name${NC}"
        fi
        rm "$pidfile"
    fi
done

# Stop Docker containers
echo -e "${BLUE}🛑 Stopping Docker containers...${NC}"
docker stop redis-simple postgres-simple weaviate-simple 2>/dev/null || true
docker rm redis-simple postgres-simple weaviate-simple 2>/dev/null || true

echo -e "${GREEN}🎉 All services stopped!${NC}"
