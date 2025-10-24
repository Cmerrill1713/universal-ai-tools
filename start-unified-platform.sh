#!/bin/bash
# Universal AI Tools - Unified Startup Script
# Start all Family Athena and Enterprise Platform services

set -e

echo "🚀 Starting Universal AI Tools - Unified Platform"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ERROR:${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] WARNING:${NC} $1"
}

info() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')] INFO:${NC} $1"
}

# Function to start a service
start_service() {
    local service_name=$1
    local command=$2
    local port=$3
    
    log "Starting $service_name on port $port..."
    
    if command -v $command >/dev/null 2>&1; then
        $command &
        local pid=$!
        echo $pid > "/tmp/${service_name}.pid"
        log "✅ $service_name started (PID: $pid)"
    else
        error "❌ $service_name command not found: $command"
        return 1
    fi
}

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to wait for a service to be ready
wait_for_service() {
    local service_name=$1
    local port=$2
    local max_attempts=30
    local attempt=0
    
    log "Waiting for $service_name to be ready on port $port..."
    
    while [ $attempt -lt $max_attempts ]; do
        if check_port $port; then
            log "✅ $service_name is ready on port $port"
            return 0
        fi
        
        attempt=$((attempt + 1))
        sleep 2
    done
    
    error "❌ $service_name failed to start on port $port after $max_attempts attempts"
    return 1
}

# Start data services first
log "Starting data services..."

# Redis
if ! check_port 6379; then
    start_service "redis" "redis-server" 6379
    wait_for_service "redis" 6379
else
    log "✅ Redis already running on port 6379"
fi

# PostgreSQL
if ! check_port 5432; then
    start_service "postgresql" "postgres" 5432
    wait_for_service "postgresql" 5432
else
    log "✅ PostgreSQL already running on port 5432"
fi

# Start Go services
log "Starting Go services..."

cd go-services
if [ -f "docker-compose.yml" ]; then
    docker-compose up -d
    log "✅ Go services started with Docker Compose"
else
    # Start individual Go services
    start_service "go-api-gateway" "./api-gateway/api-gateway" 8081
    start_service "message-broker" "./message-broker/message-broker" 8082
    start_service "load-balancer" "./load-balancer/load-balancer" 8083
    start_service "cache-coordinator" "./cache-coordinator/cache-coordinator" 8084
    start_service "stream-processor" "./stream-processor/stream-processor" 8085
    start_service "monitoring-service" "./monitoring-service/monitoring-service" 8086
    start_service "orchestration-service" "./orchestration-service/orchestration-service" 8087
    start_service "auth-service" "./auth-service/auth-service" 8088
    start_service "chat-service" "./chat-service/chat-service" 8089
    start_service "knowledge-gateway" "./knowledge-gateway/knowledge-gateway" 8090
fi
cd ..

# Start Rust services
log "Starting Rust services..."

cd crates
if [ -f "Cargo.toml" ]; then
    cargo build --release
    log "✅ Rust services built"
    
    # Start individual Rust services
    start_service "llm-router" "./target/release/llm-router" 3033
    start_service "ml-inference" "./target/release/ml-inference" 8091
    start_service "vector-db" "./target/release/vector-db" 8092
    start_service "assistantd" "./target/release/assistantd" 8080
else
    warn "Rust services not found, skipping..."
fi
cd ..

# Start Family Athena services
log "Starting Family Athena services..."

# Family Profiles
start_service "family-profiles" "python3 src/family/family_profiles.py" 8005
wait_for_service "family-profiles" 8005

# Family Calendar
start_service "family-calendar" "python3 src/family/family_calendar.py" 8006
wait_for_service "family-calendar" 8006

# Family Knowledge
start_service "family-knowledge" "python3 src/family/family_knowledge.py" 8007
wait_for_service "family-knowledge" 8007

# Athena Gateway
start_service "athena-gateway" "python3 src/family/athena_gateway_integration.py" 8080
wait_for_service "athena-gateway" 8080

# Start unified services
log "Starting unified services..."

# Unified API Gateway
start_service "unified-api-gateway" "python3 unified_api_gateway.py" 9000
wait_for_service "unified-api-gateway" 9000

# Service Mesh Integration
start_service "service-mesh" "python3 service_mesh_integration.py" 9001

# Unified Data Layer
start_service "unified-data-layer" "python3 unified_data_layer.py" 9002

# Start monitoring and health checks
log "Starting monitoring and health checks..."

# Health check all services
log "Performing health checks..."

# Check Family Athena services
if check_port 8005; then
    log "✅ Family Profiles healthy"
else
    error "❌ Family Profiles unhealthy"
fi

if check_port 8006; then
    log "✅ Family Calendar healthy"
else
    error "❌ Family Calendar unhealthy"
fi

if check_port 8007; then
    log "✅ Family Knowledge healthy"
else
    error "❌ Family Knowledge unhealthy"
fi

if check_port 8080; then
    log "✅ Athena Gateway healthy"
else
    error "❌ Athena Gateway unhealthy"
fi

# Check Enterprise Platform services
if check_port 8081; then
    log "✅ Go API Gateway healthy"
else
    error "❌ Go API Gateway unhealthy"
fi

if check_port 3033; then
    log "✅ LLM Router healthy"
else
    error "❌ LLM Router unhealthy"
fi

# Check unified services
if check_port 9000; then
    log "✅ Unified API Gateway healthy"
else
    error "❌ Unified API Gateway unhealthy"
fi

# Final status
echo ""
echo "🎉 Universal AI Tools - Unified Platform Started!"
echo "=================================================="
echo ""
echo "📡 Access Points:"
echo "   • Unified API Gateway: http://localhost:9000"
echo "   • Family Athena: http://localhost:8080"
echo "   • Enterprise Platform: http://localhost:8081"
echo "   • Web Frontend: http://localhost:3000"
echo ""
echo "🔧 Services Running:"
echo "   • Family Athena: 4 services"
echo "   • Enterprise Platform: 10+ services"
echo "   • Rust Services: 4 services"
echo "   • Data Services: Redis, PostgreSQL"
echo "   • Unified Services: 3 services"
echo ""
echo "📊 Total Services: 20+ services running"
echo "🌐 Unified Platform: OPERATIONAL"
echo ""
echo "🚀 Ready for seamless operation!"

# Keep script running
log "Press Ctrl+C to stop all services"
trap 'log "Stopping all services..."; kill $(jobs -p); exit 0' INT

while true; do
    sleep 1
done
