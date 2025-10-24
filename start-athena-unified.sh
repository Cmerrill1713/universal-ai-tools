#!/bin/bash

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║              ATHENA-CENTRIC AI SYSTEM STARTUP                    ║"
echo "║                    All Services Through Athena                    ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

cd "$(dirname "$0")"

echo "🎯 Starting Athena-Centric AI System..."
echo "   • Central Hub: Athena API Gateway (Port 8080)"
echo "   • All services routed through Athena"
echo "   • Unified interface for all AI capabilities"
echo ""

# Start Athena stack with gateway
echo "🚀 Starting Athena stack with API Gateway..."
docker-compose -f docker-compose.athena.yml up -d

echo ""
echo "⏳ Waiting for services to initialize..."
sleep 15

echo ""
echo "📊 Container Status:"
docker-compose -f docker-compose.athena.yml ps

echo ""
echo "🔍 Health Check - Athena Gateway:"
if curl -sf http://localhost:8080/health > /dev/null 2>&1; then
    echo "   ✅ Athena Gateway: HEALTHY"
    echo "   📋 Service Status:"
    curl -s http://localhost:8080/health | jq -r '.services | to_entries[] | "   • \(.key): \(.value)"' 2>/dev/null || echo "   • Services: Check gateway logs"
else
    echo "   ❌ Athena Gateway: NOT READY"
    echo "   🔧 Troubleshooting:"
    echo "   • Check logs: docker-compose -f docker-compose.athena.yml logs athena-gateway"
    echo "   • Check dependencies: docker-compose -f docker-compose.athena.yml ps"
fi

echo ""
echo "🔍 Health Check - Core Services:"
if curl -sf http://localhost:8888/health > /dev/null 2>&1; then
    echo "   ✅ Athena API: HEALTHY"
else
    echo "   ❌ Athena API: NOT READY"
fi

if curl -sf http://localhost:8014/health > /dev/null 2>&1; then
    echo "   ✅ Evolution API: HEALTHY"
else
    echo "   ❌ Evolution API: NOT READY"
fi

echo ""
echo "════════════════════════════════════════════════════════════════════"
echo "✅ ATHENA-CENTRIC SYSTEM READY!"
echo "════════════════════════════════════════════════════════════════════"
echo ""
echo "🎯 ACCESS POINTS (All through Athena Gateway):"
echo ""
echo "   🌐 MAIN GATEWAY:"
echo "      • API Gateway:     http://localhost:8080"
echo "      • Documentation:   http://localhost:8080/docs"
echo "      • Health Check:    http://localhost:8080/health"
echo ""
echo "   🖥️  USER INTERFACES:"
echo "      • Web Frontend:    http://localhost:3000"
echo "      • iPhone Access:   http://192.168.1.198"
echo "      • Native macOS:    Open Athena.app"
echo ""
echo "   🔧 DIRECT SERVICES (if needed):"
echo "      • Athena API:      http://localhost:8888"
echo "      • Evolution API:   http://localhost:8014"
echo "      • Knowledge:       http://localhost:8088"
echo ""
echo "   📊 MONITORING:"
echo "      • Netdata:         http://localhost:19999"
echo "      • Grafana:         http://localhost:3001"
echo "      • Prometheus:      http://localhost:9090"
echo ""

echo "🧪 TESTING ATHENA GATEWAY:"
echo ""
echo "   Test Chat:"
echo "   curl -X POST http://localhost:8080/api/chat \\"
echo "     -H \"Content-Type: application/json\" \\"
echo "     -d '{\"message\": \"Hello Athena!\"}'"
echo ""
echo "   Test Health:"
echo "   curl http://localhost:8080/health"
echo ""
echo "   Test Services:"
echo "   curl http://localhost:8080/api/services"
echo ""

echo "🛠️  MANAGEMENT COMMANDS:"
echo ""
echo "   • View logs:   docker-compose -f docker-compose.athena.yml logs -f"
echo "   • Stop all:    docker-compose -f docker-compose.athena.yml down"
echo "   • Restart:     docker-compose -f docker-compose.athena.yml restart"
echo "   • Rebuild:     docker-compose -f docker-compose.athena.yml up -d --build"
echo ""

echo "🎉 ATHENA-CENTRIC SYSTEM IS READY!"
echo "   All AI services now route through Athena as the central hub"
echo "   Use port 8080 for all API calls"
echo ""

# Test the gateway
echo "🧪 Quick Gateway Test:"
if curl -sf http://localhost:8080/health > /dev/null 2>&1; then
    echo "   ✅ Gateway responding - System operational!"
else
    echo "   ⚠️  Gateway not ready - Check logs above"
fi

echo ""