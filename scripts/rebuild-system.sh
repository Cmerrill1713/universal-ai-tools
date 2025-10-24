#!/bin/bash
# Universal AI Tools - Complete Rebuild Script
# Automates the entire rebuild process

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Universal AI Tools - Complete Rebuild${NC}"
echo "=========================================="

# Function to check prerequisites
check_prerequisites() {
    echo -e "${BLUE}🔍 Checking prerequisites...${NC}"
    
    command -v rustc >/dev/null 2>&1 || { echo -e "${RED}❌ Rust not installed${NC}"; exit 1; }
    command -v go >/dev/null 2>&1 || { echo -e "${RED}❌ Go not installed${NC}"; exit 1; }
    command -v python3 >/dev/null 2>&1 || { echo -e "${RED}❌ Python3 not installed${NC}"; exit 1; }
    command -v docker >/dev/null 2>&1 || { echo -e "${RED}❌ Docker not installed${NC}"; exit 1; }
    command -v node >/dev/null 2>&1 || { echo -e "${RED}❌ Node.js not installed${NC}"; exit 1; }
    
    echo -e "${GREEN}✅ All prerequisites met${NC}"
}

# Function to check port
check_port() {
    local port=$1
    if lsof -i :$port >/dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to start service
start_service() {
    local name=$1
    local port=$2
    local command=$3
    local working_dir=$4
    
    echo -e "${BLUE}Starting $name on port $port...${NC}"
    
    if check_port $port; then
        echo -e "${YELLOW}$name already running on port $port${NC}"
        return 0
    fi
    
    cd "$working_dir"
    eval "$command" > "/tmp/${name// /_}.log" 2>&1 &
    local pid=$!
    echo "$name=$pid" >> "$PROJECT_ROOT/.service-pids"
    
    # Wait for service
    local waited=0
    echo -n "   Waiting for $name"
    while [ $waited -lt 30 ]; do
        if check_port $port; then
            echo ""
            echo -e "${GREEN}✅ $name ready on port $port${NC}"
            return 0
        fi
        sleep 1
        waited=$((waited + 1))
        echo -n "."
    done
    
    echo ""
    echo -e "${RED}❌ $name failed to start on port $port${NC}"
    return 1
}

# Main rebuild process
main() {
    PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    cd "$PROJECT_ROOT"
    
    # Clear previous PIDs
    > .service-pids
    
    # Phase 1: Prerequisites
    check_prerequisites
    
    # Phase 2: Infrastructure
    echo -e "${BLUE}🐳 Starting Docker infrastructure...${NC}"
    docker-compose up -d postgres redis ollama
    sleep 10
    
    # Phase 3: Core Services
    echo -e "${BLUE}🦀 Starting Rust AI services...${NC}"
    start_service "LLM Router" 3033 "cargo run --release" "crates/llm-router"
    start_service "Assistantd" 3032 "cargo run --release" "crates/assistantd"
    start_service "Vector DB" 3034 "cargo run --release" "crates/vector-db"
    
    echo -e "${BLUE}🐹 Starting Go networking services...${NC}"
    start_service "Load Balancer" 8011 "go run main.go" "go-services/load-balancer"
    start_service "Auth Service" 8015 "go run main.go" "go-services/auth-service"
    start_service "Memory Service" 8017 "go run main.go" "go-services/memory-service"
    start_service "Chat Service" 8016 "go run main.go" "go-services/chat-service"
    start_service "Cache Coordinator" 8012 "go run main.go" "go-services/cache-coordinator"
    start_service "Metrics Aggregator" 8013 "go run main.go" "go-services/metrics-aggregator"
    start_service "WebSocket Hub" 8018 "go run main.go" "go-services/websocket-hub"
    
    echo -e "${BLUE}🐍 Starting Python AI services...${NC}"
    start_service "DSPy Orchestrator" 8766 "python server.py" "python-services/dspy-orchestrator"
    
    # Phase 4: Verification
    echo -e "${BLUE}🏥 System health check...${NC}"
    sleep 5
    
    services=("3032:Assistantd" "3033:LLM Router" "3034:Vector DB" "8011:Load Balancer" 
              "8012:Cache Coordinator" "8013:Metrics Aggregator" "8015:Auth Service"
              "8016:Chat Service" "8017:Memory Service" "8018:WebSocket Hub" "8766:DSPy Orchestrator")
    
    healthy=0
    total=${#services[@]}
    
    for service in "${services[@]}"; do
        port="${service%%:*}"
        name="${service##*:}"
        
        if curl -s "http://localhost:$port/health" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ $name${NC}"
            ((healthy++))
        else
            echo -e "${RED}❌ $name${NC}"
        fi
    done
    
    echo ""
    echo -e "${BLUE}📊 System Status: $healthy/$total services healthy${NC}"
    
    if [ $healthy -eq $total ]; then
        echo -e "${GREEN}🎉 Complete rebuild successful!${NC}"
        echo -e "${BLUE}🚀 System ready for production use${NC}"
        echo ""
        echo -e "${BLUE}🔗 Service Endpoints:${NC}"
        echo -e "${BLUE}   🧠 LLM Router: http://localhost:3033/health${NC}"
        echo -e "${BLUE}   ⚖️  Load Balancer: http://localhost:8011/health${NC}"
        echo -e "${BLUE}   📊 Metrics Aggregator: http://localhost:8013/health${NC}"
        echo -e "${BLUE}   🤖 DSPy Orchestrator: http://localhost:8766${NC}"
        echo ""
        echo -e "${GREEN}🎯 The complete Universal AI Tools system is now operational!${NC}"
    else
        echo -e "${YELLOW}⚠️  Some services failed to start${NC}"
        echo -e "${BLUE}📋 Check logs in /tmp/ for details${NC}"
        echo ""
        echo -e "${YELLOW}Common fixes:${NC}"
        echo -e "${YELLOW}  • Check port conflicts: lsof -i :PORT${NC}"
        echo -e "${YELLOW}  • Verify dependencies: cargo build, go mod tidy${NC}"
        echo -e "${YELLOW}  • Restart Docker: docker-compose down && docker-compose up -d${NC}"
    fi
}

# Run main function
main "$@"
