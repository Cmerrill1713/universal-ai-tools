#!/bin/bash
# Performance benchmarking script for Vision Resource Manager
# Validates Rust vs TypeScript performance improvements

set -e

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Test parameters
CONCURRENT_REQUESTS=${CONCURRENT_REQUESTS:-10}
TOTAL_REQUESTS=${TOTAL_REQUESTS:-100}
TEST_DURATION=${TEST_DURATION:-60}
HOST=${HOST:-localhost:3000}
OUTPUT_DIR=${OUTPUT_DIR:-"$SCRIPT_DIR/../results"}

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

# Create output directory
mkdir -p "$OUTPUT_DIR"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="$OUTPUT_DIR/benchmark_report_$TIMESTAMP.json"
SUMMARY_FILE="$OUTPUT_DIR/benchmark_summary_$TIMESTAMP.txt"

# Test payload for vision processing
create_test_payload() {
    cat << 'EOF'
{
  "action": "get_metrics",
  "include_gpu": true,
  "include_models": true,
  "include_tasks": true
}
EOF
}

# Individual endpoint performance test
test_endpoint_performance() {
    local endpoint="$1"
    local name="$2"
    local output_file="$OUTPUT_DIR/${name}_${TIMESTAMP}.json"
    
    log_info "Testing $name performance at $endpoint..."
    
    # Use Apache Bench for load testing
    if command -v ab >/dev/null 2>&1; then
        ab -n "$TOTAL_REQUESTS" -c "$CONCURRENT_REQUESTS" -g "$output_file.tsv" -e "$output_file.csv" \
           -H "Content-Type: application/json" \
           "$HOST$endpoint" > "$output_file.txt" 2>&1
    else
        log_warn "Apache Bench not available, using curl for basic testing"
        test_with_curl "$endpoint" "$name" "$output_file"
    fi
    
    # Parse results
    if [ -f "$output_file.txt" ]; then
        local rps=$(grep "Requests per second" "$output_file.txt" | awk '{print $4}')
        local mean_time=$(grep "Time per request" "$output_file.txt" | head -1 | awk '{print $4}')
        local p50_time=$(grep "50%" "$output_file.txt" | awk '{print $2}')
        local p95_time=$(grep "95%" "$output_file.txt" | awk '{print $2}')
        
        echo "{\"endpoint\":\"$name\",\"rps\":$rps,\"mean_time\":$mean_time,\"p50\":$p50_time,\"p95\":$p95_time}" >> "$REPORT_FILE.tmp"
        
        log_success "$name: $rps req/s, ${mean_time}ms avg, ${p95_time}ms p95"
    fi
}

# Fallback curl-based testing
test_with_curl() {
    local endpoint="$1"
    local name="$2" 
    local output_file="$3"
    
    local total_time=0
    local successful_requests=0
    local failed_requests=0
    
    for i in $(seq 1 "$TOTAL_REQUESTS"); do
        local start_time=$(date +%s.%N)
        
        if curl -s -f "$HOST$endpoint" > /dev/null; then
            ((successful_requests++))
        else
            ((failed_requests++))
        fi
        
        local end_time=$(date +%s.%N)
        local request_time=$(echo "$end_time - $start_time" | bc -l)
        total_time=$(echo "$total_time + $request_time" | bc -l)
    done
    
    local avg_time=$(echo "scale=3; $total_time * 1000 / $successful_requests" | bc -l)
    local rps=$(echo "scale=2; $successful_requests / $total_time" | bc -l)
    
    echo "{\"endpoint\":\"$name\",\"rps\":$rps,\"mean_time\":$avg_time,\"p50\":$avg_time,\"p95\":$avg_time}" >> "$REPORT_FILE.tmp"
    
    log_info "$name: $rps req/s, ${avg_time}ms avg (curl-based)"
}

