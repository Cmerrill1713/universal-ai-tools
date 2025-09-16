#!/bin/bash

# Project Manager Integration Test Runner
# Comprehensive validation of Universal AI Tools ecosystem integration

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
TEST_TIMEOUT=${TEST_TIMEOUT:-60000}
SERVER_URL=${SERVER_URL:-"http://localhost:9999"}
INTEGRATION_TEST_LOG="integration-test-$(date +%Y%m%d-%H%M%S).log"

echo -e "${BLUE}🚀 Universal AI Tools - Project Manager Integration Test${NC}"
echo -e "${BLUE}================================================================${NC}"
echo "Test Configuration:"
echo "  Server URL: $SERVER_URL"
echo "  Timeout: ${TEST_TIMEOUT}ms"
echo "  Log File: $INTEGRATION_TEST_LOG"
echo ""

# Function to check if server is running
check_server() {
    echo -e "${YELLOW}🔍 Checking server availability...${NC}"
    
    if curl -s -f "$SERVER_URL/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Server is running and healthy${NC}"
        
        # Get server info
        SERVER_INFO=$(curl -s "$SERVER_URL/health" | jq -r '.version // "unknown"' 2>/dev/null || echo "unknown")
        echo "  Server Version: $SERVER_INFO"
        
        # Check agent registry
        AGENTS=$(curl -s "$SERVER_URL/api/v1/agents" | jq -r '.data.total // 0' 2>/dev/null || echo "0")
        echo "  Available Agents: $AGENTS"
        
        return 0
    else
        echo -e "${RED}❌ Server is not running or not healthy${NC}"
        echo "Please start the server with: npm run dev"
        return 1
    fi
}

# Function to validate dependencies
check_dependencies() {
    echo -e "${YELLOW}🔍 Checking dependencies...${NC}"
    
    # Check Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        echo -e "${GREEN}✅ Node.js: $NODE_VERSION${NC}"
    else
        echo -e "${RED}❌ Node.js not found${NC}"
        return 1
    fi
    
    # Check npm
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        echo -e "${GREEN}✅ npm: $NPM_VERSION${NC}"
    else
        echo -e "${RED}❌ npm not found${NC}"
        return 1
    fi
    
    # Check tsx
    if command -v tsx &> /dev/null || npm list -g tsx &> /dev/null || [ -f "node_modules/.bin/tsx" ]; then
        echo -e "${GREEN}✅ tsx is available${NC}"
    else
        echo -e "${RED}❌ tsx not found${NC}"
        echo "Installing tsx..."
        npm install -g tsx || npm install tsx
    fi
    
    # Check if integration test file exists
    if [ -f "test-project-manager-integration.ts" ]; then
        echo -e "${GREEN}✅ Integration test file found${NC}"
    else
        echo -e "${RED}❌ Integration test file not found${NC}"
        return 1
    fi
}

# Function to validate environment
check_environment() {
    echo -e "${YELLOW}🔍 Checking environment configuration...${NC}"
    
    # Check for .env file
    if [ -f ".env" ]; then
        echo -e "${GREEN}✅ .env file found${NC}"
    else
        echo -e "${YELLOW}⚠️ .env file not found (using environment variables)${NC}"
    fi
    
    # Check critical environment variables
    if [ -n "$SUPABASE_URL" ] || grep -q "SUPABASE_URL" .env 2>/dev/null; then
        echo -e "${GREEN}✅ SUPABASE_URL configured${NC}"
    else
        echo -e "${YELLOW}⚠️ SUPABASE_URL not configured (some tests may be skipped)${NC}"
    fi
    
    if [ -n "$REDIS_URL" ] || grep -q "REDIS_URL" .env 2>/dev/null; then
        echo -e "${GREEN}✅ REDIS_URL configured${NC}"
    else
        echo -e "${YELLOW}⚠️ REDIS_URL not configured (caching tests may be skipped)${NC}"
    fi
}

# Function to run pre-test validation
pre_test_validation() {
    echo -e "${BLUE}🧪 Running pre-test validation...${NC}"
    
    # Test basic API endpoints
    echo "Testing core endpoints..."
    
    if curl -s -f "$SERVER_URL/api/v1/agents" > /dev/null; then
        echo -e "${GREEN}  ✅ Agent Registry API${NC}"
    else
        echo -e "${RED}  ❌ Agent Registry API${NC}"
    fi
    
    if curl -s -f "$SERVER_URL/api/v1/monitoring/status" > /dev/null; then
        echo -e "${GREEN}  ✅ Monitoring API${NC}"
    else
        echo -e "${YELLOW}  ⚠️ Monitoring API (may not be critical)${NC}"
    fi
    
    # Test agent execution
    echo "Testing agent execution..."
    AGENT_TEST_RESULT=$(curl -s -X POST "$SERVER_URL/api/v1/agents/execute" \
        -H "Content-Type: application/json" \
        -H "X-API-Key: integration-test-key" \
        -H "X-AI-Service: integration-test" \
        -d '{"agentName": "planner", "userRequest": "Test connectivity"}' \
        --max-time 10 || echo "FAILED")
    
    if [[ "$AGENT_TEST_RESULT" == *"success"* ]]; then
        echo -e "${GREEN}  ✅ Agent Execution API${NC}"
    else
        echo -e "${YELLOW}  ⚠️ Agent Execution API (may affect some tests)${NC}"
    fi
}

