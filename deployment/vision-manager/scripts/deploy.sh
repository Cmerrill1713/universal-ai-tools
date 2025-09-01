#!/bin/bash
# Automated deployment script for Vision Resource Manager Rust migration
# Supports gradual traffic routing and rollback capabilities

set -e

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
DEPLOYMENT_DIR="$SCRIPT_DIR/.."
COMPOSE_FILE="$DEPLOYMENT_DIR/docker/docker-compose.yml"

# Default values
RUST_WEIGHT=${RUST_WEIGHT:-10}
TS_WEIGHT=${TS_WEIGHT:-90}
ENVIRONMENT=${ENVIRONMENT:-production}
HEALTH_CHECK_TIMEOUT=${HEALTH_CHECK_TIMEOUT:-60}
DRY_RUN=${DRY_RUN:-false}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }

# Usage information
usage() {
    cat << EOF
Usage: $0 [OPTIONS] COMMAND

Commands:
    deploy          Deploy the Vision Resource Manager with current weights
    migrate         Perform gradual migration (10% -> 50% -> 100%)
    rollback        Rollback to TypeScript backend only
    status          Show current deployment status
    test            Run comprehensive health checks
    logs            Show service logs

Options:
    --rust-weight WEIGHT        Set Rust backend weight (default: 10)
    --ts-weight WEIGHT          Set TypeScript backend weight (default: 90)
    --env ENVIRONMENT           Set environment (default: production)
    --timeout SECONDS           Health check timeout (default: 60)
    --dry-run                   Show what would be done without executing
    --help                      Show this help message

Examples:
    $0 deploy                           # Deploy with default 10/90 split
    $0 --rust-weight 50 deploy          # Deploy with 50/50 split
    $0 migrate                          # Full gradual migration
    $0 rollback                         # Emergency rollback
EOF
}

# Health check functions
check_service_health() {
    local service_name="$1"
    local endpoint="$2"
    local max_attempts="${3:-10}"
    
    log_info "Checking health of $service_name..."
    
    for i in $(seq 1 $max_attempts); do
        if curl -sf "$endpoint" > /dev/null 2>&1; then
            log_success "$service_name is healthy"
            return 0
        fi
        
        if [ $i -lt $max_attempts ]; then
            log_warn "$service_name not ready, attempt $i/$max_attempts (retrying in 5s)"
            sleep 5
        fi
    done
    
    log_error "$service_name failed health check"
    return 1
}

# Docker composition management
update_compose_weights() {
    local rust_weight="$1"
    local ts_weight="$2"
    
    log_info "Updating nginx configuration with weights: Rust=$rust_weight, TypeScript=$ts_weight"
    
    if [ "$DRY_RUN" = "true" ]; then
        log_info "[DRY RUN] Would update RUST_BACKEND_WEIGHT=$rust_weight, TS_BACKEND_WEIGHT=$ts_weight"
        return 0
    fi
    
    # Update environment variables for docker-compose
    export RUST_BACKEND_WEIGHT="$rust_weight"
    export TS_BACKEND_WEIGHT="$ts_weight"
    export NODE_ENV="$ENVIRONMENT"
    
    # Restart nginx to apply new weights
    docker-compose -f "$COMPOSE_FILE" restart vision-proxy
}

# Deployment function
deploy_services() {
    log_info "Starting Vision Resource Manager deployment..."
    log_info "Configuration: Rust=$RUST_WEIGHT%, TypeScript=$TS_WEIGHT%, Environment=$ENVIRONMENT"
    
    if [ "$DRY_RUN" = "true" ]; then
        log_info "[DRY RUN] Would deploy with current configuration"
        return 0
    fi
    
    # Set environment variables
    export RUST_BACKEND_WEIGHT="$RUST_WEIGHT"
    export TS_BACKEND_WEIGHT="$TS_WEIGHT"
    export NODE_ENV="$ENVIRONMENT"
    
    # Build and start services
    cd "$DEPLOYMENT_DIR"
    docker-compose -f docker/docker-compose.yml build
    docker-compose -f docker/docker-compose.yml up -d
    
    # Wait for services to be ready
    log_info "Waiting for services to become healthy..."
    
    if ! check_service_health "Vision Proxy" "http://localhost:3000/health" 12; then
        log_error "Vision Proxy failed to start"
        return 1
    fi
    
    if ! check_service_health "Rust Backend" "http://localhost:3001/health" 12; then
        log_error "Rust backend failed to start"
        return 1
    fi
    
    if ! check_service_health "TypeScript Backend" "http://localhost:3002/health" 12; then
        log_error "TypeScript backend failed to start"
        return 1
    fi
    
    log_success "All services are healthy and ready"
    show_deployment_status
}

# Gradual migration function
perform_gradual_migration() {
    log_info "Starting gradual migration process..."
    
    # Stage 1: 10% Rust, 90% TypeScript
    log_info "Stage 1: Deploying with 10% Rust traffic..."
    update_compose_weights 10 90
    sleep 30
    run_performance_validation "stage1"
    
    # Stage 2: 50% Rust, 50% TypeScript
    log_info "Stage 2: Increasing to 50% Rust traffic..."
    update_compose_weights 50 50
    sleep 60
    run_performance_validation "stage2"
    
    # Stage 3: 100% Rust, 0% TypeScript
    log_info "Stage 3: Full migration to 100% Rust traffic..."
    update_compose_weights 100 0
    sleep 30
    run_performance_validation "stage3"
    
    log_success "Gradual migration completed successfully"
}

