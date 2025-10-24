#!/bin/bash

echo "🚀 Enabling All AI Features..."
echo "=============================="

# Check if server is running
if ! curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo "❌ Server is not running. Starting it first..."
    npm run dev:smart &
    SERVER_PID=$!
    echo "Waiting for server to start..."
    sleep 10
fi

echo ""
echo "🧬 Enabling Alpha Evolve System..."
curl -X POST http://localhost:8080/api/v1/alpha-evolve/enable \
    -H "Content-Type: application/json" \
    -d '{"enabled": true}' 2>/dev/null && echo "✅ Alpha Evolve enabled"

echo ""
echo "🤖 Enabling Self-Improvement Systems..."
curl -X POST http://localhost:8080/api/v1/self-improvement/enable \
    -H "Content-Type: application/json" \
    -d '{"mode": "aggressive"}' 2>/dev/null && echo "✅ Self-improvement enabled"

echo ""
echo "🔧 Enabling Tool Maker Agent..."
curl -X POST http://localhost:8080/api/v1/agents/tool-maker/enable \
    -H "Content-Type: application/json" \
    -d '{"autoCreate": true}' 2>/dev/null && echo "✅ Tool Maker enabled"

echo ""
echo "🔥 Enabling Hot Reload Orchestrator..."
curl -X POST http://localhost:8080/api/v1/orchestration/hot-reload/enable \
    -H "Content-Type: application/json" \
    -d '{"aggressive": true}' 2>/dev/null && echo "✅ Hot Reload enabled"

echo ""
echo "📊 Starting Performance Optimization..."
npm run test:performance -- --optimize &

echo ""
echo "🧠 Training AI on Codebase..."
npm run fix:train &

echo ""
echo "✨ All AI features enabled!"
echo ""
echo "Monitor progress at:"
echo "  - Dashboard: http://localhost:8080/dashboard"
echo "  - AI Status: http://localhost:8080/api/v1/ai/status"
echo "  - Evolution: http://localhost:8080/api/v1/alpha-evolve/status"