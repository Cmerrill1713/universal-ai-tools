#!/bin/bash

# Universal AI Tools - macOS App DMG Creator
# Creates a professional DMG with a drag-and-drop .app bundle

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🚀 Creating Universal AI Tools App DMG...${NC}"
echo "=============================================="
echo ""

# Configuration
DMG_NAME="Universal-AI-Tools"
VERSION="1.0.0"
APP_NAME="Universal AI Tools.app"
FINAL_DMG="${DMG_NAME}-${VERSION}.dmg"

# Check if app bundle exists
if [ ! -d "$APP_NAME" ]; then
    echo -e "${RED}❌ Error: $APP_NAME not found!${NC}"
    echo "Please run the app bundle creation first."
    exit 1
fi

# Clean up any existing DMG
echo -e "${YELLOW}🧹 Cleaning up previous builds...${NC}"
rm -f "$FINAL_DMG"

# Create a temporary directory for DMG contents
TEMP_DIR="dmg_app_temp"
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

# Copy the app bundle to temp directory
echo -e "${BLUE}📦 Copying app bundle...${NC}"
cp -R "$APP_NAME" "$TEMP_DIR/"

# Create a README for the DMG
echo -e "${BLUE}📝 Creating DMG README...${NC}"
cat > "$TEMP_DIR/README.txt" << 'EOF'
🚀 Universal AI Tools - macOS Application

WELCOME TO UNIVERSAL AI TOOLS!

This is a complete AI assistant platform packaged as a native macOS application.

INSTALLATION:
1. Drag "Universal AI Tools.app" to your Applications folder
2. Double-click the app to launch
3. The app will automatically start all required services
4. Your browser will open to: http://localhost:8086

WHAT'S INCLUDED:
✅ Complete AI assistant platform
✅ Docker Compose setup for easy deployment
✅ Automated service management
✅ Web dashboard and monitoring
✅ Voice processing capabilities
✅ Knowledge management system

SERVICES INCLUDED:
• Assistant Service (Port 8086) - Main AI chat interface
• LLM Router (Port 3033) - AI model management  
• Intelligent Librarian (Port 8082) - Knowledge management
• PostgreSQL Database (Port 5432)
• Redis Cache (Port 6379)

REQUIREMENTS:
• macOS 10.15 or later
• Docker Desktop (will be installed automatically if needed)

FIRST TIME SETUP:
The app will guide you through:
1. Docker installation (if needed)
2. Service startup
3. Web interface access

SUPPORT:
• Documentation: See PACKAGING_GUIDE.md in the app bundle
• Installation Help: See INSTALL.md in the app bundle
• Health Check: curl http://localhost:8086/health

Ready to start your AI journey? Drag the app to Applications and launch! 🤖✨

---
Universal AI Tools v1.0.0
Created with ❤️ for the AI community
EOF

# Create Applications folder symlink for easy drag-and-drop
echo -e "${BLUE}🔗 Creating Applications folder link...${NC}"
ln -s /Applications "$TEMP_DIR/Applications"

# Verify the package
echo -e "${BLUE}🔍 Verifying app package...${NC}"
echo "Contents of DMG package:"
ls -la "$TEMP_DIR/"

# Create the DMG using hdiutil
echo -e "${BLUE}💾 Creating app DMG file...${NC}"

# Create the DMG directly
hdiutil create -srcfolder "$TEMP_DIR" -volname "Universal AI Tools" -fs HFS+ -format UDZO -imagekey zlib-level=9 "$FINAL_DMG"

# Clean up temporary directory
echo -e "${BLUE}🧹 Cleaning up...${NC}"
rm -rf "$TEMP_DIR"

# Get final DMG size
DMG_SIZE=$(ls -lh "$FINAL_DMG" | awk '{print $5}')

echo ""
echo -e "${GREEN}✅ App DMG created successfully!${NC}"
echo ""
echo -e "${BLUE}📦 DMG Details:${NC}"
echo "   File: $FINAL_DMG"
echo "   Size: $DMG_SIZE"
echo "   Location: $(pwd)/$FINAL_DMG"
echo ""
echo -e "${BLUE}🎯 DMG Contents:${NC}"
echo "   • Universal AI Tools.app (drag to Applications)"
echo "   • Applications folder link"
echo "   • README with instructions"
echo ""
echo -e "${GREEN}🚀 Ready for distribution!${NC}"
echo ""
echo -e "${BLUE}To test the DMG:${NC}"
echo "   open $FINAL_DMG"
echo ""
echo -e "${BLUE}To test the app:${NC}"
echo "   open \"$APP_NAME\""
echo ""
echo -e "${GREEN}Universal AI Tools App DMG creation complete! 🎉${NC}"
