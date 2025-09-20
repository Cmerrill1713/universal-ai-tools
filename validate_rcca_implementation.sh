#!/bin/bash

# RCCA Implementation Validation Script
# This script validates that all corrective actions from the RCCA process are working correctly

echo "🔍 RCCA Implementation Validation Script"
echo "========================================"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "PASS")
            echo -e "${GREEN}✅ PASS${NC}: $message"
            ;;
        "FAIL")
            echo -e "${RED}❌ FAIL${NC}: $message"
            ;;
        "WARN")
            echo -e "${YELLOW}⚠️  WARN${NC}: $message"
            ;;
        "INFO")
            echo -e "${BLUE}ℹ️  INFO${NC}: $message"
            ;;
    esac
}

# Function to check if a service is healthy
check_service_health() {
    local service_name=$1
    local port=$2
    local health_endpoint=$3

    if [ -z "$health_endpoint" ]; then
        health_endpoint="/health"
    fi

    local response=$(curl -s -w "%{http_code}" -o /dev/null "http://localhost:$port$health_endpoint" 2>/dev/null)

    if [ "$response" = "200" ]; then
        print_status "PASS" "$service_name (port $port) is healthy"
        return 0
    else
        print_status "FAIL" "$service_name (port $port) is unhealthy (HTTP $response)"
        return 1
    fi
}

# Function to check API Gateway health status
check_api_gateway_health() {
    local response=$(curl -s "http://localhost:8080/health" 2>/dev/null)
    local healthy_count=$(echo "$response" | jq '.services | to_entries | map(select(.value == true)) | length' 2>/dev/null)
    local total_count=$(echo "$response" | jq '.services | length' 2>/dev/null)

    if [ -n "$healthy_count" ] && [ -n "$total_count" ]; then
        local percentage=$((healthy_count * 100 / total_count))
        print_status "INFO" "API Gateway reports $healthy_count/$total_count services healthy ($percentage%)"

        if [ $percentage -ge 80 ]; then
            print_status "PASS" "Service health percentage meets target (≥80%)"
            return 0
        else
            print_status "WARN" "Service health percentage below target (<80%)"
            return 1
        fi
    else
        print_status "FAIL" "Failed to get API Gateway health status"
        return 1
    fi
}

# Function to check health check timing improvements
check_health_check_timing() {
    print_status "INFO" "Testing health check timing improvements..."

    # Test manual health check refresh
    local refresh_response=$(curl -s -w "%{http_code}" -o /dev/null -X POST "http://localhost:8080/health/refresh" 2>/dev/null)

    if [ "$refresh_response" = "200" ]; then
        print_status "PASS" "Manual health check refresh endpoint is working"
    else
        print_status "WARN" "Manual health check refresh endpoint not available (HTTP $refresh_response)"
    fi
}

# Function to validate created services
validate_created_services() {
    print_status "INFO" "Validating created services..."

    # Check Fast LLM Service
    if check_service_health "Fast LLM Service" "3030" "/health"; then
        print_status "PASS" "Fast LLM Service created successfully"
    else
        print_status "FAIL" "Fast LLM Service creation failed"
    fi

    # Check LLM Router Service
    if check_service_health "LLM Router Service" "3040" "/health"; then
        print_status "PASS" "LLM Router Service created successfully"
    else
        print_status "FAIL" "LLM Router Service creation failed"
    fi
}

# Function to check port configurations
check_port_configurations() {
    print_status "INFO" "Checking port configurations..."

    # Check for port conflicts
    local ports=("3030" "3040" "3032" "8084" "8094" "8090" "8080")
    local conflicts=0

    for port in "${ports[@]}"; do
        local count=$(lsof -i ":$port" 2>/dev/null | wc -l)
        if [ $count -gt 1 ]; then
            print_status "WARN" "Port $port has multiple processes (potential conflict)"
            ((conflicts++))
        else
            print_status "PASS" "Port $port configuration is clean"
        fi
    done

    if [ $conflicts -eq 0 ]; then
        print_status "PASS" "No port conflicts detected"
    else
        print_status "WARN" "$conflicts port conflicts detected"
    fi
}

