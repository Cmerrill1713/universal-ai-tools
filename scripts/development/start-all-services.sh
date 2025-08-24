#!/bin/bash

# Start All Universal AI Tools Services with Tracing
# This script starts the complete hybrid architecture

set -e

echo "🚀 Starting Universal AI Tools - Hybrid Architecture"
echo "===================================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if services are already running
check_port() {
    if lsof -i :$1 > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠ Port $1 is already in use${NC}"
        return 1
    fi
    return 0
}

# Kill existing services
echo "Cleaning up existing services..."
pkill -f "llm-router" 2>/dev/null || true
pkill -f "websocket-service" 2>/dev/null || true
pkill -f "go-api-gateway/main" 2>/dev/null || true
sleep 2

# Start Supabase if not running
echo -e "${BLUE}Checking Supabase...${NC}"
if ! docker ps | grep -q "supabase_db_universal-ai-tools"; then
    echo "Starting Supabase..."
    cd /Users/christianmerrill/Desktop/universal-ai-tools
    supabase start
    cd -
else
    echo -e "${GREEN}✓ Supabase is running${NC}"
fi
echo ""

# Start tracing stack if not running
echo -e "${BLUE}Checking tracing infrastructure...${NC}"
if ! docker ps | grep -q "uat-jaeger"; then
    echo "Starting tracing stack..."
    cd distributed-tracing
    docker-compose -f docker-compose-minimal.yml up -d
    sleep 5
    cd ..
fi
echo -e "${GREEN}✓ Tracing infrastructure is running${NC}"
echo ""

# Environment variables for tracing
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
export OTEL_EXPORTER_OTLP_PROTOCOL=grpc
export OTEL_TRACES_EXPORTER=otlp
export OTEL_METRICS_EXPORTER=otlp
export QDRANT_URL=http://localhost:6333

# Start LLM Router (Rust) - Port 8001
if check_port 8001; then
    echo -e "${BLUE}Starting LLM Router (Rust)...${NC}"
    cd rust-services/llm-router
    RUST_LOG=info,llm_router=debug \
    OTEL_SERVICE_NAME=llm-router \
    SERVICE_NAME=llm-router \
    LLM_ROUTER_PORT=8001 \
    METRICS_PORT=9001 \
    ./target/release/llm-router > ../../logs/llm-router.log 2>&1 &
    LLM_PID=$!
    echo -e "${GREEN}✓ LLM Router started (PID: $LLM_PID)${NC}"
    cd ../..
else
    echo -e "${RED}✗ Cannot start LLM Router - port 8001 in use${NC}"
fi
echo ""

# Start WebSocket Service (Go) - Port 8080
if check_port 8080; then
    echo -e "${BLUE}Starting WebSocket Service (Go)...${NC}"
    cd rust-services/go-websocket
    OTEL_SERVICE_NAME=websocket-service \
    OTEL_EXPORTER_OTLP_INSECURE=true \
    WEBSOCKET_PORT=8080 \
    METRICS_PORT=9003 \
    REDIS_URL=localhost:6379 \
    ./websocket-service > ../../logs/websocket.log 2>&1 &
    WS_PID=$!
    echo -e "${GREEN}✓ WebSocket Service started (PID: $WS_PID)${NC}"
    cd ../..
else
    echo -e "${RED}✗ Cannot start WebSocket Service - port 8080 in use${NC}"
fi
echo ""

# Start API Gateway (Go) - Port 8090
if check_port 8090; then
    echo -e "${BLUE}Starting API Gateway (Go)...${NC}"
    cd go-api-gateway
    OTEL_SERVICE_NAME=api-gateway \
    OTEL_EXPORTER_OTLP_INSECURE=true \
    UAT_SERVER_PORT=8090 \
    UAT_SECURITY_REQUIRE_AUTH=false \
    UAT_DATABASE_POSTGRESQL_PORT=54322 \
    UAT_DATABASE_POSTGRESQL_PASSWORD=postgres \
    ./main > ../logs/api-gateway.log 2>&1 &
    API_PID=$!
    echo -e "${GREEN}✓ API Gateway started (PID: $API_PID)${NC}"
    cd ..
else
    echo -e "${RED}✗ Cannot start API Gateway - port 8090 in use${NC}"
fi
echo ""

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 5

# Check service health
echo ""
echo -e "${BLUE}Checking service health...${NC}"
echo ""

check_service() {
    if curl -sf "$1" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $2 is healthy"
        return 0
    else
        echo -e "${RED}✗${NC} $2 is not responding"
        return 1
    fi
}

ALL_HEALTHY=true
check_service "http://localhost:8001/health" "LLM Router" || ALL_HEALTHY=false
check_service "http://localhost:8080/health" "WebSocket Service" || ALL_HEALTHY=false
check_service "http://localhost:8090/health" "API Gateway" || ALL_HEALTHY=false
check_service "http://localhost:16686/" "Jaeger" || ALL_HEALTHY=false
check_service "http://localhost:3000/api/health" "Grafana" || ALL_HEALTHY=false
check_service "http://localhost:6333/" "Qdrant" || ALL_HEALTHY=false

echo ""
echo "===================================================="
echo ""

if [ "$ALL_HEALTHY" = true ]; then
    echo -e "${GREEN}✅ All services are running and healthy!${NC}"
    echo ""
    echo "📊 Monitoring:"
    echo "  • Grafana Dashboard: http://localhost:3000/d/universal-ai-overview"
    echo "  • Jaeger Traces: http://localhost:16686"
    echo "  • Prometheus: http://localhost:9090"
    echo ""
    echo "🔌 Service Endpoints:"
    echo "  • LLM Router: http://localhost:8001"
    echo "  • WebSocket: http://localhost:8080"
    echo "  • API Gateway: http://localhost:8090"
    echo ""
    echo "📝 Logs:"
    echo "  • tail -f logs/llm-router.log"
    echo "  • tail -f logs/websocket.log"
    echo "  • tail -f logs/api-gateway.log"
    echo ""
    echo "🛑 To stop all services:"
    echo "  ./stop-all-services.sh"
else
    echo -e "${YELLOW}⚠ Some services are not healthy${NC}"
    echo "Check logs in the logs/ directory for details"
fi

echo "===================================================="

# Save PIDs for cleanup
echo "$LLM_PID" > .pids/llm-router.pid
echo "$WS_PID" > .pids/websocket.pid
echo "$API_PID" > .pids/api-gateway.pid