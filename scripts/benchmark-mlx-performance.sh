#!/bin/bash

# MLX Performance Benchmarking Script
# Comprehensive performance testing for LFM2 MLX migration
# Created: 2025-08-22

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BENCHMARK_DIR="/tmp/mlx-performance-benchmarks"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BENCHMARK_LOG="$BENCHMARK_DIR/benchmark_$TIMESTAMP.log"

# Test configuration
WARMUP_REQUESTS=5
BENCHMARK_REQUESTS=20
CONCURRENT_USERS=5
MLX_SERVICE_PORT=8004
GO_API_PORT=8080

# Test prompts of varying complexity
declare -a TEST_PROMPTS=(
    "2+2="
    "What is the capital of France?"
    "Explain machine learning in simple terms."
    "Write a short story about a robot learning to paint."
    "Analyze the economic implications of renewable energy adoption in developing countries, considering both environmental benefits and potential challenges for traditional energy sectors."
)

echo -e "${BLUE}⚡ MLX Performance Benchmarking Suite${NC}"
echo "=================================================="
echo "Timestamp: $(date)"
echo "Benchmark Directory: $BENCHMARK_DIR"
echo "Warmup Requests: $WARMUP_REQUESTS"
echo "Benchmark Requests: $BENCHMARK_REQUESTS"
echo "Concurrent Users: $CONCURRENT_USERS"
echo ""

mkdir -p "$BENCHMARK_DIR"

# Initialize benchmark log
cat > "$BENCHMARK_LOG" << EOF
MLX Performance Benchmark Results
Generated: $(date)
================================================

Configuration:
- Warmup Requests: $WARMUP_REQUESTS
- Benchmark Requests: $BENCHMARK_REQUESTS  
- Concurrent Users: $CONCURRENT_USERS
- MLX Service Port: $MLX_SERVICE_PORT
- API Gateway Port: $GO_API_PORT

EOF

# Performance tracking
declare -A METRICS

log_benchmark() {
    local status="$1"
    local test_name="$2"
    local details="$3"
    
    echo -e "[$status] $test_name: $details" | tee -a "$BENCHMARK_LOG"
    
    if [[ "$status" == "PASS" ]]; then
        echo -e "${GREEN}✅ $test_name${NC}: $details"
    elif [[ "$status" == "FAIL" ]]; then
        echo -e "${RED}❌ $test_name${NC}: $details"
    else
        echo -e "${YELLOW}📊 $test_name${NC}: $details"
    fi
}

# Check service availability
check_service_availability() {
    echo -e "\n${YELLOW}🔍 Checking Service Availability...${NC}"
    
    if curl -s --max-time 5 "http://localhost:$MLX_SERVICE_PORT/health" > /dev/null; then
        log_benchmark "PASS" "MLX Service Health" "Service responding on port $MLX_SERVICE_PORT"
    else
        log_benchmark "FAIL" "MLX Service Health" "Service not responding - start MLX service first"
        exit 1
    fi
    
    if curl -s --max-time 5 "http://localhost:$GO_API_PORT/health" > /dev/null; then
        log_benchmark "PASS" "API Gateway Health" "Service responding on port $GO_API_PORT"
    else
        log_benchmark "FAIL" "API Gateway Health" "Service not responding"
        exit 1
    fi
}

# Warmup phase
warmup_service() {
    echo -e "\n${YELLOW}🔥 Warming up MLX Service...${NC}"
    
    for i in $(seq 1 $WARMUP_REQUESTS); do
        local response=$(curl -s -X POST "http://localhost:$MLX_SERVICE_PORT/api/chat/completions" \
            -H "Content-Type: application/json" \
            -d '{"model": "lfm2:1.2b", "messages": [{"role": "user", "content": "warmup"}], "max_tokens": 10}' \
            --max-time 30 || echo "ERROR")
        
        if [[ "$response" == *"ERROR"* ]]; then
            log_benchmark "FAIL" "Warmup Request $i" "Failed"
        else
            echo -n "."
        fi
        sleep 1
    done
    
    echo ""
    log_benchmark "INFO" "Warmup Complete" "$WARMUP_REQUESTS requests completed"
}

