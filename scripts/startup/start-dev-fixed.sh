#!/bin/bash

echo "🚀 Starting Sweet Athena Development Server (Fixed)"
echo "=================================================="
echo ""

# Kill any existing processes
echo "🧹 Cleaning up existing processes..."
pkill -f "tsx.*server" 2>/dev/null || true
pkill -f "node.*server" 2>/dev/null || true
pkill -f "DSPy" 2>/dev/null || true
lsof -ti:9999 | xargs kill -9 2>/dev/null || true
lsof -ti:8766 | xargs kill -9 2>/dev/null || true
sleep 2

# Start with direct tsx (no watch mode to avoid hanging)
echo "📦 Starting backend server without watch mode..."
echo ""

# Export env to avoid tsx watch issues
export NODE_ENV=development
export FORCE_COLOR=1

# Use tsx directly without watch
tsx src/server.ts &
SERVER_PID=$!

echo "✅ Server started with PID: $SERVER_PID"
echo ""

# Wait for server to start
echo "⏳ Waiting for server to initialize..."
for i in {1..30}; do
    if curl -s http://localhost:9999/api/v1/health > /dev/null 2>&1; then
        echo ""
        echo "✅ Server is ready!"
        echo ""
        echo "📡 API Endpoints:"
        echo "   Health: http://localhost:9999/api/v1/health"
        echo "   Sweet Athena: http://localhost:9999/api/v1/sweet-athena/status"
        echo ""
        echo "🛑 To stop: kill $SERVER_PID"
        echo ""
        break
    fi
    echo -n "."
    sleep 1
done

# Keep script running
echo "Server is running. Press Ctrl+C to stop."
wait $SERVER_PID