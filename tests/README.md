# Universal AI Tools - Comprehensive Test Suite

This directory contains a comprehensive test suite designed to achieve 80%+ code coverage and ensure production readiness for the Universal AI Tools platform.

## 📋 Test Suite Overview

### Test Categories

1. **API Endpoint Tests** (`tests/api/`)
   - Tests all REST API endpoints
   - Validates request/response handling
   - Checks authentication and authorization
   - Verifies error handling and edge cases

2. **Authentication Middleware Tests** (`tests/middleware/auth.test.ts`)
   - JWT token validation
   - Session management
   - Role-based access control
   - Security token handling

3. **Security Middleware Tests** (`tests/middleware/security.test.ts`)
   - CORS protection
   - CSRF prevention
   - SQL injection protection
   - Rate limiting
   - Input validation

4. **Agent Functionality Tests** (`tests/agents/`)
   - Base agent operations
   - Cognitive agent behaviors
   - Agent orchestration
   - Inter-agent communication

5. **Database Operations Tests** (`tests/database/`)
   - CRUD operations
   - Complex queries
   - Transaction handling
   - Data integrity validation

6. **Error Handling Tests** (`tests/error-handling/`)
   - Exception handling
   - Graceful degradation
   - Circuit breaker patterns
   - Recovery mechanisms

7. **Performance Tests** (`tests/performance/`)
   - Response time testing
   - Load testing
   - Memory usage validation
   - Scalability testing

## 🚀 Running Tests

### Quick Commands

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test categories
npm run test:unit
npm run test:integration
npm run test:api
npm run test:middleware
npm run test:security
npm run test:agents
npm run test:database
npm run test:error-handling
npm run test:performance

# Run comprehensive test suite
npm run test:comprehensive

# Generate coverage report
npm run test:coverage:report

# CI/CD compatible test run
npm run test:ci
```

### Advanced Test Execution

```bash
# Run tests in watch mode
npm run test:watch

# Run specific test files
npx jest tests/api/routers.test.ts

# Run tests with debugging
npm run test -- --verbose

# Run only failed tests
npx jest --onlyFailures

# Update snapshots
npx jest --updateSnapshot
```

## 📊 Coverage Requirements

### Global Coverage Targets
- **Lines**: 80%+ (Required for deployment)
- **Functions**: 80%+ (Required for deployment)
- **Branches**: 80%+ (Required for deployment)
- **Statements**: 80%+ (Required for deployment)

### Enhanced Coverage for Critical Components
- **Security Middleware**: 95%+
- **Authentication**: 95%+
- **API Routes**: 85%+
- **Error Handlers**: 90%+

### Coverage Reports

Coverage reports are generated in multiple formats:
- **HTML**: `coverage/lcov-report/index.html`
- **LCOV**: `coverage/lcov.info`
- **JSON**: `coverage/coverage-final.json`
- **Text Summary**: Console output

## 🔧 Test Configuration

### Jest Configuration
Main configuration in `jest.config.js`:
- ESM module support
- TypeScript compilation
- Mock configurations
- Coverage thresholds
- Test environment setup

### Coverage Configuration
Detailed coverage settings in `test-coverage.config.js`:
- File inclusion/exclusion patterns
- Category-specific thresholds
- Quality gates
- Reporting options

## 🏗️ Test Infrastructure

### Setup Files
- `tests/setup.ts` - Global test setup
- `tests/globalSetup.ts` - One-time setup
- `tests/globalTeardown.ts` - Cleanup

### Mocks and Utilities
- Supabase client mocking
- Redis client mocking
- HTTP request mocking
- Test data factories

### Test Helpers
- Authentication helpers
- Database test utilities
- Mock data generators
- Assertion helpers

## 📈 Quality Gates

### Production Readiness Levels

1. **Ready** (95%+ score)
   - All required tests passing
   - 95%+ coverage achieved
   - No security test failures
   - Performance benchmarks met

2. **Near Ready** (85-94% score)
   - All required tests passing
   - 85%+ coverage achieved
   - Minor performance issues acceptable

3. **Needs Work** (70-84% score)
   - Some non-critical test failures
   - Coverage between 70-84%
   - Performance optimization needed

4. **Not Ready** (<70% score)
   - Critical test failures
   - Insufficient coverage
   - Security vulnerabilities present

## 🚨 CI/CD Integration

### GitHub Actions Workflow
Automated testing configured in `.github/workflows/test-coverage.yml`:
- Multi-node version testing (18, 20, 22)
- Parallel test execution
- Coverage reporting
- Security scanning
- Build verification

### Test Execution Strategy
1. **Pre-commit**: Run unit tests and linting
2. **Pull Request**: Full test suite execution
3. **Main Branch**: Comprehensive testing + deployment readiness
4. **Release**: Production validation suite

## 📝 Writing New Tests

### Test File Structure
```typescript
/**
 * Test Description
 * Brief explanation of what this test file covers
 */

import { jest } from '@jest/globals';
// Import your modules

describe('Feature Name', () => {
  beforeEach(() => {
    // Setup for each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  describe('Specific Functionality', () => {
    test('should do something specific', async () => {
      // Arrange
      const input = setupTestData();
      
      // Act
      const result = await functionUnderTest(input);
      
      // Assert
      expect(result).toEqual(expectedOutput);
    });
  });
});
```

### Best Practices

1. **Descriptive Test Names**: Use clear, descriptive test names
2. **AAA Pattern**: Arrange, Act, Assert
3. **Mock External Dependencies**: Mock databases, APIs, file systems
4. **Test Edge Cases**: Include error conditions and boundary values
5. **Async Testing**: Properly handle promises and async operations
6. **Clean Up**: Ensure tests don't leave side effects

### Test Categories Guidelines

- **Unit Tests**: Test individual functions/classes in isolation
- **Integration Tests**: Test component interactions
- **API Tests**: Test HTTP endpoints end-to-end
- **Security Tests**: Focus on authentication, authorization, validation
- **Performance Tests**: Measure response times, memory usage, scalability

## 🔍 Debugging Tests

### Common Issues

1. **Test Timeouts**: Increase timeout for slow operations
2. **Mock Issues**: Verify mocks are properly configured
3. **Async Problems**: Use proper async/await patterns
4. **Memory Leaks**: Check for unclosed resources

### Debugging Commands
```bash
# Run with debugging output
npm run test -- --verbose --no-cache

# Run single test with full output
npx jest path/to/test.ts --verbose

# Run with Node.js debugging
node --inspect-brk node_modules/.bin/jest --runInBand
```

## 📚 Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

## 🤝 Contributing

When adding new features:
1. Write tests first (TDD approach)
2. Ensure coverage thresholds are met
3. Update test documentation
4. Run full test suite before submitting PR

## 📞 Support

For questions about the test suite:
- Check existing test examples
- Review Jest configuration
- Consult team documentation
- Create GitHub issue for bugs