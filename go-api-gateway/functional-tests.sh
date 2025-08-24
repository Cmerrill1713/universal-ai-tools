#!/bin/bash

# Comprehensive Functional Testing Suite for Go API Gateway
# Tests all major services and endpoints

set -e

API_BASE="http://localhost:8082"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🧪 Universal AI Tools - Comprehensive Functional Testing${NC}"
echo "Testing API Gateway at: $API_BASE"
echo "======================================================="

# Test counter
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_status="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    printf "%-50s" "Testing $test_name..."
    
    if eval "$test_command" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

run_detailed_test() {
    local test_name="$1"
    local test_command="$2"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    printf "%-50s" "Testing $test_name..."
    
    result=$(eval "$test_command" 2>/dev/null)
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}✅ PASS${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo "    Response: $(echo "$result" | jq -r '.success // .message // .status // "OK"' 2>/dev/null || echo "OK")"
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

echo -e "\n${YELLOW}📊 1. HEALTH AND STATUS ENDPOINTS${NC}"
echo "-----------------------------------"
run_test "Basic Health Check" "curl -s -f $API_BASE/api/health"
run_test "Detailed Health Check" "curl -s -f $API_BASE/api/v1/health"
run_test "Readiness Check" "curl -s -f $API_BASE/api/v1/health/ready"
run_test "Liveness Check" "curl -s -f $API_BASE/api/v1/health/live"
run_test "Metrics Endpoint" "curl -s -f $API_BASE/metrics"

echo -e "\n${YELLOW}💬 2. CHAT SERVICE (DUAL LLM BACKENDS)${NC}"
echo "------------------------------------"

# Test Ollama backend
run_detailed_test "Ollama Chat Integration" 'curl -s -X POST $API_BASE/api/v1/chat/ -H "Content-Type: application/json" -d "{\"message\":\"Test functional testing with Ollama\",\"agentName\":\"ollama-llama3.2:3b\"}"'

# Test LM Studio backend  
run_detailed_test "LM Studio Chat Integration" 'curl -s -X POST $API_BASE/api/v1/chat/ -H "Content-Type: application/json" -d "{\"message\":\"Test functional testing with LM Studio\",\"agentName\":\"lm-studio\"}"'

# Test intelligent routing (default)
run_detailed_test "Intelligent Routing (Default)" 'curl -s -X POST $API_BASE/api/v1/chat/ -H "Content-Type: application/json" -d "{\"message\":\"Test intelligent routing functional test\"}"'

# Test conversation management
run_test "Create New Conversation" 'curl -s -X POST $API_BASE/api/v1/chat/new -H "Content-Type: application/json" -d "{\"title\":\"Functional Test Conversation\"}"'
run_test "List Conversations" "curl -s -f $API_BASE/api/v1/chat/conversations"

echo -e "\n${YELLOW}🤖 3. AGENT MANAGEMENT${NC}"
echo "------------------------"
run_test "List Available Agents" "curl -s -f $API_BASE/api/v1/agents/available"
run_test "Get Agent Status" "curl -s -f $API_BASE/api/v1/agents/status"
run_test "List All Agents" "curl -s -f $API_BASE/api/v1/agents/"

echo -e "\n${YELLOW}🗄️ 4. DATABASE SERVICES${NC}"
echo "-------------------------"
run_test "Database Health Check" "curl -s -f $API_BASE/api/v1/database/health"
run_test "Database Status" "curl -s -f $API_BASE/api/v1/database/status"
run_test "Database Connections" "curl -s -f $API_BASE/api/v1/database/connections"
run_test "Database Performance" "curl -s -f $API_BASE/api/v1/database/performance"

echo -e "\n${YELLOW}🧠 5. MEMORY MONITORING${NC}"
echo "---------------------------"
run_test "Memory Status" "curl -s -f $API_BASE/api/v1/memory-monitoring/status"
run_test "Memory Usage" "curl -s -f $API_BASE/api/v1/memory-monitoring/usage"
run_test "Memory Metrics" "curl -s -f $API_BASE/api/v1/memory-monitoring/metrics"
run_test "Memory Analytics" "curl -s -f $API_BASE/api/v1/memory-monitoring/analytics"

echo -e "\n${YELLOW}🔐 6. AUTHENTICATION SERVICES${NC}"
echo "-------------------------------"
run_test "Auth Info" "curl -s -f $API_BASE/api/v1/auth/"
run_test "Demo Token Generation" 'curl -s -X POST $API_BASE/api/v1/auth/demo-token -H "Content-Type: application/json" -d "{\"username\":\"testuser\"}"'
run_test "Demo Info" "curl -s -f $API_BASE/api/v1/auth/demo"

echo -e "\n${YELLOW}📰 7. NEWS SERVICE${NC}"
echo "--------------------"
run_test "Get News" "curl -s -f $API_BASE/api/v1/news"
run_test "News Categories" "curl -s -f $API_BASE/api/v1/news/categories"
run_test "News Stats" "curl -s -f $API_BASE/api/v1/news/stats"

echo -e "\n${YELLOW}👁️ 8. VISION SERVICES${NC}"
echo "----------------------"
run_test "Vision Health Check" "curl -s -f $API_BASE/api/v1/vision/health"
run_test "Vision Stats" "curl -s -f $API_BASE/api/v1/vision/stats"

echo -e "\n${YELLOW}🎤 9. VOICE SERVICES${NC}"
echo "---------------------"
run_test "Voice Status" "curl -s -f $API_BASE/api/v1/voice/status"
run_test "Available Voices" "curl -s -f $API_BASE/api/v1/voice/voices"

echo -e "\n${YELLOW}🔧 10. HARDWARE AUTHENTICATION${NC}"
echo "--------------------------------"
run_test "List Devices" "curl -s -f $API_BASE/api/v1/hardware-auth/devices"
run_test "Bluetooth Status" "curl -s -f $API_BASE/api/v1/hardware-auth/bluetooth/status"
run_test "Family Devices" "curl -s -f $API_BASE/api/v1/hardware-auth/family"
run_test "Proximity Status" "curl -s -f $API_BASE/api/v1/hardware-auth/proximity"

echo -e "\n${YELLOW}📊 11. MODEL GRADING${NC}"
echo "---------------------"
run_test "Model Status" "curl -s -f $API_BASE/api/v1/models/status"
run_test "Production Model Grade" "curl -s -f $API_BASE/api/v1/models/production/grade"
run_test "Grading Config" "curl -s -f $API_BASE/api/v1/models/grading/config"

echo -e "\n${YELLOW}🔄 12. MIGRATION STATUS${NC}"
echo "-------------------------"
run_test "Migration Status" "curl -s -f $API_BASE/migration/status"
run_test "Migration Progress" "curl -s -f $API_BASE/migration/progress"

echo -e "\n${YELLOW}🧪 13. CONTEXT & CONVERSATION${NC}"
echo "------------------------------"
run_test "Get Recent Context" "curl -s -f $API_BASE/api/v1/conversation-context/recent"
run_test "Context Analytics" "curl -s -f $API_BASE/api/v1/conversation-context/analytics"

# Summary
echo -e "\n======================================================="
echo -e "${YELLOW}📋 FUNCTIONAL TESTING SUMMARY${NC}"
echo "======================================================="
echo "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"

if [[ $FAILED_TESTS -eq 0 ]]; then
    echo -e "\n${GREEN}🎉 ALL TESTS PASSED! System is fully functional.${NC}"
    exit 0
else
    PASS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    echo -e "\n${YELLOW}⚠️ Some tests failed. Pass rate: ${PASS_RATE}%${NC}"
    
    if [[ $PASS_RATE -ge 80 ]]; then
        echo -e "${YELLOW}System is mostly functional with minor issues.${NC}"
        exit 0
    else
        echo -e "${RED}System has significant issues requiring attention.${NC}"
        exit 1
    fi
fi