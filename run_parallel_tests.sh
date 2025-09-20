#!/bin/bash
# Comprehensive Parallel Testing Script for Universal AI Tools
# Uses cargo-nextest for parallel test execution and service management

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="/Users/christianmerrill/Desktop/universal-ai-tools"
TEST_TIMEOUT=300
PARALLEL_JOBS=4
SERVICES_TO_START=("ollama" "hrm-service" "llm-router")

# Function to print colored output
print_status() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] ✅${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] ⚠️${NC} $1"
}

print_error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ❌${NC} $1"
}

# Function to check if a service is running
check_service() {
    local service_name=$1
    local port=$2
    local health_endpoint=$3

    if curl -s "http://localhost:${port}${health_endpoint}" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to start a service
start_service() {
    local service_name=$1
    local port=$2
    local health_endpoint=$3
    local command=$4

    print_status "Starting ${service_name}..."

    # Start service in background
    eval "$command" > "/tmp/${service_name}.log" 2>&1 &
    local pid=$!
    echo $pid > "/tmp/${service_name}.pid"

    # Wait for service to be healthy
    local attempts=0
    local max_attempts=30

    while [ $attempts -lt $max_attempts ]; do
        if check_service "$service_name" "$port" "$health_endpoint"; then
            print_success "${service_name} is healthy"
            return 0
        fi

        sleep 2
        attempts=$((attempts + 1))
    done

    print_error "${service_name} failed to start after $((max_attempts * 2)) seconds"
    return 1
}

# Function to stop a service
stop_service() {
    local service_name=$1

    if [ -f "/tmp/${service_name}.pid" ]; then
        local pid=$(cat "/tmp/${service_name}.pid")
        if kill -0 "$pid" 2>/dev/null; then
            print_status "Stopping ${service_name} (PID: ${pid})..."
            kill "$pid"
            wait "$pid" 2>/dev/null || true
            print_success "${service_name} stopped"
        fi
        rm -f "/tmp/${service_name}.pid"
    fi
}

# Function to cleanup all services
cleanup_services() {
    print_status "Cleaning up services..."

    for service in "${SERVICES_TO_START[@]}"; do
        stop_service "$service"
    done

    # Kill any remaining processes
    pkill -f "ollama serve" 2>/dev/null || true
    pkill -f "cargo run -p llm-router" 2>/dev/null || true
    pkill -f "python.*hrm-service.py" 2>/dev/null || true

    print_success "Cleanup complete"
}

# Function to run Rust tests with cargo-nextest
run_rust_tests() {
    print_status "Running Rust tests with cargo-nextest..."

    cd "$PROJECT_ROOT"

    # Install cargo-nextest if not available
    if ! command -v cargo-nextest &> /dev/null; then
        print_status "Installing cargo-nextest..."
        cargo install cargo-nextest
    fi

    # Run tests in parallel
    cargo nextest run \
        --workspace \
        --test-threads "$PARALLEL_JOBS" \
        --retries 2 \
        --fail-fast \
        --features "test" \
        2>&1 | tee "/tmp/rust_tests.log"

    local exit_code=${PIPESTATUS[0]}

    if [ $exit_code -eq 0 ]; then
        print_success "Rust tests passed"
    else
        print_error "Rust tests failed"
    fi

    return $exit_code
}

# Function to run Python tests
run_python_tests() {
    print_status "Running Python functional tests..."

    cd "$PROJECT_ROOT"

    # Install required Python packages
    pip install -q aiohttp asyncio psutil

    # Run Python tests
    python3 test_smart_system.py 2>&1 | tee "/tmp/python_tests.log"

    local exit_code=${PIPESTATUS[0]}

    if [ $exit_code -eq 0 ]; then
        print_success "Python tests passed"
    else
        print_error "Python tests failed"
    fi

    return $exit_code
}

# Function to run load tests
run_load_tests() {
    print_status "Running load tests..."

    cd "$PROJECT_ROOT"

    # Create load test script
    cat > "/tmp/load_test.py" << 'EOF'
#!/usr/bin/env python3
import asyncio
import aiohttp
import time
import statistics

async def load_test():
    concurrent_requests = 20
    total_requests = 100

    async def make_request(session, request_id):
        start_time = time.time()
        try:
            async with session.post(
                "http://localhost:3033/chat",
                json={
                    "messages": [{"role": "user", "content": f"Load test request {request_id}"}],
                    "model": None,
                    "temperature": 0.7
                },
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                response_time = (time.time() - start_time) * 1000
                return {
                    "success": response.status == 200,
                    "response_time": response_time,
                    "status_code": response.status
                }
        except Exception as e:
            return {
                "success": False,
                "response_time": (time.time() - start_time) * 1000,
                "error": str(e)
            }

    async with aiohttp.ClientSession() as session:
        # Run concurrent requests
        tasks = []
        for i in range(total_requests):
            task = make_request(session, i)
            tasks.append(task)

            # Limit concurrent requests
            if len(tasks) >= concurrent_requests:
                results = await asyncio.gather(*tasks)
                tasks = []

                # Process results
                successful = [r for r in results if r["success"]]
                response_times = [r["response_time"] for r in successful]

                if response_times:
                    avg_time = statistics.mean(response_times)
                    print(f"Batch completed: {len(successful)}/{len(results)} successful, avg time: {avg_time:.2f}ms")

        # Process remaining tasks
        if tasks:
            results = await asyncio.gather(*tasks)
            successful = [r for r in results if r["success"]]
            response_times = [r["response_time"] for r in successful]

            if response_times:
                avg_time = statistics.mean(response_times)
                print(f"Final batch: {len(successful)}/{len(results)} successful, avg time: {avg_time:.2f}ms")

if __name__ == "__main__":
    asyncio.run(load_test())
EOF

    python3 /tmp/load_test.py 2>&1 | tee "/tmp/load_tests.log"

    local exit_code=${PIPESTATUS[0]}

    if [ $exit_code -eq 0 ]; then
        print_success "Load tests completed"
    else
        print_error "Load tests failed"
    fi

    return $exit_code
}

# Function to generate test report
generate_report() {
    print_status "Generating test report..."

    local report_file="/tmp/test_report.md"

    cat > "$report_file" << EOF
# Universal AI Tools - Parallel Test Report
Generated: $(date)

## Test Summary

### Rust Tests (cargo-nextest)
\`\`\`
$(cat /tmp/rust_tests.log | tail -20)
\`\`\`

### Python Functional Tests
\`\`\`
$(cat /tmp/python_tests.log | tail -20)
\`\`\`

### Load Tests
\`\`\`
$(cat /tmp/load_tests.log | tail -20)
\`\`\`

## Service Logs

### Ollama Service
\`\`\`
$(tail -20 /tmp/ollama.log 2>/dev/null || echo "No logs available")
\`\`\`

### HRM Service
\`\`\`
$(tail -20 /tmp/hrm-service.log 2>/dev/null || echo "No logs available")
\`\`\`

### LLM Router Service
\`\`\`
$(tail -20 /tmp/llm-router.log 2>/dev/null || echo "No logs available")
\`\`\`

## Recommendations

1. Review any failed tests and address issues
2. Monitor service performance under load
3. Consider optimizing slow endpoints
4. Update test cases based on results

EOF

    print_success "Test report generated: $report_file"
}

# Main execution
main() {
    print_status "Starting Universal AI Tools Parallel Testing Suite"
    print_status "Project Root: $PROJECT_ROOT"
    print_status "Parallel Jobs: $PARALLEL_JOBS"
    print_status "Test Timeout: ${TEST_TIMEOUT}s"

    # Setup cleanup trap
    trap cleanup_services EXIT

    # Start required services
    print_status "Starting required services..."

    # Start Ollama
    start_service "ollama" "11434" "/api/tags" "ollama serve" || {
        print_error "Failed to start Ollama"
        exit 1
    }

    # Start HRM Service
    start_service "hrm-service" "8002" "/health" "cd $PROJECT_ROOT && python3 python-services/hrm-service.py --port 8002" || {
        print_error "Failed to start HRM service"
        exit 1
    }

    # Start LLM Router
    start_service "llm-router" "3033" "/health" "cd $PROJECT_ROOT && OLLAMA_URL=http://localhost:11434 cargo run -p llm-router" || {
        print_error "Failed to start LLM Router"
        exit 1
    }

    # Wait for all services to be ready
    print_status "Waiting for all services to be ready..."
    sleep 10

    # Run tests
    local test_results=()

    # Run Rust tests
    run_rust_tests
    test_results+=($?)

    # Run Python tests
    run_python_tests
    test_results+=($?)

    # Run load tests
    run_load_tests
    test_results+=($?)

    # Generate report
    generate_report

    # Check overall results
    local failed_tests=0
    for result in "${test_results[@]}"; do
        if [ $result -ne 0 ]; then
            failed_tests=$((failed_tests + 1))
        fi
    done

    if [ $failed_tests -eq 0 ]; then
        print_success "All tests passed! 🎉"
        exit 0
    else
        print_error "$failed_tests test suite(s) failed"
        exit 1
    fi
}

# Run main function
main "$@"
