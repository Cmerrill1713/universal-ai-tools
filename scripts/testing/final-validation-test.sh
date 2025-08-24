#!/bin/bash

# Final Validation Test with Correct Request Formats

echo "🎯 Final Validation Test - Using Correct Request Formats"
echo "======================================================="

BASE_URL="http://localhost:9999"

echo "1. AB-MCTS Orchestrate (with userRequest field):"
curl -s -X POST "$BASE_URL/api/v1/ab-mcts/orchestrate" \
  -H "Content-Type: application/json" \
  -d '{"task":"test task","userRequest":"test request","agents":["planner"],"maxIterations":5}' | jq .

echo -e "\n2. Agent Execute (with proper field names):"
curl -s -X POST "$BASE_URL/api/v1/agents/execute" \
  -H "Content-Type: application/json" \
  -d '{"agentName":"planner","userRequest":"test request","context":{}}' | jq .

echo -e "\n3. Context Store (with source field):"
curl -s -X POST "$BASE_URL/api/v1/context/store" \
  -H "Content-Type: application/json" \
  -d '{"content":"test content","category":"test","source":"test","metadata":{}}' | jq .

echo -e "\n4. Event Stream (checking if path exists):"
curl -s -w "Status: %{http_code}\n" "$BASE_URL/api/v1/events/stream"

echo -e "\n✅ Validation tests complete!"