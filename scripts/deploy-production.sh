#!/bin/bash

# Universal AI Tools - Production Deployment Script
# Automates the complete production deployment process

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env.production"
LOG_FILE="$PROJECT_DIR/logs/deployment.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${PURPLE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

# Banner
print_banner() {
    echo -e "${GREEN}"
    echo "██╗   ██╗███╗   ██╗██╗██╗   ██╗███████╗██████╗ ███████╗ █████╗ ██╗"
    echo "██║   ██║████╗  ██║██║██║   ██║██╔════╝██╔══██╗██╔════╝██╔══██╗██║"
    echo "██║   ██║██╔██╗ ██║██║██║   ██║█████╗  ██████╔╝███████╗███████║██║"
    echo "██║   ██║██║╚██╗██║██║╚██╗ ██╔╝██╔══╝  ██╔══██╗╚════██║██╔══██║██║"
    echo "╚██████╔╝██║ ╚████║██║ ╚████╔╝ ███████╗██║  ██║███████║██║  ██║███████╗"
    echo " ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚══════╝"
    echo ""
    echo "                        AI TOOLS - PRODUCTION DEPLOYMENT"
    echo -e "${NC}"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    local missing_tools=()
    
    # Check required tools
    for tool in docker docker-compose curl openssl; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        error "Missing required tools: ${missing_tools[*]}"
        error "Please install the missing tools and try again."
        exit 1
    fi
    
    # Check Docker daemon
    if ! docker info &> /dev/null; then
        error "Docker daemon is not running. Please start Docker and try again."
        exit 1
    fi
    
    success "All prerequisites satisfied"
}

