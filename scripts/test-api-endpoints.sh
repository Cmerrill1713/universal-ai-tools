#!/bin/bash

echo "=== Testing API Endpoints ==="
echo "============================="
echo

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Base URL
BASE_URL="http://localhost:9999"

# Test function
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local expected_status=$4
    
    echo -e "${YELLOW}Testing: $method $endpoint${NC}"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$endpoint")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_status" ]; then
        echo -e "${GREEN}  ✅ Status: $http_code${NC}"
        echo "  Response: $(echo $body | jq -c '.' 2>/dev/null || echo $body | head -c 100)"
    else
        echo -e "${RED}  ❌ Status: $http_code (expected $expected_status)${NC}"
        echo "  Response: $(echo $body | head -c 200)"
    fi
    echo
}

# Check if server is running
echo "Checking if server is running..."
if ! curl -s "$BASE_URL" > /dev/null 2>&1; then
    echo -e "${RED}❌ Server is not running on $BASE_URL${NC}"
    echo "Please start the server with: npm run dev"
    exit 1
fi
echo -e "${GREEN}✅ Server is running${NC}"
echo

# Test endpoints
echo "=== Public Endpoints ==="
test_endpoint "GET" "/api/health" "" "200"
test_endpoint "GET" "/api/stats" "" "200"
test_endpoint "GET" "/api/docs" "" "200"

echo "=== Memory Endpoints ==="
test_endpoint "POST" "/api/memory" '{"content":"Test memory","memory_type":"test","importance_score":5}' "401"
test_endpoint "POST" "/api/memory/search" '{"query":"test","limit":10}' "401"

echo "=== Ollama Status ==="
test_endpoint "GET" "/api/ollama/status" "" "200"

echo "=== AI Service Registration ==="
test_endpoint "POST" "/api/register" '{"service_name":"test_service","service_type":"claude","api_key":"test_key","endpoint":"https://api.test.com"}' "400"

echo "=== With API Key (if available) ==="
if [ ! -z "$AI_SERVICE_KEY" ]; then
    echo "Testing authenticated endpoints..."
    # Add authenticated tests here
else
    echo -e "${YELLOW}Skipping authenticated tests (AI_SERVICE_KEY not set)${NC}"
fi

echo
echo "=== Test Summary ==="
echo "All basic endpoints tested. Check results above for any failures."