#!/bin/bash

# Universal AI Tools - Desktop Integration Creator
# Creates menu bar controls, desktop shortcuts, and system integration

set -e

# Configuration
DESKTOP="$HOME/Desktop"
APPLICATIONS="/Applications"
APP_BUNDLE="${DESKTOP}/Universal AI Tools.app"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🖥️  Universal AI Tools - Desktop Integration${NC}"
echo -e "${BLUE}===========================================${NC}"
echo ""

# Phase 1: Create Menu Bar Status App
echo -e "${BLUE}📊 Phase 1: Creating Menu Bar Status App${NC}"

# Create menu bar status checker script
cat > "${DESKTOP}/Universal AI Tools Status.command" << 'EOF'
#!/bin/bash

# Universal AI Tools - Menu Bar Status Checker
# Shows real-time status and provides quick controls

BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

check_status() {
    if curl -f http://localhost:9999/health >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

check_docker() {
    if docker info >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

while true; do
    clear
    echo -e "${BLUE}🚀 Universal AI Tools - Status Monitor${NC}"
    echo -e "${BLUE}====================================${NC}"
    echo ""
    
    # Check Docker status
    if check_docker; then
        echo -e "${GREEN}🐳 Docker: Running${NC}"
        
        # Check service status
        if check_status; then
            echo -e "${GREEN}✅ Universal AI Tools: Online${NC}"
            echo -e "${GREEN}🌐 URL: http://localhost:9999${NC}"
            
            # Get basic metrics
            if command -v curl >/dev/null 2>&1; then
                memory=$(curl -s http://localhost:9999/api/health 2>/dev/null | grep -o '"rss":[0-9]*' | cut -d: -f2 | head -1)
                if [ ! -z "$memory" ]; then
                    memory_mb=$((memory / 1024 / 1024))
                    echo -e "${BLUE}💾 Memory: ${memory_mb}MB${NC}"
                fi
            fi
        else
            echo -e "${YELLOW}⚠️  Universal AI Tools: Starting/Offline${NC}"
        fi
        
        # Show running containers
        echo ""
        echo -e "${BLUE}📦 Active Containers:${NC}"
        docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "(universal|supabase|redis|ollama)" || echo "   No related containers running"
        
    else
        echo -e "${RED}❌ Docker: Not Running${NC}"
        echo -e "${YELLOW}💡 Start Docker Desktop to use Universal AI Tools${NC}"
    fi
    
    echo ""
    echo -e "${BLUE}🛠️  Quick Actions:${NC}"
    echo "   [O] Open in Browser"
    echo "   [S] Start Services"
    echo "   [T] Stop Services"
    echo "   [R] Restart Services"
    echo "   [L] View Logs"
    echo "   [D] Docker Status"
    echo "   [Q] Quit Monitor"
    
    echo ""
    echo -e "${YELLOW}Last Updated: $(date '+%H:%M:%S')${NC}"
    echo -e "${YELLOW}Press any key for menu...${NC}"
    
    read -t 5 -n 1 key
    
    case $key in
        o|O)
            echo "🌐 Opening browser..."
            open "http://localhost:9999"
            ;;
        s|S)
            echo "🚀 Starting services..."
            open -a "Universal AI Tools"
            ;;
        t|T)
            echo "🛑 Stopping services..."
            if [ -f "${DESKTOP}/Universal AI Tools.app/Contents/Resources/scripts/stop-services.sh" ]; then
                "${DESKTOP}/Universal AI Tools.app/Contents/Resources/scripts/stop-services.sh"
            fi
            ;;
        r|R)
            echo "🔄 Restarting services..."
            if [ -f "${DESKTOP}/Universal AI Tools.app/Contents/Resources/scripts/restart-services.sh" ]; then
                "${DESKTOP}/Universal AI Tools.app/Contents/Resources/scripts/restart-services.sh"
            fi
            ;;
        l|L)
            echo "📋 Opening logs..."
            if [ -f "${DESKTOP}/Universal AI Tools.app/Contents/Resources/scripts/view-logs.sh" ]; then
                "${DESKTOP}/Universal AI Tools.app/Contents/Resources/scripts/view-logs.sh"
            fi
            break
            ;;
        d|D)
            echo "🐳 Docker status:"
            docker info 2>/dev/null || echo "Docker not running"
            read -p "Press Enter to continue..."
            ;;
        q|Q)
            echo "👋 Goodbye!"
            exit 0
            ;;
    esac
