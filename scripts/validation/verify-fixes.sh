#!/bin/bash

echo "🧪 Universal AI Tools - Fix Verification Script"
echo "=============================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Please copy .env.example to .env and configure it:"
    echo "  cp .env.example .env"
    echo ""
    exit 1
fi

# Check if DEV_API_KEY is set
if ! grep -q "DEV_API_KEY=" .env || grep -q "DEV_API_KEY=your_dev_api_key_here" .env; then
    echo "⚠️  WARNING: DEV_API_KEY not properly set in .env"
    echo "Please edit .env and set a real API key value"
    echo ""
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Kill any existing server on port 9999
echo "🔍 Checking for existing server on port 9999..."
lsof -ti:9999 | xargs kill -9 2>/dev/null && echo "Killed existing server" || echo "No existing server found"

# Start the server in background
echo ""
echo "🚀 Starting server..."
npm run dev > server.log 2>&1 &
SERVER_PID=$!
echo "Server started with PID: $SERVER_PID"

# Wait a bit for server to start
echo "⏳ Waiting for server to initialize..."
sleep 5

# Run the tests
echo ""
echo "🧪 Running comprehensive tests..."
echo "================================"
node test-all-fixes.js

# Store test result
TEST_RESULT=$?

# Show server logs if tests failed
if [ $TEST_RESULT -ne 0 ]; then
    echo ""
    echo "📋 Recent server logs:"
    echo "====================="
    tail -n 50 server.log
fi

# Kill the server
echo ""
echo "🛑 Stopping server..."
kill $SERVER_PID 2>/dev/null

# Exit with test result
exit $TEST_RESULT