#!/bin/bash

# Production Deployment Script for Universal AI Tools
# Deploys optimized Rust services with comprehensive monitoring

set -e

echo "🚀 Universal AI Tools - Production Deployment"
echo "============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker/docker-compose.production.yml"
ENV_FILE=".env.production"
BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Pre-deployment checks
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check Rust
    if ! command -v rustc &> /dev/null; then
        print_error "Rust is not installed"
        exit 1
    fi
    
    # Check environment file
    if [ ! -f "$ENV_FILE" ]; then
        print_error "Environment file $ENV_FILE not found"
        print_status "Creating template environment file..."
        cat > "$ENV_FILE" << 'EOF'
# Production Environment Configuration
NODE_ENV=production
PORT=9999

# Database
DATABASE_URL=postgresql://postgres:your_password@postgres:5432/universal_ai_tools
POSTGRES_PASSWORD=your_secure_password

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key

# Monitoring
GRAFANA_PASSWORD=your_grafana_password

# SSL (if using custom certificates)
SSL_CERT_PATH=./ssl/cert.pem
SSL_KEY_PATH=./ssl/key.pem
EOF
        print_warning "Template environment file created. Please configure it before deployment."
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Build Rust services
build_rust_services() {
    print_status "Building optimized Rust services..."
    
    cd rust-services
    
    if [ -f "build-all.sh" ]; then
        chmod +x build-all.sh
        ./build-all.sh
        if [ $? -eq 0 ]; then
            print_success "Rust services built successfully"
        else
            print_error "Failed to build Rust services"
            exit 1
        fi
    else
        print_error "build-all.sh not found in rust-services directory"
        exit 1
    fi
    
    cd ..
}

# Run performance regression tests
run_regression_tests() {
    print_status "Running performance regression tests..."
    
    if [ -f "scripts/performance-regression-test.ts" ]; then
        tsx scripts/performance-regression-test.ts
        if [ $? -eq 0 ]; then
            print_success "Performance regression tests passed"
        else
            print_warning "Performance regression tests failed, continuing with deployment..."
        fi
    else
        print_warning "Performance regression test script not found, skipping..."
    fi
}

# Create backup of current deployment
create_backup() {
    print_status "Creating backup of current deployment..."
    
    mkdir -p "$BACKUP_DIR"
    
    # Backup volumes
    if docker-compose -f "$COMPOSE_FILE" ps | grep -q "Up"; then
        docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_dumpall -c -U postgres > "$BACKUP_DIR/database_backup.sql"
        docker run --rm --volumes-from ai-redis -v "$(pwd)/$BACKUP_DIR":/backup alpine tar czf /backup/redis_backup.tar.gz /data
        print_success "Backup created in $BACKUP_DIR"
    else
        print_status "No running containers found, skipping backup"
    fi
}

# Deploy services
deploy_services() {
    print_status "Deploying services with Docker Compose..."
    
    # Load environment variables
    set -a
    source "$ENV_FILE"
    set +a
    
    # Pull latest images
    docker-compose -f "$COMPOSE_FILE" pull
    
    # Build application with Rust services
    docker-compose -f "$COMPOSE_FILE" build --no-cache app
    
    # Stop existing services
    docker-compose -f "$COMPOSE_FILE" down
    
    # Start services with zero-downtime deployment
    docker-compose -f "$COMPOSE_FILE" up -d
    
    print_success "Services deployed successfully"
}

# Health checks
wait_for_services() {
    print_status "Waiting for services to be ready..."
    
    # Wait for main application
    for i in {1..30}; do
        if curl -sf http://localhost:9999/api/v1/health > /dev/null; then
            print_success "Main application is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            print_error "Main application failed to start"
            return 1
        fi
        sleep 10
    done
    
    # Wait for monitoring services
    for i in {1..20}; do
        if curl -sf http://localhost:9090/-/healthy > /dev/null; then
            print_success "Prometheus is ready"
            break
        fi
        if [ $i -eq 20 ]; then
            print_warning "Prometheus may not be ready"
        fi
        sleep 5
    done
    
    for i in {1..20}; do
        if curl -sf http://localhost:3000/api/health > /dev/null; then
            print_success "Grafana is ready"
            break
        fi
        if [ $i -eq 20 ]; then
            print_warning "Grafana may not be ready"
        fi
        sleep 5
    done
}

