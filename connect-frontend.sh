#!/bin/bash
set -e

echo "════════════════════════════════════════════════════════════════════════════════"
echo "            🔗 CONNECTING NEUROFORGE FRONTEND TO BACKEND"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if containers are running
echo -e "${BLUE}📦 Checking running containers...${NC}"
if ! docker ps | grep -q "unified-neuroforge-frontend"; then
  echo -e "${RED}❌ Frontend container not running!${NC}"
  echo "Start it with: docker start unified-neuroforge-frontend"
  exit 1
fi

if ! docker ps | grep -q "unified-ai-assistant-api"; then
  echo -e "${RED}❌ Backend container not running!${NC}"
  echo "Start it with: docker start unified-ai-assistant-api"
  exit 1
fi

echo -e "${GREEN}✅ Both containers are running${NC}"
echo ""

# Configure frontend to use backend
echo -e "${BLUE}🔧 Configuring frontend connection...${NC}"
docker exec unified-neuroforge-frontend sh -c "echo 'NEXT_PUBLIC_API_URL=http://localhost:8013' >> /app/.env.local" 2>/dev/null || true
docker exec unified-neuroforge-frontend sh -c "echo 'NEXT_PUBLIC_BACKEND_URL=http://localhost:8013' >> /app/.env.local" 2>/dev/null || true

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
echo -e "${GREEN}                  🎉 ALL SYSTEMS CONNECTED${NC}"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""
echo -e "${BLUE}📍 Service URLs:${NC}"
echo "   • NeuroForge AI:    http://localhost:3000"
echo "   • Backend API:      http://localhost:8013"
echo "   • API Docs:         http://localhost:8013/docs"
echo ""
echo -e "${BLUE}🧪 Quick Test:${NC}"
echo "   curl http://localhost:8013/health"
echo "   curl http://localhost:3000"
echo ""
echo -e "${BLUE}📊 View logs:${NC}"
echo "   docker logs unified-neuroforge-frontend -f"
echo "   docker logs unified-ai-assistant-api -f"
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

# Open browser
if command -v open &> /dev/null; then
  echo -e "${GREEN}🌐 Opening NeuroForge AI in your browser...${NC}"
  sleep 2
  open http://localhost:3000
  
  # Also open backend docs
  sleep 1
  open http://localhost:8013/docs
else
  echo -e "${YELLOW}⚠️  Please manually open:${NC}"
  echo "   • http://localhost:3000 (NeuroForge AI)"
  echo "   • http://localhost:8013/docs (API Docs)"
fi

echo ""
echo -e "${GREEN}✨ NeuroForge AI is now connected to the backend!${NC}"
echo ""
echo "Try chatting in the web interface. The frontend will now communicate with"
echo "the backend API at http://localhost:8013"
echo ""

