#!/bin/bash

# Sweet Athena Deployment Script
# Automates the deployment process with health checks and rollback capability

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEPLOYMENT_ENV=${1:-staging}
DOCKER_REGISTRY=${DOCKER_REGISTRY:-"docker.io/yourusername"}
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
HEALTH_CHECK_RETRIES=30
HEALTH_CHECK_INTERVAL=10

# Functions
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

# Pre-deployment checks
pre_deployment_checks() {
    log_info "Running pre-deployment checks..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check environment files
    if [ ! -f ".env.$DEPLOYMENT_ENV" ]; then
        log_error "Environment file .env.$DEPLOYMENT_ENV not found"
        exit 1
    fi
    
    # Check UE5 project
    if [ ! -d "$HOME/UE5-SweetAthena" ]; then
        log_warning "UE5 project directory not found. Creating..."
        mkdir -p "$HOME/UE5-SweetAthena"
    fi
    
    log_success "Pre-deployment checks passed"
}

# Backup current deployment
backup_current_deployment() {
    log_info "Backing up current deployment..."
    
    mkdir -p "$BACKUP_DIR"
    
    # Backup database
    if docker ps --format '{{.Names}}' | grep -q "postgres"; then
        docker exec postgres pg_dump -U sweet_athena sweet_athena > "$BACKUP_DIR/database.sql"
        log_success "Database backed up"
    fi
    
    # Backup configuration
    cp -r config "$BACKUP_DIR/" 2>/dev/null || true
    cp .env* "$BACKUP_DIR/" 2>/dev/null || true
    
    # Backup docker volumes
    docker run --rm -v sweet-athena_postgres_data:/data -v "$PWD/$BACKUP_DIR":/backup alpine tar czf /backup/postgres_data.tar.gz -C /data . 2>/dev/null || true
    
    log_success "Backup completed: $BACKUP_DIR"
}

# Build images
build_images() {
    log_info "Building Docker images..."
    
    # Build backend
    docker build -t "$DOCKER_REGISTRY/sweet-athena-backend:latest" \
                 -t "$DOCKER_REGISTRY/sweet-athena-backend:$DEPLOYMENT_ENV-$(git rev-parse --short HEAD)" \
                 -f Dockerfile.sweet-athena \
                 --target production .
    
    # Build signalling server
    if [ -d "$HOME/UE5-SweetAthena/Scripts/SignallingServer" ]; then
        docker build -t "$DOCKER_REGISTRY/sweet-athena-signalling:latest" \
                     -t "$DOCKER_REGISTRY/sweet-athena-signalling:$DEPLOYMENT_ENV-$(git rev-parse --short HEAD)" \
                     "$HOME/UE5-SweetAthena/Scripts/SignallingServer"
    fi
    
    log_success "Images built successfully"
}

# Deploy services
deploy_services() {
    log_info "Deploying Sweet Athena services..."
    
    # Load environment
    export $(cat ".env.$DEPLOYMENT_ENV" | grep -v '^#' | xargs)
    
    # Pull latest images (if using registry)
    # docker-compose -f docker-compose.sweet-athena.yml pull
    
    # Deploy with zero downtime
    docker-compose -f docker-compose.sweet-athena.yml up -d --remove-orphans
    
    log_success "Services deployed"
}

# Health checks
run_health_checks() {
    log_info "Running health checks..."
    
    local services=("backend:3002/api/health" "signalling:8080/health" "webserver:80/")
    local all_healthy=true
    
    for service in "${services[@]}"; do
        IFS=':' read -r name endpoint <<< "$service"
        local url="http://localhost:$endpoint"
        local healthy=false
        
        for i in $(seq 1 $HEALTH_CHECK_RETRIES); do
            if curl -f -s "$url" > /dev/null; then
                log_success "$name is healthy"
                healthy=true
                break
            fi
            
            log_info "Waiting for $name... ($i/$HEALTH_CHECK_RETRIES)"
            sleep $HEALTH_CHECK_INTERVAL
        done
        
        if [ "$healthy" = false ]; then
            log_error "$name failed health check"
            all_healthy=false
        fi
    done
    
    if [ "$all_healthy" = false ]; then
        return 1
    fi
    
    log_success "All services are healthy"
    return 0
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    docker exec backend npm run db:migrate
    
    log_success "Migrations completed"
}

# Rollback deployment
rollback_deployment() {
    log_error "Deployment failed, rolling back..."
    
    # Stop new containers
    docker-compose -f docker-compose.sweet-athena.yml down
    
    # Restore database if backup exists
    if [ -f "$BACKUP_DIR/database.sql" ]; then
        docker exec -i postgres psql -U sweet_athena sweet_athena < "$BACKUP_DIR/database.sql"
        log_info "Database restored from backup"
    fi
    
    log_warning "Rollback completed. Please check logs for errors."
    exit 1
}

# Post-deployment tasks
post_deployment_tasks() {
    log_info "Running post-deployment tasks..."
    
    # Clear caches
    docker exec redis redis-cli FLUSHALL
    
    # Warm up services
    curl -s "http://localhost:3002/api/sweet-athena/status" > /dev/null || true
    
    # Generate deployment report
    cat > "deployment-report-$(date +%Y%m%d_%H%M%S).txt" << EOF
Sweet Athena Deployment Report
==============================
Date: $(date)
Environment: $DEPLOYMENT_ENV
Git Commit: $(git rev-parse HEAD)
Git Branch: $(git branch --show-current)

Deployed Services:
$(docker-compose -f docker-compose.sweet-athena.yml ps)

Health Status:
Backend: $(curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/api/health)
Signalling: $(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health)
Web: $(curl -s -o /dev/null -w "%{http_code}" http://localhost:80/)

Next Steps:
1. Open UE5 project and ensure Pixel Streaming is configured
2. Access demo at http://localhost/sweet-athena-demo.html
3. Monitor logs: docker-compose -f docker-compose.sweet-athena.yml logs -f
EOF
    
    log_success "Post-deployment tasks completed"
}

# Main deployment flow
main() {
    log_info "Starting Sweet Athena deployment for environment: $DEPLOYMENT_ENV"
    
    # Run deployment steps
    pre_deployment_checks
    backup_current_deployment
    build_images
    deploy_services
    
    # Health check with rollback on failure
    if ! run_health_checks; then
        rollback_deployment
    fi
    
    # Final steps
    run_migrations
    post_deployment_tasks
    
    log_success "Sweet Athena deployed successfully!"
    log_info "Access the demo at: http://localhost/sweet-athena-demo.html"
    log_info "Monitor services: docker-compose -f docker-compose.sweet-athena.yml logs -f"
}

# Handle errors
trap 'log_error "Deployment failed on line $LINENO"' ERR

# Run main function
main "$@"