#!/usr/bin/env bash

# Universal AI Tools - Unified Service Manager
# Manages all Rust, Go, Python, and TypeScript services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Service status tracking
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PID_FILE="$PROJECT_ROOT/.service-pids"

# Simple PID tracking without associative arrays
RUST_AUTH_PID=""
FAST_LLM_PID=""
INTELLIGENT_PARAMS_PID=""
AB_MCTS_PID=""
GO_GATEWAY_PID=""
GO_AUTH_PID=""
GO_MEMORY_PID=""
GO_WEBSOCKET_PID=""
GO_FILES_PID=""
MAIN_API_PID=""
DSPY_PID=""
PYVISION_PID=""

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -i :$port >/dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to wait for service to be ready
wait_for_service() {
    local name=$1
    local port=$2
    local max_wait=30
    local waited=0
    
    while [ $waited -lt $max_wait ]; do
        if check_port $port; then
            log_success "$name started on port $port"
            return 0
        fi
        sleep 1
        waited=$((waited + 1))
        echo -n "."
    done
    
    log_error "$name failed to start on port $port"
    return 1
}

# Function to start Rust services
start_rust_services() {
    log_info "🦀 Starting Rust services..."
    
    cd "$PROJECT_ROOT"
    
    # Build Rust services first
    if [ "$1" != "--skip-build" ]; then
        log_info "Building Rust services..."
        cargo build --release 2>/dev/null || cargo build
    fi
    
    # Start individual Rust services
    # Note: Some of these may need to be started as HTTP servers
    
    # Rust Auth Service (already running on 8016)
    if ! check_port 8016; then
        log_info "Starting Rust Auth Service..."
        PORT=8016 cargo run -p rust-auth-service --bin rust-auth-server > /tmp/rust-auth.log 2>&1 &
        RUST_AUTH_PID=$!
        echo "rust-auth=$!" >> "$PID_FILE"
        wait_for_service "Rust Auth Service" 8016
    else
        log_warning "Rust Auth Service already running on port 8016"
    fi
    
    # Parameter Analytics Service
    if ! check_port 8028; then
        log_info "Starting Parameter Analytics Service..."
        cd rust-services/parameter-analytics-service
        PORT=8028 cargo run --bin parameter-analytics-server > /tmp/param-analytics.log 2>&1 &
        PARAM_ANALYTICS_PID=$!
        echo "param-analytics=$!" >> "$PID_FILE"
        wait_for_service "Parameter Analytics Service" 8028
        cd "$PROJECT_ROOT"
    else
        log_warning "Parameter Analytics Service already running on port 8028"
    fi
    
    # Fast LLM Coordinator
    if ! check_port 8021; then
        log_info "Starting Fast LLM Coordinator..."
        PORT=8021 cargo run -p fast-llm-coordinator > /tmp/fast-llm.log 2>&1 &
        FAST_LLM_PID=$!
        echo "fast-llm=$!" >> "$PID_FILE"
        wait_for_service "Fast LLM Coordinator" 8021
    fi
    
    # Intelligent Parameter Service
    if ! check_port 8022; then
        log_info "Starting Intelligent Parameter Service..."
        PORT=8022 cargo run -p intelligent-parameter-service > /tmp/intelligent-params.log 2>&1 &
        INTELLIGENT_PARAMS_PID=$!
        echo "intelligent-params=$!" >> "$PID_FILE"
        wait_for_service "Intelligent Parameter Service" 8022
    fi
    
    # AB-MCTS Service (if it has an HTTP server)
    if ! check_port 8023; then
        log_info "Starting AB-MCTS Service..."
        PORT=8023 cargo run -p ab-mcts-service --bin ab-mcts-server 2>/dev/null > /tmp/ab-mcts.log 2>&1 &
        AB_MCTS_PID=$!
        echo "ab-mcts=$!" >> "$PID_FILE"
    fi
}

