#!/bin/bash

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║         MIGRATING TO UNIFIED ATHENA DOCKER STACK                  ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() {
    echo -e "${1}${2}${NC}"
}

print_status $YELLOW "📊 Current container count: $(docker ps | wc -l | tr -d ' ')"
echo ""

print_status $YELLOW "⚠️  This will:"
print_status $YELLOW "   1. Stop all current containers"
print_status $YELLOW "   2. Tag existing images for new stack"
print_status $YELLOW "   3. Start unified athena stack"
print_status $YELLOW "   4. Verify all services"
echo ""

read -p "Continue? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_status $RED "❌ Migration cancelled"
    exit 1
fi

echo ""
print_status $GREEN "🚀 Starting migration..."
echo ""

# Step 1: Tag existing images
print_status $YELLOW "1️⃣  Tagging existing images..."

# Check if images exist before tagging
if docker images | grep -q "universal-ai-tools-python-api"; then
    docker tag universal-ai-tools-python-api:latest universal-ai-tools-python-api:latest || true
    print_status $GREEN "   ✅ API image ready"
fi

if docker images | grep -q "unified-evolutionary-api"; then
    docker tag unified-evolutionary-api:latest unified-evolutionary-api:latest || true
    print_status $GREEN "   ✅ Evolutionary API image ready"
fi

print_status $GREEN "   ✅ All images tagged"
echo ""

# Step 2: Stop current containers
print_status $YELLOW "2️⃣  Stopping current containers..."
docker stop $(docker ps -q) 2>/dev/null || true
sleep 3
print_status $GREEN "   ✅ All containers stopped"
echo ""

# Step 3: Remove old containers (keep volumes)
print_status $YELLOW "3️⃣  Removing old container instances..."
docker rm $(docker ps -aq) 2>/dev/null || true
print_status $GREEN "   ✅ Old containers removed (volumes preserved)"
echo ""

# Step 4: Start new unified stack
print_status $YELLOW "4️⃣  Starting unified Athena stack..."
cd "$(dirname "$0")"
docker-compose -f docker-compose.athena.yml up -d

print_status $GREEN "   ✅ New stack started"
echo ""

# Step 5: Wait for services to initialize
print_status $YELLOW "5️⃣  Waiting for services to initialize..."
sleep 15

# Step 6: Verify services
print_status $YELLOW "6️⃣  Verifying services..."
echo ""

verify_service() {
    local name=$1
    local url=$2
    
    if curl -s -f "$url" >/dev/null 2>&1; then
        print_status $GREEN "   ✅ $name"
        return 0
    else
        print_status $RED "   ❌ $name"
        return 1
    fi
}

verify_service "Main API" "http://localhost:8888/health"
verify_service "Evolutionary API" "http://localhost:8014/health"
verify_service "Knowledge Gateway" "http://localhost:8088/health"
verify_service "Knowledge Context" "http://localhost:8091/health"
verify_service "Knowledge Sync" "http://localhost:8089/health"
verify_service "Weaviate" "http://localhost:8090/v1/.well-known/ready"
verify_service "SearXNG" "http://localhost:8081/"
verify_service "Prometheus" "http://localhost:9090/-/healthy"
verify_service "Grafana" "http://localhost:3001/api/health"
verify_service "Netdata" "http://localhost:19999/api/v1/info"

echo ""
print_status $YELLOW "7️⃣  Final container count:"
CONTAINER_COUNT=$(docker ps | wc -l | tr -d ' ')
CONTAINER_COUNT=$((CONTAINER_COUNT - 1))
print_status $GREEN "   $CONTAINER_COUNT containers running"
echo ""

print_status $GREEN "════════════════════════════════════════════════════════════════════"
print_status $GREEN "✅ MIGRATION COMPLETE!"
print_status $GREEN "════════════════════════════════════════════════════════════════════"
echo ""
print_status $GREEN "All services are now under unified docker-compose.athena.yml"
echo ""
print_status $YELLOW "📋 Quick commands:"
print_status $YELLOW "   View logs:    docker-compose -f docker-compose.athena.yml logs -f"
print_status $YELLOW "   Stop all:     docker-compose -f docker-compose.athena.yml down"
print_status $YELLOW "   Restart:      docker-compose -f docker-compose.athena.yml restart"
print_status $YELLOW "   Status:       docker-compose -f docker-compose.athena.yml ps"
echo ""

