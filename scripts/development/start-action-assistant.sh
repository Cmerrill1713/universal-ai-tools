#!/bin/bash

echo "🚀 Starting Universal AI Tools - Action Assistant"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if action server is already running
if lsof -i:3004 > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Action server already running on port 3004${NC}"
else
    echo "Starting action assistant server..."
    node action-assistant-server.cjs &
    ACTION_PID=$!
    sleep 2
    
    if lsof -i:3004 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Action server started (PID: $ACTION_PID)${NC}"
    else
        echo -e "${RED}❌ Failed to start action server${NC}"
        exit 1
    fi
fi

# Check for AI models
echo ""
echo "Checking for AI models..."

if curl -s http://localhost:1234/v1/models > /dev/null 2>&1; then
    echo -e "${GREEN}✅ LM Studio detected${NC}"
fi

if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Ollama detected${NC}"
fi

if curl -s http://localhost:8092/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Go API Gateway detected${NC}"
fi

# Open the action assistant
echo ""
echo "Opening Action Assistant in browser..."
open action-assistant.html

echo ""
echo -e "${GREEN}🎉 Action Assistant is ready!${NC}"
echo ""
echo "Features:"
echo "  🔧 Execute shell commands"
echo "  📝 Read and write files"
echo "  🐛 Fix code issues automatically"
echo "  🧪 Run tests and install dependencies"
echo "  🔍 Search through project files"
echo ""
echo "Just tell it what you want to fix or do!"
echo ""
echo "Press Ctrl+C to stop the server when done."
echo ""

# Wait for interrupt
wait