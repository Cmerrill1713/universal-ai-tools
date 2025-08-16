#!/bin/bash

# Fast Build Script for UniversalAITools
# Optimized for incremental builds during development

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Fast Build Starting...${NC}"

# Configuration
SCHEME="UniversalAITools"
CONFIGURATION="Debug"
PROJECT_PATH="UniversalAITools.xcodeproj"

# Check if xcbeautify is installed
if ! command -v xcbeautify &> /dev/null; then
    echo -e "${YELLOW}xcbeautify not found. Installing...${NC}"
    brew install xcbeautify
fi

# Check if project exists, generate if not
if [ ! -d "$PROJECT_PATH" ]; then
    echo -e "${YELLOW}Project not found. Generating with xcodegen...${NC}"
    if command -v xcodegen &> /dev/null; then
        xcodegen generate
    else
        echo -e "${RED}xcodegen not found. Please install: brew install xcodegen${NC}"
        exit 1
    fi
fi

# Build with optimizations
echo -e "${GREEN}Building with optimizations...${NC}"

BUILD_START=$(date +%s)

xcodebuild build \
    -scheme "$SCHEME" \
    -configuration "$CONFIGURATION" \
    -derivedDataPath ./DerivedData \
    -parallelizeTargets \
    -quiet \
    SWIFT_COMPILATION_MODE=singlefile \
    COMPILER_INDEX_STORE_ENABLE=NO \
    DEBUG_INFORMATION_FORMAT=dwarf \
    SWIFT_OPTIMIZATION_LEVEL=-Onone \
    | xcbeautify --quiet --simple

BUILD_END=$(date +%s)
BUILD_TIME=$((BUILD_END - BUILD_START))

echo -e "${GREEN}✅ Build completed in ${BUILD_TIME} seconds${NC}"

# Log build time
echo "$(date '+%Y-%m-%d %H:%M:%S'): ${BUILD_TIME}s" >> build-times.log

# Optional: Open app
read -p "Open app? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    open ./DerivedData/Build/Products/Debug/UniversalAITools.app
fi