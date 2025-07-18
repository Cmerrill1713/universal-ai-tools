# DSPy Integration Test Suite

This directory contains comprehensive tests for the DSPy integration in the Universal AI Tools system.

## Test Structure

### Unit Tests (`/unit`)
- **dspy-service.test.ts**: Tests for the core DSPy service functionality
  - Service initialization and connection management
  - Orchestration request handling
  - Agent coordination
  - Knowledge management operations
  - Error handling and edge cases

### Integration Tests (`/integration`)
- **orchestration.test.ts**: Tests for the integrated orchestration system
  - Real DSPy bridge communication
  - Multi-agent coordination workflows
  - Knowledge management integration
  - Complex workflow scenarios
  - Concurrent request handling

### Performance Tests (`/performance`)
- **benchmark.test.ts**: Performance comparison between old and new systems
  - Response time measurements
  - Memory usage analysis
  - Throughput testing
  - Scalability assessments
  - Performance regression detection

### End-to-End Tests (`/e2e`)
- **full-workflow.test.ts**: Complete workflow testing
  - Code development workflows
  - Research and analysis workflows
  - Multi-agent collaboration
  - Error recovery scenarios
  - System stress testing

## Running Tests

### Run all tests
```bash
npm test -- tests/dspy
```

### Run specific test suites
```bash
# Unit tests only
npm test -- tests/dspy/unit

# Integration tests only
npm test -- tests/dspy/integration

# Performance benchmarks
npm test -- tests/dspy/performance

# End-to-end tests
npm test -- tests/dspy/e2e
```

### Run with coverage
```bash
npm test -- tests/dspy --coverage
```

### Run in watch mode
```bash
npm test -- tests/dspy --watch
```

## Test Configuration

The test suite uses Jest with TypeScript support. Configuration is defined in `jest.config.ts`.

### Key Configuration Options:
- **Test Timeout**: 60 seconds (default), up to 5 minutes for performance tests
- **Coverage**: Enabled by default, reports generated in `/coverage`
- **Parallel Execution**: Uses 50% of available CPU cores
- **Environment**: Node.js test environment

## Mock Services

For unit tests, the following services are mocked:
- DSPy Bridge WebSocket connection
- Supabase database operations
- External API calls

Integration and E2E tests use real services when available.

## Performance Benchmarks

Performance tests generate detailed reports including:
- Average response times
- Memory usage statistics
- Success rates
- Performance improvement metrics

Reports are saved to: `tests/dspy/performance/benchmark-report-YYYY-MM-DD.json`

## Environment Variables

Create a `.env.test` file with:
```env
NODE_ENV=test
LOG_LEVEL=error
DSPY_TEST_MODE=true
```

## Test Coverage Goals

- Unit Tests: >90% coverage
- Integration Tests: >80% coverage
- E2E Tests: All critical paths covered

## Writing New Tests

1. Follow the existing test structure
2. Use descriptive test names
3. Include both positive and negative test cases
4. Test error conditions and edge cases
5. Add performance assertions where relevant

## Debugging Tests

### Enable verbose logging
```bash
LOG_LEVEL=debug npm test -- tests/dspy
```

### Run specific test
```bash
npm test -- tests/dspy -t "should orchestrate a simple request"
```

### Debug in VS Code
Use the provided launch configuration:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug DSPy Tests",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["tests/dspy", "--runInBand"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

## Continuous Integration

Tests are automatically run on:
- Pull requests
- Commits to main branch
- Nightly builds

Failed tests block merges to ensure system stability.

## Troubleshooting

### Common Issues:

1. **Connection timeouts**: Ensure DSPy Python service is running
2. **Mock failures**: Clear Jest cache with `npm test -- --clearCache`
3. **Performance test variations**: Run multiple times and average results
4. **Memory leaks**: Check for proper cleanup in afterEach/afterAll hooks

### Support

For test-related issues, please:
1. Check existing test documentation
2. Review similar test implementations
3. Consult the main project README
4. Open an issue with test logs and environment details