#!/bin/bash
# Universal AI Tools - Distributed Tracing Infrastructure Startup Script
# Starts the complete observability stack for Go/Rust microservices

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting Universal AI Tools Distributed Tracing Infrastructure..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if service is healthy
check_service_health() {
    local service_name=$1
    local health_url=$2
    local max_attempts=30
    local attempt=1

    echo -e "${BLUE}⏳ Waiting for $service_name to be healthy...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$health_url" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ $service_name is healthy${NC}"
            return 0
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}❌ $service_name failed to become healthy after $max_attempts attempts${NC}"
    return 1
}

# Create necessary directories
echo -e "${BLUE}📁 Creating required directories...${NC}"
mkdir -p ./traces
mkdir -p ./grafana/dashboards

# Check if Docker Compose file exists
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}❌ docker-compose.yml not found in current directory${NC}"
    exit 1
fi

# Stop any existing containers
echo -e "${YELLOW}🛑 Stopping existing tracing infrastructure...${NC}"
docker-compose down --remove-orphans

# Pull latest images
echo -e "${BLUE}📦 Pulling latest Docker images...${NC}"
docker-compose pull

# Start core tracing infrastructure
echo -e "${GREEN}🔧 Starting core tracing infrastructure...${NC}"
docker-compose up -d otel-collector jaeger tempo prometheus-tracing

# Wait for core services to be healthy
check_service_health "OpenTelemetry Collector" "http://localhost:13133/"
check_service_health "Jaeger" "http://localhost:16686/"
check_service_health "Tempo" "http://localhost:3200/ready"
check_service_health "Prometheus" "http://localhost:9090/-/healthy"

# Start Grafana
echo -e "${GREEN}📊 Starting Grafana...${NC}"
docker-compose up -d grafana-tracing

# Wait for Grafana
check_service_health "Grafana" "http://localhost:3001/api/health"

# Start supporting services
echo -e "${GREEN}🔧 Starting supporting services...${NC}"
docker-compose up -d redis-cluster redis-exporter node-exporter alertmanager

# Check Redis connection
if docker-compose exec -T redis-cluster redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Redis cluster is healthy${NC}"
else
    echo -e "${YELLOW}⚠️  Redis cluster may not be fully ready${NC}"
fi

# Start application services (if enabled)
if [ "${START_APPS:-false}" = "true" ]; then
    echo -e "${GREEN}🚀 Starting application services...${NC}"
    docker-compose up -d llm-router websocket-service
    
    check_service_health "LLM Router" "http://localhost:8001/health"
    check_service_health "WebSocket Service" "http://localhost:8080/health"
fi

echo ""
echo -e "${GREEN}🎉 Distributed Tracing Infrastructure Started Successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Access URLs:${NC}"
echo -e "  🔍 Jaeger UI:           http://localhost:16686"
echo -e "  📊 Grafana:             http://localhost:3001 (admin/tracing123)"
echo -e "  📈 Prometheus:          http://localhost:9090"
echo -e "  🔄 Tempo:               http://localhost:3200"
echo -e "  📡 OTEL Collector:      http://localhost:13133"
echo -e "  🚨 Alertmanager:        http://localhost:9093"
echo ""
echo -e "${BLUE}🔌 Tracing Endpoints:${NC}"
echo -e "  📤 OTLP gRPC:          localhost:4317"
echo -e "  📤 OTLP HTTP:          localhost:4318"
echo -e "  📤 Jaeger gRPC:        localhost:14250"
echo -e "  📤 Jaeger HTTP:        localhost:14268"
echo -e "  📤 Zipkin:             localhost:9411"
echo ""
echo -e "${YELLOW}💡 Tips:${NC}"
echo -e "  • To stop:             docker-compose down"
echo -e "  • To view logs:        docker-compose logs -f [service]"
echo -e "  • To restart:          ./start-tracing.sh"
echo -e "  • With apps:           START_APPS=true ./start-tracing.sh"
echo ""

# Show container status
echo -e "${BLUE}🐳 Container Status:${NC}"
docker-compose ps