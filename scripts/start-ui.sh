#!/bin/bash

echo "🚀 Starting Universal AI Tools UI..."
echo ""

# Check if node_modules exists
if [ ! -d "ui/node_modules" ]; then
    echo "📦 Installing dependencies..."
    cd ui && npm install
    cd ..
fi

# Start the UI development server
echo "✨ Starting UI development server with hot reload..."
echo "📱 UI will be available at: http://localhost:5173"
echo ""
echo "👀 Watching for changes..."
echo "Press Ctrl+C to stop"
echo ""

cd ui && npm run dev