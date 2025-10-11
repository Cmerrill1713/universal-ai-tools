#!/bin/bash

# Universal AI Tools - Playwright MCP Setup Test Script
# Verifies that the Playwright MCP frontend testing setup is working correctly

echo "🧪 Testing Playwright MCP Frontend Setup..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"

    echo -e "${BLUE}🔍 Testing: $test_name${NC}"

    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS: $test_name${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ FAIL: $test_name${NC}"
        ((TESTS_FAILED++))
    fi
}

echo -e "${BLUE}📋 Running Playwright MCP Setup Tests...${NC}"
echo ""

# Test 1: Check if required files exist
run_test "MCP Configuration File" "[ -f 'mcp-config.json' ]"
run_test "Web Frontend Config" "[ -f 'playwright-web-frontend.config.ts' ]"
run_test "Swift Frontend Config" "[ -f 'playwright-swift-mcp.config.ts' ]"
run_test "Web Frontend Tests" "[ -f 'tests/web-frontend-tests.spec.ts' ]"
run_test "Swift Frontend Tests" "[ -f 'tests/swift-frontend-tests.spec.ts' ]"
run_test "Startup Script" "[ -f 'start-frontend-tests.sh' ]"
run_test "Documentation" "[ -f 'PLAYWRIGHT_MCP_FRONTEND_SETUP.md' ]"

# Test 2: Check if directories exist
run_test "Web Frontend Directory" "[ -d 'web-frontend' ]"
run_test "Swift Companion App Directory" "[ -d 'swift-companion-app' ]"
run_test "Tests Directory" "[ -d 'tests' ]"

# Test 3: Check if web frontend files exist
run_test "Web Frontend HTML" "[ -f 'web-frontend/index.html' ]"

# Test 4: Check if Swift package exists
run_test "Swift Package File" "[ -f 'swift-companion-app/Package.swift' ]"

# Test 5: Check if Node.js dependencies are installed
run_test "Node Modules" "[ -d 'node_modules' ]"
run_test "Playwright Package" "[ -d 'node_modules/@playwright' ]"

# Test 6: Check if package.json has required scripts
run_test "Package.json Scripts" "grep -q 'test:web-frontend' package.json"
run_test "Package.json Scripts" "grep -q 'test:swift-frontend' package.json"
run_test "Package.json Scripts" "grep -q 'test:all-frontends' package.json"

# Test 7: Check if startup script is executable
run_test "Startup Script Executable" "[ -x 'start-frontend-tests.sh' ]"

# Test 8: Check if MCP config has required servers
run_test "MCP Playwright Server" "grep -q 'playwright' mcp-config.json"
run_test "MCP Web Frontend Server" "grep -q 'playwright-web-frontend' mcp-config.json"
run_test "MCP Swift Frontend Server" "grep -q 'playwright-swift-frontend' mcp-config.json"

# Test 9: Check if test files have proper imports
run_test "Web Frontend Test Imports" "grep -q 'import.*playwright' tests/web-frontend-tests.spec.ts"
run_test "Swift Frontend Test Imports" "grep -q 'import.*playwright' tests/swift-frontend-tests.spec.ts"

# Test 10: Check if setup files exist
run_test "Web Frontend Setup" "[ -f 'tests/web-frontend-setup.ts' ]"
run_test "Web Frontend Teardown" "[ -f 'tests/web-frontend-teardown.ts' ]"
run_test "Swift Frontend Setup" "[ -f 'tests/swift-frontend-setup.ts' ]"
run_test "Swift Frontend Teardown" "[ -f 'tests/swift-frontend-teardown.ts' ]"

echo ""
echo -e "${BLUE}📊 Test Results Summary:${NC}"
echo -e "${GREEN}✅ Tests Passed: $TESTS_PASSED${NC}"
echo -e "${RED}❌ Tests Failed: $TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 All tests passed! Playwright MCP Frontend Setup is ready!${NC}"
    echo ""
    echo -e "${BLUE}🚀 Next Steps:${NC}"
    echo -e "   1. Start the testing environment: ${GREEN}./start-frontend-tests.sh${NC}"
    echo -e "   2. Run web frontend tests: ${GREEN}npm run test:web-frontend${NC}"
    echo -e "   3. Run Swift frontend tests: ${GREEN}npm run test:swift-frontend${NC}"
    echo -e "   4. Run all frontend tests: ${GREEN}npm run test:all-frontends${NC}"
    echo ""
    echo -e "${BLUE}📚 Documentation:${NC}"
    echo -e "   - Setup Guide: ${GREEN}PLAYWRIGHT_MCP_FRONTEND_SETUP.md${NC}"
    echo -e "   - MCP Setup: ${GREEN}MCP-SETUP.md${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}❌ Some tests failed. Please check the setup and try again.${NC}"
    echo ""
    echo -e "${BLUE}🔧 Troubleshooting:${NC}"
    echo -e "   1. Run: ${YELLOW}npm install${NC}"
    echo -e "   2. Run: ${YELLOW}npm run test:install-browsers${NC}"
    echo -e "   3. Check file permissions: ${YELLOW}chmod +x start-frontend-tests.sh${NC}"
    echo -e "   4. Verify project structure"
    exit 1
fi
