#!/bin/bash

# Universal AI Tools - Unified Service Orchestration
# Manages Go API Gateway and Rust LLM Router services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
GO_API_PORT=8082
RUST_LLM_PORT=8083
LOG_FILE="/tmp/universal-ai-tools.log"

# Service directories
GO_API_DIR="go-api-gateway"
RUST_LLM_DIR="rust-services/llm-router"

echo -e "${BLUE}🚀 Universal AI Tools - Unified Service Orchestration${NC}"
echo -e "${BLUE}=================================================${NC}"

# Function to check if port is available
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null; then
        echo -e "${YELLOW}⚠️  Port $port is already in use${NC}"
        return 1
    fi
    return 0
}

# Function to build Go API Gateway
build_go_api() {
    echo -e "${BLUE}🔨 Building Go API Gateway...${NC}"
    cd $GO_API_DIR
    if go build ./cmd/main.go; then
        echo -e "${GREEN}✅ Go API Gateway built successfully${NC}"
        cd ..
        return 0
    else
        echo -e "${RED}❌ Failed to build Go API Gateway${NC}"
        cd ..
        return 1
    fi
}

# Function to build Rust LLM Router
build_rust_llm() {
    echo -e "${BLUE}🔨 Building Rust LLM Router...${NC}"
    cd $RUST_LLM_DIR
    if cargo build --release; then
        echo -e "${GREEN}✅ Rust LLM Router built successfully${NC}"
        cd ../..
        return 0
    else
        echo -e "${RED}❌ Failed to build Rust LLM Router${NC}"
        cd ../..
        return 1
    fi
}

# Function to start Go API Gateway
start_go_api() {
    echo -e "${BLUE}🌐 Starting Go API Gateway on port $GO_API_PORT...${NC}"
    cd $GO_API_DIR
    
    UAT_SERVER_PORT=$GO_API_PORT \
    UAT_ENVIRONMENT=development \
    UAT_SECURITY_JWT_SECRET=dev-secret-key \
    UAT_SECURITY_REQUIRE_AUTH=false \
    ./main >> $LOG_FILE 2>&1 &
    
    local go_pid=$!
    cd ..
    
    # Wait a moment and check if the service started
    sleep 2
    if kill -0 $go_pid 2>/dev/null; then
        echo -e "${GREEN}✅ Go API Gateway started successfully (PID: $go_pid)${NC}"
        echo $go_pid > /tmp/go-api-gateway.pid
        return 0
    else
        echo -e "${RED}❌ Failed to start Go API Gateway${NC}"
        return 1
    fi
}

# Function to start Rust LLM Router
start_rust_llm() {
    echo -e "${BLUE}🦀 Starting Rust LLM Router on port $RUST_LLM_PORT...${NC}"
    cd $RUST_LLM_DIR
    
    RUST_LOG=info \
    LLM_ROUTER_PORT=$RUST_LLM_PORT \
    ./target/release/llm-router >> $LOG_FILE 2>&1 &
    
    local rust_pid=$!
    cd ../..
    
    # Wait a moment and check if the service started
    sleep 2
    if kill -0 $rust_pid 2>/dev/null; then
        echo -e "${GREEN}✅ Rust LLM Router started successfully (PID: $rust_pid)${NC}"
        echo $rust_pid > /tmp/rust-llm-router.pid
        return 0
    else
        echo -e "${RED}❌ Failed to start Rust LLM Router${NC}"
        return 1
    fi
}

# Function to check service health
check_health() {
    echo -e "${BLUE}🏥 Checking service health...${NC}"
    
    # Check Go API Gateway
    if curl -s http://localhost:$GO_API_PORT/api/health > /dev/null; then
        echo -e "${GREEN}✅ Go API Gateway health check passed${NC}"
    else
        echo -e "${RED}❌ Go API Gateway health check failed${NC}"
    fi
    
    # Check migration status
    echo -e "${BLUE}📊 Migration Status:${NC}"
    curl -s http://localhost:$GO_API_PORT/migration/status | python3 -m json.tool 2>/dev/null || echo "Migration status unavailable"
}