# Comprehensive benchmark suite
run_comprehensive_benchmark() {
    log_info "Starting comprehensive benchmark suite..."
    log_info "Configuration: $TOTAL_REQUESTS requests, $CONCURRENT_REQUESTS concurrent, targeting $HOST"
    
    # Initialize report file
    echo "[" > "$REPORT_FILE.tmp"
    
    # Test individual backends
    test_endpoint_performance "/api/v1/vision/rust/metrics" "rust_backend"
    test_endpoint_performance "/api/v1/vision/typescript/metrics" "typescript_backend"
    test_endpoint_performance "/api/v1/vision/metrics" "load_balancer"
    test_endpoint_performance "/health" "health_check"
    
    # Test performance comparison endpoint
    log_info "Testing performance comparison endpoint..."
    local comparison_start=$(date +%s.%N)
    local comparison_result=$(curl -s "$HOST/performance-comparison" || echo '{"error": "unavailable"}')
    local comparison_end=$(date +%s.%N)
    local comparison_time=$(echo "($comparison_end - $comparison_start) * 1000" | bc -l)
    
    echo "{\"endpoint\":\"performance_comparison\",\"response_time\":$comparison_time,\"result\":$comparison_result}" >> "$REPORT_FILE.tmp"
    
    # Finalize report
    sed '$ s/$/]/' "$REPORT_FILE.tmp" | sed 's/}{/},{/g' > "$REPORT_FILE"
    rm "$REPORT_FILE.tmp"
    
    # Generate summary
    generate_benchmark_summary
    
    log_success "Benchmark completed. Results saved to $REPORT_FILE"
}

# Generate human-readable summary
generate_benchmark_summary() {
    cat > "$SUMMARY_FILE" << EOF
Vision Resource Manager Performance Benchmark Report
Generated: $(date)
Configuration: $TOTAL_REQUESTS requests, $CONCURRENT_REQUESTS concurrent
Target: $HOST

================================================

PERFORMANCE COMPARISON:
EOF
    
    # Extract key metrics from JSON report
    local rust_rps=$(jq -r '.[] | select(.endpoint=="rust_backend") | .rps' "$REPORT_FILE" 2>/dev/null || echo "N/A")
    local ts_rps=$(jq -r '.[] | select(.endpoint=="typescript_backend") | .rps' "$REPORT_FILE" 2>/dev/null || echo "N/A")
    local rust_p95=$(jq -r '.[] | select(.endpoint=="rust_backend") | .p95' "$REPORT_FILE" 2>/dev/null || echo "N/A")
    local ts_p95=$(jq -r '.[] | select(.endpoint=="typescript_backend") | .p95' "$REPORT_FILE" 2>/dev/null || echo "N/A")
    
    cat >> "$SUMMARY_FILE" << EOF

Rust Backend:
  - Requests/second: $rust_rps
  - 95th percentile: ${rust_p95}ms

TypeScript Backend:
  - Requests/second: $ts_rps  
  - 95th percentile: ${ts_p95}ms

EOF
    
    # Calculate speedup if both values are available
    if [[ "$rust_rps" != "N/A" && "$ts_rps" != "N/A" && "$rust_rps" != "null" && "$ts_rps" != "null" ]]; then
        local speedup=$(echo "scale=2; $rust_rps / $ts_rps" | bc -l 2>/dev/null || echo "N/A")
        echo "Performance Improvement: ${speedup}x faster" >> "$SUMMARY_FILE"
    fi
    
    cat >> "$SUMMARY_FILE" << EOF

RECOMMENDATIONS:
EOF
    
    # Add recommendations based on results
    if [[ "$rust_rps" != "N/A" && "$ts_rps" != "N/A" ]]; then
        local rust_num=$(echo "$rust_rps" | cut -d'.' -f1)
        local ts_num=$(echo "$ts_rps" | cut -d'.' -f1)
        
        if [ "$rust_num" -gt "$ts_num" ]; then
            echo "✓ Rust backend shows performance improvements - safe to increase traffic allocation" >> "$SUMMARY_FILE"
        else
            echo "⚠ Rust backend performance needs investigation before increasing traffic" >> "$SUMMARY_FILE"
        fi
    fi
    
    cat >> "$SUMMARY_FILE" << EOF

DETAILED RESULTS:
See $REPORT_FILE for complete JSON data

EOF
    
    log_info "Summary report generated: $SUMMARY_FILE"
}

