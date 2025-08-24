#!/bin/bash

# Start Evolution Services - Launches all self-evolving architecture services

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

BASE_DIR="/Users/christianmerrill/Desktop/universal-ai-tools"
SERVICES_STARTED=()

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}Shutting down evolution services...${NC}"
    for service in "${SERVICES_STARTED[@]}"; do
        echo "Stopping $service"
        pkill -f "$service" 2>/dev/null || true
    done
}

trap cleanup EXIT

# Start Technology Scanner (Rust)
start_tech_scanner() {
    echo -e "${CYAN}🔬 Starting Technology Scanner (Rust)...${NC}"
    
    cd "$BASE_DIR/rust-services/tech-scanner"
    
    if ! cargo check > /dev/null 2>&1; then
        echo -e "${RED}❌ Technology Scanner compilation failed${NC}"
        return 1
    fi
    
    # Start service in background
    RUST_LOG=info cargo run --release > /tmp/tech-scanner.log 2>&1 &
    local tech_scanner_pid=$!
    SERVICES_STARTED+=("tech-scanner")
    
    # Wait for service to be ready
    sleep 3
    
    if curl -s "http://localhost:8084/health" > /dev/null; then
        echo -e "${GREEN}✓ Technology Scanner running on port 8084${NC}"
        return 0
    else
        echo -e "${RED}❌ Technology Scanner failed to start${NC}"
        return 1
    fi
}

# Start Architecture AI (Rust)
start_architecture_ai() {
    echo -e "${MAGENTA}🧠 Starting Architecture AI (Rust)...${NC}"
    
    cd "$BASE_DIR/rust-services/architecture-ai"
    
    if ! cargo check > /dev/null 2>&1; then
        echo -e "${RED}❌ Architecture AI compilation failed${NC}"
        return 1
    fi
    
    # Start service in background
    RUST_LOG=info cargo run --release > /tmp/architecture-ai.log 2>&1 &
    local arch_ai_pid=$!
    SERVICES_STARTED+=("architecture-ai")
    
    # Wait for service to be ready
    sleep 3
    
    if curl -s "http://localhost:8085/health" > /dev/null; then
        echo -e "${GREEN}✓ Architecture AI running on port 8085${NC}"
        return 0
    else
        echo -e "${RED}❌ Architecture AI failed to start${NC}"
        return 1
    fi
}

# Start Go API Gateway with Evolution endpoints
start_go_gateway() {
    echo -e "${BLUE}🌐 Starting Go API Gateway with Evolution...${NC}"
    
    cd "$BASE_DIR/go-api-gateway"
    
    if ! go build -o bin/go-api-gateway ./cmd/server/main.go; then
        echo -e "${RED}❌ Go API Gateway compilation failed${NC}"
        return 1
    fi
    
    # Start gateway with evolution endpoints
    ./bin/go-api-gateway > /tmp/go-gateway.log 2>&1 &
    local gateway_pid=$!
    SERVICES_STARTED+=("go-api-gateway")
    
    # Wait for service to be ready
    sleep 2
    
    if curl -s "http://localhost:8080/health" > /dev/null; then
        echo -e "${GREEN}✓ Go API Gateway running on port 8080${NC}"
        return 0
    else
        echo -e "${RED}❌ Go API Gateway failed to start${NC}"
        return 1
    fi
}

# Initialize evolution database
init_evolution_db() {
    echo -e "${CYAN}📊 Initializing evolution database...${NC}"
    
    # Create auto-heal directory
    mkdir -p /tmp/uat-autoheal
    
    # Initialize solutions database
    "$BASE_DIR/scripts/integrated-evolution-healer.sh" init
    
    echo -e "${GREEN}✓ Evolution database initialized${NC}"
}

