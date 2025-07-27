#!/bin/bash

# Simple startup script for Universal AI Tools

echo "🚀 Starting Universal AI Tools..."
echo ""

# Kill any existing processes
pkill -f "npm run dev" 2>/dev/null
pkill -f "vite" 2>/dev/null
sleep 2

# Start backend
echo "Starting backend server..."
cd /Users/christianmerrill/Desktop/universal-ai-tools
NODE_ENV=development PORT=9999 npm run dev:backend > backend-new.log 2>&1 &
BACKEND_PID=$!

# Wait for backend
echo "Waiting for backend..."
sleep 10

# Start frontend
echo "Starting frontend..."
cd ui
npm run dev > ../frontend-new.log 2>&1 &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ Services started!"
echo ""
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo ""
echo "URLs:"
echo "- Backend: http://localhost:9999/api"
echo "- Frontend: http://localhost:5173"
echo ""
echo "To stop: kill $BACKEND_PID $FRONTEND_PID"