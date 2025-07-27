#!/bin/bash

# Test Sweet Athena Integration
echo "🧪 Testing Sweet Athena Integration"
echo "==================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Test function
test_component() {
    local name=$1
    local command=$2
    echo -n "Testing $name... "
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASSED${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗ FAILED${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

echo "1. Checking Environment Variables"
echo "---------------------------------"
test_component "PIXEL_STREAMING_URL" "grep -q 'PIXEL_STREAMING_URL' .env"
test_component "SWEET_ATHENA_WEBSOCKET_PORT" "grep -q 'SWEET_ATHENA_WEBSOCKET_PORT' .env"
test_component "UE5_PROJECT_PATH" "grep -q 'UE5_PROJECT_PATH' .env"

echo ""
echo "2. Checking UE5 Project Structure"
echo "---------------------------------"
test_component "UE5 Project Directory" "[ -d ~/UE5-SweetAthena ]"
test_component "UE5 Project File" "[ -f ~/UE5-SweetAthena/SweetAthenaUE5Project.uproject ]"
test_component "Pixel Streaming Script" "[ -f ~/UE5-SweetAthena/Scripts/StartPixelStreaming.sh ]"
test_component "Config Directory" "[ -d ~/UE5-SweetAthena/Config ]"

echo ""
echo "3. Checking Backend Integration"
echo "--------------------------------"
test_component "Sweet Athena Router" "[ -f src/routers/sweet-athena.ts ]"
test_component "WebSocket Service" "[ -f src/services/sweet-athena-websocket.ts ]"
test_component "Integration Service" "[ -f src/services/sweet-athena-integration.ts ]"
test_component "State Manager" "[ -f src/services/sweet-athena-state-manager.ts ]"

echo ""
echo "4. Checking Scripts"
echo "-------------------"
test_component "Launch Script" "[ -x launch-photorealistic-sweet-athena.sh ]"
test_component "Install Script" "[ -x install-ue5-sweet-athena.sh ]"

echo ""
echo "5. Checking Node Modules"
echo "------------------------"
test_component "WebSocket Module" "[ -d node_modules/ws ]"
test_component "Express Module" "[ -d node_modules/express ]"

echo ""
echo "6. Quick API Test"
echo "-----------------"
# Start backend in test mode
echo -n "Starting backend for API test... "
npm run dev > /tmp/test-backend.log 2>&1 &
TEST_PID=$!
sleep 5

# Test API endpoint
if curl -s http://localhost:9999/api/v1/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend started${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    
    # Test Sweet Athena endpoint
    test_component "Sweet Athena API" "curl -s -H 'x-api-key: universal-ai-tools-production-key-2025' http://localhost:9999/api/v1/sweet-athena/status"
else
    echo -e "${RED}✗ Backend failed to start${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Clean up
kill $TEST_PID 2>/dev/null

echo ""
echo "======================================="
echo "Test Results:"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed! Sweet Athena integration is ready.${NC}"
    echo ""
    echo "To launch Sweet Athena:"
    echo "  ./launch-photorealistic-sweet-athena.sh"
else
    echo -e "${YELLOW}⚠️  Some tests failed. Please check the configuration.${NC}"
fi

echo ""
echo "📝 Next Steps:"
echo "1. Ensure UE5.6 is installed via Epic Games Launcher"
echo "2. Open the UE5 project and compile shaders (first time only)"
echo "3. Run: ./launch-photorealistic-sweet-athena.sh"
echo "4. Open the viewer in your browser"