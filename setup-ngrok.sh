#!/bin/bash

echo "🚀 Universal AI Tools - ngrok Setup for Cellular Access"
echo "=================================================="
echo ""
echo "This script will help you set up ngrok to access your AI tools over cellular."
echo ""

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok is not installed. Please run: brew install ngrok/ngrok/ngrok"
    exit 1
fi

echo "✅ ngrok is installed"
echo ""

# Check if authtoken is configured
if ! ngrok config check &> /dev/null; then
    echo "⚠️  ngrok requires authentication. Please follow these steps:"
    echo ""
    echo "1. Sign up for a free account at: https://dashboard.ngrok.com/signup"
    echo "2. Get your authtoken at: https://dashboard.ngrok.com/get-started/your-authtoken"
    echo "3. Run: ngrok config add-authtoken YOUR_AUTH_TOKEN"
    echo ""
    echo "Then run this script again."
    exit 1
fi

echo "✅ ngrok is authenticated"
echo ""

# Check if server is running
if ! curl -s http://localhost:9999/api/v1/mobile-orchestration/metrics > /dev/null; then
    echo "⚠️  Universal AI Tools server is not running on port 9999"
    echo "Please start it with: npm run dev"
    echo ""
    read -p "Press Enter after starting the server..."
fi

echo "✅ Server is running on port 9999"
echo ""

echo "Starting ngrok tunnel..."
echo ""

# Start ngrok and capture the URL
ngrok http 9999 --log stdout > /tmp/ngrok.log 2>&1 &
NGROK_PID=$!

echo "Waiting for ngrok to start..."
sleep 3

# Extract the public URL
NGROK_URL=$(curl -s localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*' | cut -d'"' -f4 | head -1)

if [ -z "$NGROK_URL" ]; then
    echo "❌ Failed to get ngrok URL. Check /tmp/ngrok.log for errors"
    kill $NGROK_PID 2>/dev/null
    exit 1
fi

echo ""
echo "🎉 Success! Your Universal AI Tools server is now accessible at:"
echo ""
echo "   $NGROK_URL"
echo ""
echo "📱 To use this in your iOS app:"
echo ""
echo "1. Open /Users/christianmerrill/Desktop/universal-ai-tools/iOS Working App/UniversalAICompanion/NetworkConfig.swift"
echo ""
echo "2. Update the environment to:"
echo "   environment = .public(url: \"$NGROK_URL\")"
echo ""
echo "3. Rebuild and run the iOS app"
echo ""
echo "📊 ngrok dashboard: http://localhost:4040"
echo ""
echo "Press Ctrl+C to stop the tunnel"
echo ""

# Keep the script running
wait $NGROK_PID