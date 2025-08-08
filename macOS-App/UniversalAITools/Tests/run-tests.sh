#!/bin/bash

# Universal AI Tools - Comprehensive Test Runner
# This script orchestrates all testing frameworks: Swift, Playwright, and Puppeteer

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="Universal AI Tools"
TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$TEST_DIR")"
REPORTS_DIR="$TEST_DIR/reports"
SCREENSHOTS_DIR="$TEST_DIR/screenshots"
FIXTURES_DIR="$TEST_DIR/fixtures"

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
START_TIME=$(date +%s)

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "info") echo -e "${BLUE}ℹ️  $message${NC}" ;;
        "success") echo -e "${GREEN}✅ $message${NC}" ;;
        "warning") echo -e "${YELLOW}⚠️  $message${NC}" ;;
        "error") echo -e "${RED}❌ $message${NC}" ;;
        "header") echo -e "${PURPLE}🚀 $message${NC}" ;;
        "subheader") echo -e "${CYAN}📋 $message${NC}" ;;
    esac
}

# Function to create directories
setup_directories() {
    print_status "info" "Setting up test directories..."

    mkdir -p "$REPORTS_DIR"
    mkdir -p "$SCREENSHOTS_DIR"
    mkdir -p "$FIXTURES_DIR"

    print_status "success" "Directories created successfully"
}

# Function to check dependencies
check_dependencies() {
    print_status "info" "Checking dependencies..."

    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_status "error" "Node.js is not installed"
        exit 1
    fi

    # Check npm
    if ! command -v npm &> /dev/null; then
        print_status "error" "npm is not installed"
        exit 1
    fi

    # Check Swift
    if ! command -v swift &> /dev/null; then
        print_status "error" "Swift is not installed"
        exit 1
    fi

    # Check Xcode Command Line Tools
    if ! xcode-select -p &> /dev/null; then
        print_status "error" "Xcode Command Line Tools are not installed"
        exit 1
    fi

    print_status "success" "All dependencies are available"
}

# Function to install test dependencies
install_dependencies() {
    print_status "info" "Installing test dependencies..."

    cd "$TEST_DIR"

    # Install npm dependencies
    if [ -f "package.json" ]; then
        npm install
        print_status "success" "npm dependencies installed"
    fi

    # Install Playwright browsers
    if command -v npx &> /dev/null; then
        npx playwright install
        print_status "success" "Playwright browsers installed"
    fi

    cd "$PROJECT_ROOT"
}

# Function to start the app for testing
start_app() {
    print_status "info" "Starting $APP_NAME for testing..."

    # Start the backend server (if needed)
    if [ -f "$PROJECT_ROOT/start-backend.sh" ]; then
        bash "$PROJECT_ROOT/start-backend.sh" &
        BACKEND_PID=$!
        sleep 5  # Wait for backend to start
    fi

    # Start the web interface (if needed)
    if [ -f "$PROJECT_ROOT/start-web.sh" ]; then
        bash "$PROJECT_ROOT/start-web.sh" &
        WEB_PID=$!
        sleep 3  # Wait for web interface to start
    fi

    print_status "success" "App started successfully"
}

# Function to stop the app
stop_app() {
    print_status "info" "Stopping app..."

    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi

    if [ ! -z "$WEB_PID" ]; then
        kill $WEB_PID 2>/dev/null || true
    fi

    print_status "success" "App stopped"
}

