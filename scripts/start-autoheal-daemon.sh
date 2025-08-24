#!/bin/bash

# Universal AI Tools - Auto-Healing Daemon Launcher
# Starts all self-healing and monitoring components

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

BASE_DIR="/Users/christianmerrill/Desktop/universal-ai-tools"
LOG_DIR="/tmp/uat-autoheal"
PID_FILE="$LOG_DIR/autoheal-daemon.pid"

# Ensure directories exist
mkdir -p "$LOG_DIR"

# Trap for cleanup
cleanup() {
    echo -e "\n${YELLOW}⚠ Shutting down auto-heal daemon...${NC}"
    
    # Kill all child processes
    if [ -f "$PID_FILE" ]; then
        kill $(cat "$PID_FILE") 2>/dev/null || true
        rm -f "$PID_FILE"
    fi
    
    # Kill monitoring processes
    pkill -f "auto-heal-system.sh" 2>/dev/null || true
    pkill -f "ml-error-predictor.py" 2>/dev/null || true
    pkill -f "self-healing-service.ts" 2>/dev/null || true
    
    echo -e "${GREEN}✓ Auto-heal daemon stopped${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Function to start a component
start_component() {
    local name=$1
    local command=$2
    local log_file="$LOG_DIR/${name}.log"
    
    echo -n -e "Starting ${CYAN}${name}${NC}... "
    
    # Start in background and redirect output
    nohup $command > "$log_file" 2>&1 &
    local pid=$!
    
    # Save PID
    echo "$pid" >> "$PID_FILE"
    
    # Check if started successfully
    sleep 2
    if kill -0 $pid 2>/dev/null; then
        echo -e "${GREEN}✓${NC} (PID: $pid)"
        return 0
    else
        echo -e "${RED}✗ Failed${NC}"
        return 1
    fi
}

# ASCII Art Banner
show_banner() {
    echo -e "${BLUE}"
    cat << 'EOF'
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     🔧 Universal AI Tools - Auto-Healing System 🔧           ║
║                                                               ║
║     Self-Correcting • Self-Healing • Self-Optimizing         ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
}

# Display system status
show_status() {
    echo -e "${BLUE}=== System Status ===${NC}"
    
    # Memory
    local mem_usage=$(ps aux | awk '{sum+=$4} END {print int(sum)}')
    echo -e "Memory Usage: ${mem_usage}%"
    
    # CPU
    local cpu_usage=$(top -l 1 | grep "CPU usage" | awk '{print $3}' | cut -d'%' -f1)
    echo -e "CPU Usage: ${cpu_usage}%"
    
    # Services
    local services=("go-api-gateway:8080" "rust-llm-router:8082" "rust-ai-core:8083")
    echo -e "\n${BLUE}Service Status:${NC}"
    for service in "${services[@]}"; do
        local name="${service%:*}"
        local port="${service#*:}"
        
        if lsof -i :$port -sTCP:LISTEN >/dev/null 2>&1; then
            echo -e "  ${GREEN}✓${NC} $name (port $port)"
        else
            echo -e "  ${RED}✗${NC} $name (port $port)"
        fi
    done
    
    echo ""
}

# Main execution
main() {
    show_banner
    
    echo -e "${BLUE}Initializing auto-healing daemon...${NC}\n"
    
    # Clean up old PID file
    rm -f "$PID_FILE"
    touch "$PID_FILE"
    
    # Show current status
    show_status
    
    echo -e "${BLUE}=== Starting Components ===${NC}\n"
    
    # Start Bash monitoring script
    start_component "bash-monitor" "$BASE_DIR/scripts/auto-heal-system.sh monitor"
    
    # Start ML error predictor (if Python available)
    if command -v python3 >/dev/null 2>&1; then
        if python3 -c "import psutil" 2>/dev/null; then
            start_component "ml-predictor" "python3 $BASE_DIR/scripts/ml-error-predictor.py --interval 60"
        else
            echo -e "${YELLOW}⚠ ML predictor skipped (psutil not installed)${NC}"
        fi
    fi
    
    # Start TypeScript self-healing service
    if command -v npx >/dev/null 2>&1; then
        start_component "ts-healer" "npx tsx $BASE_DIR/src/services/self-healing-service.ts"
    fi
    
    # Start periodic health checks
    start_component "health-checker" "$BASE_DIR/scripts/service-health-checks.sh monitor"
    
    echo -e "\n${GREEN}✓ Auto-healing daemon started successfully!${NC}"
    echo -e "${CYAN}Components are running in the background.${NC}"
    echo -e "${YELLOW}Logs available in: $LOG_DIR${NC}"
    echo ""
    
    # Show monitoring dashboard
    echo -e "${BLUE}=== Live Monitoring Dashboard ===${NC}"
    echo "Press Ctrl+C to stop the daemon"
    echo ""
    
    # Main monitoring loop
    while true; do
        # Clear screen for dashboard
        printf "\033[2J\033[H"
        
        show_banner
        echo -e "${BLUE}=== Auto-Healing Dashboard ===${NC}"
        echo -e "Time: $(date '+%Y-%m-%d %H:%M:%S')\n"
        
        # Show system metrics
        show_status
        
        # Show recent healing actions
        echo -e "${BLUE}Recent Actions:${NC}"
        if [ -f "$LOG_DIR/autoheal.log" ]; then
            tail -n 5 "$LOG_DIR/autoheal.log" | while read line; do
                if [[ $line == *"SUCCESS"* ]]; then
                    echo -e "  ${GREEN}$line${NC}"
                elif [[ $line == *"ERROR"* ]]; then
                    echo -e "  ${RED}$line${NC}"
                elif [[ $line == *"WARN"* ]]; then
                    echo -e "  ${YELLOW}$line${NC}"
                else
                    echo "  $line"
                fi
            done
        else
            echo "  No actions yet"
        fi
        
        echo ""
        echo -e "${CYAN}Dashboard refreshes every 10 seconds...${NC}"
        
        # Sleep with ability to interrupt
        for i in {1..10}; do
            sleep 1
            printf "."
        done
    done
}

# Parse arguments
case "${1:-start}" in
    start)
        main
        ;;
    stop)
        cleanup
        ;;
    status)
        show_status
        ;;
    logs)
        tail -f "$LOG_DIR"/*.log
        ;;
    *)
        echo "Usage: $0 {start|stop|status|logs}"
        exit 1
        ;;
esac