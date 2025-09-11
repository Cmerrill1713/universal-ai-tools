#!/bin/bash

# Universal AI Tools - macOS Native App Bundle Creator
# Creates a professional macOS application with one-click launch functionality

set -e

# Configuration
DESKTOP="$HOME/Desktop"
SOURCE_DIR="/Users/christianmerrill/Desktop/universal-ai-tools"
APP_NAME="Universal AI Tools"
APP_BUNDLE="${DESKTOP}/${APP_NAME}.app"
APP_IDENTIFIER="com.universal.ai-tools"
VERSION="1.0.0"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🍎 Universal AI Tools - macOS App Bundle Creator${NC}"
echo -e "${BLUE}===============================================${NC}"
echo ""
echo -e "${YELLOW}📱 App Name: ${APP_NAME}${NC}"
echo -e "${YELLOW}📁 Bundle Path: ${APP_BUNDLE}${NC}"
echo -e "${YELLOW}🆔 Identifier: ${APP_IDENTIFIER}${NC}"
echo ""

# Clean up existing app bundle
if [ -d "${APP_BUNDLE}" ]; then
    echo -e "${YELLOW}🧹 Removing existing app bundle...${NC}"
    rm -rf "${APP_BUNDLE}"
fi

# Phase 1: Create App Bundle Structure
echo -e "${BLUE}📦 Phase 1: Creating App Bundle Structure${NC}"

mkdir -p "${APP_BUNDLE}/Contents"
mkdir -p "${APP_BUNDLE}/Contents/MacOS"
mkdir -p "${APP_BUNDLE}/Contents/Resources"
mkdir -p "${APP_BUNDLE}/Contents/Resources/platform"
mkdir -p "${APP_BUNDLE}/Contents/Resources/scripts"
mkdir -p "${APP_BUNDLE}/Contents/Resources/docs"

echo -e "   ${GREEN}✅ Bundle structure created${NC}"

# Phase 2: Create Info.plist
echo -e "${BLUE}📄 Phase 2: Creating App Metadata${NC}"

cat > "${APP_BUNDLE}/Contents/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDisplayName</key>
    <string>${APP_NAME}</string>
    <key>CFBundleExecutable</key>
    <string>Universal AI Tools</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>CFBundleIdentifier</key>
    <string>${APP_IDENTIFIER}</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>${APP_NAME}</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>${VERSION}</string>
    <key>CFBundleVersion</key>
    <string>${VERSION}</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.15</string>
    <key>LSUIElement</key>
    <false/>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSSupportsAutomaticGraphicsSwitching</key>
    <true/>
    <key>LSApplicationCategoryType</key>
    <string>public.app-category.developer-tools</string>
    <key>CFBundleDocumentTypes</key>
    <array>
        <dict>
            <key>CFBundleTypeRole</key>
            <string>Viewer</string>
            <key>LSItemContentTypes</key>
            <array>
                <string>public.url</string>
            </array>
        </dict>
    </array>
</dict>
</plist>
EOF

echo -e "   ${GREEN}✅ Info.plist created${NC}"

# Phase 3: Copy Platform Files
echo -e "${BLUE}🔧 Phase 3: Embedding Platform${NC}"

# Copy essential platform components
echo "   ├── Copying core platform files..."
cp -r "${SOURCE_DIR}/src" "${APP_BUNDLE}/Contents/Resources/platform/"
cp -r "${SOURCE_DIR}/docker-compose.production.yml" "${APP_BUNDLE}/Contents/Resources/platform/"
cp -r "${SOURCE_DIR}/Dockerfile.prod" "${APP_BUNDLE}/Contents/Resources/platform/"
cp -r "${SOURCE_DIR}/nginx" "${APP_BUNDLE}/Contents/Resources/platform/"
cp -r "${SOURCE_DIR}/monitoring" "${APP_BUNDLE}/Contents/Resources/platform/"
cp -r "${SOURCE_DIR}/supabase" "${APP_BUNDLE}/Contents/Resources/platform/"
cp "${SOURCE_DIR}/package.json" "${APP_BUNDLE}/Contents/Resources/platform/"
cp "${SOURCE_DIR}/package-lock.json" "${APP_BUNDLE}/Contents/Resources/platform/"
cp "${SOURCE_DIR}/tsconfig.json" "${APP_BUNDLE}/Contents/Resources/platform/"
cp "${SOURCE_DIR}/.env.example" "${APP_BUNDLE}/Contents/Resources/platform/"

