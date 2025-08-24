#!/bin/bash

# Universal AI Tools - Distributed Tracing Stack Deployment
# Deploys complete observability infrastructure with OpenTelemetry, Jaeger, and Grafana

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
STACK_NAME="universal-ai-tracing"
COMPOSE_FILE="docker-compose.yml"
NETWORK_NAME="tracing-network"

# Service endpoints
JAEGER_UI="http://localhost:16686"
GRAFANA_UI="http://localhost:3001"
PROMETHEUS_UI="http://localhost:9090"
TEMPO_UI="http://localhost:3200"

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Check if Docker and Docker Compose are installed
check_dependencies() {
    log "Checking dependencies..."
    
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        error "Docker Compose is not installed. Please install Docker Compose first."
    fi
    
    log "Dependencies check passed"
}

# Check available system resources
check_resources() {
    log "Checking system resources..."
    
    # Check available memory (require at least 4GB)
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        AVAILABLE_MEMORY=$(free -m | awk 'NR==2{printf "%.0f", $7}')
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        AVAILABLE_MEMORY=$(vm_stat | grep "Pages free:" | awk '{print int($3) * 4096 / 1024 / 1024}')
    else
        warn "Cannot check memory on this OS, proceeding anyway"
        return 0
    fi
    
    if [ "$AVAILABLE_MEMORY" -lt 2048 ]; then
        warn "Low available memory: ${AVAILABLE_MEMORY}MB. Recommended: 4GB+"
        warn "The tracing stack may not perform optimally"
    else
        log "Memory check passed: ${AVAILABLE_MEMORY}MB available"
    fi
    
    # Check disk space (require at least 5GB)
    AVAILABLE_DISK=$(df -h . | awk 'NR==2 {print $4}' | sed 's/G//')
    if [ "${AVAILABLE_DISK%.*}" -lt 5 ]; then
        warn "Low available disk space: ${AVAILABLE_DISK}GB. Recommended: 10GB+"
    else
        log "Disk space check passed: ${AVAILABLE_DISK}GB available"
    fi
}

# Create necessary directories
setup_directories() {
    log "Setting up directories..."
    
    # Create data directories if they don't exist
    mkdir -p {grafana/dashboards,grafana/provisioning/{datasources,dashboards}}
    
    log "Directories created successfully"
}

# Deploy the tracing stack
deploy_stack() {
    log "Deploying distributed tracing stack..."
    
    # Pull latest images
    info "Pulling latest container images..."
    docker-compose pull
    
    # Build custom services
    info "Building custom services..."
    docker-compose build
    
    # Start the stack
    info "Starting services..."
    docker-compose up -d
    
    log "Distributed tracing stack deployed successfully"
}

