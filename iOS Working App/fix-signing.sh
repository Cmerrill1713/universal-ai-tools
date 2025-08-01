#!/bin/bash

echo "🔧 Fixing iOS App Signing Issues"
echo "================================"
echo ""

# Get the project path
PROJECT_PATH="UniversalAICompanion.xcodeproj"
PLIST_PATH="UniversalAICompanion/Info.plist"

# Check if running on physical device or simulator
echo "Choose your deployment target:"
echo "1) iPhone Simulator (no signing required)"
echo "2) Physical iPhone (requires Apple ID)"
echo ""
read -p "Enter choice (1 or 2): " choice

if [ "$choice" = "1" ]; then
    echo ""
    echo "✅ Building for Simulator..."
    echo ""
    
    # Kill any existing simulator
    xcrun simctl shutdown all 2>/dev/null
    
    # Build for simulator
    xcodebuild -scheme UniversalAICompanion \
        -destination 'platform=iOS Simulator,name=iPhone 16' \
        -configuration Debug \
        clean build
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Build successful!"
        echo ""
        echo "Installing to simulator..."
        
        # Boot simulator
        xcrun simctl boot "iPhone 16" 2>/dev/null
        open -a Simulator
        
        # Install app
        APP_PATH=$(find ~/Library/Developer/Xcode/DerivedData -name "UniversalAICompanion.app" -path "*/Debug-iphonesimulator/*" | head -1)
        xcrun simctl install booted "$APP_PATH"
        xcrun simctl launch booted com.universalaitools.companion
        
        echo "✅ App launched in simulator!"
    else
        echo "❌ Build failed"
    fi
    
elif [ "$choice" = "2" ]; then
    echo ""
    echo "📱 Setting up for Physical Device"
    echo ""
    echo "You need to:"
    echo ""
    echo "1. Open Xcode (it should already be open)"
    echo "2. Click on 'UniversalAICompanion' project in navigator"
    echo "3. Select 'UniversalAICompanion' target"
    echo "4. Go to 'Signing & Capabilities' tab"
    echo "5. Check 'Automatically manage signing'"
    echo "6. Click 'Team' dropdown and either:"
    echo "   - Select your existing Apple ID"
    echo "   - Click 'Add an Account...' to sign in"
    echo ""
    echo "Common Apple ID formats:"
    echo "- Personal: your-email@icloud.com"
    echo "- Developer: your-email@company.com"
    echo ""
    echo "After setting up signing, press Run (▶️) in Xcode"
    echo ""
    echo "First time running on device:"
    echo "1. You'll see 'Untrusted Developer' on your iPhone"
    echo "2. Go to Settings → General → VPN & Device Management"
    echo "3. Trust your developer certificate"
    echo "4. Run again from Xcode"
    
    # Open project in Xcode
    open "$PROJECT_PATH"
else
    echo "Invalid choice"
fi

echo ""
echo "📡 Network Configuration:"
echo "- Current server URL: http://169.254.105.52:9999"
echo "- Make sure your iPhone and Mac are on same WiFi"
echo "- Server must be running: npm run dev"
echo ""