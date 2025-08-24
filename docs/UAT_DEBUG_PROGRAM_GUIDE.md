# UAT Debug Program - Complete Guide

## 🎯 Overview

The UAT (User Acceptance Testing) Debug Program is a comprehensive testing framework designed to validate that the Universal AI Tools system meets all user requirements and acceptance criteria. It provides automated testing, interactive debugging, performance monitoring, and detailed reporting capabilities.

## 📋 Features

### Core Capabilities
- **Automated Test Suites**: 8 comprehensive test categories
- **Interactive Debug Mode**: Real-time endpoint testing
- **Performance Monitoring**: Response time and load testing
- **Security Validation**: SQL injection, XSS, rate limiting tests
- **Memory Leak Detection**: Resource usage monitoring
- **User Journey Simulation**: Real-world workflow testing
- **Error Recovery Testing**: Graceful failure handling
- **Detailed Reporting**: JSON reports with full metrics

## 🚀 Quick Start

### Basic Usage

```bash
# Run full automated test suite
node scripts/uat-debug-program.js

# Interactive debug mode
node scripts/uat-debug-program.js --interactive

# Performance testing focus
node scripts/uat-debug-program.js --performance

# Regression testing mode  
node scripts/uat-debug-program.js --regression

# Debug mode with verbose output
DEBUG=true node scripts/uat-debug-program.js
```

### Environment Configuration

```bash
# Set custom base URL
UAT_BASE_URL=http://production.example.com node scripts/uat-debug-program.js

# Enable debug output
DEBUG=true node scripts/uat-debug-program.js

# Disable report generation
UAT_NO_REPORT=true node scripts/uat-debug-program.js
```

## 📊 Test Suites

### 1. Health and Status Checks
Tests basic system availability and component health:
- API health endpoint
- Database connection status
- Memory monitoring availability
- Agent registry functionality

### 2. User Journey Simulations
Simulates real user workflows:
- **New User Onboarding**: First-time user experience
- **Developer Workflow**: Code assistance and debugging
- **Error Recovery Flow**: Handling failures gracefully

### 3. Error Handling and Recovery
Validates error responses:
- 404 Not Found handling
- 400 Bad Request validation
- Method Not Allowed responses
- Timeout handling

### 4. Performance and Load Testing
Measures system performance:
- Response time benchmarks
- Concurrent request handling
- Memory usage monitoring
- Load capacity testing

### 5. Security Validation
Tests security measures:
- SQL injection prevention
- XSS attack prevention
- Rate limiting enforcement
- Authentication handling

### 6. Data Integrity and Consistency
Validates data structures:
- Agent data format validation
- Memory metrics consistency
- Response structure verification
- Data type checking

### 7. Integration Testing
Tests component interactions:
- Chat to Agent routing
- Memory monitoring workflow
- Database integration
- Service dependencies

### 8. Memory and Resource Management
Monitors resource usage:
- Memory usage baseline
- Garbage collection testing
- Memory leak detection
- Resource limit validation

## 🔍 Interactive Debug Mode

The interactive debugger provides real-time testing capabilities:

### Available Commands

```
help           - Show available commands
test <path>    - Test specific endpoint
health         - Check system health  
agents         - List available agents
memory         - Check memory usage
stress <n>     - Run stress test with n requests
report         - Generate test report
exit           - Exit interactive mode
```

### Example Interactive Session

```bash
$ node scripts/uat-debug-program.js --interactive

🔍 UAT Interactive Debug Mode
Type "help" for available commands

UAT> health
Health Status: HEALTHY
Details: {
  "status": "ok",
  "uptime": 3600,
  "version": "1.0.0"
}

UAT> agents
Available Agents (4):
  • Photo Organization Agent - Helps organize photos
  • Code Assistant Agent - Provides coding help
  • General Purpose Agent - General AI assistance
  • Vision Agent - Image analysis capabilities

UAT> test /api/v1/chat
Status: 200
Response: {
  "response": "Hello! How can I help you?",
  "model": "test-model"
}

UAT> memory
Memory Usage:
  Heap Used: 124 MB
  Heap Total: 256 MB
  Usage: 48.4%

UAT> stress 50
Running stress test with 50 requests...
Completed 50 requests in 523ms
Success rate: 100.0%
Avg time per request: 10.5ms

UAT> exit
```

## 📈 Test Reports

### Report Structure

Reports are saved to `./uat-reports/` with the following structure:

```json
{
  "sessionId": "uat-1634567890123",
  "timestamp": "2024-01-20T10:30:00Z",
  "config": {
    "baseUrl": "http://localhost:9999",
    "timeout": 30000
  },
  "summary": {
    "totalTests": 45,
    "passed": 42,
    "failed": 3
  },
  "testResults": [...],
  "performanceMetrics": [...],
  "errorLog": [...]
}
```

### Interpreting Results

