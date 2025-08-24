#!/bin/bash

echo "🔍 AI Assistant Diagnostic Tool"
echo "================================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check function
check_service() {
    local name=$1
    local url=$2
    local expected=$3
    
    echo -n "Checking $name... "
    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "$url")
    
    if [ "$response" = "$expected" ]; then
        echo -e "${GREEN}✅ OK${NC}"
        return 0
    else
        echo -e "${RED}❌ Failed (HTTP $response)${NC}"
        return 1
    fi
}

# 1. Check API Gateway
check_service "API Gateway" "http://localhost:8080/health" "200"

# 2. Check Ollama
echo -n "Checking Ollama... "
if ollama list 2>/dev/null | grep -q "llama3.2:3b"; then
    echo -e "${GREEN}✅ OK (Model available)${NC}"
else
    echo -e "${YELLOW}⚠️ No Ollama models found${NC}"
    echo "  Fix: Run 'ollama pull llama3.2:3b'"
fi

# 3. Check LM Studio
echo -n "Checking LM Studio... "
lm_response=$(curl -s --max-time 2 http://localhost:5901/v1/models 2>/dev/null)
if [ -n "$lm_response" ]; then
    echo -e "${GREEN}✅ OK${NC}"
else
    echo -e "${YELLOW}⚠️ Not running or slow${NC}"
fi

# 4. Test actual chat
echo ""
echo "Testing Chat Functionality:"
echo "----------------------------"

# Test 1: Simple message
echo -n "1. Simple message test... "
response=$(curl -s -X POST http://localhost:8080/api/v1/chat/ \
    -H "Content-Type: application/json" \
    -d '{"message": "Say hello"}' \
    --max-time 5)

if echo "$response" | jq -e '.success == true' >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Working${NC}"
    msg=$(echo "$response" | jq -r '.data.message' 2>/dev/null | head -c 50)
    echo "   Response: $msg..."
else
    echo -e "${RED}❌ Failed${NC}"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
fi

# Test 2: Quick response mode
echo -n "2. Quick response test... "
response=$(curl -s -X POST http://localhost:8080/api/v1/chat/ \
    -H "Content-Type: application/json" \
    -d '{"message": "Hi", "quickResponse": true}' \
    --max-time 2)

if echo "$response" | jq -e '.success == true' >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Working${NC}"
else
    echo -e "${RED}❌ Failed${NC}"
fi

# Test 3: Complex request
echo -n "3. Complex request test... "
response=$(curl -s -X POST http://localhost:8080/api/v1/chat/ \
    -H "Content-Type: application/json" \
    -d '{"message": "Write a Python function to calculate fibonacci"}' \
    --max-time 10)

if echo "$response" | jq -e '.success == true' >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Working${NC}"
    time=$(echo "$response" | jq -r '.data.usage.executionTime' 2>/dev/null)
    echo "   Response time: $time"
else
    echo -e "${RED}❌ Failed or timed out${NC}"
fi

echo ""
echo "================================"
echo "Diagnosis Complete"
echo ""

# Summary
echo "Common Issues & Fixes:"
echo "----------------------"
echo "1. 'Empty response' → LM Studio may be slow. Wait longer or use quickResponse mode"
echo "2. 'Connection refused' → Start services with ./START_ASSISTANT.sh"
echo "3. 'Model not found' → Run: ollama pull llama3.2:3b"
echo "4. 'Timeout' → Complex requests may take 5-10 seconds with large models"
echo ""
echo "Quick Test Command:"
echo "curl -X POST http://localhost:8080/api/v1/chat/ \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"message\": \"Your question\", \"quickResponse\": true}'"