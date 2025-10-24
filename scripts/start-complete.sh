#!/bin/bash
set -e

echo "════════════════════════════════════════════════════════════════════════════════"
echo "          🚀 UNIVERSAL AI TOOLS - NEUROFORGE AI COMPLETE SYSTEM"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Change to script directory
cd "$(dirname "$0")"

echo -e "${BLUE}📦 Starting Docker containers...${NC}"
docker-compose -f docker-compose.complete.yml up -d --build

echo ""
echo -e "${YELLOW}⏳ Waiting for services to be healthy...${NC}"
sleep 10

# Wait for backend
echo -e "${BLUE}🔍 Checking backend health...${NC}"
for i in {1..30}; do
  if curl -sf http://localhost:8013/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend API is ready on http://localhost:8013${NC}"
    break
  fi
  echo "   Attempt $i/30 - waiting for backend..."
  sleep 2
done

# Wait for frontend
echo -e "${BLUE}🔍 Checking frontend health...${NC}"
for i in {1..30}; do
  if curl -sf http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ NeuroForge Frontend is ready on http://localhost:3000${NC}"
    break
  fi
  echo "   Attempt $i/30 - waiting for frontend..."
  sleep 2
done

echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo -e "${GREEN}                  🎉 ALL SYSTEMS OPERATIONAL${NC}"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""
echo -e "${BLUE}📍 Service URLs:${NC}"
echo "   • NeuroForge AI:    http://localhost:3000"
echo "   • Backend API:      http://localhost:8013"
echo "   • API Docs:         http://localhost:8013/docs"
echo "   • PostgreSQL:       localhost:5432"
echo "   • Redis:            localhost:6379"
echo "   • Ollama:           http://localhost:11434"
echo ""
echo -e "${BLUE}📊 Quick Health Check:${NC}"
echo "   make green BASE=http://localhost:8013"
echo ""
echo -e "${BLUE}🛑 To stop all services:${NC}"
echo "   docker-compose -f docker-compose.complete.yml down"
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

# Open browser (works on macOS)
if command -v open &> /dev/null; then
  echo -e "${GREEN}🌐 Opening NeuroForge AI in your browser...${NC}"
  sleep 2
  open http://localhost:3000
else
  echo -e "${YELLOW}⚠️  Please manually open: http://localhost:3000${NC}"
fi

echo ""
echo -e "${GREEN}✨ NeuroForge AI is now running!${NC}"
echo ""
echo "Press Ctrl+C to stop monitoring (containers will keep running)"
echo ""

# Follow logs from both frontend and backend
docker-compose -f docker-compose.complete.yml logs -f neuroforge-frontend unified-backend

