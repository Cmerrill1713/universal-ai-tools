#!/bin/bash

set -euo pipefail

# ==============================================================================
# RAPID COMPREHENSIVE API GATEWAY TEST SUITE
# Fast execution with deep functional testing and benchmarks
# ==============================================================================

GATEWAY_URL="${GATEWAY_URL:-http://localhost:8081}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RESULTS_FILE="rapid-test-results-${TIMESTAMP}.json"
LOG_FILE="rapid-test-${TIMESTAMP}.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Test tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
TEST_RESULTS=""

# ==============================================================================
# UTILITY FUNCTIONS
# ==============================================================================

log_header() {
    echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}    $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

test_case() {
    local name="$1"
    local result="$2"
    ((TOTAL_TESTS++))
    
    if [ "$result" = "PASS" ]; then
        echo -e "${GREEN}✓${NC} $name"
        TEST_RESULTS="${TEST_RESULTS}\n\"$name\": \"PASS\","
        ((PASSED_TESTS++))
    else
        echo -e "${RED}✗${NC} $name - $result"
        TEST_RESULTS="${TEST_RESULTS}\n\"$name\": \"FAIL: $result\","
        ((FAILED_TESTS++))
    fi
}

metric() {
    echo -e "  ${YELLOW}$1:${NC} $2"
}

# ==============================================================================
# TEST 1: BASIC CONNECTIVITY & HEALTH
# ==============================================================================

test_basic_health() {
    log_header "TEST 1: Basic Connectivity & Health Checks"
    
    # Test gateway health endpoint
    response=$(curl -s -w "\n%{http_code}" "$GATEWAY_URL/health" 2>/dev/null || echo "FAIL\n000")
    status=$(echo "$response" | tail -n1)
    
    if [ "$status" = "200" ]; then
        test_case "Gateway health endpoint" "PASS"
    else
        test_case "Gateway health endpoint" "HTTP $status"
    fi
    
    # Test each service
    for service in database documentation ml; do
        response=$(curl -s -w "%{http_code}" -o /dev/null "$GATEWAY_URL/api/$service/health" 2>/dev/null || echo "000")
        if [ "$response" = "200" ]; then
            test_case "$service service health" "PASS"
        else
            test_case "$service service health" "HTTP $response"
        fi
    done
}

# ==============================================================================
# TEST 2: RAPID PERFORMANCE BENCHMARKS
# ==============================================================================

test_performance() {
    log_header "TEST 2: Performance Benchmarks (25 requests per service)"
    
    for service in database documentation ml; do
        echo -e "${BLUE}Testing $service service:${NC}"
        
        local total_time=0
        local min_time=999999
        local max_time=0
        local success_count=0
        
        for i in {1..25}; do
            response=$(curl -s -o /dev/null -w "%{time_total} %{http_code}" "$GATEWAY_URL/api/$service/health" 2>/dev/null || echo "0 000")
            time=$(echo "$response" | awk '{print $1}')
            status=$(echo "$response" | awk '{print $2}')
            
            if [ "$status" = "200" ]; then
                ((success_count++))
                total_time=$(echo "$total_time + $time" | bc)
                
                if (( $(echo "$time < $min_time" | bc -l) )); then
                    min_time=$time
                fi
                if (( $(echo "$time > $max_time" | bc -l) )); then
                    max_time=$time
                fi
            fi
        done
        
        if [ $success_count -gt 0 ]; then
            avg_time=$(echo "scale=4; $total_time / $success_count" | bc)
            metric "Avg latency" "${avg_time}s"
            metric "Min/Max" "${min_time}s / ${max_time}s"
            metric "Success rate" "$success_count/25"
            
            if [ $success_count -eq 25 ]; then
                test_case "$service performance (25 requests)" "PASS"
            else
                test_case "$service performance" "Only $success_count/25 succeeded"
            fi
        else
            test_case "$service performance" "All requests failed"
        fi
    done
}

# ==============================================================================
# TEST 3: CONCURRENT REQUEST HANDLING
# ==============================================================================

test_concurrency() {
    log_header "TEST 3: Concurrent Request Handling"
    
    for concurrency in 10 50 100 200; do
        echo -e "${BLUE}Testing with $concurrency concurrent requests:${NC}"
        
        local pids=()
        local success_file="/tmp/success_$$_$concurrency"
        local fail_file="/tmp/fail_$$_$concurrency"
        
        echo 0 > "$success_file"
        echo 0 > "$fail_file"
        
        start_time=$(date +%s%3N)
        
        # Launch concurrent requests
        for ((i=1; i<=concurrency; i++)); do
            {
                if curl -s -o /dev/null -f "$GATEWAY_URL/health" 2>/dev/null; then
                    echo 1 >> "$success_file"
                else
                    echo 1 >> "$fail_file"
                fi
            } &
            pids+=($!)
        done
        
        # Wait for all requests
        for pid in "${pids[@]}"; do
            wait $pid 2>/dev/null
        done
        
        end_time=$(date +%s%3N)
        duration=$((end_time - start_time))
        
        success_count=$(wc -l < "$success_file" | tr -d ' ')
        fail_count=$(wc -l < "$fail_file" | tr -d ' ')
        
        if [ "$duration" -gt 0 ]; then
            throughput=$((concurrency * 1000 / duration))
        else
            throughput=0
        fi
        
        metric "Duration" "${duration}ms"
        metric "Success/Fail" "$success_count/$fail_count"
        metric "Throughput" "${throughput} req/s"
        
        if [ "$fail_count" -eq 0 ]; then
            test_case "Concurrency level $concurrency" "PASS"
        else
            test_case "Concurrency level $concurrency" "$fail_count failures"
        fi
        
        rm -f "$success_file" "$fail_file"
    done
}

# ==============================================================================
# TEST 4: PATH ROUTING & REWRITING
# ==============================================================================

test_routing() {
    log_header "TEST 4: Path Routing & Rewriting"
    
    # Test path rewriting is working
    paths=(
        "/api/database/health:200"
        "/api/documentation/health:200"
        "/api/ml/health:200"
        "/api/nonexistent/test:404"
        "/api/:404"
        "/api/database:404"  # Missing specific endpoint
        "/api/database/nonexistent:404"
    )
    
    for path_test in "${paths[@]}"; do
        path="${path_test%:*}"
        expected="${path_test#*:}"
        
        status=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL$path" 2>/dev/null || echo "000")
        
        if [ "$status" = "$expected" ]; then
            test_case "Route $path → HTTP $expected" "PASS"
        else
            test_case "Route $path" "Expected $expected, got $status"
        fi
    done
}

# ==============================================================================
# TEST 5: ERROR HANDLING & EDGE CASES
# ==============================================================================

test_error_handling() {
    log_header "TEST 5: Error Handling & Edge Cases"
    
    # Test invalid JSON
    status=$(curl -s -X POST "$GATEWAY_URL/api/database/query" \
        -H "Content-Type: application/json" \
        -d '{invalid json}' \
        -w "%{http_code}" -o /dev/null 2>/dev/null || echo "000")
    
    if [ "$status" = "400" ] || [ "$status" = "422" ]; then
        test_case "Invalid JSON handling" "PASS"
    else
        test_case "Invalid JSON handling" "Got HTTP $status, expected 400/422"
    fi
    
    # Test large header
    large_header=$(printf '%.0sX' {1..5000})
    status=$(curl -s "$GATEWAY_URL/health" \
        -H "X-Large-Header: $large_header" \
        -w "%{http_code}" -o /dev/null 2>/dev/null || echo "000")
    
    if [ "$status" = "200" ] || [ "$status" = "431" ]; then
        test_case "Large header handling" "PASS"
    else
        test_case "Large header handling" "Unexpected HTTP $status"
    fi
    
    # Test empty POST body
    status=$(curl -s -X POST "$GATEWAY_URL/api/ml/analyze" \
        -H "Content-Type: application/json" \
        -d '' \
        -w "%{http_code}" -o /dev/null 2>/dev/null || echo "000")
    
    if [ "$status" = "400" ] || [ "$status" = "422" ] || [ "$status" = "200" ]; then
        test_case "Empty POST body" "PASS"
    else
        test_case "Empty POST body" "Unexpected HTTP $status"
    fi
    
    # Test special characters in path
    status=$(curl -s -o /dev/null -w "%{http_code}" \
        "$GATEWAY_URL/api/database/%2E%2E%2F%2E%2E%2Fetc%2Fpasswd" 2>/dev/null || echo "000")
    
    if [ "$status" = "400" ] || [ "$status" = "404" ]; then
        test_case "Path traversal attempt blocked" "PASS"
    else
        test_case "Path traversal attempt" "Got HTTP $status, security concern"
    fi
}

# ==============================================================================
# TEST 6: LOAD BALANCING VERIFICATION
# ==============================================================================

test_load_balancing() {
    log_header "TEST 6: Load Balancing & Distribution"
    
    echo -e "${BLUE}Sending 50 requests to verify load distribution:${NC}"
    
    # Track response patterns to detect load balancing
    patterns_file="/tmp/patterns_$$"
    > "$patterns_file"
    
    for i in {1..50}; do
        response=$(curl -s "$GATEWAY_URL/health" 2>/dev/null || echo "{}")
        # Extract a unique identifier from response (like timestamp or server id)
        pattern=$(echo "$response" | md5sum | cut -c1-8)
        echo "$pattern" >> "$patterns_file"
    done
    
    unique_patterns=$(sort "$patterns_file" | uniq | wc -l | tr -d ' ')
    metric "Unique response patterns" "$unique_patterns"
    
    if [ $unique_patterns -gt 1 ]; then
        test_case "Load balancing detected" "PASS"
        sort "$patterns_file" | uniq -c | while read count pattern; do
            echo "  Pattern $pattern: $count requests"
        done
    else
        test_case "Load balancing" "Single pattern - may be single backend"
    fi
    
    rm -f "$patterns_file"
}

# ==============================================================================
# TEST 7: SERVICE DISCOVERY & REGISTRATION
# ==============================================================================

test_service_discovery() {
    log_header "TEST 7: Service Discovery & Registration"
    
    # Check admin endpoints if available
    status=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL/api/admin/services" 2>/dev/null || echo "000")
    
    if [ "$status" = "200" ]; then
        services=$(curl -s "$GATEWAY_URL/api/admin/services" 2>/dev/null | jq -r '.services | length' 2>/dev/null || echo "0")
        metric "Registered services" "$services"
        
        if [ "$services" -gt 0 ]; then
            test_case "Service registry" "PASS"
        else
            test_case "Service registry" "No services registered"
        fi
    else
        test_case "Service registry endpoint" "Not accessible (HTTP $status)"
    fi
    
    # Test service health monitoring
    for service in database documentation ml; do
        health_status=$(curl -s "$GATEWAY_URL/api/$service/health" 2>/dev/null | jq -r '.status' 2>/dev/null || echo "unknown")
        if [ "$health_status" = "healthy" ]; then
            test_case "$service health monitoring" "PASS"
        else
            test_case "$service health monitoring" "Status: $health_status"
        fi
    done
}

# ==============================================================================
# TEST 8: STRESS TEST WITH SUSTAINED LOAD
# ==============================================================================

