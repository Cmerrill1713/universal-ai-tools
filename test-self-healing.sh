#!/bin/bash

# Universal AI Tools Self-Healing System Test Runner
# This script provides an easy way to run and monitor the self-healing system tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Default configuration
DURATION=600  # 10 minutes
MONITOR_INTERVAL=5  # 5 seconds
SIMULATE_ERRORS=true
LOG_LEVEL="info"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/logs"

# Ensure logs directory exists
mkdir -p "$LOG_DIR"

print_header() {
    echo -e "${BLUE}=================================="
    echo -e "🔧 Universal AI Tools Self-Healing System Test"
    echo -e "==================================${NC}"
    echo ""
}

print_usage() {
    echo -e "${YELLOW}Usage: $0 [OPTIONS]${NC}"
    echo ""
    echo "Options:"
    echo "  -d, --duration SECONDS     Test duration in seconds (default: 600)"
    echo "  -i, --interval SECONDS     Monitoring interval in seconds (default: 5)"
    echo "  -n, --no-simulation        Disable error simulation"
    echo "  -l, --log-level LEVEL      Log level: debug, info, warn, error (default: info)"
    echo "  -q, --quick                Quick test (2 minutes, fast monitoring)"
    echo "  -v, --verbose              Enable verbose logging"
    echo "  -h, --help                 Show this help message"
    echo ""
    echo "Interactive Commands (during test):"
    echo "  q - Quit test"
    echo "  s - Show status"
    echo "  r - Show report"
    echo ""
    echo "Examples:"
    echo "  $0                         # Run with default settings"
    echo "  $0 -q                      # Quick 2-minute test"
    echo "  $0 -d 1800 -i 10          # 30-minute test with 10s monitoring"
    echo "  $0 -n -v                  # No simulation, verbose logging"
}

check_dependencies() {
    echo -e "${BLUE}🔍 Checking dependencies...${NC}"
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js is not installed${NC}"
        exit 1
    fi
    
    # Check if npx is available
    if ! command -v npx &> /dev/null; then
        echo -e "${RED}❌ npx is not installed${NC}"
        exit 1
    fi
    
    # Check if tsx is available
    if ! npx tsx --version &> /dev/null; then
        echo -e "${YELLOW}⚠️  tsx not found, installing...${NC}"
        npm install -g tsx
    fi
    
    # Check if the test script exists
    if [ ! -f "$SCRIPT_DIR/scripts/test-self-healing-system.ts" ]; then
        echo -e "${RED}❌ Test script not found at $SCRIPT_DIR/scripts/test-self-healing-system.ts${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ All dependencies checked${NC}"
}

check_environment() {
    echo -e "${BLUE}🌍 Checking environment...${NC}"
    
    # Check for required environment variables
    if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
        echo -e "${YELLOW}⚠️  Supabase environment variables not set${NC}"
        
        # Try to load from .env file
        if [ -f "$SCRIPT_DIR/.env" ]; then
            echo -e "${BLUE}📄 Loading environment from .env file${NC}"
            export $(cat "$SCRIPT_DIR/.env" | grep -v '^#' | xargs)
        else
            echo -e "${RED}❌ No .env file found and Supabase variables not set${NC}"
            echo "Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables"
            echo "or create a .env file with these values"
            exit 1
        fi
    fi
    
    echo -e "${GREEN}✅ Environment configured${NC}"
}

start_system_monitoring() {
    echo -e "${BLUE}📊 Starting system monitoring...${NC}"
    
    # Start a background process to monitor system resources
    (
        while true; do
            timestamp=$(date '+%Y-%m-%d %H:%M:%S')
            cpu_usage=$(top -l 1 -n 0 | grep "CPU usage" | awk '{print $3}' | sed 's/%//' 2>/dev/null || echo "0")
            memory_usage=$(top -l 1 -n 0 | grep "PhysMem" | awk '{print $2}' | sed 's/M//' 2>/dev/null || echo "0")
            
            echo "[$timestamp] CPU: ${cpu_usage}%, Memory: ${memory_usage}M" >> "$LOG_DIR/system-monitor.log"
            sleep 30
        done
    ) &
    
    MONITOR_PID=$!
    echo -e "${GREEN}✅ System monitoring started (PID: $MONITOR_PID)${NC}"
}

cleanup() {
    echo -e "\n${YELLOW}🧹 Cleaning up...${NC}"
    
    # Kill background monitoring process
    if [ ! -z "$MONITOR_PID" ]; then
        kill $MONITOR_PID 2>/dev/null || true
    fi
    
    # Kill any remaining Node.js processes from the test
    pkill -f "test-self-healing-system.ts" 2>/dev/null || true
    
    echo -e "${GREEN}✅ Cleanup completed${NC}"
}