# Single request performance test
test_single_request_performance() {
    local prompt="$1"
    local prompt_name="$2"
    
    echo -e "\n${BLUE}📝 Testing: $prompt_name${NC}"
    
    local times_file="$BENCHMARK_DIR/times_${prompt_name}_$TIMESTAMP.txt"
    local responses_file="$BENCHMARK_DIR/responses_${prompt_name}_$TIMESTAMP.json"
    
    echo "[]" > "$responses_file"
    
    local total_time=0
    local successful_requests=0
    local failed_requests=0
    
    for i in $(seq 1 $BENCHMARK_REQUESTS); do
        local start_time=$(date +%s%N)
        
        local response=$(curl -s -X POST "http://localhost:$MLX_SERVICE_PORT/api/chat/completions" \
            -H "Content-Type: application/json" \
            -d "{\"model\": \"lfm2:1.2b\", \"messages\": [{\"role\": \"user\", \"content\": \"$prompt\"}], \"max_tokens\": 100}" \
            --max-time 60 || echo "ERROR")
        
        local end_time=$(date +%s%N)
        local response_time=$((($end_time - $start_time) / 1000000))
        
        if [[ "$response" == *"ERROR"* ]]; then
            ((failed_requests++))
            echo "FAIL" >> "$times_file"
        else
            ((successful_requests++))
            echo "$response_time" >> "$times_file"
            total_time=$((total_time + response_time))
            
            # Save response data
            local response_data=$(echo "$response" | jq -c ". + {\"request_id\": $i, \"response_time_ms\": $response_time}")
            jq ". += [$response_data]" "$responses_file" > "${responses_file}.tmp" && mv "${responses_file}.tmp" "$responses_file"
        fi
        
        echo -n "."
        sleep 0.5
    done
    
    echo ""
    
    if [[ $successful_requests -gt 0 ]]; then
        local avg_time=$((total_time / successful_requests))
        local min_time=$(sort -n "$times_file" | grep -v FAIL | head -1)
        local max_time=$(sort -n "$times_file" | grep -v FAIL | tail -1)
        
        # Calculate percentiles
        local p50_time=$(sort -n "$times_file" | grep -v FAIL | awk 'BEGIN{c=0} {a[c++]=$1} END{print (c%2==0) ? (a[int(c/2)-1]+a[int(c/2)])/2 : a[int(c/2)]}')
        local p95_time=$(sort -n "$times_file" | grep -v FAIL | awk 'BEGIN{c=0} {a[c++]=$1} END{print a[int(c*0.95)]}')
        
        METRICS["${prompt_name}_avg_ms"]=$avg_time
        METRICS["${prompt_name}_min_ms"]=$min_time
        METRICS["${prompt_name}_max_ms"]=$max_time
        METRICS["${prompt_name}_p50_ms"]=$p50_time
        METRICS["${prompt_name}_p95_ms"]=$p95_time
        METRICS["${prompt_name}_success_rate"]=$(echo "scale=2; ($successful_requests / $BENCHMARK_REQUESTS) * 100" | bc -l)
        
        log_benchmark "METRICS" "$prompt_name Performance" "Avg: ${avg_time}ms, P50: ${p50_time}ms, P95: ${p95_time}ms, Min: ${min_time}ms, Max: ${max_time}ms"
        log_benchmark "METRICS" "$prompt_name Success Rate" "${METRICS["${prompt_name}_success_rate"]}% ($successful_requests/$BENCHMARK_REQUESTS)"
    else
        log_benchmark "FAIL" "$prompt_name Performance" "No successful requests"
    fi
}

