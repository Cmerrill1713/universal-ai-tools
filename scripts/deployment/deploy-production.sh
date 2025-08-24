#!/bin/bash

# Universal AI Tools - Production Deployment Script
# This script builds and deploys the Universal AI Tools service in production mode

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Universal AI Tools - Production Deployment${NC}"
echo "=============================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi

# Check if required environment files exist
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating from .env.example...${NC}"
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${YELLOW}📝 Please edit .env file with your configuration before deploying.${NC}"
        exit 1
    else
        echo -e "${RED}❌ .env.example not found. Please create .env file with required configuration.${NC}"
        exit 1
    fi
fi

# Stop any existing containers
echo -e "${YELLOW}🛑 Stopping existing containers...${NC}"
docker-compose down --remove-orphans

# Pull latest images
echo -e "${BLUE}📥 Pulling latest base images...${NC}"
docker-compose pull redis ollama searxng

# Build the application
echo -e "${BLUE}🔨 Building Universal AI Tools application...${NC}"
docker-compose build --no-cache universal-ai-tools

# Build the dashboard
echo -e "${BLUE}🔨 Building dashboard...${NC}"
docker-compose build --no-cache dashboard

# Start services
echo -e "${GREEN}🚀 Starting production services...${NC}"
docker-compose up -d

# Wait for services to be ready
echo -e "${YELLOW}⏳ Waiting for services to start...${NC}"
sleep 10

# Health check
echo -e "${BLUE}🔍 Performing health checks...${NC}"

# Check main service
RETRIES=30
while [ $RETRIES -gt 0 ]; do
    if curl -f http://localhost:9999/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Universal AI Tools service is healthy${NC}"
        break
    fi
    echo -e "${YELLOW}⏳ Waiting for Universal AI Tools service... ($RETRIES retries left)${NC}"
    sleep 2
    RETRIES=$((RETRIES-1))
done

if [ $RETRIES -eq 0 ]; then
    echo -e "${RED}❌ Universal AI Tools service failed to start${NC}"
    docker-compose logs universal-ai-tools
    exit 1
fi

# Check Redis
if curl -f http://localhost:6379 > /dev/null 2>&1 || docker-compose exec redis redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Redis is healthy${NC}"
else
    echo -e "${YELLOW}⚠️  Redis may not be responding${NC}"
fi

# Check Ollama
if curl -f http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Ollama is healthy${NC}"
else
    echo -e "${YELLOW}⚠️  Ollama may not be responding${NC}"
fi

# Show deployment status
echo ""
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo "================================"
echo ""
echo -e "${BLUE}📊 Service URLs:${NC}"
echo "  • Main API:       http://localhost:9999"
echo "  • Health Check:   http://localhost:9999/api/health"
echo "  • Metrics:        http://localhost:9999/metrics"
echo "  • Dashboard:      http://localhost:3000"
echo "  • Documentation:  http://localhost:9999/api/docs"
echo ""
echo -e "${BLUE}🔧 Management Commands:${NC}"
echo "  • View logs:      docker-compose logs -f"
echo "  • Stop services:  docker-compose down"
echo "  • Restart:        docker-compose restart"
echo "  • Status:         docker-compose ps"
echo ""
echo -e "${BLUE}📈 Monitoring:${NC}"
echo "  • Prometheus:     http://localhost:9090"
echo "  • Grafana:        http://localhost:3001"
echo ""

# Show running containers
echo -e "${BLUE}📦 Running Containers:${NC}"
docker-compose ps

echo ""
echo -e "${GREEN}✅ Universal AI Tools is now running in production mode!${NC}"
echo -e "${BLUE}📚 For more information, check the README.md file${NC}"