# GraphRAG Load Testing Suite

Comprehensive performance testing framework for validating GraphRAG service optimizations including database connection pooling, Redis caching strategies, and overall system throughput.

## Overview

The load testing suite validates the performance improvements from:
- **Redis Caching Optimization**: Intelligent caching for embeddings and search results
- **Database Connection Pooling**: Production-grade PostgreSQL connection management
- **Concurrent Request Handling**: Async/await performance under load
- **Memory Optimization**: Efficient resource utilization patterns

## Quick Start

### 1. Start GraphRAG Service
```bash
# Start the GraphRAG service first
cargo run --release

# Verify service is running
curl http://localhost:8000/health
```

### 2. Run Load Tests

#### Quick Test (1 minute)
```bash
./run_load_test.sh quick
```

#### Standard Test (5 minutes)
```bash
./run_load_test.sh standard
```

#### Stress Test (10 minutes)
```bash
./run_load_test.sh stress
```

#### Cache-Focused Test
```bash
./run_load_test.sh cache
```

#### Connection Pool Test
```bash
./run_load_test.sh pool
```

### 3. Manual Configuration
```bash
# Custom load test with specific parameters
cargo run --bin load_test -- \
    --concurrent-users 100 \
    --duration 600 \
    --requests-per-second 3.0 \
    --scenarios all \
    --detailed
```

## Test Scenarios

### Entity Extraction (`extract`)
- Tests NLP entity extraction performance
- Validates Redis caching for repeated text processing
- Measures response time under concurrent extraction requests

### Vector Search (`search`)
- Tests Qdrant vector database performance
- Validates embedding generation and storage
- Measures search accuracy and speed

### Hybrid Search (`hybrid`)
- Tests combined vector + graph search
- Validates Neo4j graph database integration
- Measures complex query performance

### Cache Performance (`cache`)
- Tests Redis caching effectiveness
- Validates TTL settings and cache hit rates
- Measures cache-based performance improvements

### Connection Pool (`pool`)
- Tests PostgreSQL connection pooling
- Validates connection acquisition times
- Measures database performance under load

### End-to-End Workflow (`e2e`)
- Tests complete entity extraction → search → hybrid workflow
- Validates system integration performance
- Measures real-world usage patterns

## Performance Targets

### Response Time Targets
- **Average Response Time**: < 500ms
- **P95 Response Time**: < 1000ms
- **P99 Response Time**: < 2000ms

### Throughput Targets
- **Minimum Throughput**: > 100 RPS
- **Target Throughput**: > 200 RPS
- **Optimal Throughput**: > 500 RPS

### Error Rate Targets
- **Maximum Error Rate**: < 1%
- **Target Error Rate**: < 0.1%

### Cache Performance Targets
- **Minimum Cache Hit Rate**: > 50%
- **Target Cache Hit Rate**: > 80%
- **Optimal Cache Hit Rate**: > 95%

## Configuration

### Environment Variables
```bash
# Service configuration
export SERVICE_URL="http://localhost:8000"
export RUST_LOG="info"

# Load test configuration
export CONCURRENT_USERS=50
export TEST_DURATION=300
export REQUESTS_PER_SECOND=2.0
```

### JSON Configuration File
```json
{
  "service_url": "http://localhost:8000",
  "concurrent_users": 50,
  "test_duration": 300,
  "requests_per_second": 2.0,
  "scenarios": ["EntityExtraction", "VectorSearch", "HybridSearch"],
  "request_timeout": 30,
  "detailed_metrics": true
}
```

Use configuration file:
```bash
cargo run --bin load_test -- --config load_test_config.json
```

## Results Analysis

### Performance Score Calculation
- **90-100**: Excellent - Production ready
- **75-89**: Good - Minor optimizations needed  
- **60-74**: Fair - Significant improvements required
- **<60**: Poor - Major performance issues

### Key Metrics
- **Total Requests**: Number of requests executed
- **Success Rate**: Percentage of successful requests
- **Error Rate**: Percentage of failed requests
- **Throughput**: Requests per second achieved
- **Response Time**: Average, P95, P99 latencies
- **Cache Hit Rate**: Redis cache effectiveness
- **Connection Pool Stats**: Database performance

### Report Files
Load test results are saved to timestamped directories:
```
load_test_results_20250822_120000/
├── load_test_output.log          # Console output
├── load_test_report_*.json       # Detailed metrics
└── performance_analysis.txt      # Analysis summary
```

## Optimization Recommendations

### High Error Rate (>1%)
- Check service health endpoints
- Verify database connection limits
- Review error logs for patterns
- Consider implementing circuit breakers

### High Response Time (>500ms)
- Enable Redis caching for frequent queries
- Optimize database connection pooling
- Implement request batching
- Review slow query patterns