echo "   ├── Copying management scripts..."
cp -r "${SOURCE_DIR}/scripts" "${APP_BUNDLE}/Contents/Resources/"

echo "   ├── Copying documentation..."
cp "${SOURCE_DIR}/PRODUCTION_DEPLOYMENT_GUIDE.md" "${APP_BUNDLE}/Contents/Resources/docs/"
cp "${SOURCE_DIR}/API_DOCUMENTATION.md" "${APP_BUNDLE}/Contents/Resources/docs/"
cp "${SOURCE_DIR}/QUICK_START_GUIDE.md" "${APP_BUNDLE}/Contents/Resources/docs/"

echo -e "   ${GREEN}✅ Platform embedded${NC}"

# Phase 4: Create Main Executable
echo -e "${BLUE}🚀 Phase 4: Creating Main Executable${NC}"

cat > "${APP_BUNDLE}/Contents/MacOS/Universal AI Tools" << 'EOF'
#!/bin/bash

# Universal AI Tools - Main App Launcher
# Provides one-click startup with intelligent service management

# Configuration
RESOURCES_DIR="$(dirname "$0")/../Resources"
PLATFORM_DIR="${RESOURCES_DIR}/platform"
LOG_FILE="/tmp/universal-ai-tools-app.log"
PID_FILE="/tmp/universal-ai-tools-app.pid"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "${LOG_FILE}"
}

# Check if already running
if [ -f "${PID_FILE}" ] && kill -0 $(cat "${PID_FILE}") 2>/dev/null; then
    log "Universal AI Tools is already running (PID: $(cat ${PID_FILE}))"
    open "http://localhost:9999"
    exit 0
fi

# Store PID
echo $$ > "${PID_FILE}"

log "🚀 Starting Universal AI Tools..."

# Phase 1: Environment Setup
log "🔧 Setting up environment..."

cd "${PLATFORM_DIR}"

# Create .env if it doesn't exist
if [ ! -f ".env" ]; then
    log "📝 Creating default environment configuration..."
    cp ".env.example" ".env"
    
    # Set production defaults
    sed -i '' 's/NODE_ENV=development/NODE_ENV=production/' ".env"
    sed -i '' 's/localhost:3000/localhost:9999/' ".env"
fi

# Phase 2: Prerequisites Check
log "🔍 Checking prerequisites..."

# Check for Docker
if ! command -v docker >/dev/null 2>&1; then
    log "❌ Docker not found. Please install Docker Desktop from https://docker.com/products/docker-desktop"
    osascript -e 'display alert "Docker Required" message "Please install Docker Desktop to run Universal AI Tools." buttons {"Download Docker", "Cancel"} default button "Download Docker"' -e 'if button returned of result is "Download Docker" then open location "https://docker.com/products/docker-desktop"'
    exit 1
fi

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    log "🐳 Starting Docker Desktop..."
    open -a "Docker Desktop"
    
    # Wait for Docker to start (up to 2 minutes)
    for i in {1..24}; do
        if docker info >/dev/null 2>&1; then
            log "✅ Docker is running"
            break
        fi
        log "⏳ Waiting for Docker to start... ($i/24)"
        sleep 5
    done
    
    if ! docker info >/dev/null 2>&1; then
        log "❌ Docker failed to start. Please start Docker Desktop manually."
        osascript -e 'display alert "Docker Startup Failed" message "Please start Docker Desktop manually and try again."'
        exit 1
    fi
fi

# Phase 3: Port Management
log "🔌 Checking and managing ports..."

check_port() {
    local port=$1
    local service=$2
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        log "⚠️  Port $port is in use (needed for $service)"
        
        # Ask user what to do
        result=$(osascript -e "display alert \"Port Conflict\" message \"Port $port is needed for $service but is currently in use. Would you like to kill the conflicting process?\" buttons {\"Kill Process\", \"Use Different Port\", \"Cancel\"} default button \"Kill Process\"")
        
        if [[ $result == *"Kill Process"* ]]; then
            log "🔫 Killing process on port $port..."
            lsof -ti:$port | xargs kill -9 2>/dev/null || true
            sleep 2
        elif [[ $result == *"Cancel"* ]]; then
            log "❌ User cancelled due to port conflict"
            exit 1
        fi
        # For "Use Different Port", we'll let Docker handle it
    fi
}