# Function to validate documentation
validate_documentation() {
    print_status "INFO" "Validating documentation..."

    local docs=("RCCA_ANALYSIS_REPORT.md" "SERVICE_MONITORING_SYSTEM.md" "SERVICE_ARCHITECTURE_DOCUMENTATION.md")
    local missing=0

    for doc in "${docs[@]}"; do
        if [ -f "$doc" ]; then
            print_status "PASS" "Documentation file $doc exists"
        else
            print_status "FAIL" "Documentation file $doc is missing"
            ((missing++))
        fi
    done

    if [ $missing -eq 0 ]; then
        print_status "PASS" "All documentation files present"
    else
        print_status "WARN" "$missing documentation files missing"
    fi
}

# Function to run comprehensive health checks
run_comprehensive_health_checks() {
    print_status "INFO" "Running comprehensive health checks..."

    # Core services
    check_service_health "API Gateway" "8080" "/health"
    check_service_health "Auth Service" "8010" "/health"
    check_service_health "Cache Coordinator" "8011" "/health"
    check_service_health "Metrics Aggregator" "8015" "/health"
    check_service_health "Chat Service" "8016" "/health"
    check_service_health "Memory Service" "8017" "/health"
    check_service_health "WebSocket Hub" "8018" "/health"
    check_service_health "Weaviate Client" "8019" "/health"

    # AI/ML services
    check_service_health "Fast LLM Service" "3030" "/health"
    check_service_health "LLM Router Service" "3040" "/health"
    check_service_health "Parameter Analytics" "3032" "/health"
    check_service_health "ML Inference Service" "8084" "/health"

    # Infrastructure services
    check_service_health "Service Discovery" "8094" "/api/v1/discovery/health"
    check_service_health "Weaviate Database" "8090" "/v1/meta"
    check_service_health "Legacy API" "3001" "/health"
}

# Main validation function
main() {
    echo "Starting RCCA implementation validation..."
    echo ""

    local total_tests=0
    local passed_tests=0
    local failed_tests=0
    local warning_tests=0

    # Test 1: API Gateway Health Status
    echo "1. Testing API Gateway Health Status"
    echo "------------------------------------"
    if check_api_gateway_health; then
        ((passed_tests++))
    else
        ((failed_tests++))
    fi
    ((total_tests++))
    echo ""

    # Test 2: Created Services Validation
    echo "2. Validating Created Services"
    echo "-----------------------------"
    validate_created_services
    echo ""

    # Test 3: Port Configuration Check
    echo "3. Checking Port Configurations"
    echo "-------------------------------"
    check_port_configurations
    echo ""

    # Test 4: Health Check Timing Improvements
    echo "4. Testing Health Check Timing Improvements"
    echo "-------------------------------------------"
    check_health_check_timing
    echo ""

    # Test 5: Documentation Validation
    echo "5. Validating Documentation"
    echo "--------------------------"
    validate_documentation
    echo ""

    # Test 6: Comprehensive Health Checks
    echo "6. Running Comprehensive Health Checks"
    echo "-------------------------------------"
    run_comprehensive_health_checks
    echo ""

    # Summary
    echo "========================================"
    echo "RCCA Implementation Validation Summary"
    echo "========================================"
    echo "Total Tests: $total_tests"
    echo -e "${GREEN}Passed: $passed_tests${NC}"
    echo -e "${RED}Failed: $failed_tests${NC}"
    echo -e "${YELLOW}Warnings: $warning_tests${NC}"
    echo ""

    if [ $failed_tests -eq 0 ]; then
        print_status "PASS" "RCCA implementation validation completed successfully!"
        exit 0
    else
        print_status "FAIL" "RCCA implementation validation completed with failures"
        exit 1
    fi
}

# Run the validation
main "$@"
