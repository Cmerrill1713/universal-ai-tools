# 🚀 Build Speed Optimization Guide

This guide provides tools and configurations to dramatically speed up your Swift/SwiftUI build times.

## 📊 Current Build Performance Baseline

Before optimizing, measure your current build times:
```bash
# Clean build time
time xcodebuild clean build -scheme UniversalAITools

# Incremental build time
touch macOS-App/UniversalAITools/ContentView.swift
time xcodebuild build -scheme UniversalAITools
```

## 🛠️ Optimization Tools & Setup

### 1. **XcodeGen** - Project Generation (Already in use)
Generates Xcode project files from YAML specification:
```bash
# Install if not already
brew install xcodegen

# Generate project
cd macOS-App/UniversalAITools
xcodegen generate
```

### 2. **xcbeautify** - Better Build Output
Faster alternative to xcpretty, written in Swift:
```bash
# Install
brew install xcbeautify

# Use with xcodebuild
xcodebuild build -scheme UniversalAITools | xcbeautify

# With specific options
xcodebuild build -scheme UniversalAITools | xcbeautify --quiet --simple
```

### 3. **BuildTimeAnalyzer** - Identify Slow Code
```bash
# Install via Homebrew
brew install buildtimeanalyzer-for-xcode

# Or download from Mac App Store
# "Build Time Analyzer for Xcode"
```

### 4. **periphery** - Remove Unused Code
```bash
# Install
brew install peripheryapp/periphery/periphery

# Scan for unused code
periphery scan --project macOS-App/UniversalAITools/UniversalAITools.xcodeproj

# With specific targets
periphery scan --schemes UniversalAITools --targets UniversalAITools
```

### 5. **SwiftFormat** - Code Formatting
```bash
# Install
brew install swiftformat

# Format code (can speed up compilation)
swiftformat macOS-App/UniversalAITools --swiftversion 6.0
```

## ⚡ Xcode Build Settings Optimization

Add these to your `project.yml` (XcodeGen) or set in Xcode:

```yaml
settings:
  base:
    # Build Settings for Speed
    SWIFT_COMPILATION_MODE: 
      Debug: singlefile  # Faster incremental builds
      Release: wholemodule  # Better optimization
    
    SWIFT_OPTIMIZATION_LEVEL:
      Debug: -Onone  # No optimization for faster builds
      Release: -O  # Optimize for release
    
    # Enable build timing
    OTHER_SWIFT_FLAGS:
      Debug:
        - "-Xfrontend"
        - "-warn-long-function-bodies=100"
        - "-Xfrontend"
        - "-warn-long-expression-type-checking=100"
        - "-driver-time-compilation"
        - "-Xfrontend"
        - "-debug-time-function-bodies"
    
    # Parallel builds
    SWIFT_USE_PARALLEL_WHOLE_MODULE_OPTIMIZATION: YES
    
    # Module optimization
    SWIFT_SERIALIZE_DEBUGGING_OPTIONS: NO
    
    # Disable dSYM for debug builds
    DEBUG_INFORMATION_FORMAT:
      Debug: dwarf
      Release: dwarf-with-dsym
    
    # Index while building (disable for faster builds)
    COMPILER_INDEX_STORE_ENABLE:
      Debug: NO
      Release: YES
```

## 🏗️ Build Phase Optimizations

### 1. **Conditional Run Scripts**
Only run scripts when necessary:

```bash
# In your Run Script build phase
if [ "${CONFIGURATION}" = "Release" ]; then
    # Run SwiftLint only for release builds
    swiftlint
fi

# Or check for changed files
if git diff --name-only HEAD^ | grep -q ".swift"; then
    swiftlint lint --path "${SRCROOT}"
fi
```

### 2. **Optimize SwiftLint**
Create `.swiftlint.yml`:
```yaml
# Only lint changed files in debug
included:
  - macOS-App/UniversalAITools
excluded:
  - ${DERIVED_DATA}
  - Carthage
  - Pods
  - .build
  - DerivedData

# Disable expensive rules for debug
disabled_rules:
  - type_body_length
  - file_length
  - function_body_length
  - cyclomatic_complexity
```

## 🔧 Code-Level Optimizations

### 1. **Type Annotations**
Help the compiler with explicit types:
```swift
// Slow
let result = array.map { $0.value }.filter { $0 > 10 }.reduce(0, +)

// Fast
let mapped: [Int] = array.map { $0.value }
let filtered: [Int] = mapped.filter { $0 > 10 }
let result: Int = filtered.reduce(0, +)
```

### 2. **Avoid Complex Expressions**
```swift
// Slow
let value = condition ? (otherCondition ? valueA : valueB) : (thirdCondition ? valueC : valueD)

// Fast
let value: String
if condition {
    value = otherCondition ? valueA : valueB
} else {
    value = thirdCondition ? valueC : valueD
}
```

