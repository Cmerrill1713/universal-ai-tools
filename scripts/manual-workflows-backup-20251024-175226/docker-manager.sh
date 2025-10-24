#!/bin/bash

# Universal AI Tools Docker Manager
# This script helps manage Docker containers for the Universal AI Tools project

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="universal-ai-tools"
COMPOSE_FILE="docker-compose.yml"
DEV_COMPOSE_FILE="docker-compose.dev.yml"

# Helper functions
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

# Check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker Desktop."
        exit 1
    fi
}

# Check if environment file exists
check_env_file() {
    if [ ! -f ".env" ]; then
        log_warning ".env file not found. Creating from .env.example..."
        if [ -f ".env.example" ]; then
            cp .env.example .env
            log_info "Please edit .env file with your configuration values."
        else
            log_error ".env.example file not found. Please create .env file manually."
            exit 1
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

# Start services
start() {
    log_info "Starting Universal AI Tools..."
    check_docker
    check_env_file
    
    if [ "$1" = "dev" ]; then
        docker-compose -f $DEV_COMPOSE_FILE up -d
        log_success "Development environment started!"
        log_info "API available at: http://localhost:9999"
        log_info "Logs: docker-compose -f $DEV_COMPOSE_FILE logs -f"
    else
        docker-compose -f $COMPOSE_FILE up -d
        log_success "Production environment started!"
        log_info "API available at: http://localhost:9999"
        log_info "Dashboard available at: http://localhost:3001"
        log_info "Monitoring available at: http://localhost:3003"
        log_info "Logs: docker-compose -f $COMPOSE_FILE logs -f"
    fi
}

# Stop services
stop() {
    log_info "Stopping Universal AI Tools..."
    
    if [ "$1" = "dev" ]; then
        docker-compose -f $DEV_COMPOSE_FILE down
    else
        docker-compose -f $COMPOSE_FILE down
    fi
    
    log_success "Services stopped!"
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

# Show status
status() {
    log_info "Service Status:"
    
    if [ "$1" = "dev" ]; then
        docker-compose -f $DEV_COMPOSE_FILE ps
    else
        docker-compose -f $COMPOSE_FILE ps
    fi
}

# Health check
health() {
    log_info "Checking service health..."
    
    # Check API health
    if curl -f http://localhost:9999/api/health >/dev/null 2>&1; then
        log_success "API is healthy"
    else
        log_error "API is not responding"
    fi
    
    # Check Redis
    if docker exec universal-ai-redis redis-cli ping >/dev/null 2>&1; then
        log_success "Redis is healthy"
    else
        log_error "Redis is not responding"
    fi
    
    # Check Ollama
    if curl -f http://localhost:11434/api/tags >/dev/null 2>&1; then
        log_success "Ollama is healthy"
    else
        log_error "Ollama is not responding"
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

# Main script
case "$1" in
    build)
        build "$2"
        ;;
    start)
        start "$2"
        ;;
    stop)
        stop "$2"
        ;;
    restart)
        restart "$2"
        ;;
    logs)
        logs "$2" "${@:3}"
        ;;
    status)
        status "$2"
        ;;
    health)
        health
        ;;
    pull-models)
        pull_models
        ;;
    clean)
        clean "$2"
        ;;
    reset)
        reset "$2"
        ;;
    help|--help|-h)
        help
        ;;
    *)
        log_error "Unknown command: $1"
        help
        exit 1
        ;;
esac