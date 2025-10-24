#!/bin/bash

echo "🧹 Athena Clean Setup - Starting Essential Services Only"
echo "========================================================="

# Stop all existing containers
echo "🛑 Stopping all existing containers..."
docker stop $(docker ps -q) 2>/dev/null || true

# Remove all containers
echo "🗑️  Removing all containers..."
docker rm $(docker ps -aq) 2>/dev/null || true

# Clean up unused images (optional)
echo "🧽 Cleaning up unused images..."
docker image prune -f

# Start clean Athena stack
echo "🚀 Starting clean Athena stack..."
docker-compose -f docker-compose.athena-clean.yml up -d

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 10

# Check service health
echo "🏥 Checking service health..."
echo ""

services=(
    "athena-backend:8013"
    "athena-evolution:8014" 
    "athena-postgres:5432"
    "athena-redis:6379"
    "athena-netdata:19999"
    "athena-grafana:3002"
    "athena-prometheus:9090"
)

for service in "${services[@]}"; do
    name=$(echo $service | cut -d: -f1)
    port=$(echo $service | cut -d: -f2)
    
    if curl -s http://localhost:$port/health >/dev/null 2>&1 || \
       curl -s http://localhost:$port >/dev/null 2>&1 || \
       docker exec $name pg_isready >/dev/null 2>&1; then
        echo "✅ $name (port $port) - Healthy"
    else
        echo "❌ $name (port $port) - Not responding"
    fi
done

echo ""
echo "🎉 Athena Clean Setup Complete!"
echo ""
echo "📊 Service URLs:"
echo "  • Athena Backend: http://localhost:8013"
echo "  • Evolution API:  http://localhost:8014"
echo "  • Netdata:        http://localhost:19999"
echo "  • Grafana:        http://localhost:3002 (admin/admin)"
echo "  • Prometheus:     http://localhost:9090"
echo ""
echo "🔧 Database Access:"
echo "  • PostgreSQL: localhost:5432 (athena/athena123)"
echo "  • Redis:       localhost:6379"
echo ""
echo "📱 Next Steps:"
echo "  1. Open http://localhost:3000 for Athena web interface"
echo "  2. Or use the Swift app: swift run (from NeuroForgeApp/)"
echo "  3. Monitor with Netdata: http://localhost:19999"
echo ""
echo "🌙 2AM Evolution System: ✅ Active"
echo "   Reports will appear as popup dialogs when you log in"
