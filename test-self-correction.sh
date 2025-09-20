#!/bin/bash

echo "🧪 Testing Self-Correction System"
echo "================================="

# Test various self-correction triggers
test_phrases=(
    "correct it"
    "fix it" 
    "correct yourself"
    "fix yourself"
    "self-correct"
    "improve your response"
    "do better"
    "try again"
    "redo"
    "rethink"
    "better response"
)

echo "Testing Go Chat Service..."
echo "------------------------"

for phrase in "${test_phrases[@]}"; do
    echo "Testing: '$phrase'"
    
    # Test the Go service
    response=$(curl -s -X POST http://localhost:8080/chat \
        -H "Content-Type: application/json" \
        -d "{\"message\": \"$phrase\"}" | jq -r '.response' 2>/dev/null)
    
    if [[ "$response" == *"SELF-CORRECTION ANALYSIS"* ]]; then
        echo "✅ Triggered self-correction for: $phrase"
    else
        echo "❌ Did NOT trigger self-correction for: $phrase"
        echo "   Response: ${response:0:100}..."
    fi
    echo ""
done

echo "Testing Python HRM Service..."
echo "----------------------------"

for phrase in "${test_phrases[@]}"; do
    echo "Testing: '$phrase'"
    
    # Test the HRM service
    response=$(curl -s -X POST http://localhost:8002/reason \
        -H "Content-Type: application/json" \
        -d "{\"problem\": \"$phrase\"}" | jq -r '.reasoning' 2>/dev/null)
    
    if [[ "$response" == *"SELF-CORRECTION ANALYSIS"* ]]; then
        echo "✅ Triggered self-correction for: $phrase"
    else
        echo "❌ Did NOT trigger self-correction for: $phrase"
        echo "   Response: ${response:0:100}..."
    fi
    echo ""
done

echo "Testing chat self-correction flow..."
echo "------------------------------------"

initial_prompt="Give me a quick overview of the current HRM service capabilities."
initial_response=$(curl -s -X POST http://localhost:8080/chat \
    -H "Content-Type: application/json" \
    -d "{\"message\": \"$initial_prompt\"}" | jq -r '.response' 2>/dev/null)

if [[ -z "$initial_response" || "$initial_response" == "null" ]]; then
    echo "❌ Initial chat response was empty"
else
    echo "✅ Received initial chat response (${#initial_response} chars)"
fi

correction_response=$(curl -s -X POST http://localhost:8080/chat \
    -H "Content-Type: application/json" \
    -d '{"message": "self-correct that answer"}' | jq -r '.response' 2>/dev/null)

if [[ "$correction_response" == *"SELF-CORRECTION"* ]]; then
    echo "✅ Chat self-correction pipeline produced a revision"
else
    echo "❌ Chat self-correction pipeline did not respond as expected"
    echo "   Response: ${correction_response:0:160}..."
fi

echo "🧪 Self-Correction Test Complete!"
