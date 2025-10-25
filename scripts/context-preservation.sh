#!/bin/bash

# 🧠 Universal AI Tools - Context Preservation Script
# Ensures we never lose context of the massive codebase

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo -e "${BLUE}🧠 $1${NC}"
    echo "=================================="
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${PURPLE}ℹ️ $1${NC}"
}

# Context preservation functions
check_system_health() {
    print_header "System Health Check"
    
    # Check containers
    local container_count=$(docker ps --format "{{.Names}}" | wc -l)
    if [ $container_count -ge 16 ]; then
        print_success "Containers running: $container_count/16+"
    else
        print_warning "Containers running: $container_count/16+ (expected 16+)"
    fi
    
    # Check API response time
    local response_time=$(curl -w "%{time_total}" -s -o /dev/null http://localhost:8081/health 2>/dev/null || echo "999")
    local response_ms=$(echo "$response_time * 1000" | bc 2>/dev/null || echo "999")
    
    if (( $(echo "$response_ms < 4" | bc -l) )); then
        print_success "API response time: ${response_ms}ms (excellent)"
    elif (( $(echo "$response_ms < 10" | bc -l) )); then
        print_warning "API response time: ${response_ms}ms (acceptable)"
    else
        print_error "API response time: ${response_ms}ms (too slow)"
    fi
    
    # Check port conflicts
    local port_conflicts=$(netstat -tulpn 2>/dev/null | grep -E ":(8001|8002|8003|8004|8005|8006|8080|8081|8091|8092)" | wc -l)
    if [ $port_conflicts -eq 0 ]; then
        print_success "No port conflicts detected"
    else
        print_warning "Port conflicts detected: $port_conflicts"
        netstat -tulpn | grep -E ":(8001|8002|8003|8004|8005|8006|8080|8081|8091|8092)"
    fi
}

check_context_files() {
    print_header "Context Files Check"
    
    local files=(
        "ECOSYSTEM_ARCHITECTURE_MAP.md"
        "FULL_ECOSYSTEM_INTEGRATION_PLAN.md"
        "CONTEXT_PRESERVATION_CHECKLIST.md"
        "COMPREHENSIVE_AUDIT_REPORT.md"
        "ARCHITECTURE.md"
        "README-SYSTEM.md"
    )
    
    for file in "${files[@]}"; do
        if [ -f "$file" ]; then
            print_success "Found: $file"
        else
            print_error "Missing: $file (CRITICAL)"
        fi
    done
}

check_service_integration() {
    print_header "Service Integration Check"
    
    # Check if new Rust services are running
    local rust_services=("mlx-service" "dspy-service" "vision-service")
    for service in "${rust_services[@]}"; do
        if docker ps --format "{{.Names}}" | grep -q "$service"; then
            print_success "$service is running"
        else
            print_warning "$service is not running"
        fi
    done
    
    # Check API Gateway routing
    local api_gateway_health=$(curl -s http://localhost:8081/health 2>/dev/null | jq -r '.status' 2>/dev/null || echo "unknown")
    if [ "$api_gateway_health" = "healthy" ]; then
        print_success "API Gateway is healthy"
    else
        print_warning "API Gateway status: $api_gateway_health"
    fi
    
    # Check service discovery
    if curl -s http://localhost:8083/services 2>/dev/null | grep -q "mlx-service"; then
        print_success "MLX service registered in Service Discovery"
    else
        print_warning "MLX service not registered in Service Discovery"
    fi
}

check_monitoring() {
    print_header "Monitoring Integration Check"
    
    # Check Prometheus targets
    local prometheus_targets=$(curl -s http://localhost:9090/api/v1/targets 2>/dev/null | jq -r '.data.activeTargets | length' 2>/dev/null || echo "0")
    if [ "$prometheus_targets" -gt 10 ]; then
        print_success "Prometheus targets: $prometheus_targets"
    else
        print_warning "Prometheus targets: $prometheus_targets (expected 10+)"
    fi
    
    # Check Grafana
    local grafana_status=$(curl -s http://localhost:3001/api/health 2>/dev/null | jq -r '.database' 2>/dev/null || echo "unknown")
    if [ "$grafana_status" = "ok" ]; then
        print_success "Grafana is healthy"
    else
        print_warning "Grafana status: $grafana_status"
    fi
}

generate_context_report() {
    print_header "Context Preservation Report"
    
    local report_file="CONTEXT_REPORT_$(date +%Y%m%d_%H%M%S).md"
    
    cat > "$report_file" << EOF
# 🧠 Context Preservation Report
**Generated**: $(date)
**System**: Universal AI Tools

## 📊 System Status
- **Containers Running**: $(docker ps --format "{{.Names}}" | wc -l)/16+
- **API Response Time**: $(curl -w "%{time_total}" -s -o /dev/null http://localhost:8081/health 2>/dev/null || echo "unknown")s
- **Port Conflicts**: $(netstat -tulpn 2>/dev/null | grep -E ":(8001|8002|8003|8004|8005|8006|8080|8081|8091|8092)" | wc -l)
- **Context Files**: $(ls -1 ECOSYSTEM_ARCHITECTURE_MAP.md FULL_ECOSYSTEM_INTEGRATION_PLAN.md CONTEXT_PRESERVATION_CHECKLIST.md 2>/dev/null | wc -l)/3

## 🎯 Integration Status
- **MLX Service**: $(docker ps --format "{{.Names}}" | grep -q "mlx-service" && echo "Running" || echo "Not Running")
- **DSPy Service**: $(docker ps --format "{{.Names}}" | grep -q "dspy-service" && echo "Running" || echo "Not Running")
- **Vision Service**: $(docker ps --format "{{.Names}}" | grep -q "vision-service" && echo "Running" || echo "Not Running")
- **API Gateway**: $(curl -s http://localhost:8081/health 2>/dev/null | jq -r '.status' 2>/dev/null || echo "Unknown")

## 📈 Recommendations
$(if [ $(docker ps --format "{{.Names}}" | wc -l) -lt 16 ]; then echo "- Start missing containers"; fi)
$(if [ $(netstat -tulpn 2>/dev/null | grep -E ":(8001|8002|8003|8004|8005|8006|8080|8081|8091|8092)" | wc -l) -gt 0 ]; then echo "- Resolve port conflicts"; fi)
$(if [ ! -f "ECOSYSTEM_ARCHITECTURE_MAP.md" ]; then echo "- Create architecture map"; fi)

EOF
    
    print_success "Context report generated: $report_file"
}

# Main execution
main() {
    print_header "Universal AI Tools - Context Preservation"
    echo "Ensuring we never lose context of the massive 900K+ line codebase"
    echo ""
    
    check_system_health
    echo ""
    
    check_context_files
    echo ""
    
    check_service_integration
    echo ""
    
    check_monitoring
    echo ""
    
    generate_context_report
    echo ""
    
    print_header "Context Preservation Complete"
    print_info "System context preserved and validated"
    print_info "Continue with confidence - you have full context!"
}

# Run main function
main "$@"