# Concurrent load testing
test_concurrent_load() {
    echo -e "\n${BLUE}👥 Concurrent Load Testing${NC}"
    
    local concurrent_dir="$BENCHMARK_DIR/concurrent_$TIMESTAMP"
    mkdir -p "$concurrent_dir"
    
    local pids=()
    local test_prompt="What is artificial intelligence?"
    
    # Start concurrent requests
    for user_id in $(seq 1 $CONCURRENT_USERS); do
        (
            local user_times_file="$concurrent_dir/user_${user_id}_times.txt"
            local user_responses_file="$concurrent_dir/user_${user_id}_responses.json"
            echo "[]" > "$user_responses_file"
            
            for request_id in $(seq 1 10); do
                local start_time=$(date +%s%N)
                
                local response=$(curl -s -X POST "http://localhost:$MLX_SERVICE_PORT/api/chat/completions" \
                    -H "Content-Type: application/json" \
                    -d "{\"model\": \"lfm2:1.2b\", \"messages\": [{\"role\": \"user\", \"content\": \"$test_prompt (User $user_id, Request $request_id)\"}], \"max_tokens\": 50}" \
                    --max-time 45 || echo "ERROR")
                
                local end_time=$(date +%s%N)
                local response_time=$((($end_time - $start_time) / 1000000))
                
                if [[ "$response" != *"ERROR"* ]]; then
                    echo "$response_time" >> "$user_times_file"
                    local response_data=$(echo "$response" | jq -c ". + {\"user_id\": $user_id, \"request_id\": $request_id, \"response_time_ms\": $response_time}")
                    jq ". += [$response_data]" "$user_responses_file" > "${user_responses_file}.tmp" && mv "${user_responses_file}.tmp" "$user_responses_file"
                fi
                
                sleep 1
            done
        ) &
        pids+=($!)
    done
    
    # Wait for all concurrent users to complete
    echo "Waiting for $CONCURRENT_USERS concurrent users to complete..."
    for pid in "${pids[@]}"; do
        wait "$pid"
    done
    
    # Aggregate concurrent results
    local all_times_file="$concurrent_dir/all_times.txt"
    cat "$concurrent_dir"/user_*_times.txt > "$all_times_file"
    
    if [[ -s "$all_times_file" ]]; then
        local concurrent_avg=$(awk '{sum+=$1} END {print int(sum/NR)}' "$all_times_file")
        local concurrent_min=$(sort -n "$all_times_file" | head -1)
        local concurrent_max=$(sort -n "$all_times_file" | tail -1)
        local total_concurrent_requests=$(wc -l < "$all_times_file")
        
        METRICS["concurrent_avg_ms"]=$concurrent_avg
        METRICS["concurrent_min_ms"]=$concurrent_min
        METRICS["concurrent_max_ms"]=$concurrent_max
        METRICS["concurrent_total_requests"]=$total_concurrent_requests
        
        log_benchmark "METRICS" "Concurrent Load Performance" "Avg: ${concurrent_avg}ms, Min: ${concurrent_min}ms, Max: ${concurrent_max}ms"
        log_benchmark "METRICS" "Concurrent Load Volume" "$total_concurrent_requests total requests from $CONCURRENT_USERS users"
    else
        log_benchmark "FAIL" "Concurrent Load Test" "No successful concurrent requests"
    fi
}

# Memory usage monitoring
monitor_memory_usage() {
    echo -e "\n${BLUE}🧠 Memory Usage Monitoring${NC}"
    
    local memory_file="$BENCHMARK_DIR/memory_usage_$TIMESTAMP.txt"
    
    # Monitor memory for 30 seconds during active load
    (
        for i in $(seq 1 30); do
            local memory_usage=$(ps aux | grep '[m]lx-service' | awk '{print $6}' | head -1)
            if [[ -n "$memory_usage" ]]; then
                echo "$(date +%s) $memory_usage" >> "$memory_file"
            fi
            sleep 1
        done
    ) &
    local monitor_pid=$!
    
    # Generate load while monitoring
    for i in $(seq 1 10); do
        curl -s -X POST "http://localhost:$MLX_SERVICE_PORT/api/chat/completions" \
            -H "Content-Type: application/json" \
            -d '{"model": "lfm2:1.2b", "messages": [{"role": "user", "content": "Memory test request"}], "max_tokens": 20}' \
            --max-time 30 > /dev/null 2>&1 &
    done
    
    wait $monitor_pid
    
    if [[ -s "$memory_file" ]]; then
        local avg_memory=$(awk '{sum+=$2} END {print int(sum/NR)}' "$memory_file")
        local max_memory=$(awk 'BEGIN{max=0} {if($2>max) max=$2} END{print max}' "$memory_file")
        
        METRICS["avg_memory_kb"]=$avg_memory
        METRICS["max_memory_kb"]=$max_memory
        
        log_benchmark "METRICS" "Memory Usage" "Avg: ${avg_memory}KB, Peak: ${max_memory}KB"
    else
        log_benchmark "WARN" "Memory Monitoring" "Could not capture memory usage data"
    fi
}

