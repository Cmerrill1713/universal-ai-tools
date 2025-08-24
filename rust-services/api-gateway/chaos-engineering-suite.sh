#!/bin/bash

# Chaos Engineering Test Suite for API Gateway
# Tests resilience, recovery, and performance under failure conditions

set -euo pipefail

GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RESULTS_DIR="chaos-results-${TIMESTAMP}"
mkdir -p "$RESULTS_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Test tracking
CHAOS_TESTS=0
CHAOS_PASSED=0
CHAOS_FAILED=0

# ==============================================================================
# UTILITY FUNCTIONS
# ==============================================================================

log_chaos() {
    echo -e "${MAGENTA}[CHAOS]${NC} $1"
}

log_scenario() {
    echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}    CHAOS SCENARIO: $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

chaos_result() {
    local test="$1"
    local result="$2"
    ((CHAOS_TESTS++))
    
    if [ "$result" = "SURVIVED" ]; then
        echo -e "${GREEN}✓${NC} $test - System survived chaos"
        ((CHAOS_PASSED++))
    else
        echo -e "${RED}✗${NC} $test - System failed: $result"
        ((CHAOS_FAILED++))
    fi
}

# ==============================================================================
# CHAOS SCENARIO 1: THUNDERING HERD
# ==============================================================================

chaos_thundering_herd() {
    log_scenario "THUNDERING HERD - 5000 simultaneous connections"
    
    echo "Unleashing the herd..."
    local success=0
    local failed=0
    local start_time=$(date +%s%3N)
    
    # Launch 5000 requests simultaneously
    for i in {1..5000}; do
        {
            if curl -s -o /dev/null -f --max-time 10 "$GATEWAY_URL/health"; then
                echo "1" >> "$RESULTS_DIR/herd_success"
            else
                echo "1" >> "$RESULTS_DIR/herd_fail"
            fi
        } &
    done
    
    # Wait for all to complete
    wait
    
    local end_time=$(date +%s%3N)
    local duration=$((end_time - start_time))
    
    success=$(wc -l < "$RESULTS_DIR/herd_success" 2>/dev/null | tr -d ' ' || echo 0)
    failed=$(wc -l < "$RESULTS_DIR/herd_fail" 2>/dev/null | tr -d ' ' || echo 0)
    
    echo "  Requests succeeded: $success/5000"
    echo "  Requests failed: $failed/5000"
    echo "  Duration: ${duration}ms"
    
    if [ $success -gt 4000 ]; then
        chaos_result "Thundering Herd (80%+ success)" "SURVIVED"
    else
        chaos_result "Thundering Herd" "Only $success/5000 succeeded"
    fi
}

# ==============================================================================
# CHAOS SCENARIO 2: CASCADING FAILURES
# ==============================================================================

chaos_cascading_failures() {
    log_scenario "CASCADING FAILURES - Progressive service degradation"
    
    echo "Simulating cascading service failures..."
    
    # Kill services one by one and test gateway resilience
    services=("documentation-generator" "ml-model-management")
    killed_pids=()
    
    for service in "${services[@]}"; do
        echo "  Killing $service..."
        pid=$(pgrep -f "$service" | head -1)
        if [ -n "$pid" ]; then
            kill -STOP "$pid" 2>/dev/null || true
            killed_pids+=($pid)
            sleep 2
            
            # Test if gateway still responds
            if curl -s -o /dev/null -f --max-time 5 "$GATEWAY_URL/health"; then
                echo "  Gateway still responding after $service failure"
            else
                echo "  Gateway failed after $service failure"
            fi
        fi
    done
    
    # Test partial functionality
    working_endpoints=0
    for endpoint in health api/database/health api/documentation/health api/ml/health; do
        if curl -s -o /dev/null -f --max-time 2 "$GATEWAY_URL/$endpoint" 2>/dev/null; then
            ((working_endpoints++))
        fi
    done
    
    echo "  Working endpoints: $working_endpoints/4"
    
    # Restore services
    for pid in "${killed_pids[@]}"; do
        kill -CONT "$pid" 2>/dev/null || true
    done
    
    if [ $working_endpoints -ge 2 ]; then
        chaos_result "Cascading Failures" "SURVIVED"
    else
        chaos_result "Cascading Failures" "Only $working_endpoints/4 endpoints survived"
    fi
}