# Stress test function
run_stress_test() {
    log_info "Running stress test for $TEST_DURATION seconds..."
    
    local stress_output="$OUTPUT_DIR/stress_test_$TIMESTAMP.txt"
    
    # High concurrency stress test
    if command -v ab >/dev/null 2>&1; then
        ab -t "$TEST_DURATION" -c "$((CONCURRENT_REQUESTS * 3))" \
           "$HOST/api/v1/vision/metrics" > "$stress_output" 2>&1
        
        local errors=$(grep -c "Failed requests" "$stress_output" || echo "0")
        local final_rps=$(grep "Requests per second" "$stress_output" | awk '{print $4}')
        
        log_info "Stress test completed: $final_rps req/s with $errors errors"
    else
        log_warn "Apache Bench not available for stress testing"
    fi
}

# Resource monitoring during tests
monitor_resources() {
    local duration="$1"
    local output_file="$OUTPUT_DIR/resource_monitor_$TIMESTAMP.csv"
    
    log_info "Starting resource monitoring for ${duration}s..."
    
    echo "timestamp,cpu_rust,cpu_ts,mem_rust,mem_ts" > "$output_file"
    
    for i in $(seq 1 "$duration"); do
        local timestamp=$(date +%s)
        
        # Get container resource usage
        local rust_cpu=$(docker stats --no-stream --format "{{.CPUPerc}}" vision-manager-rust 2>/dev/null | tr -d '%' || echo "0")
        local ts_cpu=$(docker stats --no-stream --format "{{.CPUPerc}}" vision-manager-typescript 2>/dev/null | tr -d '%' || echo "0")
        local rust_mem=$(docker stats --no-stream --format "{{.MemUsage}}" vision-manager-rust 2>/dev/null | cut -d'/' -f1 || echo "0")
        local ts_mem=$(docker stats --no-stream --format "{{.MemUsage}}" vision-manager-typescript 2>/dev/null | cut -d'/' -f1 || echo "0")
        
        echo "$timestamp,$rust_cpu,$ts_cpu,$rust_mem,$ts_mem" >> "$output_file"
        
        sleep 1
    done
    
    log_success "Resource monitoring completed: $output_file"
}

# Usage information
usage() {
    cat << EOF
Usage: $0 [OPTIONS] COMMAND

Commands:
    benchmark       Run comprehensive performance benchmark
    stress          Run stress test for extended duration
    monitor         Monitor resource usage during operation
    compare         Compare Rust vs TypeScript performance
    all             Run all tests (benchmark + stress + monitor)

Options:
    --requests NUM          Total requests to send (default: 100)
    --concurrent NUM        Concurrent requests (default: 10)
    --duration SECONDS      Test duration for stress test (default: 60)
    --host HOST:PORT        Target host (default: localhost:3000)
    --output-dir PATH       Output directory (default: ../results)
    --help                  Show this help message

Examples:
    $0 benchmark                        # Run standard benchmark
    $0 --requests 1000 benchmark        # High-load benchmark
    $0 stress                           # Stress test for 60 seconds
    $0 --duration 300 stress            # 5-minute stress test
    $0 all                              # Complete test suite
EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --requests)
            TOTAL_REQUESTS="$2"
            shift 2
            ;;
        --concurrent)
            CONCURRENT_REQUESTS="$2" 
            shift 2
            ;;
        --duration)
            TEST_DURATION="$2"
            shift 2
            ;;
        --host)
            HOST="$2"
            shift 2
            ;;
        --output-dir)
            OUTPUT_DIR="$2"
            mkdir -p "$OUTPUT_DIR"
            shift 2
            ;;
        benchmark)
            run_comprehensive_benchmark
            exit 0
            ;;
        stress)
            run_stress_test
            exit 0
            ;;
        monitor)
            monitor_resources "$TEST_DURATION"
            exit 0
            ;;
        compare)
            # Quick comparison test
            log_info "Running quick performance comparison..."
            test_endpoint_performance "/api/v1/vision/rust/metrics" "rust_backend"
            test_endpoint_performance "/api/v1/vision/typescript/metrics" "typescript_backend"
            generate_benchmark_summary
            exit 0
            ;;
        all)
            log_info "Running comprehensive test suite..."
            run_comprehensive_benchmark
            run_stress_test
            monitor_resources 30
            exit 0
            ;;
        --help|help)
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

# Default action if no command specified
usage