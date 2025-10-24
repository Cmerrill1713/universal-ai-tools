#!/bin/bash

# Native macOS SwiftUI App Playwright MCP Test Runner
set -e

echo "🧪 Testing Native macOS SwiftUI App with Playwright MCP..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if Playwright is installed
if ! command -v npx &> /dev/null; then
    print_error "npx is not available. Please install Node.js and try again."
    exit 1
fi

# Check if Swift is installed
if ! command -v swift &> /dev/null; then
    print_error "Swift is not installed. Please install Swift and try again."
    exit 1
fi

print_step "1. Building Swift package..."
cd UniversalAIToolsMacPackage
swift build

if [ $? -eq 0 ]; then
    print_status "✅ Swift package built successfully!"
else
    print_error "❌ Failed to build Swift package"
    exit 1
fi

print_step "2. Installing Playwright dependencies..."
cd ..
npm install @playwright/test

print_step "3. Installing Playwright browsers..."
npx playwright install

print_step "4. Running Native macOS App tests..."
npx playwright test --config=playwright-macos-native.config.ts

TEST_RESULT=$?

if [ $TEST_RESULT -eq 0 ]; then
    print_status "🎉 All Native macOS App tests passed successfully!"
else
    print_warning "⚠️  Some tests failed, but continuing..."
fi

print_step "5. Generating test report..."
if [ -d "test-results/macos-native" ]; then
    print_status "📊 Test results available in test-results/macos-native/"

    # Open HTML report if available
    if [ -f "test-results/macos-native/results.html" ]; then
        print_status "Opening test report..."
        open test-results/macos-native/results.html
    fi
fi

print_status "✅ Native macOS SwiftUI App Playwright MCP testing completed!"
print_status "📱 App tested: UniversalAIToolsMac"
print_status "🔧 Test framework: Playwright MCP"
print_status "📊 Results: test-results/macos-native/"
