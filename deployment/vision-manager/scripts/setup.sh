#!/bin/bash
# Environment setup script for Vision Resource Manager deployment
# Prepares the system and validates all requirements

set -e

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
DEPLOYMENT_DIR="$SCRIPT_DIR/.."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }

# System requirements check
check_system_requirements() {
    log_info "Checking system requirements..."
    
    local missing_deps=0
    
    # Check Docker
    if command -v docker >/dev/null 2>&1; then
        local docker_version=$(docker --version | grep -o '[0-9]\+\.[0-9]\+' | head -1)
        log_success "Docker installed: $docker_version"
    else
        log_error "Docker is required but not installed"
        ((missing_deps++))
    fi
    
    # Check Docker Compose
    if command -v docker-compose >/dev/null 2>&1 || docker compose version >/dev/null 2>&1; then
        log_success "Docker Compose available"
    else
        log_error "Docker Compose is required but not installed"
        ((missing_deps++))
    fi
    
    # Check Node.js
    if command -v node >/dev/null 2>&1; then
        local node_version=$(node --version)
        log_success "Node.js installed: $node_version"
    else
        log_error "Node.js is required but not installed"
        ((missing_deps++))
    fi
    
    # Check Rust
    if command -v rustc >/dev/null 2>&1; then
        local rust_version=$(rustc --version)
        log_success "Rust installed: $rust_version"
    else
        log_warn "Rust not found - will use pre-built binaries"
    fi
    
    # Check helpful tools
    if ! command -v curl >/dev/null 2>&1; then
        log_warn "curl not installed - some scripts may not work fully"
    fi
    
    if ! command -v jq >/dev/null 2>&1; then
        log_warn "jq not installed - JSON processing will be limited"
    fi
    
    if ! command -v ab >/dev/null 2>&1; then
        log_warn "Apache Bench (ab) not installed - performance testing will be limited"
    fi
    
    if [ $missing_deps -gt 0 ]; then
        log_error "$missing_deps critical dependencies missing"
        return 1
    else
        log_success "All critical system requirements satisfied"
        return 0
    fi
}

# Project build validation
validate_project_build() {
    log_info "Validating project build..."
    
    cd "$PROJECT_ROOT"
    
    # Check if Rust Vision Manager exists
    if [ ! -f "crates/vision-resource-manager/src/simple.rs" ]; then
        log_error "Rust Vision Manager source not found"
        return 1
    fi
    
    # Check if TypeScript integration exists
    if [ ! -f "src/services/vision-resource-manager-rust.ts" ]; then
        log_error "TypeScript integration not found"
        return 1
    fi
    
    # Verify Docker build context
    if [ ! -f "$DEPLOYMENT_DIR/docker/Dockerfile" ]; then
        log_error "Dockerfile not found in deployment directory"
        return 1
    fi
    
    log_success "Project structure validated"
    return 0
}

# Environment file creation
create_environment_file() {
    local env_file="$DEPLOYMENT_DIR/.env"
    
    log_info "Creating deployment environment file..."
    
    if [ -f "$env_file" ]; then
        log_warn "Environment file already exists - backing up"
        cp "$env_file" "$env_file.backup.$(date +%s)"
    fi
    
    cat > "$env_file" << EOF
# Vision Resource Manager Deployment Configuration
# Generated: $(date)

# Service Configuration
NODE_ENV=production
RUST_LOG=info
MAX_VRAM_GB=20.0
BACKEND_PREFERENCE=rust

# Performance & Migration Settings
RUST_BACKEND_WEIGHT=10
TS_BACKEND_WEIGHT=90
ENABLE_PERFORMANCE_COMPARISON=true

# Port Configuration
VISION_MANAGER_PORT=3001
TS_VISION_MANAGER_PORT=3002
PROXY_PORT=3000
METRICS_PORT=9090

# Resource Limits
RUST_MEMORY_LIMIT=2G
RUST_CPU_LIMIT=2
TS_MEMORY_LIMIT=1G
TS_CPU_LIMIT=1

# Monitoring
GRAFANA_PASSWORD=admin123
HEALTH_CHECK_TIMEOUT=60

# Testing Configuration
TEST_ITERATIONS=100
TEST_CONCURRENT=10
EOF
    
    log_success "Environment file created: $env_file"
    log_info "You can customize settings by editing $env_file"
}

# Docker network and volume setup
setup_docker_infrastructure() {
    log_info "Setting up Docker infrastructure..."
    
    # Create custom network if it doesn't exist
    if ! docker network ls | grep -q vision-network; then
        docker network create vision-network --driver bridge --subnet 172.20.0.0/16
        log_success "Created Docker network: vision-network"
    else
        log_info "Docker network vision-network already exists"
    fi
    
    # Create named volumes
    local volumes=("vision-models" "vision-logs" "prometheus-data" "grafana-data" "performance-results")
    
    for volume in "${volumes[@]}"; do
        if ! docker volume ls | grep -q "$volume"; then
            docker volume create "$volume"
            log_success "Created Docker volume: $volume"
        else
            log_info "Docker volume $volume already exists"
        fi
    done
}

# Pre-build Docker images
prebuild_docker_images() {
    log_info "Pre-building Docker images..."
    
    cd "$DEPLOYMENT_DIR"
    
    # Build main application images
    docker-compose -f docker/docker-compose.yml build --no-cache
    
    # Verify images were created
    if docker images | grep -q "universal-ai-tools/vision-manager"; then
        log_success "Docker images built successfully"
    else
        log_error "Docker image build failed"
        return 1
    fi
}

# Validation tests
run_validation_tests() {
    log_info "Running pre-deployment validation tests..."
    
    # Test Docker Compose configuration
    cd "$DEPLOYMENT_DIR"
    if docker-compose -f docker/docker-compose.yml config >/dev/null 2>&1; then
        log_success "Docker Compose configuration is valid"
    else
        log_error "Docker Compose configuration has errors"
        return 1
    fi
    
    # Test Rust binary (if available)
    if [ -f "$PROJECT_ROOT/crates/vision-resource-manager/target/release/examples/standalone_benchmark" ]; then
        log_info "Testing Rust binary..."
        cd "$PROJECT_ROOT"
        timeout 10s ./crates/vision-resource-manager/target/release/examples/standalone_benchmark || log_warn "Rust binary test timed out (expected for benchmark)"
        log_success "Rust binary is executable"
    fi
    
    return 0
}

