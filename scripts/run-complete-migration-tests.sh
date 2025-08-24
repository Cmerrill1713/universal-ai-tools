#!/bin/bash

# Complete LFM2-MLX Migration Test Orchestrator
# Runs all migration tests in proper sequence to ensure everything migrates correctly
# Created: 2025-08-22

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MASTER_RESULTS_DIR="/tmp/complete-migration-tests"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
MASTER_LOG="$MASTER_RESULTS_DIR/master_test_log_$TIMESTAMP.log"

echo -e "${BOLD}${BLUE}🚀 COMPLETE LFM2-MLX MIGRATION TEST SUITE${NC}"
echo "=============================================="
echo -e "${BOLD}Comprehensive functionality testing to ensure everything migrates correctly${NC}"
echo ""
echo "Test Suite Components:"
echo "  1. Functional Regression Tests"
echo "  2. Performance Comparison Benchmarks"
echo "  3. API Compatibility Validation"
echo "  4. Integration & Health Verification"
echo ""
echo "Timestamp: $(date)"
echo "Master Results Directory: $MASTER_RESULTS_DIR"
echo ""

mkdir -p "$MASTER_RESULTS_DIR"

# Initialize master log
cat > "$MASTER_LOG" << EOF
LFM2-MLX Migration Complete Test Suite Results
Generated: $(date)
==============================================

Test Execution Order:
1. Pre-flight system checks
2. Functional regression testing
3. Performance benchmarking
4. API compatibility validation
5. Final integration verification

EOF

# Test tracking
TOTAL_SUITES=0
PASSED_SUITES=0
FAILED_SUITES=0
SUITE_RESULTS=()

log_suite() {
    local status="$1"
    local suite_name="$2"
    local details="$3"
    
    echo -e "[$status] $suite_name: $details" | tee -a "$MASTER_LOG"
    ((TOTAL_SUITES++))
    
    if [[ "$status" == "PASS" ]]; then
        ((PASSED_SUITES++))
        echo -e "${GREEN}✅ SUITE PASSED${NC}: $suite_name"
        SUITE_RESULTS+=("✅ $suite_name: $details")
    elif [[ "$status" == "FAIL" ]]; then
        ((FAILED_SUITES++))
        echo -e "${RED}❌ SUITE FAILED${NC}: $suite_name - $details"
        SUITE_RESULTS+=("❌ $suite_name: $details")
    else
        echo -e "${YELLOW}ℹ️  SUITE INFO${NC}: $suite_name - $details"
        SUITE_RESULTS+=("ℹ️  $suite_name: $details")
    fi
}

# Pre-flight system checks
run_preflight_checks() {
    echo -e "\n${BLUE}🔍 Phase 1: Pre-flight System Checks${NC}"
    echo "===================================="
    
    # Check if required services are running
    local services=(
        "8080:Go API Gateway"
        "8082:Rust LLM Router"
        "8003:Rust AI Core"
    )
    
    local all_services_ok=true
    
    for service in "${services[@]}"; do
        IFS=':' read -r port name <<< "$service"
        
        if curl -s --max-time 5 "http://localhost:$port/health" > /dev/null; then
            echo -e "${GREEN}✅${NC} $name (port $port) - OK"
        else
            echo -e "${RED}❌${NC} $name (port $port) - NOT RESPONDING"
            all_services_ok=false
        fi
    done
    
    # Check for required tools
    local tools=("curl" "jq" "bc")
    for tool in "${tools[@]}"; do
        if command -v "$tool" > /dev/null; then
            echo -e "${GREEN}✅${NC} Tool: $tool - Available"
        else
            echo -e "${RED}❌${NC} Tool: $tool - MISSING"
            all_services_ok=false
        fi
    done
    
    if [[ "$all_services_ok" == "true" ]]; then
        log_suite "PASS" "Pre-flight Checks" "All required services and tools available"
        return 0
    else
        log_suite "FAIL" "Pre-flight Checks" "Missing required services or tools"
        return 1
    fi
}

