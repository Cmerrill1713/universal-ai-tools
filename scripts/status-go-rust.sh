#!/bin/bash

# Universal AI Tools - Status Check for Go/Rust Services

echo "📊 Universal AI Tools - Service Status"
echo "====================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to check service status
check_service() {
    local service_name=$1
    local port=$2
    local type=$3

    # Check if port is listening
    if nc -z localhost $port 2>/dev/null; then
        # Try to get health status
        local health=$(curl -s -m 5 "http://localhost:$port/health" 2>/dev/null | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
        if [ "$health" = "healthy" ] || [ "$health" = "ok" ]; then
            print_status $GREEN "✅ $service_name ($type) - PORT $port - HEALTHY"
        else
            print_status $YELLOW "⚠️  $service_name ($type) - PORT $port - RESPONDING (health unknown)"
        fi
    else
        print_status $RED "❌ $service_name ($type) - PORT $port - NOT RESPONDING"
    fi
}

print_status $BLUE "🔍 Checking service status..."
echo ""

# Check all services
check_service "API Gateway" 8080 "Go"
check_service "Auth Service" 8015 "Go"
check_service "ML Inference" 8084 "Rust"
check_service "LLM Router" 3033 "Rust"
check_service "Parameter Analytics" 3032 "Rust"
check_service "Chat Service" 8016 "Go"
check_service "Memory Service" 8017 "Go"
check_service "Load Balancer" 8011 "Go"
check_service "Cache Coordinator" 8012 "Go"
check_service "Metrics Aggregator" 8013 "Go"
check_service "WebSocket Hub" 8018 "Go"
check_service "Agent Coordination" 3034 "Rust"
check_service "Legacy Bridge" 9999 "TypeScript"

echo ""
print_status $BLUE "🔗 Quick connection tests:"

# Test key endpoints
echo ""
print_status $YELLOW "Testing API Gateway health..."
if curl -s -m 5 http://localhost:8080/health > /dev/null 2>&1; then
    print_status $GREEN "✅ API Gateway responding"
else
    print_status $RED "❌ API Gateway not responding"
fi

print_status $YELLOW "Testing ML Inference health..."
if curl -s -m 5 http://localhost:8084/health > /dev/null 2>&1; then
    print_status $GREEN "✅ ML Inference responding"
else
    print_status $RED "❌ ML Inference not responding"
fi

print_status $YELLOW "Testing LLM Router health..."
if curl -s -m 5 http://localhost:3033/health > /dev/null 2>&1; then
    print_status $GREEN "✅ LLM Router responding"
else
    print_status $RED "❌ LLM Router not responding"
fi

echo ""
print_status $BLUE "📈 System Resources:"

# Check memory usage
if command -v free > /dev/null 2>&1; then
    echo "Memory: $(free -h | awk '/^Mem:/ {printf "%s/%s (%.1f%%)", $3, $2, $3/$2*100}')"
elif command -v vm_stat > /dev/null 2>&1; then
    # macOS
    mem_info=$(vm_stat | head -4)
    print_status $BLUE "Memory info available via: vm_stat"
fi

# Check CPU load
if command -v uptime > /dev/null 2>&1; then
    load=$(uptime | awk '{print $NF}')
    print_status $BLUE "Load average: $load"
fi

# Check disk space
disk_usage=$(df -h / | tail -1 | awk '{print $5}')
print_status $BLUE "Disk usage: $disk_usage"

echo ""
print_status $GREEN "🚀 Primary endpoints:"
print_status $BLUE "   Main API: http://localhost:8080"
print_status $BLUE "   ML API:   http://localhost:8084"
print_status $BLUE "   LLM API:  http://localhost:3033"
print_status $BLUE "   Auth API: http://localhost:8015"

echo ""
if curl -s -m 5 http://localhost:8080/health > /dev/null 2>&1; then
    print_status $GREEN "🎉 System is operational!"
else
    print_status $RED "⚠️  System may have issues - check service logs"
fi
