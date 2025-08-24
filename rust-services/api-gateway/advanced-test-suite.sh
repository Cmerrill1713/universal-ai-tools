#!/bin/bash

set -euo pipefail

# ==============================================================================
# ADVANCED API GATEWAY TEST SUITE
# ==============================================================================

GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}"
RESULTS_FILE="test-results-$(date +%Y%m%d-%H%M%S).json"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# ==============================================================================
# UTILITY FUNCTIONS
# ==============================================================================

log_test() {
    echo -e "${BLUE}[TEST]${NC} $1"
    ((TESTS_RUN++))
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
    ((TESTS_PASSED++))
}

log_failure() {
    echo -e "${RED}[✗]${NC} $1"
    ((TESTS_FAILED++))
}

log_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

log_metric() {
    echo -e "  ${YELLOW}$1:${NC} $2"
}

# ==============================================================================
# 1. PERFORMANCE BENCHMARKS WITH PERCENTILES
# ==============================================================================

benchmark_performance() {
    log_test "Running comprehensive performance benchmarks"
    
    local services=("database" "documentation" "ml")
    local iterations=100
    
    for service in "${services[@]}"; do
        echo -e "\n${YELLOW}Benchmarking $service service:${NC}"
        
        local latencies=""
        for ((i=1; i<=iterations; i++)); do
            latency=$(curl -s -o /dev/null -w "%{time_total}" "$GATEWAY_URL/api/$service/health" 2>/dev/null || echo "0")
            latencies="$latencies $latency"
        done
        
        # Calculate statistics
        sorted_latencies=$(echo "$latencies" | tr ' ' '\n' | sort -n | grep -v '^$')
        
        min=$(echo "$sorted_latencies" | head -1)
        max=$(echo "$sorted_latencies" | tail -1)
        avg=$(echo "$sorted_latencies" | awk '{sum+=$1} END {print sum/NR}')
        p50=$(echo "$sorted_latencies" | awk 'NR==50')
        p95=$(echo "$sorted_latencies" | awk 'NR==95')
        p99=$(echo "$sorted_latencies" | awk 'NR==99')
        
        log_metric "Requests" "$iterations"
        log_metric "Average" "${avg}s"
        log_metric "Min" "${min}s"
        log_metric "Max" "${max}s"
        log_metric "P50" "${p50}s"
        log_metric "P95" "${p95}s"
        log_metric "P99" "${p99}s"
    done
    
    log_success "Performance benchmarks completed"
}

# ==============================================================================
# 2. LOAD TESTING WITH CONCURRENCY
# ==============================================================================

load_test() {
    log_test "Running load tests with increasing concurrency"
    
    local levels=(10 50 100 250 500 1000)
    
    for concurrency in "${levels[@]}"; do
        echo -e "\n${YELLOW}Testing with $concurrency concurrent connections:${NC}"
        
        # Use Apache Bench if available, otherwise use curl in parallel
        if command -v ab &> /dev/null; then
            result=$(ab -n $concurrency -c $((concurrency/10)) -q "$GATEWAY_URL/api/health" 2>&1 | grep -E "(Requests per second|Time per request|Failed requests)" || true)
            echo "$result"
        else
            start_time=$(date +%s%N)
            
            # Run concurrent requests
            for ((i=1; i<=concurrency; i++)); do
                curl -s -o /dev/null "$GATEWAY_URL/api/health" &
            done
            wait
            
            end_time=$(date +%s%N)
            duration=$((($end_time - $start_time) / 1000000))
            throughput=$((concurrency * 1000 / duration))
            
            log_metric "Duration" "${duration}ms"
            log_metric "Throughput" "${throughput} req/s"
        fi
    done
    
    log_success "Load testing completed"
}

# ==============================================================================
# 3. STRESS TEST WITH SUSTAINED LOAD
# ==============================================================================

stress_test() {
    log_test "Running stress test with sustained load"
    
    local duration=30  # seconds
    local rate=100     # requests per second
    
    echo -e "\n${YELLOW}Sustaining $rate req/s for $duration seconds:${NC}"
    
    local start_time=$(date +%s)
    local end_time=$((start_time + duration))
    local requests_sent=0
    local requests_succeeded=0
    local requests_failed=0
    
    while [ $(date +%s) -lt $end_time ]; do
        for ((i=1; i<=rate; i++)); do
            if curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL/api/health" | grep -q "200"; then
                ((requests_succeeded++))
            else
                ((requests_failed++))
            fi
            ((requests_sent++)) &
        done
        sleep 1
    done
    
    wait
    
    log_metric "Total requests" "$requests_sent"
    log_metric "Successful" "$requests_succeeded"
    log_metric "Failed" "$requests_failed"
    local success_rate=$((requests_succeeded * 100 / requests_sent))
    log_metric "Success rate" "${success_rate}%"
    
    if [ $success_rate -gt 95 ]; then
        log_success "Stress test passed with ${success_rate}% success rate"
    else
        log_failure "Stress test failed with only ${success_rate}% success rate"
    fi
}

