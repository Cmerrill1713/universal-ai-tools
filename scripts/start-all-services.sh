#!/bin/bash

# Universal AI Tools - Complete Service Startup Script
# Starts all services in the hybrid Go/Rust/TypeScript architecture

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="${PROJECT_ROOT}/service-startup.log"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_info() { log "${BLUE}[INFO]${NC} $1"; }
log_success() { log "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { log "${YELLOW}[WARNING]${NC} $1"; }
log_error() { log "${RED}[ERROR]${NC} $1"; }

# Service configurations
declare -A SERVICES=(
    ["rust-llm-router"]="8082:rust-services/llm-router:cargo run --release"
    ["go-websocket"]="8080:rust-services/go-websocket:go run ."
    ["typescript-server"]="9999:.:npm run dev"
)

# Check if port is available
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 1  # Port is occupied
    else
        return 0  # Port is free
    fi
}

# Start a service
start_service() {
    local service_name=$1
    local service_info=${SERVICES[$service_name]}
    
    IFS=':' read -r port directory command <<< "$service_info"
    
    log_info "Starting $service_name on port $port..."
    
    # Check if port is already in use
    if ! check_port $port; then
        log_warning "$service_name: Port $port is already in use. Checking if it's our service..."
        
        # Test if it's responding with our health endpoint
        if curl -s "http://localhost:$port/health" >/dev/null 2>&1; then
            log_success "$service_name: Already running and healthy on port $port"
            return 0
        else
            log_error "$service_name: Port $port occupied by different service"
            return 1
        fi
    fi
    
    # Change to service directory
    cd "${PROJECT_ROOT}/${directory}"
    
    # Start the service in background
    case $service_name in
        "rust-llm-router")
            log_info "Building and starting Rust LLM Router..."
            RUST_LOG=info nohup cargo run --release > "${PROJECT_ROOT}/logs/rust-llm-router.log" 2>&1 &
            echo $! > "${PROJECT_ROOT}/logs/rust-llm-router.pid"
            ;;
        "go-websocket")
            log_info "Starting Go WebSocket service..."
            nohup go run . > "${PROJECT_ROOT}/logs/go-websocket.log" 2>&1 &
            echo $! > "${PROJECT_ROOT}/logs/go-websocket.pid"
            ;;
        "typescript-server")
            log_info "Starting TypeScript server..."
            nohup npm run dev > "${PROJECT_ROOT}/logs/typescript-server.log" 2>&1 &
            echo $! > "${PROJECT_ROOT}/logs/typescript-server.pid"
            ;;
    esac
    
    # Wait for service to start
    local retries=0
    local max_retries=30
    
    while [ $retries -lt $max_retries ]; do
        if curl -s "http://localhost:$port/health" >/dev/null 2>&1; then
            log_success "$service_name: Successfully started on port $port"
            return 0
        fi
        
        sleep 2
        ((retries++))
        log_info "$service_name: Waiting for startup... ($retries/$max_retries)"
    done
    
    log_error "$service_name: Failed to start after ${max_retries} attempts"
    return 1
}

# Stop all services
stop_services() {
    log_info "Stopping all services..."
    
    # Kill processes by PID files
    for pid_file in "${PROJECT_ROOT}/logs"/*.pid; do
        if [ -f "$pid_file" ]; then
            local pid=$(cat "$pid_file")
            local service_name=$(basename "$pid_file" .pid)
            
            if kill -0 $pid 2>/dev/null; then
                log_info "Stopping $service_name (PID: $pid)..."
                kill $pid
                rm "$pid_file"
            else
                log_warning "$service_name: Process not running (PID: $pid)"
                rm "$pid_file"
            fi
        fi
    done
    
    # Fallback: kill by port
    for service in "${!SERVICES[@]}"; do
        local port=$(echo ${SERVICES[$service]} | cut -d':' -f1)
        local pid=$(lsof -ti :$port)
        
        if [ ! -z "$pid" ]; then
            log_info "Killing process on port $port (PID: $pid)"
            kill $pid 2>/dev/null || true
        fi
    done
}

# Check service health
check_service_health() {
    local service_name=$1
    local port=$(echo ${SERVICES[$service_name]} | cut -d':' -f1)
    
    if curl -s "http://localhost:$port/health" >/dev/null 2>&1; then
        log_success "$service_name: ✓ Healthy on port $port"
        return 0
    else
        log_error "$service_name: ✗ Not responding on port $port"
        return 1
    fi
}

# Main execution
main() {
    log_info "Starting Universal AI Tools hybrid architecture services..."
    
    # Create logs directory
    mkdir -p "${PROJECT_ROOT}/logs"
    
    # Handle command line arguments
    case "${1:-start}" in
        "start")
            log_info "=== STARTING ALL SERVICES ==="
            
            # Start services in order
            local failed_services=()
            
            for service in "rust-llm-router" "go-websocket" "typescript-server"; do
                if ! start_service "$service"; then
                    failed_services+=("$service")
                fi
            done
            
            # Report results
            log_info "=== SERVICE STARTUP COMPLETE ==="
            
            if [ ${#failed_services[@]} -eq 0 ]; then
                log_success "All services started successfully!"
                
                # Display service status
                echo ""
                log_info "Service Status:"
                for service in "${!SERVICES[@]}"; do
                    check_service_health "$service"
                done
                
                echo ""
                log_info "API Endpoints Available:"
                log_info "  • Rust LLM Router:    http://localhost:8082/health"
                log_info "  • Go WebSocket:       http://localhost:8080/health"  
                log_info "  • TypeScript Server:  http://localhost:9999/health"
                
                echo ""
                log_success "🚀 Universal AI Tools is now running with full hybrid architecture!"
                
            else
                log_error "Failed to start services: ${failed_services[*]}"
                exit 1
            fi
            ;;
            
        "stop")
            stop_services
            log_success "All services stopped"
            ;;
            
        "status")
            log_info "=== SERVICE STATUS ==="
            local unhealthy_count=0
            
            for service in "${!SERVICES[@]}"; do
                if ! check_service_health "$service"; then
                    ((unhealthy_count++))
                fi
            done
            
            if [ $unhealthy_count -eq 0 ]; then
                log_success "All services are healthy!"
            else
                log_warning "$unhealthy_count service(s) are unhealthy"
                exit 1
            fi
            ;;
            
        "restart")
            stop_services
            sleep 3
            exec "$0" start
            ;;
            
        *)
            echo "Usage: $0 {start|stop|status|restart}"
            echo ""
            echo "Commands:"
            echo "  start    - Start all services"
            echo "  stop     - Stop all services"
            echo "  status   - Check service health"
            echo "  restart  - Restart all services"
            exit 1
            ;;
    esac
}

# Execute main function
main "$@"