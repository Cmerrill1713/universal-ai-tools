#!/usr/bin/env bash

# Optimized Service Startup with Dependency Management
# Starts services in the correct order based on dependencies

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Service status tracking
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PID_FILE="$PROJECT_ROOT/.service-pids"

# Service dependency definitions
# Format: "service_name:dependencies:port:type:command"
declare -a SERVICE_DEFINITIONS=(
    # Tier 1: External dependencies (must be running first)
    "redis:none:6379:external:redis-server"
    "supabase:none:54321:external:supabase start"
    "ollama:none:11434:external:ollama serve"
    
    # Tier 2: Core infrastructure services
    "rust-auth:redis:8016:rust:cd rust-services && PORT=8016 cargo run -p rust-auth-service --bin rust-auth-server"
    "go-auth:none:8015:go:PORT=8015 go run simple-auth-service.go"
    "go-memory:none:8017:go:PORT=8017 go run simple-memory-service.go"
    
    # Tier 3: Processing services (depend on core services)
    "param-analytics:redis:8028:rust:cd rust-services/parameter-analytics-service && PORT=8028 cargo run --bin parameter-analytics-server"
    "fast-llm:rust-auth:8021:rust:PORT=8021 cargo run -p fast-llm-coordinator"
    "intelligent-params:redis,param-analytics:8022:rust:PORT=8022 cargo run -p intelligent-parameter-service"
    "ab-mcts:rust-auth:8023:rust:PORT=8023 cargo run -p ab-mcts-service --bin ab-mcts-server"
    
    # Tier 4: API and gateway services
    "go-gateway:go-auth,go-memory:8080:go:go run simple-api-gateway.go"
    "go-websocket:go-auth:8014:go:PORT=8014 go run simple-websocket-service.go"
    "go-files:go-memory:8019:go:PORT=8019 go run go-file-management-service.go"
    
    # Tier 5: Python services (depend on API availability)
    "dspy-orchestrator:go-gateway:8090:python:cd python-services/dspy-orchestrator && python run_service.py"
    "pyvision:go-gateway:8091:python:cd python-services/pyvision && python run_service.py"
    
    # Tier 6: Main application (depends on everything)
    "main-api:rust-auth,go-gateway,param-analytics:9999:typescript:npm run dev"
)

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
    
    echo -n "   Waiting for $name on port $port"
    while [ $waited -lt $max_wait ]; do
        if check_port $port; then
            echo ""
            log_success "$name is ready on port $port"
            return 0
        fi
        sleep 1
        waited=$((waited + 1))
        echo -n "."
    done
    
    echo ""
    log_error "$name failed to start on port $port within ${max_wait}s"
    return 1
}

# Function to check if all dependencies are met
dependencies_met() {
    local deps=$1
    
    if [ "$deps" = "none" ]; then
        return 0
    fi
    
    IFS=',' read -ra DEP_ARRAY <<< "$deps"
    for dep in "${DEP_ARRAY[@]}"; do
        if [ "$dep" = "redis" ]; then
            check_port 6379 || return 1
        elif [ "$dep" = "supabase" ]; then
            check_port 54321 || return 1
        elif [ "$dep" = "ollama" ]; then
            check_port 11434 || return 1
        elif [ "$dep" = "rust-auth" ]; then
            check_port 8016 || return 1
        elif [ "$dep" = "go-auth" ]; then
            check_port 8015 || return 1
        elif [ "$dep" = "go-memory" ]; then
            check_port 8017 || return 1
        elif [ "$dep" = "param-analytics" ]; then
            check_port 8028 || return 1
        elif [ "$dep" = "go-gateway" ]; then
            check_port 8080 || return 1
        fi
    done
    
    return 0
}

# Function to start a service
start_service() {
    local service_def=$1
    IFS=':' read -ra PARTS <<< "$service_def"
    local name="${PARTS[0]}"
    local deps="${PARTS[1]}"
    local port="${PARTS[2]}"
    local type="${PARTS[3]}"
    local command="${PARTS[4]}"
    
    # Check if already running
    if check_port $port; then
        log_warning "$name already running on port $port"
        return 0
    fi
    
    # Check dependencies
    if ! dependencies_met "$deps"; then
        log_error "Dependencies not met for $name (needs: $deps)"
        return 1
    fi
    
    log_info "Starting $name ($type service)..."
    
    # Handle different service types
    case $type in
        "external")
            log_warning "Please ensure $name is running on port $port"
            # Check if it's actually running
            if check_port $port; then
                log_success "$name is already running"
                return 0
            else
                log_error "$name is not running. Please start it manually: $command"
                return 1
            fi
            ;;
            
        "rust")
            cd "$PROJECT_ROOT"
            eval "$command > /tmp/$name.log 2>&1 &"
            local pid=$!
            echo "$name=$pid" >> "$PID_FILE"
            wait_for_service "$name" $port
            ;;
            
        "go")
            cd "$PROJECT_ROOT"
            eval "$command > /tmp/$name.log 2>&1 &"
            local pid=$!
            echo "$name=$pid" >> "$PID_FILE"
            wait_for_service "$name" $port
            ;;
            
        "python")
            cd "$PROJECT_ROOT"
            if [ -d "$(echo $command | cut -d' ' -f2)" ]; then
                eval "$command > /tmp/$name.log 2>&1 &"
                local pid=$!
                echo "$name=$pid" >> "$PID_FILE"
                wait_for_service "$name" $port
            else
                log_warning "Python service directory not found for $name"
                return 1
            fi
            ;;
            
        "typescript")
            cd "$PROJECT_ROOT"
            eval "$command > /tmp/$name.log 2>&1 &"
            local pid=$!
            echo "$name=$pid" >> "$PID_FILE"
            wait_for_service "$name" $port
            ;;
    esac
}