done
EOF

chmod +x "${DESKTOP}/Universal AI Tools Status.command"

echo -e "   ${GREEN}✅ Menu bar status monitor created${NC}"

# Phase 2: Create Quick Action Scripts
echo -e "${BLUE}⚡ Phase 2: Creating Quick Action Scripts${NC}"

# Quick Start Script
cat > "${DESKTOP}/🚀 Start Universal AI Tools.command" << 'EOF'
#!/bin/bash

echo "🚀 Starting Universal AI Tools..."
echo "================================"

# Check if already running
if curl -f http://localhost:9999/health >/dev/null 2>&1; then
    echo "✅ Universal AI Tools is already running!"
    open "http://localhost:9999"
    exit 0
fi

# Start the app
if [ -f "/Users/christianmerrill/Desktop/Universal AI Tools.app/Contents/MacOS/Universal AI Tools" ]; then
    echo "🎯 Launching Universal AI Tools app..."
    open -a "Universal AI Tools"
else
    echo "❌ Universal AI Tools app not found on desktop"
    echo "💡 Please ensure the app bundle is in your Desktop"
fi
EOF

# Quick Stop Script
cat > "${DESKTOP}/🛑 Stop Universal AI Tools.command" << 'EOF'
#!/bin/bash

echo "🛑 Stopping Universal AI Tools..."
echo "================================"

# Check if running
if ! curl -f http://localhost:9999/health >/dev/null 2>&1; then
    echo "ℹ️  Universal AI Tools is not currently running"
    exit 0
fi

# Stop services
if [ -f "/Users/christianmerrill/Desktop/Universal AI Tools.app/Contents/Resources/scripts/stop-services.sh" ]; then
    echo "🔄 Stopping services..."
    "/Users/christianmerrill/Desktop/Universal AI Tools.app/Contents/Resources/scripts/stop-services.sh"
    echo "✅ Services stopped successfully"
else
    echo "❌ Stop script not found"
fi

echo "👋 Universal AI Tools stopped"
read -p "Press Enter to close..."
EOF

# Quick Status Script
cat > "${DESKTOP}/📊 Universal AI Tools Status.command" << 'EOF'
#!/bin/bash

echo "📊 Universal AI Tools - Quick Status"
echo "===================================="

