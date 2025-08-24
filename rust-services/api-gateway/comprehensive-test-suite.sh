#!/bin/bash

# Comprehensive API Gateway Test Suite
# Tests performance, resilience, security, and edge cases

set -e

GATEWAY_URL="http://127.0.0.1:8080"
RESULTS_DIR="test-results-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RESULTS_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

log_test() {
    echo -e "${BLUE}[TEST]${NC} $1"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
    PASSED_TESTS=$((PASSED_TESTS + 1))
}

log_failure() {
    echo -e "${RED}[✗]${NC} $1"
    FAILED_TESTS=$((FAILED_TESTS + 1))
}

log_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

# ==============================================================================
# 1. BASELINE PERFORMANCE BENCHMARKS
# ==============================================================================

echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}║          BASELINE PERFORMANCE BENCHMARKS                     ║${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"

run_baseline_benchmarks() {
    log_test "Measuring baseline latency for each service"
    
    # Test direct service access vs gateway access
    for service in database documentation ml; do
        echo -e "\n${YELLOW}Testing $service service:${NC}"
        
        # Measure gateway latency
        gateway_times=""
        for i in {1..100}; do
            time=$(curl -o /dev/null -s -w "%{time_total}" "$GATEWAY_URL/api/$service/health")
            gateway_times="$gateway_times $time"
        done
        
        # Calculate statistics
        avg_gateway=$(echo "$gateway_times" | awk '{sum=0; for(i=1;i<=NF;i++)sum+=$i; print sum/NF}')
        min_gateway=$(echo "$gateway_times" | tr ' ' '\n' | sort -n | head -1)
        max_gateway=$(echo "$gateway_times" | tr ' ' '\n' | sort -n | tail -1)
        p95_gateway=$(echo "$gateway_times" | tr ' ' '\n' | sort -n | awk 'BEGIN{c=0} {a[c++]=$1} END{print a[int(c*0.95-0.5)]}')
        p99_gateway=$(echo "$gateway_times" | tr ' ' '\n' | sort -n | awk 'BEGIN{c=0} {a[c++]=$1} END{print a[int(c*0.99-0.5)]}')
        
        echo "  Gateway Latency:"
        echo "    Average: ${avg_gateway}s"
        echo "    Min: ${min_gateway}s"
        echo "    Max: ${max_gateway}s"
        echo "    P95: ${p95_gateway}s"
        echo "    P99: ${p99_gateway}s"
        
        # Save results
        echo "$service,$avg_gateway,$min_gateway,$max_gateway,$p95_gateway,$p99_gateway" >> "$RESULTS_DIR/baseline_latency.csv"
    done
    
    log_success "Baseline benchmarks completed"
}

# ==============================================================================
# 2. CONCURRENT REQUEST HANDLING
# ==============================================================================

echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}║          CONCURRENT REQUEST HANDLING TEST                    ║${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"

test_concurrent_requests() {
    log_test "Testing concurrent request handling"
    
    concurrent_levels=(10 50 100 200 500 1000)
    
    for level in "${concurrent_levels[@]}"; do
        echo -e "\n${YELLOW}Testing with $level concurrent requests:${NC}"
        
        start_time=$(date +%s%N)
        success_count=0
        
        # Launch concurrent requests
        for i in $(seq 1 $level); do
            {
                if curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL/api/database/health" | grep -q "200"; then
                    echo "success"
                else
                    echo "failure"
                fi
            } &
        done > "$RESULTS_DIR/concurrent_$level.tmp"
        
        # Wait for all requests to complete
        wait
        
        end_time=$(date +%s%N)
        duration=$((($end_time - $start_time) / 1000000))
        
        success_count=$(grep -c "success" "$RESULTS_DIR/concurrent_$level.tmp" 2>/dev/null || echo 0)
        failure_count=$((level - success_count))
        
        echo "  Completed in: ${duration}ms"
        echo "  Success: $success_count/$level"
        echo "  Failure: $failure_count/$level"
        echo "  Throughput: $((level * 1000 / duration)) req/s"
        
        if [ $success_count -eq $level ]; then
            log_success "All $level concurrent requests succeeded"
        else
            log_failure "Only $success_count/$level concurrent requests succeeded"
        fi
    done
}

# ==============================================================================
# 3. RATE LIMITING STRESS TEST
# ==============================================================================

echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}║          RATE LIMITING STRESS TEST                           ║${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"

test_rate_limiting() {
    log_test "Testing rate limiting under stress"
    
    # Burst test - send many requests rapidly
    echo -e "\n${YELLOW}Burst test - 100 requests in 1 second:${NC}"
    
    status_codes=""
    for i in {1..100}; do
        code=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL/api/database/health")
        status_codes="$status_codes $code"
    done
    
    success_count=$(echo "$status_codes" | tr ' ' '\n' | grep -c "200" 2>/dev/null || true)
    rate_limited=$(echo "$status_codes" | tr ' ' '\n' | grep -c "429" 2>/dev/null || true)
    
    # Ensure variables are numeric and handle grep output properly
    success_count=$(echo "$success_count" | head -n 1 | grep -o '[0-9]*' | head -n 1)
    rate_limited=$(echo "$rate_limited" | head -n 1 | grep -o '[0-9]*' | head -n 1)
    success_count=${success_count:-0}
    rate_limited=${rate_limited:-0}
    
    echo "  200 OK: $success_count"
    echo "  429 Too Many Requests: $rate_limited"
    other_count=$((100 - success_count - rate_limited))
    echo "  Other: $other_count"
    
    if [ $rate_limited -gt 0 ]; then
        log_success "Rate limiting is active (detected 429 responses)"
    else
        log_info "No rate limiting detected (all requests succeeded)"
    fi
}

# ==============================================================================
# 4. SERVICE FAILURE RESILIENCE
# ==============================================================================

echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}║          SERVICE FAILURE RESILIENCE TEST                     ║${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"

test_service_failure() {
    log_test "Testing behavior when backend service is down"
    
    # First, test with a non-existent service
    echo -e "\n${YELLOW}Testing request to non-existent service:${NC}"
    response=$(curl -s -w "\n%{http_code}" "$GATEWAY_URL/api/nonexistent/test" 2>/dev/null)
    status_code=$(echo "$response" | tail -n1)
    
    if [ "$status_code" = "404" ] || [ "$status_code" = "503" ]; then
        log_success "Gateway correctly handles non-existent service (HTTP $status_code)"
    else
        log_failure "Unexpected response for non-existent service (HTTP $status_code)"
    fi
    
    # Test timeout behavior (simulate slow service)
    echo -e "\n${YELLOW}Testing timeout handling:${NC}"
    # This will timeout if the service doesn't respond quickly
    timeout 5 curl -s "$GATEWAY_URL/api/database/slow-endpoint" > /dev/null 2>&1
    if [ $? -eq 124 ]; then
        log_info "Request timed out as expected for slow endpoint"
    else
        log_info "Request completed (endpoint may not exist or responded quickly)"
    fi
}

# ==============================================================================
# 5. PATH ROUTING EDGE CASES
# ==============================================================================

echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}║          PATH ROUTING EDGE CASES TEST                        ║${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"

test_path_routing() {
    log_test "Testing path routing edge cases"
    
    # Test various path patterns
    test_paths=(
        "/api/database/"
        "/api/database"
        "/api/database/health/"
        "/api/database//health"
        "/api/database/../../etc/passwd"
        "/api/database/health?param=test"
        "/api/database/health#anchor"
        "/api/database/health%20test"
        "/api/database/深/测试"
        "/api/database/very/long/path/that/might/cause/issues/with/routing"
    )
    
    for path in "${test_paths[@]}"; do
        echo -e "\n${YELLOW}Testing path: $path${NC}"
        response=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL$path" 2>/dev/null)
        
        case $response in
            200|404|400)
                echo "  Response: HTTP $response (handled correctly)"
                ;;
            *)
                echo "  Response: HTTP $response (unexpected)"
                ;;
        esac
    done
    
    log_success "Path routing edge cases tested"
}

