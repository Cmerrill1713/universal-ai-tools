#!/bin/bash

# Week 1 Validation Test Runner
# Runs comprehensive validation tests for the integration foundation

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
HUB_PORT=8100
BACKEND_PORT=9999
LOG_FILE="${PROJECT_ROOT}/logs/week1-validation.log"

# Logging function
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$LOG_FILE"
}

# Print colored output
print_status() {
    local color="$1"
    local message="$2"
    echo -e "${color}${message}${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    log "INFO" "🔍 Checking prerequisites..."
    
    local required_commands=("node" "npm" "go" "curl" "jq")
    for cmd in "${required_commands[@]}"; do
        if ! command_exists "$cmd"; then
            log "ERROR" "❌ Required command not found: $cmd"
            exit 1
        fi
    done
    
    log "INFO" "✅ All prerequisites found"
}

# Setup test environment
setup_test_environment() {
    log "INFO" "🛠️ Setting up test environment..."
    
    # Create necessary directories
    mkdir -p "${PROJECT_ROOT}/logs"
    mkdir -p "${PROJECT_ROOT}/automation/lib"
    mkdir -p "${PROJECT_ROOT}/automation/tests"
    
    # Install TypeScript dependencies if needed
    if [[ -f "${PROJECT_ROOT}/package.json" ]]; then
        log "INFO" "📦 Installing npm dependencies..."
        cd "$PROJECT_ROOT"
        npm install --silent
    fi
    
    log "INFO" "✅ Test environment setup complete"
}

# Start orchestration hub
start_orchestration_hub() {
    log "INFO" "🚀 Starting orchestration hub..."
    
    cd "${PROJECT_ROOT}/automation/orchestration-hub"
    
    # Build and start the Go service in background
    go mod init orchestration-hub 2>/dev/null || true
    go mod tidy 2>/dev/null || true
    
    # Start the hub in background
    go run main.go > "${PROJECT_ROOT}/logs/hub.log" 2>&1 &
    HUB_PID=$!
    
    log "INFO" "⏳ Waiting for orchestration hub to start (PID: $HUB_PID)..."
    
    # Wait for hub to be ready
    local retries=15
    local wait_time=2
    
    for ((i=1; i<=retries; i++)); do
        if curl -s -f "http://localhost:${HUB_PORT}/health" >/dev/null 2>&1; then
            log "INFO" "✅ Orchestration hub is ready"
            return 0
        fi
        
        if [[ $i -eq $retries ]]; then
            log "ERROR" "❌ Orchestration hub failed to start after $retries attempts"
            return 1
        fi
        
        log "INFO" "⏳ Hub not ready, attempt $i/$retries (waiting ${wait_time}s...)"
        sleep $wait_time
    done
}

# Start mock backend service (if needed)
start_mock_backend() {
    log "INFO" "🎭 Starting mock backend service..."
    
    # Simple Node.js mock server
    cat > "/tmp/mock-backend.js" << 'EOF'
const express = require('express');
const app = express();

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'mock-backend', timestamp: new Date() });
});

// API health endpoints
app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', service: 'api', timestamp: new Date() });
});

app.get('/api/agents/health', (req, res) => {
    res.json({ status: 'healthy', service: 'agents', timestamp: new Date() });
});

app.get('/api/memory/health', (req, res) => {
    res.json({ status: 'healthy', service: 'memory', timestamp: new Date() });
});

// Catch-all for other endpoints
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Mock endpoint not found' });
});

const port = process.env.PORT || 9999;
app.listen(port, () => {
    console.log(`Mock backend running on port ${port}`);
});
EOF

    # Start mock backend
    cd "$PROJECT_ROOT"
    node /tmp/mock-backend.js > "${PROJECT_ROOT}/logs/mock-backend.log" 2>&1 &
    BACKEND_PID=$!
    
    log "INFO" "⏳ Waiting for mock backend to start (PID: $BACKEND_PID)..."
    
    # Wait for backend to be ready
    local retries=10
    for ((i=1; i<=retries; i++)); do
        if curl -s -f "http://localhost:${BACKEND_PORT}/health" >/dev/null 2>&1; then
            log "INFO" "✅ Mock backend is ready"
            return 0
        fi
        sleep 1
    done
    
    log "WARNING" "⚠️ Mock backend may not be fully ready, continuing..."
}

# Run validation tests
run_validation_tests() {
    log "INFO" "🧪 Running Week 1 validation tests..."
    
    cd "$PROJECT_ROOT"
    
    # Compile TypeScript validation tests
    if command_exists "npx"; then
        log "INFO" "🔨 Compiling TypeScript validation tests..."
        npx tsc automation/tests/week1-validation.ts --outDir automation/tests/compiled --target es2020 --module commonjs --esModuleInterop --resolveJsonModule 2>/dev/null || true
    fi
    
    # Try to run the validation tests
    if [[ -f "automation/tests/week1-validation.ts" ]]; then
        log "INFO" "▶️ Executing validation tests..."
        
        # Try running with ts-node first, fallback to node if compiled
        if command_exists "npx" && npx -p ts-node ts-node --version >/dev/null 2>&1; then
            npx ts-node automation/tests/week1-validation.ts 2>&1 | tee -a "$LOG_FILE"
        elif [[ -f "automation/tests/compiled/week1-validation.js" ]]; then
            node automation/tests/compiled/week1-validation.js 2>&1 | tee -a "$LOG_FILE"
        else
            log "WARNING" "⚠️ Cannot run TypeScript tests directly, manual verification required"
            
            # Perform basic connectivity tests instead
            run_basic_connectivity_tests
        fi
    else
        log "ERROR" "❌ Validation test file not found"
        return 1
    fi
}

