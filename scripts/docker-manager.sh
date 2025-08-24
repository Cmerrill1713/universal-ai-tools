#!/bin/bash

# Universal AI Tools - Docker Management Script
# Comprehensive Docker container management with health monitoring

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"
COMPOSE_PROD_FILE="$PROJECT_ROOT/docker-compose.prod.yml"
ENV_FILE="$PROJECT_ROOT/.env"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

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

log_debug() {
    echo -e "${PURPLE}[DEBUG]${NC} $1"
}

log_header() {
    echo -e "${CYAN}=== $1 ===${NC}"
}

# Check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker Desktop."
        exit 1
    fi
}

# Function to check if docker-compose is available
check_docker_compose() {
    if ! command -v docker-compose >/dev/null 2>&1; then
        log_error "docker-compose is not installed. Please install it first."
        exit 1
    fi
}

# Function to validate environment file
validate_env() {
    if [[ ! -f "$ENV_FILE" ]]; then
        log_warning ".env file not found. Checking for template..."
        if [[ -f "$PROJECT_ROOT/.env.example" ]]; then
            log_info "Found .env.example. You should copy it to .env and configure your values:"
            log_info "cp .env.example .env"
            log_warning "Using default environment variables for now..."
        else
            log_error "No .env or .env.example file found. Cannot proceed safely."
            exit 1
        fi
    else
        log_success "Environment file found: $ENV_FILE"
        
        # Check for placeholder values
        local placeholders=(
            "your-supabase-anon-key"
            "your-supabase-service-role-key"
            "your-openai-api-key"
            "your-anthropic-api-key"
            "your-secure-postgres-password"
        )
        
        local found_placeholders=()
        for placeholder in "${placeholders[@]}"; do
            if grep -q "$placeholder" "$ENV_FILE" 2>/dev/null; then
                found_placeholders+=("$placeholder")
            fi
        done
        
        if [[ ${#found_placeholders[@]} -gt 0 ]]; then
            log_warning "Found placeholder values in .env file:"
            for placeholder in "${found_placeholders[@]}"; do
                log_warning "  - $placeholder"
            done
            log_warning "Please update these values with your actual credentials."
        fi
    fi
}

# Build images
build() {
    log_info "Building Docker images..."
    check_docker
    check_env_file
    
    if [ "$1" = "dev" ]; then
        docker-compose -f $DEV_COMPOSE_FILE build --no-cache
    else
        docker-compose -f $COMPOSE_FILE build --no-cache
    fi
    
    log_success "Images built successfully!"
}

# Function to start services
start_services() {
    local profile="${1:-}"
    
    log_header "Starting Universal AI Tools Services"
    
    validate_env
    
    local compose_args=("-f" "$COMPOSE_FILE")
    
    if [[ -n "$profile" ]]; then
        compose_args+=("--profile" "$profile")
        log_info "Starting with profile: $profile"
    fi
    
    log_info "Building and starting services..."
    docker-compose "${compose_args[@]}" up -d --build
    
    log_info "Waiting for services to be healthy..."
    sleep 10
    
    show_status
}

# Function to start production services
start_production() {
    log_header "Starting Production Services"
    
    validate_env
    
    log_info "Starting production environment..."
    docker-compose -f "$COMPOSE_PROD_FILE" up -d --build
    
    log_info "Waiting for services to be healthy..."
    sleep 15
    
    show_status
}

# Function to stop services
stop_services() {
    log_header "Stopping Services"
    
    if docker-compose -f "$COMPOSE_FILE" ps | grep -q "Up"; then
        docker-compose -f "$COMPOSE_FILE" down
        log_success "Development services stopped."
    fi
    
    if docker-compose -f "$COMPOSE_PROD_FILE" ps | grep -q "Up" 2>/dev/null; then
        docker-compose -f "$COMPOSE_PROD_FILE" down
        log_success "Production services stopped."
    fi
}

# Restart services
restart() {
    log_info "Restarting Universal AI Tools..."
    stop "$1"
    start "$1"
}

# Show logs
logs() {
    if [ "$1" = "dev" ]; then
        docker-compose -f $DEV_COMPOSE_FILE logs -f "${@:2}"
    else
        docker-compose -f $COMPOSE_FILE logs -f "${@:2}"
    fi
}

# Function to show service status
show_status() {
    log_header "Service Status"
    
    if docker-compose -f "$COMPOSE_FILE" ps | grep -q "Up"; then
        docker-compose -f "$COMPOSE_FILE" ps
        echo
        
        log_header "Health Checks"
        local services=("app" "postgres" "redis" "ollama")
        
        for service in "${services[@]}"; do
            local health=$(docker-compose -f "$COMPOSE_FILE" ps -q "$service" 2>/dev/null | xargs -r docker inspect --format='{{.State.Health.Status}}' 2>/dev/null || echo "unknown")
            
            case $health in
                "healthy")
                    log_success "$service: $health"
                    ;;
                "unhealthy")
                    log_error "$service: $health"
                    ;;
                "starting")
                    log_warning "$service: $health"
                    ;;
                *)
                    log_info "$service: $health"
                    ;;
            esac
        done
    else
        log_info "No services are currently running."
    fi
}

