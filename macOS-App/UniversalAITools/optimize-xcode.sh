#!/bin/bash

# Xcode Optimization Script
# Configures Xcode for maximum build performance

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🛠️  Optimizing Xcode Settings...${NC}\n"

# Function to apply setting
apply_setting() {
    local setting=$1
    local value=$2
    local description=$3
    
    echo -e "${YELLOW}→${NC} $description"
    defaults write com.apple.dt.Xcode $setting $value
}

# Build Performance Settings
echo -e "${GREEN}Build Performance:${NC}"
apply_setting "IDEBuildOperationMaxNumberOfConcurrentCompileTasks" "$(sysctl -n hw.ncpu)" "Set concurrent tasks to CPU count"
apply_setting "ShowBuildOperationDuration" "YES" "Show build duration in activity viewer"
apply_setting "IDEIndexDisable" "NO" "Keep indexing enabled (set to YES for faster builds)"
apply_setting "IDEIndexerActivityShowNumericProgress" "YES" "Show indexing progress"

# Editor Performance
echo -e "\n${GREEN}Editor Performance:${NC}"
apply_setting "IDEEditorCoordinatorTarget_DoubleClickNavigates" "YES" "Double-click navigation"
apply_setting "IDEEditorCoordinatorTarget_Click" "UseTextSelectionTool" "Optimize text selection"
apply_setting "DVTTextAutoSuggestCompletionsDelay" "0.1" "Faster autocomplete"

# Debugging Settings
echo -e "\n${GREEN}Debugging Optimizations:${NC}"
apply_setting "IDEDebuggerAlwaysUseViewDebugging" "NO" "Disable always-on view debugging"
apply_setting "IDEShowPrebuildLogs" "YES" "Show prebuild logs"

# SwiftUI Previews
echo -e "\n${GREEN}SwiftUI Preview Performance:${NC}"
apply_setting "IDEPreviewCoordinator_CanvasAutoRefresh" "NO" "Disable auto-refresh for previews"

# Create optimized xcconfig file
echo -e "\n${BLUE}📝 Creating optimized build configuration...${NC}"

cat > BuildOptimizations.xcconfig << 'EOF'
// Build Optimizations Configuration
// Include this in your project for faster builds

// Compilation Mode
SWIFT_COMPILATION_MODE[config=Debug] = singlefile
SWIFT_COMPILATION_MODE[config=Release] = wholemodule

// Optimization Level
SWIFT_OPTIMIZATION_LEVEL[config=Debug] = -Onone
SWIFT_OPTIMIZATION_LEVEL[config=Release] = -O

// Build Active Architecture Only
ONLY_ACTIVE_ARCH[config=Debug] = YES
ONLY_ACTIVE_ARCH[config=Release] = NO

// Debug Information
DEBUG_INFORMATION_FORMAT[config=Debug] = dwarf
DEBUG_INFORMATION_FORMAT[config=Release] = dwarf-with-dsym

// Index Store
COMPILER_INDEX_STORE_ENABLE[config=Debug] = NO
COMPILER_INDEX_STORE_ENABLE[config=Release] = YES

// Module Optimization
SWIFT_USE_PARALLEL_WHOLE_MODULE_OPTIMIZATION = YES
SWIFT_SERIALIZE_DEBUGGING_OPTIONS = NO

// Precompiled Headers
GCC_PRECOMPILE_PREFIX_HEADER = YES
CLANG_ENABLE_MODULE_DEBUGGING[config=Debug] = NO

// Link Time Optimization
LLVM_LTO[config=Release] = YES_THIN

// Strip Symbols
STRIP_INSTALLED_PRODUCT[config=Debug] = NO
STRIP_INSTALLED_PRODUCT[config=Release] = YES

// Asset Catalog Optimization
ASSETCATALOG_COMPILER_OPTIMIZATION[config=Debug] = time
ASSETCATALOG_COMPILER_OPTIMIZATION[config=Release] = space

// Swift Flags for Debug
OTHER_SWIFT_FLAGS[config=Debug] = -Xfrontend -warn-long-function-bodies=150 -Xfrontend -warn-long-expression-type-checking=150

// Disable Swift Access Notes
SWIFT_SUPPRESS_WARNINGS = YES

// Enable Build Timing Summary
SWIFT_DRIVER_SHOW_TIMING = YES
EOF

echo -e "${GREEN}✅ Created BuildOptimizations.xcconfig${NC}"

# System optimizations
echo -e "\n${BLUE}💻 System Optimizations:${NC}"

# Check if FileVault is enabled (can slow builds)
if fdesetup status | grep -q "FileVault is On"; then
    echo -e "${YELLOW}⚠️  FileVault is enabled - this can slow down builds by 10-20%${NC}"
fi

# Check available disk space
AVAILABLE_SPACE=$(df -h / | awk 'NR==2 {print $4}')
echo -e "Available disk space: $AVAILABLE_SPACE"

# Check Spotlight indexing
if mdutil -s / | grep -q "Indexing enabled"; then
    echo -e "${YELLOW}ℹ️  Spotlight indexing is enabled for disk${NC}"
    echo "  Consider excluding DerivedData from Spotlight:"
    echo "  System Preferences → Spotlight → Privacy → Add DerivedData folder"
fi

# Create build helper aliases
echo -e "\n${BLUE}🔧 Creating build helper aliases...${NC}"

cat > build-helpers.sh << 'EOF'
#!/bin/bash

# Quick build aliases for your shell profile

# Fast debug build
alias fb="./fastbuild.sh"

# Profile build performance
alias pb="./profile-build.sh"

# Clean all derived data
alias cleandd="rm -rf ~/Library/Developer/Xcode/DerivedData/*"

# Open DerivedData folder
alias opendd="open ~/Library/Developer/Xcode/DerivedData/"

# Xcode with optimizations
alias xcode-fast="open -a Xcode --args -ShowBuildOperationDuration YES"

# Build with timing
alias build-time="xcodebuild build -showBuildTimingSummary | xcbeautify"
EOF

echo -e "${GREEN}✅ Created build-helpers.sh${NC}"
echo -e "   Add 'source build-helpers.sh' to your .zshrc or .bash_profile"

# Summary
echo -e "\n${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}                 Optimization Complete!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"

echo -e "\n${GREEN}Applied optimizations:${NC}"
echo "• Concurrent compilation set to $(sysctl -n hw.ncpu) threads"
echo "• Build timing enabled"
echo "• Created BuildOptimizations.xcconfig"
echo "• Generated build helper scripts"

echo -e "\n${GREEN}Next steps:${NC}"
echo "1. Add BuildOptimizations.xcconfig to your Xcode project"
echo "2. Run './fastbuild.sh' for quick builds"
echo "3. Run './profile-build.sh' to analyze performance"
echo "4. Source build-helpers.sh in your shell profile"

echo -e "\n${YELLOW}⚡ Restart Xcode for settings to take effect${NC}"