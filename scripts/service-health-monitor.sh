#!/bin/bash

# Universal AI Tools Service Health Monitor
# Continuous health checking with auto-recovery capabilities

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Configuration
MONITOR_INTERVAL=5  # Check every 5 seconds
RECOVERY_TIMEOUT=30 # Max time to wait for recovery
LOG_FILE="/tmp/uat-health-monitor.log"
FAILURES_DB="/tmp/uat-health-failures.json"
RECOVERY_SCRIPT="./scripts/integrated-evolution-healer.sh"

# Service definitions
declare -A SERVICES=(
    ["go-api-gateway"]="8082|/api/health|Go API Gateway"
    ["rust-ai-core"]="8009|/health|Rust AI Core"
    ["rust-llm-router"]="8003|/health|Rust LLM Router"
    ["rust-vision-bridge"]="8083|/api/health|Rust Vision Bridge"
    ["architecture-ai"]="8010|/health|Architecture AI Service"
)

# Initialize failure tracking
init_failure_tracking() {
    if [ ! -f "$FAILURES_DB" ]; then
        echo '{"failures": [], "recoveries": []}' > "$FAILURES_DB"
    fi
}

# Log event
log_event() {
    local level=$1
    local message=$2
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $message" >> "$LOG_FILE"
    
    case "$level" in
        ERROR)
            echo -e "${RED}✗ $message${NC}"
            ;;
        SUCCESS)
            echo -e "${GREEN}✓ $message${NC}"
            ;;
        WARNING)
            echo -e "${YELLOW}⚠ $message${NC}"
            ;;
        INFO)
            echo -e "${CYAN}ℹ $message${NC}"
            ;;
    esac
}

# Check service health
check_service_health() {
    local service_name=$1
    local service_info=$2
    
    IFS='|' read -r port endpoint display_name <<< "$service_info"
    
    # Try to reach the health endpoint
    local response=$(curl -s -o /dev/null -w "%{http_code}" \
        --connect-timeout 2 \
        --max-time 5 \
        "http://localhost:${port}${endpoint}" 2>/dev/null || echo "000")
    
    if [ "$response" == "200" ]; then
        return 0
    else
        return 1
    fi
}

# Attempt service recovery
attempt_recovery() {
    local service_name=$1
    local service_info=$2
    
    IFS='|' read -r port endpoint display_name <<< "$service_info"
    
    log_event "WARNING" "Attempting recovery for $display_name on port $port"
    
    # Strategy 1: Check if process exists and restart if needed
    local pid=$(lsof -ti :$port 2>/dev/null || echo "")
    
    if [ -z "$pid" ]; then
        log_event "INFO" "No process on port $port, attempting to start $service_name"
        
        case "$service_name" in
            "go-api-gateway")
                UAT_SERVER_PORT=8082 UAT_SECURITY_REQUIRE_AUTH=false ./go-api-gateway &
                ;;
            "rust-ai-core")
                AI_CORE_PORT=8009 RUST_LOG=info ./rust-services/ai-core/target/release/ai-core &
                ;;
            "rust-llm-router")
                RUST_LOG=info ./rust-services/llm-router/target/release/llm-router &
                ;;
            "rust-vision-bridge")
                RUST_LOG=info ./rust-services/vision-bridge/target/release/vision-bridge &
                ;;
            "architecture-ai")
                ARCHITECTURE_AI_PORT=8010 RUST_LOG=info ./rust-services/architecture-ai/target/release/architecture-ai &
                ;;
            *)
                log_event "ERROR" "Unknown service: $service_name"
                return 1
                ;;
        esac
        
        # Wait for service to start
        sleep 3
        
        # Verify it started
        if check_service_health "$service_name" "$service_info"; then
            log_event "SUCCESS" "$display_name recovered successfully"
            record_recovery "$service_name" "restart"
            return 0
        fi
    else
        # Process exists but not responding - try gentle restart
        log_event "INFO" "Process exists (PID: $pid) but not responding, sending SIGTERM"
        kill -TERM $pid 2>/dev/null || true
        sleep 2
        
        # Force kill if still running
        if kill -0 $pid 2>/dev/null; then
            log_event "WARNING" "Process still running, forcing kill"
            kill -9 $pid 2>/dev/null || true
        fi
        
        # Restart the service
        return $(attempt_recovery "$service_name" "$service_info")
    fi
    
    return 1
}

