#!/bin/bash

# Universal AI Tools - Auto-Healing System
# Self-correcting and auto-recovery mechanisms

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
LOG_DIR="/tmp/uat-autoheal"
PID_DIR="/tmp/uat-pids"
HEALTH_CHECK_INTERVAL=30
MAX_RETRIES=3
MEMORY_THRESHOLD=80
CPU_THRESHOLD=90

# Ensure directories exist
mkdir -p "$LOG_DIR" "$PID_DIR"

# Log function
log() {
    local level=$1
    shift
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $*" | tee -a "$LOG_DIR/autoheal.log"
}

# Service configuration
declare -A SERVICES=(
    ["go-api-gateway"]="8081|go-api-gateway/main|cd go-api-gateway && go run cmd/main.go"
    ["rust-llm-router"]="8082|rust-services/llm-router|cd rust-services/llm-router && cargo run --release"
    ["rust-ai-core"]="8003|rust-services/ai-core|cd rust-services/ai-core && cargo run --release"
)

# Health check endpoints
declare -A HEALTH_ENDPOINTS=(
    ["go-api-gateway"]="http://localhost:8081/api/health"
    ["rust-llm-router"]="http://localhost:8082/api/health"
    ["rust-ai-core"]="http://localhost:8003/health"
)

# Check if service is running
is_service_running() {
    local service=$1
    local port=$(echo "${SERVICES[$service]}" | cut -d'|' -f1)
    
    if lsof -i :$port -sTCP:LISTEN >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Perform health check
health_check() {
    local service=$1
    local endpoint="${HEALTH_ENDPOINTS[$service]}"
    
    if [ -z "$endpoint" ]; then
        return 0  # No health endpoint defined, assume healthy
    fi
    
    if curl -sf --max-time 5 "$endpoint" >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Auto-heal service
auto_heal_service() {
    local service=$1
    local port=$(echo "${SERVICES[$service]}" | cut -d'|' -f1)
    local binary=$(echo "${SERVICES[$service]}" | cut -d'|' -f2)
    local start_cmd=$(echo "${SERVICES[$service]}" | cut -d'|' -f3)
    
    log "WARN" "Service $service appears unhealthy, attempting auto-heal..."
    
    # Step 1: Try graceful restart
    if is_service_running "$service"; then
        log "INFO" "Attempting graceful restart of $service..."
        
        # Find and kill the process
        local pid=$(lsof -ti :$port)
        if [ -n "$pid" ]; then
            kill -TERM $pid 2>/dev/null || true
            sleep 2
            
            # Force kill if still running
            if kill -0 $pid 2>/dev/null; then
                kill -KILL $pid 2>/dev/null || true
            fi
        fi
    fi
    
    # Step 2: Clear any stale locks/sockets
    log "INFO" "Clearing stale resources for $service..."
    rm -f "$PID_DIR/${service}.pid" 2>/dev/null || true
    
    # Step 3: Start the service
    log "INFO" "Starting $service..."
    (
        cd /Users/christianmerrill/Desktop/universal-ai-tools
        eval "$start_cmd" > "$LOG_DIR/${service}.log" 2>&1 &
        echo $! > "$PID_DIR/${service}.pid"
    )
    
    # Step 4: Wait for service to be ready
    local retries=0
    while [ $retries -lt 10 ]; do
        sleep 2
        if health_check "$service"; then
            log "SUCCESS" "Service $service successfully healed and responding!"
            return 0
        fi
        ((retries++))
    done
    
    log "ERROR" "Failed to heal service $service after multiple attempts"
    return 1
}

# Memory pressure handler
handle_memory_pressure() {
    local mem_usage=$(ps aux | awk '{sum+=$4} END {print int(sum)}')
    
    if [ $mem_usage -gt $MEMORY_THRESHOLD ]; then
        log "WARN" "High memory usage detected: ${mem_usage}%"
        
        # Clear caches
        log "INFO" "Clearing system caches..."
        rm -rf /tmp/uat-cache/* 2>/dev/null || true
        
        # Trigger garbage collection in services
        for service in "${!SERVICES[@]}"; do
            if is_service_running "$service"; then
                local endpoint="${HEALTH_ENDPOINTS[$service]}"
                curl -X POST "${endpoint%/health}/admin/gc" 2>/dev/null || true
            fi
        done
        
        log "INFO" "Memory optimization completed"
    fi
}

# Auto-correct common issues
auto_correct_issues() {
    log "INFO" "Running auto-correction checks..."
    
    # Fix port conflicts
    for service in "${!SERVICES[@]}"; do
        local port=$(echo "${SERVICES[$service]}" | cut -d'|' -f1)
        local current_pid=$(lsof -ti :$port 2>/dev/null || true)
        
        if [ -n "$current_pid" ]; then
            local expected_pid=$(cat "$PID_DIR/${service}.pid" 2>/dev/null || echo "")
            
            if [ "$current_pid" != "$expected_pid" ]; then
                log "WARN" "Port $port conflict detected for $service"
                log "INFO" "Killing conflicting process $current_pid"
                kill -TERM $current_pid 2>/dev/null || true
                sleep 1
                auto_heal_service "$service"
            fi
        fi
    done
    
    # Fix file permissions
    find /Users/christianmerrill/Desktop/universal-ai-tools -name "*.sh" -type f -exec chmod +x {} \; 2>/dev/null || true
    
    # Clean up stale lock files
    find /tmp -name "*.lock" -mtime +1 -delete 2>/dev/null || true
    
    log "INFO" "Auto-correction completed"
}

# Main monitoring loop
monitor_and_heal() {
    log "INFO" "Starting auto-heal monitoring system..."
    
    while true; do
        # Check each service
        for service in "${!SERVICES[@]}"; do
            if ! is_service_running "$service"; then
                log "WARN" "Service $service is not running"
                auto_heal_service "$service"
            elif ! health_check "$service"; then
                log "WARN" "Service $service failed health check"
                auto_heal_service "$service"
            else
                log "DEBUG" "Service $service is healthy"
            fi
        done
        
        # Check system resources
        handle_memory_pressure
        
        # Run auto-corrections
        auto_correct_issues
        
        # Sleep before next check
        sleep $HEALTH_CHECK_INTERVAL
    done
}

# Command handling
case "${1:-monitor}" in
    monitor)
        monitor_and_heal
        ;;
    heal)
        service="${2:-all}"
        if [ "$service" = "all" ]; then
            for s in "${!SERVICES[@]}"; do
                auto_heal_service "$s"
            done
        else
            auto_heal_service "$service"
        fi
        ;;
    check)
        for service in "${!SERVICES[@]}"; do
            if is_service_running "$service" && health_check "$service"; then
                echo -e "${GREEN}✓${NC} $service is healthy"
            else
                echo -e "${RED}✗${NC} $service needs healing"
            fi
        done
        ;;
    correct)
        auto_correct_issues
        ;;
    *)
        echo "Usage: $0 {monitor|heal [service]|check|correct}"
        exit 1
        ;;
esac