# Function to start Go services
start_go_services() {
    log_info "🐹 Starting Go services..."
    
    cd "$PROJECT_ROOT"
    
    # Go API Gateway
    if ! check_port 8080; then
        log_info "Starting Go API Gateway..."
        go run simple-api-gateway.go > /tmp/go-gateway.log 2>&1 &
        GO_GATEWAY_PID=$!
        echo "go-gateway=$!" >> "$PID_FILE"
        wait_for_service "Go API Gateway" 8080
    else
        log_warning "Go API Gateway already running on port 8080"
    fi
    
    # Go Auth Service
    if ! check_port 8015; then
        log_info "Starting Go Auth Service..."
        PORT=8015 go run simple-auth-service.go > /tmp/go-auth.log 2>&1 &
        GO_AUTH_PID=$!
        echo "go-auth=$!" >> "$PID_FILE"
        wait_for_service "Go Auth Service" 8015
    else
        log_warning "Go Auth Service already running on port 8015"
    fi
    
    # Go Memory Service
    if ! check_port 8017; then
        log_info "Starting Go Memory Service..."
        PORT=8017 go run simple-memory-service.go > /tmp/go-memory.log 2>&1 &
        GO_MEMORY_PID=$!
        echo "go-memory=$!" >> "$PID_FILE"
        wait_for_service "Go Memory Service" 8017
    else
        log_warning "Go Memory Service already running on port 8017"
    fi
    
    # Go WebSocket Service
    if ! check_port 8014; then
        log_info "Starting Go WebSocket Service..."
        PORT=8014 go run simple-websocket-service.go > /tmp/go-websocket.log 2>&1 &
        GO_WEBSOCKET_PID=$!
        echo "go-websocket=$!" >> "$PID_FILE"
        wait_for_service "Go WebSocket Service" 8014
    fi
    
    # Go File Management Service
    if ! check_port 8019; then
        log_info "Starting Go File Management Service..."
        PORT=8019 go run go-file-management-service.go > /tmp/go-files.log 2>&1 &
        GO_FILES_PID=$!
        echo "go-files=$!" >> "$PID_FILE"
        wait_for_service "Go File Management Service" 8019
    else
        log_warning "Go File Management Service already running on port 8019"
    fi
}

# Function to start Python services
start_python_services() {
    log_info "🐍 Starting Python services..."
    
    cd "$PROJECT_ROOT"
    
    # DSPy Orchestrator
    if ! check_port 8090; then
        if [ -f "python-services/dspy-orchestrator/run_service.py" ]; then
            log_info "Starting DSPy Orchestrator..."
            cd python-services/dspy-orchestrator
            python run_service.py > /tmp/dspy.log 2>&1 &
            DSPY_PID=$!
        echo "dspy=$!" >> "$PID_FILE"
            cd "$PROJECT_ROOT"
        fi
    fi
    
    # PyVision Service
    if ! check_port 8091; then
        if [ -f "python-services/pyvision/run_service.py" ]; then
            log_info "Starting PyVision Service..."
            cd python-services/pyvision
            python run_service.py > /tmp/pyvision.log 2>&1 &
            PYVISION_PID=$!
        echo "pyvision=$!" >> "$PID_FILE"
            cd "$PROJECT_ROOT"
        fi
    fi
}

# Function to start TypeScript services
start_typescript_services() {
    log_info "📘 Starting TypeScript services..."
    
    cd "$PROJECT_ROOT"
    
    # Main API Server
    if ! check_port 9999; then
        log_info "Starting Main API Server..."
        npm run dev > /tmp/main-api.log 2>&1 &
        MAIN_API_PID=$!
        echo "main-api=$!" >> "$PID_FILE"
        wait_for_service "Main API Server" 9999
    else
        log_warning "Main API Server already running on port 9999"
    fi
}

# Function to start external services
start_external_services() {
    log_info "🔧 Checking external services..."
    
    # Redis
    if ! check_port 6379; then
        log_warning "Redis not running. Start with: redis-server"
    else
        log_success "Redis is running on port 6379"
    fi
    
    # Ollama
    if ! check_port 11434; then
        log_warning "Ollama not running. Start with: ollama serve"
    else
        log_success "Ollama is running on port 11434"
    fi
    
    # Supabase
    if ! check_port 54321; then
        log_warning "Supabase not running. Start with: supabase start"
    else
        log_success "Supabase is running on port 54321"
    fi
}

# Function to stop all services
stop_all_services() {
    log_info "Stopping all services..."
    
    # Read PIDs from file if it exists
    if [ -f "$PID_FILE" ]; then
        while IFS='=' read -r service pid; do
            if kill -0 $pid 2>/dev/null; then
                log_info "Stopping $service (PID: $pid)"
                kill $pid 2>/dev/null || true
            fi
        done < "$PID_FILE"
        rm -f "$PID_FILE"
    fi
    
    # Stop any services by port
    for port in 8014 8015 8016 8017 8019 8021 8022 8023 8028 8080 8090 8091 9999; do
        if check_port $port; then
            pid=$(lsof -ti :$port)
            if [ ! -z "$pid" ]; then
                log_info "Stopping service on port $port (PID: $pid)"
                kill $pid 2>/dev/null || true
            fi
        fi
    done
    
    log_success "All services stopped"
}

