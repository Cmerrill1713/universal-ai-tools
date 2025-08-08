#!/bin/bash

# Comprehensive Test Script for Universal AI Tools
# This script tests all major components and requirements of the project

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:9999"
TEST_RESULTS=""
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to print test header
print_header() {
    echo -e "\n${BLUE}=================================================================================${NC}"
    echo -e "${BLUE}Testing: $1${NC}"
    echo -e "${BLUE}=================================================================================${NC}"
}

# Function to test endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local expected_status=$4
    local test_name=$5
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo -n "Testing $test_name... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint" 2>/dev/null || echo "000")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$endpoint" 2>/dev/null || echo "000")
    fi
    
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓${NC} (Status: $http_code)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}✗${NC} (Expected: $expected_status, Got: $http_code)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# Start the server
echo -e "${YELLOW}Starting Universal AI Tools server...${NC}"
npm run dev > /tmp/test_server.log 2>&1 &
SERVER_PID=$!
sleep 8

# Verify server is running
if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo -e "${RED}Server failed to start!${NC}"
    cat /tmp/test_server.log | tail -20
    exit 1
fi

echo -e "${GREEN}Server started successfully (PID: $SERVER_PID)${NC}"

# 1. TEST BASIC HEALTH AND STATUS
print_header "1. Basic Health and Status Endpoints"
test_endpoint "GET" "/health" "" "200" "Health endpoint"
test_endpoint "GET" "/api/v1/status" "" "200" "API status endpoint"
test_endpoint "GET" "/api/v1/monitoring/metrics" "" "200" "Metrics endpoint"

# 2. TEST CORE API ENDPOINTS
print_header "2. Core API Endpoints"
test_endpoint "GET" "/api/v1/agents" "" "200" "List agents"
test_endpoint "GET" "/api/v1/models" "" "200" "List models"
test_endpoint "POST" "/api/v1/chat" '{"message":"Hello","model":"ollama:llama3.2:3b"}' "200" "Chat endpoint"

# 3. TEST MLX INTEGRATION
print_header "3. MLX Integration & Fine-Tuning"
test_endpoint "GET" "/api/v1/mlx/status" "" "200" "MLX status"
test_endpoint "GET" "/api/v1/mlx/models" "" "200" "MLX models list"
test_endpoint "GET" "/api/v1/mlx-fine-tuning/jobs" "" "200" "Fine-tuning jobs"

# 4. TEST INTELLIGENT PARAMETER AUTOMATION
print_header "4. Intelligent Parameter Automation"
test_endpoint "POST" "/api/v1/parameters/optimize" \
    '{"model":"ollama:llama3.2:3b","taskType":"code_generation","context":{}}' \
    "200" "Parameter optimization"
test_endpoint "GET" "/api/v1/parameters/analytics" "" "200" "Parameter analytics"

# 5. TEST AB-MCTS ORCHESTRATION
print_header "5. AB-MCTS Orchestration"
test_endpoint "POST" "/api/v1/ab-mcts/orchestrate" \
    '{"task":"test","agents":["planner"],"maxIterations":10}' \
    "200" "AB-MCTS orchestration"
test_endpoint "GET" "/api/v1/ab-mcts/status" "" "200" "AB-MCTS status"

# 6. TEST AGENT SYSTEM
print_header "6. Agent System"
test_endpoint "POST" "/api/v1/agents/execute" \
    '{"agentId":"planner","task":"Create a test plan","context":{}}' \
    "200" "Execute agent"
test_endpoint "GET" "/api/v1/agents/registry" "" "200" "Agent registry"

# 7. TEST VISION CAPABILITIES
print_header "7. Vision Processing"
test_endpoint "GET" "/api/v1/vision/status" "" "200" "Vision status"
test_endpoint "GET" "/api/v1/vision/capabilities" "" "200" "Vision capabilities"

# 8. TEST FAST COORDINATOR
print_header "8. Fast LLM Coordinator"
test_endpoint "GET" "/api/v1/fast-coordinator/status" "" "200" "Fast coordinator status"
test_endpoint "POST" "/api/v1/fast-coordinator/route" \
    '{"query":"test","complexity":"simple"}' \
    "200" "Route query"

# 9. TEST CONTEXT STORAGE
print_header "9. Context Storage"
test_endpoint "POST" "/api/v1/context/store" \
    '{"content":"Test context","category":"test","metadata":{}}' \
    "200" "Store context"
test_endpoint "GET" "/api/v1/context/recent?category=test" "" "200" "Get recent context"

# 10. TEST MCP INTEGRATION
print_header "10. MCP Integration"
test_endpoint "GET" "/api/v1/mcp/agents" "" "200" "MCP agents"
test_endpoint "GET" "/api/v1/mcp/status" "" "200" "MCP status"