# ==============================================================================
# CHAOS SCENARIO 3: NETWORK PARTITION
# ==============================================================================

chaos_network_partition() {
    log_scenario "NETWORK PARTITION - Simulating network delays and drops"
    
    echo "Injecting network chaos..."
    
    # Use traffic control if available (requires sudo)
    if command -v tc &> /dev/null && [ "$EUID" -eq 0 ]; then
        # Add 500ms delay to localhost
        tc qdisc add dev lo root netem delay 500ms 2>/dev/null || true
        
        # Test with network delay
        delayed_response=$(curl -s -o /dev/null -w "%{time_total}" --max-time 10 "$GATEWAY_URL/health" || echo "timeout")
        
        # Remove delay
        tc qdisc del dev lo root 2>/dev/null || true
        
        echo "  Response time with 500ms network delay: ${delayed_response}s"
        
        if [ "$delayed_response" != "timeout" ]; then
            chaos_result "Network Partition" "SURVIVED"
        else
            chaos_result "Network Partition" "Timed out with network delay"
        fi
    else
        # Simulate with concurrent blocking requests
        echo "  Simulating network congestion with blocking requests..."
        
        # Send 100 slow requests
        for i in {1..100}; do
            {
                curl -s -o /dev/null --max-time 30 "$GATEWAY_URL/health" &
            }
        done
        
        # Try to send a normal request during congestion
        if timeout 5 curl -s -o /dev/null "$GATEWAY_URL/health"; then
            chaos_result "Network Congestion" "SURVIVED"
        else
            chaos_result "Network Congestion" "Gateway blocked during congestion"
        fi
        
        # Clean up background jobs
        jobs -p | xargs -r kill 2>/dev/null || true
    fi
}

# ==============================================================================
# CHAOS SCENARIO 4: RESOURCE EXHAUSTION
# ==============================================================================

chaos_resource_exhaustion() {
    log_scenario "RESOURCE EXHAUSTION - Memory and CPU stress"
    
    echo "Creating resource pressure..."
    
    # Get initial memory usage
    gateway_pid=$(pgrep -f "api-gateway" | head -1)
    if [ -n "$gateway_pid" ]; then
        initial_mem=$(ps -o rss= -p "$gateway_pid" 2>/dev/null | awk '{print $1}' || echo 0)
        echo "  Initial memory: $((initial_mem/1024))MB"
        
        # Generate memory pressure with large payloads
        echo "  Sending 1000 large payload requests..."
        large_payload=$(dd if=/dev/zero bs=1M count=1 2>/dev/null | base64 | tr -d '\n')
        
        failures=0
        for i in {1..1000}; do
            if ! curl -s -X POST "$GATEWAY_URL/api/ml/analyze" \
                -H "Content-Type: application/json" \
                -d "{\"data\":\"${large_payload:0:10000}\"}" \
                -o /dev/null -f --max-time 1 2>/dev/null; then
                ((failures++))
            fi
            
            if [ $((i % 100)) -eq 0 ]; then
                echo -n "."
            fi
        done
        echo ""
        
        # Check memory after stress
        final_mem=$(ps -o rss= -p "$gateway_pid" 2>/dev/null | awk '{print $1}' || echo 0)
        echo "  Final memory: $((final_mem/1024))MB"
        echo "  Memory increase: $(((final_mem-initial_mem)/1024))MB"
        echo "  Failed requests: $failures/1000"
        
        if [ $failures -lt 100 ]; then
            chaos_result "Resource Exhaustion" "SURVIVED"
        else
            chaos_result "Resource Exhaustion" "$failures/1000 requests failed"
        fi
    else
        chaos_result "Resource Exhaustion" "Gateway not found"
    fi
}

