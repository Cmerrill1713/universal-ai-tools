#!/bin/bash

echo "🔍 Checking Universal AI Tools Status..."
echo ""

# Check Backend
echo "🖥️  Backend Status:"
BACKEND_STATUS=$(curl -s -H "X-API-Key: test-api-key-123" http://localhost:9999/api/v1/status 2>/dev/null)
if [ $? -eq 0 ] && [ -n "$BACKEND_STATUS" ]; then
    echo "   ✅ Backend is running on http://localhost:9999"
    echo "   📊 Uptime: $(echo $BACKEND_STATUS | jq -r '.uptime' | awk '{printf "%.0f", $1}') seconds"
    echo "   💾 Memory: $(echo $BACKEND_STATUS | jq -r '.memory.heapUsed' | awk '{printf "%.1f", $1/1048576}') MB"
else
    echo "   ❌ Backend is not responding"
fi

echo ""

# Check Frontend
echo "🎨 Frontend Status:"
FRONTEND_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173 2>/dev/null)
if [ "$FRONTEND_CHECK" = "200" ]; then
    echo "   ✅ Frontend is running on http://localhost:5173"
else
    echo "   ❌ Frontend is not responding"
fi

echo ""

# Check Redis
echo "🔴 Redis Status:"
if pgrep -x "redis-server" > /dev/null; then
    echo "   ✅ Redis is running"
else
    echo "   ❌ Redis is not running"
fi

echo ""
echo "📋 Quick Links:"
echo "   - Dashboard: http://localhost:5173/"
echo "   - AI Chat: http://localhost:5173/ai-chat"
echo "   - Agents: http://localhost:5173/agents"
echo "   - API Status: http://localhost:9999/api/v1/status (requires API key)"
echo ""