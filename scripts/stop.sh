#!/bin/bash

# Universal AI Tools - Stop Script
# Gracefully stops all services

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🛑 Stopping Universal AI Tools...${NC}"
echo "===================================="

# Function to stop process gracefully
stop_process() {
    local process_name=$1
    local signal=${2:-TERM}
    
    if pkill -$signal -f "$process_name" 2>/dev/null; then
        echo -e "✅ Stopped ${GREEN}$process_name${NC}"
        return 0
    else
        echo -e "ℹ️ ${BLUE}$process_name${NC} was not running"
        return 1
    fi
}

# Stop frontend (Vite dev server)
stop_process "vite"

# Stop backend (tsx watch)
stop_process "npm run dev"
stop_process "tsx watch"

# Stop any Node.js processes that might be hanging
stop_process "node.*server" 

# Give processes time to shut down gracefully
sleep 2

# Force kill any remaining processes if needed
echo ""
echo -e "${BLUE}Cleaning up any remaining processes...${NC}"

# More aggressive cleanup if needed
pkill -f "localhost:3001" 2>/dev/null && echo -e "✅ Killed remaining backend processes"
pkill -f "localhost:5173" 2>/dev/null && echo -e "✅ Killed remaining frontend processes"

# Check if ports are now free
if ! curl -s "http://localhost:3001/api/health" >/dev/null 2>&1; then
    echo -e "✅ Port 3001 is now free"
else
    echo -e "⚠️ ${YELLOW}Port 3001 still in use${NC}"
fi

if ! curl -s "http://localhost:5173" >/dev/null 2>&1; then
    echo -e "✅ Port 5173 is now free"
else
    echo -e "⚠️ ${YELLOW}Port 5173 still in use${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Universal AI Tools stopped successfully!${NC}"
echo ""
echo -e "${BLUE}Quick actions:${NC}"
echo "- Start again: ./start.sh"
echo "- Check status: ./status.sh"
echo "- View logs: npm run logs"