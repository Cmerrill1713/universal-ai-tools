#!/bin/bash

echo "🚀 Starting Universal AI Assistant..."
echo "===================================="
echo ""

# Step 1: Make sure Ollama is running
echo "1️⃣ Checking Ollama..."
if ! pgrep -x "ollama" > /dev/null; then
    echo "   Starting Ollama..."
    ollama serve > /dev/null 2>&1 &
    sleep 2
fi
echo "   ✅ Ollama is running"

# Step 2: Make sure we have a model
echo "2️⃣ Checking AI models..."
if ! ollama list | grep -q "llama3.2:3b"; then
    echo "   Downloading lightweight model (this may take a minute)..."
    ollama pull llama3.2:3b
fi
echo "   ✅ AI model ready"

# Step 3: Start the API Gateway if not running
echo "3️⃣ Checking API Gateway..."
if ! lsof -i :8080 | grep -q LISTEN; then
    echo "   Starting API Gateway..."
    cd go-api-gateway
    UAT_SERVER_PORT=8080 UAT_SECURITY_REQUIRE_AUTH=false go run cmd/main.go > ../api.log 2>&1 &
    cd ..
    echo "   Waiting for startup..."
    sleep 5
fi
echo "   ✅ API Gateway running"

echo ""
echo "===================================="
echo "✅ ASSISTANT READY!"
echo ""
echo "Choose how to interact:"
echo ""
echo "1. Web Interface (Recommended):"
echo "   Open: simple-assistant.html"
echo ""
echo "2. Command Line:"
echo "   Run: ./ai.sh"
echo ""
echo "3. Direct API:"
echo "   curl -X POST http://localhost:8080/api/v1/chat/ \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"message\": \"Your question here\"}'"
echo ""
echo "===================================="

# Open the web interface
open simple-assistant.html 2>/dev/null || echo "Please open simple-assistant.html in your browser"