# Function to get services by tier
get_services_by_tier() {
    local tier=$1
    case $tier in
        1) echo "${SERVICE_DEFINITIONS[@]}" | tr ' ' '\n' | grep -E ":none:(6379|54321|11434):" || true ;;
        2) echo "${SERVICE_DEFINITIONS[@]}" | tr ' ' '\n' | grep -E ":(redis|none):(8016|8015|8017):" | grep -v external || true ;;
        3) echo "${SERVICE_DEFINITIONS[@]}" | tr ' ' '\n' | grep -E ":(redis|rust-auth):(8028|8021|8022|8023):" || true ;;
        4) echo "${SERVICE_DEFINITIONS[@]}" | tr ' ' '\n' | grep -E ":8080:|:8014:|:8019:" || true ;;
        5) echo "${SERVICE_DEFINITIONS[@]}" | tr ' ' '\n' | grep -E ":809[01]:" || true ;;
        6) echo "${SERVICE_DEFINITIONS[@]}" | tr ' ' '\n' | grep -E ":9999:" || true ;;
    esac
}

# Main startup function
start_all_optimized() {
    log_info "🚀 Starting Universal AI Tools with optimized dependency order"
    echo "═══════════════════════════════════════════════════════════════"
    
    # Clear existing PID file
    > "$PID_FILE"
    
    # Start services tier by tier
    for tier in {1..6}; do
        local tier_name=""
        case $tier in
            1) tier_name="External Dependencies" ;;
            2) tier_name="Core Infrastructure" ;;
            3) tier_name="Processing Services" ;;
            4) tier_name="API Gateway Services" ;;
            5) tier_name="Python Services" ;;
            6) tier_name="Main Application" ;;
        esac
        
        echo ""
        log_info "📦 Tier $tier: $tier_name"
        echo "───────────────────────────────────────────────────────────────"
        
        local services=$(get_services_by_tier $tier)
        if [ -n "$services" ]; then
            while IFS= read -r service_def; do
                [ -n "$service_def" ] && start_service "$service_def"
                sleep 1  # Brief pause between service starts
            done <<< "$services"
        else
            log_warning "No services defined for tier $tier"
        fi
        
        # Health check after each tier
        sleep 2
        local healthy_count=0
        local total_count=0
        
        while IFS= read -r service_def; do
            [ -z "$service_def" ] && continue
            IFS=':' read -ra PARTS <<< "$service_def"
            local port="${PARTS[2]}"
            total_count=$((total_count + 1))
            if check_port $port; then
                healthy_count=$((healthy_count + 1))
            fi
        done <<< "$services"
        
        if [ $total_count -gt 0 ]; then
            local tier_health=$((healthy_count * 100 / total_count))
            log_info "Tier $tier health: ${healthy_count}/${total_count} services (${tier_health}%)"
        fi
    done
    
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    log_success "🎉 Optimized startup sequence completed!"
    
    # Final health check
    echo ""
    log_info "🏥 Final System Health Check"
    if command -v tsx >/dev/null 2>&1; then
        tsx "$PROJECT_ROOT/test-service-health.ts"
    else
        log_warning "tsx not available, run 'npm run services:health' manually"
    fi
}

# Function to show startup plan
show_startup_plan() {
    echo "🚀 Universal AI Tools - Optimized Startup Plan"
    echo "═══════════════════════════════════════════════════════════════"
    
    for tier in {1..6}; do
        local tier_name=""
        case $tier in
            1) tier_name="External Dependencies" ;;
            2) tier_name="Core Infrastructure" ;;
            3) tier_name="Processing Services" ;;
            4) tier_name="API Gateway Services" ;;
            5) tier_name="Python Services" ;;
            6) tier_name="Main Application" ;;
        esac
        
        echo ""
        echo "📦 Tier $tier: $tier_name"
        echo "───────────────────────────────────────────────────────────────"
        
        local services=$(get_services_by_tier $tier)
        if [ -n "$services" ]; then
            while IFS= read -r service_def; do
                if [ -n "$service_def" ]; then
                    IFS=':' read -ra PARTS <<< "$service_def"
                    local name="${PARTS[0]}"
                    local deps="${PARTS[1]}"
                    local port="${PARTS[2]}"
                    local type="${PARTS[3]}"
                    
                    if [ "$deps" = "none" ]; then
                        echo "   • $name ($type) on port $port"
                    else
                        echo "   • $name ($type) on port $port [depends on: $deps]"
                    fi
                fi
            done <<< "$services"
        fi
    done
    
    echo ""
    echo "💡 Benefits of optimized startup:"
    echo "   • Services start in dependency order"
    echo "   • Prevents startup failures due to missing dependencies"
    echo "   • Faster overall startup time"
    echo "   • Better error reporting and recovery"
}

# Handle command line arguments
case "$1" in
    start)
        start_all_optimized
        ;;
    plan)
        show_startup_plan
        ;;
    *)
        echo "Usage: $0 {start|plan}"
        echo ""
        echo "Commands:"
        echo "  start  - Start all services with optimized dependency order"
        echo "  plan   - Show the startup plan without executing"
        echo ""
        ;;
esac