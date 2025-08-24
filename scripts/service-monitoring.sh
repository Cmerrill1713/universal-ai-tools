#!/bin/bash

# Universal AI Tools - Service Discovery & Health Monitoring
# Comprehensive monitoring script for hybrid Go/Rust/TypeScript architecture

set -eo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Service definitions (bash 3.2 compatible)
SERVICES="
nginx_load_balancer:8000:/health
rust_llm_router:8003:/health
go_websocket:8080:/health
go_api_gateway:8001:/health
typescript_legacy:9999:/api/health
"

LOAD_BALANCED_ENDPOINTS="
llm_router_lb:8000:/llm/health
websocket_lb:8000:/ws/health
api_gateway_lb:8000:/gateway/health
load_balancer_status:8000:/lb/status
"

# Function to check service health
check_service() {
    local service_name=$1
    local port=$2
    local endpoint=$3
    local url="http://localhost:${port}${endpoint}"
    
    # Check if port is listening
    if ! lsof -i :$port >/dev/null 2>&1; then
        echo -e "${RED}❌ $service_name - Port $port not listening${NC}"
        return 1
    fi
    
    # Check HTTP response
    if response=$(curl -s --max-time 5 "$url" 2>/dev/null); then
        # Try to extract status
        if command -v jq >/dev/null 2>&1; then
            status=$(echo "$response" | jq -r '.status // empty' 2>/dev/null)
            if [[ "$status" == "healthy" ]]; then
                echo -e "${GREEN}✅ $service_name - ${status}${NC} ($url)"
                return 0
            elif [[ -n "$status" ]]; then
                echo -e "${YELLOW}⚠️  $service_name - ${status}${NC} ($url)"
                return 0
            else
                echo -e "${GREEN}✅ $service_name - responding${NC} ($url)"
                return 0
            fi
        else
            echo -e "${GREEN}✅ $service_name - responding${NC} ($url)"
            return 0
        fi
    else
        echo -e "${RED}❌ $service_name - Not responding${NC} ($url)"
        return 1
    fi
}

# Function to display header
display_header() {
    clear
    echo -e "${BLUE}╭─────────────────────────────────────────────────────────────╮${NC}"
    echo -e "${BLUE}│           🔍 Universal AI Tools Service Monitor             │${NC}"
    echo -e "${BLUE}│                  Hybrid Architecture Status                 │${NC}"
    echo -e "${BLUE}╰─────────────────────────────────────────────────────────────╯${NC}"
    echo ""
    echo -e "${YELLOW}📅 Monitoring at: $(date)${NC}"
    echo ""
}

# Function to check all services
check_all_services() {
    local healthy_count=0
    local total_count=0
    
    echo -e "${BLUE}🔧 Direct Service Health:${NC}"
    echo "────────────────────────────"
    
    # Check direct services
    echo "$SERVICES" | while IFS=':' read -r service_name port endpoint; do
        if [[ -n "$service_name" ]]; then
            ((total_count++))
            if check_service "$service_name" "$port" "$endpoint"; then
                ((healthy_count++))
            fi
        fi
    done
    
    echo ""
    echo -e "${BLUE}⚖️  Load Balanced Endpoints:${NC}"
    echo "─────────────────────────────"
    
    # Check load balanced endpoints
    echo "$LOAD_BALANCED_ENDPOINTS" | while IFS=':' read -r endpoint_name port endpoint; do
        if [[ -n "$endpoint_name" ]]; then
            ((total_count++))
            if check_service "$endpoint_name" "$port" "$endpoint"; then
                ((healthy_count++))
            fi
        fi
    done
    
    echo ""
    echo -e "${BLUE}📊 System Summary:${NC}"
    echo "───────────────────"
    
    # Get actual counts by re-running checks silently
    healthy_count=0
    total_count=0
    
    echo "$SERVICES" | while IFS=':' read -r service_name port endpoint; do
        if [[ -n "$service_name" ]]; then
            ((total_count++))
            if lsof -i :$port >/dev/null 2>&1 && curl -s --max-time 2 "http://localhost:${port}${endpoint}" >/dev/null 2>&1; then
                ((healthy_count++))
            fi
        fi
    done
    
    echo "$LOAD_BALANCED_ENDPOINTS" | while IFS=':' read -r endpoint_name port endpoint; do
        if [[ -n "$endpoint_name" ]]; then
            ((total_count++))
            if lsof -i :$port >/dev/null 2>&1 && curl -s --max-time 2 "http://localhost:${port}${endpoint}" >/dev/null 2>&1; then
                ((healthy_count++))
            fi
        fi
    done
    
    # Calculate summary
    local running_services=$(lsof -i TCP:8000,8001,8003,8080,9999 2>/dev/null | grep LISTEN | wc -l | tr -d ' ')
    
    if [[ $running_services -ge 5 ]]; then
        echo -e "${GREEN}🎯 System Status: EXCELLENT (${running_services}/5 ports active)${NC}"
    elif [[ $running_services -ge 4 ]]; then
        echo -e "${YELLOW}⚠️  System Status: GOOD (${running_services}/5 ports active)${NC}"
    elif [[ $running_services -ge 3 ]]; then
        echo -e "${YELLOW}⚠️  System Status: DEGRADED (${running_services}/5 ports active)${NC}"
    else
        echo -e "${RED}🚨 System Status: CRITICAL (${running_services}/5 ports active)${NC}"
    fi
    
    echo -e "💾 Memory Usage: $(ps -A -o %mem | awk '{s+=$1} END {printf "%.1f%%", s}')"
    echo -e "🔌 Active Connections: $(lsof -i -P -n | grep LISTEN | wc -l | tr -d ' ')"
}

