#!/bin/bash

# Quick Functional Test - Key Services Only
API_BASE="http://localhost:8082"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}⚡ Quick Functional Testing Suite${NC}"
echo "=================================="

test_endpoint() {
    local name="$1"
    local url="$2"
    printf "%-40s" "$name..."
    
    response=$(curl -s -w "%{http_code}" "$url")
    http_code="${response: -3}"
    
    if [[ "$http_code" == "200" ]]; then
        echo -e "${GREEN}✅ PASS${NC}"
        return 0
    else
        echo -e "${RED}❌ FAIL ($http_code)${NC}"
        return 1
    fi
}

# Critical service tests
echo -e "\n${YELLOW}🏥 Core Health Services${NC}"
test_endpoint "Basic Health" "$API_BASE/api/health"
test_endpoint "Detailed Health" "$API_BASE/api/v1/health"
test_endpoint "System Readiness" "$API_BASE/api/v1/health/ready"

echo -e "\n${YELLOW}🤖 Agent & Chat Services${NC}"
test_endpoint "Available Agents" "$API_BASE/api/v1/agents/available"
test_endpoint "Agent Status" "$API_BASE/api/v1/agents/status"
test_endpoint "Conversation List" "$API_BASE/api/v1/chat/conversations"

echo -e "\n${YELLOW}🗄️ Data Services${NC}"
test_endpoint "Database Health" "$API_BASE/api/v1/database/health"
test_endpoint "Database Status" "$API_BASE/api/v1/database/status"
test_endpoint "Memory Status" "$API_BASE/api/v1/memory-monitoring/status"

echo -e "\n${YELLOW}🔐 Security Services${NC}"
test_endpoint "Auth Info" "$API_BASE/api/v1/auth/"
test_endpoint "Hardware Devices" "$API_BASE/api/v1/hardware-auth/devices"

echo -e "\n${YELLOW}📰 Content Services${NC}"
test_endpoint "News Service" "$API_BASE/api/v1/news"
test_endpoint "Vision Health" "$API_BASE/api/v1/vision/health"
test_endpoint "Voice Status" "$API_BASE/api/v1/voice/status"

echo -e "\n${YELLOW}🔄 Migration Services${NC}"
test_endpoint "Migration Status" "$API_BASE/migration/status"
test_endpoint "System Metrics" "$API_BASE/metrics"

echo -e "\n${YELLOW}💬 LLM Chat Test (Quick)${NC}"
printf "%-40s" "Intelligent Routing Test..."

chat_response=$(curl -s -X POST "$API_BASE/api/v1/chat/" \
  -H "Content-Type: application/json" \
  -d '{"message":"Quick functional test - respond with just OK"}')

if echo "$chat_response" | jq -e '.success' > /dev/null 2>&1; then
    agent_name=$(echo "$chat_response" | jq -r '.data.fullMessage.metadata.agentName' 2>/dev/null)
    echo -e "${GREEN}✅ PASS${NC} ($agent_name)"
else
    echo -e "${RED}❌ FAIL${NC}"
fi

echo -e "\n${YELLOW}⚡ Quick Test Complete!${NC}"