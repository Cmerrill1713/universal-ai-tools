#!/bin/bash

# Universal AI Tools - Unified Frontend + Backend Deployment Script
# This script packages and deploys the complete application stack

set -e

echo "🚀 UNIVERSAL AI TOOLS - UNIFIED DEPLOYMENT"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
check_docker() {
    print_status "Checking Docker availability..."
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    print_success "Docker is running"
}

# Check if required files exist
check_requirements() {
    print_status "Checking requirements..."
    
    required_files=(
        "docker-compose.unified.yml"
        "go-services/knowledge-gateway/main.go"
        "go-services/knowledge-sync/main.go"
        "go-services/knowledge-context/main.go"
    )
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            print_error "Required file missing: $file"
            exit 1
        fi
    done
    
    print_success "All required files present"
}

# Stop existing services
stop_existing() {
    print_status "Stopping existing services..."
    
    # Stop unified services
    docker-compose -f docker-compose.unified.yml down 2>/dev/null || true
    
    # Stop grounding services (if running)
    docker-compose -f docker-compose.grounding.yml down 2>/dev/null || true
    
    print_success "Existing services stopped"
}

# Build all services
build_services() {
    print_status "Building all services..."
    
    # Build Go services first (faster)
    print_status "Building Go knowledge services..."
    docker-compose -f docker-compose.unified.yml build knowledge-gateway knowledge-sync knowledge-context
    
    # Build frontend (if Dockerfile exists)
    if [[ -f "UniversalAIToolsApp/Dockerfile" ]]; then
        print_status "Building frontend..."
        docker-compose -f docker-compose.unified.yml build universal-ai-frontend || print_warning "Frontend build skipped"
    else
        print_warning "Frontend Dockerfile not found, skipping frontend build"
    fi
    
    # Build monitoring services
    print_status "Building monitoring services..."
    docker-compose -f docker-compose.unified.yml build ai-metrics-exporter || print_warning "AI metrics exporter build skipped"
    
    print_success "All services built successfully"
}

# Start the unified stack
start_services() {
    print_status "Starting unified application stack..."
    
    # Start infrastructure first
    print_status "Starting infrastructure services..."
    docker-compose -f docker-compose.unified.yml up -d redis weaviate
    
    # Wait for infrastructure
    print_status "Waiting for infrastructure to be ready..."
    sleep 10
    
    # Start knowledge services
    print_status "Starting knowledge services..."
    docker-compose -f docker-compose.unified.yml up -d knowledge-gateway knowledge-sync knowledge-context
    
    # Wait for knowledge services
    print_status "Waiting for knowledge services..."
    sleep 15
    
    # Start monitoring
    print_status "Starting monitoring services..."
    docker-compose -f docker-compose.unified.yml up -d prometheus ai-metrics-exporter grafana
    
    # Start frontend (if configured)
    if docker-compose -f docker-compose.unified.yml config --services | grep -q "universal-ai-frontend"; then
        print_status "Starting frontend..."
        docker-compose -f docker-compose.unified.yml up -d universal-ai-frontend || print_warning "Frontend start skipped"
    else
        print_warning "Frontend service not configured"
    fi
    
    print_success "All services started"
}

# Wait for services to be healthy
wait_for_health() {
    print_status "Waiting for services to be healthy..."
    
    services=(
        "universal-ai-frontend:8080"
        "knowledge-gateway:8088"
        "knowledge-sync:8089"
        "knowledge-context:8091"
        "grafana:3000"
        "prometheus:9090"
    )
    
    for service in "${services[@]}"; do
        name=$(echo $service | cut -d: -f1)
        port=$(echo $service | cut -d: -f2)
        
        print_status "Waiting for $name on port $port..."
        
        max_attempts=30
        attempt=0
        
        while [ $attempt -lt $max_attempts ]; do
            if curl -f "http://localhost:$port/health" > /dev/null 2>&1 || \
               curl -f "http://localhost:$port" > /dev/null 2>&1; then
                print_success "$name is healthy"
                break
            fi
            
            attempt=$((attempt + 1))
            sleep 2
        done
        
        if [ $attempt -eq $max_attempts ]; then
            print_warning "$name may not be fully ready yet"
        fi
    done
}

# Show service status
show_status() {
    print_status "Service Status:"
    echo ""
    
    echo "🐳 Docker Containers:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(universal|knowledge|grafana|prometheus|redis|weaviate)"
    
    echo ""
    echo "🌐 Service Endpoints:"
    echo "  Frontend:           http://localhost:8080"
    echo "  Knowledge Gateway:  http://localhost:8088"
    echo "  Knowledge Sync:     http://localhost:8089"
    echo "  Knowledge Context:  http://localhost:8091"
    echo "  Grafana Dashboard:  http://localhost:3000"
    echo "  Prometheus:         http://localhost:9090"
    echo "  Weaviate:           http://localhost:8090"
    echo "  Redis:              localhost:6379"
    
    echo ""
    echo "📊 Quick Health Check:"
    
    # Check frontend
    if curl -f http://localhost:8080/health > /dev/null 2>&1; then
        echo "  ✅ Frontend: Healthy"
    else
        echo "  ❌ Frontend: Not responding"
    fi
    
    # Check knowledge services
    for port in 8088 8089 8091; do
        if curl -f "http://localhost:$port/health" > /dev/null 2>&1; then
            echo "  ✅ Knowledge Service (port $port): Healthy"
        else
            echo "  ❌ Knowledge Service (port $port): Not responding"
        fi
    done
    
    # Check monitoring
    if curl -f http://localhost:3000 > /dev/null 2>&1; then
        echo "  ✅ Grafana: Healthy"
    else
        echo "  ❌ Grafana: Not responding"
    fi
    
    if curl -f http://localhost:9090 > /dev/null 2>&1; then
        echo "  ✅ Prometheus: Healthy"
    else
        echo "  ❌ Prometheus: Not responding"
    fi
}

# Test the unified application
test_application() {
    print_status "Testing unified application..."
    
    # Test knowledge services
    echo "Testing Knowledge Gateway..."
    curl -s -X POST http://localhost:8088/search \
        -H "Content-Type: application/json" \
        -d '{"query":"test unified deployment","limit":3}' | jq .
    
    echo ""
    echo "Testing Knowledge Context..."
    curl -s -X POST http://localhost:8091/context \
        -H "Content-Type: application/json" \
        -d '{"session_id":"unified-test","message":"Testing unified deployment","user_id":"deploy-user"}' | jq .
    
    echo ""
    echo "Testing Knowledge Sync..."
    curl -s -X POST http://localhost:8089/sync \
        -H "Content-Type: application/json" \
        -d '{"source":"test","target":"unified","batch_size":10}' | jq .
    
    print_success "Application tests completed"
}

# Main deployment function
main() {
    echo "Starting Universal AI Tools Unified Deployment..."
    echo ""
    
    check_docker
    check_requirements
    stop_existing
    build_services
    start_services
    wait_for_health
    
    echo ""
    print_success "🎉 UNIVERSAL AI TOOLS UNIFIED DEPLOYMENT COMPLETE!"
    echo ""
    
    show_status
    
    echo ""
    print_status "Testing application functionality..."
    test_application
    
    echo ""
    echo "🚀 Your Universal AI Tools application is now running!"
    echo "   Access the frontend at: http://localhost:8080"
    echo "   Monitor with Grafana at: http://localhost:3000"
    echo ""
    echo "To stop all services: docker-compose -f docker-compose.unified.yml down"
    echo "To view logs: docker-compose -f docker-compose.unified.yml logs -f"
}

# Run main function
main "$@"
