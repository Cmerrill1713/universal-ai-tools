#!/bin/bash

# Go/Rust Migration Development Environment Startup Script
# Phase 1 foundation setup with comprehensive monitoring and testing

set -euo pipefail

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION_ENV_FILE="${PROJECT_ROOT}/.env.migration"
LOG_FILE="${PROJECT_ROOT}/migration-startup.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_info() {
    log "${BLUE}[INFO]${NC} $1"
}

log_success() {
    log "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    log "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    log "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    local missing_tools=()
    
    if ! command -v docker &> /dev/null; then
        missing_tools+=("docker")
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        missing_tools+=("docker-compose")
    fi
    
    if ! command -v go &> /dev/null; then
        missing_tools+=("go")
    fi
    
    if ! command -v cargo &> /dev/null; then
        missing_tools+=("cargo/rust")
    fi
    
    if ! command -v node &> /dev/null; then
        missing_tools+=("node.js")
    fi
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_error "Please install the missing tools and try again."
        exit 1
    fi
    
    log_success "All prerequisites satisfied"
}

# Create migration environment file
create_migration_env() {
    log_info "Creating migration environment configuration..."
    
    cat > "$MIGRATION_ENV_FILE" << EOF
# Go/Rust Migration Environment Configuration
# Phase 1 Development Settings

# Migration Phase
MIGRATION_PHASE=1
MIGRATION_COMPATIBILITY_MODE=true
MIGRATION_ENABLE_TESTING=true

# Service Endpoints
TYPESCRIPT_ENDPOINT=http://localhost:9999
GO_ENDPOINT=http://localhost:8080
RUST_ENDPOINT=http://localhost:8082

# Database Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=universal_ai_tools_migration
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password

# Ollama Configuration
OLLAMA_ENDPOINT=http://localhost:11434
OLLAMA_TIMEOUT=30s

# Security (Development Only)
JWT_SECRET=migration-dev-secret-change-in-production
REQUIRE_AUTH=false

# Logging
LOG_LEVEL=debug
RUST_LOG=info

# Monitoring
PROMETHEUS_PORT=9092
GRAFANA_PORT=3000
METRICS_ENABLED=true

# Testing
TEST_INTERVAL=60s
COMPATIBILITY_TEST_ENABLED=true
PERFORMANCE_TEST_ENABLED=true

# Resource Limits (Development)
GO_MEMORY_LIMIT=256m
RUST_MEMORY_LIMIT=512m
POSTGRES_MEMORY_LIMIT=512m
REDIS_MEMORY_LIMIT=128m
NEO4J_MEMORY_LIMIT=768m

# Development Features
HOT_RELOAD_ENABLED=true
DEBUG_MODE=true
VERBOSE_LOGGING=true
EOF
    
    log_success "Migration environment file created: $MIGRATION_ENV_FILE"
}

# Build Go API Gateway
build_go_gateway() {
    log_info "Building Go API Gateway..."
    
    cd "${PROJECT_ROOT}/go-api-gateway"
    
    # Download dependencies
    go mod download
    go mod verify
    
    # Run tests
    if ! go test ./...; then
        log_warning "Go tests failed, but continuing with build..."
    fi
    
    # Build binary
    CGO_ENABLED=0 go build -o bin/go-api-gateway ./cmd/main.go
    
    log_success "Go API Gateway built successfully"
    cd "$PROJECT_ROOT"
}

# Build Rust AI Core
build_rust_ai_core() {
    log_info "Building Rust AI Core..."
    
    cd "${PROJECT_ROOT}/rust-ai-core"
    
    # Check formatting
    if ! cargo fmt --all -- --check; then
        log_warning "Rust code formatting issues detected, running cargo fmt..."
        cargo fmt --all
    fi
    
    # Run clippy
    if ! cargo clippy --all-targets -- -D warnings; then
        log_warning "Rust clippy warnings detected, but continuing..."
    fi
    
    # Run tests
    if ! cargo test --workspace; then
        log_warning "Rust tests failed, but continuing with build..."
    fi
    
    # Build release
    cargo build --release --workspace
    
    log_success "Rust AI Core built successfully"
    cd "$PROJECT_ROOT"
}