# Wait for services to be healthy
wait_for_services() {
    log "Waiting for services to become healthy..."
    
    services=(
        "jaeger:16686"
        "prometheus-tracing:9090"
        "grafana-tracing:3001"
        "tempo:3200"
        "otel-collector:13133"
        "redis-cluster:6379"
    )
    
    max_attempts=30
    attempt=1
    
    for service_port in "${services[@]}"; do
        service_name=${service_port%:*}
        port=${service_port#*:}
        
        info "Checking $service_name on port $port..."
        
        while [ $attempt -le $max_attempts ]; do
            if curl -s -f "http://localhost:$port" > /dev/null 2>&1 || \
               curl -s -f "http://localhost:$port/health" > /dev/null 2>&1 || \
               curl -s -f "http://localhost:$port/-/healthy" > /dev/null 2>&1; then
                log "$service_name is healthy"
                break
            fi
            
            if [ $attempt -eq $max_attempts ]; then
                warn "$service_name is not responding after $max_attempts attempts"
                break
            fi
            
            sleep 5
            ((attempt++))
        done
        
        attempt=1
    done
    
    log "Service health checks completed"
}

# Test the tracing system
test_tracing() {
    log "Testing distributed tracing system..."
    
    # Test OpenTelemetry Collector
    info "Testing OpenTelemetry Collector..."
    if curl -s -f "http://localhost:13133/" > /dev/null; then
        log "✓ OpenTelemetry Collector is responding"
    else
        warn "✗ OpenTelemetry Collector is not responding"
    fi
    
    # Test Jaeger UI
    info "Testing Jaeger UI..."
    if curl -s -f "$JAEGER_UI" > /dev/null; then
        log "✓ Jaeger UI is accessible"
    else
        warn "✗ Jaeger UI is not accessible"
    fi
    
    # Test Prometheus
    info "Testing Prometheus..."
    if curl -s -f "$PROMETHEUS_UI/-/healthy" > /dev/null; then
        log "✓ Prometheus is healthy"
    else
        warn "✗ Prometheus is not healthy"
    fi
    
    # Test Grafana
    info "Testing Grafana..."
    if curl -s -f "$GRAFANA_UI/api/health" > /dev/null; then
        log "✓ Grafana is healthy"
    else
        warn "✗ Grafana is not healthy"
    fi
    
    # Test Tempo
    info "Testing Tempo..."
    if curl -s -f "$TEMPO_UI/ready" > /dev/null; then
        log "✓ Tempo is ready"
    else
        warn "✗ Tempo is not ready"
    fi
}

# Show service status
show_status() {
    log "Service Status:"
    echo ""
    docker-compose ps
    echo ""
    
    log "Access URLs:"
    echo "🔍 Jaeger UI (Distributed Tracing): $JAEGER_UI"
    echo "📊 Grafana (Dashboards): $GRAFANA_UI (admin/tracing123)"
    echo "📈 Prometheus (Metrics): $PROMETHEUS_UI"
    echo "🕒 Tempo (Traces): $TEMPO_UI"
    echo "📡 OpenTelemetry Collector: http://localhost:13133"
    echo ""
    
    log "Service Endpoints:"
    echo "🦀 Rust LLM Router: http://localhost:8001 (Metrics: http://localhost:9001)"
    echo "🐹 Go WebSocket Service: http://localhost:8080 (Metrics: http://localhost:9003)"
    echo "🔴 Redis Cluster: localhost:6379"
    echo ""
}

# Generate sample traces
generate_sample_traces() {
    log "Generating sample traces..."
    
    # Wait for services to be fully ready
    sleep 10
    
    # Test LLM Router health endpoint
    info "Testing LLM Router..."
    if curl -s -f "http://localhost:8001/health" > /dev/null; then
        log "✓ LLM Router is responding"
        
        # Generate some test requests
        info "Generating sample LLM requests..."
        for i in {1..5}; do
            curl -s -X POST "http://localhost:8001/v1/completions" \
                -H "Content-Type: application/json" \
                -H "x-request-id: test-$i" \
                -d "{
                    \"model\": \"llama3.2:3b\",
                    \"prompt\": \"Hello, this is test request $i\",
                    \"max_tokens\": 50,
                    \"temperature\": 0.7
                }" > /dev/null || true
            sleep 1
        done
    else
        warn "LLM Router not available for testing"
    fi
    
    # Test WebSocket service
    info "Testing WebSocket service..."
    if curl -s -f "http://localhost:8080/health" > /dev/null; then
        log "✓ WebSocket service is responding"
        
        # Test broadcast endpoint
        info "Generating sample broadcast messages..."
        for i in {1..3}; do
            curl -s -X POST "http://localhost:8080/broadcast" \
                -H "Content-Type: application/json" \
                -d "{
                    \"type\": \"broadcast\",
                    \"content\": \"Test broadcast message $i\",
                    \"from\": \"test-client\"
                }" > /dev/null || true
            sleep 1
        done
    else
        warn "WebSocket service not available for testing"
    fi
    
    log "Sample traces generated successfully"
    info "Check Jaeger UI at $JAEGER_UI to view traces"
}

# Cleanup function
cleanup() {
    log "Cleaning up..."
    docker-compose down
    log "Cleanup completed"
}

# Show help
show_help() {
    echo "Universal AI Tools - Distributed Tracing Stack Deployment"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  deploy     Deploy the complete tracing stack"
    echo "  test       Test the deployed services"
    echo "  status     Show service status and URLs"
    echo "  logs       Show service logs"
    echo "  traces     Generate sample traces"
    echo "  stop       Stop all services"
    echo "  restart    Restart all services"
    echo "  cleanup    Stop and remove all services"
    echo "  help       Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 deploy     # Deploy the full stack"
    echo "  $0 test       # Test services after deployment"
    echo "  $0 traces     # Generate sample traces"
    echo "  $0 status     # Check service status"
}

# Main execution
main() {
    case "${1:-deploy}" in
        "deploy")
            check_dependencies
            check_resources
            setup_directories
            deploy_stack
            wait_for_services
            test_tracing
            show_status
            generate_sample_traces
            log "🎉 Distributed tracing stack deployment completed successfully!"
            info "Access Jaeger UI at $JAEGER_UI to explore traces"
            ;;
        "test")
            test_tracing
            ;;
        "status")
            show_status
            ;;
        "logs")
            docker-compose logs -f "${2:-}"
            ;;
        "traces")
            generate_sample_traces
            ;;
        "stop")
            log "Stopping services..."
            docker-compose stop
            log "Services stopped"
            ;;
        "restart")
            log "Restarting services..."
            docker-compose restart
            wait_for_services
            log "Services restarted"
            ;;
        "cleanup")
            cleanup
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            error "Unknown command: $1. Use 'help' to see available commands."
            ;;
    esac
}

# Handle script interruption
trap 'error "Script interrupted"' INT TERM

# Change to script directory
cd "$(dirname "$0")"

# Run main function
main "$@"