run_pre_test_checks() {
    echo -e "${BLUE}🔍 Running pre-test system checks...${NC}"
    
    # Check if any services are already running on common ports
    ports_to_check=(3000 3001 8000 8766 5432 6379)
    
    for port in "${ports_to_check[@]}"; do
        if lsof -i :$port >/dev/null 2>&1; then
            echo -e "${YELLOW}⚠️  Port $port is in use${NC}"
        fi
    done
    
    # Check available disk space
    available_space=$(df -h . | tail -1 | awk '{print $4}')
    echo -e "${BLUE}💾 Available disk space: $available_space${NC}"
    
    # Check memory usage
    if command -v free &> /dev/null; then
        memory_info=$(free -h | grep "Mem:")
        echo -e "${BLUE}🧠 Memory: $memory_info${NC}"
    elif command -v vm_stat &> /dev/null; then
        # macOS
        pages_free=$(vm_stat | grep "Pages free" | awk '{print $3}' | sed 's/\.//')
        pages_total=$(echo "$pages_free * 4096 / 1024 / 1024" | bc 2>/dev/null || echo "Unknown")
        echo -e "${BLUE}🧠 Free memory: ~${pages_total}MB${NC}"
    fi
    
    echo -e "${GREEN}✅ Pre-test checks completed${NC}"
}

generate_test_summary() {
    echo -e "\n${PURPLE}📋 Test Summary${NC}"
    echo -e "${BLUE}=================================="
    echo -e "Duration: ${DURATION}s"
    echo -e "Monitor Interval: ${MONITOR_INTERVAL}s"
    echo -e "Error Simulation: $([[ $SIMULATE_ERRORS == true ]] && echo "Enabled" || echo "Disabled")"
    echo -e "Log Level: $LOG_LEVEL"
    echo -e "Log Directory: $LOG_DIR"
    echo -e "==================================${NC}"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--duration)
            DURATION="$2"
            shift 2
            ;;
        -i|--interval)
            MONITOR_INTERVAL="$2"
            shift 2
            ;;
        -n|--no-simulation)
            SIMULATE_ERRORS=false
            shift
            ;;
        -l|--log-level)
            LOG_LEVEL="$2"
            shift 2
            ;;
        -q|--quick)
            DURATION=120
            MONITOR_INTERVAL=2
            echo -e "${YELLOW}🚀 Quick test mode: 2 minutes with 2s monitoring${NC}"
            shift
            ;;
        -v|--verbose)
            LOG_LEVEL="debug"
            shift
            ;;
        -h|--help)
            print_header
            print_usage
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Unknown option: $1${NC}"
            print_usage
            exit 1
            ;;
    esac
done

# Set up signal handlers for cleanup
trap cleanup EXIT
trap cleanup INT
trap cleanup TERM

# Main execution
main() {
    print_header
    generate_test_summary
    
    echo -e "\n${BLUE}🚀 Starting Universal AI Tools Self-Healing System Test${NC}"
    echo -e "${BLUE}Press Ctrl+C to stop the test at any time${NC}\n"
    
    # Pre-flight checks
    check_dependencies
    check_environment
    run_pre_test_checks
    
    # Start monitoring
    start_system_monitoring
    
    # Build command arguments
    TEST_CMD="npx tsx scripts/test-self-healing-system.ts"
    TEST_CMD="$TEST_CMD --duration $DURATION"
    TEST_CMD="$TEST_CMD --monitor-interval $MONITOR_INTERVAL"
    TEST_CMD="$TEST_CMD --log-level $LOG_LEVEL"
    
    if [[ $SIMULATE_ERRORS == false ]]; then
        TEST_CMD="$TEST_CMD --no-simulation"
    fi
    
    echo -e "${GREEN}🔧 Executing: $TEST_CMD${NC}\n"
    
    # Change to script directory and run the test
    cd "$SCRIPT_DIR"
    
    # Capture start time
    START_TIME=$(date)
    echo -e "${BLUE}⏰ Test started at: $START_TIME${NC}"
    
    # Run the test with output logging
    $TEST_CMD 2>&1 | tee "$LOG_DIR/test-execution-$(date +%Y%m%d-%H%M%S).log"
    
    # Capture end time
    END_TIME=$(date)
    echo -e "\n${BLUE}⏰ Test completed at: $END_TIME${NC}"
    
    # Show final logs location
    echo -e "\n${GREEN}📁 Test logs saved to: $LOG_DIR${NC}"
    echo -e "${GREEN}📊 System monitor log: $LOG_DIR/system-monitor.log${NC}"
    
    # Show recent report files
    echo -e "\n${PURPLE}📋 Recent report files:${NC}"
    find "$LOG_DIR" -name "*report*.json" -type f -mmin -60 2>/dev/null | head -5 | while read file; do
        echo -e "${BLUE}  - $(basename "$file")${NC}"
    done
    
    echo -e "\n${GREEN}✅ Self-healing system test completed successfully!${NC}"
}

# Run main function
main "$@"