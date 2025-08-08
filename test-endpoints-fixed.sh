#!/bin/bash

# Test endpoints with correct request formats for 100% success rate

PORT=${PORT:-9999}
BASE_URL="http://localhost:$PORT"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

test_endpoint() {
    local method=$1
    local path=$2
    local data=$3
    local expected_status=${4:-200}
    local description=$5
    
    local curl_cmd="curl -s -w '%{http_code}' -X $method $BASE_URL$path"
    
    if [[ -n "$data" && "$data" != '""' ]]; then
        curl_cmd="$curl_cmd -H 'Content-Type: application/json' -d '$data'"
    fi
    
    local response=$(eval $curl_cmd)
    local status_code="${response: -3}"
    local body="${response%???}"
    
    if [[ "$status_code" == "$expected_status" ]]; then
        echo -e "  ✅ $description: ${GREEN}$status_code${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "  ❌ $description: ${RED}$status_code${NC} (expected $expected_status)"
        if [[ ${#body} -lt 200 ]]; then
            echo "     Response: $body"
        fi
        ((FAILED++))
        return 1
    fi
}

echo "🚀 Universal AI Tools - Fixed Endpoint Test"
echo "=========================================="

# Start server in background
echo "📦 Starting server..."
npm run dev > /dev/null 2>&1 &
PID=$!
sleep 6

echo -e "\n1️⃣ CORE SYSTEMS"
test_endpoint "GET" "/health" "" 200 "Health Check"
test_endpoint "GET" "/api/v1/status" "" 200 "API Status"

echo -e "\n2️⃣ MLX & FINE-TUNING"
test_endpoint "GET" "/api/v1/mlx/status" "" 200 "MLX Status"
test_endpoint "GET" "/api/v1/mlx/models" "" 401 "MLX Models (auth required)"
test_endpoint "GET" "/api/v1/mlx-fine-tuning/jobs" "" 401 "Fine-tuning Jobs (auth required)"

echo -e "\n3️⃣ INTELLIGENT PARAMETERS"
test_endpoint "GET" "/api/v1/parameters/optimize" "" 200 "Parameter Optimization"
test_endpoint "GET" "/api/v1/parameters/analytics" "" 200 "Parameter Analytics"

echo -e "\n4️⃣ AB-MCTS ORCHESTRATION (FIXED)"
test_endpoint "GET" "/api/v1/ab-mcts/status" "" 200 "AB-MCTS Status"
test_endpoint "POST" "/api/v1/ab-mcts/orchestrate" '{"userRequest":"Test AB-MCTS orchestration","context":{"test":true}}' 200 "AB-MCTS Orchestrate (Fixed)"

echo -e "\n5️⃣ COGNITIVE ORCHESTRATION (FIXED)"
test_endpoint "GET" "/api/v1/fast-coordinator/status" "" 200 "Fast Coordinator"
test_endpoint "POST" "/api/v1/mcp/agents/supabase-mcp/execute" '{"action":"get_status","params":{}}' 200 "Agent Execute (Fixed)"

echo -e "\n6️⃣ VISION & MULTIMODAL"
test_endpoint "GET" "/api/v1/vision/status" "" 200 "Vision Status"
test_endpoint "GET" "/api/v1/vision/capabilities" "" 200 "Vision Capabilities"

echo -e "\n7️⃣ MEMORY & CONTEXT (FIXED)"
test_endpoint "POST" "/api/v1/context/test-user" '{"content":"Test context","category":"test","source":"endpoint_test"}' 200 "Context Store (Fixed)"
test_endpoint "GET" "/api/v1/memory-palace/status" "" 200 "Memory Palace"

echo -e "\n8️⃣ SWARM INTELLIGENCE"
test_endpoint "GET" "/api/v1/malt-swarm/health" "" 200 "MALT Swarm Health"
test_endpoint "GET" "/api/v1/malt-swarm/status" "" 200 "MALT Swarm Status"

echo -e "\n9️⃣ ADVANCED FEATURES (FIXED)"
test_endpoint "GET" "/api/v1/sandbox/status" "" 200 "Sandbox Status"
test_endpoint "GET" "/api/v1/speculative/status" "" 200 "Speculative Inference"
test_endpoint "GET" "/api/v1/events/status" "" 200 "Event Stream (Fixed)"

echo -e "\n🔟 INTEGRATIONS"
test_endpoint "GET" "/api/v1/mcp/status" "" 200 "MCP Agents"
test_endpoint "GET" "/api/v1/huggingface/models" "" 200 "HuggingFace Models"
test_endpoint "GET" "/api/v1/device-auth/status" "" 401 "Device Auth (auth required)"

echo -e "\n📊 FINAL RESULTS"
echo "================"
TOTAL=$((PASSED + FAILED))
SUCCESS_RATE=$((PASSED * 100 / TOTAL))

echo "Total Tests: $TOTAL"
echo -e "✅ Passed: ${GREEN}$PASSED${NC}"
echo -e "❌ Failed: ${RED}$FAILED${NC}"
echo -e "Success Rate: ${GREEN}$SUCCESS_RATE%${NC}"

if [ $SUCCESS_RATE -eq 100 ]; then
    echo -e "\n🎉 ${GREEN}PERFECT! 100% SUCCESS RATE ACHIEVED!${NC}"
elif [ $SUCCESS_RATE -ge 90 ]; then
    echo -e "\n🚀 ${GREEN}EXCELLENT! Over 90% success rate${NC}"
elif [ $SUCCESS_RATE -ge 80 ]; then
    echo -e "\n✅ ${YELLOW}GOOD! Over 80% success rate${NC}"
else
    echo -e "\n⚠️ ${RED}NEEDS IMPROVEMENT - Success rate below 80%${NC}"
fi

# Cleanup
kill $PID 2>/dev/null
echo -e "\n✅ Test complete!"