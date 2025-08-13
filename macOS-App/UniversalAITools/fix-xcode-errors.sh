#!/bin/bash

echo "🔧 Fixing Xcode indexing and SourceKit errors..."

# 1. Kill SourceKit service to force restart
echo "Restarting SourceKit..."
killall SourceKitService 2>/dev/null || true

# 2. Clear all derived data
echo "Clearing derived data..."
rm -rf ~/Library/Developer/Xcode/DerivedData/UniversalAITools-*
rm -rf ~/Library/Developer/Xcode/DerivedData/ModuleCache.noindex

# 3. Clear Xcode caches
echo "Clearing Xcode caches..."
rm -rf ~/Library/Caches/com.apple.dt.Xcode

# 4. Regenerate Xcode project
echo "Regenerating Xcode project..."
cd "$(dirname "$0")"
xcodegen generate

# 5. Build from command line to ensure everything compiles
echo "Building project to verify compilation..."
xcodebuild -project UniversalAITools.xcodeproj -scheme UniversalAITools -configuration Debug build CODE_SIGNING_ALLOWED=NO > /tmp/build.log 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Build succeeded! The red error indicators in Xcode should now be resolved."
    echo ""
    echo "Next steps:"
    echo "1. Quit Xcode completely (Cmd+Q)"
    echo "2. Reopen the project"
    echo "3. Wait for indexing to complete (progress bar at top of Xcode)"
    echo "4. If errors persist, try: Product → Clean Build Folder (Cmd+Shift+K)"
else
    echo "❌ Build failed. Check /tmp/build.log for details."
    tail -20 /tmp/build.log
fi