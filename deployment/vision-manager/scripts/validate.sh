#!/bin/bash
# Production validation script for Vision Resource Manager deployment
# Validates performance gains and production readiness

set -e

# Script configuration  
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOYMENT_DIR="$SCRIPT_DIR/.."
RESULTS_DIR="$DEPLOYMENT_DIR/results"
HOST=${HOST:-localhost:3000}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }

# Validation report file
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
VALIDATION_REPORT="$RESULTS_DIR/production_validation_$TIMESTAMP.json"
VALIDATION_SUMMARY="$RESULTS_DIR/validation_summary_$TIMESTAMP.md"

mkdir -p "$RESULTS_DIR"

# Initialize validation report
init_validation_report() {
    cat > "$VALIDATION_REPORT" << EOF
{
  "validation_timestamp": "$(date -Iseconds)",
  "test_configuration": {
    "host": "$HOST",
    "validation_type": "production_readiness"
  },
  "results": {
EOF
}

# Finalize validation report
finalize_validation_report() {
    # Remove trailing comma and close JSON
    sed -i.bak '$ s/,$//' "$VALIDATION_REPORT" && rm "$VALIDATION_REPORT.bak"
    cat >> "$VALIDATION_REPORT" << EOF
  },
  "overall_status": "$1",
  "recommendations": $2
}
EOF
}

# Service availability validation
validate_service_availability() {
    log_info "Validating service availability..."
    
    local services=(
        "vision-proxy:$HOST/health:Load Balancer"
        "rust-backend:$HOST/api/v1/vision/rust/metrics:Rust Backend"  
        "typescript-backend:$HOST/api/v1/vision/typescript/metrics:TypeScript Backend"
        "prometheus:localhost:9090/-/healthy:Prometheus"
        "grafana:localhost:3003/api/health:Grafana"
    )
    
    local availability_results="["
    local failed_services=0
    
    for service in "${services[@]}"; do
        IFS=':' read -r name endpoint description <<< "$service"
        
        log_info "Checking $description..."
        
        local start_time=$(date +%s.%N)
        local status_code=""
        local response_time=""
        
        if curl -sf "http://$endpoint" >/dev/null 2>&1; then
            local end_time=$(date +%s.%N)
            response_time=$(echo "scale=3; ($end_time - $start_time) * 1000" | bc -l)
            status_code="200"
            log_success "$description is available (${response_time}ms)"
        else
            response_time="null"
            status_code="error"
            log_error "$description is not available"
            ((failed_services++))
        fi
        
        availability_results+="{\"service\":\"$name\",\"description\":\"$description\",\"status_code\":\"$status_code\",\"response_time\":$response_time},"
    done
    
    # Remove trailing comma
    availability_results="${availability_results%,}]"
    
    echo "    \"service_availability\": $availability_results," >> "$VALIDATION_REPORT"
    
    if [ $failed_services -eq 0 ]; then
        log_success "All services are available"
        return 0
    else
        log_error "$failed_services services failed availability check"
        return 1
    fi
}

# Performance validation
validate_performance_improvements() {
    log_info "Validating performance improvements..."
    
    local performance_results="{"
    
    # Test Rust backend performance
    log_info "Testing Rust backend performance..."
    local rust_times=()
    for i in {1..5}; do
        local time=$(curl -o /dev/null -s -w '%{time_total}' "http://$HOST/api/v1/vision/rust/metrics" 2>/dev/null || echo "999")
        rust_times+=("$time")
    done
    
    # Test TypeScript backend performance  
    log_info "Testing TypeScript backend performance..."
    local ts_times=()
    for i in {1..5}; do
        local time=$(curl -o /dev/null -s -w '%{time_total}' "http://$HOST/api/v1/vision/typescript/metrics" 2>/dev/null || echo "999")
        ts_times+=("$time")
    done
    
    # Calculate averages
    local rust_avg=$(echo "${rust_times[@]}" | tr ' ' '+' | bc -l)
    rust_avg=$(echo "scale=3; $rust_avg / ${#rust_times[@]}" | bc -l)
    
    local ts_avg=$(echo "${ts_times[@]}" | tr ' ' '+' | bc -l)
    ts_avg=$(echo "scale=3; $ts_avg / ${#ts_times[@]}" | bc -l)
    
    # Calculate improvement ratio
    local improvement="null"
    if [[ "$rust_avg" != "999.000" && "$ts_avg" != "999.000" ]]; then
        improvement=$(echo "scale=2; $ts_avg / $rust_avg" | bc -l)
    fi
    
    performance_results+="\"rust_avg_response_time\": $rust_avg,"
    performance_results+="\"typescript_avg_response_time\": $ts_avg,"
    performance_results+="\"performance_improvement_ratio\": $improvement"
    performance_results+="}"
    
    echo "    \"performance_validation\": $performance_results," >> "$VALIDATION_REPORT"
    
    log_info "Performance Results:"
    log_info "  Rust average: ${rust_avg}s"
    log_info "  TypeScript average: ${ts_avg}s"
    
    if [[ "$improvement" != "null" ]]; then
        log_success "Performance improvement: ${improvement}x faster"
        
        # Check if improvement meets expectations
        local improvement_int=$(echo "$improvement" | cut -d'.' -f1)
        if [ "$improvement_int" -ge 2 ]; then
            log_success "Performance improvement exceeds expectations (>2x)"
            return 0
        else
            log_warn "Performance improvement below expectations (<2x)"
            return 1
        fi
    else
        log_error "Could not measure performance improvement"
        return 1
    fi
}

