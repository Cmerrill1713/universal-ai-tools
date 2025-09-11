#!/bin/bash

# Sweet Athena Demo Launch Script
# Starts both frontend and backend for the Sweet Athena demo

echo "🌸 Starting Sweet Athena Demo..."
echo "======================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if a port is in use
port_in_use() {
    lsof -i:$1 >/dev/null 2>&1
}

# Check for required tools
echo -e "${BLUE}🔍 Checking system requirements...${NC}"

if ! command_exists node; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18+ first.${NC}"
    exit 1
fi

if ! command_exists npm; then
    echo -e "${RED}❌ npm is not installed. Please install npm first.${NC}"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js version 18+ is required. Current version: $(node --version)${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js $(node --version) - OK${NC}"
echo -e "${GREEN}✅ npm $(npm --version) - OK${NC}"

# Navigate to project root
cd "$(dirname "$0")/.."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ package.json not found. Make sure you're running this from the project root.${NC}"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ] || [ ! -d "ui/node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    
    # Install backend dependencies
    npm install
    
    # Install frontend dependencies
    cd ui
    npm install
    cd ..
    
    echo -e "${GREEN}✅ Dependencies installed${NC}"
fi

# Check for running processes on ports
if port_in_use 9999; then
    echo -e "${YELLOW}⚠️  Port 9999 is already in use. Backend might already be running.${NC}"
fi

if port_in_use 3000; then
    echo -e "${YELLOW}⚠️  Port 3000 is already in use. Frontend might already be running.${NC}"
fi

if port_in_use 5173; then
    echo -e "${YELLOW}⚠️  Port 5173 is already in use. Vite dev server might already be running.${NC}"
fi

# Create log directory
mkdir -p logs

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down services...${NC}"
    jobs -p | xargs -r kill
    exit 0
}

# Trap exit signals
trap cleanup SIGINT SIGTERM

echo -e "${PURPLE}🚀 Starting services...${NC}"

# Start backend in background
echo -e "${BLUE}🔧 Starting backend server (port 9999)...${NC}"
npm run dev:backend > logs/backend.log 2>&1 &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Check if backend started successfully
if ! port_in_use 9999; then
    echo -e "${RED}❌ Backend failed to start. Check logs/backend.log for details.${NC}"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

echo -e "${GREEN}✅ Backend server started (PID: $BACKEND_PID)${NC}"

# Start frontend in background
echo -e "${BLUE}🎨 Starting frontend (port 3000/5173)...${NC}"
cd ui
npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Wait for frontend to start
sleep 5

# Check if frontend started successfully
if ! port_in_use 3000 && ! port_in_use 5173; then
    echo -e "${RED}❌ Frontend failed to start. Check logs/frontend.log for details.${NC}"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 1
fi

echo -e "${GREEN}✅ Frontend started (PID: $FRONTEND_PID)${NC}"

# Display status
echo -e "\n${CYAN}🌟 Sweet Athena Demo is now running!${NC}"
echo -e "${CYAN}=======================================${NC}"
echo -e "${GREEN}🖥️  Frontend: ${NC}http://localhost:3000 or http://localhost:5173"
echo -e "${GREEN}🔧 Backend API: ${NC}http://localhost:9999"
echo -e "${GREEN}✨ Demo Page: ${NC}http://localhost:3000/sweet-athena (or :5173/sweet-athena)"
echo -e "\n${YELLOW}📋 Available endpoints:${NC}"
echo -e "   • Health check: http://localhost:9999/health"
echo -e "   • API status: http://localhost:9999/api/stats"
echo -e "\n${BLUE}📁 Logs are available in:${NC}"
echo -e "   • Backend: logs/backend.log"
echo -e "   • Frontend: logs/frontend.log"
echo -e "\n${PURPLE}🎭 Demo Features:${NC}"
echo -e "   • Interactive personality moods (Sweet, Shy, Confident, Caring, Playful)"
echo -e "   • Real-time chat interface"
echo -e "   • Animated avatar display"
echo -e "   • Message history and context"
echo -e "\n${CYAN}Press Ctrl+C to stop all services${NC}"

# Wait for services and monitor
while true; do
    # Check if processes are still running
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo -e "\n${RED}❌ Backend process died. Check logs/backend.log${NC}"
        break
    fi
    
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        echo -e "\n${RED}❌ Frontend process died. Check logs/frontend.log${NC}"
        break
    fi
    
    sleep 5
done

# Cleanup
cleanup