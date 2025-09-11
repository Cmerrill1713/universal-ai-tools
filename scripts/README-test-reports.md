# Universal AI Tools - Test Report Generator

This comprehensive test report generator consolidates results from all test suites and provides detailed analysis of system health, security, and production readiness.

## Features

### 🎯 Comprehensive Testing
- **Phase 1 Fixes**: Critical infrastructure validation
- **Security Validation**: Vulnerability assessment and hardening checks
- **Performance Tests**: Monitoring and optimization validation
- **Integration Tests**: End-to-end system validation
- **Health Checks**: Service availability and response time monitoring

### 📊 Multiple Report Formats
- **Markdown**: Human-readable reports with tables and charts
- **JSON**: Machine-readable data for CI/CD integration
- **HTML**: Interactive web-based reports with visual elements

### 🎛️ Production Readiness Assessment
- **Overall Health Score**: Weighted scoring based on test importance
- **Phase 1 Progress**: Specific tracking for Phase 1 completion
- **Security Score**: Dedicated security vulnerability assessment
- **Recommendations**: Prioritized action items for improvement

### 📈 Visual Progress Tracking
- Progress bars for Phase 1 completion
- Health score visualization
- Test result summaries with pass/fail rates
- Performance metrics charting

## Quick Start

### Basic Usage

```bash
# Generate report from existing test results
npm run report:generate

# Run Phase 1 tests and generate report
npm run report:test

# Run all tests and generate comprehensive report
npm run report:full

# Generate report without running tests
npm run report:quick
```

### Advanced Usage

```bash
# Run comprehensive test suite with server management
node scripts/run-comprehensive-tests.js

# Open HTML report in browser after generation
node scripts/run-comprehensive-tests.js --open

# Generate report assuming server is already running
node scripts/generate-test-report.js --skip-server-check
```

## Report Structure

### Executive Summary
- Overall health score (0-100%)
- Phase 1 progress percentage
- Total/passed/failed test counts
- Production readiness assessment

### Test Suite Results
- Individual test suite results with scoring
- Duration and performance metrics
- Category-based organization (critical, security, performance, integration)
- Weighted scoring based on importance

### Service Health Checks
- Endpoint availability validation
- Response time monitoring
- Critical service status verification

### Security Assessment
- Vulnerability scan results
- Security hardening validation
- Authentication and authorization checks
- CORS and header security validation

### Performance Metrics
- Memory usage tracking
- Request/response performance
- Cache performance analysis
- Database query optimization

### Recommendations
- **Critical**: Must fix before deployment
- **High**: Should fix before deployment
- **Medium**: Can be addressed post-deployment

## Configuration

The test report generator uses `scripts/test-report-config.json` for configuration:

```json
{
  "testSuites": [
    {
      "name": "Phase 1 Fixes",
      "script": "tests/test-phase1-fixes.js",
      "weight": 40,
      "category": "critical",
      "required": true
    }
  ],
  "healthChecks": [
    {
      "name": "Server Health",
      "endpoint": "/api/health",
      "timeout": 5000,
      "required": true
    }
  ],
  "scoring": {
    "excellent": 95,
    "good": 80,
    "fair": 60,
    "poor": 0
  }
}
```

### Adding New Test Suites

1. Add your test script to the project
2. Update `test-report-config.json` with the new suite configuration
3. Set appropriate weight and category
4. The generator will automatically include it in reports

### Custom Health Checks

1. Add new endpoints to the `healthChecks` array in config
2. Specify timeout, method, and required status
3. Health checks support GET and POST requests with custom bodies

## CI/CD Integration

The test report generator provides exit codes for CI/CD integration:

- **Exit Code 0**: Health score ≥ 80% (deployment ready)
- **Exit Code 1**: Health score < 80% (deployment blocked)

### GitHub Actions Example

```yaml
name: Test and Report
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run report:full
      - uses: actions/upload-artifact@v3
        with:
          name: test-reports
          path: test-reports/
```

## Report Locations

Reports are saved to the `test-reports/` directory:

- `test-report-YYYY-MM-DDTHH-MM-SS.md` - Timestamped markdown report
- `test-report-YYYY-MM-DDTHH-MM-SS.json` - Timestamped JSON data
- `test-report-YYYY-MM-DDTHH-MM-SS.html` - Timestamped HTML report
- `latest-report.*` - Symlinks to the most recent reports

## Phase 1 Production Readiness

The generator specifically tracks Phase 1 completion based on the Production Readiness Action Plan:

### Phase 1 Requirements (Target: 95%+ completion)
- ✅ Performance middleware enabled with real metrics
- ✅ Security hardening service enabled
- ✅ Authentication using proper API keys (no dev fallbacks)
- ✅ CORS properly configured for production
- ✅ GraphQL server functional
- ✅ Agent execution endpoints working
- ✅ Port integration service operational

### Phase 1 Scoring
- Each critical test has weighted importance
- Minimum 95% pass rate required for Phase 2 readiness
- Security tests are weighted heavily (35% of total score)
- Infrastructure tests are critical (40% of total score)

## Troubleshooting

### Server Not Running
```bash
# Start server manually before running tests
npm run dev

# Or use the comprehensive runner that manages server lifecycle
node scripts/run-comprehensive-tests.js
```

### Test Scripts Not Found
```bash
# Verify test scripts exist
ls -la tests/
ls -la test-*.js

# Update configuration file to match actual test locations
vim scripts/test-report-config.json
```

### Permission Issues
```bash
# Make scripts executable
chmod +x scripts/generate-test-report.js
chmod +x scripts/run-comprehensive-tests.js
```

### Missing Dependencies
```bash
# Install all dependencies
npm install

# Check for missing dev dependencies
npm run lint
```

## Advanced Features

### Custom Test Parsers
The generator includes parsers for common test output formats:
- Jest test results
- Custom test scripts (like Phase 1 and Security validation)
- Performance benchmarks
- Security scan results

### Extensible Architecture
- Modular test suite configuration
- Pluggable report formats
- Configurable health checks
- Weighted scoring system

### Integration Ready
- JSON export for external systems
- Exit codes for CI/CD pipelines
- Timestamped reports for historical tracking
- Symlinks for easy latest report access

## Examples

### Development Workflow
```bash
# Daily development testing
npm run report:test

# Pre-commit comprehensive check
npm run report:full

# Quick health check
curl http://localhost:9999/api/health
npm run report:quick
```

### Production Deployment
```bash
# Pre-deployment validation
npm run report:full
# Check exit code and review critical recommendations

# Post-deployment verification
npm run report:generate
# Verify all health checks pass
```

### Continuous Monitoring
```bash
# Scheduled health monitoring
*/15 * * * * cd /path/to/project && npm run report:quick > /var/log/health.log

# Weekly comprehensive reports
0 0 * * 0 cd /path/to/project && npm run report:full
```

This test report generator provides a comprehensive view of your system's health and readiness for production deployment, with special focus on the Phase 1 requirements critical for the Universal AI Tools platform.