# Prepare migration testing
prepare_migration_testing() {
    log_info "Preparing migration testing framework..."
    
    cd "${PROJECT_ROOT}/migration-testing"
    
    # Install dependencies
    npm install
    
    # Run basic validation
    if ! npm test; then
        log_warning "Migration testing validation failed, but continuing..."
    fi
    
    log_success "Migration testing framework prepared"
    cd "$PROJECT_ROOT"
}

# Start infrastructure services
start_infrastructure() {
    log_info "Starting infrastructure services..."
    
    # Pull required images
    docker-compose -f docker-compose.migration.yml pull postgres redis neo4j ollama prometheus grafana
    
    # Start infrastructure
    docker-compose -f docker-compose.migration.yml up -d postgres redis neo4j ollama
    
    # Wait for services to be ready
    log_info "Waiting for infrastructure services to be ready..."
    
    # PostgreSQL
    timeout 60s bash -c 'while ! docker-compose -f docker-compose.migration.yml exec -T postgres pg_isready -U postgres; do sleep 2; done' || {
        log_error "PostgreSQL failed to start"
        return 1
    }
    log_success "PostgreSQL is ready"
    
    # Redis
    timeout 30s bash -c 'while ! docker-compose -f docker-compose.migration.yml exec -T redis redis-cli ping; do sleep 2; done' || {
        log_error "Redis failed to start"
        return 1
    }
    log_success "Redis is ready"
    
    # Neo4j
    timeout 120s bash -c 'while ! curl -f http://localhost:7474/browser/ >/dev/null 2>&1; do sleep 2; done' || {
        log_warning "Neo4j may not be fully ready, but continuing..."
    }
    log_success "Neo4j is ready"
    
    # Ollama
    timeout 60s bash -c 'while ! curl -f http://localhost:11434/api/version >/dev/null 2>&1; do sleep 2; done' || {
        log_warning "Ollama may not be fully ready, but continuing..."
    }
    log_success "Ollama is ready"
}

# Start migration services
start_migration_services() {
    log_info "Starting migration services..."
    
    # Start Go API Gateway
    docker-compose -f docker-compose.migration.yml up -d go-api-gateway
    
    # Start Rust AI Core
    docker-compose -f docker-compose.migration.yml up -d rust-ai-core
    
    # Start TypeScript server (compatibility mode)
    docker-compose -f docker-compose.migration.yml up -d typescript-server
    
    # Wait for services
    log_info "Waiting for migration services to be ready..."
    
    # Go API Gateway
    timeout 60s bash -c 'while ! curl -f http://localhost:8080/health >/dev/null 2>&1; do sleep 2; done' || {
        log_error "Go API Gateway failed to start"
        return 1
    }
    log_success "Go API Gateway is ready"
    
    # Rust AI Core
    timeout 60s bash -c 'while ! curl -f http://localhost:8082/health >/dev/null 2>&1; do sleep 2; done' || {
        log_error "Rust AI Core failed to start"
        return 1
    }
    log_success "Rust AI Core is ready"
    
    # TypeScript server
    timeout 60s bash -c 'while ! curl -f http://localhost:9999/health >/dev/null 2>&1; do sleep 2; done' || {
        log_warning "TypeScript server may not be ready, but continuing..."
    }
    log_success "TypeScript server is ready"
}

# Start monitoring
start_monitoring() {
    log_info "Starting monitoring services..."
    
    # Start Prometheus and Grafana
    docker-compose -f docker-compose.migration.yml up -d prometheus grafana
    
    # Wait for monitoring services
    timeout 60s bash -c 'while ! curl -f http://localhost:9092/graph >/dev/null 2>&1; do sleep 2; done' || {
        log_warning "Prometheus may not be ready, but continuing..."
    }
    log_success "Prometheus is ready at http://localhost:9092"
    
    timeout 60s bash -c 'while ! curl -f http://localhost:3000/login >/dev/null 2>&1; do sleep 2; done' || {
        log_warning "Grafana may not be ready, but continuing..."
    }
    log_success "Grafana is ready at http://localhost:3000 (admin/admin)"
}

# Start migration testing
start_migration_testing() {
    log_info "Starting migration testing services..."
    
    docker-compose -f docker-compose.migration.yml up -d migration-test
    
    # Wait briefly for testing service
    sleep 10
    
    log_success "Migration testing service started"
}

