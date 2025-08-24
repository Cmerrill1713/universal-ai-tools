#!/bin/bash

echo "🚀 UNIVERSAL AI TOOLS - EASY START"
echo "=================================="

# Kill any existing server processes
echo "🔄 Cleaning up existing processes..."
lsof -ti :9999 | xargs kill -9 2>/dev/null || true
lsof -ti :10000 | xargs kill -9 2>/dev/null || true

# Start required services
echo "🗄️ Starting Supabase..."
supabase start > /dev/null 2>&1

# Check if Redis is running
if ! redis-cli ping > /dev/null 2>&1; then
    echo "🔧 Starting Redis..."
    brew services start redis 2>/dev/null || {
        echo "⚠️ Redis not installed. Installing via Homebrew..."
        brew install redis && brew services start redis
    }
fi

# Check if Ollama is running
if ! curl -s http://localhost:11434/api/version > /dev/null 2>&1; then
    echo "🤖 Starting Ollama..."
    open -a Ollama 2>/dev/null || {
        echo "⚠️ Ollama not running. Please start Ollama manually."
    }
fi

# Install Python dependencies if needed
if [ ! -d "src/services/dspy-orchestrator/venv" ]; then
    echo "🐍 Setting up Python environment..."
    cd src/services/dspy-orchestrator
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    cd ../../..
fi

# Start the server
echo "🚀 Starting Universal AI Tools..."
echo "   Server will be available at: http://localhost:9999"
echo "   Health check: http://localhost:9999/health"
echo "   Press Ctrl+C to stop"
echo ""

# Start with comprehensive logging
PORT=9999 npm run dev

echo ""
echo "✅ Server stopped. All services remain running for next start."