### Low Throughput (<100 RPS)
- Increase connection pool size
- Optimize async request handling
- Consider horizontal scaling
- Review resource utilization

### Low Cache Hit Rate (<80%)
- Tune Redis TTL settings
- Implement cache warming strategies
- Review cache key organization
- Optimize cache invalidation patterns

## Redis Cache Validation

### Cache Performance Metrics
```bash
# Check Redis memory usage
redis-cli info memory

# Check cache statistics
redis-cli info stats

# Monitor cache keys
redis-cli monitor
```

### Cache Key Patterns
- `embedding:{hash}` - Cached embeddings
- `search:{query_hash}` - Search results
- `entity:{entity_id}` - Entity data
- `knowledge:{knowledge_id}` - Knowledge entries

### Cache TTL Strategy
- **Embeddings**: 1 hour (frequent reuse)
- **Search Results**: 30 minutes (moderate reuse)
- **Entity Data**: 2 hours (stable data)
- **Knowledge**: 4 hours (long-term storage)

## Database Connection Pool Validation

### Pool Configuration
```rust
DatabasePoolConfig {
    postgres_max_connections: 50,
    postgres_min_connections: 10,
    postgres_acquire_timeout: Duration::from_secs(15),
    postgres_idle_timeout: Duration::from_secs(900),
    postgres_max_lifetime: Duration::from_secs(3600),
}
```

### Pool Health Monitoring
- **Active Connections**: Currently in use
- **Idle Connections**: Available for reuse
- **Acquire Time**: Time to get connection
- **Pool Utilization**: Usage percentage

## Troubleshooting

### Common Issues

#### "Service not available"
```bash
# Check if service is running
curl http://localhost:8000/health

# Start service if needed
cargo run --release
```

#### "High error rate"
```bash
# Check service logs
RUST_LOG=debug cargo run --release

# Verify database connections
psql postgresql://localhost:5432/postgres
```

#### "Low cache hit rate"
```bash
# Check Redis status
redis-cli ping

# Monitor cache operations
redis-cli monitor | grep -E "(GET|SET|EXPIRE)"
```

#### "Connection pool timeouts"
```bash
# Check PostgreSQL connection limits
psql -c "SHOW max_connections;"

# Monitor active connections
psql -c "SELECT count(*) FROM pg_stat_activity;"
```

### Performance Debugging

#### Enable Detailed Logging
```bash
RUST_LOG=debug,sqlx=info,qdrant_client=info cargo run --release
```

#### Monitor System Resources
```bash
# CPU and memory usage
htop

# Network connections
netstat -tuln | grep :8000

# Disk I/O
iostat -x 1
```

## Integration with CI/CD

### GitHub Actions Example
```yaml
name: Load Test
on:
  push:
    branches: [main]

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Start services
        run: docker-compose up -d
      - name: Run load test
        run: ./rust-services/graphrag/run_load_test.sh quick
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: load-test-results
          path: rust-services/graphrag/load_test_results_*
```

### Performance Regression Detection
```bash
# Compare with baseline
./run_load_test.sh standard > current_results.txt
diff baseline_results.txt current_results.txt

# Automated threshold checking
if (( $(echo "$(grep 'Throughput:' current_results.txt | awk '{print $2}') < 100" | bc -l) )); then
    echo "Performance regression detected!"
    exit 1
fi
```

## Advanced Configuration

### Custom Test Scenarios
```rust
// Add custom scenarios in src/load_test/mod.rs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TestScenario {
    // ... existing scenarios
    CustomWorkflow,
    BatchProcessing,
    RealTimeUpdates,
}
```

### Custom Metrics Collection
```rust
// Add custom metrics in LoadTestMetrics
pub struct LoadTestMetrics {
    // ... existing metrics
    pub custom_counter: AtomicU64,
    pub custom_histogram: Arc<tokio::sync::Mutex<Vec<Duration>>>,
}
```

### Integration Testing
```bash
# Test with external services
SERVICE_URL="https://staging.graphrag.service" ./run_load_test.sh standard

# Test with different configurations
REDIS_URL="redis://cluster.example.com:6379" ./run_load_test.sh cache
```

## Contributing

### Adding New Test Scenarios
1. Add scenario to `TestScenario` enum
2. Implement scenario logic in `LoadTestExecutor`
3. Update CLI argument parsing
4. Add scenario documentation

### Extending Metrics
1. Add metric fields to `LoadTestMetrics`
2. Update metric collection in test execution
3. Include metrics in results generation
4. Update report formatting

### Performance Improvements
1. Profile with `cargo flamegraph`
2. Benchmark with `criterion`
3. Validate improvements with load tests
4. Document optimization techniques

## License

MIT License - See LICENSE file for details.