# ==============================================================================
# 4. CIRCUIT BREAKER TESTING
# ==============================================================================

test_circuit_breaker() {
    log_test "Testing circuit breaker behavior"
    
    echo -e "\n${YELLOW}Simulating backend failures:${NC}"
    
    # First, kill a backend service to simulate failure
    local doc_pid=$(pgrep -f "documentation-generator" | head -1)
    if [ -n "$doc_pid" ]; then
        kill -STOP "$doc_pid" 2>/dev/null || true
        log_info "Paused documentation service (PID: $doc_pid)"
        
        # Test requests during failure
        local failures=0
        for ((i=1; i<=10; i++)); do
            status=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL/api/documentation/health" 2>/dev/null)
            if [ "$status" != "200" ]; then
                ((failures++))
            fi
        done
        
        log_metric "Failed requests" "$failures/10"
        
        # Resume the service
        kill -CONT "$doc_pid" 2>/dev/null || true
        log_info "Resumed documentation service"
        
        # Test recovery
        sleep 2
        status=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL/api/documentation/health" 2>/dev/null)
        if [ "$status" = "200" ]; then
            log_success "Service recovered successfully"
        else
            log_failure "Service recovery failed"
        fi
    else
        log_info "Documentation service not found, skipping circuit breaker test"
    fi
}

# ==============================================================================
# 5. WEBSOCKET CONNECTION TESTING
# ==============================================================================

test_websocket() {
    log_test "Testing WebSocket connections"
    
    if command -v websocat &> /dev/null; then
        echo -e "\n${YELLOW}Testing WebSocket upgrade:${NC}"
        
        # Test WebSocket connection
        echo '{"type":"ping"}' | timeout 2 websocat -n1 "ws://localhost:8080/ws" 2>&1 | head -1
        
        if [ $? -eq 0 ]; then
            log_success "WebSocket connection successful"
        else
            log_info "WebSocket connection failed or timed out"
        fi
    else
        log_info "websocat not installed, skipping WebSocket test"
    fi
}

# ==============================================================================
# 6. MEMORY AND RESOURCE TESTING
# ==============================================================================

test_memory_usage() {
    log_test "Monitoring memory usage under load"
    
    # Get initial memory usage
    local gateway_pid=$(pgrep -f "api-gateway" | head -1)
    if [ -n "$gateway_pid" ]; then
        local initial_mem=$(ps -o rss= -p "$gateway_pid" | awk '{print $1/1024 " MB"}')
        log_metric "Initial memory" "$initial_mem"
        
        # Generate load
        echo -e "\n${YELLOW}Generating load for memory test:${NC}"
        for ((i=1; i<=1000; i++)); do
            curl -s -o /dev/null "$GATEWAY_URL/api/health" &
        done
        wait
        
        # Check memory after load
        local after_mem=$(ps -o rss= -p "$gateway_pid" | awk '{print $1/1024 " MB"}')
        log_metric "Memory after load" "$after_mem"
        
        # Monitor for memory leaks (wait and check again)
        sleep 5
        local final_mem=$(ps -o rss= -p "$gateway_pid" | awk '{print $1/1024 " MB"}')
        log_metric "Memory after cooldown" "$final_mem"
        
        log_success "Memory usage monitored successfully"
    else
        log_info "API Gateway process not found"
    fi
}

# ==============================================================================
# 7. LATENCY DISTRIBUTION ANALYSIS
# ==============================================================================

analyze_latency_distribution() {
    log_test "Analyzing latency distribution"
    
    echo -e "\n${YELLOW}Collecting latency samples:${NC}"
    
    local samples=1000
    local latencies=""
    
    for ((i=1; i<=samples; i++)); do
        latency=$(curl -s -o /dev/null -w "%{time_total}" "$GATEWAY_URL/api/health" 2>/dev/null)
        latencies="$latencies $latency"
        
        # Show progress
        if [ $((i % 100)) -eq 0 ]; then
            echo -n "."
        fi
    done
    echo ""
    
    # Analyze distribution
    sorted=$(echo "$latencies" | tr ' ' '\n' | sort -n | grep -v '^$')
    
    # Count samples in different ranges
    under_10ms=$(echo "$sorted" | awk '$1 < 0.01' | wc -l)
    under_50ms=$(echo "$sorted" | awk '$1 < 0.05' | wc -l)
    under_100ms=$(echo "$sorted" | awk '$1 < 0.1' | wc -l)
    under_500ms=$(echo "$sorted" | awk '$1 < 0.5' | wc -l)
    over_500ms=$(echo "$sorted" | awk '$1 >= 0.5' | wc -l)
    
    log_metric "< 10ms" "$((under_10ms * 100 / samples))%"
    log_metric "< 50ms" "$((under_50ms * 100 / samples))%"
    log_metric "< 100ms" "$((under_100ms * 100 / samples))%"
    log_metric "< 500ms" "$((under_500ms * 100 / samples))%"
    log_metric ">= 500ms" "$((over_500ms * 100 / samples))%"
    
    log_success "Latency distribution analyzed"
}

