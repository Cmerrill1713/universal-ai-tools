#!/bin/bash

# Universal AI Tools - Clean DMG Creator
# Creates a professional DMG with only essential files

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🚀 Creating Clean Universal AI Tools DMG...${NC}"
echo "=============================================="
echo ""

# Configuration
DMG_NAME="Universal-AI-Tools"
VERSION="1.0.0"
SOURCE_DIR="."
FINAL_DMG="${DMG_NAME}-${VERSION}.dmg"

# Check if we're in the right directory (should contain docker-compose.yml)
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}❌ Error: docker-compose.yml not found! Please run this script from the universal-ai-tools directory.${NC}"
    exit 1
fi

# Clean up any existing DMG
echo -e "${YELLOW}🧹 Cleaning up previous builds...${NC}"
rm -f "$FINAL_DMG"

# Create a temporary directory for DMG contents
TEMP_DIR="dmg_clean_temp"
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

# Create a clean copy with only essential files
echo -e "${BLUE}📦 Creating clean package...${NC}"
mkdir -p "$TEMP_DIR/universal-ai-tools"

# Copy only the essential files
cp "$SOURCE_DIR/.env.example" "$TEMP_DIR/universal-ai-tools/"
cp "$SOURCE_DIR/docker-compose.yml" "$TEMP_DIR/universal-ai-tools/"
cp "$SOURCE_DIR/Dockerfile.assistantd" "$TEMP_DIR/universal-ai-tools/"
cp "$SOURCE_DIR/Dockerfile.intelligent-librarian" "$TEMP_DIR/universal-ai-tools/"
cp "$SOURCE_DIR/Dockerfile.llm-router" "$TEMP_DIR/universal-ai-tools/"
cp "$SOURCE_DIR/INSTALL.md" "$TEMP_DIR/universal-ai-tools/"
cp "$SOURCE_DIR/install.sh" "$TEMP_DIR/universal-ai-tools/"
cp "$SOURCE_DIR/PACKAGING_GUIDE.md" "$TEMP_DIR/universal-ai-tools/"
cp "$SOURCE_DIR/start.sh" "$TEMP_DIR/universal-ai-tools/"

# Make scripts executable
chmod +x "$TEMP_DIR/universal-ai-tools/start.sh"
chmod +x "$TEMP_DIR/universal-ai-tools/install.sh"

# Create a README for the DMG
echo -e "${BLUE}📝 Creating DMG README...${NC}"
cat > "$TEMP_DIR/README.txt" << 'EOF'
🚀 Universal AI Tools - Installation Package

WELCOME TO UNIVERSAL AI TOOLS!

This package contains everything you need to install and run the complete 
AI assistant platform on your Mac.

QUICK START:
1. Drag the "universal-ai-tools" folder to your desired location
2. Open Terminal and navigate to the folder
3. Run: ./start.sh
4. Open your browser to: http://localhost:8086

WHAT'S INCLUDED:
✅ Complete AI assistant platform
✅ Docker Compose setup for easy deployment
✅ Automated installation scripts
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

SUPPORT:
• Documentation: See PACKAGING_GUIDE.md in the package
• Installation Help: See INSTALL.md in the package
• Health Check: curl http://localhost:8086/health

Ready to start your AI journey? Run ./start.sh and begin chatting! 🤖✨

---
Universal AI Tools v1.0.0
Created with ❤️ for the AI community
EOF

# Verify the clean package
echo -e "${BLUE}🔍 Verifying clean package...${NC}"
echo "Contents of clean package:"
ls -la "$TEMP_DIR/universal-ai-tools/"

# Create the DMG using hdiutil
echo -e "${BLUE}💾 Creating clean DMG file...${NC}"

# Create the DMG directly
hdiutil create -srcfolder "$TEMP_DIR" -volname "Universal AI Tools" -fs HFS+ -format UDZO -imagekey zlib-level=9 "$FINAL_DMG"

# Clean up temporary directory
echo -e "${BLUE}🧹 Cleaning up...${NC}"
rm -rf "$TEMP_DIR"

# Get final DMG size
DMG_SIZE=$(ls -lh "$FINAL_DMG" | awk '{print $5}')

echo ""
echo -e "${GREEN}✅ Clean DMG created successfully!${NC}"
echo ""
echo -e "${BLUE}📦 DMG Details:${NC}"
echo "   File: $FINAL_DMG"
echo "   Size: $DMG_SIZE"
echo "   Location: $(pwd)/$FINAL_DMG"
echo ""
echo -e "${BLUE}🎯 DMG Contents:${NC}"
echo "   • Universal AI Tools package (clean)"
echo "   • README with instructions"
echo ""
echo -e "${GREEN}🚀 Ready for distribution!${NC}"
echo ""
echo -e "${BLUE}To test the DMG:${NC}"
echo "   open $FINAL_DMG"
echo ""
echo -e "${GREEN}Clean Universal AI Tools DMG creation complete! 🎉${NC}"
