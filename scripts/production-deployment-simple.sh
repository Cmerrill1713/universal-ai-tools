#!/bin/bash

# Universal AI Tools Production Deployment Script
# Automated deployment with health checks

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="${PROJECT_ROOT}/logs/deployment.log"

# Logging function
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$LOG_FILE"
}

# Print colored output
print_status() {
    local color="$1"
    local message="$2"
    echo -e "${color}${message}${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Health check function
health_check() {
    local service="$1"
    local port="$2"
    local endpoint="$3"
    
    local url="http://localhost:${port}/${endpoint}"
    
    log "INFO" "🔍 Health checking $service at $url..."
    
    local retries=10
    local wait_time=2
    
    for ((i=1; i<=retries; i++)); do
        if curl -s -f "$url" >/dev/null 2>&1; then
            log "INFO" "✅ $service is healthy"
            return 0
        fi
        
        if [[ $i -eq $retries ]]; then
            log "ERROR" "❌ $service health check failed after $retries attempts"
            return 1
        fi
        
        log "INFO" "⏳ $service not ready, attempt $i/$retries (waiting ${wait_time}s...)"
        sleep $wait_time
    done
}

# Test all services
test_all_services() {
    log "INFO" "🧪 Running service health checks..."
    
    local failed_services=()
    
    # API Gateway
    if ! health_check "API Gateway" "8090" "api/health"; then
        failed_services+=("api-gateway")
    fi
    
    # WebSocket Service
    if ! health_check "WebSocket Service" "8080" "health"; then
        failed_services+=("websocket-service")
    fi
    
    # LLM Router
    if ! health_check "LLM Router" "8001" "health"; then
        failed_services+=("llm-router")
    fi
    
    # Vector DB
    if ! health_check "Qdrant Vector DB" "6333" "collections"; then
        failed_services+=("vector-db")
    fi
    
    # Prometheus
    if ! health_check "Prometheus" "9090" "-/healthy"; then
        failed_services+=("prometheus")
    fi
    
    # Grafana
    if ! health_check "Grafana" "3000" "api/health"; then
        failed_services+=("grafana")
    fi
    
    # Jaeger
    if ! health_check "Jaeger" "16686" "search"; then
        failed_services+=("jaeger")
    fi
    
    if [[ ${#failed_services[@]} -gt 0 ]]; then
        log "ERROR" "❌ Some services failed: ${failed_services[*]}"
        return 1
    else
        log "INFO" "✅ All services are healthy"
        return 0
    fi
}

# Run deployment tests
test_deployment() {
    log "INFO" "🧪 Running deployment tests..."
    
    # Test API Gateway
    local api_health=$(curl -s http://localhost:8090/api/health | jq -r '.status' 2>/dev/null || echo "failed")
    if [[ "$api_health" != "healthy" ]]; then
        log "ERROR" "❌ API Gateway test failed"
        return 1
    fi
    
    # Test authentication
    local auth_response=$(curl -s -X POST http://localhost:8090/api/v1/auth/demo-token \
        -H "Content-Type: application/json" \
        -d '{"name":"deployment-test","duration":"1h"}')
    
    local token=$(echo "$auth_response" | jq -r '.data.token // empty' 2>/dev/null)
    if [[ -z "$token" ]]; then
        log "ERROR" "❌ Authentication test failed"
        return 1
    fi
    
    log "INFO" "✅ Core deployment tests passed"
}

# Setup directories
setup_directories() {
    log "INFO" "📁 Setting up directories..."
    
    local dirs=(
        "${PROJECT_ROOT}/logs"
        "${PROJECT_ROOT}/data/postgresql"
        "${PROJECT_ROOT}/data/redis"
        "${PROJECT_ROOT}/data/qdrant"
    )
    
    for dir in "${dirs[@]}"; do
        mkdir -p "$dir"
        log "INFO" "Created directory: $dir"
    done
}

# Main deployment function
main() {
    local command="${1:-status}"
    
    print_status "$BLUE" "======================================"
    print_status "$BLUE" "🚀 Universal AI Tools Production Deploy"
    print_status "$BLUE" "======================================"
    
    case "$command" in
        "deploy")
            setup_directories
            if test_all_services && test_deployment; then
                print_status "$GREEN" "✅ Deployment successful!"
                log "INFO" "🎉 Production deployment completed successfully"
                
                # Show monitoring links
                log "INFO" "📊 Monitoring endpoints:"
                log "INFO" "API Gateway: http://localhost:8090/api/health"
                log "INFO" "WebSocket: ws://localhost:8080/ws"
                log "INFO" "Prometheus: http://localhost:9090"
                log "INFO" "Grafana: http://localhost:3000"
                log "INFO" "Jaeger: http://localhost:16686"
                log "INFO" "Qdrant: http://localhost:6333/dashboard"
            else
                print_status "$RED" "❌ Deployment failed!"
                exit 1
            fi
            ;;
            
        "status")
            log "INFO" "📊 Checking deployment status..."
            
            # Individual service checks
            health_check "API Gateway" "8090" "api/health" && print_status "$GREEN" "✅ API Gateway: healthy" || print_status "$RED" "❌ API Gateway: unhealthy"
            health_check "WebSocket Service" "8080" "health" && print_status "$GREEN" "✅ WebSocket Service: healthy" || print_status "$RED" "❌ WebSocket Service: unhealthy" 
            health_check "LLM Router" "8001" "health" && print_status "$GREEN" "✅ LLM Router: healthy" || print_status "$RED" "❌ LLM Router: unhealthy"
            health_check "Qdrant Vector DB" "6333" "collections" && print_status "$GREEN" "✅ Vector DB: healthy" || print_status "$RED" "❌ Vector DB: unhealthy"
            health_check "Prometheus" "9090" "-/healthy" && print_status "$GREEN" "✅ Prometheus: healthy" || print_status "$RED" "❌ Prometheus: unhealthy"
            health_check "Grafana" "3000" "api/health" && print_status "$GREEN" "✅ Grafana: healthy" || print_status "$RED" "❌ Grafana: unhealthy"
            health_check "Jaeger" "16686" "search" && print_status "$GREEN" "✅ Jaeger: healthy" || print_status "$RED" "❌ Jaeger: unhealthy"
            ;;
            
        "health")
            test_deployment
            ;;
            
        *)
            echo "Usage: $0 {deploy|status|health}"
            echo ""
            echo "Commands:"
            echo "  deploy - Deploy to production"
            echo "  status - Check service health status"
            echo "  health - Run health checks"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"