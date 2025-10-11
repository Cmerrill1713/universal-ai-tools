#!/bin/bash

# ELK Stack Manager for Universal AI Tools
# This script helps manage the Elasticsearch, Logstash, and Kibana stack

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.elk.yml"
PROJECT_NAME="universal-ai-tools-elk"

# Helper functions
print_info() {
    echo -e "${BLUE}ℹ ${NC}$1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

check_prerequisites() {
    print_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi
    print_success "Docker is installed"
    
    # Check Docker Compose
    if ! docker compose version &> /dev/null; then
        print_error "Docker Compose v2 is not installed"
        exit 1
    fi
    print_success "Docker Compose is installed"
    
    # Check vm.max_map_count
    if [[ "$OSTYPE" == "darwin"* ]]; then
        print_warning "Running on macOS - vm.max_map_count check skipped"
        print_warning "Ensure Docker Desktop has at least 4GB RAM allocated"
    else
        current_value=$(sysctl -n vm.max_map_count 2>/dev/null || echo 0)
        if [ "$current_value" -lt 262144 ]; then
            print_warning "vm.max_map_count is too low: $current_value"
            print_info "Attempting to fix..."
            if sudo sysctl -w vm.max_map_count=262144; then
                print_success "vm.max_map_count set to 262144"
            else
                print_error "Failed to set vm.max_map_count. Run: sudo sysctl -w vm.max_map_count=262144"
                exit 1
            fi
        else
            print_success "vm.max_map_count is sufficient: $current_value"
        fi
    fi
}

setup_directories() {
    print_info "Setting up directories..."
    mkdir -p logs
    mkdir -p monitoring/logstash/{pipeline,config}
    mkdir -p monitoring/{filebeat,metricbeat}
    print_success "Directories created"
}

start_elk() {
    print_info "Starting ELK stack..."
    check_prerequisites
    setup_directories
    
    docker compose -f "$COMPOSE_FILE" up -d
    
    print_info "Waiting for services to start (this may take 2-3 minutes)..."
    sleep 10
    
    # Wait for Elasticsearch
    print_info "Waiting for Elasticsearch..."
    for i in {1..30}; do
        if curl -s http://localhost:9200/_cluster/health &>/dev/null; then
            print_success "Elasticsearch is ready"
            break
        fi
        echo -n "."
        sleep 2
    done
    
    echo ""
    print_success "ELK stack started successfully!"
    print_info "Kibana UI: http://localhost:5601"
    print_info "Elasticsearch: http://localhost:9200"
}

stop_elk() {
    print_info "Stopping ELK stack..."
    docker compose -f "$COMPOSE_FILE" down
    print_success "ELK stack stopped"
}

restart_elk() {
    print_info "Restarting ELK stack..."
    stop_elk
    sleep 2
    start_elk
}

status_elk() {
    print_info "Checking ELK stack status..."
    echo ""
    docker compose -f "$COMPOSE_FILE" ps
    echo ""
    
    # Check Elasticsearch
    if curl -s http://localhost:9200/_cluster/health &>/dev/null; then
        health=$(curl -s http://localhost:9200/_cluster/health | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
        if [ "$health" == "green" ]; then
            print_success "Elasticsearch: healthy ($health)"
        elif [ "$health" == "yellow" ]; then
            print_warning "Elasticsearch: $health (normal for single-node)"
        else
            print_error "Elasticsearch: $health"
        fi
    else
        print_error "Elasticsearch: not responding"
    fi
    
    # Check Logstash
    if curl -s http://localhost:9600/_node/stats &>/dev/null; then
        print_success "Logstash: healthy"
    else
        print_error "Logstash: not responding"
    fi
    
    # Check Kibana
    if curl -s http://localhost:5601/api/status &>/dev/null; then
        print_success "Kibana: healthy"
    else
        print_error "Kibana: not responding"
    fi
}

logs_elk() {
    service="${1:-}"
    if [ -z "$service" ]; then
        docker compose -f "$COMPOSE_FILE" logs -f
    else
        docker compose -f "$COMPOSE_FILE" logs -f "$service"
    fi
}

clean_elk() {
    read -p "This will remove all ELK data. Are you sure? (yes/no): " confirm
    if [ "$confirm" == "yes" ]; then
        print_warning "Stopping and removing ELK stack with all data..."
        docker compose -f "$COMPOSE_FILE" down -v
        print_success "ELK stack and data removed"
    else
        print_info "Operation cancelled"
    fi
}

health_check() {
    print_info "Running comprehensive health check..."
    echo ""
    
    # Elasticsearch
    echo "=== Elasticsearch ==="
    if curl -s http://localhost:9200/_cluster/health?pretty 2>/dev/null; then
        echo ""
        echo "Index sizes:"
        curl -s "http://localhost:9200/_cat/indices?v&s=store.size:desc" 2>/dev/null || echo "Failed to get indices"
    else
        print_error "Elasticsearch is not responding"
    fi
    
    echo ""
    echo "=== Docker Resources ==="
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" \
        universal-ai-tools-elasticsearch \
        universal-ai-tools-logstash \
        universal-ai-tools-kibana 2>/dev/null || echo "No containers running"
}

test_ingestion() {
    print_info "Testing log ingestion..."
    
    timestamp=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)
    test_log="{\"message\":\"Test log from elk-manager\",\"level\":\"INFO\",\"timestamp\":\"$timestamp\",\"service\":\"test\"}"
    
    echo "$test_log" | curl -s -X POST "http://localhost:5000" -H "Content-Type: application/json" -d @-
    
    print_success "Test log sent to Logstash"
    print_info "Check Kibana (http://localhost:5601) in 10-30 seconds to see the log"
}

setup_kibana() {
    print_info "Setting up Kibana index pattern..."
    
    # Wait for Kibana to be ready
    for i in {1..30}; do
        if curl -s http://localhost:5601/api/status &>/dev/null; then
            break
        fi
        echo -n "."
        sleep 2
    done
    echo ""
    
    print_info "Please manually create index pattern in Kibana:"
    print_info "1. Open http://localhost:5601"
    print_info "2. Go to Management → Stack Management → Index Patterns"
    print_info "3. Create pattern: universal-ai-tools-*"
    print_info "4. Select @timestamp as time field"
}

show_urls() {
    echo ""
    print_info "Service URLs:"
    echo "  Kibana:        http://localhost:5601"
    echo "  Elasticsearch: http://localhost:9200"
    echo "  Logstash:      http://localhost:9600 (API)"
    echo ""
    print_info "Log ingestion endpoints:"
    echo "  Beats:         localhost:5044"
    echo "  TCP/JSON:      localhost:5000"
    echo "  HTTP:          http://localhost:8080"
    echo ""
}

show_help() {
    cat << EOF
ELK Stack Manager for Universal AI Tools

Usage: $0 <command> [options]

Commands:
    start           Start the ELK stack
    stop            Stop the ELK stack
    restart         Restart the ELK stack
    status          Show status of all services
    logs [service]  Show logs (optionally for specific service)
    health          Run comprehensive health check
    test            Send a test log to Logstash
    setup-kibana    Guide for setting up Kibana
    clean           Stop and remove all ELK data (requires confirmation)
    urls            Show service URLs
    help            Show this help message

Service names for logs:
    elasticsearch, logstash, kibana, filebeat, metricbeat

Examples:
    $0 start
    $0 status
    $0 logs elasticsearch
    $0 test
    $0 health

For more information, see docs/ELK_SETUP_GUIDE.md
EOF
}

# Main script
case "${1:-}" in
    start)
        start_elk
        show_urls
        ;;
    stop)
        stop_elk
        ;;
    restart)
        restart_elk
        show_urls
        ;;
    status)
        status_elk
        ;;
    logs)
        logs_elk "${2:-}"
        ;;
    health)
        health_check
        ;;
    test)
        test_ingestion
        ;;
    setup-kibana)
        setup_kibana
        ;;
    clean)
        clean_elk
        ;;
    urls)
        show_urls
        ;;
    help|--help|-h|"")
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac

