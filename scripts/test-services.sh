#!/bin/bash

# Universal AI Tools - Test Working Services
# This script tests all the working Go services

echo "🧪 Testing Universal AI Tools Services..."
echo "=========================================="

# Function to test a service
test_service() {
    local service_name=$1
    local url=$2

    echo -n "Testing $service_name... "

    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" --connect-timeout 5)

    if [ "$response" = "200" ]; then
        echo "✅ OK"
    else
        echo "❌ FAILED (HTTP $response)"
    fi
}

# Test all services
echo ""
echo "Health Check Tests:"
echo "==================="

test_service "Auth Service" "http://localhost:8081/health"
test_service "Monitoring Service" "http://localhost:8020/health"
test_service "Shared Memory" "http://localhost:8021/health"
test_service "Message Broker" "http://localhost:8082/health"
test_service "Load Balancer" "http://localhost:8083/health"
test_service "ML Stream Processor" "http://localhost:8084/health"
test_service "Service Discovery" "http://localhost:8094/health"
test_service "API Gateway" "http://localhost:8080/health"

echo ""
echo "Metrics Tests:"
echo "=============="

test_service "Auth Metrics" "http://localhost:8081/metrics"
test_service "Monitoring Metrics" "http://localhost:8020/metrics"
test_service "Shared Memory Metrics" "http://localhost:8021/metrics"
test_service "Message Broker Metrics" "http://localhost:8082/metrics"
test_service "Load Balancer Metrics" "http://localhost:8083/metrics"
test_service "ML Stream Metrics" "http://localhost:8084/metrics"
test_service "Service Discovery Metrics" "http://localhost:8094/metrics"
test_service "API Gateway Metrics" "http://localhost:8080/metrics"

echo ""
echo "🎉 Service testing complete!"
echo ""
echo "To view detailed logs, check the logs/ directory"
echo "To stop all services, run: ./stop-services.sh"
