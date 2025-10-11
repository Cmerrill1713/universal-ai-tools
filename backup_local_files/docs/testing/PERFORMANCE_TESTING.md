# Universal AI Tools - Performance Testing Suite
This comprehensive performance testing suite provides load testing, performance validation, and bottleneck identification for Universal AI Tools.
## Overview
The performance testing framework includes:
1. **API Endpoint Performance Tests** - Load testing for REST APIs

2. **Database Performance Tests** - Query performance and connection pooling

3. **Cache Performance Tests** - Redis operations and hit rates

4. **Resource Management Tests** - Memory, CPU, and connection limits

5. **WebSocket Performance Tests** - Real-time connection handling

6. **AI Service Performance Tests** - Model inference and throughput
## Quick Start
### System Resource Check

```bash

npm run test:performance:system

```
### Quick Performance Tests

```bash
# Run all quick tests

npm run test:performance:quick

# Run specific component tests

npm run test:performance:api

npm run test:performance:cache  

npm run test:performance:database

```
### Comprehensive Performance Suite

```bash
# Full test suite with all components

npm run test:performance:full

# Basic performance test

npm run test:performance

```
## Test Components
### 1. Load Testing Framework (`load-test-framework.ts`)
**Features:**

- Concurrent user simulation

- Multiple endpoint testing

- Scenario-based testing

- Real-time metrics collection

- Response time percentiles

- Error rate tracking
**Usage:**

```typescript

import { LoadTestFramework, createApiLoadTest } from './load-test-framework';
const config = createApiLoadTest('http://localhost:3000');

config.concurrentUsers = 50;

config.testDuration = 120;
const tester = new LoadTestFramework(config);

const results = await tester.runLoadTest();

```
**Key Metrics:**

- Requests per second

- Average response time

- P95/P99 latency

- Error rate

- Concurrent users
### 2. Database Performance Testing (`database-performance.ts`)
**Features:**

- Query performance analysis

- Connection pool monitoring

- Concurrent query execution

- Migration performance

- Backup operation testing
**Usage:**

```typescript

import { DatabasePerformanceTester } from './database-performance';
const tester = new DatabasePerformanceTester();

const results = await tester.runPerformanceTest({

  duration: 60,

  concurrentConnections: 20,

  queryTypes: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],

  dataSize: 'medium'

});

```
**Key Metrics:**

- Queries per second

- Average query time

- Connection pool utilization

- Success rate

- P95/P99 query response time
### 3. Cache Performance Testing (`cache-performance.ts`)
**Features:**

- Redis operation testing

- Hit rate analysis

- Memory usage monitoring

- Eviction policy testing

- Consistency validation
**Usage:**

```typescript

import { CachePerformanceTester } from './cache-performance';
const tester = new CachePerformanceTester();

const results = await tester.runPerformanceTest({

  duration: 60,

  concurrentOperations: 100,

  operationMix: { get: 60, set: 25, del: 10, exists: 5 },

  dataSize: 'medium',

  keyCount: 10000

});

```
**Key Metrics:**

- Cache hit rate

- Operations per second

- Average response time

- Memory usage

- Eviction rate
### 4. Resource Management Testing (`resource-management.ts`)
**Features:**

- Memory stress testing

- CPU utilization monitoring

- Connection limit testing

- File descriptor tracking

- Resource leak detection
**Usage:**

```typescript

import { ResourceManagementTester } from './resource-management';
const tester = new ResourceManagementTester();

const results = await tester.runResourceStressTest({

  duration: 60,

  memory_stress_mb: 1024,

  cpu_stress_cores: 4,

  connection_stress_count: 500,

  file_descriptor_stress_count: 1000,

  monitoring_interval: 1000

});

```
**Key Metrics:**

- Peak memory usage

- CPU utilization

- Connection limits

- File descriptor usage

- Stability score
### 5. WebSocket Performance Testing (`websocket-performance.ts`)
**Features:**

- Connection establishment testing

- Message throughput analysis

- Latency monitoring

- Connection stability

- Memory leak detection
**Usage:**

```typescript

import { WebSocketPerformanceTester } from './websocket-performance';
const tester = new WebSocketPerformanceTester();

const results = await tester.runWebSocketPerformanceTest({

  server_port: 3001,

  max_connections: 100,

  connection_rate: 10,

  message_frequency: 5,

  message_size: 1024,

  test_duration: 60,

  enable_message_ordering: true,

  enable_reconnection: true

});

```
**Key Metrics:**

- Connection success rate

- Message latency

- Messages per second

- Connection stability

- Memory growth
### 6. AI Service Performance Testing (`ai-service-performance.ts`)
**Features:**

- Model inference performance

- Concurrent request handling

- Queue management

- Token throughput

- Bottleneck identification
**Usage:**

```typescript

import { AIServicePerformanceTester } from './ai-service-performance';
const tester = new AIServicePerformanceTester('http://localhost:3000');

const results = await tester.runAIPerformanceTest({

  models: ['llama3.2:latest', 'phi3:latest'],

  request_types: ['completion', 'chat'],

  concurrent_requests: 10,

  test_duration: 120,

  ramp_up_time: 20,

  request_patterns: {

    small_requests: 40,

    medium_requests: 40,

    large_requests: 20

  },

  enable_batching: true,

  max_queue_depth: 50

});

```
**Key Metrics:**

- Tokens per second

- Model loading time

- Queue efficiency

- Memory per request

