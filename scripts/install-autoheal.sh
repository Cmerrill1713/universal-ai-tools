#!/bin/bash

# Install and configure the auto-healing system

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

BASE_DIR="/Users/christianmerrill/Desktop/universal-ai-tools"

echo -e "${BLUE}=== Universal AI Tools Auto-Heal System Installer ===${NC}\n"

# Check dependencies
echo "Checking dependencies..."

deps_missing=false

if ! command -v python3 >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠ Python 3 not found (ML predictor will be disabled)${NC}"
    deps_missing=true
fi

if ! command -v node >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠ Node.js not found (TypeScript healer will be disabled)${NC}"
    deps_missing=true
fi

if [ "$deps_missing" = true ]; then
    echo -e "\n${YELLOW}Some optional components will be disabled.${NC}"
    read -p "Continue installation? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Install Python dependencies if available
if command -v python3 >/dev/null 2>&1; then
    echo -e "\n${BLUE}Installing Python dependencies...${NC}"
    pip3 install psutil numpy 2>/dev/null || {
        echo -e "${YELLOW}⚠ Could not install Python packages. ML predictor may not work.${NC}"
    }
fi

# Create necessary directories
echo -e "\n${BLUE}Creating directories...${NC}"
mkdir -p /tmp/uat-autoheal
mkdir -p /tmp/uat-pids
mkdir -p /tmp/uat-cache

# Make all scripts executable
echo -e "\n${BLUE}Setting permissions...${NC}"
chmod +x "$BASE_DIR/scripts/auto-heal-system.sh"
chmod +x "$BASE_DIR/scripts/ml-error-predictor.py"
chmod +x "$BASE_DIR/scripts/service-health-checks.sh"
chmod +x "$BASE_DIR/scripts/start-autoheal-daemon.sh"

# Install launchd service (macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo -e "\n${BLUE}Installing launchd service...${NC}"
    
    PLIST_FILE="$BASE_DIR/scripts/com.universalaitools.autoheal.plist"
    LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
    
    mkdir -p "$LAUNCH_AGENTS_DIR"
    
    # Copy plist file
    cp "$PLIST_FILE" "$LAUNCH_AGENTS_DIR/"
    
    # Load the service
    launchctl load "$LAUNCH_AGENTS_DIR/com.universalaitools.autoheal.plist" 2>/dev/null || {
        echo -e "${YELLOW}Service already loaded, reloading...${NC}"
        launchctl unload "$LAUNCH_AGENTS_DIR/com.universalaitools.autoheal.plist" 2>/dev/null || true
        launchctl load "$LAUNCH_AGENTS_DIR/com.universalaitools.autoheal.plist"
    }
    
    echo -e "${GREEN}✓ Auto-heal service installed and started${NC}"
fi

# Create convenience commands
echo -e "\n${BLUE}Creating convenience commands...${NC}"

# Create symlink for easy access
if [ -d "/usr/local/bin" ]; then
    ln -sf "$BASE_DIR/scripts/start-autoheal-daemon.sh" /usr/local/bin/uat-autoheal 2>/dev/null || {
        echo -e "${YELLOW}Could not create symlink (may need sudo)${NC}"
    }
fi

echo -e "\n${GREEN}✓ Installation complete!${NC}\n"

echo -e "${BLUE}Available commands:${NC}"
echo "  Start daemon:    ./scripts/start-autoheal-daemon.sh start"
echo "  Stop daemon:     ./scripts/start-autoheal-daemon.sh stop"
echo "  Check status:    ./scripts/start-autoheal-daemon.sh status"
echo "  View logs:       ./scripts/start-autoheal-daemon.sh logs"
echo ""
echo "  Health check:    ./scripts/service-health-checks.sh check"
echo "  Auto-recover:    ./scripts/service-health-checks.sh recover"
echo "  Monitor mode:    ./scripts/service-health-checks.sh monitor"

if [[ "$OSTYPE" == "darwin"* ]]; then
    echo -e "\n${BLUE}macOS service commands:${NC}"
    echo "  Start service:   launchctl start com.universalaitools.autoheal"
    echo "  Stop service:    launchctl stop com.universalaitools.autoheal"
    echo "  Service status:  launchctl list | grep universalaitools"
fi

echo -e "\n${GREEN}The auto-healing system is now active and will:${NC}"
echo "  • Monitor service health every 30 seconds"
echo "  • Automatically restart failed services"
echo "  • Predict and prevent errors using ML"
echo "  • Optimize memory and performance"
echo "  • Self-correct common issues"
echo ""
echo -e "${CYAN}Logs are available in /tmp/uat-autoheal/${NC}"