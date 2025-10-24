#!/bin/bash

echo "🚀 UNIVERSAL AI TOOLS LAUNCHER"
echo "=============================="
echo ""
echo "This launcher will:"
echo "1. Start all backend services"
echo "2. Launch the Swift frontend"
echo ""

# Start backend services
echo "📡 Starting backend services..."
./start-backend-services.sh

echo ""
echo "⏳ Waiting for services to fully initialize..."
sleep 3

echo ""
echo "🧪 Testing service connectivity..."
echo "   - Chat Service:" && curl -s http://localhost:8016/health | jq '.status' || echo "   ❌ Chat Service not responding"
echo "   - Research Service:" && curl -s http://localhost:8028/health | jq '.status' || echo "   ❌ Research Service not responding"
echo "   - Implementation Service:" && curl -s http://localhost:8029/health | jq '.status' || echo "   ❌ Implementation Service not responding"

echo ""
echo "🎯 Launching Swift frontend..."
echo "=============================="
echo ""

# Launch the Swift app
open /Users/christianmerrill/Desktop/universal-ai-tools/UniversalAIToolsApp.xcodeproj

echo "✅ Swift app launched in Xcode!"
echo ""
echo "📋 NEXT STEPS:"
echo "=============="
echo "1. Build and run the Swift app in Xcode"
echo "2. The app will connect to the backend services automatically"
echo "3. Try asking the AI to 'improve the system' or 'create a new service'"
echo ""
echo "🛑 To stop all services later, run: ./stop-backend-services.sh"
echo ""
echo "🎉 Universal AI Tools is ready to use!"
