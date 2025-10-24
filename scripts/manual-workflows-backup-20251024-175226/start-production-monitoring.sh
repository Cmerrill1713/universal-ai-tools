#!/bin/bash

# Universal AI Tools - Production Monitoring Startup Script
# This script starts the complete monitoring stack for Phase 4 production deployment

set -e

echo "🚀 Starting Universal AI Tools Production Monitoring Stack..."

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if docker is running
if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Set environment variables if not already set
export GRAFANA_USER=${GRAFANA_USER:-admin}
export GRAFANA_PASSWORD=${GRAFANA_PASSWORD:-admin123}
export PROMETHEUS_RETENTION=${PROMETHEUS_RETENTION:-30d}
export LOG_LEVEL=${LOG_LEVEL:-info}

echo "📊 Starting monitoring services..."

# Start the full production stack with monitoring
docker-compose -f docker-compose.production.yml --profile monitoring up -d

echo "⏳ Waiting for services to be ready..."

# Wait for Prometheus to be ready
echo "📊 Checking Prometheus..."
timeout=60
while ! curl -sf http://localhost:9090/-/ready &>/dev/null; do
    if [ $timeout -eq 0 ]; then
        echo "❌ Prometheus failed to start within 60 seconds"
        exit 1
    fi
    sleep 1
    ((timeout--))
done
echo "✅ Prometheus is ready"

# Wait for Grafana to be ready
echo "📈 Checking Grafana..."
timeout=60
while ! curl -sf http://localhost:3001/api/health &>/dev/null; do
    if [ $timeout -eq 0 ]; then
        echo "❌ Grafana failed to start within 60 seconds"
        exit 1
    fi
    sleep 1
    ((timeout--))
done
echo "✅ Grafana is ready"

# Wait for Universal AI Tools to be ready
echo "🤖 Checking Universal AI Tools..."
timeout=120
while ! curl -sf http://localhost:9999/api/health &>/dev/null; do
    if [ $timeout -eq 0 ]; then
        echo "❌ Universal AI Tools failed to start within 120 seconds"
        exit 1
    fi
    sleep 2
    ((timeout--))
done
echo "✅ Universal AI Tools is ready"

# Check AlertManager if available
if docker-compose -f docker-compose.production.yml ps | grep -q alertmanager; then
    echo "🚨 Checking AlertManager..."
    timeout=30
    while ! curl -sf http://localhost:9093/-/ready &>/dev/null; do
        if [ $timeout -eq 0 ]; then
            echo "⚠️  AlertManager not ready, continuing..."
            break
        fi
        sleep 1
        ((timeout--))
    done
    if [ $timeout -gt 0 ]; then
        echo "✅ AlertManager is ready"
    fi
fi

echo ""
echo "🎉 Production Monitoring Stack is Ready!"
echo ""
echo "📊 Access your monitoring services:"
echo "   • Universal AI Tools:    http://localhost:9999"
echo "   • Grafana Dashboards:    http://localhost:3001 (${GRAFANA_USER}/${GRAFANA_PASSWORD})"
echo "   • Prometheus:            http://localhost:9090"
echo "   • AlertManager:          http://localhost:9093"
echo ""
echo "📈 Key Performance URLs:"
echo "   • Health Check:          http://localhost:9999/api/health"
echo "   • Metrics Endpoint:      http://localhost:9999/metrics"
echo "   • API Status:            http://localhost:9999/api/v1/health"
echo ""
echo "📱 Phase 4 Production Dashboard:"
echo "   • Phase 4 Dashboard:     http://localhost:3001/d/phase4-production"
echo "   • System Overview:       http://localhost:3001/d/universal-ai-tools"
echo ""

# Show running containers
echo "🐳 Running Containers:"
docker-compose -f docker-compose.production.yml --profile monitoring ps

echo ""
echo "📝 Monitoring Log Locations:"
echo "   • Application Logs:      ./logs/"
echo "   • Prometheus Data:       Docker Volume: prometheus_data"
echo "   • Grafana Data:          Docker Volume: grafana_data"
echo ""
echo "🚨 To view real-time logs:"
echo "   docker-compose -f docker-compose.production.yml logs -f universal-ai-tools"
echo ""
echo "⚙️  To stop monitoring stack:"
echo "   docker-compose -f docker-compose.production.yml --profile monitoring down"
echo ""
echo "✨ Phase 4 Production Monitoring Setup Complete!"