# ==============================================================================
# CHAOS SCENARIO 5: BYZANTINE FAILURES
# ==============================================================================

chaos_byzantine_failures() {
    log_scenario "BYZANTINE FAILURES - Malformed requests and attacks"
    
    echo "Sending byzantine requests..."
    
    local survived=0
    local total=10
    
    # Test 1: Extremely long URL
    long_url="$GATEWAY_URL/$(printf '%.0sa' {1..10000})"
    if timeout 2 curl -s -o /dev/null "$long_url" 2>/dev/null; [ $? -ne 0 ]; then
        ((survived++))
        echo "  ✓ Handled extremely long URL"
    fi
    
    # Test 2: Invalid UTF-8 in headers
    if timeout 2 curl -s -o /dev/null "$GATEWAY_URL/health" \
        -H $'X-Invalid: \x80\x81\x82' 2>/dev/null; [ $? -eq 0 ] || [ $? -eq 22 ]; then
        ((survived++))
        echo "  ✓ Handled invalid UTF-8 in headers"
    fi
    
    # Test 3: Null bytes in path
    if timeout 2 curl -s -o /dev/null "$GATEWAY_URL/api%00/test" 2>/dev/null; [ $? -ne 0 ]; then
        ((survived++))
        echo "  ✓ Handled null bytes in path"
    fi
    
    # Test 4: Infinite redirect attempt
    if timeout 2 curl -s -L --max-redirs 50 -o /dev/null \
        "$GATEWAY_URL/redirect-to?url=$GATEWAY_URL/redirect-to?url=$GATEWAY_URL" 2>/dev/null; [ $? -ne 0 ]; then
        ((survived++))
        echo "  ✓ Handled infinite redirect attempt"
    fi
    
    # Test 5: Slowloris attack simulation
    (
        exec 3<>/dev/tcp/localhost/8080
        echo -e "GET / HTTP/1.1\r\nHost: localhost\r\n" >&3
        for i in {1..100}; do
            echo -e "X-Header-$i: value\r\n" >&3
            sleep 0.1
        done
    ) 2>/dev/null &
    slowloris_pid=$!
    sleep 2
    
    if curl -s -o /dev/null -f --max-time 2 "$GATEWAY_URL/health" 2>/dev/null; then
        ((survived++))
        echo "  ✓ Still responsive during slowloris attack"
    fi
    kill $slowloris_pid 2>/dev/null || true
    
    # Test 6: Request smuggling attempt
    if printf 'GET / HTTP/1.1\r\nHost: localhost\r\nContent-Length: 5\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\n' | \
        timeout 2 nc localhost 8080 2>/dev/null | grep -q "400"; then
        ((survived++))
        echo "  ✓ Detected request smuggling attempt"
    fi
    
    # Test 7: Header injection
    if timeout 2 curl -s -o /dev/null "$GATEWAY_URL/health" \
        -H $'X-Injected: value\r\nX-Another: header' 2>/dev/null; [ $? -ne 0 ]; then
        ((survived++))
        echo "  ✓ Handled header injection"
    fi
    
    # Test 8: Method confusion
    if timeout 2 curl -X "GET POST PUT DELETE" -s -o /dev/null "$GATEWAY_URL/health" 2>/dev/null; [ $? -ne 0 ]; then
        ((survived++))
        echo "  ✓ Handled method confusion"
    fi
    
    # Test 9: Oversized headers
    huge_header=$(printf '%.0sA' {1..100000})
    if timeout 2 curl -s -o /dev/null "$GATEWAY_URL/health" \
        -H "X-Huge: $huge_header" 2>/dev/null; [ $? -ne 0 ]; then
        ((survived++))
        echo "  ✓ Rejected oversized headers"
    fi
    
    # Test 10: Protocol confusion
    if echo "NOT-HTTP garbage data" | timeout 2 nc localhost 8080 2>/dev/null | grep -q "400"; then
        ((survived++))
        echo "  ✓ Handled protocol confusion"
    fi
    
    echo "  Byzantine tests survived: $survived/$total"
    
    if [ $survived -ge 7 ]; then
        chaos_result "Byzantine Failures" "SURVIVED"
    else
        chaos_result "Byzantine Failures" "Only $survived/$total tests handled correctly"
    fi
}