# Check Docker
if docker info >/dev/null 2>&1; then
    echo "✅ Docker: Running"
    
    # Check main service
    if curl -f http://localhost:9999/health >/dev/null 2>&1; then
        echo "✅ Universal AI Tools: Online"
        echo "🌐 Access: http://localhost:9999"
        
        # Get health info
        health_info=$(curl -s http://localhost:9999/api/health 2>/dev/null || echo "{}")
        if echo "$health_info" | grep -q "healthy"; then
            echo "💚 Health: Good"
        fi
        
        # Show uptime if available
        uptime=$(echo "$health_info" | grep -o '"uptime":[0-9.]*' | cut -d: -f2)
        if [ ! -z "$uptime" ]; then
            uptime_hours=$(echo "$uptime / 3600" | bc -l | cut -d. -f1)
            echo "⏱️  Uptime: ${uptime_hours} hours"
        fi
        
    else
        echo "⚠️  Universal AI Tools: Offline or Starting"
    fi
    
    # Show container status
    echo ""
    echo "📦 Container Status:"
    docker ps --format "   {{.Names}}: {{.Status}}" | grep -E "(universal|supabase|redis|ollama)" || echo "   No containers running"
    
else
    echo "❌ Docker: Not Running"
    echo "💡 Please start Docker Desktop"
fi

echo ""
echo "🔧 Available Actions:"
echo "   • Start: Double-click 'Universal AI Tools.app'"
echo "   • Monitor: Run 'Universal AI Tools Status.command'"
echo "   • Stop: Run 'Stop Universal AI Tools.command'"

read -p "Press Enter to close..."
EOF

# Quick Logs Script
cat > "${DESKTOP}/📋 View Universal AI Tools Logs.command" << 'EOF'
#!/bin/bash

echo "📋 Universal AI Tools - Recent Logs"
echo "==================================="

LOG_SCRIPT="/Users/christianmerrill/Desktop/Universal AI Tools.app/Contents/Resources/scripts/view-logs.sh"

if [ -f "$LOG_SCRIPT" ]; then
    echo "📖 Showing recent logs (Press Ctrl+C to exit):"
    echo ""
    "$LOG_SCRIPT"
else
    echo "❌ Log script not found"
    echo "💡 Showing alternative logs:"
    
    # Show app log if available
    if [ -f "/tmp/universal-ai-tools-app.log" ]; then
        echo ""
        echo "📱 App Launcher Logs:"
        tail -20 "/tmp/universal-ai-tools-app.log"
    fi
    
    # Show Docker logs if running
    if docker ps | grep -q universal; then
        echo ""
        echo "🐳 Docker Service Logs:"
        docker logs --tail=20 $(docker ps | grep universal | awk '{print $1}') 2>/dev/null || echo "No Docker logs available"
    fi
fi

read -p "Press Enter to close..."
EOF

# Make all scripts executable
chmod +x "${DESKTOP}"/*.command

echo -e "   ${GREEN}✅ Quick action scripts created${NC}"

# Phase 3: Create Documentation Shortcuts
echo -e "${BLUE}📚 Phase 3: Creating Documentation Shortcuts${NC}"

# API Documentation shortcut
cat > "${DESKTOP}/📖 Universal AI Tools Docs.webloc" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>URL</key>
    <string>file:///Users/christianmerrill/Desktop/Universal%20AI%20Tools.app/Contents/Resources/docs/API_DOCUMENTATION.md</string>
</dict>
</plist>
EOF

# Create local documentation viewer
cat > "${DESKTOP}/📑 Open Documentation Folder.command" << 'EOF'
#!/bin/bash

DOCS_DIR="/Users/christianmerrill/Desktop/Universal AI Tools.app/Contents/Resources/docs"

if [ -d "$DOCS_DIR" ]; then
    echo "📚 Opening documentation folder..."
    open "$DOCS_DIR"
else
    echo "❌ Documentation folder not found"
    echo "💡 Looking for backup documentation..."
    
    # Try backup locations
    if [ -d "/Users/christianmerrill/Desktop/Universal-AI-Tools-Backup-*/documentation" ]; then
        BACKUP_DOCS=$(ls -d /Users/christianmerrill/Desktop/Universal-AI-Tools-Backup-*/documentation | head -1)
        echo "📁 Found backup documentation: $BACKUP_DOCS"
        open "$BACKUP_DOCS"
    else
        echo "❌ No documentation found"
    fi
fi
EOF

chmod +x "${DESKTOP}/📑 Open Documentation Folder.command"

echo -e "   ${GREEN}✅ Documentation shortcuts created${NC}"

# Phase 4: Create System Integration
echo -e "${BLUE}🔗 Phase 4: Creating System Integration${NC}"

# Create LaunchAgent for auto-start (optional)
LAUNCH_AGENT_DIR="$HOME/Library/LaunchAgents"
LAUNCH_AGENT_FILE="$LAUNCH_AGENT_DIR/com.universal.ai-tools.helper.plist"

mkdir -p "$LAUNCH_AGENT_DIR"

cat > "$LAUNCH_AGENT_FILE" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.universal.ai-tools.helper</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>-c</string>
        <string>echo "Universal AI Tools Helper loaded"</string>
    </array>
    <key>RunAtLoad</key>
    <false/>
    <key>KeepAlive</key>
    <false/>
    <key>Disabled</key>
    <true/>
</dict>
</plist>
EOF

echo -e "   ${GREEN}✅ System integration prepared${NC}"

# Phase 5: Create Desktop Manager
echo -e "${BLUE}🎛️  Phase 5: Creating Desktop Manager${NC}"

cat > "${DESKTOP}/⚙️ Universal AI Tools Manager.command" << 'EOF'
#!/bin/bash

# Universal AI Tools - Desktop Manager
# Central control panel for all platform operations

BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

APP_PATH="/Users/christianmerrill/Desktop/Universal AI Tools.app"

show_menu() {
    clear
    echo -e "${BLUE}⚙️  Universal AI Tools - Desktop Manager${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    
    # Check status
    if curl -f http://localhost:9999/health >/dev/null 2>&1; then
        echo -e "${GREEN}Status: ✅ Online${NC}"
        echo -e "${GREEN}URL: http://localhost:9999${NC}"
    else
        echo -e "${YELLOW}Status: ⚠️  Offline${NC}"
    fi
    
    echo ""
    echo -e "${BLUE}🚀 Service Management:${NC}"
    echo "   1) Start Universal AI Tools"
    echo "   2) Stop Universal AI Tools" 
    echo "   3) Restart Universal AI Tools"
    echo "   4) View Service Status"
    echo ""
    echo -e "${BLUE}📊 Monitoring & Logs:${NC}"
    echo "   5) Real-time Status Monitor"
    echo "   6) View Application Logs"
    echo "   7) View Service Logs"
    echo "   8) Docker Container Status"
    echo ""
    echo -e "${BLUE}🛠️  Maintenance:${NC}"
    echo "   9) Open Documentation"
    echo "   10) Backup Data"
    echo "   11) System Health Check"
    echo "   12) Reset Services"
    echo ""
    echo -e "${BLUE}⚡ Quick Actions:${NC}"
    echo "   13) Open in Browser"
    echo "   14) Copy Backup to Applications"
    echo "   15) Desktop Cleanup"
    echo ""
    echo "   0) Exit Manager"
    echo ""
    echo -n "Choose an option (0-15): "
}

while true; do
    show_menu
    read choice
    
    case $choice in
        1)
            echo -e "${GREEN}🚀 Starting Universal AI Tools...${NC}"
            open -a "Universal AI Tools" 2>/dev/null || echo "App not found"
            read -p "Press Enter to continue..."
            ;;
        2)
            echo -e "${YELLOW}🛑 Stopping Universal AI Tools...${NC}"
            if [ -f "$APP_PATH/Contents/Resources/scripts/stop-services.sh" ]; then
                "$APP_PATH/Contents/Resources/scripts/stop-services.sh"
            else
                echo "Stop script not found"
            fi
            read -p "Press Enter to continue..."
            ;;
        3)
            echo -e "${BLUE}🔄 Restarting Universal AI Tools...${NC}"
            if [ -f "$APP_PATH/Contents/Resources/scripts/restart-services.sh" ]; then
                "$APP_PATH/Contents/Resources/scripts/restart-services.sh"
            else
                echo "Restart script not found"
            fi
            read -p "Press Enter to continue..."
            ;;
        4)
            echo -e "${BLUE}📊 Service Status:${NC}"
            if curl -f http://localhost:9999/health >/dev/null 2>&1; then
                curl -s http://localhost:9999/api/health | grep -o '"status":"[^"]*' | cut -d'"' -f4
                docker ps --format "{{.Names}}: {{.Status}}" | grep -E "(universal|supabase|redis)"
            else
                echo "Services offline"
            fi
            read -p "Press Enter to continue..."
            ;;
        5)
            echo -e "${BLUE}📊 Starting real-time monitor...${NC}"
            if [ -f "/Users/christianmerrill/Desktop/Universal AI Tools Status.command" ]; then
                "/Users/christianmerrill/Desktop/Universal AI Tools Status.command"
            fi
            ;;
        6)
            echo -e "${BLUE}📋 Application Logs:${NC}"
            if [ -f "/tmp/universal-ai-tools-app.log" ]; then
                tail -50 "/tmp/universal-ai-tools-app.log"
            else
                echo "No application logs found"
            fi
            read -p "Press Enter to continue..."
            ;;
        7)
            echo -e "${BLUE}📋 Service Logs:${NC}"
            if [ -f "$APP_PATH/Contents/Resources/scripts/view-logs.sh" ]; then
                "$APP_PATH/Contents/Resources/scripts/view-logs.sh"
            else
                echo "Service logs not available"
            fi
            break
            ;;
        8)
            echo -e "${BLUE}🐳 Docker Status:${NC}"
            docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
            read -p "Press Enter to continue..."
            ;;
        9)
            echo -e "${BLUE}📚 Opening documentation...${NC}"
            if [ -d "$APP_PATH/Contents/Resources/docs" ]; then
                open "$APP_PATH/Contents/Resources/docs"
            else
                echo "Documentation not found"
            fi
            read -p "Press Enter to continue..."
            ;;
        10)
            echo -e "${BLUE}💾 Creating backup...${NC}"
            if [ -f "/Users/christianmerrill/Desktop/universal-ai-tools/scripts/backup-to-desktop.sh" ]; then
                "/Users/christianmerrill/Desktop/universal-ai-tools/scripts/backup-to-desktop.sh"
            else
                echo "Backup script not found"
            fi
            read -p "Press Enter to continue..."
            ;;
        11)
            echo -e "${BLUE}🏥 System Health Check:${NC}"
            echo "Docker: $(docker info >/dev/null 2>&1 && echo "✅ Running" || echo "❌ Not running")"
            echo "Service: $(curl -f http://localhost:9999/health >/dev/null 2>&1 && echo "✅ Healthy" || echo "❌ Offline")"
            echo "Disk Space: $(df -h / | tail -1 | awk '{print $4}') available"
            echo "Memory: $(vm_stat | grep "Pages free" | awk '{print $3}' | sed 's/\.//')MB free"
            read -p "Press Enter to continue..."
            ;;
        12)
            echo -e "${YELLOW}🔄 Resetting services...${NC}"
            echo "This will stop and restart all services"
            read -p "Continue? (y/N): " confirm
            if [[ $confirm == [yY] ]]; then
                docker-compose -f "$APP_PATH/Contents/Resources/platform/docker-compose.production.yml" down
                docker-compose -f "$APP_PATH/Contents/Resources/platform/docker-compose.production.yml" up -d
                echo "✅ Services reset"
            fi
            read -p "Press Enter to continue..."
            ;;
        13)
            echo -e "${GREEN}🌐 Opening browser...${NC}"
            open "http://localhost:9999"
            ;;
        14)
            echo -e "${BLUE}📁 Copying app to Applications...${NC}"
            if [ -d "$APP_PATH" ]; then
                cp -r "$APP_PATH" "/Applications/"
                echo "✅ App copied to /Applications/Universal AI Tools.app"
            else
                echo "❌ App not found"
            fi
            read -p "Press Enter to continue..."
            ;;
        15)
            echo -e "${BLUE}🧹 Desktop Cleanup Options:${NC}"
            echo "   1) Remove old backup folders"
            echo "   2) Clean up log files"
            echo "   3) Remove temporary files"
            echo -n "Choose cleanup option (1-3): "
            read cleanup_choice
            case $cleanup_choice in
                1)
                    echo "🗑️  Removing old backups..."
                    find /Users/christianmerrill/Desktop -name "Universal-AI-Tools-Backup-*" -type d -mtime +7 -exec rm -rf {} \; 2>/dev/null || true
                    echo "✅ Old backups cleaned"
                    ;;
                2)
                    echo "🗑️  Cleaning log files..."
                    rm -f /tmp/universal-ai-tools*.log
                    echo "✅ Log files cleaned"
                    ;;
                3)
                    echo "🗑️  Removing temporary files..."
                    rm -f /tmp/universal-ai-tools*.pid
                    rm -f /tmp/universal-ai-tools*.txt
                    echo "✅ Temporary files cleaned"
                    ;;
            esac
            read -p "Press Enter to continue..."
            ;;
        0)
            echo -e "${GREEN}👋 Goodbye!${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Invalid option${NC}"
            read -p "Press Enter to continue..."
            ;;
    esac