- Bottleneck analysis
## Performance Test Runner
The main test orchestrator (`performance-test-runner.ts`) coordinates all test components:
```bash
# CLI Usage

tsx src/tests/performance/performance-test-runner.ts \

  --url http://localhost:3000 \

  --duration 60 \

  --concurrent 20 \

  --include-ai \

  --include-websocket \

  --include-stress \

  --data-size medium \

  --format console

```
**Options:**

- `--url`: Target URL for testing

- `--duration`: Test duration per component (seconds)

- `--concurrent`: Number of concurrent users/connections

- `--include-ai`: Include AI service tests

- `--include-websocket`: Include WebSocket tests

- `--include-stress`: Include stress tests

- `--data-size`: Test data size (small|medium|large)

- `--format`: Report format (console|json|html)
## Results and Reporting
### Console Output

The test suite provides real-time console output with:

- Progress indicators

- Live metrics

- Color-coded status

- Summary tables

- Bottleneck identification

- Scaling recommendations
### Performance Scoring

Each component receives a score (0-100) based on:

- Error rates

- Response times

- Throughput

- Resource utilization

- Stability metrics
### Comprehensive Report

The final report includes:

```typescript

interface ComprehensivePerformanceResult {

  test_summary: {

    total_duration: number;

    tests_run: number;

    tests_passed: number;

    tests_failed: number;

    overall_score: number;

  };

  api_performance: LoadTestMetrics;

  database_performance: DatabasePerformanceResult;

  cache_performance: CachePerformanceResult;

  resource_management: ResourceStressTestResult;

  websocket_performance?: WebSocketPerformanceResult;

  ai_service_performance?: AIModelPerformanceResult;

  bottlenecks: BottleneckAnalysis[];

  scaling_recommendations: ScalingRecommendations;

  performance_baseline: PerformanceBaseline;

}

```
## Performance Baselines
The suite establishes performance baselines for:

- **API Throughput**: Requests per second under normal load

- **Response Times**: P50, P95, P99 latency targets

- **Resource Usage**: Memory and CPU utilization limits

- **Cache Efficiency**: Expected hit rates and response times

- **Database Performance**: Query times and connection limits
## Bottleneck Analysis
Automated bottleneck identification for:

- **API Gateway**: High error rates, slow responses

- **Database**: Slow queries, connection exhaustion

- **Cache**: Low hit rates, memory pressure

- **Resources**: Memory/CPU limits, connection limits

- **AI Services**: Model loading, queue depth
## Scaling Recommendations
Generated recommendations include:

- **CPU Scaling**: Core count recommendations

- **Memory Scaling**: RAM increase suggestions

- **Database Scaling**: Vertical/horizontal scaling

- **Cache Scaling**: Size and configuration optimization

- **Connection Scaling**: Pool size adjustments
## Environment Variables
Required environment variables:

```bash
# Service Configuration

BASE_URL=http://localhost:3000

PORT=3000

# Database Configuration  

SUPABASE_URL=your_supabase_url

SUPABASE_ANON_KEY=your_anon_key

SUPABASE_SERVICE_KEY=your_service_key

# Cache Configuration

REDIS_URL=redis://localhost:6379

REDIS_HOST=localhost

REDIS_PORT=6379

# Test Configuration

TEST_DURATION=60

CONCURRENT_USERS=20

DATA_SIZE=medium

OUTPUT_FORMAT=console

```
## Monitoring Integration
The performance tests integrate with:

- **OpenTelemetry**: Distributed tracing

- **Prometheus**: Metrics collection

- **Resource Monitor**: System resource tracking

- **Performance Monitor**: Application metrics
## Best Practices
### Before Testing

1. Ensure all services are running

2. Set appropriate environment variables

3. Clear caches and restart services

4. Verify database connectivity

5. Check available system resources
### During Testing

1. Monitor system resources

2. Watch for error patterns

3. Note performance degradation points

4. Observe memory usage trends

5. Check connection stability
### After Testing

1. Review comprehensive report

2. Identify primary bottlenecks

3. Implement scaling recommendations

4. Establish performance baselines

5. Set up monitoring alerts
## Troubleshooting
### Common Issues
**High Error Rates:**

- Check service availability

- Verify connection limits

- Review timeout settings

- Check authentication
**Poor Performance:**

- Monitor system resources

- Check database queries

- Review cache configuration

- Analyze connection pools
**Memory Issues:**

- Enable garbage collection monitoring

- Check for memory leaks

- Review connection cleanup

- Monitor heap usage
**Connection Problems:**

- Verify network connectivity

- Check firewall settings

- Review connection pool limits

- Monitor connection lifecycle
### Debug Commands

```bash
# Monitor resources

npm run resources:monitor

# Check health status

npm run resources:health

# Force garbage collection

npm run resources:gc

# Check memory leaks

npm run resources:leaks

# Connection status

npm run resources:connections

```
## Integration with CI/CD
Example GitHub Actions workflow:

```yaml

name: Performance Testing

on:

  push:

    branches: [main]

  pull_request:

    branches: [main]
jobs:

  performance:

    runs-on: ubuntu-latest

    steps:

      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3

        with:

          node-version: '18'

      - run: npm install

      - run: npm run test:performance:quick

      - name: Full Performance Test

        if: github.event_name == 'push'

        run: npm run test:performance:full

```
## Contributing
When adding new performance tests:

1. Follow existing patterns and interfaces

2. Include comprehensive metrics collection

3. Add bottleneck detection logic

4. Provide scaling recommendations

5. Update documentation

6. Add integration tests
## License
This performance testing suite is part of Universal AI Tools and follows the same license terms.