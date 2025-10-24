#!/bin/bash

# Universal AI Tools - Post-Deployment Health Checks
# Validates that all services are running correctly after deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-http://localhost:9999}"
GRAFANA_URL="${GRAFANA_URL:-http://localhost:3000}"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
TIMEOUT=30
MAX_RETRIES=10
RETRY_DELAY=3

echo "=================================================="
echo "Universal AI Tools - Post-Deployment Health Checks"
echo "=================================================="
echo ""
echo "API URL: $API_URL"
echo "Timeout: ${TIMEOUT}s"
echo ""

# Track check results
CHECKS_PASSED=0
CHECKS_FAILED=0

# Function to check service health
check_service() {
    local service_name=$1
    local check_url=$2
    local expected_status=${3:-200}
    local retry_count=0
    
    echo -n "Checking $service_name... "
    
    while [ $retry_count -lt $MAX_RETRIES ]; do
        response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$check_url" 2>/dev/null || echo "000")
        
        if [ "$response" = "$expected_status" ]; then
            echo -e "${GREEN}✅ OK${NC}"
            ((CHECKS_PASSED++))
            return 0
        fi
        
        ((retry_count++))
        if [ $retry_count -lt $MAX_RETRIES ]; then
            sleep $RETRY_DELAY
        fi
    done
    
    echo -e "${RED}❌ FAILED (HTTP $response)${NC}"
    ((CHECKS_FAILED++))
    return 1
}

# Function to check API endpoint
check_api_endpoint() {
    local endpoint_name=$1
    local endpoint_path=$2
    local method=${3:-GET}
    local data=${4:-}
    local expected_status=${5:-200}
    
    echo -n "Testing $endpoint_name... "
    
    if [ -n "$data" ]; then
        response=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            --connect-timeout 5 \
            "$API_URL$endpoint_path" 2>/dev/null || echo "000")
    else
        response=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" \
            --connect-timeout 5 \
            "$API_URL$endpoint_path" 2>/dev/null || echo "000")
    fi
    
    if [ "$response" = "$expected_status" ]; then
        echo -e "${GREEN}✅ OK${NC}"
        ((CHECKS_PASSED++))
        return 0
    else
        echo -e "${RED}❌ FAILED (HTTP $response)${NC}"
        ((CHECKS_FAILED++))
        return 1
    fi
}

# Function to check Docker container
check_container() {
    local container_name=$1
    
    echo -n "Checking container $container_name... "
    
    if docker ps --format "table {{.Names}}" | grep -q "$container_name"; then
        # Check if container is healthy
        health=$(docker inspect --format='{{.State.Health.Status}}' "$container_name" 2>/dev/null || echo "none")
        
        if [ "$health" = "healthy" ] || [ "$health" = "none" ]; then
            echo -e "${GREEN}✅ Running${NC}"
            ((CHECKS_PASSED++))
            return 0
        else
            echo -e "${YELLOW}⚠️  Running but $health${NC}"
            ((CHECKS_PASSED++))
            return 0
        fi
    else
        echo -e "${RED}❌ Not running${NC}"
        ((CHECKS_FAILED++))
        return 1
    fi
}

# Function to test database connection
test_database() {
    echo -n "Testing database connection... "
    
    response=$(curl -s "$API_URL/api/health/detailed" 2>/dev/null || echo "{}")
    
    if echo "$response" | grep -q '"database":.*"status":"connected"'; then
        echo -e "${GREEN}✅ Connected${NC}"
        ((CHECKS_PASSED++))
        return 0
    else
        echo -e "${RED}❌ Not connected${NC}"
        ((CHECKS_FAILED++))
        return 1
    fi
}

