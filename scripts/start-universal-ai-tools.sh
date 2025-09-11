#!/bin/bash

# Universal AI Tools - Comprehensive Startup Script
# This script cleans up Docker resources and starts all Universal AI Tools services

set -e

echo "🚀 Universal AI Tools - Complete Startup Process"
echo "================================================"
echo ""

# Function to check if Docker is running
check_docker() {
    echo "🐳 Checking Docker status..."
    if ! docker info >/dev/null 2>&1; then
        echo "❌ Docker is not running. Please start Docker Desktop and try again."
        exit 1
    fi
    echo "✅ Docker is running"
}

# Function to clean up Docker resources
cleanup_docker() {
    echo ""
    echo "🧹 Cleaning up Docker resources..."
    echo "   This will remove unused containers, images, volumes, and networks"

    # Get disk usage before cleanup
    echo "   Disk usage before cleanup:"
    docker system df

    # Perform comprehensive cleanup
    docker system prune -a --volumes -f

    echo ""
    echo "   Disk usage after cleanup:"
    docker system df
    echo "✅ Docker cleanup completed"
}

# Function to start main services
start_main_services() {
    echo ""
    echo "🏗️  Starting Main Universal AI Tools Stack..."
    echo "   (PostgreSQL, Redis, Ollama, Main App, Monitoring)"

    cd /Users/christianmerrill/Desktop/universal-ai-tools
    docker-compose up -d

    echo "✅ Main services started"
}

# Function to start Go/Rust services
start_go_rust_services() {
    echo ""
    echo "🔧 Starting Go/Rust Services..."
    echo "   (API Gateway, Auth Service, Chat Service, Memory Service, WebSocket Hub)"

    cd /Users/christianmerrill/Desktop/universal-ai-tools
    docker-compose -f docker-compose.go-rust.yml up -d

    echo "✅ Go/Rust services started"
}

# Function to start Supabase services
start_supabase_services() {
    echo ""
    echo "🗄️  Starting Supabase Services..."
    echo "   (Database, Auth, Storage, REST API, Realtime)"

    cd /Users/christianmerrill/Desktop/universal-ai-tools/supabase
    docker-compose up -d

    echo "✅ Supabase services started"
}

# Function to start AppFlowy Cloud services
start_appflowy_services() {
    echo ""
    echo "📝 Starting AppFlowy Cloud Services..."
    echo "   (AppFlowy Web, Admin Frontend, AI Service, Worker, MinIO)"

    cd /Users/christianmerrill/Desktop/universal-ai-tools/appflowy-cloud
    docker-compose up -d

    echo "✅ AppFlowy services started"
}

# Function to verify services are running
verify_services() {
    echo ""
    echo "🔍 Verifying Services Status..."
    echo ""

    # Wait a moment for services to fully start
    sleep 10

    # Get service status
    echo "📊 Current Service Status:"
    echo "=========================="
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(universal-ai-tools|uat-|go-|supabase_|appflowy-)" | head -20

    echo ""
    echo "🌐 Available Services:"
    echo "======================"

    # Main services
    echo "🏠 Main Application:    http://localhost:9999"
    echo "📊 Grafana:            http://localhost:3001"
    echo "📈 Prometheus:         http://localhost:9090"
    echo "🐘 pgAdmin:           http://localhost:5050 (optional)"

    # Go/Rust services
    echo "🚪 API Gateway:        http://localhost:8080"
    echo "🔐 Auth Service:       http://localhost:8015"
    echo "💬 Chat Service:       http://localhost:8016"
    echo "🧠 Memory Service:     http://localhost:8017"
    echo "🔌 WebSocket Hub:      http://localhost:8018"

    # Supabase services
    echo "🗄️  Supabase Studio:    http://localhost:54323"
    echo "📧 Supabase Email:     http://localhost:54324"

    # AppFlowy services
    echo "📝 AppFlowy Web:       http://localhost:80"
    echo "🔧 AppFlowy Admin:     http://localhost:3000"

    echo ""
    echo "✅ Universal AI Tools startup completed!"
    echo "📝 Check individual service logs with: docker logs <container-name>"
}

# Main execution
main() {
    check_docker
    cleanup_docker
    start_main_services
    start_go_rust_services
    start_supabase_services
    start_appflowy_services
    verify_services

    echo ""
    echo "🎉 All Universal AI Tools services are now running!"
    echo "   Use 'docker ps' to see all running containers"
    echo "   Use 'docker-compose logs -f' to monitor service logs"
}

# Run main function
main "$@"