# Function to run health checks
health_check() {
    log_header "Comprehensive Health Check"
    
    # Check Docker daemon
    if check_docker; then
        log_success "Docker daemon is running"
    else
        return 1
    fi
    
    # Check services
    local services=("app" "postgres" "redis")
    local all_healthy=true
    
    for service in "${services[@]}"; do
        local container_id=$(docker-compose -f "$COMPOSE_FILE" ps -q "$service" 2>/dev/null)
        
        if [[ -n "$container_id" ]]; then
            local health=$(docker inspect --format='{{.State.Health.Status}}' "$container_id" 2>/dev/null || echo "no-healthcheck")
            
            case $health in
                "healthy")
                    log_success "$service: healthy"
                    ;;
                "unhealthy")
                    log_error "$service: unhealthy"
                    all_healthy=false
                    ;;
                "starting")
                    log_warning "$service: starting"
                    ;;
                "no-healthcheck")
                    log_info "$service: no health check configured"
                    ;;
                *)
                    log_warning "$service: unknown status ($health)"
                    ;;
            esac
        else
            log_error "$service: not running"
            all_healthy=false
        fi
    done
    
    if $all_healthy; then
        log_success "All services are healthy!"
        return 0
    else
        log_error "Some services are not healthy"
        return 1
    fi
}

# Pull latest models for Ollama
pull_models() {
    log_info "Pulling recommended models for Ollama..."
    
    models=(
        "llama3.2:3b"
        "codellama:7b"
        "phi3:mini"
        "nomic-embed-text"
    )
    
    for model in "${models[@]}"; do
        log_info "Pulling model: $model"
        docker exec universal-ai-ollama ollama pull "$model"
    done
    
    log_success "Models pulled successfully!"
}

# Clean up
clean() {
    log_info "Cleaning up Docker resources..."
    
    # Stop and remove containers
    if [ "$1" = "dev" ]; then
        docker-compose -f $DEV_COMPOSE_FILE down -v --remove-orphans
    else
        docker-compose -f $COMPOSE_FILE down -v --remove-orphans
    fi
    
    # Remove images
    docker image prune -f
    
    # Remove unused volumes
    docker volume prune -f
    
    log_success "Cleanup completed!"
}

# Reset everything
reset() {
    log_warning "This will remove all containers, images, and volumes. Are you sure? (y/N)"
    read -r response
    
    if [[ "$response" =~ ^[Yy]$ ]]; then
        log_info "Resetting Universal AI Tools..."
        
        # Stop all services
        stop "$1"
        
        # Remove everything
        docker system prune -a -f --volumes
        
        log_success "Reset completed!"
    else
        log_info "Reset cancelled."
    fi
}