# Function to run Swift tests
run_swift_tests() {
    print_status "subheader" "Running Swift Tests"

    cd "$PROJECT_ROOT"

    local swift_test_start=$(date +%s)

    if swift test --package-path .; then
        local swift_test_end=$(date +%s)
        local swift_duration=$((swift_test_end - swift_test_start))
        print_status "success" "Swift tests passed in ${swift_duration}s"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        local swift_test_end=$(date +%s)
        local swift_duration=$((swift_test_end - swift_test_start))
        print_status "error" "Swift tests failed in ${swift_duration}s"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi

    TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

# Function to run Playwright tests
run_playwright_tests() {
    print_status "subheader" "Running Playwright Tests"

    cd "$TEST_DIR"

    local playwright_test_start=$(date +%s)

    if npx playwright test --reporter=html --output="$REPORTS_DIR/playwright"; then
        local playwright_test_end=$(date +%s)
        local playwright_duration=$((playwright_test_end - playwright_test_start))
        print_status "success" "Playwright tests passed in ${playwright_duration}s"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        local playwright_test_end=$(date +%s)
        local playwright_duration=$((playwright_test_end - playwright_test_start))
        print_status "error" "Playwright tests failed in ${playwright_duration}s"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi

    TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

# Function to run Puppeteer tests
run_puppeteer_tests() {
    print_status "subheader" "Running Puppeteer Tests"

    cd "$TEST_DIR"

    local puppeteer_test_start=$(date +%s)

    if node PuppeteerTests.js; then
        local puppeteer_test_end=$(date +%s)
        local puppeteer_duration=$((puppeteer_test_end - puppeteer_test_start))
        print_status "success" "Puppeteer tests passed in ${puppeteer_duration}s"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        local puppeteer_test_end=$(date +%s)
        local puppeteer_duration=$((puppeteer_test_end - puppeteer_test_start))
        print_status "error" "Puppeteer tests failed in ${puppeteer_duration}s"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi

    TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

# Function to run hot reload tests
run_hot_reload_tests() {
    print_status "subheader" "Running Hot Reload Tests"

    cd "$PROJECT_ROOT"

    local hot_reload_test_start=$(date +%s)

    if swift run HotReloadTestRunner; then
        local hot_reload_test_end=$(date +%s)
        local hot_reload_duration=$((hot_reload_test_end - hot_reload_test_start))
        print_status "success" "Hot reload tests passed in ${hot_reload_duration}s"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        local hot_reload_test_end=$(date +%s)
        local hot_reload_duration=$((hot_reload_test_end - hot_reload_test_start))
        print_status "error" "Hot reload tests failed in ${hot_reload_duration}s"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi

    TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

# Function to run performance tests
run_performance_tests() {
    print_status "subheader" "Running Performance Tests"

    cd "$TEST_DIR"

    local performance_test_start=$(date +%s)

    # Run performance benchmarks
    if node performance-tests.js; then
        local performance_test_end=$(date +%s)
        local performance_duration=$((performance_test_end - performance_test_start))
        print_status "success" "Performance tests passed in ${performance_duration}s"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        local performance_test_end=$(date +%s)
        local performance_duration=$((performance_test_end - performance_test_start))
        print_status "error" "Performance tests failed in ${performance_duration}s"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi

    TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

# Function to generate test report
generate_report() {
    print_status "info" "Generating test report..."

    local end_time=$(date +%s)
    local total_duration=$((end_time - START_TIME))
    local success_rate=0

    if [ $TOTAL_TESTS -gt 0 ]; then
        success_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    fi

    # Create HTML report
    cat > "$REPORTS_DIR/test-report.html" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>$APP_NAME - Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f0f0f0; padding: 20px; border-radius: 5px; }
        .summary { margin: 20px 0; }
        .metric { display: inline-block; margin: 10px; padding: 10px; border-radius: 5px; }
        .passed { background: #d4edda; color: #155724; }
        .failed { background: #f8d7da; color: #721c24; }
        .total { background: #d1ecf1; color: #0c5460; }
    </style>
</head>
<body>
    <div class="header">
        <h1>$APP_NAME - Test Report</h1>
        <p>Generated on $(date)</p>
    </div>

    <div class="summary">
        <div class="metric total">
            <h3>Total Tests</h3>
            <p>$TOTAL_TESTS</p>
        </div>
        <div class="metric passed">
            <h3>Passed</h3>
            <p>$PASSED_TESTS</p>
        </div>
        <div class="metric failed">
            <h3>Failed</h3>
            <p>$FAILED_TESTS</p>
        </div>
        <div class="metric total">
            <h3>Success Rate</h3>
            <p>${success_rate}%</p>
        </div>
        <div class="metric total">
            <h3>Duration</h3>
            <p>${total_duration}s</p>
        </div>
    </div>
</body>
</html>
EOF

    print_status "success" "Test report generated: $REPORTS_DIR/test-report.html"
}

# Function to show test results
show_results() {
    print_status "header" "Test Results Summary"
    echo
    echo "Total Tests: $TOTAL_TESTS"
    echo "Passed: $PASSED_TESTS"
    echo "Failed: $FAILED_TESTS"

    if [ $TOTAL_TESTS -gt 0 ]; then
        local success_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
        echo "Success Rate: ${success_rate}%"
    fi

    local end_time=$(date +%s)
    local total_duration=$((end_time - START_TIME))
    echo "Total Duration: ${total_duration}s"
    echo

    if [ $FAILED_TESTS -eq 0 ]; then
        print_status "success" "All tests passed! 🎉"
        exit 0
    else
        print_status "error" "Some tests failed! ❌"
        exit 1
    fi
}

# Function to clean up
cleanup() {
    print_status "info" "Cleaning up..."
    stop_app
    print_status "success" "Cleanup completed"
}

# Main execution
main() {
    print_status "header" "Starting $APP_NAME Test Suite"
    echo

    # Set up trap to ensure cleanup on exit
    trap cleanup EXIT

    # Setup
    setup_directories
    check_dependencies
    install_dependencies
    start_app

    # Run tests
    run_swift_tests
    run_playwright_tests
    run_puppeteer_tests
    run_hot_reload_tests
    run_performance_tests

    # Generate report and show results
    generate_report
    show_results
}

# Parse command line arguments
case "${1:-}" in
    "swift")
        print_status "header" "Running Swift tests only"
        check_dependencies
        run_swift_tests
        show_results
        ;;
    "playwright")
        print_status "header" "Running Playwright tests only"
        check_dependencies
        install_dependencies
        start_app
        run_playwright_tests
        cleanup
        show_results
        ;;
    "puppeteer")
        print_status "header" "Running Puppeteer tests only"
        check_dependencies
        install_dependencies
        start_app
        run_puppeteer_tests
        cleanup
        show_results
        ;;
    "hot-reload")
        print_status "header" "Running Hot Reload tests only"
        check_dependencies
        run_hot_reload_tests
        show_results
        ;;
    "performance")
        print_status "header" "Running Performance tests only"
        check_dependencies
        install_dependencies
        start_app
        run_performance_tests
        cleanup
        show_results
        ;;
    "setup")
        print_status "header" "Setting up test environment"
        setup_directories
        check_dependencies
        install_dependencies
        print_status "success" "Test environment setup completed"
        ;;
    "clean")
        print_status "header" "Cleaning test artifacts"
        rm -rf "$REPORTS_DIR" "$SCREENSHOTS_DIR"
        print_status "success" "Test artifacts cleaned"
        ;;
    "help"|"-h"|"--help")
        echo "Usage: $0 [option]"
        echo
        echo "Options:"
        echo "  (no args)    Run all tests"
        echo "  swift        Run Swift tests only"
        echo "  playwright   Run Playwright tests only"
        echo "  puppeteer    Run Puppeteer tests only"
        echo "  hot-reload   Run Hot Reload tests only"
        echo "  performance  Run Performance tests only"
        echo "  setup        Set up test environment"
        echo "  clean        Clean test artifacts"
        echo "  help         Show this help message"
        ;;
    *)
        main
        ;;
esac