check_port 9999 "Universal AI Tools API"
check_port 5432 "Database"
check_port 6379 "Redis Cache"

# Phase 4: Service Startup
log "🏗️  Starting Universal AI Tools services..."

# Show startup notification
osascript -e 'display notification "Starting Universal AI Tools services..." with title "Universal AI Tools"' >/dev/null 2>&1 || true

# Start with docker-compose
if docker-compose -f docker-compose.production.yml up -d 2>&1 | tee -a "${LOG_FILE}"; then
    log "✅ Services started successfully"
else
    log "❌ Service startup failed"
    osascript -e 'display alert "Startup Failed" message "Failed to start Universal AI Tools services. Check the logs for details."'
    exit 1
fi

# Phase 5: Health Check
log "🏥 Performing health checks..."

# Wait for services to be ready
for i in {1..30}; do
    if curl -f http://localhost:9999/health >/dev/null 2>&1; then
        log "✅ Universal AI Tools is ready!"
        break
    fi
    log "⏳ Waiting for services to be ready... ($i/30)"
    sleep 2
done

# Final health check
if curl -f http://localhost:9999/health >/dev/null 2>&1; then
    log "🎉 Universal AI Tools started successfully!"
    
    # Show success notification
    osascript -e 'display notification "Universal AI Tools is ready!" with title "Universal AI Tools" sound name "Glass"' >/dev/null 2>&1 || true
    
    # Open in browser after a brief delay
    sleep 2
    open "http://localhost:9999"
    
    # Create menu bar status
    echo "Universal AI Tools: Running ✅" > "/tmp/universal-ai-tools-status.txt"
    
else
    log "❌ Health check failed - services may not be fully ready"
    osascript -e 'display alert "Startup Warning" message "Universal AI Tools may not be fully ready. Please check http://localhost:9999 manually."'
fi

# Clean up PID file on exit
trap 'rm -f "${PID_FILE}"' EXIT

log "🎯 Universal AI Tools app launcher completed"
EOF

# Make executable
chmod +x "${APP_BUNDLE}/Contents/MacOS/Universal AI Tools"

echo -e "   ${GREEN}✅ Main executable created${NC}"

# Phase 5: Create App Icon (if available)
echo -e "${BLUE}🎨 Phase 5: Setting Up App Icon${NC}"

if [ -f "${SOURCE_DIR}/AppIcon.icns" ]; then
    cp "${SOURCE_DIR}/AppIcon.icns" "${APP_BUNDLE}/Contents/Resources/"
    echo -e "   ${GREEN}✅ Custom app icon added${NC}"
elif [ -f "${SOURCE_DIR}/app_icon.png" ]; then
    # Convert PNG to ICNS if available
    if command -v sips >/dev/null 2>&1; then
        sips -s format icns "${SOURCE_DIR}/app_icon.png" --out "${APP_BUNDLE}/Contents/Resources/AppIcon.icns" >/dev/null 2>&1 && \
        echo -e "   ${GREEN}✅ App icon converted and added${NC}" || \
        echo -e "   ${YELLOW}⚠️  Icon conversion failed, using default${NC}"
    else
        echo -e "   ${YELLOW}⚠️  No icon conversion tool available${NC}"
    fi
else
    echo -e "   ${YELLOW}⚠️  No custom icon found, using system default${NC}"
fi

# Phase 6: Create Service Management Scripts
echo -e "${BLUE}🛠️  Phase 6: Creating Service Management${NC}"

# Create stop script
cat > "${APP_BUNDLE}/Contents/Resources/scripts/stop-services.sh" << 'EOF'
#!/bin/bash
# Stop Universal AI Tools services

PLATFORM_DIR="$(dirname "$0")/../platform"
cd "${PLATFORM_DIR}"

echo "🛑 Stopping Universal AI Tools services..."
docker-compose -f docker-compose.production.yml down

# Clean up
rm -f "/tmp/universal-ai-tools-app.pid"
rm -f "/tmp/universal-ai-tools-status.txt"