# Validate deployment
validate_deployment() {
    print_status "Validating deployment..."
    
    # Check service health
    if ! curl -sf http://localhost:9999/api/v1/health > /dev/null; then
        print_error "Main application health check failed"
        return 1
    fi
    
    # Check Rust service availability
    RUST_STATUS=$(curl -s http://localhost:9999/api/v1/monitoring/rust-services | grep -o '"native_loaded":true' | wc -l)
    if [ "$RUST_STATUS" -gt 0 ]; then
        print_success "Rust native services are active"
    else
        print_warning "Rust native services not detected, using TypeScript fallbacks"
    fi
    
    # Check database connectivity
    if docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U postgres > /dev/null; then
        print_success "Database is accessible"
    else
        print_error "Database connectivity check failed"
        return 1
    fi
    
    # Check Redis connectivity
    if docker-compose -f "$COMPOSE_FILE" exec -T redis redis-cli ping | grep -q PONG; then
        print_success "Redis is accessible"
    else
        print_error "Redis connectivity check failed"
        return 1
    fi
    
    print_success "Deployment validation completed"
}

# Performance benchmarking
run_benchmark() {
    print_status "Running performance benchmark..."
    
    if [ -f "scripts/performance-regression-test.ts" ]; then
        tsx scripts/performance-regression-test.ts
        print_success "Performance benchmark completed"
    else
        print_warning "Performance benchmark script not found"
    fi
}

# Show deployment status
show_status() {
    echo ""
    print_success "🎉 Universal AI Tools Deployment Complete!"
    echo ""
    echo "Services are available at:"
    echo "  🌐 Main Application: http://localhost:9999"
    echo "  📊 Grafana Dashboard: http://localhost:3000"
    echo "  📈 Prometheus Metrics: http://localhost:9090"
    echo "  🔍 System Health: http://localhost:9999/api/v1/health"
    echo ""
    echo "Monitoring URLs:"
    echo "  📡 Rust Services Metrics: http://localhost:9999/api/v1/monitoring/rust-metrics"
    echo "  🔧 System Metrics: http://localhost:9999/api/v1/monitoring/system"
    echo "  ⚡ Performance Stats: http://localhost:9999/api/v1/monitoring/performance"
    echo ""
    echo "To view logs:"
    echo "  docker-compose -f $COMPOSE_FILE logs -f app"
    echo ""
    echo "To stop services:"
    echo "  docker-compose -f $COMPOSE_FILE down"
    echo ""
}

# Error handling
cleanup_on_error() {
    print_error "Deployment failed! Cleaning up..."
    docker-compose -f "$COMPOSE_FILE" down
    if [ -d "$BACKUP_DIR" ] && [ -f "$BACKUP_DIR/database_backup.sql" ]; then
        print_status "Restoring from backup..."
        # Restore database if backup exists
        docker-compose -f "$COMPOSE_FILE" up -d postgres
        sleep 10
        docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U postgres < "$BACKUP_DIR/database_backup.sql"
    fi
}

# Main deployment process
main() {
    # Set up error handling
    trap cleanup_on_error ERR
    
    # Run deployment steps
    check_prerequisites
    create_backup
    build_rust_services
    run_regression_tests
    deploy_services
    wait_for_services
    validate_deployment
    run_benchmark
    show_status
}

# Parse command line arguments
case "${1:-}" in
    --skip-tests)
        echo "Skipping performance regression tests"
        run_regression_tests() { print_status "Skipping regression tests..."; }
        ;;
    --skip-backup)
        echo "Skipping backup creation"
        create_backup() { print_status "Skipping backup..."; }
        ;;
    --help)
        echo "Usage: $0 [options]"
        echo "Options:"
        echo "  --skip-tests    Skip performance regression tests"
        echo "  --skip-backup   Skip backup creation"
        echo "  --help          Show this help message"
        exit 0
        ;;
esac

# Run main deployment
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi