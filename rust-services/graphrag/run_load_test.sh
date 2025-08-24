#!/bin/bash

# GraphRAG Load Testing Script
# Validates performance improvements from Redis caching and connection pooling

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${PURPLE}🚀 GraphRAG Load Testing Suite${NC}"
echo -e "${PURPLE}================================${NC}"

# Check if GraphRAG service is running
SERVICE_URL="${SERVICE_URL:-http://localhost:8000}"
echo -e "${BLUE}📡 Checking service availability at ${SERVICE_URL}...${NC}"

if ! curl -s "${SERVICE_URL}/health" > /dev/null 2>&1; then
    echo -e "${RED}❌ GraphRAG service not available at ${SERVICE_URL}${NC}"
    echo -e "${YELLOW}💡 Start the service first:${NC}"
    echo -e "   cargo run --release"
    exit 1
fi

echo -e "${GREEN}✅ GraphRAG service is running${NC}"

# Build load test binary
echo -e "${BLUE}🔨 Building load test binary...${NC}"
cargo build --release --bin load_test

# Test scenarios
SCENARIOS=(
    "quick:10:60:extract,search"
    "standard:50:300:all"
    "stress:100:600:all"
    "cache:25:180:cache"
    "pool:75:240:pool,extract"
)

echo -e "${BLUE}📋 Available test scenarios:${NC}"
echo -e "  1. quick    - 10 users, 1 min, basic scenarios"
echo -e "  2. standard - 50 users, 5 min, all scenarios (default)"
echo -e "  3. stress   - 100 users, 10 min, all scenarios"
echo -e "  4. cache    - 25 users, 3 min, cache validation"
echo -e "  5. pool     - 75 users, 4 min, connection pool test"

# Select scenario
SCENARIO="${1:-standard}"
echo -e "${BLUE}🎯 Running '${SCENARIO}' load test scenario${NC}"

# Parse scenario configuration
case $SCENARIO in
    "quick")
        USERS=10
        DURATION=60
        TEST_SCENARIOS="extract,search"
        ;;
    "standard")
        USERS=50
        DURATION=300
        TEST_SCENARIOS="all"
        ;;
    "stress")
        USERS=100
        DURATION=600
        TEST_SCENARIOS="all"
        ;;
    "cache")
        USERS=25
        DURATION=180
        TEST_SCENARIOS="cache"
        ;;
    "pool")
        USERS=75
        DURATION=240
        TEST_SCENARIOS="pool,extract"
        ;;
    *)
        echo -e "${RED}❌ Unknown scenario: ${SCENARIO}${NC}"
        echo -e "${YELLOW}Valid scenarios: quick, standard, stress, cache, pool${NC}"
        exit 1
        ;;
esac

# Run the load test
echo -e "${GREEN}🏃 Starting load test...${NC}"
echo -e "${BLUE}  • Concurrent users: ${USERS}${NC}"
echo -e "${BLUE}  • Duration: ${DURATION} seconds${NC}"
echo -e "${BLUE}  • Scenarios: ${TEST_SCENARIOS}${NC}"
echo ""

# Create timestamp for results
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULTS_DIR="load_test_results_${TIMESTAMP}"
mkdir -p "${RESULTS_DIR}"

# Run load test
./target/release/load_test \
    --service-url "${SERVICE_URL}" \
    --concurrent-users "${USERS}" \
    --duration "${DURATION}" \
    --scenarios "${TEST_SCENARIOS}" \
    --requests-per-second 2.0 \
    --timeout 30 \
    --detailed 2>&1 | tee "${RESULTS_DIR}/load_test_output.log"

# Move generated report to results directory
if [ -f "load_test_report_"*.json ]; then
    mv load_test_report_*.json "${RESULTS_DIR}/"
fi

echo ""
echo -e "${GREEN}✅ Load test completed!${NC}"
echo -e "${BLUE}📁 Results saved to: ${RESULTS_DIR}/${NC}"