test_stress() {
    log_header "TEST 8: Stress Test (10 seconds sustained load)"
    
    echo -e "${BLUE}Sustaining 50 req/s for 10 seconds:${NC}"
    
    local duration=10
    local rate=50
    local total_sent=0
    local total_success=0
    local total_failed=0
    
    start_time=$(date +%s)
    end_time=$((start_time + duration))
    
    while [ $(date +%s) -lt $end_time ]; do
        for ((i=1; i<=rate; i++)); do
            {
                if curl -s -o /dev/null -f "$GATEWAY_URL/health" 2>/dev/null; then
                    echo "1" >> /tmp/stress_success_$$
                else
                    echo "1" >> /tmp/stress_fail_$$
                fi
            } &
        done
        sleep 1
    done
    
    wait
    
    total_success=$(wc -l < /tmp/stress_success_$$ 2>/dev/null | tr -d ' ' || echo 0)
    total_failed=$(wc -l < /tmp/stress_fail_$$ 2>/dev/null | tr -d ' ' || echo 0)
    total_sent=$((total_success + total_failed))
    
    if [ $total_sent -gt 0 ]; then
        success_rate=$((total_success * 100 / total_sent))
    else
        success_rate=0
    fi
    
    metric "Total requests" "$total_sent"
    metric "Successful" "$total_success"
    metric "Failed" "$total_failed"
    metric "Success rate" "${success_rate}%"
    
    if [ $success_rate -ge 95 ]; then
        test_case "Stress test (95%+ success)" "PASS"
    else
        test_case "Stress test" "Only ${success_rate}% success rate"
    fi
    
    rm -f /tmp/stress_success_$$ /tmp/stress_fail_$$
}

# ==============================================================================
# TEST 9: LATENCY PERCENTILES UNDER LOAD
# ==============================================================================

test_latency_percentiles() {
    log_header "TEST 9: Latency Percentiles Analysis"
    
    echo -e "${BLUE}Collecting 100 samples for percentile analysis:${NC}"
    
    # Collect latency samples
    > /tmp/latencies_$$
    
    for i in {1..100}; do
        latency=$(curl -s -o /dev/null -w "%{time_total}" "$GATEWAY_URL/health" 2>/dev/null || echo "999")
        echo "$latency" >> /tmp/latencies_$$
        
        # Progress indicator
        if [ $((i % 20)) -eq 0 ]; then
            echo -n "."
        fi
    done
    echo ""
    
    # Sort and calculate percentiles
    sorted_file="/tmp/sorted_latencies_$$"
    sort -n /tmp/latencies_$$ > "$sorted_file"
    
    count=$(wc -l < "$sorted_file" | tr -d ' ')
    if [ $count -ge 100 ]; then
        p50=$(sed -n '50p' "$sorted_file")
        p75=$(sed -n '75p' "$sorted_file")
        p90=$(sed -n '90p' "$sorted_file")
        p95=$(sed -n '95p' "$sorted_file")
        p99=$(sed -n '99p' "$sorted_file")
        
        metric "P50 (median)" "${p50}s"
        metric "P75" "${p75}s"
        metric "P90" "${p90}s"
        metric "P95" "${p95}s"
        metric "P99" "${p99}s"
        
        # Check if P95 is under 100ms
        if (( $(echo "$p95 < 0.1" | bc -l) )); then
            test_case "P95 latency < 100ms" "PASS"
        else
            test_case "P95 latency" "${p95}s (target: < 100ms)"
        fi
    else
        test_case "Latency percentiles" "Insufficient samples"
    fi
    
    rm -f /tmp/latencies_$$ "$sorted_file"
}

# ==============================================================================
# TEST 10: CIRCUIT BREAKER & RECOVERY
# ==============================================================================

test_circuit_breaker() {
    log_header "TEST 10: Circuit Breaker & Recovery Testing"
    
    echo -e "${BLUE}Testing failure detection and recovery:${NC}"
    
    # First, establish baseline
    baseline_status=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL/api/documentation/health" 2>/dev/null)
    metric "Baseline status" "HTTP $baseline_status"
    
    # Try to trigger circuit breaker with rapid failures
    echo "Sending 20 rapid requests to potentially trigger circuit breaker..."
    local failure_responses=0
    
    for i in {1..20}; do
        # Request a non-existent endpoint rapidly
        status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 1 \
            "$GATEWAY_URL/api/documentation/trigger-circuit-breaker-test-$$" 2>/dev/null || echo "000")
        
        if [ "$status" != "200" ]; then
            ((failure_responses++))
        fi
    done
    
    metric "Failed responses" "$failure_responses/20"
    
    # Check if service is still accessible
    recovery_status=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL/api/documentation/health" 2>/dev/null)
    metric "Recovery status" "HTTP $recovery_status"
    
    if [ "$recovery_status" = "200" ]; then
        test_case "Service recovery after failures" "PASS"
    else
        test_case "Service recovery" "Service degraded (HTTP $recovery_status)"
    fi
}

