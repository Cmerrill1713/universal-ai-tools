#!/bin/bash

# Production Deployment Script for Universal AI Tools with Rust Services
# Handles Docker build, testing, and deployment with comprehensive validation

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
IMAGE_NAME="universal-ai-tools"
IMAGE_TAG="${IMAGE_TAG:-rust-$(date +%Y%m%d-%H%M%S)}"
DEPLOY_ENV="${DEPLOY_ENV:-production}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Function to check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed or not in PATH"
        exit 1
    fi
    
    # Check Rust
    if ! command -v cargo &> /dev/null; then
        log_error "Rust/Cargo is not installed or not in PATH"
        exit 1
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed or not in PATH"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed or not in PATH"
        exit 1
    fi
    
    log_success "All prerequisites are available"
}

# Function to validate environment
validate_environment() {
    log_info "Validating environment configuration..."
    
    # Check required environment variables
    local required_vars=(
        "DATABASE_URL"
        "SUPABASE_URL"
        "SUPABASE_ANON_KEY"
        "SUPABASE_SERVICE_KEY"
    )
    
    local missing_vars=()
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        log_error "Missing required environment variables: ${missing_vars[*]}"
        exit 1
    fi
    
    # Validate .env file exists
    if [[ ! -f "$PROJECT_ROOT/.env.production" ]]; then
        log_warning "No .env.production file found, using defaults"
    fi
    
    log_success "Environment validation passed"
}

# Function to build Rust services
build_rust_services() {
    log_info "Building Rust services..."
    
    cd "$PROJECT_ROOT"
    
    # Clean previous builds
    cargo clean
    
    # Build all Rust services in release mode
    log_info "Building Rust workspace..."
    if ! cargo build --release --all; then
        log_error "Failed to build Rust services"
        exit 1
    fi
    
    # Build NAPI bindings
    log_info "Building NAPI bindings..."
    if ! cargo build --release --features napi; then
        log_error "Failed to build NAPI bindings"
        exit 1
    fi
    
    log_success "Rust services built successfully"
}

# Function to run tests
run_tests() {
    log_info "Running comprehensive test suite..."
    
    cd "$PROJECT_ROOT"
    
    # Run Rust tests
    log_info "Running Rust unit tests..."
    if ! cargo test --all --release; then
        log_error "Rust tests failed"
        exit 1
    fi
    
    # Run Rust benchmarks
    log_info "Running Rust benchmarks..."
    if ! cargo bench --all; then
        log_error "Rust benchmarks failed"
        exit 1
    fi
    
    # Run TypeScript tests
    log_info "Running TypeScript tests..."
    if ! npm test; then
        log_error "TypeScript tests failed"
        exit 1
    fi
    
    # Run integration tests
    log_info "Running integration tests..."
    if ! npm run test:integration; then
        log_error "Integration tests failed"
        exit 1
    fi
    
    log_success "All tests passed"
}

# Function to build Docker image
build_docker_image() {
    log_info "Building Docker image: $IMAGE_NAME:$IMAGE_TAG"
    
    cd "$PROJECT_ROOT"
    
    # Build the Docker image
    if ! docker build -f docker/Dockerfile.rust -t "$IMAGE_NAME:$IMAGE_TAG" .; then
        log_error "Failed to build Docker image"
        exit 1
    fi
    
    # Tag as latest
    docker tag "$IMAGE_NAME:$IMAGE_TAG" "$IMAGE_NAME:rust-latest"
    
    log_success "Docker image built successfully"
}

# Function to run Docker tests
test_docker_image() {
    log_info "Testing Docker image..."
    
    # Start test services
    log_info "Starting test environment..."
    docker-compose -f docker/docker-compose.test.yml up -d --build
    
    # Wait for services to be ready
    local max_retries=60
    local retry=0
    
    while [ $retry -lt $max_retries ]; do
        if docker-compose -f docker/docker-compose.test.yml exec -T app curl -f http://localhost:9999/health > /dev/null 2>&1; then
            log_success "Test services are healthy"
            break
        fi
        
        retry=$((retry + 1))
        log_info "Waiting for services to be ready... ($retry/$max_retries)"
        sleep 5
    done
    
    if [ $retry -eq $max_retries ]; then
        log_error "Test services failed to become healthy"
        docker-compose -f docker/docker-compose.test.yml logs
        docker-compose -f docker/docker-compose.test.yml down
        exit 1
    fi
    
    # Run container tests
    log_info "Running container tests..."
    if ! docker-compose -f docker/docker-compose.test.yml exec -T app npm run test:container; then
        log_error "Container tests failed"
        docker-compose -f docker/docker-compose.test.yml logs
        docker-compose -f docker/docker-compose.test.yml down
        exit 1
    fi
    
    # Cleanup test environment
    docker-compose -f docker/docker-compose.test.yml down
    
    log_success "Docker image tests passed"
}