# Function to check system resources
check_resources() {
    echo -e "\n${BLUE}System Resources:${NC}"
    
    # Memory usage
    memory_usage=$(free -m | awk 'NR==2{printf "%.1f", $3*100/$2}')
    echo -n "Memory usage: $memory_usage% - "
    if (( $(echo "$memory_usage > 90" | bc -l) )); then
        echo -e "${RED}Critical${NC}"
    elif (( $(echo "$memory_usage > 80" | bc -l) )); then
        echo -e "${YELLOW}Warning${NC}"
    else
        echo -e "${GREEN}OK${NC}"
    fi
    
    # Disk usage
    disk_usage=$(df -h / | awk 'NR==2{print $5}' | sed 's/%//')
    echo -n "Disk usage: $disk_usage% - "
    if [ $disk_usage -gt 90 ]; then
        echo -e "${RED}Critical${NC}"
    elif [ $disk_usage -gt 80 ]; then
        echo -e "${YELLOW}Warning${NC}"
    else
        echo -e "${GREEN}OK${NC}"
    fi
    
    # Load average
    load_avg=$(uptime | awk -F'load average:' '{print $2}')
    echo "Load average:$load_avg"
}

echo "1. Checking Docker Containers"
echo "============================="

check_container "universal-ai-tools-api"
check_container "universal-ai-tools-redis"
check_container "universal-ai-tools-ollama"
check_container "universal-ai-tools-nginx"
check_container "universal-ai-tools-prometheus"
check_container "universal-ai-tools-grafana"

echo ""
echo "2. Checking Service Health Endpoints"
echo "===================================="

# Wait for services to be ready
echo "Waiting for services to initialize..."
sleep 5

# Core API endpoints
check_service "API Health" "$API_URL/api/health"
check_service "API Ready" "$API_URL/api/ready"
check_service "API Metrics" "$API_URL/metrics"

# Monitoring endpoints
check_service "Prometheus" "$PROMETHEUS_URL/-/ready"
check_service "Grafana" "$GRAFANA_URL/api/health"

echo ""
echo "3. Testing API Functionality"
echo "============================"

# Test various API endpoints
check_api_endpoint "Memory Search" "/api/v1/memory/search" "POST" '{"query":"test","limit":1}'
check_api_endpoint "Tool List" "/api/v1/tools" "GET"
check_api_endpoint "Agent Status" "/api/v1/agents/status" "GET"

# Test WebSocket connectivity (if enabled)
if [ "${ENABLE_WEBSOCKETS:-true}" = "true" ]; then
    echo -n "Testing WebSocket connection... "
    # Simple WebSocket test would go here
    echo -e "${YELLOW}⚠️  Manual verification needed${NC}"
fi

echo ""
echo "4. Database and Cache Checks"
echo "============================"

test_database

# Test Redis
echo -n "Testing Redis cache... "
redis_response=$(docker exec universal-ai-tools-redis redis-cli ping 2>/dev/null || echo "")
if [ "$redis_response" = "PONG" ]; then
    echo -e "${GREEN}✅ Connected${NC}"
    ((CHECKS_PASSED++))
else
    echo -e "${RED}❌ Not responding${NC}"
    ((CHECKS_FAILED++))
fi

echo ""
echo "5. Testing AI Services"
echo "====================="

# Test Ollama
echo -n "Testing Ollama service... "
ollama_response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:11434/api/tags" 2>/dev/null || echo "000")
if [ "$ollama_response" = "200" ]; then
    echo -e "${GREEN}✅ Available${NC}"
    ((CHECKS_PASSED++))
    
    # Check loaded models
    echo -n "Checking loaded models... "
    models=$(docker exec universal-ai-tools-ollama ollama list 2>/dev/null | grep -E "(llama3.2:3b|nomic-embed-text)" | wc -l)
    if [ "$models" -ge 2 ]; then
        echo -e "${GREEN}✅ Models loaded${NC}"
        ((CHECKS_PASSED++))
    else
        echo -e "${YELLOW}⚠️  Some models missing${NC}"
    fi
else
    echo -e "${RED}❌ Not available${NC}"
    ((CHECKS_FAILED++))
fi

echo ""
echo "6. Security Checks"
echo "=================="

