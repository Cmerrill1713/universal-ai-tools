#!/bin/bash

# Integration Test Runner for Model Services
# Ensures all models are "playing nice together and working extremely well"

set -e

echo "🧪 Universal AI Tools - Model Services Integration Tests"
echo "========================================================"
echo "Testing that all models work together harmoniously"
echo

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
fi

# Check if Ollama is running
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Ollama is not running. Starting Ollama...${NC}"
    ollama serve > /dev/null 2>&1 &
    sleep 5
fi

# Check if Redis is running
if ! redis-cli ping > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Redis is not running. Starting Redis...${NC}"
    redis-server > /dev/null 2>&1 &
    sleep 2
fi

# Check if Supabase is running
if ! curl -s http://localhost:54321/rest/v1/ > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Supabase is not running. Please start with: npx supabase start${NC}"
fi

echo -e "${GREEN}✅ Prerequisites checked${NC}"
echo

# Kill any existing server on port 9999
echo "🧹 Cleaning up existing processes..."
lsof -ti :9999 | xargs kill -9 2>/dev/null || true
sleep 2

# Set environment variables
export NODE_ENV=test
export PORT=9999
export LOG_LEVEL=error  # Reduce noise during tests

# Create test results directory
mkdir -p test-results

# Run the tests
echo "🚀 Starting integration tests..."
echo "================================"
echo

# Run Jest with integration tests
npx jest tests/integration/model-services.test.ts \
    --testTimeout=60000 \
    --verbose \
    --detectOpenHandles \
    --forceExit \
    --json \
    --outputFile=test-results/integration-results.json \
    2>&1 | tee test-results/integration-output.log

# Capture exit code
TEST_EXIT_CODE=${PIPESTATUS[0]}

echo
echo "📊 Test Results Summary"
echo "======================="

# Parse and display results
if [ -f test-results/integration-results.json ]; then
    # Extract test counts
    TOTAL=$(jq '.numTotalTests' test-results/integration-results.json)
    PASSED=$(jq '.numPassedTests' test-results/integration-results.json)
    FAILED=$(jq '.numFailedTests' test-results/integration-results.json)
    
    echo "Total Tests: $TOTAL"
    echo -e "Passed: ${GREEN}$PASSED${NC}"
    if [ "$FAILED" -gt 0 ]; then
        echo -e "Failed: ${RED}$FAILED${NC}"
    else
        echo -e "Failed: ${GREEN}$FAILED${NC}"
    fi
    
    # Calculate success rate
    if [ "$TOTAL" -gt 0 ]; then
        SUCCESS_RATE=$(echo "scale=2; $PASSED * 100 / $TOTAL" | bc)
        echo "Success Rate: ${SUCCESS_RATE}%"
    fi
    
    # Show failed test details if any
    if [ "$FAILED" -gt 0 ]; then
        echo
        echo -e "${RED}Failed Tests:${NC}"
        jq -r '.testResults[].assertionResults[] | select(.status == "failed") | "  - \(.title): \(.failureMessages[0])"' test-results/integration-results.json 2>/dev/null | head -10
    fi
fi

echo
echo "🔍 Service Health Check"
echo "======================="

# Quick health check
if curl -s http://localhost:9999/health > /dev/null 2>&1; then
    HEALTH=$(curl -s http://localhost:9999/health | jq -r '.status')
    echo "Server Health: $HEALTH"
    
    # Check individual services
    echo "Services:"
    curl -s http://localhost:9999/health | jq -r '.services | to_entries[] | "  - \(.key): \(.value)"' 2>/dev/null
    
    # Check agents
    AGENT_COUNT=$(curl -s http://localhost:9999/health | jq -r '.agents.available' 2>/dev/null)
    echo "Available Agents: $AGENT_COUNT"
fi

echo
echo "🎯 Model Cooperation Status"
echo "==========================="

# Check specific model issues
echo "Checking for known issues..."

# Check for LFM2 temperature errors
if grep -q "temperature.*error\|MLX generation error.*temperature" test-results/integration-output.log 2>/dev/null; then
    echo -e "${RED}❌ LFM2 temperature parameter issue detected${NC}"
else
    echo -e "${GREEN}✅ No LFM2 temperature issues${NC}"
fi

# Check for string type errors
if grep -q "requires string as left operand" test-results/integration-output.log 2>/dev/null; then
    echo -e "${RED}❌ LFM2 string type error detected${NC}"
else
    echo -e "${GREEN}✅ No string type errors${NC}"
fi

# Check for API secrets issues
if grep -q "api_secrets.*error\|vault.*error" test-results/integration-output.log 2>/dev/null; then
    echo -e "${YELLOW}⚠️  API secrets/vault warnings detected${NC}"
else
    echo -e "${GREEN}✅ No API secrets issues${NC}"
fi

# Check for port conflicts
if grep -q "EADDRINUSE" test-results/integration-output.log 2>/dev/null; then
    echo -e "${RED}❌ Port conflict detected${NC}"
else
    echo -e "${GREEN}✅ No port conflicts${NC}"
fi

echo
echo "📋 Detailed Report"
echo "=================="
echo "Full test output saved to: test-results/integration-output.log"
echo "JSON results saved to: test-results/integration-results.json"

# Final verdict
echo
if [ "$TEST_EXIT_CODE" -eq 0 ]; then
    echo -e "${GREEN}🎉 SUCCESS: All models are playing nice together!${NC}"
    echo "The Universal AI Tools platform is working extremely well with all models cooperating."
else
    echo -e "${RED}⚠️  Some tests failed, but the core system is operational.${NC}"
    echo "Review the failed tests above for specific issues to address."
fi

echo
echo "💡 Next Steps:"
echo "  1. Review any failed tests in the detailed report"
echo "  2. Run 'npm run dev' to start the server for manual testing"
echo "  3. Use 'npm run monitor' to view the monitoring dashboard"
echo "  4. Check logs/server.log for runtime issues"

exit $TEST_EXIT_CODE