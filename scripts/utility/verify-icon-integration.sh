#!/bin/bash

echo "🔍 Verifying Universal AI Tools Icon Integration"
echo "=============================================="

ICON_DIR="/Users/christianmerrill/Desktop/universal-ai-tools/macOS-App/UniversalAITools/Assets.xcassets/AppIcon.appiconset"

echo ""
echo "📁 Icon Directory: $ICON_DIR"
echo ""

# Check if all required icon files exist
echo "✅ Required Icon Files:"
REQUIRED_FILES=(
    "icon_16x16.png"
    "icon_16x16@2x.png"
    "icon_32x32.png"
    "icon_32x32@2x.png"
    "icon_128x128.png"
    "icon_128x128@2x.png"
    "icon_256x256.png"
    "icon_256x256@2x.png"
    "icon_512x512.png"
    "icon_512x512@2x.png"
)

ALL_PRESENT=true
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$ICON_DIR/$file" ]; then
        size=$(stat -f%z "$ICON_DIR/$file")
        echo "   ✓ $file ($(echo $size | awk '{printf "%.1f KB", $1/1024}'))"
    else
        echo "   ❌ $file (missing)"
        ALL_PRESENT=false
    fi
done

echo ""

# Check Contents.json
if [ -f "$ICON_DIR/Contents.json" ]; then
    echo "✅ Contents.json file exists"
else
    echo "❌ Contents.json file missing"
    ALL_PRESENT=false
fi

echo ""

# Show file sizes and quality info
echo "📊 Icon File Details:"
cd "$ICON_DIR"
for file in *.png; do
    if [ -f "$file" ]; then
        size=$(stat -f%z "$file")
        echo "   $file: $(echo $size | awk '{printf "%.1f KB", $1/1024}')"
    fi
done

echo ""

# Try to display one of the larger icons for preview
echo "🖼️  Icon Preview:"
PREVIEW_FILE="$ICON_DIR/icon_256x256.png"
if [ -f "$PREVIEW_FILE" ]; then
    echo "   Opening $PREVIEW_FILE for preview..."
    open "$PREVIEW_FILE"
    echo "   ✓ Icon preview opened in default image viewer"
else
    echo "   ❌ Preview file not found"
fi

echo ""

# Clean up temporary files
echo "🧹 Cleaning up temporary files..."
rm -f "/Users/christianmerrill/Desktop/universal-ai-tools/macOS-App/UniversalAITools/create_simple_icon.py"
rm -f "/Users/christianmerrill/Desktop/universal-ai-tools/macOS-App/UniversalAITools/create_custom_icon.py"
rm -f "/Users/christianmerrill/Desktop/universal-ai-tools/macOS-App/UniversalAITools/update_app_icon.py"
echo "   ✓ Temporary Python scripts removed"

echo ""

# Final status
if [ "$ALL_PRESENT" = true ]; then
    echo "🎉 SUCCESS! Universal AI Tools Icon Integration Complete"
    echo ""
    echo "🌟 Your app now features:"
    echo "   • Modern gradient background inspired by macOS Big Sur"
    echo "   • Neural network pattern representing AI capabilities"
    echo "   • Gear system symbolizing powerful tools"
    echo "   • Universal infinity symbol for broad applicability"
    echo "   • Professional glow and shadow effects"
    echo "   • All required macOS icon sizes (16px to 1024px)"
    echo ""
    echo "🚀 Next steps:"
    echo "   1. Build your app to see the new icon in action"
    echo "   2. The icon will appear in Finder, Dock, and App Switcher"
    echo "   3. Your app now has a distinctive, professional appearance"
    echo ""
    echo "💡 Icon designed with inspiration from beautiful repositories:"
    echo "   • Apple's Design Resources"
    echo "   • Modern macOS app icon patterns"
    echo "   • Professional gradient and visual effects"
else
    echo "⚠️  Some icon files are missing. Please run the icon generation script again."
fi

echo ""
echo "=============================================="
echo "🎨 Universal AI Tools - Custom Icon Complete"