# Generate comprehensive performance report
generate_performance_report() {
    echo -e "\n${BLUE}📊 Generating Performance Report${NC}"
    
    local report_file="$BENCHMARK_DIR/performance_report_$TIMESTAMP.json"
    
    cat > "$report_file" << EOF
{
  "benchmark_metadata": {
    "timestamp": "$(date -Iseconds)",
    "service": "mlx-lfm2",
    "test_configuration": {
      "warmup_requests": $WARMUP_REQUESTS,
      "benchmark_requests": $BENCHMARK_REQUESTS,
      "concurrent_users": $CONCURRENT_USERS,
      "service_port": $MLX_SERVICE_PORT
    }
  },
  "performance_metrics": {
EOF
    
    # Add metrics to JSON
    local first=true
    for key in "${!METRICS[@]}"; do
        if [[ "$first" == "true" ]]; then
            first=false
        else
            echo "," >> "$report_file"
        fi
        echo "    \"$key\": \"${METRICS[$key]}\"" >> "$report_file"
    done
    
    cat >> "$report_file" << EOF
  },
  "performance_analysis": {
    "response_time_grade": "$(get_performance_grade "${METRICS[simple_avg_ms]:-1000}")",
    "throughput_assessment": "$(assess_throughput)",
    "memory_efficiency": "$(assess_memory_efficiency)",
    "concurrent_handling": "$(assess_concurrent_performance)"
  },
  "recommendations": [
    "$(generate_recommendations)"
  ]
}
EOF
    
    log_benchmark "INFO" "Performance Report" "Saved to $report_file"
    
    # Display summary
    echo -e "\n${GREEN}🎯 Performance Summary${NC}"
    echo "======================"
    
    for key in "${!METRICS[@]}"; do
        echo -e "  $key: ${METRICS[$key]}"
    done
}

# Helper functions for analysis
get_performance_grade() {
    local avg_time=$1
    if (( avg_time < 100 )); then
        echo "Excellent"
    elif (( avg_time < 500 )); then
        echo "Good"
    elif (( avg_time < 1000 )); then
        echo "Fair"
    else
        echo "Poor"
    fi
}

assess_throughput() {
    local concurrent_total=${METRICS[concurrent_total_requests]:-0}
    if (( concurrent_total > 40 )); then
        echo "High throughput capability"
    elif (( concurrent_total > 20 )); then
        echo "Moderate throughput capability"
    else
        echo "Limited throughput capability"
    fi
}

assess_memory_efficiency() {
    local max_mem=${METRICS[max_memory_kb]:-0}
    if (( max_mem < 100000 )); then
        echo "Excellent memory efficiency"
    elif (( max_mem < 500000 )); then
        echo "Good memory efficiency"
    else
        echo "High memory usage - optimization recommended"
    fi
}

assess_concurrent_performance() {
    local concurrent_avg=${METRICS[concurrent_avg_ms]:-1000}
    local single_avg=${METRICS[simple_avg_ms]:-1000}
    
    if (( concurrent_avg < single_avg * 2 )); then
        echo "Excellent concurrent scaling"
    elif (( concurrent_avg < single_avg * 3 )); then
        echo "Good concurrent scaling"
    else
        echo "Poor concurrent scaling - review needed"
    fi
}

generate_recommendations() {
    local recommendations=()
    
    local simple_avg=${METRICS[simple_avg_ms]:-1000}
    if (( simple_avg > 500 )); then
        recommendations+=("Consider model optimization for faster inference")
    fi
    
    local max_mem=${METRICS[max_memory_kb]:-0}
    if (( max_mem > 500000 )); then
        recommendations+=("Optimize memory usage - current peak: ${max_mem}KB")
    fi
    
    local success_rate=${METRICS[simple_success_rate]:-0}
    if (( $(echo "$success_rate < 95" | bc -l) )); then
        recommendations+=("Improve reliability - current success rate: ${success_rate}%")
    fi
    
    if [[ ${#recommendations[@]} -eq 0 ]]; then
        echo "No immediate optimizations needed - performance is good"
    else
        printf "%s, " "${recommendations[@]}" | sed 's/, $//'
    fi
}

# Main execution
main() {
    check_service_availability
    warmup_service
    
    # Test different prompt complexities
    test_single_request_performance "2+2=" "simple"
    test_single_request_performance "What is the capital of France?" "moderate"
    test_single_request_performance "Explain machine learning in simple terms." "complex"
    
    test_concurrent_load
    monitor_memory_usage
    generate_performance_report
    
    echo -e "\n${GREEN}🏁 MLX Performance Benchmarking Complete${NC}"
    echo "========================================="
    echo -e "Results directory: ${BLUE}$BENCHMARK_DIR${NC}"
    echo -e "Benchmark log: ${BLUE}$BENCHMARK_LOG${NC}"
    echo -e "Performance report: ${BLUE}$BENCHMARK_DIR/performance_report_$TIMESTAMP.json${NC}"
}

# Execute main function
main "$@"