# Function to deploy to production
deploy_production() {
    log_info "Deploying to production environment..."
    
    cd "$PROJECT_ROOT"
    
    # Stop existing services gracefully
    log_info "Stopping existing services..."
    if docker-compose -f docker/docker-compose.production.yml ps -q > /dev/null 2>&1; then
        docker-compose -f docker/docker-compose.production.yml down --timeout 30
    fi
    
    # Start production services
    log_info "Starting production services..."
    export IMAGE_TAG
    if ! docker-compose -f docker/docker-compose.production.yml up -d --no-build; then
        log_error "Failed to start production services"
        exit 1
    fi
    
    # Wait for services to be healthy
    local max_retries=120
    local retry=0
    
    log_info "Waiting for production services to be healthy..."
    while [ $retry -lt $max_retries ]; do
        local health_status
        health_status=$(docker-compose -f docker/docker-compose.production.yml exec -T app curl -f http://localhost:9999/api/v1/health 2>/dev/null | jq -r '.status' 2>/dev/null || echo "unhealthy")
        
        if [ "$health_status" = "healthy" ]; then
            log_success "Production services are healthy"
            break
        fi
        
        retry=$((retry + 1))
        log_info "Waiting for services to be healthy... ($retry/$max_retries)"
        sleep 5
    done
    
    if [ $retry -eq $max_retries ]; then
        log_error "Production services failed to become healthy"
        docker-compose -f docker/docker-compose.production.yml logs app
        exit 1
    fi
    
    log_success "Production deployment completed successfully"
}

# Function to run post-deployment validation
validate_deployment() {
    log_info "Running post-deployment validation..."
    
    # Test basic endpoints
    local base_url="http://localhost:9999"
    
    # Health check
    if ! curl -f "$base_url/health" > /dev/null 2>&1; then
        log_error "Health check failed"
        exit 1
    fi
    
    # API health check
    if ! curl -f "$base_url/api/v1/health" > /dev/null 2>&1; then
        log_error "API health check failed"
        exit 1
    fi
    
    # Test Rust service endpoints
    local rust_endpoints=(
        "/api/v1/voice/health"
        "/api/v1/vision/health" 
        "/api/v1/fast-coordinator/health"
        "/api/v1/parameters/health"
        "/api/v1/redis/health"
        "/api/v1/llm/health"
    )
    
    for endpoint in "${rust_endpoints[@]}"; do
        if curl -f "$base_url$endpoint" > /dev/null 2>&1; then
            log_success "Rust service $endpoint is healthy"
        else
            log_warning "Rust service $endpoint is not responding (may not be enabled)"
        fi
    done
    
    # Test WebSocket connection
    if command -v websocat &> /dev/null; then
        log_info "Testing WebSocket connection..."
        echo '{"type":"ping"}' | timeout 5 websocat "ws://localhost:8080/ws" > /dev/null 2>&1 && \
            log_success "WebSocket connection working" || \
            log_warning "WebSocket connection test failed or timed out"
    else
        log_warning "websocat not available, skipping WebSocket test"
    fi
    
    log_success "Post-deployment validation completed"
}

# Function to show deployment info
show_deployment_info() {
    log_info "Deployment Information"
    echo "======================"
    echo "Image: $IMAGE_NAME:$IMAGE_TAG"
    echo "Environment: $DEPLOY_ENV"
    echo "Services:"
    docker-compose -f docker/docker-compose.production.yml ps
    echo ""
    echo "Service URLs:"
    echo "  Main Application: http://localhost:9999"
    echo "  WebSocket: ws://localhost:8080"
    echo "  Redis: redis://localhost:6379"
    echo "  Ollama: http://localhost:11434"
    echo "  Prometheus: http://localhost:9090"
    echo "  Grafana: http://localhost:3001"
    echo ""
    echo "Logs:"
    echo "  All services: docker-compose -f docker/docker-compose.production.yml logs -f"
    echo "  App only: docker-compose -f docker/docker-compose.production.yml logs -f app"
    echo ""
    log_success "Deployment completed successfully!"
}

# Function to cleanup on failure
cleanup_on_failure() {
    log_error "Deployment failed, cleaning up..."
    docker-compose -f docker/docker-compose.production.yml down --timeout 30 2>/dev/null || true
    docker-compose -f docker/docker-compose.test.yml down 2>/dev/null || true
    exit 1
}

# Main deployment workflow
main() {
    log_info "Starting Universal AI Tools Rust Services Deployment"
    log_info "================================================="
    
    # Set up error handling
    trap cleanup_on_failure ERR
    
    # Run deployment steps
    check_prerequisites
    validate_environment
    build_rust_services
    run_tests
    build_docker_image
    test_docker_image
    deploy_production
    validate_deployment
    show_deployment_info
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --skip-docker-tests)
            SKIP_DOCKER_TESTS=true
            shift
            ;;
        --tag)
            IMAGE_TAG="$2"
            shift 2
            ;;
        --env)
            DEPLOY_ENV="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --skip-tests        Skip running tests"
            echo "  --skip-docker-tests Skip Docker container tests"
            echo "  --tag TAG           Use specific image tag"
            echo "  --env ENV           Set deployment environment"
            echo "  --help              Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Override test functions if skipping
if [[ "$SKIP_TESTS" == "true" ]]; then
    run_tests() {
        log_warning "Skipping tests as requested"
    }
fi

if [[ "$SKIP_DOCKER_TESTS" == "true" ]]; then
    test_docker_image() {
        log_warning "Skipping Docker tests as requested"
    }
fi

# Run main deployment
main "$@"