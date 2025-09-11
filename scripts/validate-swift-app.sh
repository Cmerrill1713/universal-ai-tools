#!/bin/bash

# Swift Companion App Validation Script
# Ensures agents actually create and test Swift files

set -e

echo "🍎 Universal AI Tools - Swift App Validation"
echo "============================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
  echo "❌ Error: Run this script from the project root"
  exit 1
fi

# Check workspace
WORKSPACE="UniversalAITools.xcworkspace"
if [ ! -d "$WORKSPACE" ]; then
  echo "❌ Workspace not found: $WORKSPACE"
  echo "   Agent may not have created the workspace!"
  exit 1
fi
echo "✅ Found workspace: $WORKSPACE"

# Check package structure
PACKAGE_DIR="UniversalAIToolsPackage"
if [ ! -d "$PACKAGE_DIR" ]; then
  echo "❌ Package directory not found: $PACKAGE_DIR"
  echo "   Agent may not have set up the package structure!"
  exit 1
fi
echo "✅ Found package directory: $PACKAGE_DIR"

# Check for Package.swift
if [ ! -f "$PACKAGE_DIR/Package.swift" ]; then
  echo "❌ Package.swift not found"
  echo "   Agent didn't create a proper Swift Package!"
  exit 1
fi
echo "✅ Found Package.swift"

# Count Swift files
SWIFT_COUNT=$(find "$PACKAGE_DIR" -name "*.swift" 2>/dev/null | wc -l | tr -d ' ')
echo "📁 Found $SWIFT_COUNT Swift files in package"

if [ "$SWIFT_COUNT" -lt 3 ]; then
  echo "⚠️  Warning: Very few Swift files found ($SWIFT_COUNT)"
  echo "   Agent may not have implemented required features!"
fi

# Check for required authentication files
echo ""
echo "🔐 Checking authentication implementation..."

AUTH_FILES=(
  "$PACKAGE_DIR/Sources/Authentication/BluetoothAuthManager.swift"
  "$PACKAGE_DIR/Sources/Authentication/BiometricAuthManager.swift"
  "$PACKAGE_DIR/Sources/WatchConnectivity/WatchSessionManager.swift"
  "$PACKAGE_DIR/Sources/WebSocket/WebSocketService.swift"
)

MISSING_FILES=0
for file in "${AUTH_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "❌ Missing: $file"
    MISSING_FILES=$((MISSING_FILES + 1))
  else
    SIZE=$(stat -f%z "$file" 2>/dev/null || echo "0")
    if [ "$SIZE" -eq 0 ]; then
      echo "⚠️  Empty file: $file"
    else
      echo "✅ Found: $file ($SIZE bytes)"
    fi
  fi
done

if [ "$MISSING_FILES" -gt 0 ]; then
  echo "⚠️  Warning: $MISSING_FILES authentication files missing"
  echo "   Agent may not have fully implemented the companion app!"
fi

# Check if schemes exist
echo ""
echo "🎯 Checking build schemes..."
if command -v xcodebuild >/dev/null 2>&1; then
  SCHEMES=$(xcodebuild -workspace "$WORKSPACE" -list 2>/dev/null | grep -A 100 "Schemes:" | tail -n +2 | grep -v "^$" | head -10)
  if [ -z "$SCHEMES" ]; then
    echo "❌ No schemes found in workspace"
    echo "   Agent may not have configured the project properly!"
  else
    echo "✅ Available schemes:"
    echo "$SCHEMES" | sed 's/^/   /'
  fi
else
  echo "⚠️  xcodebuild not available, skipping scheme check"
fi

# Try to build the package
echo ""
echo "🔨 Testing Swift package build..."
cd "$PACKAGE_DIR"

if swift package resolve; then
  echo "✅ Package dependencies resolved"
else
  echo "❌ Package dependency resolution failed"
  echo "   Agent may have created invalid Package.swift!"
  cd ..
  exit 1
fi

if swift build; then
  echo "✅ Swift package builds successfully"
else
  echo "❌ Swift package build failed"
  echo "   Agent created code that doesn't compile!"
  cd ..
  exit 1
fi

# Try to run tests
echo ""
echo "🧪 Running Swift package tests..."
if swift test; then
  echo "✅ Swift tests passed"
