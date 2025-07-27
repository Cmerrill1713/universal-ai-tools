#!/bin/bash

# Universal AI Tools - One-Click Startup Script
# Starts all services and opens the interface

set -e

echo "🚀 Universal AI Tools - Starting System..."
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if a service is running
check_service() {
    local service_name=$1
    local port=$2
    local url=$3
    
    if curl -s "$url" >/dev/null 2>&1; then
        echo -e "✅ ${GREEN}$service_name${NC} is running on port $port"
        return 0
    else
        echo -e "❌ ${RED}$service_name${NC} is not running on port $port"
        return 1
    fi
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check dependencies
echo -e "${BLUE}Checking dependencies...${NC}"

# Check Node.js
if command_exists node; then
    NODE_VERSION=$(node --version)
    echo -e "✅ ${GREEN}Node.js${NC} $NODE_VERSION"
else
    echo -e "❌ ${RED}Node.js not found${NC}"
    exit 1
fi

# Check npm
if command_exists npm; then
    NPM_VERSION=$(npm --version)
    echo -e "✅ ${GREEN}npm${NC} $NPM_VERSION"
else
    echo -e "❌ ${RED}npm not found${NC}"
    exit 1
fi

# Check Ollama (optional but recommended)
if command_exists ollama; then
    echo -e "✅ ${GREEN}Ollama${NC} available"
    OLLAMA_AVAILABLE=true
else
    echo -e "⚠️ ${YELLOW}Ollama not found${NC} - AI agents will use fallback mode"
    OLLAMA_AVAILABLE=false
fi

# Check if Redis is running (optional)
if check_service "Redis" "6379" "redis://localhost:6379" 2>/dev/null; then
    REDIS_AVAILABLE=true
else
    echo -e "⚠️ ${YELLOW}Redis not running${NC} - caching will be limited"
    REDIS_AVAILABLE=false
fi

echo ""

# Check if services are already running
echo -e "${BLUE}Checking existing services...${NC}"

BACKEND_RUNNING=false
FRONTEND_RUNNING=false

if check_service "Backend" "9999" "http://localhost:9999/health" 2>/dev/null; then
    BACKEND_RUNNING=true
fi

if check_service "Frontend" "5173" "http://localhost:5173" 2>/dev/null; then
    FRONTEND_RUNNING=true
fi

echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}Installing backend dependencies...${NC}"
    npm install
fi

if [ ! -d "ui/node_modules" ]; then
    echo -e "${BLUE}Installing frontend dependencies...${NC}"
    cd ui && npm install && cd ..
fi

# Start Ollama if available and not running
if [ "$OLLAMA_AVAILABLE" = true ]; then
    if ! pgrep -x "ollama" >/dev/null; then
        echo -e "${BLUE}Starting Ollama...${NC}"
        ollama serve &
        sleep 2
    fi
fi

# Start backend if not running
if [ "$BACKEND_RUNNING" = false ]; then
    echo -e "${BLUE}Starting backend server...${NC}"
    npm run dev &
    BACKEND_PID=$!
    
    # Wait for backend to start
    echo "Waiting for backend to start..."
    for i in {1..30}; do
        if check_service "Backend" "9999" "http://localhost:9999/health" 2>/dev/null; then
            echo -e "✅ ${GREEN}Backend started successfully${NC}"
            break
        fi
        if [ $i -eq 30 ]; then
            echo -e "❌ ${RED}Backend failed to start${NC}"
            exit 1
        fi
        sleep 1
    done
else
    echo -e "✅ ${GREEN}Backend already running${NC}"
fi

# Start frontend if not running
if [ "$FRONTEND_RUNNING" = false ]; then
    echo -e "${BLUE}Starting frontend...${NC}"
    cd ui && npm run dev &
    FRONTEND_PID=$!
    cd ..
    
    # Wait for frontend to start
    echo "Waiting for frontend to start..."
    for i in {1..20}; do
        if check_service "Frontend" "5173" "http://localhost:5173" 2>/dev/null; then
            echo -e "✅ ${GREEN}Frontend started successfully${NC}"
            break
        fi
        if [ $i -eq 20 ]; then
            echo -e "❌ ${RED}Frontend failed to start${NC}"
            exit 1
        fi
        sleep 1
    done
else
    echo -e "✅ ${GREEN}Frontend already running${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Universal AI Tools is ready!${NC}"
echo "========================================"
echo -e "🌐 Frontend: ${BLUE}http://localhost:5173${NC}"
echo -e "🔧 Backend API: ${BLUE}http://localhost:9999${NC}"
echo -e "📊 Health Check: ${BLUE}http://localhost:9999/health${NC}"

if [ "$OLLAMA_AVAILABLE" = true ]; then
    echo -e "🧠 Ollama: ${GREEN}Available${NC}"
else
    echo -e "🧠 Ollama: ${YELLOW}Not available (using fallback mode)${NC}"
fi

if [ "$REDIS_AVAILABLE" = true ]; then
    echo -e "⚡ Redis: ${GREEN}Available${NC}"
else
    echo -e "⚡ Redis: ${YELLOW}Not available (limited caching)${NC}"
fi

echo ""
echo -e "${BLUE}Available agents:${NC}"
echo "- 🎯 Planner (strategic task planning)"
echo "- 🔍 Retriever (information gathering)"
echo "- 😈 Devils Advocate (risk assessment)"
echo "- 🔧 Synthesizer (information integration)"
echo "- 🪞 Reflector (self-assessment)"
echo "- 👤 User Intent (goal understanding)"
echo "- 🛠️ Tool Maker (code generation)"
echo "- 🛡️ Ethics (safety validation)"
echo "- 📊 Resource Manager (system optimization)"
echo "- 🎭 Orchestrator (multi-agent coordination)"
echo "- And 8 more specialized agents..."

echo ""
echo -e "${YELLOW}Opening browser...${NC}"

# Open browser (works on macOS, Linux, and Windows)
if command_exists open; then
    open http://localhost:5173
elif command_exists xdg-open; then
    xdg-open http://localhost:5173
elif command_exists start; then
    start http://localhost:5173
else
    echo "Please open http://localhost:5173 in your browser"
fi

echo ""
echo -e "${GREEN}System is running! Press Ctrl+C to stop all services.${NC}"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down services...${NC}"
    
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    
    # Kill any remaining processes
    pkill -f "npm run dev" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    
    echo -e "${GREEN}Services stopped. Goodbye!${NC}"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Keep script running
wait