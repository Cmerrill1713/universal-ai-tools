#!/bin/bash

# =============================================================================
# ATHENA SWIFT APP LAUNCHER
# =============================================================================
# This script starts all Docker backend services and launches the Athena app
# =============================================================================

set -e

echo "🚀 Starting Athena Swift App with Docker Backend..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        return 0
    else
        return 1
    fi
}

# Stop any existing services
echo -e "${BLUE}🛑 Stopping existing services...${NC}"
docker-compose -f docker-compose.swift-backend.yml down 2>/dev/null || true

# Start Docker services
echo -e "${BLUE}🐳 Starting Docker backend services...${NC}"
docker-compose -f docker-compose.swift-backend.yml up -d

# Wait for services to be healthy
echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"
sleep 5

# Check backend health
echo -e "${BLUE}🔍 Checking service health...${NC}"

services=(
    "Backend API:8013:/health"
    "MLX TTS:8877:/health"
    "PostgreSQL:5432"
    "Redis:6379"
    "Netdata:19999:/api/v1/info"
)

all_healthy=true
for service_info in "${services[@]}"; do
    IFS=':' read -r name port endpoint <<< "$service_info"
    
    if check_port "$port"; then
        echo -e "  ${GREEN}✓${NC} $name (port $port)"
        
        # Try HTTP health check if endpoint provided
        if [ -n "$endpoint" ]; then
            if curl -sf "http://localhost:$port$endpoint" > /dev/null 2>&1; then
                echo -e "    ${GREEN}✓${NC} Health check passed"
            else
                echo -e "    ${YELLOW}⚠${NC} Port open but health check pending..."
            fi
        fi
    else
        echo -e "  ${YELLOW}⚠${NC} $name not ready yet (port $port)"
        all_healthy=false
    fi
done

if [ "$all_healthy" = true ]; then
    echo -e "\n${GREEN}✅ All services ready!${NC}"
else
    echo -e "\n${YELLOW}⚠ Some services still starting... They may need a moment.${NC}"
fi

# Show service URLs
echo -e "\n${BLUE}📡 Service Endpoints:${NC}"
echo "  • Backend API:  http://localhost:8013"
echo "  • TTS Service:  http://localhost:8877"
echo "  • Netdata:      http://localhost:19999"
echo "  • Grafana:      http://localhost:3002"
echo "  • Prometheus:   http://localhost:9090"

# Build and launch Swift app
echo -e "\n${BLUE}🔨 Building Athena Swift App...${NC}"
cd NeuroForgeApp

# Check if build directory exists
if [ ! -d ".build" ]; then
    echo -e "${YELLOW}First time build - this may take a moment...${NC}"
fi

# Build the app
swift build -c release

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build successful!${NC}"
    
    # Create app bundle if it doesn't exist
    APP_DIR=".build/release/NeuroForgeApp.app"
    if [ ! -d "$APP_DIR" ]; then
        echo -e "${BLUE}📦 Creating app bundle...${NC}"
        mkdir -p "$APP_DIR/Contents/MacOS"
        mkdir -p "$APP_DIR/Contents/Resources"
        cp .build/release/NeuroForgeApp "$APP_DIR/Contents/MacOS/"
        cp Info.plist "$APP_DIR/Contents/"
        if [ -f "AppIcon.icns" ]; then
            cp AppIcon.icns "$APP_DIR/Contents/Resources/"
        fi
    fi
    
    # Launch the app
    echo -e "\n${GREEN}🚀 Launching Athena...${NC}\n"
    open "$APP_DIR"
    
    echo -e "${GREEN}✅ Athena is now running!${NC}"
    echo -e "\n${BLUE}💡 Tips:${NC}"
    echo "  • Press Enter to send messages"
    echo "  • Backend logs: docker-compose -f docker-compose.swift-backend.yml logs -f"
    echo "  • Stop services: docker-compose -f docker-compose.swift-backend.yml down"
    echo "  • Monitor: http://localhost:19999"
    
else
    echo -e "${YELLOW}❌ Build failed. Check errors above.${NC}"
    exit 1
fi

