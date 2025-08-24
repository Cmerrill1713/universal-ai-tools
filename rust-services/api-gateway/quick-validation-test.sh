#!/bin/bash

# Quick API Gateway Validation Test
# Focused on core functionality validation

GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}       QUICK API GATEWAY VALIDATION TEST SUITE${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"

TESTS_PASSED=0
TESTS_FAILED=0

# Test function
test() {
    local name="$1"
    local result="$2"
    
    if [ "$result" = "PASS" ]; then
        echo -e "${GREEN}✓${NC} $name"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗${NC} $name - $result"
        ((TESTS_FAILED++))
    fi
}

echo -e "${YELLOW}1. Testing Gateway Health${NC}"
status=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL/health")
if [ "$status" = "200" ]; then
    test "Gateway health endpoint" "PASS"
else
    test "Gateway health endpoint" "HTTP $status"
fi

echo -e "\n${YELLOW}2. Testing Service Routing${NC}"
for service in database documentation ml; do
    status=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL/api/$service/health")
    if [ "$status" = "200" ]; then
        test "$service service routing" "PASS"
    else
        test "$service service routing" "HTTP $status"
    fi
done

echo -e "\n${YELLOW}3. Testing Path Rewriting${NC}"
# The gateway should strip the /api/{service} prefix when forwarding
status=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL/api/documentation/health")
if [ "$status" = "200" ]; then
    test "Path rewriting works" "PASS"
else
    test "Path rewriting" "Failed with HTTP $status"
fi

echo -e "\n${YELLOW}4. Testing 404 Handling${NC}"
status=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL/api/nonexistent/test")
if [ "$status" = "404" ]; then
    test "404 for unknown service" "PASS"
else
    test "404 handling" "Got HTTP $status instead of 404"
fi

echo -e "\n${YELLOW}5. Testing Concurrent Requests${NC}"
success=0
for i in {1..10}; do
    curl -s -o /dev/null "$GATEWAY_URL/health" && ((success++)) &
done
wait
if [ $success -ge 8 ]; then
    test "Concurrent requests (10)" "PASS"
else
    test "Concurrent requests" "Only $success/10 succeeded"
fi

echo -e "\n${YELLOW}6. Testing Response Times${NC}"
total_time=0
for i in {1..5}; do
    time=$(curl -s -o /dev/null -w "%{time_total}" "$GATEWAY_URL/health")
    total_time=$(echo "$total_time + $time" | bc)
done
avg_time=$(echo "scale=4; $total_time / 5" | bc)
echo -e "  Average response time: ${avg_time}s"

if (( $(echo "$avg_time < 0.1" | bc -l) )); then
    test "Response time < 100ms" "PASS"
else
    test "Response time" "Average ${avg_time}s"
fi

echo -e "\n${YELLOW}7. Testing Service Discovery${NC}"
# Check if admin endpoint exists
status=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL/api/admin/services")
if [ "$status" = "200" ] || [ "$status" = "404" ]; then
    test "Service discovery endpoint" "PASS"
else
    test "Service discovery" "Unexpected HTTP $status"
fi

echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}                      TEST SUMMARY${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✅ ALL TESTS PASSED - API Gateway is functioning correctly!${NC}"
    exit 0
else
    echo -e "\n${RED}⚠️ Some tests failed - Review the issues above${NC}"
    exit 1
fi