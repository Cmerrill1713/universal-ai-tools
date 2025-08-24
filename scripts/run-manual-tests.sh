#!/bin/bash

echo "=== Running Manual Test Suite ==="
echo "================================"
echo

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter for test results
PASSED=0
FAILED=0
SKIPPED=0

# Function to run a test
run_test() {
    local test_file=$1
    local test_name=$(basename "$test_file" .js)
    
    echo -e "${YELLOW}Running: $test_name${NC}"
    
    # Check if test requires specific services
    if [[ "$test_name" == *"ollama"* ]]; then
        # Check if Ollama is running
        if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
            echo -e "${YELLOW}  ⚠️  Skipped: Ollama service not running${NC}"
            ((SKIPPED++))
            return
        fi
    fi
    
    if [[ "$test_name" == *"supabase"* ]]; then
        # Check if we have Supabase env vars
        if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
            echo -e "${YELLOW}  ⚠️  Skipped: Supabase environment variables not set${NC}"
            ((SKIPPED++))
            return
        fi
    fi
    
    # Run the test (without timeout on macOS)
    if node "$test_file" > /tmp/test_output.log 2>&1; then
        echo -e "${GREEN}  ✅ Passed${NC}"
        ((PASSED++))
    else
        echo -e "${RED}  ❌ Failed${NC}"
        echo "  Error output:"
        tail -n 10 /tmp/test_output.log | sed 's/^/    /'
        ((FAILED++))
    fi
    echo
}

# Check if we're in the right directory
if [ ! -d "tests/manual" ]; then
    echo "Error: tests/manual directory not found"
    echo "Please run this script from the project root"
    exit 1
fi

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Run all tests
echo "Found $(ls tests/manual/test_*.js 2>/dev/null | wc -l) test files"
echo

for test_file in tests/manual/test_*.js; do
    if [ -f "$test_file" ]; then
        run_test "$test_file"
    fi
done

# Summary
echo "================================"
echo "Test Results Summary:"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo -e "${YELLOW}Skipped: $SKIPPED${NC}"
echo

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed! 🎉${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed 😞${NC}"
    exit 1
fi