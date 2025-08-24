#!/bin/bash

# Service-specific health checks and recovery procedures

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Base directory
BASE_DIR="/Users/christianmerrill/Desktop/universal-ai-tools"
LOG_DIR="/tmp/uat-health"
mkdir -p "$LOG_DIR"

# Health check functions for each service
check_go_api_gateway() {
    local port=8080
    local health_url="http://localhost:${port}/api/health"
    
    echo -n "Checking Go API Gateway... "
    
    if ! lsof -i :$port -sTCP:LISTEN >/dev/null 2>&1; then
        echo -e "${RED}✗ Not running${NC}"
        return 1
    fi
    
    if curl -sf --max-time 2 "$health_url" >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Healthy${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠ Running but unhealthy${NC}"
        return 2
    fi
}

check_rust_llm_router() {
    local port=8082
    local health_url="http://localhost:${port}/health"
    
    echo -n "Checking Rust LLM Router... "
    
    if ! lsof -i :$port -sTCP:LISTEN >/dev/null 2>&1; then
        echo -e "${RED}✗ Not running${NC}"
        return 1
    fi
    
    # Check if cargo process exists
    if pgrep -f "llm-router" >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Healthy${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠ Port open but process not found${NC}"
        return 2
    fi
}

check_rust_ai_core() {
    local port=8083
    local health_url="http://localhost:${port}/health"
    
    echo -n "Checking Rust AI Core... "
    
    if ! lsof -i :$port -sTCP:LISTEN >/dev/null 2>&1; then
        echo -e "${RED}✗ Not running${NC}"
        return 1
    fi
    
    if pgrep -f "ai-core" >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Healthy${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠ Port open but process not found${NC}"
        return 2
    fi
}

check_postgres() {
    echo -n "Checking PostgreSQL... "
    
    if pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Healthy${NC}"
        return 0
    else
        echo -e "${RED}✗ Not responding${NC}"
        return 1
    fi
}

check_redis() {
    echo -n "Checking Redis... "
    
    if redis-cli ping >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Healthy${NC}"
        return 0
    else
        echo -e "${RED}✗ Not responding${NC}"
        return 1
    fi
}

# Recovery functions
recover_go_api_gateway() {
    echo -e "${BLUE}🔧 Recovering Go API Gateway...${NC}"
    
    # Kill any existing process
    pkill -f "go-api-gateway" 2>/dev/null || true
    sleep 1
    
    # Start the service
    cd "$BASE_DIR/go-api-gateway"
    nohup go run cmd/main.go > "$LOG_DIR/go-api-gateway.log" 2>&1 &
    
    # Wait for startup
    sleep 3
    
    # Verify
    if check_go_api_gateway; then
        echo -e "${GREEN}✓ Recovery successful${NC}"
        return 0
    else
        echo -e "${RED}✗ Recovery failed${NC}"
        return 1
    fi
}

recover_rust_llm_router() {
    echo -e "${BLUE}🔧 Recovering Rust LLM Router...${NC}"
    
    # Kill any existing process
    pkill -f "llm-router" 2>/dev/null || true
    sleep 1
    
    # Start the service
    cd "$BASE_DIR/rust-services/llm-router"
    nohup cargo run --release > "$LOG_DIR/rust-llm-router.log" 2>&1 &
    
    # Wait for startup
    sleep 5
    
    # Verify
    if check_rust_llm_router; then
        echo -e "${GREEN}✓ Recovery successful${NC}"
        return 0
    else
        echo -e "${RED}✗ Recovery failed${NC}"
        return 1
    fi
}

recover_rust_ai_core() {
    echo -e "${BLUE}🔧 Recovering Rust AI Core...${NC}"
    
    # Kill any existing process
    pkill -f "ai-core" 2>/dev/null || true
    sleep 1
    
    # Start the service
    cd "$BASE_DIR/rust-services/ai-core"
    nohup cargo run --release > "$LOG_DIR/rust-ai-core.log" 2>&1 &
    
    # Wait for startup
    sleep 5
    
    # Verify
    if check_rust_ai_core; then
        echo -e "${GREEN}✓ Recovery successful${NC}"
        return 0
    else
        echo -e "${RED}✗ Recovery failed${NC}"
        return 1
    fi
}

# Main health check function
run_health_checks() {
    echo -e "${BLUE}=== Running Health Checks ===${NC}"
    echo "Timestamp: $(date)"
    echo ""
    
    local failed_services=()
    
    # Check each service
    if ! check_go_api_gateway; then
        failed_services+=("go-api-gateway")
    fi
    
    if ! check_rust_llm_router; then
        failed_services+=("rust-llm-router")
    fi
    
    if ! check_rust_ai_core; then
        failed_services+=("rust-ai-core")
    fi
    
    if ! check_postgres; then
        failed_services+=("postgres")
    fi
    
    if ! check_redis; then
        failed_services+=("redis")
    fi
    
    echo ""
    
    # Summary
    if [ ${#failed_services[@]} -eq 0 ]; then
        echo -e "${GREEN}✓ All services healthy!${NC}"
        return 0
    else
        echo -e "${RED}✗ Failed services: ${failed_services[*]}${NC}"
        return 1
    fi
}

# Auto-recovery function
auto_recover() {
    echo -e "${BLUE}=== Starting Auto-Recovery ===${NC}"
    
    local recovered=0
    local failed=0
    
    # Try to recover each unhealthy service
    if ! check_go_api_gateway; then
        if recover_go_api_gateway; then
            ((recovered++))
        else
            ((failed++))
        fi
    fi
    
    if ! check_rust_llm_router; then
        if recover_rust_llm_router; then
            ((recovered++))
        else
            ((failed++))
        fi
    fi
    
    if ! check_rust_ai_core; then
        if recover_rust_ai_core; then
            ((recovered++))
        else
            ((failed++))
        fi
    fi
    
    echo ""
    echo -e "${BLUE}=== Recovery Summary ===${NC}"
    echo -e "Recovered: ${GREEN}${recovered}${NC}"
    echo -e "Failed: ${RED}${failed}${NC}"
    
    return $failed
}

# Continuous monitoring mode
monitor_mode() {
    echo -e "${BLUE}=== Starting Continuous Monitoring ===${NC}"
    echo "Press Ctrl+C to stop"
    echo ""
    
    while true; do
        if ! run_health_checks; then
            echo ""
            echo -e "${YELLOW}⚠ Unhealthy services detected, attempting recovery...${NC}"
            auto_recover
        fi
        
        echo ""
        echo "Next check in 30 seconds..."
        sleep 30
        clear
    done
}

# Parse command line arguments
case "${1:-check}" in
    check)
        run_health_checks
        ;;
    recover)
        auto_recover
        ;;
    monitor)
        monitor_mode
        ;;
    *)
        echo "Usage: $0 {check|recover|monitor}"
        exit 1
        ;;
esac