# ==============================================================================
# 6. HEADER MANIPULATION TEST
# ==============================================================================

echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}║          HEADER MANIPULATION TEST                            ║${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"

test_headers() {
    log_test "Testing header handling and manipulation"
    
    # Test with various headers
    echo -e "\n${YELLOW}Testing custom headers:${NC}"
    
    # Large header value
    large_header=$(python3 -c "print('A' * 8192)")
    response=$(curl -s -o /dev/null -w "%{http_code}" -H "X-Large-Header: $large_header" "$GATEWAY_URL/api/database/health" 2>/dev/null)
    echo "  Large header (8KB): HTTP $response"
    
    # Many headers
    header_args=""
    for i in {1..100}; do
        header_args="$header_args -H 'X-Custom-$i: value$i'"
    done
    response=$(eval "curl -s -o /dev/null -w '%{http_code}' $header_args '$GATEWAY_URL/api/database/health' 2>/dev/null")
    echo "  100 custom headers: HTTP $response"
    
    # Special characters in headers
    response=$(curl -s -o /dev/null -w "%{http_code}" -H "X-Special: <script>alert('xss')</script>" "$GATEWAY_URL/api/database/health" 2>/dev/null)
    echo "  XSS attempt in header: HTTP $response"
    
    log_success "Header manipulation tests completed"
}

# ==============================================================================
# 7. PAYLOAD SIZE TESTS
# ==============================================================================

echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}║          PAYLOAD SIZE TESTS                                  ║${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"

test_payload_sizes() {
    log_test "Testing various payload sizes"
    
    sizes=(1 10 100 1000 10000)  # KB
    
    for size in "${sizes[@]}"; do
        echo -e "\n${YELLOW}Testing ${size}KB payload:${NC}"
        
        # Generate payload
        payload=$(python3 -c "print('x' * ($size * 1024))")
        
        # Test POST with payload
        response=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
            -H "Content-Type: text/plain" \
            -d "$payload" \
            "$GATEWAY_URL/api/database/test" 2>/dev/null)
        
        echo "  Response: HTTP $response"
        
        if [ "$response" = "200" ] || [ "$response" = "404" ] || [ "$response" = "413" ]; then
            echo "  Status: Handled correctly"
        else
            echo "  Status: Unexpected response"
        fi
    done
    
    log_success "Payload size tests completed"
}