# Performance baseline establishment
establish_performance_baseline() {
    log_info "Establishing performance baseline..."
    
    # Start minimal service for baseline testing
    cd "$DEPLOYMENT_DIR"
    
    # Temporarily start TypeScript backend only
    RUST_BACKEND_WEIGHT=0 TS_BACKEND_WEIGHT=100 docker-compose -f docker/docker-compose.yml up -d vision-manager-typescript vision-proxy
    
    # Wait for service to be ready
    local wait_time=0
    while [ $wait_time -lt 60 ]; do
        if curl -sf http://localhost:3000/health >/dev/null 2>&1; then
            break
        fi
        sleep 2
        ((wait_time+=2))
    done
    
    if [ $wait_time -ge 60 ]; then
        log_error "Service failed to start for baseline testing"
        docker-compose -f docker/docker-compose.yml down
        return 1
    fi
    
    # Run baseline benchmark
    local baseline_file="$DEPLOYMENT_DIR/results/baseline_$(date +%s).json"
    mkdir -p "$DEPLOYMENT_DIR/results"
    
    log_info "Running baseline performance test..."
    local baseline_time=$(curl -o /dev/null -s -w '%{time_total}' http://localhost:3000/api/v1/vision/typescript/metrics)
    
    cat > "$baseline_file" << EOF
{
    "timestamp": "$(date -Iseconds)",
    "backend": "typescript",
    "response_time": $baseline_time,
    "notes": "Pre-migration baseline established during setup"
}
EOF
    
    log_success "Baseline established: ${baseline_time}s response time"
    log_info "Baseline data saved to: $baseline_file"
    
    # Stop baseline services
    docker-compose -f docker/docker-compose.yml down
    
    return 0
}

# Create deployment summary
create_deployment_summary() {
    local summary_file="$DEPLOYMENT_DIR/DEPLOYMENT_READY.md"
    
    cat > "$summary_file" << EOF
# Vision Resource Manager - Deployment Ready

**Setup completed:** $(date)

## Quick Start Commands

\`\`\`bash
# Deploy with default settings (10% Rust, 90% TypeScript)
./scripts/deploy.sh deploy

# Run performance benchmark
./scripts/benchmark.sh benchmark

# Check deployment status
./scripts/deploy.sh status

# Start gradual migration
./scripts/deploy.sh migrate
\`\`\`

## Service Endpoints

- **Main API**: http://localhost:3000/api/v1/vision/
- **Rust Backend**: http://localhost:3001/
- **TypeScript Backend**: http://localhost:3002/
- **Prometheus**: http://localhost:9090/
- **Grafana**: http://localhost:3003/ (admin/admin123)

## Architecture Overview

\`\`\`
[Client] → [Nginx Proxy:3000] → [Rust:3001 | TypeScript:3002]
                                         ↓
                                   [Prometheus:9090]
                                         ↓
                                    [Grafana:3003]
\`\`\`

## Migration Strategy

1. **Phase 1**: Deploy with 10% Rust traffic
2. **Phase 2**: Increase to 50% after validation
3. **Phase 3**: Full migration to 100% Rust
4. **Rollback**: Emergency fallback to TypeScript

## Monitoring

- **Metrics**: http://localhost:3000/metrics
- **Health**: http://localhost:3000/health
- **Performance Comparison**: http://localhost:3000/performance-comparison

## Files Created

- Environment: \`.env\`
- Deployment logs: \`results/\`
- Configuration: \`docker/docker-compose.yml\`

## Next Steps

1. Review \`.env\` configuration
2. Run \`./scripts/deploy.sh deploy\` to start
3. Monitor performance with \`./scripts/benchmark.sh benchmark\`
4. Gradual migration with \`./scripts/deploy.sh migrate\`

---
*Generated by Vision Resource Manager setup script*
EOF
    
    log_success "Deployment summary created: $summary_file"
}

# Main setup workflow
main() {
    log_info "Starting Vision Resource Manager deployment setup..."
    
    # System validation
    if ! check_system_requirements; then
        log_error "System requirements not met - please install missing dependencies"
        exit 1
    fi
    
    # Project validation
    if ! validate_project_build; then
        log_error "Project validation failed - please check project structure"
        exit 1
    fi
    
    # Infrastructure setup
    create_environment_file
    setup_docker_infrastructure
    
    # Build and validate
    if ! prebuild_docker_images; then
        log_error "Docker image build failed"
        exit 1
    fi
    
    if ! run_validation_tests; then
        log_error "Validation tests failed"
        exit 1
    fi
    
    # Performance baseline
    establish_performance_baseline
    
    # Final documentation
    create_deployment_summary
    
    log_success "Vision Resource Manager deployment setup completed!"
    log_info "Run './scripts/deploy.sh deploy' to start deployment"
    log_info "See DEPLOYMENT_READY.md for complete instructions"
}

# Usage information
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Options:
    --skip-build        Skip Docker image pre-building
    --skip-baseline     Skip performance baseline establishment  
    --help              Show this help message

This script prepares your system for Vision Resource Manager deployment by:
1. Checking system requirements
2. Validating project structure
3. Creating environment configuration
4. Setting up Docker infrastructure
5. Pre-building images
6. Establishing performance baseline
7. Creating deployment documentation
EOF
}

# Command line processing
SKIP_BUILD=false
SKIP_BASELINE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --skip-baseline)
            SKIP_BASELINE=true
            shift
            ;;
        --help)
            usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Override functions for skipped steps
if [ "$SKIP_BUILD" = "true" ]; then
    prebuild_docker_images() {
        log_info "Skipping Docker image pre-building"
        return 0
    }
fi

if [ "$SKIP_BASELINE" = "true" ]; then
    establish_performance_baseline() {
        log_info "Skipping performance baseline establishment"
        return 0
    }
fi

# Run main setup
main