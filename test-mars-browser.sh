#!/bin/bash

echo "🚀 Testing Browser Automation - Mars Search"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Test 1: Browser capabilities
echo "1️⃣ Checking browser automation capabilities..."
curl -s http://localhost:8013/api/automation/capabilities | python3 -m json.tool

echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""

# Test 2: Execute browser command to search for Mars
echo "2️⃣ Opening browser and searching for Mars..."
curl -X POST http://localhost:8013/api/automation/browser/execute \
  -H "Content-Type: application/json" \
  -d '{
    "action": "navigate",
    "url": "https://www.google.com/search?q=Mars+planet",
    "waitFor": "body"
  }' | python3 -m json.tool

echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""

# Test 3: Ask the AI about Mars via chat
echo "3️⃣ Asking AI about Mars (via chat endpoint)..."
curl -X POST http://localhost:8013/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Can you open a browser and search for information about Mars? Tell me 3 interesting facts."
  }' | python3 -m json.tool

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✅ Test complete!"
echo ""
echo "If browser opened: Check for a browser window with Mars search"
echo "If AI responded: Check the JSON response above"