# ==============================================================================
# CHAOS SCENARIO 6: TIME TRAVEL
# ==============================================================================

chaos_time_travel() {
    log_scenario "TIME TRAVEL - Clock skew and timing attacks"
    
    echo "Testing time-based chaos..."
    
    # Test rapid-fire requests to detect timing issues
    echo "  Sending 1000 requests in rapid succession..."
    
    response_times=()
    for i in {1..1000}; do
        start=$(date +%s%N)
        curl -s -o /dev/null "$GATEWAY_URL/health" 2>/dev/null
        end=$(date +%s%N)
        response_time=$(((end - start) / 1000000))
        response_times+=($response_time)
    done
    
    # Calculate statistics
    sorted_times=($(printf '%s\n' "${response_times[@]}" | sort -n))
    min_time=${sorted_times[0]}
    max_time=${sorted_times[-1]}
    median_time=${sorted_times[500]}
    
    echo "  Min response time: ${min_time}ms"
    echo "  Median response time: ${median_time}ms"
    echo "  Max response time: ${max_time}ms"
    echo "  Jitter: $((max_time - min_time))ms"
    
    # Check for timing attacks vulnerability
    if [ $((max_time - min_time)) -lt 1000 ]; then
        chaos_result "Time Travel (consistent timing)" "SURVIVED"
    else
        chaos_result "Time Travel" "High jitter detected: $((max_time - min_time))ms"
    fi
}

# ==============================================================================
# CHAOS SCENARIO 7: POISON PILL
# ==============================================================================

chaos_poison_pill() {
    log_scenario "POISON PILL - Requests that crash or hang services"
    
    echo "Injecting poison pills..."
    
    # Test various poison pill patterns
    poison_tests=0
    poison_survived=0
    
    # JSON bomb
    echo -n "  Testing JSON bomb... "
    json_bomb='{"a":' 
    for i in {1..1000}; do json_bomb="${json_bomb}{\"a\":"; done
    json_bomb="${json_bomb}null"
    for i in {1..1000}; do json_bomb="${json_bomb}}"; done
    
    if timeout 2 curl -s -X POST "$GATEWAY_URL/api/ml/analyze" \
        -H "Content-Type: application/json" \
        -d "$json_bomb" -o /dev/null 2>/dev/null; [ $? -ne 0 ]; then
        echo "survived"
        ((poison_survived++))
    else
        echo "vulnerable"
    fi
    ((poison_tests++))
    
    # XML entity expansion
    echo -n "  Testing XML entity expansion... "
    xml_bomb='<?xml version="1.0"?>
    <!DOCTYPE lolz [
      <!ENTITY lol "lol">
      <!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
      <!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">
    ]>
    <lolz>&lol3;</lolz>'
    
    if timeout 2 curl -s -X POST "$GATEWAY_URL/api/documentation/parse" \
        -H "Content-Type: application/xml" \
        -d "$xml_bomb" -o /dev/null 2>/dev/null; [ $? -ne 0 ]; then
        echo "survived"
        ((poison_survived++))
    else
        echo "vulnerable"
    fi
    ((poison_tests++))
    
    # Regex catastrophic backtracking
    echo -n "  Testing regex DoS... "
    regex_bomb="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab"
    if timeout 2 curl -s "$GATEWAY_URL/api/search?q=$regex_bomb" -o /dev/null 2>/dev/null; then
        echo "survived"
        ((poison_survived++))
    else
        echo "timeout"
    fi
    ((poison_tests++))
    
    # Infinite loop trigger
    echo -n "  Testing infinite loop trigger... "
    if timeout 2 curl -s "$GATEWAY_URL/api/calculate?n=999999999999999" -o /dev/null 2>/dev/null; then
        echo "survived"
        ((poison_survived++))
    else
        echo "timeout"
    fi
    ((poison_tests++))
    
    echo "  Poison pill tests survived: $poison_survived/$poison_tests"
    
    if [ $poison_survived -ge 3 ]; then
        chaos_result "Poison Pill" "SURVIVED"
    else
        chaos_result "Poison Pill" "Only $poison_survived/$poison_tests poison pills handled"
    fi
}

