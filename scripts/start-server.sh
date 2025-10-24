#!/bin/bash

echo "Starting Universal AI Tools Server..."

# Kill any existing process on port 8080
lsof -ti:8080 | xargs kill -9 2>/dev/null || true

# Try the working server first
echo "Starting working server configuration..."
npx tsx src/server-working.ts &
SERVER_PID=$!

# Wait a moment
sleep 2

# Check if server started
if ps -p $SERVER_PID > /dev/null; then
    echo "✅ Server started successfully on port 8080"
    echo "PID: $SERVER_PID"
    echo ""
    echo "Available endpoints:"
    echo "  - Health check: http://localhost:8080/health"
    echo "  - WebSocket: ws://localhost:8080"
    echo ""
    echo "To stop the server: kill $SERVER_PID"
else
    echo "❌ Server failed to start"
    echo "Check logs for errors"
fi