### 3. **Extract Complex View Bodies**
```swift
// Instead of one massive body
var body: some View {
    // 200 lines of code
}

// Break into computed properties
var body: some View {
    VStack {
        headerSection
        contentSection
        footerSection
    }
}

private var headerSection: some View { /* ... */ }
private var contentSection: some View { /* ... */ }
private var footerSection: some View { /* ... */ }
```

## 📦 Dependency Management

### 1. **Swift Package Manager** (Recommended)
- Caches built products
- Better incremental compilation
- Parallel package resolution

### 2. **Pre-compiled Frameworks**
For stable dependencies, pre-compile them:
```bash
# Build framework once
xcodebuild archive -scheme MyFramework -archivePath MyFramework.xcarchive

# Use the built framework instead of source
```

## 🎯 Modularization Strategy

Split your app into modules for parallel compilation:

```
UniversalAITools/
├── UniversalAIToolsCore/        # Core models and utilities
├── UniversalAIToolsUI/          # UI components
├── UniversalAIToolsServices/    # API and services
├── UniversalAIToolsApp/         # Main app target
```

Each module builds independently and in parallel.

## 🖥️ Hardware Optimization

### 1. **Increase Xcode's Thread Count**
```bash
# Check current setting
defaults read com.apple.dt.Xcode IDEBuildOperationMaxNumberOfConcurrentCompileTasks

# Set to number of cores (e.g., 8 for M1 Pro)
defaults write com.apple.dt.Xcode IDEBuildOperationMaxNumberOfConcurrentCompileTasks 8
```

### 2. **RAM Disk for DerivedData**
```bash
# Create 4GB RAM disk
diskutil erasevolume HFS+ 'DerivedData' `hdiutil attach -nomount ram://8388608`

# Set Xcode to use it
defaults write com.apple.dt.Xcode IDECustomDerivedDataLocation /Volumes/DerivedData
```

### 3. **Disable Indexing** (Temporary for faster builds)
```bash
defaults write com.apple.dt.Xcode IDEIndexDisable 1
```

## 📈 Continuous Monitoring

### 1. **Build Time Tracking Script**
Create `track-build-time.sh`:
```bash
#!/bin/bash
BUILD_START=$(date +%s)
xcodebuild build -scheme UniversalAITools | xcbeautify
BUILD_END=$(date +%s)
BUILD_TIME=$((BUILD_END - BUILD_START))

echo "Build completed in ${BUILD_TIME} seconds"
echo "$(date): ${BUILD_TIME}s" >> build-times.log
```

### 2. **Xcode Build Timeline**
```bash
# Enable build timeline
defaults write com.apple.dt.Xcode ShowBuildOperationDuration YES
```

## 🚄 Advanced: Bazel + BuildBuddy (Enterprise)

For large teams and CI/CD:

### 1. **Install Bazel**
```bash
brew install bazel
```

### 2. **Setup rules_apple**
Create `WORKSPACE`:
```python
load("@bazel_tools//tools/build_defs/repo:http.bzl", "http_archive")

http_archive(
    name = "build_bazel_rules_apple",
    url = "https://github.com/bazelbuild/rules_apple/releases/download/3.1.1/rules_apple.3.1.1.tar.gz",
)
```

### 3. **BuildBuddy Integration**
- Sign up at https://buildbuddy.io
- Configure remote caching
- Enable remote build execution

## 📊 Expected Improvements

With these optimizations, you should see:
- **Clean builds**: 30-50% faster
- **Incremental builds**: 60-80% faster
- **SwiftUI previews**: 40-60% faster
- **Unit tests**: 50-70% faster

## 🔍 Debugging Slow Builds

### 1. **Find Slow Functions**
```bash
xcodebuild build -scheme UniversalAITools | grep ".*ms" | sort -rn | head -20
```

### 2. **Profile with Instruments**
```bash
xcrun xctrace record --template "Time Profiler" --launch -- xcodebuild build
```

### 3. **Check Type-Checking Time**
Look for warnings in Xcode about functions/expressions taking >100ms to type-check.

## 🎯 Quick Wins Checklist

- [ ] Install xcbeautify for better output
- [ ] Add type annotations to complex expressions
- [ ] Break up large SwiftUI view bodies
- [ ] Disable indexing for debug builds
- [ ] Set SWIFT_COMPILATION_MODE to singlefile for debug
- [ ] Use Swift Package Manager instead of CocoaPods
- [ ] Run SwiftLint only on changed files
- [ ] Remove unused code with periphery
- [ ] Enable parallel builds
- [ ] Increase thread count for your CPU

## 📚 Additional Resources

- [Optimizing Swift Build Times](https://github.com/fastred/Optimizing-Swift-Build-Times)
- [Build Performance Analysis](https://www.avanderlee.com/optimization/analysing-build-performance-xcode/)
- [Swift Forums - Compilation](https://forums.swift.org/c/development/compiler)