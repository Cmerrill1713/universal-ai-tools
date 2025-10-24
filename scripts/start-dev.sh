#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "🔥 Starting Universal AI Tools (Hot Reload Development Mode)"
echo "============================================================="

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        return 0
    else
        return 1
    fi
}

# Kill any existing processes on our ports for clean start
echo -e "${YELLOW}🧹 Cleaning up existing processes...${NC}"
lsof -ti:9999 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
lsof -ti:5174 | xargs kill -9 2>/dev/null || true
sleep 2

# Function to open a new terminal tab and run a command (macOS)
open_new_tab() {
    local cmd=$1
    local title=$2
    
    osascript -e "
    tell application \"Terminal\"
        activate
        tell application \"System Events\" to keystroke \"t\" using command down
        delay 0.5
        do script \"cd $(pwd) && echo '🔥 $title' && $cmd\" in front window
    end tell
    "
}

# Check if we're on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo -e "${BLUE}🚀 Starting services with hot reload in new Terminal tabs...${NC}"
    
    # Start backend with hot reload and optimized settings
    echo -e "\n${GREEN}1. Starting Backend Server (Hot Reload)...${NC}"
    open_new_tab "NODE_ENV=development ENABLE_MLX=false ENABLE_VISION=false DISABLE_AUTH=true npm run dev" "Backend Hot Reload"
    
    # Wait for backend to start
    echo -e "\n${YELLOW}⏳ Waiting for backend to start...${NC}"
    for i in {1..20}; do
        if check_port 9999; then
            echo -e "✅ ${GREEN}Backend ready${NC} on http://localhost:9999"
            break
        fi
        echo -n "."
        sleep 1
    done
    
    if ! check_port 9999; then
        echo -e "\n❌ ${RED}Backend failed to start${NC}"
        exit 1
    fi
    
    # Start frontend with hot reload
    echo -e "\n${GREEN}2. Starting Frontend Dev Server (Hot Reload)...${NC}"
    open_new_tab "cd ui && VITE_API_URL=http://localhost:9999 VITE_HMR=true npm run dev" "Frontend Hot Reload"
    
    # Wait for frontend
    echo -e "\n${YELLOW}⏳ Waiting for frontend to start...${NC}"
    for i in {1..15}; do
        if check_port 5173 || check_port 5174; then
            FRONTEND_PORT=$(check_port 5173 && echo "5173" || echo "5174")
            echo -e "✅ ${GREEN}Frontend ready${NC} on http://localhost:${FRONTEND_PORT}"
            break
        fi
        echo -n "."
        sleep 1
    done
    
    echo -e "\n${GREEN}🔥 Hot Reload Development Environment Ready!${NC}"
    echo -e "==========================================="
    echo -e "Frontend: ${BLUE}http://localhost:${FRONTEND_PORT:-5173}${NC}"
    echo -e "Backend:  ${BLUE}http://localhost:9999${NC}"
    echo -e "Health:   ${BLUE}http://localhost:9999/health${NC}"
    echo ""
    echo -e "${YELLOW}⚡ Both services will auto-reload on file changes${NC}"
    echo -e "${YELLOW}🔍 Watch the terminal tabs for real-time updates${NC}"
    echo -e "${YELLOW}🛠️  Use VS Code or your preferred editor for instant feedback${NC}"
    
    # Test backend connection
    echo -e "\n${BLUE}🔍 Testing backend connection...${NC}"
    if curl -s http://localhost:9999/health >/dev/null; then
        echo -e "✅ ${GREEN}Backend health check passed${NC}"
    else
        echo -e "⚠️ ${YELLOW}Backend health check failed (may still be starting)${NC}"
    fi
    
    echo -e "\n${GREEN}🎯 Ready for rapid development!${NC}"
    
else
    # For other systems, provide optimized commands
    echo -e "${YELLOW}🔥 Run these commands in separate terminals for hot reload:${NC}"
    echo -e "\n${GREEN}Terminal 1 - Backend (Hot Reload):${NC}"
    echo "  NODE_ENV=development ENABLE_MLX=false ENABLE_VISION=false npm run dev"
    echo -e "\n${GREEN}Terminal 2 - Frontend (Hot Reload):${NC}"
    echo "  cd ui && VITE_API_URL=http://localhost:9999 VITE_HMR=true npm run dev"
    echo -e "\n${BLUE}💡 This setup provides instant feedback on code changes${NC}"
fi

echo -e "\n===================================================="