# Function to display service discovery info
show_service_discovery() {
    echo ""
    echo -e "${BLUE}🗺️  Service Discovery Map:${NC}"
    echo "─────────────────────────────"
    echo -e "Load Balancer Entry Point:  ${GREEN}http://localhost:8000${NC}"
    echo ""
    echo -e "Backend Services:"
    echo -e "  ├── 🦀 Rust LLM Router:    ${GREEN}http://localhost:8003${NC} (High Performance AI)"
    echo -e "  ├── 🐹 Go WebSocket:       ${GREEN}http://localhost:8080${NC} (Real-time Communication)"
    echo -e "  ├── 🐹 Go API Gateway:     ${GREEN}http://localhost:8001${NC} (Next-Gen API Layer)"
    echo -e "  └── 🟨 TypeScript Legacy:  ${GREEN}http://localhost:9999${NC} (Legacy Support)"
    echo ""
    echo -e "Load Balanced Routes:"
    echo -e "  ├── /v1/completions → Rust LLM Router"
    echo -e "  ├── /ws/* → Go WebSocket Service"
    echo -e "  ├── /api/v1/* → Go API Gateway"
    echo -e "  └── /api/* → TypeScript Legacy"
}

# Function to run continuous monitoring
continuous_monitor() {
    local interval=${1:-10}
    
    echo -e "${GREEN}🔄 Starting continuous monitoring (${interval}s intervals)${NC}"
    echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
    echo ""
    
    while true; do
        display_header
        check_all_services
        show_service_discovery
        
        echo ""
        echo -e "${BLUE}Next check in ${interval} seconds...${NC}"
        sleep $interval
    done
}

# Function to run single check
single_check() {
    display_header
    check_all_services
    show_service_discovery
    echo ""
}

# Function to display help
show_help() {
    echo "Universal AI Tools Service Monitor"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  check                 - Run single health check"
    echo "  monitor [interval]    - Run continuous monitoring (default: 10s)"
    echo "  ports                 - Show active ports"
    echo "  help                  - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 check"
    echo "  $0 monitor 5"
    echo "  $0 ports"
    echo ""
}

# Function to show ports
show_ports() {
    echo -e "${BLUE}🔌 Active Service Ports:${NC}"
    echo "─────────────────────────"
    
    for port in 8000 8001 8003 8080 9999; do
        if lsof -i :$port >/dev/null 2>&1; then
            process=$(lsof -i :$port -t 2>/dev/null | head -1)
            if [[ -n "$process" ]]; then
                proc_name=$(ps -p $process -o comm= 2>/dev/null)
                echo -e "${GREEN}✅ Port $port - $proc_name (PID: $process)${NC}"
            else
                echo -e "${GREEN}✅ Port $port - Active${NC}"
            fi
        else
            echo -e "${RED}❌ Port $port - Not listening${NC}"
        fi
    done
}

# Main execution
main() {
    case "${1:-check}" in
        "check")
            single_check
            ;;
        "monitor")
            continuous_monitor "${2:-10}"
            ;;
        "ports")
            show_ports
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            echo -e "${RED}❌ Unknown command: $1${NC}"
            show_help
            exit 1
            ;;
    esac
}

# Trap Ctrl+C to exit gracefully
trap 'echo -e "\n${YELLOW}👋 Monitoring stopped by user${NC}"; exit 0' INT

main "$@"