# Record failure
record_failure() {
    local service=$1
    local error=$2
    
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local failure_entry=$(jq -n \
        --arg svc "$service" \
        --arg err "$error" \
        --arg ts "$timestamp" \
        '{service: $svc, error: $err, timestamp: $ts}')
    
    jq ".failures += [$failure_entry]" "$FAILURES_DB" > "${FAILURES_DB}.tmp" && \
        mv "${FAILURES_DB}.tmp" "$FAILURES_DB"
}

# Record recovery
record_recovery() {
    local service=$1
    local method=$2
    
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local recovery_entry=$(jq -n \
        --arg svc "$service" \
        --arg mth "$method" \
        --arg ts "$timestamp" \
        '{service: $svc, method: $mth, timestamp: $ts}')
    
    jq ".recoveries += [$recovery_entry]" "$FAILURES_DB" > "${FAILURES_DB}.tmp" && \
        mv "${FAILURES_DB}.tmp" "$FAILURES_DB"
}

# Get failure statistics
get_failure_stats() {
    if [ -f "$FAILURES_DB" ]; then
        local total_failures=$(jq '.failures | length' "$FAILURES_DB")
        local total_recoveries=$(jq '.recoveries | length' "$FAILURES_DB")
        local recovery_rate=0
        
        if [ "$total_failures" -gt 0 ]; then
            recovery_rate=$(echo "scale=2; $total_recoveries * 100 / $total_failures" | bc)
        fi
        
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${CYAN}📊 Health Monitor Statistics${NC}"
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "Total Failures: ${RED}$total_failures${NC}"
        echo -e "Total Recoveries: ${GREEN}$total_recoveries${NC}"
        echo -e "Recovery Rate: ${YELLOW}${recovery_rate}%${NC}"
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    fi
}

# Monitor loop
monitor_services() {
    local consecutive_failures=0
    local last_check_time=0
    
    while true; do
        local all_healthy=true
        local current_time=$(date +%s)
        
        # Check each service
        for service_name in "${!SERVICES[@]}"; do
            local service_info="${SERVICES[$service_name]}"
            
            if ! check_service_health "$service_name" "$service_info"; then
                all_healthy=false
                IFS='|' read -r port endpoint display_name <<< "$service_info"
                
                log_event "ERROR" "$display_name (port $port) is not responding"
                record_failure "$service_name" "health_check_failed"
                
                # Attempt recovery
                if attempt_recovery "$service_name" "$service_info"; then
                    log_event "SUCCESS" "$display_name recovered"
                else
                    log_event "ERROR" "Failed to recover $display_name"
                    consecutive_failures=$((consecutive_failures + 1))
                fi
            fi
        done
        
        if $all_healthy; then
            if [ $consecutive_failures -gt 0 ]; then
                log_event "SUCCESS" "All services are healthy after recovery"
                consecutive_failures=0
            fi
            
            # Show status every 30 seconds when healthy
            if [ $((current_time - last_check_time)) -ge 30 ]; then
                echo -e "${GREEN}✓ All services healthy at $(date '+%H:%M:%S')${NC}"
                last_check_time=$current_time
            fi
        fi
        
        # Trigger evolution healer if too many consecutive failures
        if [ $consecutive_failures -ge 3 ]; then
            log_event "WARNING" "Multiple consecutive failures, triggering evolution healer"
            if [ -f "$RECOVERY_SCRIPT" ]; then
                bash "$RECOVERY_SCRIPT" auto-heal &
            fi
            consecutive_failures=0
        fi
        
        sleep $MONITOR_INTERVAL
    done
}

# Signal handlers
trap 'echo -e "\n${YELLOW}Health monitor stopped${NC}"; get_failure_stats; exit 0' SIGINT SIGTERM

# Main execution
main() {
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}🏥 Universal AI Tools Service Health Monitor${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Monitoring interval: ${MONITOR_INTERVAL}s${NC}"
    echo -e "${BLUE}Recovery timeout: ${RECOVERY_TIMEOUT}s${NC}"
    echo -e "${BLUE}Log file: $LOG_FILE${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    
    # Initialize
    init_failure_tracking
    log_event "INFO" "Health monitor started"
    
    # Start monitoring
    monitor_services
}

# Run if executed directly
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    main "$@"
fi