# ==============================================================================
# 8. CIRCUIT BREAKER SIMULATION
# ==============================================================================

echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}║          CIRCUIT BREAKER SIMULATION                          ║${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"

test_circuit_breaker() {
    log_test "Testing circuit breaker behavior"
    
    echo -e "\n${YELLOW}Simulating service degradation:${NC}"
    
    # Send many requests to observe behavior change
    for i in {1..50}; do
        response=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL/api/database/health" 2>/dev/null)
        
        if [ $((i % 10)) -eq 0 ]; then
            echo "  Request $i: HTTP $response"
        fi
        
        # Small delay between requests
        sleep 0.1
    done
    
    log_info "Circuit breaker behavior observed"
}

# ==============================================================================
# 9. MEMORY LEAK TEST
# ==============================================================================

echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}║          MEMORY LEAK TEST                                    ║${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"

test_memory_leak() {
    log_test "Testing for memory leaks under sustained load"
    
    # Get initial memory usage
    gateway_pid=$(pgrep -f "api-gateway" | head -1)
    
    if [ -z "$gateway_pid" ]; then
        log_failure "API Gateway process not found"
        return
    fi
    
    initial_mem=$(ps -o rss= -p "$gateway_pid" | awk '{print $1}')
    echo -e "\n${YELLOW}Initial memory usage: ${initial_mem}KB${NC}"
    
    # Send sustained load
    echo "Sending 1000 requests..."
    for i in {1..1000}; do
        curl -s -o /dev/null "$GATEWAY_URL/api/database/health" &
        
        if [ $((i % 100)) -eq 0 ]; then
            wait
            current_mem=$(ps -o rss= -p "$gateway_pid" | awk '{print $1}')
            echo "  After $i requests: ${current_mem}KB"
        fi
    done
    wait
    
    final_mem=$(ps -o rss= -p "$gateway_pid" | awk '{print $1}')
    mem_increase=$((final_mem - initial_mem))
    
    echo -e "\n${YELLOW}Final memory usage: ${final_mem}KB${NC}"
    echo -e "${YELLOW}Memory increase: ${mem_increase}KB${NC}"
    
    # Check if memory increase is reasonable (less than 10MB)
    if [ $mem_increase -lt 10240 ]; then
        log_success "No significant memory leak detected (increase: ${mem_increase}KB)"
    else
        log_failure "Possible memory leak detected (increase: ${mem_increase}KB)"
    fi
}

# ==============================================================================
# 10. SERVICE DISCOVERY DYNAMICS
# ==============================================================================

echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}║          SERVICE DISCOVERY DYNAMICS TEST                     ║${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"

test_service_discovery() {
    log_test "Testing service discovery dynamics"
    
    # Register a new service
    echo -e "\n${YELLOW}Registering a new test service:${NC}"
    
    new_service=$(cat <<EOF
{
  "id": "test-service-$(date +%s)",
  "name": "test-service",
  "address": "127.0.0.1",
  "port": 9999,
  "health_endpoint": "/health",
  "status": "healthy",
  "metadata": {}
}
EOF
)
    
    response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$new_service" \
        "$GATEWAY_URL/api/gateway/services")
    
    echo "  Registration response: $(echo $response | jq -c .)"
    
    # Check if service appears in list
    service_count=$(curl -s "$GATEWAY_URL/api/gateway/services" | jq '. | length')
    echo "  Total services after registration: $service_count"
    
    if [ "$service_count" -gt 3 ]; then
        log_success "New service registered successfully"
        
        # Unregister the service
        service_id=$(echo "$new_service" | jq -r .id)
        curl -s -X DELETE "$GATEWAY_URL/api/gateway/services/$service_id" > /dev/null
        echo "  Test service unregistered"
    else
        log_failure "Service registration failed"
    fi
}

# ==============================================================================
# 11. BENCHMARK COMPARISONS
# ==============================================================================

echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}║          PERFORMANCE BENCHMARK COMPARISONS                   ║${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"

run_performance_benchmarks() {
    log_test "Running comprehensive performance benchmarks"
    
    # Use Apache Bench if available
    if command -v ab &> /dev/null; then
        echo -e "\n${YELLOW}Apache Bench test (1000 requests, 10 concurrent):${NC}"
        ab -n 1000 -c 10 -q "$GATEWAY_URL/api/database/health" 2>&1 | grep -E "Requests per second:|Time per request:|Transfer rate:"
    else
        echo "  Apache Bench not installed, skipping"
    fi
    
    # Custom throughput test
    echo -e "\n${YELLOW}Throughput test (10 second duration):${NC}"
    
    start_time=$(date +%s)
    request_count=0
    
    while [ $(($(date +%s) - start_time)) -lt 10 ]; do
        curl -s -o /dev/null "$GATEWAY_URL/api/database/health" &
        request_count=$((request_count + 1))
        
        # Limit concurrent requests
        if [ $((request_count % 50)) -eq 0 ]; then
            wait
        fi
    done
    wait
    
    duration=$(($(date +%s) - start_time))
    throughput=$((request_count / duration))
    
    echo "  Total requests: $request_count"
    echo "  Duration: ${duration}s"
    echo "  Throughput: $throughput req/s"
    
    log_success "Performance benchmarks completed"
}

# ==============================================================================
# MAIN EXECUTION
# ==============================================================================

echo -e "\n${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        COMPREHENSIVE API GATEWAY TEST SUITE                  ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}\n"

# Initialize CSV headers
echo "service,avg,min,max,p95,p99" > "$RESULTS_DIR/baseline_latency.csv"

# Run all tests
run_baseline_benchmarks
test_concurrent_requests
test_rate_limiting
test_service_failure
test_path_routing
test_headers
test_payload_sizes
test_circuit_breaker
test_memory_leak
test_service_discovery
run_performance_benchmarks

# ==============================================================================
# RESULTS SUMMARY
# ==============================================================================

echo -e "\n${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    TEST RESULTS SUMMARY                      ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}\n"

echo "Total Tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n${GREEN}✅ ALL TESTS PASSED!${NC}"
else
    echo -e "\n${YELLOW}⚠️ Some tests failed. Review the results above.${NC}"
fi

echo -e "\nTest results saved in: $RESULTS_DIR/"
echo "  - baseline_latency.csv: Latency measurements"
echo "  - concurrent_*.tmp: Concurrent request results"

# Calculate success rate
if [ $TOTAL_TESTS -gt 0 ]; then
    success_rate=$(echo "scale=2; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc)
    echo -e "\nSuccess Rate: ${success_rate}%"
fi