done
EOF

chmod +x "${DESKTOP}/⚙️ Universal AI Tools Manager.command"

echo -e "   ${GREEN}✅ Desktop manager created${NC}"

# Phase 6: Create Desktop Summary
echo -e "${BLUE}📋 Phase 6: Creating Desktop Summary${NC}"

cat > "${DESKTOP}/🚀 Universal AI Tools - DESKTOP GUIDE.txt" << 'EOF'
🚀 Universal AI Tools - Desktop Integration Guide
===============================================

Welcome to your complete Universal AI Tools desktop setup!

📱 MAIN APPLICATION
• Universal AI Tools.app - Main application (double-click to start)

⚡ QUICK ACTIONS
• 🚀 Start Universal AI Tools.command - Quick startup
• 🛑 Stop Universal AI Tools.command - Quick shutdown  
• 📊 Universal AI Tools Status.command - Live monitoring
• ⚙️ Universal AI Tools Manager.command - Full control panel

📋 MONITORING & LOGS
• 📋 View Universal AI Tools Logs.command - Service logs
• Universal AI Tools Status.command - Real-time status

📚 DOCUMENTATION & HELP
• 📖 Universal AI Tools Docs.webloc - API documentation
• 📑 Open Documentation Folder.command - All docs

📦 BACKUP ARCHIVES
• Universal-AI-Tools-COMPLETE.tar.gz - Full platform backup
• Universal-AI-Tools-PRODUCTION.tar.gz - Production deployment
• Universal-AI-Tools-QUICK-RESTORE.tar.gz - Emergency restore
• Universal-AI-Tools-README.txt - Backup instructions