# Function to run the integration test
run_integration_test() {
    echo -e "${BLUE}🎯 Running Project Manager Integration Test...${NC}"
    echo "Logging to: $INTEGRATION_TEST_LOG"
    echo ""
    
    # Set environment variables for test
    export INTEGRATION_TIMEOUT="$TEST_TIMEOUT"
    export TEST_BASE_URL="$SERVER_URL"
    export NODE_ENV="test"
    
    # Run the integration test with timeout and logging
    if timeout $((TEST_TIMEOUT / 1000)) tsx test-project-manager-integration.ts 2>&1 | tee "$INTEGRATION_TEST_LOG"; then
        TEST_EXIT_CODE=0
    else
        TEST_EXIT_CODE=$?
    fi
    
    return $TEST_EXIT_CODE
}

# Function to analyze test results
analyze_results() {
    local exit_code=$1
    
    echo ""
    echo -e "${BLUE}📊 Test Results Analysis${NC}"
    echo -e "${BLUE}========================${NC}"
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}🎉 Integration Test PASSED${NC}"
        
        # Extract key metrics from log
        if [ -f "$INTEGRATION_TEST_LOG" ]; then
            TOTAL_TESTS=$(grep -c "PASS\|FAIL\|SKIP" "$INTEGRATION_TEST_LOG" || echo "N/A")
            PASSED_TESTS=$(grep -c "PASS" "$INTEGRATION_TEST_LOG" || echo "N/A")
            FAILED_TESTS=$(grep -c "FAIL" "$INTEGRATION_TEST_LOG" || echo "N/A")
            
            echo "Test Summary:"
            echo "  Total Tests: $TOTAL_TESTS"
            echo "  Passed: $PASSED_TESTS"
            echo "  Failed: $FAILED_TESTS"
            
            # Check for integration status
            if grep -q "FULLY INTEGRATED" "$INTEGRATION_TEST_LOG"; then
                echo -e "${GREEN}  ✅ Project Manager is FULLY INTEGRATED with ecosystem${NC}"
            elif grep -q "PARTIALLY INTEGRATED" "$INTEGRATION_TEST_LOG"; then
                echo -e "${YELLOW}  ⚠️ Project Manager is PARTIALLY INTEGRATED${NC}"
            fi
        fi
        
    elif [ $exit_code -eq 124 ]; then
        echo -e "${RED}⏱️ Integration Test TIMED OUT${NC}"
        echo "Consider increasing TEST_TIMEOUT or checking for performance issues"
        
    else
        echo -e "${RED}❌ Integration Test FAILED${NC}"
        echo "Exit code: $exit_code"
        
        # Show recent error lines
        if [ -f "$INTEGRATION_TEST_LOG" ]; then
            echo ""
            echo "Recent errors:"
            tail -n 10 "$INTEGRATION_TEST_LOG" | grep -E "(FAIL|ERROR|❌)" || echo "No specific errors found in log tail"
        fi
    fi
    
    echo ""
    echo "Full test log: $INTEGRATION_TEST_LOG"
}

# Function to provide recommendations
provide_recommendations() {
    local exit_code=$1
    
    echo -e "${BLUE}💡 Recommendations${NC}"
    echo -e "${BLUE}==================${NC}"
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}✅ System is ready for production deployment${NC}"
        echo "Next steps:"
        echo "  1. Consider running performance benchmarks"
        echo "  2. Validate security configurations"
        echo "  3. Set up continuous integration"
        echo "  4. Monitor system metrics in production"
        
    else
        echo -e "${YELLOW}⚠️ Issues detected - recommended actions:${NC}"
        echo "  1. Review the full test log for specific failures"
        echo "  2. Ensure all required services are running (Supabase, Redis)"
        echo "  3. Verify environment configuration"
        echo "  4. Check network connectivity and firewall settings"
        echo "  5. Consider running individual service tests"
        
        echo ""
        echo "Debugging commands:"
        echo "  curl $SERVER_URL/health"
        echo "  curl $SERVER_URL/api/v1/agents"
        echo "  npm run dev (ensure server is running)"
    fi
}

# Main execution
main() {
    # Change to script directory
    cd "$(dirname "$0")/.."
    
    echo "Working directory: $(pwd)"
    echo ""
    
    # Run all checks
    if ! check_dependencies; then
        echo -e "${RED}❌ Dependency check failed${NC}"
        exit 1
    fi
    
    echo ""
    check_environment
    echo ""
    
    if ! check_server; then
        echo -e "${RED}❌ Server check failed${NC}"
        exit 1
    fi
    
    echo ""
    pre_test_validation
    echo ""
    
    # Run the integration test
    if run_integration_test; then
        EXIT_CODE=0
    else
        EXIT_CODE=$?
    fi
    
    # Analyze and report results
    analyze_results $EXIT_CODE
    provide_recommendations $EXIT_CODE
    
    exit $EXIT_CODE
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "Project Manager Integration Test Runner"
        echo ""
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h          Show this help message"
        echo "  --check-only        Only run pre-test validation"
        echo "  --skip-validation   Skip pre-test validation"
        echo ""
        echo "Environment Variables:"
        echo "  TEST_TIMEOUT        Test timeout in milliseconds (default: 60000)"
        echo "  SERVER_URL          Server URL (default: http://localhost:9999)"
        echo ""
        echo "Examples:"
        echo "  $0                           # Run full integration test"
        echo "  TEST_TIMEOUT=120000 $0       # Run with extended timeout"
        echo "  SERVER_URL=http://prod:9999 $0  # Test against different server"
        exit 0
        ;;
    --check-only)
        cd "$(dirname "$0")/.."
        check_dependencies && check_environment && check_server && pre_test_validation
        exit $?
        ;;
    --skip-validation)
        cd "$(dirname "$0")/.."
        run_integration_test
        EXIT_CODE=$?
        analyze_results $EXIT_CODE
        provide_recommendations $EXIT_CODE
        exit $EXIT_CODE
        ;;
    "")
        main
        ;;
    *)
        echo "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac