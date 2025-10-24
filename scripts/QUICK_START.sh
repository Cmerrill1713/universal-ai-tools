#!/bin/bash

echo "🚀 Universal AI Tools - Quick Start"
echo "=================================="
echo ""
echo "This script will guide you through starting the application."
echo ""

# Function to check if a port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        return 0
    else
        return 1
    fi
}

# Kill existing processes
echo "🧹 Cleaning up existing processes..."
pkill -f "tsx.*server" 2>/dev/null
pkill -f "vite" 2>/dev/null
sleep 2

# Check ports
echo "🔍 Checking ports..."
if check_port 9999; then
    echo "⚠️  Port 9999 is in use. Killing process..."
    lsof -ti:9999 | xargs kill -9 2>/dev/null
    sleep 1
fi

if check_port 5173; then
    echo "⚠️  Port 5173 is in use. Killing process..."
    lsof -ti:5173 | xargs kill -9 2>/dev/null
    sleep 1
fi

echo ""
echo "📝 To start the application, run these commands in separate terminals:"
echo ""
echo "TERMINAL 1 - Backend:"
echo "---------------------"
echo "cd /Users/christianmerrill/Desktop/universal-ai-tools"
echo "npm run start:minimal"
echo ""
echo "TERMINAL 2 - Frontend:"
echo "----------------------"
echo "cd /Users/christianmerrill/Desktop/universal-ai-tools/ui"
echo "npm run dev"
echo ""
echo "Then open your browser to: http://localhost:5173"
echo ""
echo "Press Enter to copy the backend command to clipboard..."
read

# Copy backend command to clipboard
echo "cd /Users/christianmerrill/Desktop/universal-ai-tools && npm run start:minimal" | pbcopy
echo "✅ Backend command copied to clipboard! Paste it in Terminal 1."
echo ""
echo "Press Enter to copy the frontend command to clipboard..."
read

# Copy frontend command to clipboard
echo "cd /Users/christianmerrill/Desktop/universal-ai-tools/ui && npm run dev" | pbcopy
echo "✅ Frontend command copied to clipboard! Paste it in Terminal 2."
echo ""
echo "🎉 Once both are running, access the app at: http://localhost:5173"