#!/bin/bash

# Simple Auto-Healing Dashboard

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

show_status() {
    clear
    echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║     🔧 Universal AI Tools - Auto-Healing Dashboard 🔧        ║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${CYAN}Time: $(date '+%Y-%m-%d %H:%M:%S')${NC}"
    echo ""
    
    # Service Status
    echo -e "${BLUE}Service Status:${NC}"
    
    # Check Go API Gateway
    if lsof -i :8080 -sTCP:LISTEN >/dev/null 2>&1; then
        if curl -sf --max-time 1 http://localhost:8080/api/health >/dev/null 2>&1; then
            echo -e "  ${GREEN}✓${NC} Go API Gateway     (port 8080) - Healthy"
        else
            echo -e "  ${YELLOW}⚠${NC} Go API Gateway     (port 8080) - Running but unhealthy"
        fi
    else
        echo -e "  ${RED}✗${NC} Go API Gateway     (port 8080) - Not running"
    fi
    
    # Check Rust LLM Router
    if lsof -i :8082 -sTCP:LISTEN >/dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} Rust LLM Router    (port 8082) - Running"
    else
        echo -e "  ${RED}✗${NC} Rust LLM Router    (port 8082) - Not running"
    fi
    
    # Check Rust AI Core
    if lsof -i :8083 -sTCP:LISTEN >/dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} Rust AI Core       (port 8083) - Running"
    else
        echo -e "  ${RED}✗${NC} Rust AI Core       (port 8083) - Not running"
    fi
    
    # Check PostgreSQL
    if pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} PostgreSQL         (port 5432) - Running"
    else
        echo -e "  ${RED}✗${NC} PostgreSQL         (port 5432) - Not running"
    fi
    
    # Check Redis
    if redis-cli ping >/dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} Redis              (port 6379) - Running"
    else
        echo -e "  ${RED}✗${NC} Redis              (port 6379) - Not running"
    fi
    
    echo ""
    
    # System Resources
    echo -e "${BLUE}System Resources:${NC}"
    local mem_usage=$(ps aux | awk '{sum+=$4} END {print int(sum)}')
    local cpu_usage=$(top -l 1 | grep "CPU usage" | awk '{print $3}' | cut -d'%' -f1)
    echo -e "  Memory Usage: ${mem_usage}%"
    echo -e "  CPU Usage: ${cpu_usage}%"
    
    echo ""
    
    # Auto-Healing Status
    echo -e "${BLUE}Auto-Healing Activity:${NC}"
    if [ -f /tmp/uat-autoheal/monitor.log ]; then
        tail -n 3 /tmp/uat-autoheal/monitor.log | while read line; do
            if [[ $line == *"restarting"* ]]; then
                echo -e "  ${YELLOW}↻${NC} $line"
            elif [[ $line == *"OK"* ]]; then
                echo -e "  ${GREEN}•${NC} $line"
            elif [[ $line == *"DOWN"* ]]; then
                echo -e "  ${RED}•${NC} $line"
            else
                echo "  $line"
            fi
        done
    else
        echo "  No activity yet"
    fi
    
    echo ""
    echo -e "${CYAN}Dashboard refreshes every 5 seconds... (Ctrl+C to exit)${NC}"
}

# Main loop
while true; do
    show_status
    sleep 5
done