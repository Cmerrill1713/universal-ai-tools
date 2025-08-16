#!/bin/bash

# Build Profiling Script
# Analyzes and reports on build performance

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}        Build Performance Profiler${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}\n"

# Configuration
SCHEME="UniversalAITools"
PROJECT="UniversalAITools.xcodeproj"

# Clean DerivedData
echo -e "${YELLOW}📦 Cleaning DerivedData...${NC}"
rm -rf DerivedData
rm -rf ~/Library/Developer/Xcode/DerivedData/*UniversalAITools*

# Profile clean build
echo -e "\n${GREEN}🏗️  Profiling Clean Build...${NC}"
CLEAN_START=$(date +%s)

xcodebuild clean build \
    -scheme "$SCHEME" \
    -configuration Debug \
    -derivedDataPath ./DerivedData \
    -showBuildTimingSummary \
    OTHER_SWIFT_FLAGS="-Xfrontend -warn-long-function-bodies=100 -Xfrontend -warn-long-expression-type-checking=100 -driver-time-compilation" \
    2>&1 | tee clean-build.log | grep -E "(^CompileSwift|^Ld |^CodeSign|^PhaseScript|^ProcessInfoPlistFile|function bodies|expression type checking|driver time)" || true

CLEAN_END=$(date +%s)
CLEAN_TIME=$((CLEAN_END - CLEAN_START))

# Make a small change for incremental build
echo -e "\n${GREEN}📝 Making small change for incremental build test...${NC}"
echo "// Build profiling test - $(date)" >> Views/ContentView.swift

# Profile incremental build
echo -e "\n${GREEN}🔄 Profiling Incremental Build...${NC}"
INCREMENTAL_START=$(date +%s)

xcodebuild build \
    -scheme "$SCHEME" \
    -configuration Debug \
    -derivedDataPath ./DerivedData \
    -showBuildTimingSummary \
    2>&1 | tee incremental-build.log | grep -E "(^CompileSwift|^Ld |^CodeSign|driver time)" || true

INCREMENTAL_END=$(date +%s)
INCREMENTAL_TIME=$((INCREMENTAL_END - INCREMENTAL_START))

# Remove test change
git checkout -- Views/ContentView.swift 2>/dev/null || true

# Find slow-compiling files
echo -e "\n${YELLOW}🐌 Analyzing Slow-Compiling Files...${NC}"
if [ -f clean-build.log ]; then
    echo "Files taking >1000ms to compile:"
    grep -E "^\[.*\][[:space:]]+[0-9]+\.[0-9]+ms" clean-build.log | sort -t' ' -k2 -rn | head -10 || echo "No slow files detected"
fi

# Check for type-checking warnings
echo -e "\n${YELLOW}⚠️  Type-Checking Warnings:${NC}"
grep -E "(warning:.*took [0-9]+ms|type-check)" clean-build.log 2>/dev/null | head -10 || echo "No type-checking warnings"

# Generate report
echo -e "\n${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}                 Build Performance Report${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"

echo -e "\n${GREEN}Clean Build Time:${NC} ${CLEAN_TIME} seconds"
echo -e "${GREEN}Incremental Build Time:${NC} ${INCREMENTAL_TIME} seconds"

if [ $INCREMENTAL_TIME -lt 10 ]; then
    echo -e "\n${GREEN}✅ Excellent incremental build performance!${NC}"
elif [ $INCREMENTAL_TIME -lt 30 ]; then
    echo -e "\n${YELLOW}⚡ Good incremental build performance${NC}"
else
    echo -e "\n${RED}⚠️  Incremental build could be optimized${NC}"
fi

# Recommendations
echo -e "\n${BLUE}📋 Recommendations:${NC}"

if [ $CLEAN_TIME -gt 120 ]; then
    echo "• Consider modularizing your code into frameworks"
    echo "• Review and optimize SwiftLint rules"
    echo "• Check for complex type inference in SwiftUI views"
fi

if [ $INCREMENTAL_TIME -gt 30 ]; then
    echo "• Enable SWIFT_COMPILATION_MODE = singlefile for Debug"
    echo "• Disable COMPILER_INDEX_STORE_ENABLE for Debug"
    echo "• Review dependencies and consider pre-compilation"
fi

# Save to log
echo -e "\n${GREEN}📊 Saving results to build-performance.log${NC}"
{
    echo "Build Performance Report - $(date)"
    echo "================================"
    echo "Clean Build: ${CLEAN_TIME}s"
    echo "Incremental Build: ${INCREMENTAL_TIME}s"
    echo ""
} >> build-performance.log

# Cleanup
rm -f clean-build.log incremental-build.log

echo -e "\n${GREEN}✅ Profiling complete!${NC}"