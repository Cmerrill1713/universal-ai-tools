# Autonomous Code Generation System Tests

This directory contains comprehensive tests for the Universal AI Tools Autonomous Code Generation and Refactoring System.

## Test Structure

### Unit Tests (`unit/`)
- `autonomous-code-service.test.ts` - Core autonomous code generation service
- `code-analysis-service.test.ts` - AST analysis and code pattern detection
- `security-scanning-service.test.ts` - Vulnerability detection and fixes
- `code-quality-service.test.ts` - Quality assessment and scoring
- `repository-indexing-service.test.ts` - Pattern extraction and learning
- `enhanced-code-assistant-agent.test.ts` - Enhanced agent capabilities

### Integration Tests (`integration/`)
- `multi-service-integration.test.ts` - Service interaction validation
- `ab-mcts-orchestration.test.ts` - AB-MCTS coordination testing
- `dspy-cognitive-chains.test.ts` - DSPy orchestration validation
- `context-injection-flow.test.ts` - Context enhancement pipeline

### End-to-End Tests (`e2e/`)
- `complete-code-generation-workflow.test.ts` - Full generation pipeline
- `code-generation-api.test.ts` - API endpoint validation
- `multi-agent-coordination.test.ts` - Complete orchestration flow
- `repository-pattern-learning.test.ts` - Repository analysis workflow

### Performance Tests (`performance/`)
- `generation-performance.test.ts` - Code generation benchmarks
- `ast-parsing-performance.test.ts` - Tree-sitter performance validation
- `concurrent-generation.test.ts` - Multi-user concurrent testing
- `memory-usage.test.ts` - Resource consumption validation

### Security Tests (`security/`)
- `vulnerability-detection.test.ts` - Security scanning validation
- `code-injection-prevention.test.ts` - Input sanitization testing
- `sensitive-data-detection.test.ts` - Secrets detection validation
- `compliance-validation.test.ts` - Standards compliance testing

### Error Handling Tests (`error-handling/`)
- `service-failures.test.ts` - Graceful degradation testing
- `malformed-input.test.ts` - Input validation and error recovery
- `timeout-handling.test.ts` - Performance threshold validation
- `recovery-mechanisms.test.ts` - Auto-recovery testing

## Test Configuration

### Environment Variables
```bash
# Test Database
TEST_DATABASE_URL=postgresql://test_user:test_pass@localhost:5432/test_db

# Test Redis
TEST_REDIS_URL=redis://localhost:6379/1

# Mock Services
MOCK_OLLAMA_URL=http://localhost:11435
MOCK_LFM2_URL=http://localhost:12345

# Test API Keys (stored in vault for security)
USE_MOCK_API_KEYS=true
```

### Test Data
- Mock code samples for each supported language
- Repository pattern examples
- Security vulnerability samples
- Quality assessment benchmarks

## Running Tests

```bash
# Run all autonomous code generation tests
npm test -- tests/autonomous-code-generation

# Run specific test suites
npm test -- tests/autonomous-code-generation/unit
npm test -- tests/autonomous-code-generation/integration
npm test -- tests/autonomous-code-generation/e2e

# Run with coverage
npm test -- --coverage tests/autonomous-code-generation

# Run performance benchmarks
npm test -- tests/autonomous-code-generation/performance

# Run security validation
npm test -- tests/autonomous-code-generation/security
```

## Test Metrics & Coverage Goals

- **Code Coverage**: >90% for all autonomous code generation services
- **Performance**: Code generation <5s, AST parsing <100ms
- **Security**: 100% vulnerability detection for known patterns
- **Quality**: Consistent quality scoring across test cases
- **Reliability**: <1% failure rate under normal conditions

## Mock Data & Fixtures

Test fixtures are located in `fixtures/` and include:
- Sample code in TypeScript, JavaScript, Python, Swift, Go, Rust, Java
- Repository structures for pattern extraction testing
- Security vulnerability examples for detection validation
- Quality assessment benchmarks for scoring validation