# 11. TEST MEMORY PALACE
print_header "11. Memory Palace System"
test_endpoint "GET" "/api/v1/memory-palace/status" "" "200" "Memory palace status"
test_endpoint "POST" "/api/v1/memory-palace/store" \
    '{"content":"Test memory","type":"episodic","metadata":{}}' \
    "200" "Store memory"

# 12. TEST MALT SWARM
print_header "12. MALT Swarm Coordination"
test_endpoint "GET" "/api/v1/malt-swarm/health" "" "200" "MALT swarm health"
test_endpoint "GET" "/api/v1/malt-swarm/status" "" "200" "MALT swarm status"
test_endpoint "POST" "/api/v1/malt-swarm/tasks" \
    '{"description":"Test task","priority":1}' \
    "200" "Add MALT task"

# 13. TEST SANDBOXED EXECUTION
print_header "13. Sandboxed Execution"
test_endpoint "GET" "/api/v1/sandbox/status" "" "200" "Sandbox status"
test_endpoint "POST" "/api/v1/sandbox/execute" \
    '{"code":"console.log(\"Hello\")","language":"javascript","timeout":5000}' \
    "200" "Execute sandboxed code"

# 14. TEST SPECULATIVE INFERENCE
print_header "14. Speculative Inference"
test_endpoint "GET" "/api/v1/speculative/status" "" "200" "Speculative inference status"
test_endpoint "POST" "/api/v1/speculative/generate" \
    '{"prompt":"Test prompt","maxTokens":50}' \
    "200" "Generate with speculation"

# 15. TEST DEVICE AUTHENTICATION
print_header "15. Device Authentication"
test_endpoint "POST" "/api/v1/device-auth/register" \
    '{"deviceId":"test-device","deviceName":"Test Device","deviceType":"iPhone"}' \
    "200" "Register device"
test_endpoint "GET" "/api/v1/device-auth/devices" "" "200" "List devices"

# 16. TEST SECRETS MANAGEMENT
print_header "16. Secrets Management"
test_endpoint "GET" "/api/v1/secrets/status" "" "200" "Secrets status"

# 17. TEST HUGGINGFACE INTEGRATION
print_header "17. HuggingFace Integration"
test_endpoint "GET" "/api/v1/huggingface/models" "" "200" "HuggingFace models"

# 18. TEST KNOWLEDGE SCRAPING
print_header "18. Knowledge Scraping"
test_endpoint "POST" "/api/v1/knowledge-scraper/scrape" \
    '{"url":"https://example.com","depth":1}' \
    "200" "Scrape knowledge"

# 19. TEST EVENT STREAMING
print_header "19. Event Streaming"
test_endpoint "GET" "/api/v1/events/stream" "" "200" "Event stream"

# 20. TEST ASSISTANT ENDPOINTS
print_header "20. Assistant API"
test_endpoint "POST" "/api/v1/assistant/session" '{}' "200" "Create assistant session"
test_endpoint "GET" "/api/v1/assistant/sessions" "" "200" "List sessions"

# Check for critical errors in logs
print_header "21. Server Log Analysis"
echo "Checking for critical errors..."
ERROR_COUNT=$(grep -E "error|ERROR|Failed|FAILED" /tmp/test_server.log 2>/dev/null | grep -v "test" | wc -l || echo "0")
echo "Found $ERROR_COUNT error messages in logs"

# Check for service health
print_header "22. Service Health Check"
HEALTH_RESPONSE=$(curl -s "$BASE_URL/health")
echo "Health response: $HEALTH_RESPONSE"

# Final Summary
echo -e "\n${BLUE}=================================================================================${NC}"
echo -e "${BLUE}COMPREHENSIVE TEST SUMMARY${NC}"
echo -e "${BLUE}=================================================================================${NC}"
echo -e "Total Tests: ${TOTAL_TESTS}"
echo -e "Passed: ${GREEN}${PASSED_TESTS}${NC}"
echo -e "Failed: ${RED}${FAILED_TESTS}${NC}"
SUCCESS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
echo -e "Success Rate: ${SUCCESS_RATE}%"

if [ $SUCCESS_RATE -ge 80 ]; then
    echo -e "\n${GREEN}✅ SYSTEM TEST PASSED - Universal AI Tools is operational!${NC}"
else
    echo -e "\n${RED}❌ SYSTEM TEST FAILED - Some components need attention${NC}"
fi

# Check TypeScript compilation
print_header "23. TypeScript Compilation Check"
echo "Running TypeScript compiler check..."
npx tsc --noEmit 2>&1 | head -20 || true

# Check critical services
print_header "24. Critical Service Status"
echo "Checking critical services from health endpoint..."
SERVICES=$(curl -s "$BASE_URL/health" | grep -o '"services":{[^}]*}' || echo "Unable to parse services")
echo "$SERVICES"

# Cleanup
echo -e "\n${YELLOW}Stopping server...${NC}"
kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true

echo -e "\n${GREEN}Comprehensive testing complete!${NC}"
exit 0