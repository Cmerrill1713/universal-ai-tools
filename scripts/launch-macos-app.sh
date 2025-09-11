#!/bin/bash

# Launch macOS Universal AI Tools App
# This script helps with development and testing

set -e

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MACOS_APP_DIR="$PROJECT_ROOT/UniversalAIToolsMacPackage"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🖥️  Universal AI Tools - macOS App Launcher${NC}"
echo "==============================================="
echo ""

# Function to check if Xcode is available
check_xcode() {
    if ! command -v xcodebuild &> /dev/null; then
        echo -e "${RED}❌ Xcode is not installed or not in PATH${NC}"
        echo "Please install Xcode from the App Store or download from developer.apple.com"
        exit 1
    fi

    if ! xcodebuild -version &> /dev/null; then
        echo -e "${RED}❌ Xcode command line tools are not installed${NC}"
        echo "Run: xcode-select --install"
        exit 1
    fi
}

# Function to check if backend is running
check_backend() {
    echo -e "${BLUE}🔍 Checking if backend is running...${NC}"

    if curl -s http://localhost:9998/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend is running on port 9998${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  Backend not detected on port 9998${NC}"
        echo "Make sure to start the backend first:"
        echo "  cd $PROJECT_ROOT && ./scripts/start-quick.sh"
        echo ""
        echo -e "${YELLOW}Continuing anyway - app will show connection error...${NC}"
        return 1
    fi
}

# Function to build and run the app
build_and_run() {
    echo -e "${BLUE}🏗️  Building and launching macOS app...${NC}"

    cd "$MACOS_APP_DIR"

    # Clean build
    echo "Cleaning previous build..."
    rm -rf .build
    rm -rf DerivedData

    # Build and run
    echo "Building Universal AI Tools macOS app..."

    if xcodebuild -workspace "../UniversalAIToolsMac.xcworkspace" \
                  -scheme "UniversalAIToolsMac" \
                  -configuration "Debug" \
                  -destination "platform=macOS" \
                  build; then

        echo -e "${GREEN}✅ Build successful!${NC}"

        # Try to launch the app
        echo "Launching app..."
        if open "$MACOS_APP_DIR/build/Debug/UniversalAIToolsMac.app" 2>/dev/null; then
            echo -e "${GREEN}✅ App launched successfully!${NC}"
        else
            echo -e "${YELLOW}⚠️  Could not auto-launch app${NC}"
            echo "You can find the built app at:"
            echo "  $MACOS_APP_DIR/build/Debug/UniversalAIToolsMac.app"
        fi
    else
        echo -e "${RED}❌ Build failed${NC}"
        echo "Check the error messages above for details"
        echo ""
        echo -e "${YELLOW}Common issues:${NC}"
        echo "  - Make sure Swift is properly installed"
        echo "  - Check if all dependencies are available"
        echo "  - Verify Xcode project configuration"
        exit 1
    fi
}

# Function to show usage
usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --help, -h          Show this help message"
    echo "  --skip-backend      Skip backend connectivity check"
    echo "  --clean             Clean all build artifacts first"
    echo ""
    echo "Examples:"
    echo "  $0                    # Normal build and launch"
    echo "  $0 --clean           # Clean build first"
    echo "  $0 --skip-backend    # Skip backend check"
    echo ""
}

# Parse command line arguments
SKIP_BACKEND=false
CLEAN_FIRST=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            usage
            exit 0
            ;;
        --skip-backend)
            SKIP_BACKEND=true
            shift
            ;;
        --clean)
            CLEAN_FIRST=true
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            usage
            exit 1
            ;;
    esac
done

# Main execution
main() {
    echo "Project root: $PROJECT_ROOT"
    echo "macOS app directory: $MACOS_APP_DIR"
    echo ""

    # Prerequisites
    check_xcode

    if [[ "$SKIP_BACKEND" == false ]]; then
        check_backend
    fi

    # Clean if requested
    if [[ "$CLEAN_FIRST" == true ]]; then
        echo -e "${YELLOW}🧹 Cleaning build artifacts...${NC}"
        cd "$MACOS_APP_DIR"
        rm -rf .build
        rm -rf DerivedData
        rm -rf build
        echo -e "${GREEN}✅ Cleaned${NC}"
        echo ""
    fi

    # Build and run
    build_and_run

    echo ""
    echo -e "${GREEN}🎉 macOS app build and launch process complete!${NC}"
    echo ""
    echo -e "${BLUE}📱 App Features:${NC}"
    echo "  • Real-time chat with AI agents"
    echo "  • Conversation and task management"
    echo "  • MCP (Model Context Protocol) integration"
    echo "  • Connection monitoring and health checks"
    echo "  • WebSocket support for live updates"
    echo ""
    echo -e "${BLUE}🔗 Backend Integration:${NC}"
    echo "  • Connects to backend on http://localhost:9998"
    echo "  • Supports chat, conversations, tasks, and projects"
    echo "  • AI agent-controlled update system"
    echo ""
    echo -e "${BLUE}🛠️  Development Tips:${NC}"
    echo "  • Use Xcode for debugging and development"
    echo "  • Check console logs for connection issues"
    echo "  • Backend must be running for full functionality"
    echo "  • Use 'tail -f' on backend logs to monitor requests"
    echo ""
}

# Run main function
main