# ==============================================================================
# CHAOS SCENARIO 8: LOAD PATTERN CHAOS
# ==============================================================================

chaos_load_patterns() {
    log_scenario "LOAD PATTERN CHAOS - Unpredictable traffic patterns"
    
    echo "Generating chaotic load patterns..."
    
    # Pattern 1: Sawtooth (gradual increase, sudden drop)
    echo "  Pattern 1: Sawtooth wave..."
    for wave in {1..3}; do
        for load in 10 20 40 80 160; do
            for ((i=1; i<=load; i++)); do
                curl -s -o /dev/null "$GATEWAY_URL/health" &
            done
            sleep 0.5
        done
        sleep 1
    done
    wait
    
    # Pattern 2: Square wave (on/off pattern)
    echo "  Pattern 2: Square wave..."
    for cycle in {1..5}; do
        # Burst
        for i in {1..200}; do
            curl -s -o /dev/null "$GATEWAY_URL/health" &
        done
        sleep 1
        # Silence
        sleep 1
    done
    wait
    
    # Pattern 3: Random spikes
    echo "  Pattern 3: Random spikes..."
    for spike in {1..10}; do
        spike_size=$((RANDOM % 500 + 50))
        echo -n "    Spike of $spike_size requests... "
        
        for ((i=1; i<=spike_size; i++)); do
            curl -s -o /dev/null "$GATEWAY_URL/health" &
        done
        wait
        
        # Check if gateway still responsive
        if curl -s -o /dev/null -f --max-time 2 "$GATEWAY_URL/health"; then
            echo "handled"
        else
            echo "gateway unresponsive"
        fi
        
        sleep $((RANDOM % 3 + 1))
    done
    
    # Final health check
    if curl -s -o /dev/null -f --max-time 5 "$GATEWAY_URL/health"; then
        chaos_result "Load Pattern Chaos" "SURVIVED"
    else
        chaos_result "Load Pattern Chaos" "Gateway unresponsive after chaotic load"
    fi
}

# ==============================================================================
# FINAL REPORT
# ==============================================================================