# Run basic connectivity tests as fallback
run_basic_connectivity_tests() {
    log "INFO" "🔧 Running basic connectivity tests..."
    
    local tests_passed=0
    local tests_total=0
    
    # Test hub health
    ((tests_total++))
    if curl -s -f "http://localhost:${HUB_PORT}/health" | jq -e '.status == "healthy"' >/dev/null 2>&1; then
        log "INFO" "✅ Hub health check passed"
        ((tests_passed++))
    else
        log "ERROR" "❌ Hub health check failed"
    fi
    
    # Test service registration
    ((tests_total++))
    local test_service_payload='{
        "id": "basic-test-001",
        "name": "Basic Test Service",
        "type": "basic-test",
        "endpoint": "http://localhost:9999",
        "health_check": "http://localhost:9999/health",
        "capabilities": ["testing"]
    }'
    
    if curl -s -X POST "http://localhost:${HUB_PORT}/api/services/register" \
        -H "Content-Type: application/json" \
        -d "$test_service_payload" | jq -e '.status == "registered"' >/dev/null 2>&1; then
        log "INFO" "✅ Service registration test passed"
        ((tests_passed++))
    else
        log "ERROR" "❌ Service registration test failed"
    fi
    
    # Test service discovery
    ((tests_total++))
    if curl -s "http://localhost:${HUB_PORT}/api/services/discover" | jq -e 'type == "array"' >/dev/null 2>&1; then
        log "INFO" "✅ Service discovery test passed"
        ((tests_passed++))
    else
        log "ERROR" "❌ Service discovery test failed"
    fi
    
    # Test event triggering
    ((tests_total++))
    local test_event_payload='{
        "type": "basic.test",
        "source": "validation-script",
        "payload": {
            "message": "Basic connectivity test",
            "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"
        }
    }'
    
    if curl -s -X POST "http://localhost:${HUB_PORT}/api/automation/trigger" \
        -H "Content-Type: application/json" \
        -d "$test_event_payload" | jq -e '.status == "queued"' >/dev/null 2>&1; then
        log "INFO" "✅ Event triggering test passed"
        ((tests_passed++))
    else
        log "ERROR" "❌ Event triggering test failed"
    fi
    
    # Print results
    local success_rate=$(( tests_passed * 100 / tests_total ))
    log "INFO" "📊 Basic connectivity tests completed: $tests_passed/$tests_total passed (${success_rate}%)"
    
    if [[ $tests_passed -eq $tests_total ]]; then
        log "INFO" "🎉 All basic tests passed!"
        return 0
    else
        log "WARNING" "⚠️ Some basic tests failed"
        return 1
    fi
}

# Cleanup processes
cleanup() {
    log "INFO" "🧹 Cleaning up test environment..."
    
    # Kill background processes
    if [[ -n "${HUB_PID:-}" ]]; then
        log "INFO" "🔌 Stopping orchestration hub (PID: $HUB_PID)..."
        kill $HUB_PID 2>/dev/null || true
        wait $HUB_PID 2>/dev/null || true
    fi
    
    if [[ -n "${BACKEND_PID:-}" ]]; then
        log "INFO" "🔌 Stopping mock backend (PID: $BACKEND_PID)..."
        kill $BACKEND_PID 2>/dev/null || true
        wait $BACKEND_PID 2>/dev/null || true
    fi
    
    # Clean up temporary files
    rm -f /tmp/mock-backend.js
    
    log "INFO" "✅ Cleanup completed"
}

# Main function
main() {
    print_status "$BLUE" "======================================="
    print_status "$BLUE" "🧪 Week 1 Validation Test Runner"
    print_status "$BLUE" "======================================="
    
    # Set up trap for cleanup
    trap cleanup EXIT
    
    # Initialize log file
    echo "Week 1 Validation Test Run - $(date)" > "$LOG_FILE"
    
    # Run validation sequence
    check_prerequisites
    setup_test_environment
    start_orchestration_hub
    start_mock_backend
    
    # Wait a moment for services to stabilize
    sleep 3
    
    if run_validation_tests; then
        print_status "$GREEN" "✅ Week 1 validation tests completed successfully!"
        log "INFO" "🎉 Integration foundation is ready for Week 2"
        exit 0
    else
        print_status "$YELLOW" "⚠️ Some validation tests had issues"
        log "WARNING" "Please review the logs and fix any issues before proceeding to Week 2"
        exit 1
    fi
}

# Run main function
main "$@"