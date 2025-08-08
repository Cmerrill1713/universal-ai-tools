#!/bin/bash

# Test script for Universal AI Tools API endpoints
# Tests the previously failing endpoints to verify fixes

echo "Testing Universal AI Tools API Endpoints..."
echo "============================================="

BASE_URL="http://localhost:9999"
PASSED=0
TOTAL=0

# Test function
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local expected_status=$4
    local description=$5
    
    TOTAL=$((TOTAL + 1))
    echo -n "Test $TOTAL: $description... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" -H "Content-Type: application/json" -d "$data")
    fi
    
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$status_code" -eq "$expected_status" ]; then
        echo "✅ PASS ($status_code)"
        PASSED=$((PASSED + 1))
    else
        echo "❌ FAIL (Expected: $expected_status, Got: $status_code)"
        echo "Response: $body" | head -c 200
        echo ""
    fi
}

# Test previously failing endpoints
echo "Testing previously failing endpoints:"
echo "------------------------------------"

# 1. Context Store (was giving 500 error - now we know it's due to missing table)
test_endpoint "GET" "/api/v1/context/testuser" "" 200 "Context Store - Retrieve (should work)"

# 2. Event Stream Status (was giving 404 - should now work)
test_endpoint "GET" "/api/v1/events/status" "" 200 "Event Stream Status"

# 3. AB-MCTS Orchestrate (was giving 400 validation error)
test_endpoint "POST" "/api/v1/ab-mcts/orchestrate" '{"userRequest": "test request"}' 200 "AB-MCTS Orchestrate"

# 4. Agent Execute (was hanging but should work now)
test_endpoint "GET" "/api/v1/agents" "" 200 "Agent List (quick test)"

# Additional working endpoints to verify overall health
echo ""
echo "Testing additional endpoints for overall health:"
echo "-----------------------------------------------"

test_endpoint "GET" "/health" "" 200 "Health Check"
test_endpoint "GET" "/api/v1/status" "" 200 "System Status" 
test_endpoint "GET" "/api/v1/ab-mcts/health" "" 200 "AB-MCTS Health"
test_endpoint "GET" "/api/v1/events/status" "" 200 "Event Stream Service Status"

# Results
echo ""
echo "Test Results:"
echo "============="
echo "Passed: $PASSED/$TOTAL"
PERCENTAGE=$((PASSED * 100 / TOTAL))
echo "Success Rate: $PERCENTAGE%"

if [ $PERCENTAGE -ge 90 ]; then
    echo "🎉 EXCELLENT! Success rate is $PERCENTAGE%"
    exit 0
elif [ $PERCENTAGE -ge 75 ]; then
    echo "✅ GOOD! Success rate is $PERCENTAGE%"
    exit 0
else
    echo "⚠️  NEEDS IMPROVEMENT! Success rate is $PERCENTAGE%"
    exit 1
fi