# Universal AI Tools - Parallel Testing Guide

## 🚀 **Comprehensive Parallel Testing Framework**

This guide covers how to functionally test your smart Universal AI Tools system with parallel service execution and comprehensive test coverage.

## 📋 **Testing Framework Overview**

### **1. Parallel Service Management**

- **Python Service Manager**: `run_services_parallel.py` - Manages all services in parallel with health monitoring
- **Bash Test Runner**: `run_parallel_tests.sh` - Comprehensive test execution with service orchestration
- **Rust Integration Tests**: `crates/smart-router/tests/parallel_integration_tests.rs` - Parallel Rust tests using cargo-nextest

### **2. Test Types**

- **Functional Tests**: End-to-end testing of smart routing and caching
- **Load Tests**: High-concurrency testing with multiple parallel requests
- **Integration Tests**: Service-to-service communication testing
- **Performance Tests**: Response time and throughput validation

## 🛠 **Prerequisites**

### **Install Required Tools**

```bash
# Install cargo-nextest for parallel Rust testing
cargo install cargo-nextest

# Install Python dependencies
pip install aiohttp asyncio psutil

# Install Rust testing dependencies
cargo add --dev tokio reqwest serde_json futures
```

### **Verify Services Are Available**

```bash
# Check if Ollama is installed
ollama --version

# Check if Go services can be built
cd go-services && go build ./...

# Check if Rust services can be built
cargo check --workspace
```

## 🚀 **Running Tests**

### **Option 1: Complete Test Suite (Recommended)**

```bash
# Run all tests with parallel service management
./run_parallel_tests.sh
```

This will:

- Start all required services in parallel
- Run Rust tests with cargo-nextest
- Run Python functional tests
- Run load tests
- Generate comprehensive test report
- Clean up services automatically

### **Option 2: Python Service Manager**

```bash
# Start services in parallel with monitoring
python3 run_services_parallel.py

# In another terminal, run tests
python3 test_smart_system.py
```

### **Option 3: Manual Service Management**

```bash
# Terminal 1: Start Ollama
ollama serve

# Terminal 2: Start HRM Service
./start-hrm-service.sh

# Terminal 3: Start LLM Router
OLLAMA_URL=http://localhost:11434 cargo run -p llm-router

# Terminal 4: Run tests
cargo nextest run --workspace
```

## 🧪 **Test Categories**

### **1. Smart Routing Tests**

Tests intelligent model selection based on prompt complexity:

```rust
#[tokio::test]
async fn test_smart_routing_parallel() {
    // Tests routing decisions for different prompt types
    // - Simple tasks → fast models (gemma3:1b)
    // - Complex reasoning → HRM model
    // - Orchestration → DSPy
    // - Vision tasks → llava:7b
}
```

**Expected Results:**

- 80%+ success rate
- Appropriate model selection for each prompt type
- Response times under 2 seconds

### **2. Cache Performance Tests**

Tests intelligent caching with semantic similarity:

```rust
#[tokio::test]
async fn test_cache_performance_parallel() {
    // Tests cache hit rates with repeated/similar requests
    // - Exact matches should be cached
    // - Semantic similarity should find similar responses
    // - Cache hit rate should be 20%+ for repeated requests
}
```

**Expected Results:**

- 20%+ cache hit rate
- Sub-100ms response times for cache hits
- Semantic similarity working correctly

### **3. Load Balancing Tests**

Tests system performance under high concurrent load:

```rust
#[tokio::test]
async fn test_load_balancing_parallel() {
    // Tests with 10+ concurrent requests
    // - System should handle load gracefully
    // - Response times should remain reasonable
    // - No service failures under load
}
```

**Expected Results:**

- 70%+ success rate under load
- Response times under 5 seconds
- No service crashes

### **4. Health Monitoring Tests**

Tests service health monitoring and metrics:

```rust
#[tokio::test]
async fn test_health_monitoring_parallel() {
    // Tests health endpoints
    // - All services should report healthy
    // - Metrics should be accessible
    // - Monitoring should work correctly
}
```

**Expected Results:**

- 90%+ health check success rate
- All services reporting healthy status
- Metrics endpoints accessible

## 📊 **Test Configuration**

### **Cargo Nextest Configuration (`.nextest/config.toml`)**

