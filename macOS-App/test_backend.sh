#!/bin/bash

echo "🔍 Universal AI Tools Backend Connectivity Test"
echo "=============================================="

# Test 1: Basic connectivity
echo "1. Testing basic connectivity to localhost:9999..."
if curl -s --connect-timeout 5 http://localhost:9999 > /dev/null 2>&1; then
    echo "✅ Port 9999 is reachable"
else
    echo "❌ Port 9999 is not reachable"
fi

# Test 2: Health endpoint
echo ""
echo "2. Testing /api/v1/health endpoint..."
HEALTH_RESPONSE=$(curl -s --connect-timeout 5 http://localhost:9999/api/v1/health 2>/dev/null)
if [ $? -eq 0 ] && [ ! -z "$HEALTH_RESPONSE" ]; then
    echo "✅ Health endpoint accessible"
    echo "Response: $HEALTH_RESPONSE" | head -c 200
    echo "..."
else
    echo "❌ Health endpoint not accessible"
fi

# Test 3: Status endpoint (what the app uses)
echo ""
echo "3. Testing /api/v1/status endpoint..."
STATUS_RESPONSE=$(curl -s --connect-timeout 5 http://localhost:9999/api/v1/status 2>/dev/null)
if [ $? -eq 0 ] && [ ! -z "$STATUS_RESPONSE" ]; then
    echo "✅ Status endpoint accessible"
    echo "Response: $STATUS_RESPONSE" | head -c 300
    echo "..."
else
    echo "❌ Status endpoint not accessible"
fi

# Test 4: MCP endpoint
echo ""
echo "4. Testing MCP server at /api/v1/mcp/status..."
MCP_RESPONSE=$(curl -s --connect-timeout 5 http://localhost:9999/api/v1/mcp/status 2>/dev/null)
if [ $? -eq 0 ] && [ ! -z "$MCP_RESPONSE" ]; then
    echo "✅ MCP endpoint accessible"
    echo "Response: $MCP_RESPONSE" | head -c 200
    echo "..."
else
    echo "❌ MCP endpoint not accessible"
fi

# Test 5: Backend process check
echo ""
echo "5. Checking backend processes..."
echo "Node.js processes:"
ps aux | grep node | grep -v grep | grep -E "(server|universal)" | head -3

echo ""
echo "Backend server status summary:"
if curl -s http://localhost:9999/api/v1/health | grep -q '"status":"healthy"'; then
    echo "🟢 Backend appears healthy"
elif curl -s http://localhost:9999/api/v1/health | grep -q '"status":"unhealthy"'; then
    echo "🟡 Backend is running but reports unhealthy status"
else
    echo "🔴 Backend is not responding or not healthy"
fi