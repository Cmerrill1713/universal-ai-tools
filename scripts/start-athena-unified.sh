#!/bin/bash

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║              STARTING UNIFIED ATHENA STACK                        ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

cd "$(dirname "$0")"

echo "🚀 Starting all Athena services..."
docker-compose -f docker-compose.athena.yml up -d

echo ""
echo "⏳ Waiting for services to initialize..."
sleep 10

echo ""
echo "📊 Container Status:"
docker-compose -f docker-compose.athena.yml ps

echo ""
echo "════════════════════════════════════════════════════════════════════"
echo "✅ Athena Stack Started!"
echo "════════════════════════════════════════════════════════════════════"
echo ""
echo "Access Points:"
echo "  • Main API:        http://localhost:8888"
echo "  • Netdata Monitor: http://localhost:19999"
echo "  • Grafana:         http://localhost:3001"
echo "  • Prometheus:      http://localhost:9090"
echo ""
echo "Quick Commands:"
echo "  • View logs:   docker-compose -f docker-compose.athena.yml logs -f"
echo "  • Stop all:    docker-compose -f docker-compose.athena.yml down"
echo "  • Restart:     docker-compose -f docker-compose.athena.yml restart"
echo ""
echo "Native App: Open /Applications/Athena.app"
echo ""

