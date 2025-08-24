#!/bin/bash

# Simple test for Go News API
export UAT_SERVER_PORT=8082
PORT=8082

echo "🧪 Testing Universal AI Tools Go News API"
echo "========================================"

# Start server in background
cd /Users/christianmerrill/Desktop/universal-ai-tools/go-api-gateway
go run cmd/main.go > /tmp/go-api-gateway.log 2>&1 &
SERVER_PID=$!
echo "Started server (PID: $SERVER_PID) on port $PORT"

# Wait for server to start
sleep 8

# Function to test endpoint
test_endpoint() {
    local endpoint=$1
    local description=$2
    
    echo ""
    echo "Testing: $description"
    echo "URL: http://localhost:$PORT$endpoint"
    
    response=$(curl -s "http://localhost:$PORT$endpoint")
    if [[ $? -eq 0 ]] && [[ -n "$response" ]]; then
        echo "✅ Success"
        echo "$response" | head -c 300
        echo "..."
    else
        echo "❌ Failed"
    fi
}

# Test endpoints
test_endpoint "/health" "System Health"
test_endpoint "/api/v1/news/categories" "News Categories"
test_endpoint "/api/v1/news?limit=3" "All News (3 items)"
test_endpoint "/api/v1/news?category=ai-ml&limit=2" "AI/ML News"
test_endpoint "/api/v1/news/stats" "News Statistics"

# Show server logs
echo ""
echo "📋 Recent server logs:"
tail -20 /tmp/go-api-gateway.log

# Cleanup
echo ""
echo "🧹 Cleaning up..."
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null
echo "✅ Server stopped"

echo ""
echo "🎉 News API test completed!"