echo "✅ Services stopped"
EOF

# Create restart script
cat > "${APP_BUNDLE}/Contents/Resources/scripts/restart-services.sh" << 'EOF'
#!/bin/bash
# Restart Universal AI Tools services

PLATFORM_DIR="$(dirname "$0")/../platform"
cd "${PLATFORM_DIR}"

echo "🔄 Restarting Universal AI Tools services..."
docker-compose -f docker-compose.production.yml restart

echo "✅ Services restarted"
EOF

# Create logs script
cat > "${APP_BUNDLE}/Contents/Resources/scripts/view-logs.sh" << 'EOF'
#!/bin/bash
# View Universal AI Tools logs

PLATFORM_DIR="$(dirname "$0")/../platform"
cd "${PLATFORM_DIR}"

echo "📋 Universal AI Tools Service Logs"
echo "=================================="
echo ""

# Show recent logs
docker-compose -f docker-compose.production.yml logs --tail=50

echo ""
echo "Press Ctrl+C to exit log viewing"
docker-compose -f docker-compose.production.yml logs -f
EOF

# Make scripts executable
chmod +x "${APP_BUNDLE}/Contents/Resources/scripts"/*.sh

echo -e "   ${GREEN}✅ Service management scripts created${NC}"

# Phase 7: Create Version Info
cat > "${APP_BUNDLE}/Contents/Resources/VERSION.txt" << EOF
Universal AI Tools
Version: ${VERSION}
Build Date: $(date)
Platform: macOS
Type: Native App Bundle

Features:
- One-click startup
- Automatic service management
- Health monitoring
- Docker integration
- Web-based interface

Access: http://localhost:9999
Documentation: Contents/Resources/docs/
EOF

echo -e "   ${GREEN}✅ Version info created${NC}"

# Phase 8: Set Bundle Permissions
echo -e "${BLUE}🔐 Phase 8: Setting Permissions${NC}"

# Set proper permissions for the entire bundle
chmod -R 755 "${APP_BUNDLE}"
chmod +x "${APP_BUNDLE}/Contents/MacOS/Universal AI Tools"

# Make sure scripts are executable
find "${APP_BUNDLE}/Contents/Resources/scripts" -name "*.sh" -exec chmod +x {} \;

echo -e "   ${GREEN}✅ Permissions set${NC}"

# Final Summary
echo ""
echo -e "${GREEN}🎉 macOS App Bundle Created Successfully!${NC}"
echo -e "${GREEN}=======================================${NC}"
echo ""
echo -e "${BLUE}📱 App Bundle:${NC} ${APP_BUNDLE}"
echo -e "${BLUE}💾 Size:${NC} $(du -sh "${APP_BUNDLE}" | cut -f1)"
echo -e "${BLUE}🆔 Bundle ID:${NC} ${APP_IDENTIFIER}"
echo -e "${BLUE}📋 Version:${NC} ${VERSION}"
echo ""
echo -e "${BLUE}✨ Features:${NC}"
echo "   ├── One-click startup with Docker management"
echo "   ├── Automatic health checking and monitoring"
echo "   ├── Intelligent port conflict resolution"
echo "   ├── Service management scripts included"
echo "   ├── Complete platform embedded"
echo "   └── Professional macOS integration"
echo ""
echo -e "${BLUE}🚀 Usage:${NC}"
echo "   1. Double-click 'Universal AI Tools.app' to start"
echo "   2. App will automatically start Docker if needed"
echo "   3. Browser opens to http://localhost:9999 when ready"
echo "   4. Use Dock icon to access running application"
echo ""
echo -e "${BLUE}🛠️  Management:${NC}"
echo "   • Logs: ${APP_BUNDLE}/Contents/Resources/scripts/view-logs.sh"
echo "   • Stop: ${APP_BUNDLE}/Contents/Resources/scripts/stop-services.sh"
echo "   • Restart: ${APP_BUNDLE}/Contents/Resources/scripts/restart-services.sh"
echo ""
echo -e "${YELLOW}💡 Tip:${NC} Add to Applications folder for system-wide access"
echo -e "${YELLOW}🔧 Note:${NC} First launch may take longer while Docker pulls images"
echo ""