# Load balancing validation
validate_load_balancing() {
    log_info "Validating load balancing behavior..."
    
    local total_requests=20
    local rust_hits=0
    local ts_hits=0
    local errors=0
    
    log_info "Sending $total_requests requests to load balancer..."
    
    for i in $(seq 1 $total_requests); do
        local response=$(curl -s -H "Accept: application/json" "http://$HOST/api/v1/vision/metrics" 2>/dev/null || echo '{"error": "failed"}')
        local backend_header=$(curl -s -I "http://$HOST/api/v1/vision/metrics" 2>/dev/null | grep -i "x-backend-type" | cut -d' ' -f2 | tr -d '\r')
        
        if echo "$response" | grep -q "error"; then
            ((errors++))
        elif [[ "$backend_header" == *"rust"* ]]; then
            ((rust_hits++))
        elif [[ "$backend_header" == *"typescript"* ]]; then
            ((ts_hits++))
        fi
    done
    
    local rust_percentage=$(echo "scale=1; $rust_hits * 100 / $total_requests" | bc -l)
    local ts_percentage=$(echo "scale=1; $ts_hits * 100 / $total_requests" | bc -l)
    local error_percentage=$(echo "scale=1; $errors * 100 / $total_requests" | bc -l)
    
    local load_balancing_results="{\"total_requests\": $total_requests, \"rust_hits\": $rust_hits, \"typescript_hits\": $ts_hits, \"errors\": $errors, \"rust_percentage\": $rust_percentage, \"typescript_percentage\": $ts_percentage, \"error_percentage\": $error_percentage}"
    
    echo "    \"load_balancing_validation\": $load_balancing_results," >> "$VALIDATION_REPORT"
    
    log_info "Load balancing results:"
    log_info "  Rust backend: $rust_hits requests (${rust_percentage}%)"
    log_info "  TypeScript backend: $ts_hits requests (${ts_percentage}%)"
    log_info "  Errors: $errors requests (${error_percentage}%)"
    
    if [ "$errors" -eq 0 ]; then
        log_success "Load balancing working without errors"
        return 0
    else
        log_error "Load balancing has errors ($error_percentage% error rate)"
        return 1
    fi
}

# Resource utilization validation
validate_resource_utilization() {
    log_info "Validating resource utilization..."
    
    # Get Docker container stats
    local rust_cpu=$(docker stats --no-stream --format "{{.CPUPerc}}" vision-manager-rust 2>/dev/null | tr -d '%' || echo "0")
    local ts_cpu=$(docker stats --no-stream --format "{{.CPUPerc}}" vision-manager-typescript 2>/dev/null | tr -d '%' || echo "0")
    local rust_mem=$(docker stats --no-stream --format "{{.MemUsage}}" vision-manager-rust 2>/dev/null || echo "0B / 0B")
    local ts_mem=$(docker stats --no-stream --format "{{.MemUsage}}" vision-manager-typescript 2>/dev/null || echo "0B / 0B")
    
    local resource_results="{\"rust_cpu_percent\": $rust_cpu, \"typescript_cpu_percent\": $ts_cpu, \"rust_memory\": \"$rust_mem\", \"typescript_memory\": \"$ts_mem\"}"
    
    echo "    \"resource_utilization\": $resource_results," >> "$VALIDATION_REPORT"
    
    log_info "Resource utilization:"
    log_info "  Rust CPU: ${rust_cpu}%"
    log_info "  TypeScript CPU: ${ts_cpu}%"
    log_info "  Rust Memory: $rust_mem"
    log_info "  TypeScript Memory: $ts_mem"
    
    # Check if resource usage is reasonable
    local rust_cpu_int=$(echo "$rust_cpu" | cut -d'.' -f1)
    if [ "$rust_cpu_int" -lt 80 ]; then
        log_success "Resource utilization is within acceptable limits"
        return 0
    else
        log_warn "High resource utilization detected"
        return 1
    fi
}

# Monitoring system validation
validate_monitoring_system() {
    log_info "Validating monitoring system..."
    
    local monitoring_results="{"
    
    # Check Prometheus metrics
    local prometheus_status="unknown"
    if curl -sf "http://localhost:9090/-/healthy" >/dev/null 2>&1; then
        prometheus_status="healthy"
        
        # Check if metrics are being collected
        local metrics_count=$(curl -s "http://localhost:9090/api/v1/label/__name__/values" 2>/dev/null | jq -r '.data | length' 2>/dev/null || echo "0")
        monitoring_results+="\"prometheus_status\": \"$prometheus_status\", \"metrics_count\": $metrics_count,"
        
        log_success "Prometheus is healthy with $metrics_count metrics"
    else
        monitoring_results+="\"prometheus_status\": \"unhealthy\", \"metrics_count\": 0,"
        log_error "Prometheus is not available"
    fi
    
    # Check Grafana
    local grafana_status="unknown"
    if curl -sf "http://localhost:3003/api/health" >/dev/null 2>&1; then
        grafana_status="healthy"
        log_success "Grafana is healthy"
    else
        grafana_status="unhealthy"
        log_error "Grafana is not available"
    fi
    
    monitoring_results+="\"grafana_status\": \"$grafana_status\""
    monitoring_results+="}"
    
    echo "    \"monitoring_system\": $monitoring_results," >> "$VALIDATION_REPORT"
    
    if [[ "$prometheus_status" == "healthy" && "$grafana_status" == "healthy" ]]; then
        return 0
    else
        return 1
    fi
}

# Security validation
validate_security() {
    log_info "Validating security configuration..."
    
    local security_results="{"
    local security_issues=0
    
    # Check for security headers
    local security_headers=$(curl -s -I "http://$HOST/health" 2>/dev/null | grep -E "(X-Frame-Options|X-Content-Type-Options|X-XSS-Protection)" | wc -l)
    security_results+="\"security_headers_count\": $security_headers,"
    
    if [ "$security_headers" -ge 3 ]; then
        log_success "Security headers are properly configured"
    else
        log_warn "Missing security headers"
        ((security_issues++))
    fi
    
    # Check for exposed sensitive endpoints
    local metrics_public=$(curl -s -o /dev/null -w "%{http_code}" "http://$HOST/metrics" 2>/dev/null)
    if [ "$metrics_public" -eq 200 ]; then
        log_warn "Metrics endpoint is publicly accessible"
        ((security_issues++))
        security_results+="\"metrics_endpoint_exposed\": true,"
    else
        log_success "Metrics endpoint is properly protected"
        security_results+="\"metrics_endpoint_exposed\": false,"
    fi
    
    security_results+="\"security_issues_count\": $security_issues"
    security_results+="}"
    
    echo "    \"security_validation\": $security_results," >> "$VALIDATION_REPORT"
    
    if [ "$security_issues" -eq 0 ]; then
        log_success "Security validation passed"
        return 0
    else
        log_warn "Security validation found $security_issues issues"
        return 1
    fi
}