# Function to check service status
check_status() {
    log_info "🏥 Service Status Check"
    echo "═══════════════════════════════════════════"
    
    # Run the TypeScript health check
    if [ -f "$PROJECT_ROOT/test-service-health.ts" ]; then
        tsx "$PROJECT_ROOT/test-service-health.ts"
    else
        # Manual status check
        echo ""
        echo "🦀 Rust Services:"
        check_port 8016 && echo "  ✅ Rust Auth Service (8016)" || echo "  ❌ Rust Auth Service (8016)"
        check_port 8028 && echo "  ✅ Parameter Analytics (8028)" || echo "  ❌ Parameter Analytics (8028)"
        check_port 8021 && echo "  ✅ Fast LLM Coordinator (8021)" || echo "  ❌ Fast LLM Coordinator (8021)"
        check_port 8022 && echo "  ✅ Intelligent Parameters (8022)" || echo "  ❌ Intelligent Parameters (8022)"
        check_port 8023 && echo "  ✅ AB-MCTS Service (8023)" || echo "  ❌ AB-MCTS Service (8023)"
        
        echo ""
        echo "🐹 Go Services:"
        check_port 8080 && echo "  ✅ API Gateway (8080)" || echo "  ❌ API Gateway (8080)"
        check_port 8015 && echo "  ✅ Auth Service (8015)" || echo "  ❌ Auth Service (8015)"
        check_port 8017 && echo "  ✅ Memory Service (8017)" || echo "  ❌ Memory Service (8017)"
        check_port 8014 && echo "  ✅ WebSocket Service (8014)" || echo "  ❌ WebSocket Service (8014)"
        check_port 8019 && echo "  ✅ File Management (8019)" || echo "  ❌ File Management (8019)"
        
        echo ""
        echo "📘 TypeScript Services:"
        check_port 9999 && echo "  ✅ Main API Server (9999)" || echo "  ❌ Main API Server (9999)"
        
        echo ""
        echo "🔧 External Services:"
        check_port 6379 && echo "  ✅ Redis (6379)" || echo "  ❌ Redis (6379)"
        check_port 11434 && echo "  ✅ Ollama (11434)" || echo "  ❌ Ollama (11434)"
        check_port 54321 && echo "  ✅ Supabase (54321)" || echo "  ❌ Supabase (54321)"
    fi
}

# Function to save PIDs
save_pids() {
    # PIDs are already saved inline when services start
    return 0
}

# Function to show logs
show_logs() {
    local service=$1
    local log_file="/tmp/${service}.log"
    
    if [ -f "$log_file" ]; then
        echo "═══════════════════════════════════════════"
        echo "Logs for $service:"
        echo "═══════════════════════════════════════════"
        tail -n 50 "$log_file"
    else
        log_error "No logs found for $service"
    fi
}

# Main menu
show_help() {
    echo "🚀 Universal AI Tools - Unified Service Manager"
    echo "═══════════════════════════════════════════════"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  start-all       Start all services"
    echo "  start-rust      Start Rust services only"
    echo "  start-go        Start Go services only"
    echo "  start-python    Start Python services only"
    echo "  start-ts        Start TypeScript services only"
    echo "  stop            Stop all services"
    echo "  restart         Restart all services"
    echo "  status          Check service status"
    echo "  logs <service>  Show logs for a service"
    echo "  help            Show this help message"
    echo ""
    echo "Options:"
    echo "  --skip-build    Skip building Rust services"
    echo ""
    echo "Examples:"
    echo "  $0 start-all              # Start everything"
    echo "  $0 start-rust --skip-build # Start Rust without rebuilding"
    echo "  $0 logs rust-auth         # View Rust auth service logs"
    echo "  $0 status                 # Check what's running"
    echo ""
}

# Handle command line arguments
case "$1" in
    start-all)
        log_info "Starting all services..."
        start_external_services
        start_rust_services "$2"
        start_go_services
        start_python_services
        start_typescript_services
        save_pids
        echo ""
        log_success "All services started!"
        echo ""
        check_status
        ;;
    
    start-rust)
        start_rust_services "$2"
        save_pids
        ;;
    
    start-go)
        start_go_services
        save_pids
        ;;
    
    start-python)
        start_python_services
        save_pids
        ;;
    
    start-ts)
        start_typescript_services
        save_pids
        ;;
    
    stop)
        stop_all_services
        ;;
    
    restart)
        stop_all_services
        sleep 2
        $0 start-all "$2"
        ;;
    
    status)
        check_status
        ;;
    
    logs)
        if [ -z "$2" ]; then
            echo "Please specify a service name"
            echo "Available logs:"
            ls -la /tmp/*.log 2>/dev/null | awk '{print $9}' | sed 's|/tmp/||' | sed 's|.log||'
        else
            show_logs "$2"
        fi
        ;;
    
    *)
        show_help
        ;;
esac