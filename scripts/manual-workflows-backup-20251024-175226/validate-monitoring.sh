#!/bin/bash

# Universal AI Tools - Monitoring Validation Script
# This script validates that all monitoring components are properly integrated

set -e

echo "🔍 Validating Universal AI Tools Monitoring Infrastructure"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results
PASSED=0
FAILED=0
WARNINGS=0

# Function to print colored output
print_test() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

print_pass() {
    echo -e "${GREEN}  ✅ PASS:${NC} $1"
    ((PASSED++))
}

print_fail() {
    echo -e "${RED}  ❌ FAIL:${NC} $1"
    ((FAILED++))
}

print_warning() {
    echo -e "${YELLOW}  ⚠️  WARN:${NC} $1"
    ((WARNINGS++))
}

# Check if a file exists
check_file() {
    local file=$1
    local description=$2
    
    if [ -f "$file" ]; then
        print_pass "$description exists"
        return 0
    else
        print_fail "$description missing: $file"
        return 1
    fi
}

# Check if a service is responding
check_service() {
    local url=$1
    local service=$2
    local expected=${3:-200}
    
    response=$(curl -s -o /dev/null -w "%{http_code}" $url 2>/dev/null || echo "000")
    if [ "$response" == "$expected" ] || [ "$response" == "302" ]; then
        print_pass "$service is responding (HTTP $response)"
        return 0
    else
        print_fail "$service is not responding (HTTP $response)"
        return 1
    fi
}

# Check if a metric exists in Prometheus
check_metric() {
    local metric=$1
    local description=$2
    
    if curl -s "http://localhost:9090/api/v1/query?query=$metric" 2>/dev/null | grep -q '"status":"success"'; then
        print_pass "Metric '$metric' is available"
        return 0
    else
        print_warning "Metric '$metric' not found (service might not be running)"
        return 1
    fi
}

# Test 1: Configuration Files
echo ""
print_test "Checking monitoring configuration files..."
check_file "monitoring/prometheus/prometheus.yml" "Prometheus configuration"
check_file "monitoring/prometheus/alerting-rules.yml" "Prometheus alerting rules"
check_file "monitoring/alertmanager/alertmanager.yml" "Alertmanager configuration"
check_file "monitoring/loki/loki-config.yml" "Loki configuration"
check_file "monitoring/promtail/promtail-config.yml" "Promtail configuration"
check_file "monitoring/otel-collector-config.yml" "OpenTelemetry Collector configuration"
check_file "monitoring/grafana/datasources/prometheus.yml" "Grafana datasource configuration"

# Test 2: Docker Compose Files
echo ""
print_test "Checking Docker Compose files..."
check_file "docker-compose.telemetry.yml" "Telemetry Docker Compose file"
check_file "docker-compose.yml" "Main Docker Compose file"

# Test 3: Monitoring Scripts
echo ""
print_test "Checking monitoring scripts..."
if check_file "scripts/setup-monitoring.sh" "Monitoring setup script"; then
    if [ -x "scripts/setup-monitoring.sh" ]; then
        print_pass "Setup script is executable"
    else
        print_warning "Setup script is not executable (run: chmod +x scripts/setup-monitoring.sh)"
    fi
fi

# Test 4: Service Endpoints (if running)
echo ""
print_test "Checking service endpoints (if running)..."
echo "Note: These tests will fail if services are not running"

# Check if services are running before testing endpoints
if docker ps 2>/dev/null | grep -q "prometheus" || lsof -i:9090 2>/dev/null | grep -q LISTEN; then
    check_service "http://localhost:9090/-/healthy" "Prometheus"
    check_service "http://localhost:9090/api/v1/targets" "Prometheus targets endpoint"
else
    print_warning "Prometheus not running - skipping endpoint tests"
fi

if docker ps 2>/dev/null | grep -q "grafana" || lsof -i:3003 2>/dev/null | grep -q LISTEN; then
    check_service "http://localhost:3003/api/health" "Grafana"
else
    print_warning "Grafana not running - skipping endpoint tests"
fi

if docker ps 2>/dev/null | grep -q "alertmanager" || lsof -i:9093 2>/dev/null | grep -q LISTEN; then
    check_service "http://localhost:9093/-/healthy" "Alertmanager"
else
    print_warning "Alertmanager not running - skipping endpoint tests"
fi

if lsof -i:9999 2>/dev/null | grep -q LISTEN; then
    check_service "http://localhost:9999/metrics" "Application metrics endpoint"
    check_service "http://localhost:9999/api/health" "Application health endpoint"