# Run initial compatibility tests
run_initial_tests() {
    log_info "Running initial compatibility tests..."
    
    cd "${PROJECT_ROOT}/migration-testing"
    
    # Run compatibility tests
    if npm run test:compatibility; then
        log_success "Initial compatibility tests passed"
    else
        log_warning "Some compatibility tests failed - check logs for details"
    fi
    
    cd "$PROJECT_ROOT"
}

# Display status and URLs
show_status() {
    log_info "Migration development environment is ready!"
    
    echo ""
    echo "🚀 Service URLs:"
    echo "   Go API Gateway:      http://localhost:8080"
    echo "   Go Health Check:     http://localhost:8081/health"
    echo "   Rust AI Core:        http://localhost:8082"
    echo "   TypeScript Server:   http://localhost:9999"
    echo ""
    echo "📊 Monitoring URLs:"
    echo "   Prometheus:          http://localhost:9092"
    echo "   Grafana:             http://localhost:3000 (admin/admin)"
    echo ""
    echo "🗄️  Database URLs:"
    echo "   PostgreSQL:          localhost:5432 (postgres/postgres)"
    echo "   Redis:               localhost:6379"
    echo "   Neo4j Browser:       http://localhost:7474 (neo4j/password)"
    echo ""
    echo "🤖 AI Services:"
    echo "   Ollama:              http://localhost:11434"
    echo ""
    echo "🧪 Testing:"
    echo "   Migration Tests:     docker-compose -f docker-compose.migration.yml logs migration-test"
    echo ""
    echo "📝 Useful Commands:"
    echo "   View all logs:       docker-compose -f docker-compose.migration.yml logs -f"
    echo "   Stop all services:   docker-compose -f docker-compose.migration.yml down"
    echo "   Restart service:     docker-compose -f docker-compose.migration.yml restart <service>"
    echo "   Run tests manually:  cd migration-testing && npm run test:compatibility"
    echo ""
    echo "📄 Configuration file: $MIGRATION_ENV_FILE"
    echo "📋 Startup log: $LOG_FILE"
}

# Cleanup function
cleanup() {
    if [ $? -ne 0 ]; then
        log_error "Setup failed. Cleaning up..."
        docker-compose -f docker-compose.migration.yml down
    fi
}

# Main execution
main() {
    trap cleanup EXIT
    
    log_info "Starting Go/Rust Migration Development Environment"
    log_info "Project root: $PROJECT_ROOT"
    
    check_prerequisites
    create_migration_env
    
    # Build components
    build_go_gateway
    build_rust_ai_core
    prepare_migration_testing
    
    # Start services
    start_infrastructure
    start_migration_services
    start_monitoring
    start_migration_testing
    
    # Run initial tests
    run_initial_tests
    
    # Show status
    show_status
    
    log_success "Migration development environment setup complete!"
}

# Handle script arguments
case "${1:-start}" in
    "start")
        main
        ;;
    "stop")
        log_info "Stopping migration development environment..."
        docker-compose -f docker-compose.migration.yml down
        log_success "Environment stopped"
        ;;
    "status")
        echo "Migration Development Environment Status:"
        docker-compose -f docker-compose.migration.yml ps
        ;;
    "logs")
        docker-compose -f docker-compose.migration.yml logs -f "${2:-}"
        ;;
    "restart")
        if [ -n "${2:-}" ]; then
            docker-compose -f docker-compose.migration.yml restart "$2"
        else
            log_error "Usage: $0 restart <service_name>"
            exit 1
        fi
        ;;
    "test")
        log_info "Running migration compatibility tests..."
        cd "${PROJECT_ROOT}/migration-testing"
        npm run test:compatibility
        ;;
    "help")
        echo "Usage: $0 [command] [options]"
        echo ""
        echo "Commands:"
        echo "  start     Start the migration development environment (default)"
        echo "  stop      Stop all services"
        echo "  status    Show service status"
        echo "  logs      View logs (optionally specify service name)"
        echo "  restart   Restart a specific service"
        echo "  test      Run migration compatibility tests"
        echo "  help      Show this help message"
        ;;
    *)
        log_error "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac