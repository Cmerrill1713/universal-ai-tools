#!/bin/bash

echo "🔧 Setting up code signing for UniversalAICompanion"
echo "=================================================="
echo ""
echo "Found your Apple Development certificate:"
echo "✅ cmerrill1713@gmail.com (ZUJ8AVW4ZS)"
echo ""

# The team ID from your certificate
TEAM_ID="ZUJ8AVW4ZS"
PROJECT="UniversalAICompanion.xcodeproj"

echo "Updating project with your team ID..."

# Set the development team
xcodebuild -project "$PROJECT" -target UniversalAICompanion -showBuildSettings | grep DEVELOPMENT_TEAM

echo ""
echo "To complete setup in Xcode:"
echo ""
echo "1. The project should already be open in Xcode"
echo "2. Click on 'UniversalAICompanion' in the project navigator"
echo "3. Select the 'UniversalAICompanion' target"
echo "4. Go to 'Signing & Capabilities' tab"
echo "5. Check '✓ Automatically manage signing'"
echo "6. In the Team dropdown, you should see:"
echo "   Christian Merrill (Personal Team)"
echo "   or"
echo "   cmerrill1713@gmail.com (Personal Team)"
echo ""
echo "7. Select it and Xcode will handle the rest"
echo ""
echo "If you don't see your team, click 'Add an Account...' and sign in"
echo ""

# Try to build with the team ID
echo "Attempting build with your certificate..."
xcodebuild -project "$PROJECT" \
    -scheme UniversalAICompanion \
    -destination 'generic/platform=iOS' \
    -configuration Debug \
    DEVELOPMENT_TEAM="$TEAM_ID" \
    CODE_SIGN_IDENTITY="Apple Development" \
    build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
else
    echo ""
    echo "❌ Build failed. Please complete setup in Xcode as described above."
fi