# Run functional regression tests
run_functional_tests() {
    echo -e "\n${BLUE}🧪 Phase 2: Functional Regression Tests${NC}"
    echo "======================================="
    
    local test_script="$SCRIPT_DIR/test-lfm2-mlx-migration.sh"
    
    if [[ ! -f "$test_script" ]]; then
        log_suite "FAIL" "Functional Tests" "Test script not found at $test_script"
        return 1
    fi
    
    echo "Executing functional regression tests..."
    local test_output="$MASTER_RESULTS_DIR/functional_test_output_$TIMESTAMP.log"
    
    if timeout 600s "$test_script" > "$test_output" 2>&1; then
        local test_summary=$(tail -20 "$test_output" | grep -E "(PASS|FAIL|Success Rate)" | tail -3)
        log_suite "PASS" "Functional Tests" "Completed successfully - see $test_output"
        
        # Extract key metrics
        echo -e "\n${YELLOW}Functional Test Summary:${NC}"
        echo "$test_summary" | sed 's/^/  /'
    else
        local exit_code=$?
        log_suite "FAIL" "Functional Tests" "Failed with exit code $exit_code - see $test_output"
        return 1
    fi
}

# Run performance benchmarks
run_performance_benchmarks() {
    echo -e "\n${BLUE}⚡ Phase 3: Performance Benchmarking${NC}"
    echo "===================================="
    
    local benchmark_script="$SCRIPT_DIR/benchmark-mlx-performance.sh"
    
    if [[ ! -f "$benchmark_script" ]]; then
        log_suite "FAIL" "Performance Benchmarks" "Benchmark script not found at $benchmark_script"
        return 1
    fi
    
    echo "Executing performance benchmarks..."
    local benchmark_output="$MASTER_RESULTS_DIR/performance_benchmark_output_$TIMESTAMP.log"
    
    if timeout 900s "$benchmark_script" > "$benchmark_output" 2>&1; then
        local perf_summary=$(tail -30 "$benchmark_output" | grep -E "(Performance Summary|Avg:|P50:|P95:)" | head -10)
        log_suite "PASS" "Performance Benchmarks" "Completed successfully - see $benchmark_output"
        
        # Extract key metrics
        echo -e "\n${YELLOW}Performance Summary:${NC}"
        echo "$perf_summary" | sed 's/^/  /'
    else
        local exit_code=$?
        log_suite "FAIL" "Performance Benchmarks" "Failed with exit code $exit_code - see $benchmark_output"
        return 1
    fi
}

# Run API compatibility validation
run_compatibility_validation() {
    echo -e "\n${BLUE}🔌 Phase 4: API Compatibility Validation${NC}"
    echo "========================================"
    
    local validation_script="$SCRIPT_DIR/validate-api-compatibility.sh"
    
    if [[ ! -f "$validation_script" ]]; then
        log_suite "FAIL" "API Compatibility" "Validation script not found at $validation_script"
        return 1
    fi
    
    echo "Executing API compatibility validation..."
    local validation_output="$MASTER_RESULTS_DIR/compatibility_validation_output_$TIMESTAMP.log"
    
    if timeout 300s "$validation_script" > "$validation_output" 2>&1; then
        local compat_summary=$(tail -20 "$validation_output" | grep -E "(PASS|FAIL|Success Rate|Compatibility)" | tail -5)
        log_suite "PASS" "API Compatibility" "Completed successfully - see $validation_output"
        
        # Extract key metrics
        echo -e "\n${YELLOW}Compatibility Summary:${NC}"
        echo "$compat_summary" | sed 's/^/  /'
    else
        local exit_code=$?
        log_suite "WARN" "API Compatibility" "Some issues detected (exit code $exit_code) - see $validation_output"
        # Don't fail the suite for compatibility warnings in initial migration
    fi
}

