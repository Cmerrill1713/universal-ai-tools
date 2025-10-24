#!/bin/bash

echo "🚀 Starting Universal AI Tools - Complete MCP Setup"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check service
check_service() {
    local name=$1
    local url=$2
    local port=$3

    if curl -s --max-time 3 "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ $name (port $port) - Running${NC}" >&2
        return 0
    else
        echo -e "${RED}❌ $name (port $port) - Not running${NC}" >&2
        return 1
    fi
}

# Check all backend services
echo -e "${BLUE}🔍 Checking backend services...${NC}"
check_service "LLM Router" "http://127.0.0.1:3033/health" "3033"
llm_router_ok=$?
check_service "HRM Service" "http://127.0.0.1:8002/health" "8002"
hrm_mlx_ok=$?
check_service "FastVLM Service" "http://127.0.0.1:8003/health" "8003"
fastvlm_ok=$?

echo ""

# Check if services need to be started
if [ "$llm_router_ok" -ne 0 ] || [ "$hrm_mlx_ok" -ne 0 ] || [ "$fastvlm_ok" -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Some services are not running. Here are the commands to start them:${NC}"
    echo ""

    if [ "$llm_router_ok" -ne 0 ]; then
        echo -e "${BLUE}LLM Router:${NC}"
        echo "  cargo run -p llm-router &"
        echo ""
    fi

    if [ "$hrm_mlx_ok" -ne 0 ]; then
        echo -e "${BLUE}HRM Service:${NC}"
        echo "  ./start-hrm-service.sh &"
        echo ""
    fi

    if [ "$fastvlm_ok" -ne 0 ]; then
        echo -e "${BLUE}FastVLM Service:${NC}"
        echo "  cd python-services/mlx-fastvlm-service && MLX_PORT=8003 python server.py &"
        echo ""
    fi

    echo -e "${YELLOW}Start these services in separate terminals, then run this script again.${NC}"
    echo ""
fi

# Check if all services are running
if [ "$llm_router_ok" -eq 0 ] && [ "$hrm_mlx_ok" -eq 0 ] && [ "$fastvlm_ok" -eq 0 ]; then
    echo -e "${GREEN}🎉 All backend services are running!${NC}"
    echo ""

    # Show available MCP tools
    echo -e "${BLUE}🛠️  Available MCP Tools:${NC}"
    echo ""
    echo -e "${GREEN}Official Playwright MCP:${NC}"
    echo "  • browser_navigate - Navigate to web pages"
    echo "  • browser_click - Click elements on web pages"
    echo "  • browser_type - Type text into input fields"
    echo "  • browser_snapshot - Take accessibility snapshots"
    echo "  • browser_screenshot - Take screenshots"
    echo "  • browser_tabs - Manage browser tabs"
    echo ""
    echo -e "${GREEN}Custom Universal AI Tools MCP:${NC}"
    echo "  • test_llm_router - Test LLM Router endpoints"
    echo "  • test_hrm_mlx - Test HRM service"
    echo "  • test_fastvlm - Test FastVLM service"
    echo "  • run_playwright_test - Run automated tests"
    echo ""

    # Show test commands
    echo -e "${BLUE}🧪 Test Commands:${NC}"
    echo ""
    echo -e "${YELLOW}Run all tests:${NC}"
    echo "  npx playwright test"
    echo ""
    echo -e "${YELLOW}Run specific tests:${NC}"
    echo "  npx playwright test tests/backend-services.spec.ts"
    echo "  npx playwright test tests/frontend-integration.spec.ts"
    echo "  npx playwright test tests/playwright-mcp-integration.spec.ts"
    echo ""
    echo -e "${YELLOW}Run with UI:${NC}"
    echo "  npx playwright test --ui"
    echo ""
    echo -e "${YELLOW}Run with browser visible:${NC}"
    echo "  npx playwright test --headed"
    echo ""

    # Show MCP server options
    echo -e "${BLUE}🎯 MCP Server Options:${NC}"
    echo ""
    echo -e "${YELLOW}1. Official Playwright MCP (recommended):${NC}"
    echo "  npx @playwright/mcp"
    echo ""
    echo -e "${YELLOW}2. Custom Universal AI Tools MCP:${NC}"
    echo "  node mcp-server.js"
    echo ""
    echo -e "${YELLOW}3. Both servers (use different terminals):${NC}"
    echo "  Terminal 1: npx @playwright/mcp"
    echo "  Terminal 2: node mcp-server.js"
    echo ""

    # Ask user what they want to do
    echo -e "${BLUE}What would you like to do?${NC}"
    echo "1) Start Official Playwright MCP Server"
    echo "2) Start Custom Universal AI Tools MCP Server"
    echo "3) Run Playwright Tests"
    echo "4) Run Tests with UI"
    echo "5) Exit"
    echo ""
    read -p "Enter your choice (1-5): " choice

    case $choice in
        1)
            echo -e "${GREEN}🚀 Starting Official Playwright MCP Server...${NC}"
            npx @playwright/mcp
            ;;
        2)
            echo -e "${GREEN}🚀 Starting Custom Universal AI Tools MCP Server...${NC}"
            node mcp-server.js
            ;;
        3)
            echo -e "${GREEN}🧪 Running Playwright Tests...${NC}"
            npx playwright test
            ;;
        4)
            echo -e "${GREEN}🧪 Running Playwright Tests with UI...${NC}"
            npx playwright test --ui
            ;;
        5)
            echo -e "${GREEN}👋 Goodbye!${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Invalid choice. Exiting.${NC}"
            exit 1
            ;;
    esac
else
    echo -e "${RED}❌ Cannot proceed without all backend services running.${NC}"
    exit 1
fi