# ==============================================================================
# FINAL REPORT GENERATION
# ==============================================================================

generate_report() {
    log_header "TEST SUITE SUMMARY"
    
    local success_rate=0
    if [ $TOTAL_TESTS -gt 0 ]; then
        success_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    fi
    
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "Total Tests: ${TOTAL_TESTS}"
    echo -e "${GREEN}Passed: ${PASSED_TESTS}${NC}"
    echo -e "${RED}Failed: ${FAILED_TESTS}${NC}"
    echo -e "Success Rate: ${success_rate}%"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    
    # Generate JSON report
    # Remove trailing comma from TEST_RESULTS
    TEST_RESULTS="${TEST_RESULTS%,}"
    
    cat > "$RESULTS_FILE" <<EOF
{
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "gateway_url": "$GATEWAY_URL",
    "summary": {
        "total_tests": $TOTAL_TESTS,
        "passed": $PASSED_TESTS,
        "failed": $FAILED_TESTS,
        "success_rate": $success_rate
    },
    "test_results": {${TEST_RESULTS}
    }
}
EOF
    
    echo -e "\n${YELLOW}Detailed results saved to: $RESULTS_FILE${NC}"
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "\n${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║         🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉                 ║${NC}"
        echo -e "${GREEN}║                                                               ║${NC}"
        echo -e "${GREEN}║  API Gateway is production-ready with excellent performance  ║${NC}"
        echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
    elif [ $success_rate -ge 80 ]; then
        echo -e "\n${YELLOW}╔═══════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${YELLOW}║       MOSTLY SUCCESSFUL - MINOR ISSUES DETECTED              ║${NC}"
        echo -e "${YELLOW}║                                                               ║${NC}"
        echo -e "${YELLOW}║  ${success_rate}% tests passed. Review failures for improvements.        ║${NC}"
        echo -e "${YELLOW}╚═══════════════════════════════════════════════════════════════╝${NC}"
    else
        echo -e "\n${RED}╔═══════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${RED}║         CRITICAL ISSUES DETECTED - ACTION REQUIRED           ║${NC}"
        echo -e "${RED}║                                                               ║${NC}"
        echo -e "${RED}║  Only ${success_rate}% tests passed. Immediate attention needed.         ║${NC}"
        echo -e "${RED}╚═══════════════════════════════════════════════════════════════╝${NC}"
    fi
}

# ==============================================================================
# MAIN EXECUTION
# ==============================================================================

main() {
    echo -e "${MAGENTA}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${MAGENTA}║     RAPID COMPREHENSIVE API GATEWAY TEST SUITE               ║${NC}"
    echo -e "${MAGENTA}║              $(date +"%Y-%m-%d %H:%M:%S")                        ║${NC}"
    echo -e "${MAGENTA}╚═══════════════════════════════════════════════════════════════╝${NC}"
    
    echo -e "\nTarget: ${YELLOW}$GATEWAY_URL${NC}"
    
    # Verify gateway is accessible
    if ! curl -s -o /dev/null -w "%{http_code}" --max-time 2 "$GATEWAY_URL/health" | grep -q "200"; then
        echo -e "\n${RED}ERROR: API Gateway not accessible at $GATEWAY_URL${NC}"
        echo "Please ensure the gateway is running and accessible."
        exit 1
    fi
    
    echo -e "${GREEN}✓ Gateway is accessible${NC}\n"
    
    # Run all test suites
    test_basic_health
    test_performance
    test_concurrency
    test_routing
    test_error_handling
    test_load_balancing
    test_service_discovery
    test_stress
    test_latency_percentiles
    test_circuit_breaker
    
    # Generate final report
    generate_report
}

# Execute main function
main "$@"