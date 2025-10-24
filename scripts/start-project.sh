#!/bin/bash

# Universal AI Tools - Project Startup Script
# Quick access to your local project

echo "🚀 Starting Universal AI Tools Project..."
echo ""

# Check if services are already running
echo "📊 Checking service status..."

# Check Librarian Service
if curl -s http://localhost:8032/health > /dev/null 2>&1; then
    echo "   ✅ Librarian Service: Running (Port 8032)"
else
    echo "   ❌ Librarian Service: Not running"
    echo "   🔧 Starting Librarian Service..."
    python3 src/services/librarian-service/librarian_service.py &
    sleep 3
fi

# Check GitHub MCP Server
if pgrep -f "github-mcp-server.ts" > /dev/null; then
    echo "   ✅ GitHub MCP Server: Running"
else
    echo "   ❌ GitHub MCP Server: Not running"
    echo "   🔧 Starting GitHub MCP Server..."
    LIBRARIAN_URL="http://localhost:8032" tsx src/mcp/github-mcp-server.ts &
    sleep 2
fi

# Check Agency Swarm Local MCP Server
if pgrep -f "agency-swarm-local-mcp-server.ts" > /dev/null; then
    echo "   ✅ Agency Swarm Local MCP Server: Running"
else
    echo "   ❌ Agency Swarm Local MCP Server: Not running"
    echo "   🔧 Starting Agency Swarm Local MCP Server..."
    LIBRARIAN_URL="http://localhost:8032" tsx src/mcp/agency-swarm-local-mcp-server.ts &
    sleep 2
fi

echo ""
echo "🎯 Project Access Points:"
echo ""
echo "📚 Librarian Service:"
echo "   • Health Check: curl http://localhost:8032/health"
echo "   • Store Knowledge: POST http://localhost:8032/embed"
echo "   • Search Knowledge: GET http://localhost:8032/search?query=YOUR_QUERY"
echo ""
echo "🤖 Agency Swarm (Local):"
echo "   • 4 Agents: CEO, Developer, GitHub Specialist, Knowledge Manager"
echo "   • 12 MCP Tools for complete agent management"
echo "   • Communication flows between agents"
echo "   • Workflow execution and monitoring"
echo ""
echo "📡 GitHub MCP:"
echo "   • 14 tools for GitHub operations"
echo "   • Repository management"
echo "   • Issue and PR handling"
echo "   • Code review automation"
echo ""
echo "🛠️ Available MCP Servers:"
echo "   • github-mcp-server.ts (GitHub operations)"
echo "   • agency-swarm-local-mcp-server.ts (Agent orchestration)"
echo ""
echo "📁 Project Structure:"
echo "   • src/services/ - Core services (Librarian, Agency Swarm)"
echo "   • src/mcp/ - MCP servers for agent integration"
echo "   • scripts/ - Utility scripts and tests"
echo "   • docs/ - Documentation and guides"
echo ""
echo "🚀 Ready to use your Universal AI Tools project!"
echo ""
echo "💡 Quick Commands:"
echo "   • Test integration: node scripts/test-agency-swarm-local-integration.mjs"
echo "   • Check all services: ps aux | grep -E '(librarian|github-mcp|agency-swarm)'"
echo "   • View logs: tail -f logs/*.log"
echo ""
