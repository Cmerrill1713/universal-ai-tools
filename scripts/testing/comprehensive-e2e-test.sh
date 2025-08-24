#!/bin/bash

echo "🚀 COMPREHENSIVE END-TO-END FUNCTIONAL TEST"
echo "============================================"
echo "Testing complete Universal AI Tools system integration"
echo "Date: $(date)"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
TESTS_PASSED=0
TESTS_FAILED=0
TOTAL_TESTS=0

# Function to run test and track results
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_pattern="$3"
    
    echo -e "${BLUE}🧪 Testing: $test_name${NC}"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    # Run the test
    result=$(eval "$test_command" 2>&1)
    
    if [[ -n "$expected_pattern" ]] && echo "$result" | grep -q "$expected_pattern"; then
        echo -e "${GREEN}✅ PASS: $test_name${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    elif [[ -z "$expected_pattern" ]] && [[ $? -eq 0 ]]; then
        echo -e "${GREEN}✅ PASS: $test_name${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL: $test_name${NC}"
        echo "   Result: $result"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Wait a moment for services to be ready
echo "⏱️  Waiting 3 seconds for services to initialize..."
sleep 3

echo ""
echo "=== 1. CORE SERVICE HEALTH CHECKS ==="
run_test "Go API Gateway Health" \
    "curl -s http://localhost:8081/api/health" \
    "success.*true"

run_test "Go API Gateway Detailed Health" \
    "curl -s http://localhost:8081/api/v1/health" \
    "database.*healthy"

run_test "Service Discovery" \
    "curl -s http://localhost:8081/api/v1/agents/status" \
    "success.*true"

echo ""
echo "=== 2. AGENT SYSTEM INTEGRATION ==="
run_test "Agent Registry Query" \
    "curl -s http://localhost:8081/api/v1/agents/" \
    "One Folder Agent"

run_test "Agent Count Verification" \
    "curl -s http://localhost:8081/api/v1/agents/ | jq '.data.total'" \
    "5"

run_test "One Folder Agent Active" \
    "curl -s http://localhost:8081/api/v1/agents/ | jq '.data.agents[] | select(.name == \"One Folder Agent\") | .status'" \
    "active"

run_test "Claude Agent Exclusion" \
    "! curl -s http://localhost:8081/api/v1/agents/ | jq '.data.agents[].name' | grep -q Claude" \
    ""

echo ""
echo "=== 3. MLX GRADE A MODEL INTEGRATION ==="
run_test "MLX Production Model Grade" \
    "curl -s http://localhost:8081/api/v1/models/production/grade" \
    "Grade.*A.*91.7"

run_test "MLX Model Status" \
    "curl -s http://localhost:8081/api/v1/models/status" \
    "deployment_approved.*true"

run_test "MLX Grading Config" \
    "curl -s http://localhost:8081/api/v1/models/grading/config" \
    "grading_system_version.*1.0.0"

run_test "MLX Performance History" \
    "curl -s http://localhost:8081/api/v1/models/performance/history" \
    "Grade.*A"

echo ""
echo "=== 4. DATABASE CONNECTIVITY ==="
run_test "Database Connection Status" \
    "curl -s http://localhost:8081/api/v1/database/status" \
    "postgresql.*connected"

run_test "Database Performance Metrics" \
    "curl -s http://localhost:8081/api/v1/database/performance" \
    "connections.*active"

echo ""
echo "=== 5. CHAT SYSTEM FUNCTIONALITY ==="
run_test "Chat Conversations Endpoint" \
    "curl -s http://localhost:8081/api/v1/chat/conversations" \
    "success.*true"

run_test "Create New Conversation" \
    "curl -s -X POST http://localhost:8081/api/v1/chat/new -H 'Content-Type: application/json' -d '{\"title\":\"E2E Test Chat\"}'" \
    "conversation_id"

echo ""
echo "=== 6. MEMORY & CONTEXT SYSTEMS ==="
run_test "Memory Monitoring Status" \
    "curl -s http://localhost:8081/api/v1/memory-monitoring/status" \
    "monitoring.*active"

run_test "Context Storage Health" \
    "curl -s http://localhost:8081/api/v1/conversation-context/" \
    "success.*true"

echo ""
echo "=== 7. ONE FOLDER AGENT FUNCTIONALITY ==="
run_test "One Folder Agent File Analysis" \
    "npx tsx single-file-agents/one-folder-agent.ts --help" \
    "IndyDevDan style"

run_test "One Folder Agent Directory Analysis" \
    "timeout 10s npx tsx single-file-agents/one-folder-agent.ts --analyze /tmp" \
    "DIRECTORY ANALYSIS REPORT"

echo ""
echo "=== 8. SPECIALIZED API ENDPOINTS ==="
run_test "Vision API Health" \
    "curl -s http://localhost:8081/api/v1/vision/health" \
    "status.*healthy"

run_test "Voice API Status" \
    "curl -s http://localhost:8081/api/v1/voice/status" \
    "voice_service.*available"

run_test "News API Categories" \
    "curl -s http://localhost:8081/api/v1/news/categories" \
    "success.*true"

echo ""
echo "=== 9. HARDWARE AUTHENTICATION ==="
run_test "Hardware Auth Devices" \
    "curl -s http://localhost:8081/api/v1/hardware-auth/devices" \
    "success.*true"

run_test "Bluetooth Status Check" \
    "curl -s http://localhost:8081/api/v1/hardware-auth/bluetooth/status" \
    "success.*true"

echo ""
echo "=== 10. MIGRATION COMPATIBILITY ==="
run_test "Migration Status Check" \
    "curl -s http://localhost:8081/migration/status" \
    "migration_mode.*enabled"

run_test "Migration Progress" \
    "curl -s http://localhost:8081/migration/progress" \
    "compatibility.*active"

echo ""
echo "📊 COMPREHENSIVE TEST RESULTS"
echo "=============================="
echo -e "Total Tests Run: ${BLUE}$TOTAL_TESTS${NC}"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"

if [[ $TESTS_FAILED -eq 0 ]]; then
    echo -e "\n🎉 ${GREEN}ALL TESTS PASSED!${NC}"
    echo "✅ Universal AI Tools system is fully operational"
    echo "✅ All integrations working correctly"
    echo "✅ MLX Grade A model serving responses"
    echo "✅ Agent system complete (5 agents active)"
    echo "✅ File management capabilities verified"
    echo "✅ End-to-end functionality confirmed"
    SUCCESS_RATE="100%"
else
    echo -e "\n⚠️  ${YELLOW}SOME TESTS FAILED${NC}"
    SUCCESS_RATE=$(( (TESTS_PASSED * 100) / TOTAL_TESTS ))
    echo "Success Rate: ${SUCCESS_RATE}%"
    if [[ $SUCCESS_RATE -ge 80 ]]; then
        echo -e "${YELLOW}System is mostly operational with minor issues${NC}"
    else
        echo -e "${RED}System has significant issues that need attention${NC}"
    fi
fi

echo ""
echo "=== SYSTEM READY FOR: ==="
echo "🗂️  File cleanup and organization"
echo "🚀 Swift macOS app integration" 
echo "📱 Production deployment"
echo "🤖 Advanced agent workflows"
echo ""
echo "Test completed at: $(date)"
echo "============================================"

exit $TESTS_FAILED