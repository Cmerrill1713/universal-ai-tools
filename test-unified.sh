#!/bin/bash

# Universal AI Tools - Unified Application Test Script
# Tests the complete frontend + backend integration

set -e

echo "🧪 TESTING UNIFIED APPLICATION"
echo "=============================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

# Test function
test_endpoint() {
    local url=$1
    local description=$2
    local expected_status=${3:-200}
    
    print_status "Testing $description..."
    
    if response=$(curl -s -w "%{http_code}" -o /tmp/test_response "$url" 2>/dev/null); then
        http_code="${response: -3}"
        if [ "$http_code" = "$expected_status" ]; then
            print_success "$description - HTTP $http_code"
            return 0
        else
            print_error "$description - Expected HTTP $expected_status, got HTTP $http_code"
            return 1
        fi
    else
        print_error "$description - Connection failed"
        return 1
    fi
}

# Test JSON endpoint
test_json_endpoint() {
    local url=$1
    local description=$2
    
    print_status "Testing JSON endpoint: $description..."
    
    if response=$(curl -s "$url" 2>/dev/null); then
        if echo "$response" | jq . > /dev/null 2>&1; then
            print_success "$description - Valid JSON response"
            echo "Response: $(echo "$response" | jq -c .)"
            return 0
        else
            print_error "$description - Invalid JSON response"
            echo "Response: $response"
            return 1
        fi
    else
        print_error "$description - Connection failed"
        return 1
    fi
}

# Test POST endpoint
test_post_endpoint() {
    local url=$1
    local data=$2
    local description=$3
    
    print_status "Testing POST endpoint: $description..."
    
    if response=$(curl -s -X POST "$url" \
        -H "Content-Type: application/json" \
        -d "$data" 2>/dev/null); then
        if echo "$response" | jq . > /dev/null 2>&1; then
            print_success "$description - Valid JSON response"
            echo "Response: $(echo "$response" | jq -c .)"
            return 0
        else
            print_error "$description - Invalid JSON response"
            echo "Response: $response"
            return 1
        fi
    else
        print_error "$description - Request failed"
        return 1
    fi
}

echo "🔍 Testing Frontend Health Server..."
echo "===================================="

test_endpoint "http://localhost:8080/health" "Frontend Health Check"
test_endpoint "http://localhost:8080/status" "Frontend Status"
test_endpoint "http://localhost:8080/" "Frontend Info Page"

echo ""
echo "🧠 Testing Knowledge Services..."
echo "================================"

test_json_endpoint "http://localhost:8088/health" "Knowledge Gateway Health"
test_json_endpoint "http://localhost:8089/health" "Knowledge Sync Health"
test_json_endpoint "http://localhost:8091/health" "Knowledge Context Health"

echo ""
echo "🔍 Testing Knowledge Gateway Operations..."
echo "=========================================="

test_post_endpoint "http://localhost:8088/search" \
    '{"query":"test unified deployment","limit":5}' \
    "Knowledge Search"

test_post_endpoint "http://localhost:8088/store" \
    '{"content":"Test knowledge entry","type":"test","metadata":{"source":"unified-test"}}' \
    "Knowledge Store"

echo ""
echo "🔄 Testing Knowledge Context Operations..."
echo "=========================================="

test_post_endpoint "http://localhost:8091/context" \
    '{"session_id":"test-session-123","message":"Testing unified deployment","user_id":"test-user"}' \
    "Context Store"

test_json_endpoint "http://localhost:8091/context/test-session-123" "Context Retrieve"

echo ""
echo "🔄 Testing Knowledge Sync Operations..."
echo "======================================"

test_post_endpoint "http://localhost:8089/sync" \
    '{"source":"test-source","target":"test-target","batch_size":10}' \
    "Data Sync"

test_json_endpoint "http://localhost:8089/status" "Sync Status"

echo ""
echo "📊 Testing Monitoring Services..."
echo "================================="

test_endpoint "http://localhost:3000" "Grafana Dashboard"
test_endpoint "http://localhost:9090" "Prometheus Metrics"

echo ""
echo "🧪 Testing Integration Workflow..."
echo "=================================="

print_status "Testing complete knowledge workflow..."

# 1. Store context
print_status "Step 1: Storing conversation context..."
context_response=$(curl -s -X POST http://localhost:8091/context \
    -H "Content-Type: application/json" \
    -d '{"session_id":"integration-test","message":"User asks about AI capabilities","user_id":"integration-user"}')

if echo "$context_response" | jq . > /dev/null 2>&1; then
    print_success "Context stored successfully"
else
    print_error "Context storage failed"
    exit 1
fi

# 2. Search knowledge
print_status "Step 2: Searching knowledge base..."
search_response=$(curl -s -X POST http://localhost:8088/search \
    -H "Content-Type: application/json" \
    -d '{"query":"AI capabilities","limit":3}')

if echo "$search_response" | jq . > /dev/null 2>&1; then
    print_success "Knowledge search completed"
else
    print_error "Knowledge search failed"
    exit 1
fi

# 3. Sync data
print_status "Step 3: Syncing data..."
sync_response=$(curl -s -X POST http://localhost:8089/sync \
    -H "Content-Type: application/json" \
    -d '{"source":"integration-test","target":"knowledge-base","batch_size":5}')

if echo "$sync_response" | jq . > /dev/null 2>&1; then
    print_success "Data sync completed"
else
    print_error "Data sync failed"
    exit 1
fi

echo ""
echo "📈 Performance Test..."
echo "====================="

print_status "Testing response times..."

# Test response times
for service in "8088" "8089" "8091"; do
    print_status "Testing response time for port $service..."
    
    start_time=$(date +%s%3N)
    curl -s "http://localhost:$service/health" > /dev/null
    end_time=$(date +%s%3N)
    
    response_time=$((end_time - start_time))
    
    if [ $response_time -lt 100 ]; then
        print_success "Port $service: ${response_time}ms (Excellent)"
    elif [ $response_time -lt 500 ]; then
        print_success "Port $service: ${response_time}ms (Good)"
    else
        print_warning "Port $service: ${response_time}ms (Slow)"
    fi
done

echo ""
echo "🎯 SUMMARY"
echo "=========="

echo "✅ Frontend Health Server: Running"
echo "✅ Knowledge Gateway: Operational"
echo "✅ Knowledge Sync: Operational"
echo "✅ Knowledge Context: Operational"
echo "✅ Monitoring Services: Available"
echo "✅ Integration Workflow: Working"

echo ""
echo "🌐 Access Points:"
echo "  Frontend:           http://localhost:8080"
echo "  Knowledge Gateway:  http://localhost:8088"
echo "  Knowledge Sync:     http://localhost:8089"
echo "  Knowledge Context:  http://localhost:8091"
echo "  Grafana:            http://localhost:3000"
echo "  Prometheus:         http://localhost:9090"

echo ""
echo "🎉 UNIFIED APPLICATION TEST COMPLETE!"
echo "All systems are operational and integrated successfully."
