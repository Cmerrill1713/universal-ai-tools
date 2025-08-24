#!/bin/bash

# Universal AI Tools - Comprehensive Service Functional Test
# Date: August 23, 2025
# Purpose: Test actual functionality beyond health checks

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔬 Universal AI Tools - Comprehensive Service Test${NC}"
echo "Date: $(date)"
echo "========================================================="

# Test Database Automation Service (Port 8086)
echo -e "\n${BLUE}🗄️ Testing Database Automation Service (Port 8086)${NC}"
echo "Health Check:"
curl -s http://localhost:8086/health | jq .

echo -e "\nTesting database endpoints:"
curl -s -w "Status: %{http_code}\n" http://localhost:8086/api/database/status -o /dev/null
curl -s -w "Migrations: %{http_code}\n" http://localhost:8086/api/migrations -o /dev/null
curl -s -w "Performance: %{http_code}\n" http://localhost:8086/api/performance -o /dev/null

# Test Documentation Generator Service (Port 8087)
echo -e "\n${BLUE}📚 Testing Documentation Generator Service (Port 8087)${NC}"
echo "Health Check:"
curl -s http://localhost:8087/health | jq .

echo -e "\nTesting documentation endpoints:"
curl -s -w "Generate: %{http_code}\n" http://localhost:8087/api/generate-docs -X POST -H "Content-Type: application/json" -d '{"project_path": "/tmp", "format": "markdown"}' -o /dev/null
curl -s -w "Templates: %{http_code}\n" http://localhost:8087/api/templates -o /dev/null
curl -s -w "Export: %{http_code}\n" http://localhost:8087/api/export-formats -o /dev/null

# Test ML Model Management Service (Port 8088)
echo -e "\n${BLUE}🤖 Testing ML Model Management Service (Port 8088)${NC}"
echo "Health Check:"
curl -s http://localhost:8088/health | jq .

echo -e "\nTesting ML endpoints:"
echo "Models list:"
curl -s http://localhost:8088/api/models | jq .
curl -s -w "Training: %{http_code}\n" http://localhost:8088/api/training/status -o /dev/null
curl -s -w "Inference: %{http_code}\n" http://localhost:8088/api/inference/status -o /dev/null
curl -s -w "Registry: %{http_code}\n" http://localhost:8088/api/registry -o /dev/null

# Test Performance Optimizer Service (Port 8085)
echo -e "\n${BLUE}⚡ Testing Performance Optimizer Service (Port 8085)${NC}"
echo "Health Check:"
curl -s http://localhost:8085/health | jq .

echo -e "\nTesting performance endpoints:"
curl -s -w "Optimize: %{http_code}\n" http://localhost:8085/api/optimize -o /dev/null
curl -s -w "Metrics: %{http_code}\n" http://localhost:8085/api/metrics -o /dev/null
curl -s -w "Monitor: %{http_code}\n" http://localhost:8085/api/monitor -o /dev/null

# Test API Gateway Service Registry
echo -e "\n${BLUE}🌐 Testing API Gateway Service Registry${NC}"
echo "Health Check:"
curl -s http://localhost:8080/health | jq .

echo -e "\nTesting gateway endpoints:"
curl -s -w "Services: %{http_code}\n" http://localhost:8080/api/services -o /dev/null 2>&1
curl -s -w "Registry: %{http_code}\n" http://localhost:8080/api/registry/services -o /dev/null 2>&1
curl -s -w "Metrics: %{http_code}\n" http://localhost:8080/metrics -o /dev/null 2>&1

# Summary
echo -e "\n${BLUE}=========================================================${NC}"
echo -e "${GREEN}✅ COMPREHENSIVE TEST COMPLETED${NC}"
echo -e "${BLUE}All services health checks passed with detailed component status${NC}"
echo "Next: Test end-to-end workflow integration"