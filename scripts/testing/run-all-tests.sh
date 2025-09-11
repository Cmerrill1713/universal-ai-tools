#!/bin/bash

# Run All Tests Script
# Executes comprehensive test suite for chat and agent systems

set -e

echo "🧪 Universal AI Tools - Comprehensive Test Runner"
echo "==============================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# Function to run a test suite
run_test_suite() {
    local suite_name=$1
    local test_command=$2
    
    echo -e "${BLUE}Running $suite_name...${NC}"
    echo "----------------------------------------"
    
    if eval "$test_command"; then
        echo -e "${GREEN}✓ $suite_name PASSED${NC}\n"
        ((PASSED_TESTS++))
    else
        echo -e "${RED}✗ $suite_name FAILED${NC}\n"
        ((FAILED_TESTS++))
    fi
    ((TOTAL_TESTS++))
}

# Check prerequisites
echo "📋 Checking Prerequisites..."
echo "----------------------------------------"

# Check if server is running
if curl -s http://localhost:9999/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend server is running${NC}"
else
    echo -e "${RED}✗ Backend server is not running${NC}"
    echo -e "${YELLOW}  Please start the server: npm run dev${NC}"
    exit 1
fi

# Check if database is accessible
if nc -z localhost 5432 2>/dev/null; then
    echo -e "${GREEN}✓ PostgreSQL is accessible${NC}"
else
    echo -e "${YELLOW}⚠ PostgreSQL may not be running${NC}"
fi

# Check if test dependencies are installed
if [ -f "node_modules/.bin/jest" ]; then
    echo -e "${GREEN}✓ Test dependencies installed${NC}"
else
    echo -e "${RED}✗ Test dependencies missing${NC}"
    echo -e "${YELLOW}  Please run: npm install${NC}"
    exit 1
fi

echo ""

# 1. Run validation script
echo -e "${BLUE}1️⃣  System Validation${NC}"
echo "----------------------------------------"
if [ -f "./validate-system.sh" ]; then
    if ./validate-system.sh > /tmp/validation.log 2>&1; then
        echo -e "${GREEN}✓ System validation passed${NC}"
        ((PASSED_TESTS++))
    else
        echo -e "${RED}✗ System validation failed${NC}"
        echo "  See /tmp/validation.log for details"
        ((FAILED_TESTS++))
    fi
    ((TOTAL_TESTS++))
else
    echo -e "${YELLOW}⚠ Validation script not found${NC}"
    ((SKIPPED_TESTS++))
fi
echo ""

# 2. Run backend unit tests
run_test_suite "Backend Unit Tests" "npm test -- --passWithNoTests --testTimeout=30000"

# 3. Run frontend tests
run_test_suite "Frontend Component Tests" "cd ui && npm test -- --passWithNoTests --testTimeout=30000"

# 4. Run integration tests
echo -e "${BLUE}4️⃣  Integration Tests${NC}"
echo "----------------------------------------"
if [ -f "test-frontend-integration.cjs" ]; then
    if API_KEY="${API_KEY:-test-key-123}" node test-frontend-integration.cjs > /tmp/integration.log 2>&1; then
        echo -e "${GREEN}✓ Integration tests passed${NC}"
        ((PASSED_TESTS++))
    else
        echo -e "${RED}✗ Integration tests failed${NC}"
        echo "  See /tmp/integration.log for details"
        ((FAILED_TESTS++))
    fi
    ((TOTAL_TESTS++))
else
    echo -e "${YELLOW}⚠ Integration test script not found${NC}"
    ((SKIPPED_TESTS++))
fi
echo ""

# 5. Run comprehensive test suite
if [ -f "tests/comprehensive-test-suite.ts" ]; then
    run_test_suite "Comprehensive Test Suite" "npx jest tests/comprehensive-test-suite.ts --testTimeout=60000"
fi

# 6. Run WebSocket tests
if [ -f "tests/websocket-tests.ts" ]; then
    run_test_suite "WebSocket Tests" "npx jest tests/websocket-tests.ts --testTimeout=30000"
fi

# 7. Run TypeScript checks
echo -e "${BLUE}7️⃣  TypeScript Validation${NC}"
echo "----------------------------------------"
TS_ERRORS=0

echo -n "Backend TypeScript... "
if npx tsc --noEmit > /tmp/tsc-backend.log 2>&1; then
    echo -e "${GREEN}✓ No errors${NC}"
else
    echo -e "${RED}✗ Errors found${NC}"
    ((TS_ERRORS++))