generate_chaos_report() {
    echo -e "\n${MAGENTA}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${MAGENTA}║              CHAOS ENGINEERING REPORT                        ║${NC}"
    echo -e "${MAGENTA}╚═══════════════════════════════════════════════════════════════╝${NC}"
    
    local resilience_score=$((CHAOS_PASSED * 100 / CHAOS_TESTS))
    
    echo -e "\nChaos Scenarios Run: ${CHAOS_TESTS}"
    echo -e "${GREEN}Survived: ${CHAOS_PASSED}${NC}"
    echo -e "${RED}Failed: ${CHAOS_FAILED}${NC}"
    echo -e "Resilience Score: ${resilience_score}%"
    
    # Generate detailed report
    cat > "$RESULTS_DIR/chaos-report.json" <<EOF
{
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "gateway_url": "$GATEWAY_URL",
    "chaos_summary": {
        "total_scenarios": $CHAOS_TESTS,
        "survived": $CHAOS_PASSED,
        "failed": $CHAOS_FAILED,
        "resilience_score": $resilience_score
    },
    "scenarios_tested": [
        "thundering_herd",
        "cascading_failures",
        "network_partition",
        "resource_exhaustion",
        "byzantine_failures",
        "time_travel",
        "poison_pill",
        "load_patterns"
    ]
}
EOF
    
    echo -e "\nDetailed results saved to: ${YELLOW}$RESULTS_DIR/chaos-report.json${NC}"
    
    if [ $resilience_score -ge 75 ]; then
        echo -e "\n${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║         🛡️  SYSTEM IS CHAOS-RESISTANT! 🛡️                    ║${NC}"
        echo -e "${GREEN}║                                                               ║${NC}"
        echo -e "${GREEN}║  The API Gateway demonstrated strong resilience              ║${NC}"
        echo -e "${GREEN}║  against chaos engineering scenarios.                        ║${NC}"
        echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
    elif [ $resilience_score -ge 50 ]; then
        echo -e "\n${YELLOW}╔═══════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${YELLOW}║         ⚠️  MODERATE CHAOS RESISTANCE ⚠️                      ║${NC}"
        echo -e "${YELLOW}║                                                               ║${NC}"
        echo -e "${YELLOW}║  The system survived some scenarios but needs                ║${NC}"
        echo -e "${YELLOW}║  improvements for production resilience.                     ║${NC}"
        echo -e "${YELLOW}╚═══════════════════════════════════════════════════════════════╝${NC}"
    else
        echo -e "\n${RED}╔═══════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${RED}║         ❌ LOW CHAOS RESISTANCE ❌                            ║${NC}"
        echo -e "${RED}║                                                               ║${NC}"
        echo -e "${RED}║  The system needs significant hardening                      ║${NC}"
        echo -e "${RED}║  before production deployment.                               ║${NC}"
        echo -e "${RED}╚═══════════════════════════════════════════════════════════════╝${NC}"
    fi
}

# ==============================================================================
# MAIN EXECUTION
# ==============================================================================

main() {
    echo -e "${MAGENTA}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${MAGENTA}║         CHAOS ENGINEERING TEST SUITE                         ║${NC}"
    echo -e "${MAGENTA}║         Testing API Gateway Resilience                       ║${NC}"
    echo -e "${MAGENTA}║              $(date +"%Y-%m-%d %H:%M:%S")                        ║${NC}"
    echo -e "${MAGENTA}╚═══════════════════════════════════════════════════════════════╝${NC}"
    
    echo -e "\nTarget: ${YELLOW}$GATEWAY_URL${NC}"
    
    # Verify gateway is accessible before chaos
    if ! curl -s -o /dev/null -f --max-time 5 "$GATEWAY_URL/health"; then
        echo -e "\n${RED}ERROR: API Gateway not accessible at $GATEWAY_URL${NC}"
        echo "Cannot proceed with chaos engineering tests."
        exit 1
    fi
    
    echo -e "${GREEN}✓ Gateway is accessible - Initiating chaos...${NC}\n"
    
    log_chaos "WARNING: These tests will stress the system significantly!"
    log_chaos "Ensure you have backups and monitoring in place."
    echo ""
    
    # Run chaos scenarios
    chaos_thundering_herd
    chaos_cascading_failures
    chaos_network_partition
    chaos_resource_exhaustion
    chaos_byzantine_failures
    chaos_time_travel
    chaos_poison_pill
    chaos_load_patterns
    
    # Generate final report
    generate_chaos_report
}

# Check if we should run specific scenario or all
if [ $# -eq 1 ]; then
    case "$1" in
        thundering-herd) chaos_thundering_herd ;;
        cascading) chaos_cascading_failures ;;
        network) chaos_network_partition ;;
        resource) chaos_resource_exhaustion ;;
        byzantine) chaos_byzantine_failures ;;
        time) chaos_time_travel ;;
        poison) chaos_poison_pill ;;
        load) chaos_load_patterns ;;
        *) echo "Unknown scenario: $1"; exit 1 ;;
    esac
    generate_chaos_report
else
    main "$@"
fi