else
  echo "⚠️  Swift tests failed or no tests found"
  echo "   Agent should create tests for new code!"
fi

cd ..

# Try workspace build (if on macOS with Xcode)
if command -v xcodebuild >/dev/null 2>&1; then
  echo ""
  echo "🏗️  Testing workspace build..."
  
  # Check if iOS Simulator is available
  SIMULATOR=$(xcrun simctl list devices available | grep iPhone | head -1 | sed 's/.*iPhone/iPhone/' | sed 's/ (.*//')
  
  if [ ! -z "$SIMULATOR" ]; then
    echo "📱 Using simulator: $SIMULATOR"
    
    # Try to build for simulator
    if xcodebuild -workspace "$WORKSPACE" -scheme "UniversalAITools" -destination "platform=iOS Simulator,name=$SIMULATOR" build >/dev/null 2>&1; then
      echo "✅ Workspace builds for iOS Simulator"
    else
      echo "❌ Workspace build failed for iOS Simulator"
      echo "   Agent may have created invalid Xcode configuration!"
      exit 1
    fi
  else
    echo "⚠️  No iOS Simulator available, skipping build test"
  fi
else
  echo "⚠️  Xcode not available, skipping workspace build"
fi

# Check for common Swift issues
echo ""
echo "🔍 Checking for common issues..."

# Check for empty implementations
EMPTY_IMPLEMENTATIONS=$(find "$PACKAGE_DIR" -name "*.swift" -exec grep -l "// TODO\|fatalError\|unimplemented" {} \; 2>/dev/null | wc -l | tr -d ' ')
if [ "$EMPTY_IMPLEMENTATIONS" -gt 0 ]; then
  echo "⚠️  Warning: $EMPTY_IMPLEMENTATIONS files contain TODO/unimplemented markers"
  echo "   Agent may not have fully implemented features!"
fi

# Check for proper imports
MISSING_IMPORTS=$(find "$PACKAGE_DIR" -name "*.swift" -exec grep -L "import Foundation\|import SwiftUI\|import UIKit" {} \; 2>/dev/null | wc -l | tr -d ' ')
if [ "$MISSING_IMPORTS" -gt 0 ]; then
  echo "⚠️  Warning: $MISSING_IMPORTS Swift files may be missing required imports"
fi

# Check file sizes (detect empty or skeleton files)
SMALL_FILES=$(find "$PACKAGE_DIR" -name "*.swift" -size -500c 2>/dev/null | wc -l | tr -d ' ')
if [ "$SMALL_FILES" -gt 2 ]; then
  echo "⚠️  Warning: $SMALL_FILES very small Swift files found"
  echo "   Agent may have created skeleton files without implementation!"
fi

# Generate summary
echo ""
echo "📊 VALIDATION SUMMARY"
echo "===================="
echo "Swift files found: $SWIFT_COUNT"
echo "Missing auth files: $MISSING_FILES"
echo "Empty implementations: $EMPTY_IMPLEMENTATIONS"
echo "Small files: $SMALL_FILES"

# Determine overall status
WARNINGS=0
ERRORS=0

if [ "$SWIFT_COUNT" -lt 5 ]; then
  WARNINGS=$((WARNINGS + 1))
fi

if [ "$MISSING_FILES" -gt 2 ]; then
  ERRORS=$((ERRORS + 1))
fi

if [ "$EMPTY_IMPLEMENTATIONS" -gt 3 ]; then
  WARNINGS=$((WARNINGS + 1))
fi

echo ""
if [ "$ERRORS" -gt 0 ]; then
  echo "❌ VALIDATION FAILED"
  echo "   Critical issues found. Agent did not properly implement the Swift app!"
  exit 1
elif [ "$WARNINGS" -gt 2 ]; then
  echo "⚠️  VALIDATION PASSED WITH WARNINGS"
  echo "   Some issues found. Agent should address warnings."
  exit 0
else
  echo "✅ VALIDATION PASSED"
  echo "   Swift companion app appears to be properly implemented!"
fi

echo ""
echo "📝 Next steps:"
echo "   1. Test the app in iOS Simulator"
echo "   2. Verify authentication features work"
echo "   3. Test on physical device if possible"
echo "   4. Address any warnings found"