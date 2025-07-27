#!/bin/bash

# Universal AI Tools - Complete Startup Script

echo "🚀 Starting Universal AI Tools..."

# Kill any existing processes
echo "🔄 Cleaning up existing processes..."
pkill -f "tsx.*server.ts" 2>/dev/null
pkill -f "vite" 2>/dev/null
pkill -f "python.*dspy.*server.py" 2>/dev/null
sleep 2

# Start Redis if not running
echo "🔴 Checking Redis..."
if ! pgrep -x "redis-server" > /dev/null; then
    echo "Starting Redis..."
    redis-server --daemonize yes
else
    echo "Redis is already running"
fi

# Start backend
echo "🖥️  Starting backend server..."
cd /Users/christianmerrill/Desktop/universal-ai-tools
npm run dev &
BACKEND_PID=$!

# Wait for backend to start
echo "⏳ Waiting for backend to initialize..."
sleep 5

# Check if backend is running
if curl -s http://localhost:9999/api/health > /dev/null; then
    echo "✅ Backend is running on http://localhost:9999"
else
    echo "❌ Backend failed to start. Check logs above."
    exit 1
fi

# Start frontend
echo "🎨 Starting frontend..."
cd /Users/christianmerrill/Desktop/universal-ai-tools/ui
npm run dev &
FRONTEND_PID=$!

# Wait for frontend to start
echo "⏳ Waiting for frontend to initialize..."
sleep 5

# Check if frontend is running
if curl -s http://localhost:5173 > /dev/null; then
    echo "✅ Frontend is running on http://localhost:5173"
else
    echo "❌ Frontend failed to start. Check logs above."
    exit 1
fi

echo ""
echo "🎉 Universal AI Tools is ready!"
echo ""
echo "📍 Access the application at:"
echo "   - Frontend: http://localhost:5173"
echo "   - Backend API: http://localhost:9999"
echo "   - Health Check: http://localhost:9999/api/health"
echo ""
echo "📋 Available pages:"
echo "   - Dashboard: http://localhost:5173/"
echo "   - AI Chat: http://localhost:5173/ai-chat"
echo "   - Agents: http://localhost:5173/agents"
echo "   - Memory: http://localhost:5173/memory"
echo ""
echo "🛑 To stop all services, press Ctrl+C"
echo ""

# Keep script running and handle shutdown
trap "echo '🛑 Shutting down...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

# Wait for processes
wait