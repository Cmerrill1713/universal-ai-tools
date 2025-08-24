#!/bin/bash

# Stop backend services started for Swift app

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🛑 Stopping Universal AI Tools Backend Services..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# PID file location
PID_FILE="$PROJECT_ROOT/.backend-services.pid"

# Function to stop a service by PID
stop_service() {
    local name=$1
    local pid=$2
    
    if kill -0 $pid 2>/dev/null; then
        echo -e "${YELLOW}Stopping $name (PID: $pid)...${NC}"
        kill $pid 2>/dev/null || true
        sleep 1
        
        # Force kill if still running
        if kill -0 $pid 2>/dev/null; then
            kill -9 $pid 2>/dev/null || true
        fi
        
        echo -e "${GREEN}✓ $name stopped${NC}"
    else
        echo -e "${YELLOW}$name not running (PID: $pid)${NC}"
    fi
}

# Stop services from PID file
if [[ -f "$PID_FILE" ]]; then
    while IFS=':' read -r service pid; do
        if [[ -n "$service" && -n "$pid" ]]; then
            stop_service "$service" "$pid"
        fi
    done < "$PID_FILE"
    
    # Clear PID file
    > "$PID_FILE"
else
    echo -e "${YELLOW}No PID file found, checking for running services...${NC}"
fi

# Also check for services running on known ports
echo ""
echo "Checking for services on known ports..."

# Check and kill services on specific ports
for port in 8082 8083 8003; do
    if pid=$(lsof -ti:$port); then
        echo -e "${YELLOW}Found service on port $port (PID: $pid), stopping...${NC}"
        kill $pid 2>/dev/null || true
        sleep 1
        if kill -0 $pid 2>/dev/null; then
            kill -9 $pid 2>/dev/null || true
        fi
        echo -e "${GREEN}✓ Service on port $port stopped${NC}"
    else
        echo -e "${GREEN}✓ No service running on port $port${NC}"
    fi
done

# Optional: Stop Supabase
if lsof -ti:54321 >/dev/null 2>&1; then
    echo -e "${YELLOW}Stopping Supabase...${NC}"
    cd "$PROJECT_ROOT"
    supabase stop 2>/dev/null || true
    echo -e "${GREEN}✓ Supabase stopped${NC}"
fi

echo ""
echo -e "${GREEN}✅ All backend services stopped!${NC}"