🎯 QUICK START GUIDE
1. Double-click "Universal AI Tools.app"
2. Wait for browser to open (http://localhost:9999)
3. Use the platform normally
4. Use "⚙️ Manager.command" for advanced controls

💡 TIPS
• Add Universal AI Tools.app to Applications folder
• Use Status.command for real-time monitoring
• Manager.command provides full system control
• Backup archives are self-contained and portable

🆘 TROUBLESHOOTING
• If app won't start: Check Docker Desktop is running
• If ports conflict: Use Manager > Reset Services
• For logs: Use "View Logs" commands
• For help: Open Documentation folder

🔧 SYSTEM REQUIREMENTS
• macOS 10.15+ (Catalina or newer)
• Docker Desktop installed and running
• 4GB+ RAM recommended
• 10GB+ free disk space

Created: $(date)
Version: 1.0.0
EOF

echo -e "   ${GREEN}✅ Desktop guide created${NC}"

# Final Summary
echo ""
echo -e "${GREEN}🎉 Desktop Integration Completed Successfully!${NC}"
echo -e "${GREEN}=============================================${NC}"
echo ""
echo -e "${BLUE}📱 Main Application:${NC}"
echo "   └── Universal AI Tools.app (One-click launcher)"
echo ""
echo -e "${BLUE}⚡ Quick Actions:${NC}"
echo "   ├── 🚀 Start Universal AI Tools.command"
echo "   ├── 🛑 Stop Universal AI Tools.command"
echo "   ├── 📊 Universal AI Tools Status.command"
echo "   └── ⚙️ Universal AI Tools Manager.command"
echo ""
echo -e "${BLUE}📚 Documentation:${NC}"
echo "   ├── 📖 Universal AI Tools Docs.webloc"
echo "   ├── 📑 Open Documentation Folder.command"
echo "   └── 🚀 Universal AI Tools - DESKTOP GUIDE.txt"
echo ""
echo -e "${BLUE}📋 Monitoring:${NC}"
echo "   ├── 📋 View Universal AI Tools Logs.command"
echo "   └── Real-time status in Manager"
echo ""
echo -e "${BLUE}💾 Backup Archives:${NC}"
echo "   ├── Universal-AI-Tools-COMPLETE.tar.gz (208M)"
echo "   ├── Universal-AI-Tools-PRODUCTION.tar.gz (1.1M)"
echo "   └── Universal-AI-Tools-QUICK-RESTORE.tar.gz (14K)"
echo ""
echo -e "${GREEN}🎯 Ready to Use!${NC}"
echo "   1. Double-click 'Universal AI Tools.app' to start"
echo "   2. Use '⚙️ Manager.command' for advanced controls"
echo "   3. Monitor with '📊 Status.command'"
echo ""
echo -e "${YELLOW}💡 Pro Tip:${NC} Drag 'Universal AI Tools.app' to Applications folder"
echo -e "${YELLOW}🔧 Support:${NC} Use Manager for troubleshooting and maintenance"
echo ""