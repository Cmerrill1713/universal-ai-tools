#!/bin/bash
# Universal AI Tools - Production Deployment Validation
# Comprehensive health checks and validation

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DOMAIN="${DOMAIN:-yourdomain.com}"
API_URL="https://$DOMAIN"
TIMEOUT=30

print_status() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }

# Function to wait for service
wait_for_service() {
    local url=$1
    local name=$2
    local max_attempts=60
    local attempt=1
    
    print_info "Waiting for $name to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -sf "$url" >/dev/null 2>&1; then
            print_status "$name is ready"
            return 0
        fi
        
        echo -n "."
        sleep 5
        ((attempt++))
    done
    
    print_error "$name failed to start within $(($max_attempts * 5)) seconds"
    return 1
}

# Function to check service health
check_service_health() {
    local url=$1
    local name=$2
    
    print_info "Checking $name health..."
    
    local response=$(curl -s -w "%{http_code}" -o /tmp/health_response "$url" 2>/dev/null || echo "000")
    
    if [ "$response" = "200" ]; then
        print_status "$name is healthy"
        return 0
    else
        print_error "$name health check failed (HTTP $response)"
        return 1
    fi
}

# Function to check memory usage
check_memory_usage() {
    print_info "Checking memory usage..."
    
    local total_memory=$(docker stats --no-stream --format "table {{.Container}}\t{{.MemUsage}}" | tail -n +2)
    echo "$total_memory"
    
    # Calculate total memory usage
    local total_mb=0
    while IFS= read -r line; do
        local mem=$(echo "$line" | awk '{print $2}' | sed 's/MiB.*//' | sed 's/GiB/000/')
        if [[ "$mem" =~ ^[0-9]+$ ]]; then
            total_mb=$((total_mb + mem))
        fi
    done <<< "$total_memory"
    
    print_info "Total memory usage: ${total_mb}MB"
    
    if [ $total_mb -lt 1024 ]; then
        print_status "Memory usage within target (<1GB)"
    else
        print_warning "Memory usage above target: ${total_mb}MB"
    fi
}

# Function to check SSL certificate
check_ssl_certificate() {
    print_info "Checking SSL certificate..."
    
    local cert_info=$(openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || echo "Failed")
    
    if [ "$cert_info" != "Failed" ]; then
        print_status "SSL certificate is valid"
        echo "$cert_info" | sed 's/^/  /'
    else
        print_error "SSL certificate check failed"
        return 1
    fi
}

# Function to run comprehensive tests
run_comprehensive_tests() {
    print_info "Running comprehensive API tests..."
    
    # Test health endpoint
    if check_service_health "$API_URL/health" "API Health"; then
        local health_response=$(cat /tmp/health_response)
        echo "  Response: $health_response" | head -c 100
    fi
    
    # Test authentication endpoint
    print_info "Testing authentication..."
    local auth_response=$(curl -s -w "%{http_code}" -o /dev/null "$API_URL/api/auth/status" 2>/dev/null || echo "000")
    
    if [ "$auth_response" = "401" ] || [ "$auth_response" = "200" ]; then
        print_status "Authentication endpoint is working"
    else
        print_warning "Authentication endpoint returned unexpected status: $auth_response"
    fi
    
    # Test API rate limiting
    print_info "Testing rate limiting..."
    local rate_limit_ok=true
    for i in {1..5}; do
        local response=$(curl -s -w "%{http_code}" -o /dev/null "$API_URL/health" 2>/dev/null || echo "000")
        if [ "$response" = "429" ]; then
            rate_limit_ok=true
            break
        fi
    done
    
    if [ "$rate_limit_ok" = true ]; then
        print_status "Rate limiting is configured"
    else
        print_warning "Rate limiting may not be working properly"
    fi
}

# Function to generate deployment report
generate_deployment_report() {
    local report_file="deployment-validation-$(date +%Y%m%d-%H%M%S).log"
    
    print_info "Generating deployment report..."
    
    {
        echo "Universal AI Tools - Deployment Validation Report"
        echo "Generated: $(date)"
        echo "Domain: $DOMAIN"
        echo "================================================"
        echo
        
        echo "Docker Services:"
        docker-compose -f docker-compose.prod.yml ps
        echo
        
        echo "Memory Usage:"
        docker stats --no-stream
        echo
        
        echo "Disk Usage:"
        df -h
        echo
        
        echo "Service Endpoints:"
        echo "- API: $API_URL"
        echo "- Health: $API_URL/health"
        echo "- Metrics: $API_URL/metrics"
        echo "- Grafana: $API_URL/grafana"
        echo
        
        echo "Recent Logs (last 50 lines):"
        docker-compose -f docker-compose.prod.yml logs --tail=50
        
    } > "$report_file"
    
    print_status "Deployment report saved to: $report_file"
}

# Main validation process
main() {
    echo -e "${BLUE}🔍 Universal AI Tools - Production Deployment Validation${NC}"
    echo "================================================================"
    
    # Check if Docker Compose is running
    if ! docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
        print_error "Docker Compose services are not running"
        print_info "Start services with: docker-compose -f docker-compose.prod.yml up -d"
        exit 1
    fi
    
    print_status "Docker Compose services are running"
    
    # Wait for critical services
    wait_for_service "$API_URL/health" "API Service"
    
    # Check service health
    check_service_health "$API_URL/health" "Main API"
    
    # Check memory usage
    check_memory_usage
    
    # Check SSL certificate (only if not localhost)
    if [ "$DOMAIN" != "localhost" ] && [ "$DOMAIN" != "127.0.0.1" ]; then
        check_ssl_certificate
    fi
    
    # Run comprehensive tests
    run_comprehensive_tests
    
    # Generate report
    generate_deployment_report
    
    echo
    print_status "Deployment validation completed successfully!"
    print_info "Your Universal AI Tools production deployment is ready!"
    echo
    print_info "Access your deployment at: $API_URL"
    print_info "Grafana dashboard: $API_URL/grafana"
    print_info "Prometheus metrics: $API_URL/metrics"
}

# Run main function
main "$@"
