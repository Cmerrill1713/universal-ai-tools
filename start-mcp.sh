#!/bin/bash

echo "🚀 Starting Universal AI Tools MCP Server"
echo "=========================================="

# Check if services are running
echo "Checking backend services..."

# Check LLM Router
if curl -s http://127.0.0.1:3033/health > /dev/null; then
    echo "✅ LLM Router (port 3033) - Running"
else
    echo "❌ LLM Router (port 3033) - Not running"
    echo "   Start with: cargo run -p llm-router &"
fi

# Check HRM service
if curl -s http://127.0.0.1:8002/health > /dev/null; then
    echo "✅ HRM Service (port 8002) - Running"
else
    echo "❌ HRM Service (port 8002) - Not running"
    echo "   Start with: ./start-hrm-service.sh &"
fi

# Check FastVLM
if curl -s http://127.0.0.1:8003/health > /dev/null; then
    echo "✅ FastVLM Service (port 8003) - Running"
else
    echo "❌ FastVLM Service (port 8003) - Not running"
    echo "   Start with: cd python-services/mlx-fastvlm-service && MLX_PORT=8003 python server.py &"
fi

echo ""
echo "🔧 Available MCP Tools:"
echo "  - test_llm_router: Test LLM Router endpoints"
echo "  - test_hrm_mlx: Test HRM service"
echo "  - test_fastvlm: Test FastVLM service"
echo "  - run_playwright_test: Run Playwright tests"
echo ""

# Start the MCP server
echo "🎯 Starting MCP Server..."
node mcp-server.js