fi

echo -n "Frontend TypeScript... "
if cd ui && npx tsc --noEmit > /tmp/tsc-frontend.log 2>&1; then
    echo -e "${GREEN}✓ No errors${NC}"
else
    echo -e "${RED}✗ Errors found${NC}"
    ((TS_ERRORS++))
fi
cd ..

if [ $TS_ERRORS -eq 0 ]; then
    ((PASSED_TESTS++))
else
    ((FAILED_TESTS++))
fi
((TOTAL_TESTS++))
echo ""

# 8. Run linting
echo -e "${BLUE}8️⃣  Code Quality Checks${NC}"
echo "----------------------------------------"
LINT_ERRORS=0

echo -n "ESLint... "
if npx eslint src --ext .ts,.tsx --max-warnings 0 > /tmp/eslint.log 2>&1; then
    echo -e "${GREEN}✓ No issues${NC}"
else
    echo -e "${YELLOW}⚠ Warnings found${NC}"
    ((LINT_ERRORS++))
fi

if [ $LINT_ERRORS -eq 0 ]; then
    ((PASSED_TESTS++))
else
    ((FAILED_TESTS++))
fi
((TOTAL_TESTS++))
echo ""

# 9. Security audit
echo -e "${BLUE}9️⃣  Security Audit${NC}"
echo "----------------------------------------"
echo -n "Checking for vulnerabilities... "
if npm audit --audit-level=high > /tmp/npm-audit.log 2>&1; then
    echo -e "${GREEN}✓ No high/critical vulnerabilities${NC}"
    ((PASSED_TESTS++))
else
    VULNS=$(grep -E "found [0-9]+ vulnerabilities" /tmp/npm-audit.log || echo "vulnerabilities found")
    echo -e "${YELLOW}⚠ $VULNS${NC}"
    ((FAILED_TESTS++))
fi
((TOTAL_TESTS++))
echo ""

# Summary
echo "==============================================="
echo -e "${BLUE}📊 Test Summary${NC}"
echo "==============================================="
echo -e "Total Test Suites: $TOTAL_TESTS"
echo -e "${GREEN}✓ Passed: $PASSED_TESTS${NC}"
echo -e "${RED}✗ Failed: $FAILED_TESTS${NC}"
echo -e "${YELLOW}⚠ Skipped: $SKIPPED_TESTS${NC}"
echo ""

# Calculate percentage
if [ $TOTAL_TESTS -gt 0 ]; then
    PERCENTAGE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    echo -e "Success Rate: ${PERCENTAGE}%"
    
    if [ $PERCENTAGE -ge 90 ]; then
        echo -e "${GREEN}🎉 Excellent! System is ready for use.${NC}"
    elif [ $PERCENTAGE -ge 70 ]; then
        echo -e "${YELLOW}⚠️  Good, but some issues need attention.${NC}"
    else
        echo -e "${RED}❌ Critical issues found. Please fix before proceeding.${NC}"
    fi
fi
echo ""

# Generate test report
echo "📝 Generating detailed test report..."
cat > TEST_REPORT.md << EOF
# Test Report - $(date)

## Summary
- Total Test Suites: $TOTAL_TESTS
- Passed: $PASSED_TESTS
- Failed: $FAILED_TESTS
- Skipped: $SKIPPED_TESTS
- Success Rate: ${PERCENTAGE}%

## Test Results

### System Validation
$([ -f /tmp/validation.log ] && tail -20 /tmp/validation.log || echo "No validation log found")

### Integration Tests
$([ -f /tmp/integration.log ] && tail -20 /tmp/integration.log || echo "No integration log found")

### TypeScript Errors
$([ -f /tmp/tsc-backend.log ] && head -20 /tmp/tsc-backend.log || echo "No TypeScript errors")

### Security Audit
$([ -f /tmp/npm-audit.log ] && cat /tmp/npm-audit.log || echo "No audit log found")

## Recommendations
EOF

if [ $FAILED_TESTS -gt 0 ]; then
    cat >> TEST_REPORT.md << EOF

### Failed Tests Need Attention:
1. Review the test logs in /tmp/ directory
2. Fix any TypeScript errors
3. Address security vulnerabilities
4. Ensure all services are running
5. Check database migrations are up to date
EOF
fi

echo -e "${GREEN}✓ Test report saved to TEST_REPORT.md${NC}"
echo ""

# Exit code
if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed! The system is ready.${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Please review the report.${NC}"
    exit 1
fi