# Rollback function
perform_rollback() {
    log_warn "Performing emergency rollback to TypeScript backend..."
    
    if [ "$DRY_RUN" = "true" ]; then
        log_info "[DRY RUN] Would rollback to 0% Rust, 100% TypeScript"
        return 0
    fi
    
    update_compose_weights 0 100
    
    if check_service_health "Vision Proxy" "http://localhost:3000/health" 6; then
        log_success "Rollback completed successfully"
    else
        log_error "Rollback failed - manual intervention required"
        return 1
    fi
}

# Performance validation
run_performance_validation() {
    local stage="$1"
    log_info "Running performance validation for $stage..."
    
    # Test both direct endpoints and load balancer
    local rust_response_time=$(curl -o /dev/null -s -w '%{time_total}' http://localhost:3000/api/v1/vision/rust/metrics || echo "999")
    local ts_response_time=$(curl -o /dev/null -s -w '%{time_total}' http://localhost:3000/api/v1/vision/typescript/metrics || echo "999")
    local lb_response_time=$(curl -o /dev/null -s -w '%{time_total}' http://localhost:3000/api/v1/vision/metrics || echo "999")
    
    log_info "Performance metrics for $stage:"
    log_info "  Rust backend: ${rust_response_time}s"
    log_info "  TypeScript backend: ${ts_response_time}s"
    log_info "  Load balancer: ${lb_response_time}s"
    
    # Validate error rates
    local error_count=$(docker-compose -f "$COMPOSE_FILE" logs vision-proxy | grep -c "50[0-9]" || echo "0")
    log_info "  Error count in last check: $error_count"
    
    if [ "$error_count" -gt 5 ]; then
        log_error "High error rate detected ($error_count errors) - consider rollback"
        return 1
    fi
    
    return 0
}

# Status display
show_deployment_status() {
    log_info "Current deployment status:"
    
    # Show container status
    docker-compose -f "$COMPOSE_FILE" ps
    
    # Show current weights
    local nginx_config=$(docker exec vision-proxy cat /etc/nginx/nginx.conf 2>/dev/null || echo "Unable to read nginx config")
    echo
    log_info "Current traffic routing:"
    echo "$nginx_config" | grep -A 2 "upstream vision_backends" | grep -E "(server.*weight|# |server)"
    
    # Show recent metrics
    echo
    log_info "Recent performance metrics:"
    curl -s http://localhost:3000/performance-comparison 2>/dev/null | head -20 || log_warn "Performance metrics not available"
}

# Log viewing
show_logs() {
    local service="${1:-}"
    
    if [ -n "$service" ]; then
        docker-compose -f "$COMPOSE_FILE" logs -f "$service"
    else
        log_info "Available services: vision-manager-rust, vision-manager-typescript, vision-proxy, prometheus, grafana"
        docker-compose -f "$COMPOSE_FILE" logs -f
    fi
}

# Comprehensive testing
run_comprehensive_tests() {
    log_info "Running comprehensive health checks..."
    
    # Test all endpoints
    local endpoints=(
        "http://localhost:3000/health"
        "http://localhost:3000/api/v1/vision/metrics"
        "http://localhost:3000/api/v1/vision/rust/metrics"
        "http://localhost:3000/api/v1/vision/typescript/metrics"
        "http://localhost:9090/-/healthy"
        "http://localhost:3003/api/health"
    )
    
    local failed_tests=0
    
    for endpoint in "${endpoints[@]}"; do
        if check_service_health "$(echo $endpoint | cut -d'/' -f3)" "$endpoint" 3; then
            log_success "✓ $endpoint"
        else
            log_error "✗ $endpoint"
            ((failed_tests++))
        fi
    done
    
    if [ $failed_tests -eq 0 ]; then
        log_success "All health checks passed"
        return 0
    else
        log_error "$failed_tests health checks failed"
        return 1
    fi
}

# Main command processing
case "${1:-}" in
    deploy)
        deploy_services
        ;;
    migrate)
        perform_gradual_migration
        ;;
    rollback)
        perform_rollback
        ;;
    status)
        show_deployment_status
        ;;
    test)
        run_comprehensive_tests
        ;;
    logs)
        show_logs "$2"
        ;;
    --help|help)
        usage
        exit 0
        ;;
    *)
        # Parse options
        while [[ $# -gt 0 ]]; do
            case $1 in
                --rust-weight)
                    RUST_WEIGHT="$2"
                    TS_WEIGHT=$((100 - RUST_WEIGHT))
                    shift 2
                    ;;
                --ts-weight)
                    TS_WEIGHT="$2"
                    shift 2
                    ;;
                --env)
                    ENVIRONMENT="$2"
                    shift 2
                    ;;
                --timeout)
                    HEALTH_CHECK_TIMEOUT="$2"
                    shift 2
                    ;;
                --dry-run)
                    DRY_RUN=true
                    shift
                    ;;
                deploy|migrate|rollback|status|test|logs)
                    # Re-run with parsed options
                    exec "$0" "$@"
                    ;;
                *)
                    log_error "Unknown option: $1"
                    usage
                    exit 1
                    ;;
            esac
        done
        
        # If no command specified, show usage
        usage
        exit 1
        ;;
esac