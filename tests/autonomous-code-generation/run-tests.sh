#!/bin/bash

# Autonomous Code Generation Test Runner
# Comprehensive test execution script for the autonomous coding system

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
TEST_DIR="$(dirname "$0")"
ROOT_DIR="$(cd "$TEST_DIR/../../.." && pwd)"
REPORT_DIR="$ROOT_DIR/test-reports/autonomous-code-generation"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")

# Ensure report directory exists
mkdir -p "$REPORT_DIR"

echo -e "${BLUE}🚀 Autonomous Code Generation Test Suite${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Function to print status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check prerequisites
print_info "Checking prerequisites..."

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed"
    exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed"
    exit 1
fi

# Check if jest is available
if ! npm list jest &> /dev/null && ! npm list -g jest &> /dev/null; then
    print_warning "Jest not found, installing dependencies..."
    cd "$ROOT_DIR"
    npm install
fi

print_status "Prerequisites check complete"

# Set environment variables for testing
export NODE_ENV=test
export LOG_LEVEL=warn
export TEST_TIMEOUT=30000

# Function to run test suite
run_test_suite() {
    local suite_name="$1"
    local test_pattern="$2"
    local timeout="${3:-30000}"
    
    echo ""
    print_info "Running $suite_name tests..."
    
    cd "$ROOT_DIR"
    
    if npm test -- \
        --testPathPattern="tests/autonomous-code-generation/$test_pattern" \
        --testTimeout="$timeout" \
        --verbose \
        --coverage=false \
        --reporters=default; then
        print_status "$suite_name tests completed successfully"
        return 0
    else
        print_error "$suite_name tests failed"
        return 1
    fi
}

# Function to run performance benchmarks
run_performance_benchmarks() {
    echo ""
    print_info "Running performance benchmarks..."
    
    cd "$ROOT_DIR"
    
    if npm test -- \
        --testPathPattern="tests/autonomous-code-generation/performance" \
        --testTimeout=60000 \
        --verbose \
        --coverage=false \
        --reporters=default; then
        print_status "Performance benchmarks completed"
        return 0
    else
        print_error "Performance benchmarks failed"
        return 1
    fi
}

# Function to generate coverage report
generate_coverage_report() {
    echo ""
    print_info "Generating coverage report..."
    
    cd "$ROOT_DIR"
    
    if npm test -- \
        --testPathPattern="tests/autonomous-code-generation" \
        --coverage \
        --coverageDirectory="$REPORT_DIR/coverage" \
        --coverageReporters=html,text,lcov,json \
        --collectCoverageFrom="src/services/autonomous-code-service.ts" \
        --collectCoverageFrom="src/services/code-analysis-service.ts" \
        --collectCoverageFrom="src/services/security-scanning-service.ts" \
        --collectCoverageFrom="src/services/code-quality-service.ts" \
        --collectCoverageFrom="src/services/repository-indexing-service.ts" \
        --collectCoverageFrom="src/routers/code-generation.ts" \
        --collectCoverageFrom="src/agents/specialized/enhanced-code-assistant-agent.ts" \
        --silent; then
        print_status "Coverage report generated: $REPORT_DIR/coverage/index.html"
        return 0
    else
        print_warning "Coverage report generation had issues"
        return 1
    fi
}

# Function to run all tests with comprehensive reporting
run_comprehensive_tests() {
    echo ""
    print_info "Running comprehensive test suite with reporting..."
    
    cd "$ROOT_DIR"
    
    # Create comprehensive test report
    local report_file="$REPORT_DIR/test-report-$TIMESTAMP.json"
    local html_report="$REPORT_DIR/test-report-$TIMESTAMP.html"
    
    if npm test -- \
        --testPathPattern="tests/autonomous-code-generation" \
        --json \
        --outputFile="$report_file" \
        --coverage \
        --coverageDirectory="$REPORT_DIR/coverage-$TIMESTAMP" \
        --testTimeout=45000 \
        --verbose; then
        print_status "Comprehensive tests completed"
        print_info "Test report: $report_file"
        return 0
    else
        print_error "Comprehensive tests failed"
        return 1
    fi
}

# Main execution logic
FAILED_SUITES=()

# Parse command line arguments
QUICK_MODE=false
PERFORMANCE_ONLY=false
COVERAGE_ONLY=false
COMPREHENSIVE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --quick)
            QUICK_MODE=true
            shift
            ;;
        --performance)
            PERFORMANCE_ONLY=true
            shift
            ;;
        --coverage)
            COVERAGE_ONLY=true
            shift
            ;;
        --comprehensive)
            COMPREHENSIVE=true
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --quick         Run only unit tests (fast)"
            echo "  --performance   Run only performance tests"
            echo "  --coverage      Generate coverage report only"
            echo "  --comprehensive Run all tests with detailed reporting"
            echo "  --help          Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                    # Run all test suites"
            echo "  $0 --quick           # Quick unit tests only"
            echo "  $0 --performance     # Performance benchmarks only"
            echo "  $0 --comprehensive   # Full suite with reporting"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Execute based on mode
if [[ "$COVERAGE_ONLY" == true ]]; then
    generate_coverage_report
    exit $?
elif [[ "$PERFORMANCE_ONLY" == true ]]; then
    run_performance_benchmarks
    exit $?
elif [[ "$COMPREHENSIVE" == true ]]; then
    run_comprehensive_tests
    exit $?
elif [[ "$QUICK_MODE" == true ]]; then
    print_info "Quick mode: Running unit tests only"
    run_test_suite "Unit" "unit" 15000
    exit $?
else
    # Run all test suites
    print_info "Running all test suites..."
    
    # Unit Tests
    if ! run_test_suite "Unit" "unit" 20000; then
        FAILED_SUITES+=("Unit")
    fi
    
    # Integration Tests
    if ! run_test_suite "Integration" "integration" 30000; then
        FAILED_SUITES+=("Integration")
    fi
    
    # End-to-End Tests
    if ! run_test_suite "End-to-End" "e2e" 60000; then
        FAILED_SUITES+=("E2E")
    fi
    
    # Security Tests
    if ! run_test_suite "Security" "security" 25000; then
        FAILED_SUITES+=("Security")
    fi
    
    # Performance Tests
    if ! run_performance_benchmarks; then
        FAILED_SUITES+=("Performance")
    fi
    
    # Generate coverage report
    generate_coverage_report
fi

# Summary
echo ""
echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}📊 Test Execution Summary${NC}"
echo -e "${BLUE}================================================${NC}"

if [[ ${#FAILED_SUITES[@]} -eq 0 ]]; then
    echo ""
    print_status "All test suites passed successfully! 🎉"
    echo ""
    print_info "Reports available in: $REPORT_DIR"
    echo ""
    exit 0
else
    echo ""
    print_error "Failed test suites: ${FAILED_SUITES[*]}"
    echo ""
    print_info "Check test output above for detailed error information"
    print_info "Reports available in: $REPORT_DIR"
    echo ""
    exit 1
fi