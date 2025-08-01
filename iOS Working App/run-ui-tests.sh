#!/bin/bash

# Universal AI Tools iOS Companion App - UI Test Runner
# This script configures and runs the UI tests for connection status validation

echo "🧪 Universal AI Tools iOS Companion - UI Test Runner"
echo "===================================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Navigate to project directory
cd "$(dirname "$0")"

# Check if Xcode is installed
if ! command -v xcodebuild &> /dev/null; then
    echo -e "${RED}❌ Xcode is not installed. Please install Xcode from the App Store.${NC}"
    exit 1
fi

# Check if backend is running
echo -e "\n${YELLOW}🌐 Checking backend connectivity...${NC}"
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:9999/health)
if [ "$BACKEND_STATUS" -eq 200 ]; then
    echo -e "${GREEN}✅ Backend is running on localhost:9999${NC}"
    BACKEND_INFO=$(curl -s http://localhost:9999/health)
    echo "Backend info: $BACKEND_INFO"
else
    echo -e "${RED}❌ Backend is not responding. Please start the Universal AI Tools backend first.${NC}"
    echo "Run: cd /Users/christianmerrill/Desktop/universal-ai-tools && npm run dev"
    exit 1
fi

# List available simulators
echo -e "\n${YELLOW}📱 Available iOS Simulators:${NC}"
xcrun simctl list devices iOS | grep -E '^\s+iPhone|iPad' | grep -v 'unavailable' | head -10

# Use iPhone 15 Pro as default, or fallback to first available
SIMULATOR_NAME="iPhone 15 Pro"
AVAILABLE_SIMULATORS=$(xcrun simctl list devices iOS | grep "$SIMULATOR_NAME" | grep -v 'unavailable')
if [ -z "$AVAILABLE_SIMULATORS" ]; then
    echo -e "${YELLOW}⚠️ iPhone 15 Pro not available, using first available iPhone...${NC}"
    SIMULATOR_NAME=$(xcrun simctl list devices iOS | grep -E '^\s+iPhone' | grep -v 'unavailable' | head -1 | sed 's/^[[:space:]]*//' | cut -d'(' -f1 | xargs)
fi

echo -e "${BLUE}📱 Using simulator: $SIMULATOR_NAME${NC}"

# Clean build folder
echo -e "\n${YELLOW}🧹 Cleaning build folder...${NC}"
xcodebuild clean -project UniversalAICompanion.xcodeproj -scheme UniversalAICompanion

# Build the project first
echo -e "\n${YELLOW}🔨 Building project...${NC}"
BUILD_RESULT=$(xcodebuild build-for-testing \
    -project UniversalAICompanion.xcodeproj \
    -scheme UniversalAICompanion \
    -destination "platform=iOS Simulator,name=$SIMULATOR_NAME,OS=latest" \
    -configuration Debug \
    CODE_SIGN_IDENTITY="" \
    CODE_SIGNING_REQUIRED=NO \
    CODE_SIGNING_ALLOWED=NO 2>&1)

BUILD_SUCCESS=$?

if [ $BUILD_SUCCESS -eq 0 ]; then
    echo -e "${GREEN}✅ Build succeeded!${NC}"
else
    echo -e "${RED}❌ Build failed! Here's the output:${NC}"
    echo "$BUILD_RESULT"
    
    # Try to extract meaningful error messages
    echo -e "\n${YELLOW}📋 Error Summary:${NC}"
    echo "$BUILD_RESULT" | grep -E "(error:|warning:|note:)" | head -10
    
    echo -e "\n${YELLOW}🔧 Attempting to run tests anyway...${NC}"
fi

# Start test results collection
TEST_RESULTS_FILE="/tmp/ios_ui_test_results.txt"
echo "Universal AI Tools iOS UI Test Results" > $TEST_RESULTS_FILE
echo "=======================================" >> $TEST_RESULTS_FILE
echo "Test started at: $(date)" >> $TEST_RESULTS_FILE
echo "Backend status: ✅ Running" >> $TEST_RESULTS_FILE
echo "Simulator: $SIMULATOR_NAME" >> $TEST_RESULTS_FILE
echo "" >> $TEST_RESULTS_FILE

# Function to run individual test classes
run_test_class() {
    local test_class=$1
    local test_description=$2
    
    echo -e "\n${BLUE}🧪 Running $test_description...${NC}"
    echo "========================================" >> $TEST_RESULTS_FILE
    echo "Test Class: $test_class" >> $TEST_RESULTS_FILE
    echo "Description: $test_description" >> $TEST_RESULTS_FILE
    echo "Started at: $(date)" >> $TEST_RESULTS_FILE

    # Try using different approaches to run the tests
    
    # Approach 1: Try running with xcodebuild test-without-building first
    echo -e "${YELLOW}Attempting test execution (Method 1)...${NC}"
    
    TEST_OUTPUT=$(xcodebuild test-without-building \
        -project UniversalAICompanion.xcodeproj \
        -scheme UniversalAICompanion \
        -destination "platform=iOS Simulator,name=$SIMULATOR_NAME,OS=latest" \
        -only-testing:$test_class \
        2>&1)
    
    TEST_RESULT=$?
    
    # If that fails, try building and testing together
    if [ $TEST_RESULT -ne 0 ]; then
        echo -e "${YELLOW}Method 1 failed, trying Method 2...${NC}"
        
        TEST_OUTPUT=$(xcodebuild test \
            -project UniversalAICompanion.xcodeproj \
            -scheme UniversalAICompanion \
            -destination "platform=iOS Simulator,name=$SIMULATOR_NAME,OS=latest" \
            -only-testing:$test_class \
            CODE_SIGN_IDENTITY="" \
            CODE_SIGNING_REQUIRED=NO \
            CODE_SIGNING_ALLOWED=NO \
            2>&1)
        
        TEST_RESULT=$?
    fi
    
    # If that also fails, try without the -only-testing flag
    if [ $TEST_RESULT -ne 0 ]; then
        echo -e "${YELLOW}Method 2 failed, trying Method 3 (all tests)...${NC}"
        
        TEST_OUTPUT=$(xcodebuild test \
            -project UniversalAICompanion.xcodeproj \
            -scheme UniversalAICompanion \
            -destination "platform=iOS Simulator,name=$SIMULATOR_NAME,OS=latest" \
            CODE_SIGN_IDENTITY="" \
            CODE_SIGNING_REQUIRED=NO \
            CODE_SIGNING_ALLOWED=NO \
            2>&1)
        
        TEST_RESULT=$?
    fi
    
    # Parse and record results
    if [ $TEST_RESULT -eq 0 ]; then
        echo -e "${GREEN}✅ $test_description - PASSED${NC}"
        echo "Status: ✅ PASSED" >> $TEST_RESULTS_FILE
        
        # Extract specific test results
        echo "$TEST_OUTPUT" | grep -E "(Test Case|Test Suite)" >> $TEST_RESULTS_FILE
        
    else
        echo -e "${RED}❌ $test_description - FAILED${NC}"
        echo "Status: ❌ FAILED" >> $TEST_RESULTS_FILE
        
        # Extract error information
        echo "Error Details:" >> $TEST_RESULTS_FILE
        echo "$TEST_OUTPUT" | grep -E "(error:|failed:|Testing failed)" | head -5 >> $TEST_RESULTS_FILE
    fi
    
    echo "Completed at: $(date)" >> $TEST_RESULTS_FILE
    echo "" >> $TEST_RESULTS_FILE
    
    return $TEST_RESULT
}

# Try to run each test class
echo -e "\n${BLUE}🚀 Starting UI Tests...${NC}"

# Test 1: Connection Status UI Tests
run_test_class "UniversalAICompanionUITests/ConnectionStatusUITests" "Connection Status Validation"
CONNECTION_TEST_RESULT=$?

# Test 2: Final Connection Status Validation Tests  
run_test_class "UniversalAICompanionUITests/FinalConnectionStatusValidationTests" "Final Connection Status Validation"
FINAL_TEST_RESULT=$?

# Test 3: Authentication UI Tests
run_test_class "UniversalAICompanionUITests/AuthenticationUITests" "Authentication UI Tests"
AUTH_TEST_RESULT=$?

# Generate summary
echo -e "\n${BLUE}📊 Test Results Summary${NC}"
echo "=========================="

if [ $CONNECTION_TEST_RESULT -eq 0 ]; then
    echo -e "Connection Status Tests: ${GREEN}✅ PASSED${NC}"
else
    echo -e "Connection Status Tests: ${RED}❌ FAILED${NC}"
fi

if [ $FINAL_TEST_RESULT -eq 0 ]; then
    echo -e "Final Validation Tests:  ${GREEN}✅ PASSED${NC}"
else
    echo -e "Final Validation Tests:  ${RED}❌ FAILED${NC}"
fi

if [ $AUTH_TEST_RESULT -eq 0 ]; then
    echo -e "Authentication Tests:    ${GREEN}✅ PASSED${NC}"
else
    echo -e "Authentication Tests:    ${RED}❌ FAILED${NC}"
fi

# Final summary in results file
echo "========================================" >> $TEST_RESULTS_FILE
echo "FINAL TEST SUMMARY" >> $TEST_RESULTS_FILE
echo "========================================" >> $TEST_RESULTS_FILE
echo "Connection Status Tests: $([ $CONNECTION_TEST_RESULT -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED")" >> $TEST_RESULTS_FILE
echo "Final Validation Tests: $([ $FINAL_TEST_RESULT -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED")" >> $TEST_RESULTS_FILE
echo "Authentication Tests: $([ $AUTH_TEST_RESULT -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED")" >> $TEST_RESULTS_FILE
echo "Test completed at: $(date)" >> $TEST_RESULTS_FILE

echo -e "\n${YELLOW}📄 Full test results saved to: $TEST_RESULTS_FILE${NC}"
echo -e "\nTo view full results: ${BLUE}cat $TEST_RESULTS_FILE${NC}"

# Determine overall result
OVERALL_RESULT=0
if [ $CONNECTION_TEST_RESULT -ne 0 ] || [ $FINAL_TEST_RESULT -ne 0 ] || [ $AUTH_TEST_RESULT -ne 0 ]; then
    OVERALL_RESULT=1
fi

if [ $OVERALL_RESULT -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All tests passed! The connection status fixes are working correctly.${NC}"
else
    echo -e "\n${RED}⚠️ Some tests failed. Check the results above for details.${NC}"
fi

exit $OVERALL_RESULT