```toml
[profile.default]
test-threads = 4          # Parallel test execution
retries = 2               # Retry failed tests
fail-fast = false         # Run all tests even if some fail
timeout = "300s"          # Test timeout
slow-timeout = "60s"      # Slow test timeout
```

### **Python Test Configuration**

```python
# Test parameters
TEST_TIMEOUT = 30         # Request timeout
PARALLEL_REQUESTS = 10    # Concurrent requests
CACHE_TEST_REPEATS = 5    # Cache test repetitions
```

## 🔍 **Test Results Analysis**

### **Success Metrics**

| Test Type             | Success Rate  | Response Time   | Notes                       |
| --------------------- | ------------- | --------------- | --------------------------- |
| **Smart Routing**     | 80%+          | <2s             | Appropriate model selection |
| **Cache Performance** | 20%+ hit rate | <100ms (cached) | Semantic similarity working |
| **Load Balancing**    | 70%+          | <5s             | System stable under load    |
| **Health Monitoring** | 90%+          | <1s             | All services healthy        |

### **Performance Benchmarks**

- **Simple Tasks**: 0.5-1.0s response time
- **Complex Reasoning**: 1.0-3.0s response time
- **Cache Hits**: <0.1s response time
- **Load Test**: 70%+ success rate with 20+ concurrent requests

## 🐛 **Troubleshooting**

### **Common Issues**

1. **Services Not Starting**

   ```bash
   # Check if ports are available
   lsof -i :3033 -i :8002 -i :11434

   # Kill conflicting processes
   pkill -f "ollama\|cargo\|python.*hrm"
   ```

2. **Test Timeouts**

   ```bash
   # Increase timeout in .nextest/config.toml
   timeout = "600s"

   # Or run with longer timeout
   cargo nextest run --timeout 600s
   ```

3. **Memory Issues**

   ```bash
   # Reduce parallel test threads
   cargo nextest run --test-threads 2

   # Or run tests sequentially
   cargo nextest run --test-threads 1
   ```

4. **Service Health Check Failures**

   ```bash
   # Check service logs
   tail -f /tmp/llm-router.log
   tail -f /tmp/hrm-service.log

   # Verify service endpoints
   curl http://localhost:3033/health
   curl http://localhost:8002/health
   ```

### **Debug Mode**

```bash
# Run with debug logging
RUST_LOG=debug cargo nextest run

# Run specific test with verbose output
cargo nextest run test_smart_routing -- --nocapture

# Run Python tests with debug output
python3 test_smart_system.py --debug
```

## 📈 **Continuous Integration**

### **GitHub Actions Example**

```yaml
name: Parallel Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions-rs/toolchain@v1
        with:
          toolchain: stable

      - name: Install cargo-nextest
        run: cargo install cargo-nextest

      - name: Install Python dependencies
        run: pip install aiohttp asyncio psutil

      - name: Start services
        run: python3 run_services_parallel.py &

      - name: Wait for services
        run: sleep 30

      - name: Run tests
        run: ./run_parallel_tests.sh
```

## 🎯 **Best Practices**

### **1. Test Organization**

- Group related tests together
- Use descriptive test names
- Keep tests independent and parallelizable
- Clean up resources after tests

### **2. Service Management**

- Start services in dependency order
- Wait for health checks before running tests
- Clean up services after test completion
- Use unique ports to avoid conflicts

### **3. Performance Testing**

- Test with realistic load levels
- Monitor resource usage during tests
- Use appropriate timeouts
- Test both success and failure scenarios

### **4. Debugging**

- Use structured logging
- Capture service logs during tests
- Generate detailed test reports
- Include performance metrics

## 📋 **Test Checklist**

Before running tests, ensure:

- [ ] All required services can be built
- [ ] Ollama is installed and accessible
- [ ] Python dependencies are installed
- [ ] Ports 3033, 8002, 11434 are available
- [ ] Environment variables are set correctly
- [ ] Test data is available
- [ ] Logging is configured appropriately

## 🚀 **Quick Start**

```bash
# 1. Install dependencies
cargo install cargo-nextest
pip install aiohttp asyncio psutil

# 2. Run complete test suite
./run_parallel_tests.sh

# 3. Check results
cat /tmp/test_report.md
```

This comprehensive testing framework ensures your smart Universal AI Tools system is robust, performant, and ready for production use!
