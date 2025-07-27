#!/bin/bash

# AB-MCTS API Test Script
# Tests the API endpoints directly

echo "🚀 AB-MCTS API Endpoint Test"
echo "=========================================="

# Check if server is running
echo -e "\n📡 Checking server status..."
if curl -s http://localhost:9999/health > /dev/null 2>&1; then
    echo "✅ Server is running"
else
    echo "❌ Server is not running. Please start with: npm run dev"
    exit 1
fi

# Test 1: Health check
echo -e "\n1️⃣ Testing AB-MCTS health endpoint..."
curl -s http://localhost:9999/api/v1/ab-mcts/health | jq '.' || echo "❌ Health check failed"

# Test 2: Get metrics
echo -e "\n2️⃣ Testing metrics endpoint..."
curl -s http://localhost:9999/api/v1/ab-mcts/metrics | jq '.' || echo "❌ Metrics retrieval failed"

# Test 3: Simple orchestration
echo -e "\n3️⃣ Testing orchestration endpoint..."
curl -s -X POST http://localhost:9999/api/v1/ab-mcts/orchestrate \
  -H "Content-Type: application/json" \
  -d '{
    "userRequest": "Create a simple hello world function",
    "options": {
      "useCache": false,
      "collectFeedback": true
    }
  }' | jq '.' || echo "❌ Orchestration failed"

# Test 4: Get models
echo -e "\n4️⃣ Testing models endpoint..."
curl -s "http://localhost:9999/api/v1/ab-mcts/models?taskType=general" | jq '.' || echo "❌ Models retrieval failed"

# Test 5: Get report
echo -e "\n5️⃣ Testing report endpoint..."
curl -s http://localhost:9999/api/v1/ab-mcts/report | jq '.' || echo "❌ Report generation failed"

echo -e "\n=========================================="
echo "✅ API test complete!"