#### Success Criteria
- **PASSED**: ≥70% success rate and ≤5 critical failures
- **FAILED**: <70% success rate or >5 critical failures

#### Performance Benchmarks
- **Excellent**: <200ms average response
- **Good**: 200-500ms average response
- **Acceptable**: 500-1000ms average response
- **Poor**: >1000ms average response

#### Memory Health
- **Healthy**: <70% heap usage
- **Warning**: 70-85% heap usage
- **Critical**: >85% heap usage

## 🎯 User Acceptance Criteria

### Core Requirements
1. **Functionality**: All features work as designed
2. **Performance**: Response times meet benchmarks
3. **Reliability**: 99% uptime, graceful error handling
4. **Security**: Protected against common attacks
5. **Usability**: Intuitive user workflows

### Test Coverage Requirements
- **User Roles**: ≥3 different user types tested
- **Experience Levels**: Beginner and expert flows
- **Error Scenarios**: All error types handled
- **Integration Points**: All services connected

## 🛠️ Advanced Configuration

### Custom Test Suites

Create custom test files in `tests/uat/custom/`:

```javascript
// custom-test.js
module.exports = {
  name: 'Custom Business Logic Test',
  tests: [
    {
      name: 'Specific Feature Test',
      endpoint: '/api/v1/custom-feature',
      method: 'POST',
      data: { test: 'data' },
      validate: (response) => {
        return response.status === 200 && 
               response.data.result === 'expected';
      }
    }
  ]
};
```

### Performance Profiling

Enable detailed performance profiling:

```bash
PROFILE=true node scripts/uat-debug-program.js --performance
```

This generates additional metrics:
- Percentile response times (p50, p95, p99)
- Request distribution graphs
- Bottleneck identification
- Resource correlation analysis

## 🔧 Troubleshooting

### Common Issues

#### Connection Refused
```
Error: connect ECONNREFUSED 127.0.0.1:9999
```
**Solution**: Ensure the server is running on the correct port.

#### Timeout Errors
```
Error: Request timeout
```
**Solution**: Increase timeout in config or check server performance.

#### Authentication Failures
```
Status: 401 Unauthorized
```
**Solution**: Check authentication configuration or use test bypass headers.

### Debug Tips

1. **Enable verbose logging**: `DEBUG=true`
2. **Test individual endpoints**: Use interactive mode
3. **Check server logs**: Review server-side errors
4. **Validate test data**: Ensure test data matches API requirements
5. **Network issues**: Use `curl` to test connectivity

## 📚 Best Practices

### For Developers
1. Run UAT tests before commits
2. Add tests for new features
3. Monitor performance trends
4. Document API changes
5. Review failed test details

### For QA Teams
1. Schedule regular UAT runs
2. Compare reports over time
3. Track regression patterns
4. Validate user workflows
5. Update test scenarios

### For DevOps
1. Integrate with CI/CD pipelines
2. Set up automated alerts
3. Monitor production metrics
4. Establish baselines
5. Plan capacity based on load tests

## 🔄 Continuous Improvement

### Adding New Tests
1. Identify user requirements
2. Create test scenarios
3. Implement validation logic
4. Add to appropriate suite
5. Document expected behavior

### Maintaining Test Quality
1. Review false positives
2. Update deprecated tests
3. Refactor duplicate tests
4. Optimize test performance
5. Keep documentation current

## 📊 Metrics and KPIs

### Key Metrics Tracked
- **Test Pass Rate**: Percentage of passing tests
- **Average Response Time**: Mean API response time
- **Error Rate**: Percentage of failed requests
- **Memory Growth**: MB per minute
- **Concurrent Capacity**: Max simultaneous users

### Success Indicators
- Pass rate >95% for critical paths
- Response time <500ms for 95% of requests
- Error rate <1% under normal load
- Memory growth <1MB/min
- Support 100+ concurrent users

## 🚀 Integration

### CI/CD Pipeline

```yaml
# .github/workflows/uat.yml
name: UAT Tests
on: [push, pull_request]
jobs:
  uat:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm run dev &
      - run: sleep 10
      - run: node scripts/uat-debug-program.js
      - uses: actions/upload-artifact@v2
        if: always()
        with:
          name: uat-reports
          path: uat-reports/
```

### Monitoring Integration

```javascript
// Send results to monitoring service
const results = await runUATTests();
await sendToDatadog(results);
await sendToNewRelic(results);
await alertOnFailure(results);
```

## 📝 Summary

The UAT Debug Program provides comprehensive testing coverage for the Universal AI Tools system. It ensures:

1. **User Requirements**: All acceptance criteria are met
2. **System Reliability**: Stable and predictable behavior
3. **Performance Standards**: Meets response time goals
4. **Security Compliance**: Protected against attacks
5. **Quality Assurance**: Consistent user experience

Regular UAT testing helps maintain system quality, catch regressions early, and ensure the application continues to meet user needs as it evolves.