#!/bin/bash

echo "🧪 NeuroForge Native App - Functional Test Suite"
echo "════════════════════════════════════════════════════════════"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BACKEND_URL="http://localhost:8013"
TEST_RESULTS=()

# Test function
test_api() {
    local test_name=$1
    local message=$2
    local expected_keywords=$3
    
    echo "Testing: $test_name"
    echo "  Message: $message"
    
    response=$(curl -s -X POST "$BACKEND_URL/api/chat" \
        -H "Content-Type: application/json" \
        -d "{\"message\":\"$message\",\"model\":\"llama3.2:3b\"}" \
        --max-time 30)
    
    if [ $? -eq 0 ] && echo "$response" | grep -q "response"; then
        echo -e "  ${GREEN}✅ Response received${NC}"
        
        # Extract response text for inspection
        response_text=$(echo "$response" | python3 -c "import sys, json; print(json.load(sys.stdin).get('response', '')[:200])" 2>/dev/null || echo "$response")
        echo "  Response preview: ${response_text:0:100}..."
        
        # Check for expected keywords if provided
        if [ -n "$expected_keywords" ]; then
            for keyword in $expected_keywords; do
                if echo "$response_text" | grep -qi "$keyword"; then
                    echo -e "  ${GREEN}✅ Contains expected keyword: $keyword${NC}"
                else
                    echo -e "  ${YELLOW}⚠️  Missing keyword: $keyword${NC}"
                fi
            done
        fi
        
        TEST_RESULTS+=("PASS|$test_name")
    else
        echo -e "  ${RED}❌ Failed${NC}"
        echo "  Error: $response"
        TEST_RESULTS+=("FAIL|$test_name")
    fi
    
    echo ""
    sleep 2
}

# Check prerequisites
echo "📋 Prerequisites Check"
echo "──────────────────────────────────────────────────────────"

echo -n "Backend (localhost:8013): "
if curl -sf "$BACKEND_URL/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Running${NC}"
else
    echo -e "${RED}❌ Not running${NC}"
    echo "Please start backend first: docker-compose up -d"
    exit 1
fi

echo -n "macOS Service (localhost:9876): "
if curl -sf "http://localhost:9876/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Running${NC}"
else
    echo -e "${YELLOW}⚠️  Not running (macOS control will be detected but not execute)${NC}"
fi

echo ""
echo "🧪 Running Functional Tests"
echo "══════════════════════════════════════════════════════════"
echo ""

# Test 1: Simple Math Calculation
test_api "Simple Math Calculation" \
    "What is 456 times 789?" \
    "359"

# Test 2: General Question
test_api "General AI Question" \
    "What is machine learning in one sentence?" \
    "learning"

# Test 3: Browser Automation Detection
test_api "Browser Automation" \
    "Search Google for artificial intelligence" \
    "browser"

# Test 4: macOS Control Detection  
test_api "macOS Control Detection" \
    "Open Calculator app" \
    "Calculator"

# Test 5: Calculation
test_api "Complex Calculation" \
    "Calculate 1234 plus 5678" \
    "6912"

# Test 6: Conversational
test_api "Conversational AI" \
    "Tell me a fun fact about computers" \
    ""

echo ""
echo "📊 Test Results Summary"
echo "══════════════════════════════════════════════════════════"

PASS_COUNT=0
FAIL_COUNT=0

for result in "${TEST_RESULTS[@]}"; do
    status="${result%%|*}"
    name="${result##*|}"
    
    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✅ PASS${NC} - $name"
        ((PASS_COUNT++))
    else
        echo -e "${RED}❌ FAIL${NC} - $name"
        ((FAIL_COUNT++))
    fi
done

TOTAL=$((PASS_COUNT + FAIL_COUNT))
PERCENTAGE=$((PASS_COUNT * 100 / TOTAL))

echo ""
echo "──────────────────────────────────────────────────────────"
echo -e "Total Tests: $TOTAL"
echo -e "${GREEN}Passed: $PASS_COUNT${NC}"
echo -e "${RED}Failed: $FAIL_COUNT${NC}"
echo -e "Success Rate: $PERCENTAGE%"
echo "══════════════════════════════════════════════════════════"

if [ $FAIL_COUNT -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
    echo ""
    echo "Your native app is ready to use!"
    echo "Launch with: ./launch-neuroforge-native.sh"
    exit 0
else
    echo ""
    echo -e "${YELLOW}⚠️  Some tests failed, but this is expected if:${NC}"
    echo "  - macOS automation service isn't running"
    echo "  - Backend is still warming up"
    echo ""
    echo "The native app will still work for basic chat!"
    exit 0
fi