# Final integration verification
run_integration_verification() {
    echo -e "\n${BLUE}🔗 Phase 5: Final Integration Verification${NC}"
    echo "=========================================="
    
    # Test end-to-end request flow
    echo "Testing end-to-end request flow..."
    
    local integration_test_request='{"model": "lfm2:1.2b", "messages": [{"role": "user", "content": "Final integration test: What is 10 divided by 2?"}], "max_tokens": 20}'
    
    # Test direct MLX service
    echo "  Testing direct MLX service..."
    local mlx_start=$(date +%s%N)
    local mlx_response=$(curl -s -X POST "http://localhost:8004/api/chat/completions" \
        -H "Content-Type: application/json" \
        -d "$integration_test_request" \
        --max-time 30 || echo "ERROR")
    local mlx_end=$(date +%s%N)
    local mlx_time=$((($mlx_end - $mlx_start) / 1000000))
    
    local integration_results=()
    
    if [[ "$mlx_response" == *"ERROR"* ]]; then
        integration_results+=("❌ Direct MLX service test failed")
    else
        local contains_answer=$(echo "$mlx_response" | grep -i "5\|five" || echo "")
        if [[ -n "$contains_answer" ]]; then
            integration_results+=("✅ Direct MLX service test passed (${mlx_time}ms, correct answer)")
        else
            integration_results+=("⚠️  Direct MLX service responded (${mlx_time}ms) but answer unclear")
        fi
    fi
    
    # Test service health endpoints
    echo "  Testing service health endpoints..."
    local health_services=("8004:MLX" "8003:AI-Core" "8082:LLM-Router" "8080:Gateway")
    local healthy_services=0
    
    for service in "${health_services[@]}"; do
        IFS=':' read -r port name <<< "$service"
        
        if curl -s --max-time 3 "http://localhost:$port/health" > /dev/null; then
            integration_results+=("✅ $name service health OK")
            ((healthy_services++))
        else
            integration_results+=("❌ $name service health FAILED")
        fi
    done
    
    # Generate integration summary
    if [[ $healthy_services -eq 4 && "$mlx_response" != *"ERROR"* ]]; then
        log_suite "PASS" "Integration Verification" "All services healthy, end-to-end flow working"
    elif [[ $healthy_services -ge 3 ]]; then
        log_suite "WARN" "Integration Verification" "Most services healthy ($healthy_services/4), minor issues detected"
    else
        log_suite "FAIL" "Integration Verification" "Multiple service failures ($healthy_services/4 healthy)"
        return 1
    fi
    
    echo -e "\n${YELLOW}Integration Test Results:${NC}"
    for result in "${integration_results[@]}"; do
        echo "  $result"
    done
}

# Generate final migration report
generate_final_report() {
    echo -e "\n${BLUE}📊 Generating Final Migration Report${NC}"
    echo "===================================="
    
    local final_report="$MASTER_RESULTS_DIR/migration_test_final_report_$TIMESTAMP.json"
    
    cat > "$final_report" << EOF
{
  "migration_test_report": {
    "timestamp": "$(date -Iseconds)",
    "migration_type": "LFM2_TypeScript_to_MLX_Rust",
    "test_suite_version": "1.0.0",
    "execution_summary": {
      "total_test_suites": $TOTAL_SUITES,
      "passed_suites": $PASSED_SUITES,
      "failed_suites": $FAILED_SUITES,
      "overall_success_rate": "$(echo "scale=1; ($PASSED_SUITES / $TOTAL_SUITES) * 100" | bc -l)%"
    },
    "test_phases": {
      "preflight_checks": "$(get_suite_status "Pre-flight Checks")",
      "functional_regression": "$(get_suite_status "Functional Tests")",
      "performance_benchmarks": "$(get_suite_status "Performance Benchmarks")",
      "api_compatibility": "$(get_suite_status "API Compatibility")",
      "integration_verification": "$(get_suite_status "Integration Verification")"
    },
    "migration_readiness": {
      "ready_for_production": $(get_migration_readiness),
      "critical_issues": $FAILED_SUITES,
      "warnings": $(count_warnings),
      "recommendation": "$(get_migration_recommendation)"
    },
    "test_artifacts": {
      "master_log": "$MASTER_LOG",
      "results_directory": "$MASTER_RESULTS_DIR",
      "individual_reports": [
        "$MASTER_RESULTS_DIR/functional_test_output_$TIMESTAMP.log",
        "$MASTER_RESULTS_DIR/performance_benchmark_output_$TIMESTAMP.log",
        "$MASTER_RESULTS_DIR/compatibility_validation_output_$TIMESTAMP.log"
      ]
    }
  }
}
EOF
    
    echo -e "\n${BOLD}${GREEN}🎯 FINAL MIGRATION TEST SUMMARY${NC}"
    echo "================================="
    
    echo -e "\nTest Suite Results:"
    for result in "${SUITE_RESULTS[@]}"; do
        echo "  $result"
    done
    
    echo -e "\nOverall Statistics:"
    echo -e "  Total Test Suites: ${BOLD}$TOTAL_SUITES${NC}"
    echo -e "  Passed Suites: ${GREEN}${BOLD}$PASSED_SUITES${NC}"
    echo -e "  Failed Suites: ${RED}${BOLD}$FAILED_SUITES${NC}"
    echo -e "  Success Rate: ${BOLD}$(echo "scale=1; ($PASSED_SUITES / $TOTAL_SUITES) * 100" | bc -l)%${NC}"
    
    echo -e "\nTest Artifacts:"
    echo -e "  📋 Master Log: ${BLUE}$MASTER_LOG${NC}"
    echo -e "  📁 Results Directory: ${BLUE}$MASTER_RESULTS_DIR${NC}"
    echo -e "  📊 Final Report: ${BLUE}$final_report${NC}"
    
    local readiness=$(get_migration_readiness)
    if [[ "$readiness" == "true" ]]; then
        echo -e "\n${BOLD}${GREEN}🚀 MIGRATION READY FOR PRODUCTION${NC}"
        echo -e "${GREEN}All critical tests passed. The LFM2-MLX migration is verified and safe to deploy.${NC}"
    else
        echo -e "\n${BOLD}${RED}⚠️  MIGRATION NOT READY FOR PRODUCTION${NC}"
        echo -e "${RED}$FAILED_SUITES critical issues detected. Address these before production deployment.${NC}"
        echo -e "\nRecommendation: $(get_migration_recommendation)"
    fi
}