else
    print_warning "Application not running on port 9999 - skipping endpoint tests"
fi

# Test 5: Source Code Integration
echo ""
print_test "Checking source code integration..."

# Check for Prometheus metrics in source
if grep -r "prometheus-metrics" src/ >/dev/null 2>&1; then
    print_pass "Prometheus metrics utility found in source"
else
    print_fail "Prometheus metrics utility not found in source"
fi

if grep -r "PrometheusMiddleware" src/ >/dev/null 2>&1; then
    print_pass "Prometheus middleware found in source"
else
    print_fail "Prometheus middleware not found in source"
fi

if grep -r "health-check" src/services/ >/dev/null 2>&1; then
    print_pass "Health check service found"
else
    print_fail "Health check service not found"
fi

# Test 6: Metrics Collection (if services are running)
echo ""
print_test "Checking metrics collection (if services are running)..."

if lsof -i:9090 2>/dev/null | grep -q LISTEN && lsof -i:9999 2>/dev/null | grep -q LISTEN; then
    # System metrics
    check_metric "up" "Service up metric"
    check_metric "cpu_usage_percent" "CPU usage metric"
    check_metric "memory_usage_bytes" "Memory usage metric"
    check_metric "system_health_score" "System health score metric"
    
    # HTTP metrics
    check_metric "http_requests_total" "HTTP requests metric"
    check_metric "http_request_duration_seconds" "HTTP request duration metric"
    
    # Sweet Athena metrics
    check_metric "athena_interactions_total" "Athena interactions metric"
    check_metric "athena_response_time_seconds" "Athena response time metric"
else
    print_warning "Services not running - skipping metrics collection tests"
fi

# Test 7: Alert Rules Validation
echo ""
print_test "Validating alert rules..."

if [ -f "monitoring/prometheus/alerting-rules.yml" ]; then
    # Check for critical alert rules
    critical_alerts=(
        "ServiceDown"
        "DatabaseConnectionFailed"
        "CriticalErrorRate"
        "SuspiciousActivity"
    )
    
    for alert in "${critical_alerts[@]}"; do
        if grep -q "$alert" monitoring/prometheus/alerting-rules.yml; then
            print_pass "Critical alert rule '$alert' defined"
        else
            print_fail "Critical alert rule '$alert' not found"
        fi
    done
fi

# Test 8: Grafana Dashboards
echo ""
print_test "Checking Grafana dashboards..."

dashboard_files=(
    "monitoring/grafana/dashboards/universal-ai-tools-dashboard.json"
    "monitoring/grafana/dashboards/sweet-athena-dashboard.json"
    "monitoring/grafana/dashboards/system-performance-dashboard.json"
)

for dashboard in "${dashboard_files[@]}"; do
    if [ -f "$dashboard" ]; then
        print_pass "Dashboard $(basename $dashboard) exists"
    else
        print_warning "Dashboard $(basename $dashboard) not found"
    fi
done

# Test 9: Log Aggregation Setup
echo ""
print_test "Checking log aggregation setup..."

if [ -f "monitoring/promtail/promtail-config.yml" ]; then
    if grep -q "universal-ai-tools" monitoring/promtail/promtail-config.yml; then
        print_pass "Promtail configured for Universal AI Tools logs"
    else
        print_fail "Promtail not configured for Universal AI Tools logs"
    fi
fi

# Test 10: Security Configuration
echo ""
print_test "Checking security configuration..."

if [ -f ".env.monitoring" ]; then
    print_pass "Monitoring environment file exists"
    
    # Check for default passwords
    if grep -q "GF_SECURITY_ADMIN_PASSWORD=admin" .env.monitoring 2>/dev/null; then
        print_warning "Default Grafana admin password detected - please change it!"
    fi
else
    print_warning "Monitoring environment file not found - run setup-monitoring.sh"
fi

# Summary
echo ""
echo "========================================"
echo "Monitoring Validation Summary"
echo "========================================"
echo -e "${GREEN}Passed:${NC} $PASSED"
echo -e "${RED}Failed:${NC} $FAILED"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
echo ""

if [ $FAILED -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}✅ All monitoring components are properly configured!${NC}"
        exit 0
    else
        echo -e "${YELLOW}⚠️  Monitoring is configured but has some warnings to address${NC}"
        exit 0
    fi
else
    echo -e "${RED}❌ Monitoring configuration has issues that need to be fixed${NC}"
    echo ""
    echo "To fix:"
    echo "1. Run: ./scripts/setup-monitoring.sh"
    echo "2. Start services: ./start-monitoring.sh"
    echo "3. Re-run this validation script"
    exit 1
fi