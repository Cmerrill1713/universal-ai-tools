#!/bin/bash

# Universal AI Tools - Status Check Script
# Quick check of system status

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🔍 Universal AI Tools - System Status"
echo "===================================="

# Function to check if a service is running
check_service() {
    local service_name=$1
    local port=$2
    local url=$3
    
    if curl -s "$url" >/dev/null 2>&1; then
        echo -e "✅ ${GREEN}$service_name${NC} - Running on port $port"
        return 0
    else
        echo -e "❌ ${RED}$service_name${NC} - Not running on port $port"
        return 1
    fi
}

# Check core services
BACKEND_OK=false
FRONTEND_OK=false

if check_service "Chat API" "8014" "http://localhost:8014/health"; then
    BACKEND_OK=true
fi

if check_service "Grafana" "3001" "http://localhost:3001/login"; then
    FRONTEND_OK=true
fi

# Check optional services
echo ""
echo -e "${BLUE}Optional Services:${NC}"

if command -v redis-cli >/dev/null 2>&1; then
    if redis-cli -h 127.0.0.1 -p 6379 ping >/dev/null 2>&1; then
        echo -e "⚡ Caching enabled (Redis responding)"
    else
        echo -e "⚠️ ${YELLOW}Redis not responding on 6379${NC}"
    fi
else
    echo -e "ℹ️  redis-cli not found; skipping Redis check"
fi

if command -v ollama >/dev/null 2>&1 && pgrep -x "ollama" >/dev/null; then
    echo -e "✅ ${GREEN}Ollama AI Service${NC} - Running"
    echo -e "🧠 Full AI capabilities enabled"
else
    echo -e "⚠️ ${YELLOW}Ollama not running - using fallback mode${NC}"
fi

echo ""

# Overall status
if [ "$BACKEND_OK" = true ] && [ "$FRONTEND_OK" = true ]; then
    echo -e "${GREEN}🎉 System Status: HEALTHY${NC}"
    echo -e "🌐 Monitoring dashboard: ${BLUE}http://localhost:3001${NC}"
    echo -e "🤖 Chat API: ${BLUE}http://localhost:8014${NC}"
    echo ""
    echo -e "${BLUE}Quick Actions:${NC}"
    echo "- Chat with agents: http://localhost:5173/chat"
    echo "- System dashboard: http://localhost:5173/dashboard"
    echo "- Agent management: http://localhost:5173/agents"
elif [ "$BACKEND_OK" = true ]; then
    echo -e "${YELLOW}⚠️ System Status: PARTIAL${NC}"
    echo -e "Backend running, but monitoring/UI needs to be started"
    echo "Start Grafana or your chosen UI stack"
elif [ "$FRONTEND_OK" = true ]; then
    echo -e "${YELLOW}⚠️ System Status: PARTIAL${NC}"
    echo -e "Monitoring/UI running, but Chat API backend needs to be up"
    echo "Ensure container exposing :8014 is healthy"
else
    echo -e "${RED}❌ System Status: DOWN${NC}"
    echo -e "Both services are stopped"
    echo "Run: ./start.sh to start everything"
fi

echo ""
echo -e "${BLUE}Need help?${NC}"
echo "- Start everything: ./start.sh"
echo "- Check logs: npm run logs"
echo "- Stop all: pkill -f 'npm run dev'"
