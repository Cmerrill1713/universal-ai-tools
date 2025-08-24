#!/bin/bash
# Universal AI Tools - Automated Production Deployment
# Complete deployment pipeline with safety checks

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_ROOT/backups/$(date +%Y%m%d-%H%M%S)"

# Configuration
DOMAIN="${DOMAIN:-yourdomain.com}"
BRANCH="${BRANCH:-master}"
SKIP_BACKUP="${SKIP_BACKUP:-false}"
SKIP_BUILD="${SKIP_BUILD:-false}"

# Function to create backup
create_backup() {
    if [ "$SKIP_BACKUP" = "true" ]; then
        print_info "Skipping backup (SKIP_BACKUP=true)"
        return 0
    fi
    
    print_info "Creating backup..."
    mkdir -p "$BACKUP_DIR"
    
    # Backup environment files
    cp -f .env.production.local "$BACKUP_DIR/" 2>/dev/null || true
    cp -f PRODUCTION_CREDENTIALS.txt "$BACKUP_DIR/" 2>/dev/null || true
    
    # Backup Docker volumes
    docker run --rm -v universal-ai-tools-production_postgres_data:/source:ro -v "$BACKUP_DIR":/backup alpine tar czf /backup/postgres_data.tar.gz -C /source . 2>/dev/null || true
    docker run --rm -v universal-ai-tools-production_grafana_data:/source:ro -v "$BACKUP_DIR":/backup alpine tar czf /backup/grafana_data.tar.gz -C /source . 2>/dev/null || true
    
    print_status "Backup created in $BACKUP_DIR"
}

# Function to pull latest code
pull_latest_code() {
    print_info "Pulling latest code from $BRANCH branch..."
    
    # Stash any local changes
    git stash push -m "Auto-stash before deployment $(date)" 2>/dev/null || true
    
    # Pull latest changes
    git fetch origin
    git checkout "$BRANCH"
    git pull origin "$BRANCH"
    
    print_status "Code updated to latest $BRANCH"
}

# Function to build images
build_images() {
    if [ "$SKIP_BUILD" = "true" ]; then
        print_info "Skipping build (SKIP_BUILD=true)"
        return 0
    fi
    
    print_info "Building production Docker images..."
    
    # Build with cache
    docker-compose -f docker-compose.prod.yml build --parallel
    
    # Prune unused images to save space
    docker image prune -f
    
    print_status "Images built successfully"
}

# Function to run pre-deployment tests
run_pre_deployment_tests() {
    print_info "Running pre-deployment tests..."
    
    # Check if environment file exists
    if [ ! -f ".env.production.local" ]; then
        print_error "Production environment file not found"
        print_info "Run: ./scripts/setup-production.sh to create it"
        exit 1
    fi
    
    # Validate Docker Compose configuration
    if ! docker-compose -f docker-compose.prod.yml config >/dev/null 2>&1; then
        print_error "Docker Compose configuration is invalid"
        exit 1
    fi
    
    print_status "Pre-deployment tests passed"
}

# Function to deploy services
deploy_services() {
    print_info "Deploying production services..."
    
    # Stop existing services gracefully
    docker-compose -f docker-compose.prod.yml down --remove-orphans
    
    # Start services with health checks
    docker-compose -f docker-compose.prod.yml up -d --wait
    
    print_status "Services deployed successfully"
}

# Function to run post-deployment validation
run_post_deployment_validation() {
    print_info "Running post-deployment validation..."
    
    # Wait a moment for services to stabilize
    sleep 30
    
    # Run validation script
    "$SCRIPT_DIR/validate-deployment.sh"
    
    print_status "Post-deployment validation completed"
}

# Function to setup monitoring alerts
setup_monitoring() {
    print_info "Setting up monitoring and alerts..."
    
    # Restart Prometheus to reload configuration
    docker-compose -f docker-compose.prod.yml restart prometheus
    
    # Wait for Prometheus to be ready
    sleep 15
    
    print_status "Monitoring setup completed"
}

# Function to cleanup old resources
cleanup_old_resources() {
    print_info "Cleaning up old resources..."
    
    # Remove old Docker images (keep last 3 versions)
    docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.CreatedAt}}" | grep "universal-ai-tools" | tail -n +4 | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true
    
    # Clean up old backups (keep last 5)
    find "$PROJECT_ROOT/backups" -maxdepth 1 -type d -name "20*" | sort -r | tail -n +6 | xargs -r rm -rf 2>/dev/null || true
    
    print_status "Cleanup completed"
}

# Function to send deployment notification
send_notification() {
    local status=$1
    local webhook_url="${DEPLOYMENT_WEBHOOK_URL:-}"
    
    if [ -n "$webhook_url" ]; then
        curl -X POST "$webhook_url" \
            -H "Content-Type: application/json" \
            -d "{
                \"text\": \"Universal AI Tools deployment $status\",
                \"domain\": \"$DOMAIN\",
                \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
                \"status\": \"$status\"
            }" 2>/dev/null || true
    fi
}

# Main deployment function
main() {
    echo -e "${BLUE}🚀 Universal AI Tools - Production Deployment${NC}"
    echo "================================================================"
    echo "Domain: $DOMAIN"
    echo "Branch: $BRANCH"
    echo "Time: $(date)"
    echo "================================================================"
    
    # Change to project directory
    cd "$PROJECT_ROOT"
    
    # Send start notification
    send_notification "started"
    
    # Create backup
    create_backup
    
    # Pull latest code
    pull_latest_code
    
    # Run pre-deployment tests
    run_pre_deployment_tests
    
    # Build images
    build_images
    
    # Deploy services
    deploy_services
    
    # Setup monitoring
    setup_monitoring
    
    # Run post-deployment validation
    run_post_deployment_validation
    
    # Cleanup old resources
    cleanup_old_resources
    
    # Send success notification
    send_notification "completed"
    
    echo
    print_status "🎉 Production deployment completed successfully!"
    echo
    print_info "Your Universal AI Tools deployment is live at: https://$DOMAIN"
    print_info "Grafana dashboard: https://$DOMAIN/grafana"
    print_info "Backup created in: $BACKUP_DIR"
    echo
    print_warning "Don't forget to:"
    print_warning "1. Monitor the application for the first few hours"
    print_warning "2. Check logs: docker-compose -f docker-compose.prod.yml logs -f"
    print_warning "3. Verify all endpoints are working correctly"
}

# Handle errors
trap 'print_error "Deployment failed at line $LINENO"; send_notification "failed"; exit 1' ERR

# Run main function
main "$@"
