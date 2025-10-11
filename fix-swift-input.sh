#!/bin/bash

echo "🔧 FIXING SWIFT FRONTEND INPUT ISSUES"
echo "====================================="

# 1. Kill existing UniversalAITools processes
echo "Stopping existing UniversalAITools processes..."
pkill -f UniversalAITools 2>/dev/null || true
sleep 2

# 2. Rebuild the Swift app
echo "Rebuilding Swift frontend..."
cd UniversalAIToolsApp
swift build --configuration release
cd ..

# 3. Launch the app
echo "Launching UniversalAITools..."
open -a UniversalAITools 2>/dev/null || \
    open UniversalAIToolsApp/.build/release/UniversalAITools 2>/dev/null || \
    echo "Please launch the app manually from Xcode"

# 4. Bring app to front
echo "Bringing app to front..."
sleep 3
osascript -e 'tell application "UniversalAITools" to activate' 2>/dev/null || \
    echo "Could not activate app automatically"

echo "✅ Swift frontend fixes applied!"
echo ""
echo "If you still can't type:"
echo "1. Check System Preferences > Security & Privacy > Accessibility"
echo "2. Make sure UniversalAITools is enabled"
echo "3. Try clicking in the text field to focus it"
echo "4. Restart the app if needed"

