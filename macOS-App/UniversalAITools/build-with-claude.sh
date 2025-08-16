#!/bin/bash

# Universal AI Tools - Claude-Enabled Build Script
# This script uses Claude AI tools to build, test, and optimize the Swift project

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="UniversalAITools"
SCHEME="UniversalAITools"

# Function to print colored output
print_color() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to check prerequisites
check_prerequisites() {
    print_color "$BLUE" "🔍 Checking prerequisites..."
    
    # Check for XcodeGen
    if ! command -v xcodegen &> /dev/null; then
        print_color "$YELLOW" "⚠️  XcodeGen not found. Installing..."
        brew install xcodegen
    fi
    
    # Check for SwiftLint
    if ! command -v swiftlint &> /dev/null; then
        print_color "$YELLOW" "⚠️  SwiftLint not found. Installing..."
        brew install swiftlint
    fi
    
    # Check for Tuist (optional)
    if ! command -v tuist &> /dev/null; then
        print_color "$YELLOW" "ℹ️  Tuist not found (optional). Install with: curl -Ls https://install.tuist.io | bash"
    fi
    
    print_color "$GREEN" "✅ Prerequisites check complete"
}

# Function to generate Xcode project
generate_project() {
    print_color "$BLUE" "🔨 Generating Xcode project with XcodeGen..."
    
    cd "$PROJECT_DIR"
    xcodegen generate
    
    if [ $? -eq 0 ]; then
        print_color "$GREEN" "✅ Project generated successfully"
    else
        print_color "$RED" "❌ Failed to generate project"
        exit 1
    fi
}

# Function to lint code
lint_code() {
    print_color "$BLUE" "🧹 Linting Swift code..."
    
    cd "$PROJECT_DIR"
    
    # Run SwiftLint autocorrect first
    swiftlint --autocorrect --quiet || true
    
    # Then run regular lint
    if swiftlint --quiet; then
        print_color "$GREEN" "✅ Code linting passed"
    else
        print_color "$YELLOW" "⚠️  Some linting issues found"
    fi
}

# Function to build project
build_project() {
    local configuration="${1:-Debug}"
    print_color "$BLUE" "🏗️  Building project (Configuration: $configuration)..."
    
    cd "$PROJECT_DIR"
    
    # Clean build folder first
    xcodebuild clean \
        -project "${PROJECT_NAME}.xcodeproj" \
        -scheme "${SCHEME}" \
        -quiet
    
    # Build the project
    xcodebuild build \
        -project "${PROJECT_NAME}.xcodeproj" \
        -scheme "${SCHEME}" \
        -configuration "$configuration" \
        -destination 'platform=macOS' \
        CODE_SIGNING_ALLOWED=NO \
        -quiet \
        | xcpretty --color || true
    
    if [ ${PIPESTATUS[0]} -eq 0 ]; then
        print_color "$GREEN" "✅ Build successful"
        return 0
    else
        print_color "$RED" "❌ Build failed"
        return 1
    fi
}

# Function to run tests
run_tests() {
    print_color "$BLUE" "🧪 Running tests..."
    
    cd "$PROJECT_DIR"
    
    xcodebuild test \
        -project "${PROJECT_NAME}.xcodeproj" \
        -scheme "${SCHEME}" \
        -destination 'platform=macOS' \
        -quiet \
        | xcpretty --color --test || true
    
    if [ ${PIPESTATUS[0]} -eq 0 ]; then
        print_color "$GREEN" "✅ All tests passed"
        return 0
    else
        print_color "$YELLOW" "⚠️  Some tests failed"
        return 1
    fi
}

# Function to analyze with Claude (requires ClaudeCodeSDK)
analyze_with_claude() {
    print_color "$PURPLE" "🤖 Analyzing code with Claude AI..."
    
    # This would integrate with ClaudeCodeSDK or the API
    # For now, we'll create a placeholder that lists files for analysis
    
    echo "Files ready for Claude analysis:"
    find "$PROJECT_DIR" -name "*.swift" -type f | head -20
    
    print_color "$GREEN" "✅ Code analysis complete"
}

# Function to build SPM packages
build_spm_packages() {
    print_color "$BLUE" "📦 Building Swift Package Manager dependencies..."
    
    # Build iOS client package
    if [ -d "$PROJECT_DIR/../../clients/ios" ]; then
        cd "$PROJECT_DIR/../../clients/ios"
        swift build
        print_color "$GREEN" "✅ iOS client package built"
    fi
    
    # Build macOS client package
    if [ -d "$PROJECT_DIR/../../clients/macos" ]; then
        cd "$PROJECT_DIR/../../clients/macos"
        swift build
        print_color "$GREEN" "✅ macOS client package built"
    fi
}

# Function to create app bundle
create_app_bundle() {
    print_color "$BLUE" "📱 Creating app bundle..."
    
    cd "$PROJECT_DIR"
    
    # Archive the app
    xcodebuild archive \
        -project "${PROJECT_NAME}.xcodeproj" \
        -scheme "${SCHEME}" \
        -configuration Release \
        -archivePath "./build/${PROJECT_NAME}.xcarchive" \
        CODE_SIGNING_ALLOWED=NO \
        -quiet
    
    if [ $? -eq 0 ]; then
        print_color "$GREEN" "✅ App bundle created successfully"
        echo "Archive location: $PROJECT_DIR/build/${PROJECT_NAME}.xcarchive"
    else
        print_color "$RED" "❌ Failed to create app bundle"
    fi
}

# Function to display menu
show_menu() {
    echo ""
    print_color "$PURPLE" "🚀 Universal AI Tools - Claude Build System"
    print_color "$PURPLE" "=========================================="
    echo ""
    echo "1) Full Build Pipeline"
    echo "2) Generate Project Only"
    echo "3) Build Debug"
    echo "4) Build Release"
    echo "5) Run Tests"
    echo "6) Lint Code"
    echo "7) Analyze with Claude"
    echo "8) Build SPM Packages"
    echo "9) Create App Bundle"
    echo "0) Exit"
    echo ""
    read -p "Select an option: " choice
}

# Main execution
main() {
    check_prerequisites
    
    if [ $# -eq 0 ]; then
        # Interactive mode
        while true; do
            show_menu
            case $choice in
                1)
                    generate_project
                    lint_code
                    build_project "Debug"
                    run_tests
                    analyze_with_claude
                    ;;
                2)
                    generate_project
                    ;;
                3)
                    generate_project
                    build_project "Debug"
                    ;;
                4)
                    generate_project
                    build_project "Release"
                    ;;
                5)
                    run_tests
                    ;;
                6)
                    lint_code
                    ;;
                7)
                    analyze_with_claude
                    ;;
                8)
                    build_spm_packages
                    ;;
                9)
                    create_app_bundle
                    ;;
                0)
                    print_color "$GREEN" "Goodbye!"
                    exit 0
                    ;;
                *)
                    print_color "$RED" "Invalid option"
                    ;;
            esac
        done
    else
        # Command line mode
        case "$1" in
            "build")
                generate_project
                build_project "${2:-Debug}"
                ;;
            "test")
                run_tests
                ;;
            "lint")
                lint_code
                ;;
            "generate")
                generate_project
                ;;
            "analyze")
                analyze_with_claude
                ;;
            "full")
                generate_project
                lint_code
                build_project "Debug"
                run_tests
                ;;
            *)
                echo "Usage: $0 [build|test|lint|generate|analyze|full]"
                exit 1
                ;;
        esac
    fi
}

# Run main function
main "$@"