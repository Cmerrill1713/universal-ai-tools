#!/bin/bash

# Quick start script for Universal AI Tools

echo "🚀 Starting Universal AI Tools in simplified mode..."

# Kill any existing process on port 8080
lsof -ti:8080 | xargs kill -9 2>/dev/null || true

# Set environment variables
export NODE_ENV=development
export PORT=8080

# Check if .env exists
if [ ! -f .env ]; then
    echo "📄 Creating .env from .env.example..."
    cp .env.example .env
fi

# Run the working server configuration
echo "✅ Starting server on port 8080..."
echo ""
echo "Available endpoints:"
echo "  - Health check: http://localhost:8080/health"
echo "  - API docs: http://localhost:8080/api/docs"
echo "  - WebSocket: ws://localhost:8080"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Start the server
npx tsx src/server-working.ts