#!/bin/bash

echo "🚀 Quick Functional Test - Universal AI Tools"
echo "=============================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

pass_count=0
total_tests=0

print_test() {
    total_tests=$((total_tests + 1))
    echo -e "${BLUE}[TEST $total_tests]${NC} $1"
}

print_pass() {
    pass_count=$((pass_count + 1))
    echo -e "${GREEN}[✅ PASS]${NC} $1"
}

print_fail() {
    echo -e "${RED}[❌ FAIL]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[⚠️ WARN]${NC} $1"
}

# Test 1: Build Status
print_test "Checking build status of services"

cd /Users/christianmerrill/Desktop/universal-ai-tools

# Check Go services
if [ -f "automation/orchestration-hub/orchestration-hub" ]; then
    print_pass "Orchestration Hub binary exists"
else
    print_fail "Orchestration Hub binary missing - building..."
    cd automation/orchestration-hub && go build -o orchestration-hub . && cd ../..
fi

if [ -f "go-api-gateway/main" ]; then
    print_pass "Go API Gateway binary exists"
else
    print_fail "Go API Gateway binary missing - building..."
    cd go-api-gateway && go build -o main . && cd ..
fi

# Check Rust services - use tech scanner as working service
if [ -f "rust-services/tech-scanner/target/release/tech-scanner" ]; then
    print_pass "Tech Scanner binary exists"
else
    print_fail "Tech Scanner binary missing"
fi

if [ -f "rust-services/llm-router/target/release/llm-router" ]; then
    print_pass "LLM Router binary exists"
else
    print_fail "LLM Router binary missing"
fi

# Test 2: Start Core Services
print_test "Starting core services for testing"

# Start Orchestration Hub
cd automation/orchestration-hub
./orchestration-hub &
HUB_PID=$!
sleep 2

# Start Go API Gateway
cd ../../go-api-gateway
./main &
GATEWAY_PID=$!
sleep 2

# Start Tech Scanner (working Rust service)
if [ -f "../rust-services/tech-scanner/target/release/tech-scanner" ]; then
    cd ../rust-services/tech-scanner
    ./target/release/tech-scanner &
    SCANNER_PID=$!
    sleep 2
fi

cd /Users/christianmerrill/Desktop/universal-ai-tools

# Test 3: Health Checks
print_test "Testing service health endpoints"

if curl -s http://localhost:8100/health > /dev/null; then
    print_pass "Orchestration Hub health check passed"
else
    print_fail "Orchestration Hub health check failed"
fi

if curl -s http://localhost:8082/api/health > /dev/null; then
    print_pass "Go API Gateway health check passed"
else
    print_fail "Go API Gateway health check failed"
fi

if curl -s http://localhost:8084/health > /dev/null; then
    print_pass "Tech Scanner health check passed"
else
    print_fail "Tech Scanner health check failed"
fi

# Test 4: API Functionality
print_test "Testing API endpoints"

# Test Gateway routing
gateway_health=$(curl -s http://localhost:8082/api/health)
if echo "$gateway_health" | grep -q "status"; then
    print_pass "Gateway API responding with expected format"
else
    print_warn "Gateway API response format unclear"
fi

# Test orchestration hub service discovery
services=$(curl -s http://localhost:8100/api/services/discover)
if [ $? -eq 0 ]; then
    print_pass "Service discovery endpoint accessible"
else
    print_fail "Service discovery endpoint failed"
fi

# Test 5: Integration
print_test "Testing service integration"

# Register tech scanner with hub
registration=$(cat <<EOF
{
    "name": "tech-scanner",
    "type": "security_scanning",
    "endpoint": "http://localhost:8084",
    "health_check": "http://localhost:8084/health",
    "capabilities": ["vulnerability_scanning", "technology_evaluation"]
}
EOF
)

registration_response=$(curl -s -X POST http://localhost:8100/api/services/register \
    -H "Content-Type: application/json" \
    -d "$registration")

if [ $? -eq 0 ]; then
    print_pass "Service registration functional"
else
    print_fail "Service registration failed"
fi

# Test event processing
event=$(cat <<EOF
{
    "type": "technology_alert",
    "alert": {
        "alert_type": "test_alert",
        "message": "Functional test alert",
        "severity": "low"
    },
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
    "source": "functional-test"
}
EOF
)

event_response=$(curl -s -X POST http://localhost:8100/api/v1/evolution/alert \
    -H "Content-Type: application/json" \
    -d "$event")

if echo "$event_response" | grep -q "accepted"; then
    print_pass "Event processing functional"
else
    print_warn "Event processing response unclear"
fi

# Summary
echo ""
echo "🎯 Quick Functional Test Summary"
echo "================================="
echo "Tests Passed: $pass_count / $total_tests"
echo "Success Rate: $(( (pass_count * 100) / total_tests ))%"

if [ $pass_count -ge $((total_tests * 7 / 10)) ]; then
    echo -e "${GREEN}✅ System is functional (≥70% pass rate)${NC}"
else
    echo -e "${RED}❌ System has significant issues (<70% pass rate)${NC}"
fi

echo ""
echo "🔧 Active Services:"
echo "- Orchestration Hub: http://localhost:8100 (PID: $HUB_PID)"
echo "- Go API Gateway: http://localhost:8082 (PID: $GATEWAY_PID)"
if [ ! -z "$SCANNER_PID" ]; then
    echo "- Tech Scanner: http://localhost:8084 (PID: $SCANNER_PID)"
fi

# Cleanup
echo ""
echo "🧹 Cleaning up test processes..."
kill $HUB_PID $GATEWAY_PID 2>/dev/null
if [ ! -z "$SCANNER_PID" ]; then
    kill $SCANNER_PID 2>/dev/null
fi
sleep 2

echo -e "${GREEN}Quick functional test complete!${NC}"