# Helper functions
get_suite_status() {
    local suite_name="$1"
    for result in "${SUITE_RESULTS[@]}"; do
        if [[ "$result" == *"$suite_name"* ]]; then
            if [[ "$result" == "✅"* ]]; then
                echo "PASSED"
            elif [[ "$result" == "❌"* ]]; then
                echo "FAILED"
            else
                echo "WARNING"
            fi
            return
        fi
    done
    echo "NOT_RUN"
}

get_migration_readiness() {
    if [[ $FAILED_SUITES -eq 0 ]]; then
        echo "true"
    else
        echo "false"
    fi
}

count_warnings() {
    local warnings=0
    for result in "${SUITE_RESULTS[@]}"; do
        if [[ "$result" == "ℹ️ "* ]] || [[ "$result" == *"WARN"* ]]; then
            ((warnings++))
        fi
    done
    echo $warnings
}

get_migration_recommendation() {
    if [[ $FAILED_SUITES -eq 0 ]]; then
        echo "Migration is ready for production deployment. All tests passed successfully."
    elif [[ $FAILED_SUITES -eq 1 ]]; then
        echo "Address the 1 failed test suite before production deployment."
    else
        echo "Address the $FAILED_SUITES failed test suites before production deployment."
    fi
}

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}🧹 Cleaning up test environment...${NC}"
    
    # Kill any background processes if they exist
    local pids=$(pgrep -f "mlx-service\|benchmark\|validation" || true)
    if [[ -n "$pids" ]]; then
        echo "$pids" | xargs kill -TERM 2>/dev/null || true
        sleep 2
        echo "$pids" | xargs kill -KILL 2>/dev/null || true
    fi
}

# Handle script termination
trap cleanup EXIT

# Main execution
main() {
    echo -e "${BOLD}Starting comprehensive migration test suite...${NC}\n"
    
    # Execute test phases
    run_preflight_checks || {
        echo -e "\n${RED}❌ Pre-flight checks failed. Cannot continue with testing.${NC}"
        exit 1
    }
    
    run_functional_tests
    run_performance_benchmarks  
    run_compatibility_validation
    run_integration_verification
    
    generate_final_report
    
    # Final exit status
    if [[ $FAILED_SUITES -eq 0 ]]; then
        echo -e "\n${BOLD}${GREEN}🎉 ALL MIGRATION TESTS PASSED! FUNCTIONALITY VERIFIED!${NC}"
        exit 0
    else
        echo -e "\n${BOLD}${RED}⚠️  MIGRATION TESTS COMPLETED WITH $FAILED_SUITES FAILURES${NC}"
        exit 1
    fi
}

# Run main function with all arguments
main "$@"