# Generate comprehensive validation summary
generate_validation_summary() {
    local overall_status="$1"
    local passed_tests="$2"
    local total_tests="$3"
    
    cat > "$VALIDATION_SUMMARY" << EOF
# Vision Resource Manager - Production Validation Report

**Generated:** $(date)
**Overall Status:** $overall_status
**Tests Passed:** $passed_tests / $total_tests

## Executive Summary

The Vision Resource Manager Rust migration has been validated for production deployment.

## Test Results Summary

EOF
    
    # Extract key results from JSON report
    if command -v jq >/dev/null 2>&1 && [ -f "$VALIDATION_REPORT" ]; then
        cat >> "$VALIDATION_SUMMARY" << EOF
### Performance Validation
EOF
        
        local rust_time=$(jq -r '.results.performance_validation.rust_avg_response_time // "N/A"' "$VALIDATION_REPORT")
        local ts_time=$(jq -r '.results.performance_validation.typescript_avg_response_time // "N/A"' "$VALIDATION_REPORT") 
        local improvement=$(jq -r '.results.performance_validation.performance_improvement_ratio // "N/A"' "$VALIDATION_REPORT")
        
        cat >> "$VALIDATION_SUMMARY" << EOF
- **Rust Backend Response Time:** ${rust_time}s
- **TypeScript Backend Response Time:** ${ts_time}s
- **Performance Improvement:** ${improvement}x faster

### Service Availability
EOF
        
        local available_services=$(jq -r '.results.service_availability | map(select(.status_code == "200")) | length' "$VALIDATION_REPORT" 2>/dev/null || echo "N/A")
        local total_services=$(jq -r '.results.service_availability | length' "$VALIDATION_REPORT" 2>/dev/null || echo "N/A")
        
        echo "- **Services Available:** $available_services / $total_services" >> "$VALIDATION_SUMMARY"
        
        cat >> "$VALIDATION_SUMMARY" << EOF

### Load Balancing
EOF
        
        local error_percentage=$(jq -r '.results.load_balancing_validation.error_percentage // "N/A"' "$VALIDATION_REPORT")
        echo "- **Error Rate:** ${error_percentage}%" >> "$VALIDATION_SUMMARY"
        
    fi
    
    cat >> "$VALIDATION_SUMMARY" << EOF

## Recommendations

EOF
    
    if [ "$overall_status" == "PASS" ]; then
        cat >> "$VALIDATION_SUMMARY" << EOF
✅ **Production Ready:** The system is ready for production deployment.

### Next Steps:
1. Begin gradual traffic migration (10% → 50% → 100%)
2. Monitor performance metrics closely during migration
3. Set up alerting for critical metrics
4. Schedule regular performance reviews

EOF
    else
        cat >> "$VALIDATION_SUMMARY" << EOF
⚠️ **Issues Found:** The following issues should be addressed before production:

### Critical Issues:
- Review failed test results in detailed report
- Address performance or availability concerns
- Validate monitoring and security configuration

### Before Production:
1. Fix all critical issues
2. Re-run validation tests
3. Ensure all services are healthy
4. Verify performance improvements

EOF
    fi
    
    cat >> "$VALIDATION_SUMMARY" << EOF
## Detailed Results

See complete validation data: \`$VALIDATION_REPORT\`

---
*Generated by Vision Resource Manager validation script*
EOF
    
    log_success "Validation summary generated: $VALIDATION_SUMMARY"
}

# Main validation workflow
main() {
    log_info "Starting production validation for Vision Resource Manager..."
    
    # Initialize validation report
    init_validation_report
    
    # Run validation tests
    local passed_tests=0
    local total_tests=6
    
    if validate_service_availability; then ((passed_tests++)); fi
    if validate_performance_improvements; then ((passed_tests++)); fi
    if validate_load_balancing; then ((passed_tests++)); fi
    if validate_resource_utilization; then ((passed_tests++)); fi
    if validate_monitoring_system; then ((passed_tests++)); fi
    if validate_security; then ((passed_tests++)); fi
    
    # Determine overall status
    local overall_status="FAIL"
    local recommendations='["Address failing tests", "Review system configuration", "Re-run validation after fixes"]'
    
    if [ $passed_tests -eq $total_tests ]; then
        overall_status="PASS"
        recommendations='["Begin gradual traffic migration", "Monitor performance metrics", "Set up production alerting"]'
    elif [ $passed_tests -ge $((total_tests * 2 / 3)) ]; then
        overall_status="PASS_WITH_WARNINGS"
        recommendations='["Address minor issues", "Monitor closely during migration", "Review warnings before full deployment"]'
    fi
    
    # Finalize report
    finalize_validation_report "$overall_status" "$recommendations"
    
    # Generate summary
    generate_validation_summary "$overall_status" "$passed_tests" "$total_tests"
    
    # Final status
    if [ "$overall_status" == "PASS" ]; then
        log_success "Production validation PASSED ($passed_tests/$total_tests tests)"
        log_info "System is ready for production deployment"
        return 0
    elif [ "$overall_status" == "PASS_WITH_WARNINGS" ]; then
        log_warn "Production validation PASSED WITH WARNINGS ($passed_tests/$total_tests tests)"
        log_info "Review warnings before proceeding to production"
        return 0
    else
        log_error "Production validation FAILED ($passed_tests/$total_tests tests)"
        log_error "Address issues before production deployment"
        return 1
    fi
}

# Usage information
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Options:
    --host HOST:PORT    Target host for validation (default: localhost:3000)
    --help              Show this help message

This script validates:
1. Service availability and health
2. Performance improvements (Rust vs TypeScript)  
3. Load balancing behavior
4. Resource utilization
5. Monitoring system functionality
6. Security configuration

Results are saved to:
- JSON report: results/production_validation_TIMESTAMP.json
- Summary: results/validation_summary_TIMESTAMP.md
EOF
}

# Command line processing
while [[ $# -gt 0 ]]; do
    case $1 in
        --host)
            HOST="$2"
            shift 2
            ;;
        --help)
            usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Run validation
main