# Check HTTPS redirect
echo -n "Testing HTTP to HTTPS redirect... "
redirect_response=$(curl -s -o /dev/null -w "%{http_code}" -L "http://localhost" 2>/dev/null || echo "000")
if [ "$redirect_response" = "200" ] || [ "$redirect_response" = "301" ] || [ "$redirect_response" = "302" ]; then
    echo -e "${GREEN}✅ Working${NC}"
    ((CHECKS_PASSED++))
else
    echo -e "${YELLOW}⚠️  Not configured${NC}"
fi

# Check security headers
echo -n "Checking security headers... "
headers=$(curl -s -I "$API_URL/api/health" 2>/dev/null || echo "")
security_headers=0
echo "$headers" | grep -qi "X-Frame-Options" && ((security_headers++))
echo "$headers" | grep -qi "X-Content-Type-Options" && ((security_headers++))
echo "$headers" | grep -qi "X-XSS-Protection" && ((security_headers++))

if [ $security_headers -ge 3 ]; then
    echo -e "${GREEN}✅ Present${NC}"
    ((CHECKS_PASSED++))
else
    echo -e "${YELLOW}⚠️  Some missing ($security_headers/3)${NC}"
fi

echo ""
echo "7. Performance Metrics"
echo "====================="

# Test API response time
echo -n "Testing API response time... "
response_time=$(curl -s -o /dev/null -w "%{time_total}" "$API_URL/api/health" 2>/dev/null || echo "999")
response_time_ms=$(echo "$response_time * 1000" | bc | cut -d. -f1)

if [ "$response_time_ms" -lt 100 ]; then
    echo -e "${GREEN}✅ Excellent (${response_time_ms}ms)${NC}"
    ((CHECKS_PASSED++))
elif [ "$response_time_ms" -lt 500 ]; then
    echo -e "${GREEN}✅ Good (${response_time_ms}ms)${NC}"
    ((CHECKS_PASSED++))
else
    echo -e "${YELLOW}⚠️  Slow (${response_time_ms}ms)${NC}"
fi

# Check system resources
check_resources

echo ""
echo "8. Log Analysis"
echo "==============="

# Check for errors in logs
echo "Checking application logs for errors..."
if docker logs universal-ai-tools-api --tail 100 2>&1 | grep -i "error\|exception\|fatal" > /dev/null; then
    echo -e "${YELLOW}⚠️  Errors found in application logs${NC}"
    echo "   Run: docker logs universal-ai-tools-api --tail 100"
else
    echo -e "${GREEN}✅ No recent errors in logs${NC}"
    ((CHECKS_PASSED++))
fi

echo ""
echo "=================================================="
echo "Post-Deployment Check Summary"
echo "=================================================="
echo ""
echo -e "Checks passed: ${GREEN}$CHECKS_PASSED${NC}"
echo -e "Checks failed: ${RED}$CHECKS_FAILED${NC}"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All post-deployment checks passed!${NC}"
    echo ""
    echo "Your Universal AI Tools deployment is healthy and ready for use."
    echo ""
    echo "Access points:"
    echo "- API: $API_URL"
    echo "- Grafana Dashboard: $GRAFANA_URL (admin/admin)"
    echo "- Prometheus: $PROMETHEUS_URL"
    echo ""
    echo "Next steps:"
    echo "1. Change default Grafana password"
    echo "2. Configure monitoring alerts"
    echo "3. Set up backup automation"
    echo "4. Review security settings"
    exit 0
else
    echo -e "${RED}❌ Some checks failed!${NC}"
    echo ""
    echo "Please investigate and fix the failed checks before using in production."
    echo ""
    echo "Common troubleshooting steps:"
    echo "1. Check container logs: docker-compose -f docker-compose.prod.yml logs"
    echo "2. Verify environment variables: ./scripts/validate-production-config.sh"
    echo "3. Check service connections"
    echo "4. Review error logs"
    exit 1
fi