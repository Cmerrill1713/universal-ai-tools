#!/bin/bash

echo "🔧 Fixing UniversalAITools Build Issues..."
echo "==========================================="

# Kill any running Xcode processes
echo "1️⃣ Stopping Xcode processes..."
killall Xcode 2>/dev/null || true
killall xcodebuild 2>/dev/null || true
sleep 2

# Clean DerivedData
echo "2️⃣ Cleaning DerivedData..."
rm -rf ~/Library/Developer/Xcode/DerivedData/UniversalAITools-*
rm -rf ~/Library/Developer/Xcode/DerivedData/Build/
rm -rf ./DerivedData
rm -rf ./build

# Clean Package caches
echo "3️⃣ Cleaning Package caches..."
rm -rf ~/Library/Caches/org.swift.swiftpm
rm -rf .swiftpm

# Navigate to project directory
cd /Users/christianmerrill/Desktop/universal-ai-tools/macOS-App/UniversalAITools

# Reset package dependencies
echo "4️⃣ Resetting package dependencies..."
rm -rf .build
rm -rf SourcePackages
rm -rf .swiftpm

# Resolve packages
echo "5️⃣ Resolving Swift packages..."
xcodebuild -resolvePackageDependencies -project UniversalAITools.xcodeproj

# Clean project
echo "6️⃣ Cleaning project..."
xcodebuild clean -project UniversalAITools.xcodeproj -scheme UniversalAITools -configuration Debug

# Build project
echo "7️⃣ Building project..."
xcodebuild build \
    -project UniversalAITools.xcodeproj \
    -scheme UniversalAITools \
    -configuration Debug \
    -derivedDataPath ./DerivedData \
    -allowProvisioningUpdates \
    COMPILER_INDEX_STORE_ENABLE=NO \
    | xcbeautify || true

echo ""
echo "✅ Build process complete!"
echo ""
echo "If build succeeded, you can open the app at:"
echo "./DerivedData/Build/Products/Debug/UniversalAITools.app"
echo ""
echo "To run the app:"
echo "open ./DerivedData/Build/Products/Debug/UniversalAITools.app"