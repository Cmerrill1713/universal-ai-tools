#!/bin/bash

# Universal AI Tools - Start Fixed Tracing Stack
# Complete observability with Grafana, Jaeger, Tempo, OTel Collector, and Qdrant

set -e

echo "=========================================="
echo "Universal AI Tools - Distributed Tracing"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if service is healthy
check_service() {
    local service=$1
    local url=$2
    local max_attempts=30
    local attempt=1
    
    echo -n "Checking $service..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -sf "$url" > /dev/null 2>&1; then
            echo -e " ${GREEN}✓${NC}"
            return 0
        fi
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo -e " ${RED}✗${NC}"
    return 1
}

# Parse command line arguments
WITH_APPS=false
CLEAN_START=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --with-apps)
            WITH_APPS=true
            shift
            ;;
        --clean)
            CLEAN_START=true
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --with-apps    Start with application services (LLM router, WebSocket)"
            echo "  --clean        Clean start (remove volumes)"
            echo "  --help         Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Clean start if requested
if [ "$CLEAN_START" = true ]; then
    echo -e "${YELLOW}Cleaning up existing containers and volumes...${NC}"
    docker-compose -f docker-compose-fixed.yml down -v
    rm -rf ./data/* 2>/dev/null || true
    echo -e "${GREEN}Cleanup complete${NC}"
    echo ""
fi

# Check Docker and Docker Compose
echo "Checking requirements..."
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker is not installed${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Docker Compose is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Docker and Docker Compose found"
echo ""

# Create necessary directories
echo "Creating data directories..."
mkdir -p ./data/{grafana,prometheus,tempo,jaeger,qdrant,otel}
chmod -R 777 ./data
echo -e "${GREEN}✓${NC} Data directories created"
echo ""

# Copy fixed configurations
echo "Setting up configurations..."
if [ -f "otel-collector-fixed.yml" ]; then
    echo -e "${GREEN}✓${NC} Using fixed OTel Collector configuration"
else
    echo -e "${YELLOW}Warning: otel-collector-fixed.yml not found, using default${NC}"
fi

if [ -f "tempo-fixed.yaml" ]; then
    echo -e "${GREEN}✓${NC} Using fixed Tempo configuration"
else
    echo -e "${YELLOW}Warning: tempo-fixed.yaml not found, using default${NC}"
fi

if [ -f "prometheus-fixed.yml" ]; then
    echo -e "${GREEN}✓${NC} Using fixed Prometheus configuration"
else
    echo -e "${YELLOW}Warning: prometheus-fixed.yml not found, using default${NC}"
fi
echo ""

# Start services
echo "Starting tracing infrastructure..."

if [ "$WITH_APPS" = true ]; then
    echo "Starting with application services..."
    docker-compose -f docker-compose-fixed.yml --profile with-apps up -d
else
    echo "Starting core tracing services only..."
    docker-compose -f docker-compose-fixed.yml up -d
fi

echo ""
echo "Waiting for services to be healthy..."
echo ""

# Check service health
ALL_HEALTHY=true

# Core services
check_service "Qdrant Vector DB" "http://localhost:6333/health" || ALL_HEALTHY=false
check_service "OTel Collector" "http://localhost:13133/health" || ALL_HEALTHY=false
check_service "Jaeger UI" "http://localhost:16686/" || ALL_HEALTHY=false
check_service "Tempo" "http://localhost:3200/ready" || ALL_HEALTHY=false
check_service "Prometheus" "http://localhost:9090/-/healthy" || ALL_HEALTHY=false
check_service "Grafana" "http://localhost:3000/api/health" || ALL_HEALTHY=false

# Application services (if enabled)
if [ "$WITH_APPS" = true ]; then
    echo ""
    echo "Checking application services..."
    check_service "LLM Router" "http://localhost:8001/health" || ALL_HEALTHY=false
    check_service "WebSocket Service" "http://localhost:8080/health" || ALL_HEALTHY=false
fi

echo ""
echo "=========================================="
echo ""

if [ "$ALL_HEALTHY" = true ]; then
    echo -e "${GREEN}✅ All services are healthy!${NC}"
    echo ""
    echo "📊 Access Points:"
    echo "  • Grafana:        http://localhost:3000 (admin/tracing123)"
    echo "  • Jaeger UI:      http://localhost:16686"
    echo "  • Prometheus:     http://localhost:9090"
    echo "  • Qdrant:         http://localhost:6333/dashboard"
    echo "  • OTel Collector: http://localhost:13133/health"
    echo ""
    echo "🔌 Tracing Endpoints:"
    echo "  • OTLP gRPC:      localhost:4317"
    echo "  • OTLP HTTP:      localhost:4318"
    echo ""
    
    if [ "$WITH_APPS" = true ]; then
        echo "🚀 Application Services:"
        echo "  • LLM Router:     http://localhost:8001"
        echo "  • WebSocket:      http://localhost:8080"
        echo ""
    fi
    
    echo "📝 Quick Test:"
    echo "  curl -X POST http://localhost:8001/v1/completions \\"
    echo "    -H 'Content-Type: application/json' \\"
    echo "    -d '{\"prompt\": \"Hello\", \"max_tokens\": 50}'"
    echo ""
    echo "📊 View Logs:"
    echo "  docker-compose -f docker-compose-fixed.yml logs -f [service]"
    echo ""
    echo "🛑 Stop Services:"
    echo "  docker-compose -f docker-compose-fixed.yml down"
    echo ""
else
    echo -e "${RED}⚠️  Some services are not healthy${NC}"
    echo ""
    echo "Check logs with:"
    echo "  docker-compose -f docker-compose-fixed.yml logs [service]"
    echo ""
    echo "Services status:"
    docker-compose -f docker-compose-fixed.yml ps
fi

echo "=========================================="

# Optional: Generate test traces
if [ "$WITH_APPS" = true ] && [ "$ALL_HEALTHY" = true ]; then
    echo ""
    read -p "Generate test traces? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Generating test traces..."
        
        # Test LLM Router
        for i in {1..5}; do
            curl -X POST http://localhost:8001/v1/completions \
                -H "Content-Type: application/json" \
                -H "traceparent: 00-$(openssl rand -hex 16)-$(openssl rand -hex 8)-01" \
                -d "{\"prompt\": \"Test prompt $i\", \"max_tokens\": 10}" \
                > /dev/null 2>&1 || true
            echo -n "."
        done
        
        # Test WebSocket health
        for i in {1..3}; do
            curl http://localhost:8080/health \
                -H "traceparent: 00-$(openssl rand -hex 16)-$(openssl rand -hex 8)-01" \
                > /dev/null 2>&1 || true
            echo -n "."
        done
        
        echo -e " ${GREEN}Done!${NC}"
        echo ""
        echo "Check traces in:"
        echo "  • Jaeger: http://localhost:16686/search"
        echo "  • Grafana: http://localhost:3000/explore"
    fi
fi