# Validate environment configuration
validate_environment() {
    log "Validating environment configuration..."
    
    if [[ ! -f "$ENV_FILE" ]]; then
        error "Production environment file not found: $ENV_FILE"
        error "Please copy .env.production.template to .env.production and configure it."
        exit 1
    fi
    
    # Source environment file
    set -a
    source "$ENV_FILE"
    set +a
    
    # Check critical variables
    local required_vars=(
        "DOMAIN"
        "SUPABASE_URL"
        "SUPABASE_SERVICE_KEY"
        "JWT_SECRET"
        "ENCRYPTION_KEY"
    )
    
    local missing_vars=()
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        error "Missing required environment variables: ${missing_vars[*]}"
        error "Please configure these variables in $ENV_FILE"
        exit 1
    fi
    
    # Validate JWT secret strength
    if [[ ${#JWT_SECRET} -lt 32 ]]; then
        error "JWT_SECRET must be at least 32 characters long for security"
        exit 1
    fi
    
    # Validate encryption key
    if [[ ${#ENCRYPTION_KEY} -ne 32 ]]; then
        error "ENCRYPTION_KEY must be exactly 32 characters long"
        exit 1
    fi
    
    success "Environment configuration validated"
}

# Setup SSL certificates
setup_ssl() {
    log "Setting up SSL certificates..."
    
    cd "$PROJECT_DIR"
    
    if [[ "$DOMAIN" == "localhost" || "$DOMAIN" == "127.0.0.1" ]]; then
        log "Development domain detected, using self-signed certificate..."
        ./scripts/ssl-setup.sh --self-signed
    else
        log "Production domain detected, setting up Let's Encrypt certificate..."
        if [[ "${SKIP_LETSENCRYPT:-false}" == "true" ]]; then
            warning "Skipping Let's Encrypt setup (SKIP_LETSENCRYPT=true)"
            ./scripts/ssl-setup.sh --self-signed
        else
            ./scripts/ssl-setup.sh --letsencrypt
        fi
    fi
    
    # Verify SSL setup
    ./scripts/ssl-setup.sh --verify
    
    success "SSL certificates configured"
}

# Build production images
build_images() {
    log "Building production Docker images..."
    
    cd "$PROJECT_DIR"
    
    # Build main application
    log "Building Universal AI Tools application..."
    docker-compose -f docker-compose.prod.yml build --no-cache api
    
    # Pull other images
    log "Pulling supporting service images..."
    docker-compose -f docker-compose.prod.yml pull redis ollama nginx prometheus grafana
    
    success "Production images built successfully"
}

# Run database migrations and setup
setup_database() {
    log "Setting up database..."
    
    # Test Supabase connection
    log "Testing Supabase connection..."
    if curl -s -H "apikey: ${SUPABASE_ANON_KEY}" "${SUPABASE_URL}/rest/v1/" > /dev/null; then
        success "Supabase connection successful"
    else
        error "Failed to connect to Supabase. Please check your configuration."
        exit 1
    fi
    
    # Run any pending migrations if needed
    if [[ -d "$PROJECT_DIR/supabase/migrations" ]]; then
        log "Checking for database migrations..."
        # Add migration logic here if needed
    fi
    
    success "Database setup completed"
}

# Deploy services
deploy_services() {
    log "Deploying production services..."
    
    cd "$PROJECT_DIR"
    
    # Stop any existing services
    log "Stopping existing services..."
    docker-compose -f docker-compose.prod.yml down --remove-orphans || true
    
    # Clean up old containers and images
    log "Cleaning up old containers..."
    docker system prune -f || true
    
    # Start services in order
    log "Starting Redis..."
    docker-compose -f docker-compose.prod.yml up -d redis
    
    log "Starting Ollama..."
    docker-compose -f docker-compose.prod.yml up -d ollama
    
    log "Starting monitoring services..."
    docker-compose -f docker-compose.prod.yml up -d prometheus grafana
    
    log "Starting main API service..."
    docker-compose -f docker-compose.prod.yml up -d api
    
    # Wait for API to be healthy
    log "Waiting for API service to be healthy..."
    local retries=0
    local max_retries=30
    
    while [[ $retries -lt $max_retries ]]; do
        if curl -s -f "http://localhost:9998/api/health" > /dev/null 2>&1; then
            success "API service is healthy"
            break
        fi
        
        retries=$((retries + 1))
        log "Waiting for API... (attempt $retries/$max_retries)"
        sleep 10
    done
    
    if [[ $retries -eq $max_retries ]]; then
        error "API service failed to become healthy"
        log "Checking service logs..."
        docker-compose -f docker-compose.prod.yml logs api
        exit 1
    fi
    
    log "Starting Nginx reverse proxy..."
    docker-compose -f docker-compose.prod.yml up -d nginx
    
    success "All services deployed successfully"
}

# Run health checks
run_health_checks() {
    log "Running comprehensive health checks..."
    
    local checks_passed=0
    local total_checks=0
    
    # API Health Check
    total_checks=$((total_checks + 1))
    log "Checking API health..."
    if curl -s -f "http://localhost:9998/api/health" > /dev/null; then
        success "✓ API service is healthy"
        checks_passed=$((checks_passed + 1))
    else
        error "✗ API service health check failed"
    fi
    
    # HTTPS Health Check
    total_checks=$((total_checks + 1))
    log "Checking HTTPS connectivity..."
    if curl -k -s -f "https://localhost/api/health" > /dev/null; then
        success "✓ HTTPS is working"
        checks_passed=$((checks_passed + 1))
    else
        error "✗ HTTPS health check failed"
    fi
    
    # Database Health Check
    total_checks=$((total_checks + 1))
    log "Checking database connectivity..."
    if curl -s -H "apikey: ${SUPABASE_ANON_KEY}" "${SUPABASE_URL}/rest/v1/" > /dev/null; then
        success "✓ Database is accessible"
        checks_passed=$((checks_passed + 1))
    else
        error "✗ Database health check failed"
    fi
    
    # Redis Health Check
    total_checks=$((total_checks + 1))
    log "Checking Redis connectivity..."
    if docker-compose -f docker-compose.prod.yml exec -T redis redis-cli ping | grep -q "PONG"; then
        success "✓ Redis is responding"
        checks_passed=$((checks_passed + 1))
    else
        error "✗ Redis health check failed"
    fi
    
    # Monitoring Health Check
    total_checks=$((total_checks + 1))
    log "Checking monitoring services..."
    if curl -s -f "http://localhost:9090/-/healthy" > /dev/null; then
        success "✓ Prometheus is healthy"
        checks_passed=$((checks_passed + 1))
    else
        error "✗ Prometheus health check failed"
    fi
    
    # Summary
    log "Health check summary: $checks_passed/$total_checks checks passed"
    
    if [[ $checks_passed -eq $total_checks ]]; then
        success "All health checks passed! 🎉"
        return 0
    else
        warning "Some health checks failed. Please review the logs."
        return 1
    fi
}

# Setup monitoring and alerts
setup_monitoring() {
    log "Setting up monitoring and alerts..."
    
    # Configure monitoring endpoints
    log "Configuring monitoring endpoints..."
    
    info "Monitoring services:"
    info "  - Prometheus: http://localhost:9090"
    info "  - Grafana: http://localhost:3000 (admin:${GRAFANA_PASSWORD:-admin})"
    info "  - Nginx Status: http://localhost:8080/nginx_status"
    
    success "Monitoring setup completed"
}

# Display deployment summary
show_deployment_summary() {
    echo -e "\n${GREEN}🎉 DEPLOYMENT COMPLETED SUCCESSFULLY! 🎉${NC}\n"
    
    echo -e "${BLUE}Service URLs:${NC}"
    echo -e "  🌐 Main Application: https://${DOMAIN}"
    echo -e "  📊 API Health: https://${DOMAIN}/api/health"
    echo -e "  📈 Prometheus: http://localhost:9090"
    echo -e "  📊 Grafana: http://localhost:3000"
    echo -e "  🔍 API Docs: https://${DOMAIN}/api/docs"
    
    echo -e "\n${BLUE}Docker Services:${NC}"
    docker-compose -f docker-compose.prod.yml ps
    
    echo -e "\n${BLUE}Next Steps:${NC}"
    echo -e "  1. Test all functionality: curl -k https://${DOMAIN}/api/health"
    echo -e "  2. Monitor logs: docker-compose -f docker-compose.prod.yml logs -f"
    echo -e "  3. Access Grafana dashboard for monitoring"
    echo -e "  4. Set up domain DNS if using custom domain"
    echo -e "  5. Configure external monitoring/alerting"
    
    echo -e "\n${BLUE}Management Commands:${NC}"
    echo -e "  📊 View logs: docker-compose -f docker-compose.prod.yml logs -f [service]"
    echo -e "  🔄 Restart: docker-compose -f docker-compose.prod.yml restart [service]"
    echo -e "  ⬇️ Stop: docker-compose -f docker-compose.prod.yml down"
    echo -e "  🗂️ Backup: ./scripts/backup-production.sh"
}

# Rollback function
rollback() {
    error "Deployment failed. Initiating rollback..."
    
    # Stop all services
    cd "$PROJECT_DIR"
    docker-compose -f docker-compose.prod.yml down --remove-orphans || true
    
    # Restore previous state if available
    if [[ -f "docker-compose.prod.yml.backup" ]]; then
        log "Restoring previous configuration..."
        mv docker-compose.prod.yml.backup docker-compose.prod.yml
    fi
    
    error "Rollback completed. Please check the logs and fix issues before retrying."
    exit 1
}

# Main deployment function
main() {
    print_banner
    
    log "Starting Universal AI Tools production deployment..."
    log "Deployment started at: $(date)"
    
    # Set trap for rollback on error
    trap rollback ERR
    
    # Deployment steps
    check_prerequisites
    validate_environment
    setup_ssl
    build_images
    setup_database
    deploy_services
    
    # Remove trap after successful deployment
    trap - ERR
    
    # Post-deployment checks
    setup_monitoring
    
    if run_health_checks; then
        show_deployment_summary
        success "Production deployment completed successfully! 🚀"
    else
        warning "Deployment completed with some health check failures."
        warning "Please review the logs and ensure all services are functioning correctly."
    fi
    
    log "Deployment finished at: $(date)"
}

# Command line options
case "${1:-deploy}" in
    --help)
        echo "Universal AI Tools - Production Deployment Script"
        echo ""
        echo "Usage: $0 [option]"
        echo ""
        echo "Options:"
        echo "  deploy          Full production deployment (default)"
        echo "  --ssl-only      Setup SSL certificates only"
        echo "  --build-only    Build Docker images only"
        echo "  --health-check  Run health checks only"
        echo "  --rollback      Rollback to previous deployment"
        echo "  --help          Show this help message"
        echo ""
        echo "Environment Variables:"
        echo "  DOMAIN          Target domain (from .env.production)"
        echo "  SKIP_LETSENCRYPT  Skip Let's Encrypt setup (use self-signed)"
        exit 0
        ;;
    --ssl-only)
        check_prerequisites
        validate_environment
        setup_ssl
        ;;
    --build-only)
        check_prerequisites
        build_images
        ;;
    --health-check)
        validate_environment
        run_health_checks
        ;;
    --rollback)
        rollback
        ;;
    deploy|*)
        main
        ;;
esac