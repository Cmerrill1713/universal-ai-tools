#!/bin/bash

echo "🔧 Swift MCP Debug Tool"
echo "======================"
echo

# Check backend services
echo "📡 Backend Services Status:"
echo "---------------------------"

# Chat Service
if curl -s http://localhost:8010/health > /dev/null 2>&1; then
    echo "✅ Chat Service (8010): HEALTHY"
else
    echo "❌ Chat Service (8010): DOWN"
fi

# Knowledge Gateway
if curl -s http://localhost:8088/health > /dev/null 2>&1; then
    echo "✅ Knowledge Gateway (8088): HEALTHY"
else
    echo "❌ Knowledge Gateway (8088): DOWN"
fi

# Health Monitor
if curl -s http://localhost:8080/status > /dev/null 2>&1; then
    echo "✅ Health Monitor (8080): HEALTHY"
else
    echo "❌ Health Monitor (8080): DOWN"
fi

echo

# Check processes
echo "🔍 Running Processes:"
echo "--------------------"
ps aux | grep -E "(main|auth|assistant)" | grep -v grep | head -5

echo

# Check ports
echo "🌐 Port Usage:"
echo "-------------"
lsof -i :8010 -i :8088 -i :8080 2>/dev/null | grep LISTEN || echo "No services listening on expected ports"

echo

# Swift build check
echo "🏗️  Swift Build Check:"
echo "---------------------"
cd UniversalAIToolsApp
if swift build > /dev/null 2>&1; then
    echo "✅ Swift build: SUCCESS"
else
    echo "❌ Swift build: FAILED"
    echo "Run: cd UniversalAIToolsApp && swift build"
fi

echo

# Xcode check
echo "📱 Xcode Check:"
echo "---------------"
if [ -d "/Applications/Xcode.app" ]; then
    echo "✅ Xcode: INSTALLED"
    echo "📝 To run: cd UniversalAIToolsApp && xed ."
else
    echo "❌ Xcode: NOT FOUND"
fi

echo

# Debug instructions
echo "🧪 Testing Instructions:"
echo "------------------------"
echo "1. Open Xcode: cd UniversalAIToolsApp && xed ."
echo "2. Run the app (Cmd+R)"
echo "3. Watch console for debug messages:"
echo "   - 🔧 GroundingSystemManager initializing..."
echo "   - 💬 ChatViewSimple appeared"
echo "   - 🎯 Text field focus: true (when you click text field)"
echo "   - 🔤 Text input changed: 'h' (when you type)"
echo

echo "🎯 Ready to test! Let me know what debug messages you see."