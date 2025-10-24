#!/bin/bash

echo "🔄 Restarting Universal AI Tools Backend..."

# Find and kill the process on port 9999
PID=$(lsof -ti:9999)
if [ ! -z "$PID" ]; then
    echo "📍 Found process $PID on port 9999"
    kill -9 $PID
    echo "✅ Stopped existing server"
    sleep 2
else
    echo "📍 No process found on port 9999"
fi

# Start the server
echo "🚀 Starting backend server..."
cd /Users/christianmerrill/Desktop/universal-ai-tools
npm run start:minimal &

echo "⏳ Waiting for server to start..."
sleep 3

# Check if server is running
if curl -s -H "X-API-Key: test-api-key-123" http://localhost:9999/api/v1/status > /dev/null; then
    echo "✅ Backend server is running on port 9999"
    echo "📍 Chat endpoint available at: http://localhost:9999/api/v1/chat"
else
    echo "❌ Failed to start server. Check the logs above."
fi