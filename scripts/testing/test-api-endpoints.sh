#!/bin/bash

# Sweet Athena Backend API Integration Test
# Tests all core API endpoints to verify backend services are working

echo "🧪 Sweet Athena Backend API Integration Test"
echo "=============================================="
echo ""

# Test configuration
API_BASE="http://localhost:9999"
API_KEY="local-dev-key"
AI_SERVICE="local-ui"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
PASSED=0
FAILED=0

# Test function
test_endpoint() {
    local name="$1"
    local url="$2"
    local method="${3:-GET}"
    local headers="$4"
    local data="$5"
    
    echo -n "Testing $name... "
    
    if [ "$method" == "GET" ]; then
        if [ -n "$headers" ]; then
            response=$(curl -s -w "%{http_code}" -H "$headers" "$url" 2>/dev/null)
        else
            response=$(curl -s -w "%{http_code}" "$url" 2>/dev/null)
        fi
    else
        if [ -n "$headers" ]; then
            response=$(curl -s -w "%{http_code}" -X "$method" -H "Content-Type: application/json" -H "$headers" -d "$data" "$url" 2>/dev/null)
        else
            response=$(curl -s -w "%{http_code}" -X "$method" -H "Content-Type: application/json" -d "$data" "$url" 2>/dev/null)
        fi
    fi
    
    # Extract status code (last 3 characters)
    status_code="${response: -3}"
    # Extract response body (everything except last 3 characters)
    body="${response%???}"
    
    if [ "$status_code" == "200" ]; then
        echo -e "${GREEN}✅ PASS${NC} (HTTP $status_code)"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} (HTTP $status_code)"
        if [ ${#body} -gt 0 ] && [ ${#body} -lt 200 ]; then
            echo "   Response: $body"
        fi
        ((FAILED++))
        return 1
    fi
}

# Test authenticated endpoint
test_authenticated() {
    local name="$1"
    local url="$2"
    local method="${3:-GET}"
    local data="$4"
    
    echo -n "Testing $name... "
    
    if [ "$method" == "GET" ]; then
        response=$(curl -s -w "%{http_code}" \
            -H "x-api-key: $API_KEY" \
            -H "x-ai-service: $AI_SERVICE" \
            "$url" 2>/dev/null)
    else
        response=$(curl -s -w "%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -H "x-api-key: $API_KEY" \
            -H "x-ai-service: $AI_SERVICE" \
            -d "$data" "$url" 2>/dev/null)
    fi
    
    # Extract status code (last 3 characters)
    status_code="${response: -3}"
    # Extract response body (everything except last 3 characters)
    body="${response%???}"
    
    if [ "$status_code" == "200" ]; then
        echo -e "${GREEN}✅ PASS${NC} (HTTP $status_code)"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} (HTTP $status_code)"
        if [ ${#body} -gt 0 ] && [ ${#body} -lt 200 ]; then
            echo "   Response: $body"
        fi
        ((FAILED++))
        return 1
    fi
}

echo "📡 Basic Connectivity Tests:"
echo "----------------------------"

# Test health endpoint (no auth required)
test_endpoint "Health Endpoint" "$API_BASE/health"

# Test API docs (no auth required)
test_endpoint "API Documentation" "$API_BASE/api/docs"

echo ""
echo "🔐 Authentication Tests:"
echo "------------------------"

# Test authenticated stats endpoint
test_authenticated "Stats Endpoint" "$API_BASE/api/stats"

echo ""
echo "🧠 Memory System Tests:"
echo "----------------------"

# Test memory search
test_authenticated "Memory Search" "$API_BASE/api/memory/search" "POST" '{"query":"test","limit":5}'

# Test memory retrieval
test_authenticated "Memory Retrieve" "$API_BASE/api/memory"

echo ""
echo "🤖 Agent System Tests:"
echo "----------------------"

# Test agents list
test_authenticated "Agents List" "$API_BASE/api/agents"

echo ""
echo "🎯 Orchestration Tests:"
echo "----------------------"

# Test DSPy orchestration
test_authenticated "DSPy Orchestration" "$API_BASE/api/orchestration/orchestrate" "POST" '{"userRequest":"Hello test","orchestrationMode":"simple","sessionId":"test-123"}'

echo ""
echo "🔧 Performance & Monitoring:"
echo "---------------------------"

# Test performance metrics
test_endpoint "Performance Metrics" "$API_BASE/api/performance/metrics"

# Test Prometheus metrics
test_endpoint "Prometheus Metrics" "$API_BASE/metrics"

echo ""
echo "🦙 Ollama Integration:"
echo "--------------------"

# Test Ollama status
test_endpoint "Ollama Status" "$API_BASE/api/ollama/status"

echo ""
echo "💬 Chat System Tests:"
echo "--------------------"

# Test chat endpoint (requires auth and Ollama)
test_authenticated "Chat API" "$API_BASE/api/assistant/chat" "POST" '{"message":"Hello test","model":"llama3.2:3b","conversation_id":"test-conv"}'

echo ""
echo "📊 Test Summary:"
echo "================"
echo -e "✅ Passed: ${GREEN}$PASSED${NC}"
echo -e "❌ Failed: ${RED}$FAILED${NC}"

TOTAL=$((PASSED + FAILED))
if [ $TOTAL -gt 0 ]; then
    SUCCESS_RATE=$(( (PASSED * 100) / TOTAL ))
    echo "📈 Success Rate: $SUCCESS_RATE%"
fi

echo ""
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed! Backend services are working properly.${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some tests failed. Check the details above for troubleshooting.${NC}"
    exit 1
fi