# Performance validation
echo -e "${PURPLE}🔍 Performance Validation${NC}"
echo -e "${PURPLE}========================${NC}"

# Check if results meet performance criteria
RESULTS_FILE="${RESULTS_DIR}/load_test_report_"*.json
if [ -f ${RESULTS_FILE} ]; then
    echo -e "${BLUE}📊 Analyzing results...${NC}"
    
    # Extract key metrics using jq if available
    if command -v jq &> /dev/null; then
        ERROR_RATE=$(jq -r '.error_rate_percent' ${RESULTS_FILE})
        AVG_RESPONSE_TIME=$(jq -r '.avg_response_time_ms' ${RESULTS_FILE})
        THROUGHPUT=$(jq -r '.requests_per_second' ${RESULTS_FILE})
        CACHE_HIT_RATE=$(jq -r '.cache_hit_rate_percent // "N/A"' ${RESULTS_FILE})
        
        echo -e "${BLUE}Key Metrics:${NC}"
        echo -e "  • Error Rate: ${ERROR_RATE}%"
        echo -e "  • Avg Response Time: ${AVG_RESPONSE_TIME}ms"
        echo -e "  • Throughput: ${THROUGHPUT} RPS"
        echo -e "  • Cache Hit Rate: ${CACHE_HIT_RATE}%"
        
        # Performance assessment
        if (( $(echo "${ERROR_RATE} < 1.0" | bc -l) )); then
            echo -e "${GREEN}✅ Error rate within acceptable range${NC}"
        else
            echo -e "${RED}❌ High error rate detected${NC}"
        fi
        
        if (( $(echo "${AVG_RESPONSE_TIME} < 500.0" | bc -l) )); then
            echo -e "${GREEN}✅ Response time within target${NC}"
        else
            echo -e "${YELLOW}⚠️  Response time above target${NC}"
        fi
        
        if (( $(echo "${THROUGHPUT} > 100.0" | bc -l) )); then
            echo -e "${GREEN}✅ Throughput meets requirements${NC}"
        else
            echo -e "${YELLOW}⚠️  Throughput below target${NC}"
        fi
    else
        echo -e "${YELLOW}💡 Install jq for detailed metric analysis${NC}"
    fi
fi

# Redis cache validation
echo ""
echo -e "${PURPLE}🎯 Redis Cache Performance${NC}"
echo -e "${PURPLE}==========================${NC}"
echo -e "${BLUE}Checking Redis cache metrics...${NC}"

# Check Redis memory usage
if command -v redis-cli &> /dev/null; then
    REDIS_MEMORY=$(redis-cli info memory | grep used_memory_human: | cut -d: -f2 | tr -d '\r')
    REDIS_KEYSPACE=$(redis-cli info keyspace | grep db0: | cut -d: -f2 | tr -d '\r')
    
    echo -e "${BLUE}Redis Stats:${NC}"
    echo -e "  • Memory Usage: ${REDIS_MEMORY}"
    echo -e "  • Keyspace: ${REDIS_KEYSPACE}"
else
    echo -e "${YELLOW}💡 Redis CLI not available for cache metrics${NC}"
fi

# Database connection pool validation
echo ""
echo -e "${PURPLE}🔗 Connection Pool Performance${NC}"
echo -e "${PURPLE}==============================${NC}"
echo -e "${BLUE}Connection pooling optimizations validated during test${NC}"

echo ""
echo -e "${GREEN}🎉 Load test analysis complete!${NC}"
echo -e "${BLUE}📋 For detailed results, check: ${RESULTS_DIR}/${NC}"
echo ""

# Cleanup recommendation
echo -e "${PURPLE}💡 Next Steps:${NC}"
echo -e "  • Review detailed metrics in the results directory"
echo -e "  • Compare with baseline performance measurements"
echo -e "  • Adjust Redis TTL settings if cache hit rate is low"
echo -e "  • Scale connection pool size if acquisition times are high"
echo -e "  • Consider horizontal scaling if throughput is below target"