#!/bin/bash

echo "🌸 Starting Sweet Athena Signaling Server"
echo "========================================"

# Kill any existing processes on port 8888
if lsof -i :8888 > /dev/null 2>&1; then
    echo "Stopping existing server on port 8888..."
    lsof -ti :8888 | xargs kill -9 2>/dev/null
    sleep 2
fi

# Start the signaling server
echo "Starting signaling server..."
node sweet-athena-signaling-server.mjs