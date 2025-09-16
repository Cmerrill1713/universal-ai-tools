#!/bin/bash

# Universal AI Tools - Quick Start Script
# This script provides the easiest way to get started

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Universal AI Tools - Quick Start${NC}"
echo "=================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker is not installed. Please install Docker first:${NC}"
    echo "   https://docs.docker.com/get-docker/"
    echo ""
    echo "Or run the installer: ./install.sh --docker"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker Compose is not installed. Please install Docker Compose first:${NC}"
    echo "   https://docs.docker.com/compose/install/"
    echo ""
    echo "Or run the installer: ./install.sh --docker"
    exit 1
fi

echo -e "${BLUE}📦 Starting Universal AI Tools...${NC}"
echo ""

# Start the services
echo "Starting services with Docker Compose..."
docker-compose up -d

echo ""
echo -e "${GREEN}✅ Services started successfully!${NC}"
echo ""

# Wait a moment for services to start
echo "Waiting for services to initialize..."
sleep 10

# Check service health
echo ""
echo "🔍 Checking service health..."

# Check assistant service
if curl -s http://localhost:8086/health > /dev/null; then
    echo -e "${GREEN}✅ Assistant Service: Running${NC}"
else
    echo -e "${YELLOW}⚠️  Assistant Service: Starting...${NC}"
fi

# Check LLM router
if curl -s http://localhost:3033/health > /dev/null; then
    echo -e "${GREEN}✅ LLM Router: Running${NC}"
else
    echo -e "${YELLOW}⚠️  LLM Router: Starting...${NC}"
fi

# Check librarian
if curl -s http://localhost:8082/health > /dev/null; then
    echo -e "${GREEN}✅ Intelligent Librarian: Running${NC}"
else
    echo -e "${YELLOW}⚠️  Intelligent Librarian: Starting...${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Universal AI Tools is now running!${NC}"
echo ""
echo "🌐 Access your services:"
echo "   • Assistant Dashboard: http://localhost:8086/dashboard"
echo "   • Health Check: http://localhost:8086/health"
echo "   • API Documentation: http://localhost:8086/help"
echo ""
echo "🔧 Management commands:"
echo "   • View logs: docker-compose logs -f"
echo "   • Stop services: docker-compose down"
echo "   • Restart services: docker-compose restart"
echo ""
echo "📚 For more information, see PACKAGING_GUIDE.md"
echo ""
echo -e "${BLUE}Happy AI chatting! 🤖✨${NC}"
