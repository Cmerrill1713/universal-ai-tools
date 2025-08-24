#!/bin/bash

# Start Universal AI Tools Services with Tracing Enabled

set -a
source .env.tracing
set +a

echo "🚀 Starting Universal AI Tools with Distributed Tracing"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if tracing stack is running
check_service() {
    if curl -sf "$1" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $2 is running"
        return 0
    else
        echo -e "${YELLOW}⚠${NC} $2 is not running"
        return 1
    fi
}

echo "Checking tracing infrastructure..."
check_service "http://localhost:16686/" "Jaeger"
check_service "http://localhost:3000/api/health" "Grafana"
check_service "http://localhost:9090/-/healthy" "Prometheus"
check_service "http://localhost:6333/" "Qdrant"
echo ""

# Start LLM Router if built
if [ -f "../rust-services/llm-router/target/release/llm-router" ]; then
    echo -e "${BLUE}Starting LLM Router (Rust)...${NC}"
    cd ../rust-services/llm-router
    OTEL_SERVICE_NAME=llm-router \
    OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317 \
    QDRANT_URL=http://localhost:6333 \
    ./target/release/llm-router &
    LLM_PID=$!
    echo "LLM Router started with PID: $LLM_PID"
    cd - > /dev/null
else
    echo -e "${YELLOW}LLM Router not built. Build with:${NC}"
    echo "  cd ../rust-services/llm-router && cargo build --release"
fi
echo ""

# Start WebSocket Service if built
if [ -f "../rust-services/go-websocket/websocket-service" ]; then
    echo -e "${BLUE}Starting WebSocket Service (Go)...${NC}"
    cd ../rust-services/go-websocket
    OTEL_SERVICE_NAME=websocket-service \
    OTEL_EXPORTER_OTLP_ENDPOINT=localhost:4317 \
    OTEL_EXPORTER_OTLP_INSECURE=true \
    ./websocket-service &
    WS_PID=$!
    echo "WebSocket Service started with PID: $WS_PID"
    cd - > /dev/null
else
    echo -e "${YELLOW}WebSocket Service not built. Build with:${NC}"
    echo "  cd ../rust-services/go-websocket && go build"
fi
echo ""

# Start Go API Gateway if available
if [ -f "../go-api-gateway/main" ]; then
    echo -e "${BLUE}Starting API Gateway (Go)...${NC}"
    cd ../go-api-gateway
    OTEL_SERVICE_NAME=api-gateway \
    OTEL_EXPORTER_OTLP_ENDPOINT=localhost:4317 \
    UAT_SERVER_PORT=8090 \
    ./main &
    API_PID=$!
    echo "API Gateway started with PID: $API_PID"
    cd - > /dev/null
else
    echo -e "${YELLOW}API Gateway not built. Build with:${NC}"
    echo "  cd ../go-api-gateway && go build cmd/main.go"
fi
echo ""

echo "=================================================="
echo -e "${GREEN}Services Started!${NC}"
echo ""
echo "📊 Monitoring URLs:"
echo "  • Jaeger UI:       http://localhost:16686"
echo "  • Grafana:         http://localhost:3000 (admin/admin123)"
echo "  • Prometheus:      http://localhost:9090"
echo "  • Qdrant:          http://localhost:6333/dashboard"
echo ""
echo "🔌 Service Endpoints:"
echo "  • LLM Router:      http://localhost:8001"
echo "  • WebSocket:       http://localhost:8080"
echo "  • API Gateway:     http://localhost:8090"
echo ""
echo "📈 View Dashboard:"
echo "  http://localhost:3000/d/universal-ai-overview"
echo ""
echo "To stop services, run: pkill -f 'llm-router|websocket-service|main'"
echo "=================================================="

# Keep script running and show logs
if [ -n "$LLM_PID" ] || [ -n "$WS_PID" ] || [ -n "$API_PID" ]; then
    echo ""
    echo "Press Ctrl+C to stop all services..."
    
    # Trap Ctrl+C to cleanup
    trap 'echo "Stopping services..."; kill $LLM_PID $WS_PID $API_PID 2>/dev/null; exit' INT
    
    # Wait for services
    wait
fi