# Show help
help() {
    echo "Universal AI Tools Docker Manager"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  build [dev]     Build Docker images"
    echo "  start [dev]     Start services"
    echo "  stop [dev]      Stop services"
    echo "  restart [dev]   Restart services"
    echo "  logs [dev]      Show logs"
    echo "  status [dev]    Show service status"
    echo "  health          Check service health"
    echo "  pull-models     Pull recommended Ollama models"
    echo "  clean [dev]     Clean up Docker resources"
    echo "  reset [dev]     Reset everything (WARNING: destructive)"
    echo "  help            Show this help message"
    echo ""
    echo "Options:"
    echo "  dev             Use development configuration"
    echo ""
    echo "Examples:"
    echo "  $0 start dev    Start development environment"
    echo "  $0 logs         Show production logs"
    echo "  $0 health       Check service health"
}

# Function to show help
show_help() {
    cat << EOF
Universal AI Tools - Docker Management Script

USAGE:
    $0 [COMMAND] [OPTIONS]

COMMANDS:
    start [PROFILE]     Start development services (optional profile: monitoring, tools, mcp)
    start-prod          Start production services
    stop                Stop all services
    restart [PROFILE]   Restart services
    status              Show service status and health
    logs [SERVICE]      Show logs (optionally for specific service)
    monitor             Show resource usage
    health              Run comprehensive health check
    backup [DIR]        Backup Docker volumes to directory (default: ./backups)
    cleanup             Clean up unused Docker resources
    reset               Remove ALL Docker resources (destructive!)
    help                Show this help message

EXAMPLES:
    $0 start                    # Start basic services
    $0 start monitoring         # Start with monitoring stack
    $0 logs app                 # Show application logs
    $0 backup /tmp/backups      # Backup to specific directory
    $0 health                   # Check all service health

PROFILES:
    monitoring                  # Include Prometheus + Grafana
    tools                       # Include pgAdmin + Redis Commander
    mcp                         # Include MCP servers
    full                        # Include everything

EOF
}

# Main script logic
main() {
    check_docker
    check_docker_compose
    
    case "${1:-help}" in
        "start")
            start_services "${2:-}"
            ;;
        "start-prod"|"production")
            start_production
            ;;
        "stop")
            stop_services
            ;;
        "restart")
            stop_services
            sleep 5
            start_services "${2:-}"
            ;;
        "status")
            show_status
            ;;
        "logs")
            if [[ -n "${2:-}" ]]; then
                docker-compose -f "$COMPOSE_FILE" logs --tail=100 -f "$2"
            else
                docker-compose -f "$COMPOSE_FILE" logs --tail=100 -f
            fi
            ;;
        "monitor"|"resources")
            log_header "Docker Resource Monitoring"
            echo "Container Resource Usage:"
            docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}"
            echo
            echo "System Resource Usage:"
            docker system df
            ;;
        "health"|"check")
            health_check
            ;;
        "backup")
            log_warning "Backup functionality not yet implemented in enhanced version"
            ;;
        "cleanup"|"clean")
            log_header "Docker Cleanup"
            log_info "Stopping all containers..."
            stop_services
            log_info "Removing unused containers..."
            docker container prune -f
            log_info "Removing unused images..."
            docker image prune -f
            log_info "Removing unused volumes..."
            docker volume prune -f
            log_info "Removing unused networks..."
            docker network prune -f
            log_success "Docker cleanup completed!"
            ;;
        "reset")
            log_header "Resetting All Docker Resources"
            read -p "This will remove ALL containers, images, volumes, and networks. Are you sure? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                log_warning "Removing all Docker resources..."
                docker system prune -a -f --volumes
                log_success "Complete Docker reset finished!"
            else
                log_info "Reset cancelled."
            fi
            ;;
        "help"|"--help"|"-h")
            show_help
            ;;
        *)
            log_error "Unknown command: $1"
            echo
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"