# Test evolution integration
test_evolution_integration() {
    echo -e "\n${BLUE}🧪 Testing evolution integration...${NC}"
    
    # Test technology scanner
    echo -e "${CYAN}Testing technology scanner...${NC}"
    local tech_response=$(curl -s "http://localhost:8084/api/scan/trigger" \
        -H "Content-Type: application/json" \
        -d '{"problem_context": "test integration", "affected_service": "test-service"}' 2>/dev/null)
    
    if [ -n "$tech_response" ]; then
        echo -e "${GREEN}✓ Technology scanner responding${NC}"
    else
        echo -e "${YELLOW}⚠ Technology scanner not responding${NC}"
    fi
    
    # Test architecture AI
    echo -e "${CYAN}Testing architecture AI...${NC}"
    local arch_response=$(curl -s "http://localhost:8085/api/decisions" \
        -H "Content-Type: application/json" \
        -d '{"migration_recommendations":[{"from_technology":"test","to_technology":"test2","confidence_score":0.8,"estimated_effort_days":1,"benefits":["test"],"risks":[]}],"system_constraints":{"max_downtime_minutes":5,"budget_constraints":1000,"team_size":1},"priority_factors":{"performance":0.8,"maintainability":0.9,"cost":0.3}}' 2>/dev/null)
    
    if [ -n "$arch_response" ]; then
        echo -e "${GREEN}✓ Architecture AI responding${NC}"
    else
        echo -e "${YELLOW}⚠ Architecture AI not responding${NC}"
    fi
    
    # Test evolution endpoints
    echo -e "${CYAN}Testing evolution API endpoints...${NC}"
    local evolution_response=$(curl -s "http://localhost:8080/api/evolution/scanner/status" 2>/dev/null)
    
    if [ -n "$evolution_response" ]; then
        echo -e "${GREEN}✓ Evolution API endpoints responding${NC}"
    else
        echo -e "${YELLOW}⚠ Evolution API endpoints not responding${NC}"
    fi
    
    # Test auto-healing integration
    echo -e "${CYAN}Testing auto-healing integration...${NC}"
    "$BASE_DIR/scripts/integrated-evolution-healer.sh" heal "test integration issue" "test-service" > /tmp/evolution-test.log 2>&1
    
    if grep -q "Enhanced Evolutionary Healing System" /tmp/evolution-test.log; then
        echo -e "${GREEN}✓ Enhanced auto-healing system integrated${NC}"
    else
        echo -e "${YELLOW}⚠ Auto-healing integration issue${NC}"
    fi
}

# Show service status
show_service_status() {
    echo -e "\n${BLUE}📊 Evolution Services Status${NC}"
    echo -e "================================"
    
    # Technology Scanner
    if curl -s "http://localhost:8084/health" > /dev/null; then
        echo -e "Technology Scanner (8084): ${GREEN}✓ Running${NC}"
    else
        echo -e "Technology Scanner (8084): ${RED}✗ Stopped${NC}"
    fi
    
    # Architecture AI
    if curl -s "http://localhost:8085/health" > /dev/null; then
        echo -e "Architecture AI (8085):    ${GREEN}✓ Running${NC}"
    else
        echo -e "Architecture AI (8085):    ${RED}✗ Stopped${NC}"
    fi
    
    # Go API Gateway
    if curl -s "http://localhost:8080/health" > /dev/null; then
        echo -e "Go API Gateway (8080):     ${GREEN}✓ Running${NC}"
    else
        echo -e "Go API Gateway (8080):     ${RED}✗ Stopped${NC}"
    fi
    
    echo -e "\n${CYAN}Service Logs:${NC}"
    echo -e "  Tech Scanner: /tmp/tech-scanner.log"
    echo -e "  Architecture AI: /tmp/architecture-ai.log"
    echo -e "  Go Gateway: /tmp/go-gateway.log"
    echo -e "  Evolution Test: /tmp/evolution-test.log"
}

# Main execution
main() {
    case "${1:-start}" in
        start)
            echo -e "${BLUE}🚀 Starting Self-Evolution Architecture Services${NC}"
            echo -e "================================================\n"
            
            init_evolution_db
            
            if start_tech_scanner && start_architecture_ai && start_go_gateway; then
                echo -e "\n${GREEN}✅ All evolution services started successfully!${NC}"
                
                test_evolution_integration
                show_service_status
                
                echo -e "\n${CYAN}Evolution system ready for autonomous operation!${NC}"
                echo -e "Use Ctrl+C to stop all services"
                
                # Keep services running
                wait
            else
                echo -e "\n${RED}❌ Failed to start some services${NC}"
                return 1
            fi
            ;;
        
        status)
            show_service_status
            ;;
        
        test)
            test_evolution_integration
            ;;
        
        stop)
            echo -e "${YELLOW}Stopping evolution services...${NC}"
            pkill -f "tech-scanner" 2>/dev/null || true
            pkill -f "architecture-ai" 2>/dev/null || true
            pkill -f "go-api-gateway" 2>/dev/null || true
            echo -e "${GREEN}✓ Services stopped${NC}"
            ;;
        
        *)
            echo "Usage: $0 {start|status|test|stop}"
            echo ""
            echo "  start  - Start all evolution services"
            echo "  status - Show service status"
            echo "  test   - Test evolution integration"
            echo "  stop   - Stop all services"
            ;;
    esac
}

main "$@"