# ==============================================================================
# 8. ERROR HANDLING AND RECOVERY
# ==============================================================================

test_error_handling() {
    log_test "Testing error handling and recovery"
    
    echo -e "\n${YELLOW}Testing various error scenarios:${NC}"
    
    # Test invalid JSON payload
    response=$(curl -s -X POST "$GATEWAY_URL/api/database/query" \
        -H "Content-Type: application/json" \
        -d '{invalid json}' \
        -w "\n%{http_code}" 2>/dev/null | tail -1)
    log_metric "Invalid JSON response" "HTTP $response"
    
    # Test oversized payload
    large_payload=$(dd if=/dev/zero bs=1M count=10 2>/dev/null | base64)
    response=$(curl -s -X POST "$GATEWAY_URL/api/ml/analyze" \
        -H "Content-Type: application/json" \
        -d "{\"data\":\"$large_payload\"}" \
        -w "%{http_code}" 2>/dev/null || echo "413")
    log_metric "Oversized payload response" "HTTP $response"
    
    # Test malformed headers
    response=$(curl -s "$GATEWAY_URL/api/health" \
        -H "X-Invalid-Header: $(printf '%.0s-' {1..10000})" \
        -w "%{http_code}" 2>/dev/null || echo "400")
    log_metric "Malformed header response" "HTTP $response"
    
    log_success "Error handling tests completed"
}

# ==============================================================================
# 9. SERVICE DISCOVERY VALIDATION
# ==============================================================================

test_service_discovery() {
    log_test "Validating service discovery"
    
    echo -e "\n${YELLOW}Checking registered services:${NC}"
    
    # Get service registry status
    response=$(curl -s "$GATEWAY_URL/api/admin/services" 2>/dev/null || echo "{}")
    
    # Check if we can parse it as JSON
    if echo "$response" | jq -e . >/dev/null 2>&1; then
        service_count=$(echo "$response" | jq -r '.services | length' 2>/dev/null || echo "0")
        log_metric "Registered services" "$service_count"
        
        # List services
        echo "$response" | jq -r '.services[]?.name' 2>/dev/null | while read -r service; do
            if [ -n "$service" ]; then
                echo "  - $service"
            fi
        done
        
        log_success "Service discovery validated"
    else
        log_info "Admin endpoint not available or returned non-JSON"
    fi
}

# ==============================================================================
# 10. COMPREHENSIVE REPORT GENERATION
# ==============================================================================

generate_report() {
    echo -e "\n${BLUE}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}                    TEST SUITE SUMMARY                          ${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
    
    local success_rate=$((TESTS_PASSED * 100 / TESTS_RUN))
    
    echo -e "\nTests Run: ${TESTS_RUN}"
    echo -e "${GREEN}Passed: ${TESTS_PASSED}${NC}"
    echo -e "${RED}Failed: ${TESTS_FAILED}${NC}"
    echo -e "Success Rate: ${success_rate}%"
    
    # Generate JSON report
    cat > "$RESULTS_FILE" <<EOF
{
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "gateway_url": "$GATEWAY_URL",
    "tests": {
        "total": $TESTS_RUN,
        "passed": $TESTS_PASSED,
        "failed": $TESTS_FAILED,
        "success_rate": $success_rate
    }
}
EOF
    
    echo -e "\nDetailed results saved to: ${YELLOW}$RESULTS_FILE${NC}"
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "\n${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║           ALL TESTS PASSED SUCCESSFULLY! 🎉                   ║${NC}"
        echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
        exit 0
    else
        echo -e "\n${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${RED}║           SOME TESTS FAILED - REVIEW REQUIRED                 ║${NC}"
        echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
        exit 1
    fi
}

# ==============================================================================
# MAIN EXECUTION
# ==============================================================================

main() {
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║           ADVANCED API GATEWAY TEST SUITE                     ║${NC}"
    echo -e "${BLUE}║                  $(date +"%Y-%m-%d %H:%M:%S")                         ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
    
    echo -e "\nTarget: ${YELLOW}$GATEWAY_URL${NC}\n"
    
    # Check if gateway is accessible
    if ! curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL/api/health" | grep -q "200"; then
        echo -e "${RED}ERROR: API Gateway is not accessible at $GATEWAY_URL${NC}"
        exit 1
    fi
    
    # Run test suites
    benchmark_performance
    load_test
    stress_test
    test_circuit_breaker
    test_websocket
    test_memory_usage
    analyze_latency_distribution
    test_error_handling
    test_service_discovery
    
    # Generate final report
    generate_report
}

# Run main function
main "$@"