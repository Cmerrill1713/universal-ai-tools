#!/bin/bash

echo "🌸 Launching Sweet Athena Complete System"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if service is running
check_service() {
    local service_name=$1
    local port=$2
    
    if lsof -i :$port > /dev/null 2>&1; then
        echo -e "${GREEN}✅ $service_name is running on port $port${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  $service_name is not running on port $port${NC}"
        return 1
    fi
}

# Step 1: Check prerequisites
echo -e "${BLUE}Step 1: Checking prerequisites...${NC}"
echo ""

# Check Node.js
if command -v node &> /dev/null; then
    echo -e "${GREEN}✅ Node.js installed: $(node --version)${NC}"
else
    echo -e "${YELLOW}❌ Node.js not found. Please install Node.js first.${NC}"
    exit 1
fi

echo ""

# Step 2: Check and start services
echo -e "${BLUE}Step 2: Checking services...${NC}"
echo ""

# Check backend
if ! check_service "Backend Server" 9999; then
    echo "Starting backend server..."
    cd ~/Desktop/universal-ai-tools
    npm run start:minimal > sweet-athena-backend.log 2>&1 &
    sleep 5
    check_service "Backend Server" 9999
fi

# Check signaling server
if ! check_service "Signaling Server" 8888; then
    echo "Starting signaling server..."
    cd ~/Desktop/universal-ai-tools
    node sweet-athena-signaling-server.mjs > signaling-server.log 2>&1 &
    sleep 3
    check_service "Signaling Server" 8888
fi

echo ""

# Step 3: Launch Sweet Athena UI
echo -e "${BLUE}Step 3: Launching Sweet Athena UI...${NC}"
echo ""

# Check if UI dev server is running
if ! check_service "React Dev Server" 5173; then
    echo "Starting React development server..."
    cd ~/Desktop/universal-ai-tools/ui
    npm run dev > ../ui-dev-server.log 2>&1 &
    echo "Waiting for UI to compile..."
    sleep 10
fi

echo ""

# Step 4: Open Sweet Athena in browser
echo -e "${BLUE}Step 4: Opening Sweet Athena...${NC}"
echo ""

# Determine the platform and open browser
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    open "http://localhost:5173/sweet-athena"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    xdg-open "http://localhost:5173/sweet-athena"
else
    echo "Please open http://localhost:5173/sweet-athena in your browser"
fi

echo ""
echo -e "${GREEN}🎉 Sweet Athena is launching!${NC}"
echo ""
echo "Services running:"
echo "  - Backend API: http://localhost:9999"
echo "  - Signaling Server: ws://localhost:8888"
echo "  - Sweet Athena UI: http://localhost:5173/sweet-athena"
echo ""
echo "Control Panel URLs:"
echo "  - Simple Viewer: file://$PWD/sweet-athena-viewer-8888.html"
echo "  - Control Panel: file://$PWD/sweet-athena-control-panel.html"
echo "  - Command Tester: file://$PWD/test-sweet-athena-commands.html"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "1. Open UE5 project: ~/UE5-SweetAthena/SweetAthenaUE5Project.uproject"
echo "2. Hit Play in UE5"
echo "3. The browser should automatically connect and show the stream"
echo ""
echo "To stop all services, run: pkill -f 'sweet-athena|signaling-server'"
echo ""

# Optional: Run integration tests
read -p "Run integration tests? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${BLUE}Running integration tests...${NC}"
    cd ~/Desktop/universal-ai-tools
    node test-sweet-athena-integration.js
fi

echo ""
echo "🌸 Sweet Athena setup complete!"