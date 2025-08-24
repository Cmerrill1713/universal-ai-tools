#!/bin/bash

# Universal AI Tools - Service Verification Script
# Date: August 23, 2025
# Purpose: Automated verification of service claims vs. reality

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_GATEWAY_PORT=8080
TIMEOUT=5

# Services to verify
SERVICES=(
    "database-automation:8086"
    "documentation-generator:8087" 
    "ml-model-management:8088"
    "performance-optimizer:8085"
)

echo -e "${BLUE}🔍 Universal AI Tools - Service Verification${NC}"
echo "Date: $(date)"
echo "=========================================="

# Test API Gateway (known working)
echo -e "\n${BLUE}Testing API Gateway (Port $API_GATEWAY_PORT)${NC}"
if curl -s --max-time $TIMEOUT "http://localhost:$API_GATEWAY_PORT/health" >/dev/null 2>&1; then
    RESPONSE=$(curl -s --max-time $TIMEOUT "http://localhost:$API_GATEWAY_PORT/health" | jq -r '.status // "unknown"')
    echo -e "✅ ${GREEN}API Gateway: OPERATIONAL${NC} (Status: $RESPONSE)"
    API_GATEWAY_WORKING=true
else
    echo -e "❌ ${RED}API Gateway: NOT RESPONDING${NC}"
    API_GATEWAY_WORKING=false
fi

# Test each claimed service
OPERATIONAL_COUNT=0
TOTAL_SERVICES=${#SERVICES[@]}

echo -e "\n${BLUE}Testing Claimed Services${NC}"
for service in "${SERVICES[@]}"; do
    name=$(echo $service | cut -d: -f1)
    port=$(echo $service | cut -d: -f2)
    
    echo -n "Testing $name (Port $port)... "
    
    # Test if port is listening
    if nc -z localhost $port 2>/dev/null; then
        echo -e "${GREEN}Port Open${NC}"
        
        # Test health endpoint
        if curl -s --max-time $TIMEOUT "http://localhost:$port/health" >/dev/null 2>&1; then
            RESPONSE=$(curl -s --max-time $TIMEOUT "http://localhost:$port/health")
            echo -e "  ✅ ${GREEN}Health Endpoint Responding${NC}"
            echo -e "  Response: $(echo $RESPONSE | jq -c '.' 2>/dev/null || echo "$RESPONSE")"
            OPERATIONAL_COUNT=$((OPERATIONAL_COUNT + 1))
        else
            echo -e "  ❌ ${YELLOW}Port Open but No Health Endpoint${NC}"
        fi
    else
        echo -e "${RED}Port Closed${NC}"
        echo -e "  ❌ ${RED}Service Not Running${NC}"
    fi
done

# Check for processes
echo -e "\n${BLUE}Process Analysis${NC}"
echo "Rust processes:"
ps aux | grep -E "(rust|target.*release)" | grep -v grep | while IFS= read -r line; do
    echo -e "  📝 $line"
done

echo -e "\nGo processes:"
go_procs=$(ps aux | grep -E "go.*run|\.go$|go-api-gateway" | grep -v grep)
if [ -z "$go_procs" ]; then
    echo -e "  ❌ ${YELLOW}No Go processes found${NC}"
else
    echo "$go_procs" | while IFS= read -r line; do
        echo -e "  📝 $line"
    done
fi

# Docker container check
echo -e "\n${BLUE}Docker Container Analysis${NC}"
if command -v docker >/dev/null 2>&1; then
    CONTAINERS=$(docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}")
    if [ "$(docker ps -q | wc -l)" -gt 0 ]; then
        echo -e "Running containers:"
        echo "$CONTAINERS"
    else
        echo -e "  ❌ ${YELLOW}No Docker containers running${NC}"
    fi
else
    echo -e "  ❌ ${YELLOW}Docker not available${NC}"
fi

# Summary
echo -e "\n${BLUE}=========================================="
echo -e "VERIFICATION SUMMARY${NC}"
echo "=========================================="

if [ "$API_GATEWAY_WORKING" = true ]; then
    echo -e "✅ ${GREEN}API Gateway: OPERATIONAL${NC}"
else
    echo -e "❌ ${RED}API Gateway: FAILED${NC}"
fi

echo -e "📊 ${BLUE}Claimed Services Operational: $OPERATIONAL_COUNT/$TOTAL_SERVICES${NC}"

if [ $OPERATIONAL_COUNT -eq 0 ]; then
    echo -e "🚨 ${RED}CRITICAL: No additional services beyond API Gateway are operational${NC}"
    echo -e "📋 ${YELLOW}Status: Single-service system (not multi-service as claimed)${NC}"
elif [ $OPERATIONAL_COUNT -lt $TOTAL_SERVICES ]; then
    echo -e "⚠️  ${YELLOW}PARTIAL: Some claimed services are not operational${NC}"
    echo -e "📋 ${BLUE}Status: Partially implemented multi-service architecture${NC}"
else
    echo -e "✅ ${GREEN}SUCCESS: All claimed services are operational${NC}"
    echo -e "📋 ${GREEN}Status: Full multi-service architecture confirmed${NC}"
fi

# Recommendations
echo -e "\n${BLUE}RECOMMENDATIONS:${NC}"
if [ $OPERATIONAL_COUNT -eq 0 ]; then
    echo -e "1. ${YELLOW}Begin implementing the claimed services as separate processes${NC}"
    echo -e "2. ${YELLOW}Update documentation to reflect single-service current state${NC}"
    echo -e "3. ${YELLOW}Create development roadmap for multi-service architecture${NC}"
elif [ $OPERATIONAL_COUNT -lt $TOTAL_SERVICES ]; then
    echo -e "1. ${YELLOW}Complete implementation of non-operational services${NC}"
    echo -e "2. ${YELLOW}Verify inter-service communication${NC}"
    echo -e "3. ${YELLOW}Update documentation to reflect partial implementation${NC}"
else
    echo -e "1. ${GREEN}Test inter-service communication${NC}"
    echo -e "2. ${GREEN}Verify load balancing and fault tolerance${NC}"
    echo -e "3. ${GREEN}Prepare for production deployment${NC}"
fi

echo -e "\n${BLUE}Verification completed: $(date)${NC}"

# Exit with appropriate code
if [ "$API_GATEWAY_WORKING" = true ] && [ $OPERATIONAL_COUNT -gt 0 ]; then
    exit 0  # Success
elif [ "$API_GATEWAY_WORKING" = true ]; then
    exit 1  # API Gateway working but no additional services
else
    exit 2  # API Gateway not working
fi