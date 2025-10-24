#!/bin/bash

echo "🍎 LAUNCHING SWIFT FRONTEND"
echo "==========================="
echo ""

echo "1. Checking backend services..."
echo "=============================="

# Check Chat Service
echo "Chat Service (8010):"
curl -s http://localhost:8010/health > /dev/null && echo "  ✅ Running" || echo "  ❌ Not running"

# Check Vision Service  
echo "Vision Service (8084):"
curl -s http://localhost:8084/health > /dev/null && echo "  ✅ Running" || echo "  ❌ Not running"

# Check System Access Service
echo "System Access Service (8019):"
curl -s http://localhost:8019/health > /dev/null && echo "  ✅ Running" || echo "  ❌ Not running"

# Check Auth Service
echo "Auth Service (8015):"
curl -s http://localhost:8015/health > /dev/null && echo "  ✅ Running" || echo "  ❌ Not running"

# Check TTS Service
echo "TTS Service (8091):"
curl -s http://localhost:8091/health > /dev/null && echo "  ✅ Running" || echo "  ❌ Not running"

echo ""
echo "2. Building Swift app..."
echo "======================="
cd UniversalAIToolsApp
swift build

echo ""
echo "3. Starting Swift frontend..."
echo "============================="
echo "🚀 Swift frontend is launching..."
echo "📱 The Universal AI Tools app should open shortly..."
echo ""
echo "💡 Features available:"
echo "   • AI Chat with backend integration"
echo "   • Vision processing"
echo "   • System access commands"
echo "   • Text-to-speech"
echo "   • Authentication"
echo ""

swift run UniversalAIToolsApp