# Function to stop all services
stop_services() {
    echo -e "${YELLOW}🛑 Stopping all services...${NC}"
    
    if [ -f /tmp/go-api-gateway.pid ]; then
        local go_pid=$(cat /tmp/go-api-gateway.pid)
        if kill -0 $go_pid 2>/dev/null; then
            kill $go_pid
            echo -e "${GREEN}✅ Go API Gateway stopped${NC}"
        fi
        rm -f /tmp/go-api-gateway.pid
    fi
    
    if [ -f /tmp/rust-llm-router.pid ]; then
        local rust_pid=$(cat /tmp/rust-llm-router.pid)
        if kill -0 $rust_pid 2>/dev/null; then
            kill $rust_pid
            echo -e "${GREEN}✅ Rust LLM Router stopped${NC}"
        fi
        rm -f /tmp/rust-llm-router.pid
    fi
}

# Function to show service status
show_status() {
    echo -e "${BLUE}📊 Service Status:${NC}"
    echo -e "${BLUE}=================${NC}"
    
    # Go API Gateway status
    if [ -f /tmp/go-api-gateway.pid ] && kill -0 $(cat /tmp/go-api-gateway.pid) 2>/dev/null; then
        echo -e "${GREEN}✅ Go API Gateway: RUNNING (PID: $(cat /tmp/go-api-gateway.pid), Port: $GO_API_PORT)${NC}"
    else
        echo -e "${RED}❌ Go API Gateway: STOPPED${NC}"
    fi
    
    # Rust LLM Router status  
    if [ -f /tmp/rust-llm-router.pid ] && kill -0 $(cat /tmp/rust-llm-router.pid) 2>/dev/null; then
        echo -e "${GREEN}✅ Rust LLM Router: RUNNING (PID: $(cat /tmp/rust-llm-router.pid), Port: $RUST_LLM_PORT)${NC}"
    else
        echo -e "${RED}❌ Rust LLM Router: STOPPED${NC}"
    fi
    
    echo ""
    echo -e "${BLUE}📡 Service Endpoints:${NC}"
    echo -e "  • Go API Gateway: http://localhost:$GO_API_PORT"
    echo -e "  • Health Check: http://localhost:$GO_API_PORT/api/health"
    echo -e "  • Migration Status: http://localhost:$GO_API_PORT/migration/status"
    echo -e "  • Chat API: http://localhost:$GO_API_PORT/api/v1/chat/"
}

# Main execution
case "${1:-start}" in
    "start")
        echo -e "${BLUE}🏁 Starting unified service orchestration...${NC}"
        
        # Check prerequisites
        if ! command -v go &> /dev/null; then
            echo -e "${RED}❌ Go is not installed${NC}"
            exit 1
        fi
        
        if ! command -v cargo &> /dev/null; then
            echo -e "${RED}❌ Rust/Cargo is not installed${NC}"
            exit 1
        fi
        
        # Check ports
        check_port $GO_API_PORT || echo -e "${YELLOW}⚠️  Will attempt to start anyway${NC}"
        
        # Build services
        build_go_api || exit 1
        # Note: Rust LLM Router build optional for now
        
        # Start services
        start_go_api || exit 1
        # start_rust_llm || echo -e "${YELLOW}⚠️  Rust LLM Router not started${NC}"
        
        # Health check
        sleep 3
        check_health
        
        echo ""
        echo -e "${GREEN}🎉 Universal AI Tools services started successfully!${NC}"
        echo -e "${BLUE}💡 Use './scripts/start-unified-services.sh status' to check service status${NC}"
        echo -e "${BLUE}💡 Use './scripts/start-unified-services.sh stop' to stop all services${NC}"
        echo -e "${BLUE}📝 Logs available at: $LOG_FILE${NC}"
        ;;
        
    "stop")
        stop_services
        echo -e "${GREEN}✅ All services stopped${NC}"
        ;;
        
    "status")
        show_status
        ;;
        
    "restart")
        stop_services
        sleep 2
        $0 start
        ;;
        
    "health")
        check_health
        ;;
        
    "logs")
        echo -e "${BLUE}📝 Tailing service logs...${NC}"
        tail -f $LOG_FILE
        ;;
        
    *)
        echo -e "${BLUE}Usage: $0 {start|stop|status|restart|health|logs}${NC}"
        echo ""
        echo -e "${BLUE}Commands:${NC}"
        echo -e "  start   - Start all services"
        echo -e "  stop    - Stop all services"
        echo -e "  status  - Show service status"
        echo -e "  restart - Restart all services"
        echo -e "  health  - Check service health"
        echo -e "  logs    - Show service logs"
        exit 1
        ;;
esac