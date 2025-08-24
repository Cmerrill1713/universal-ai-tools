# Phase 1 Test Data Generator

This comprehensive test data generator creates realistic test data for Phase 1 development and testing of the Universal AI Tools platform.

## Features

### Test Data Generation
- **Cognitive Agents**: Devils advocate, enhanced planner, reflector, resource manager, retriever, synthesizer
- **Personal Agents**: Calendar, tool maker, photo organizer, file manager, memory assistant
- **Memory Records**: Semantic, procedural, and episodic memories with vector embeddings
- **User Accounts**: Test users with permissions, preferences, and rate limits
- **API Keys**: Hashed API keys for authentication testing
- **Conversations**: Multi-turn conversations with realistic message patterns
- **Context Data**: Conversation, document, and system context items
- **Custom Tools**: JavaScript, Python, Bash, SQL, and API tools

### Database Integration
- **Supabase Integration**: Stores data directly in test database tables
- **Batch Processing**: Efficient batch insertion for large datasets
- **Data Validation**: Ensures data integrity and consistency
- **Cleanup Functions**: Complete cleanup of test data

### Test Environment
- **ES Module Compatible**: Modern JavaScript module system
- **Environment Configuration**: Separate test environment configuration
- **Mock Data**: Realistic but safe test data for all scenarios
- **Performance Optimized**: Efficient generation and storage

## Quick Start

### 1. Setup Environment

Copy the test environment configuration:
```bash
cp .env.example .env.test
```

Edit `.env.test` with your test database configuration:
```bash
# Required: Test Supabase configuration
SUPABASE_URL=your_test_supabase_url
SUPABASE_SERVICE_KEY=your_test_supabase_service_key
SUPABASE_ANON_KEY=your_test_supabase_anon_key
```

### 2. Generate Test Data

Generate all test data:
```bash
npm run test:phase1:generate
```

Or use the script directly:
```bash
node scripts/generate-phase1-test-data.js generate
```

### 3. Run Phase 1 Tests

Run the complete Phase 1 test suite:
```bash
npm run test:phase1
```

For faster testing (skips slow tests):
```bash
npm run test:phase1:fast
```

### 4. Generate Test Report

Run tests with detailed reporting:
```bash
npm run test:phase1:report
```

## Usage Examples

### Basic Commands

```bash
# Generate test data only
node scripts/generate-phase1-test-data.js generate

# Clean up test data
node scripts/generate-phase1-test-data.js cleanup

# Reset (cleanup + regenerate)
node scripts/generate-phase1-test-data.js reset

# Validate existing test data
node scripts/generate-phase1-test-data.js validate
```

### Test Runner Commands

```bash
# Full test run with data generation
node scripts/run-phase1-tests.js

# Generate data only
node scripts/run-phase1-tests.js --generate-only

# Run tests only (assumes data exists)
node scripts/run-phase1-tests.js --tests-only

# Run with cleanup and reporting
node scripts/run-phase1-tests.js --cleanup --report

# Fast mode (skip slow tests)
node scripts/run-phase1-tests.js --fast

# Verbose output
node scripts/run-phase1-tests.js --verbose
```

## Generated Data Structure

### Agents (20 total)
- **10 Cognitive Agents**: 2 of each type (devils_advocate, enhanced_planner, reflector, resource_manager, retriever, synthesizer)
- **10 Personal Agents**: 2 of each type (calendar, tool_maker, photo_organizer, file_manager, memory_assistant)
- Each agent includes: capabilities, configuration, metrics, status

### Memories (100 total)
- **Types**: semantic, procedural, episodic
- **Categories**: user_preference, system_knowledge, conversation_history, tool_usage, error_pattern
- **Features**: Vector embeddings (1536 dimensions), importance scores, access tracking, keywords, related entities

### Users (10 total)
- **Profiles**: Realistic user profiles with preferences
- **Permissions**: Varied permission sets for testing RBAC
- **Rate Limits**: Different rate limiting configurations
- **API Keys**: Associated API keys for authentication testing

### Conversations (25 total)
- **Multi-turn**: 5-25 messages per conversation
- **Realistic Content**: Programming, planning, analysis topics
- **Metadata**: Agent usage, topic classification, timing

### Tools (15 total)
- **Multiple Languages**: JavaScript, Python, Bash, SQL, API
- **Complete Schemas**: Input/output validation schemas
- **Implementation**: Working code examples
- **Metadata**: Version, author, category information

## Configuration

### Test Data Configuration

Edit the configuration in `generate-phase1-test-data.js`:

```javascript
const config = {
  testData: {
    agentCount: 20,        // Total agents to generate
    memoryCount: 100,      // Total memories to generate
    userCount: 10,         // Total users to generate
    conversationCount: 25, // Total conversations
    contextCount: 50,      // Total context items
    toolCount: 15          // Total tools
  }
};
```

### Environment Variables

Key environment variables for testing:

```bash
# Database
SUPABASE_URL=your_test_supabase_url
SUPABASE_SERVICE_KEY=your_test_service_key

# Security (test values)
JWT_SECRET=test_jwt_secret_for_phase1_testing_only
ENCRYPTION_KEY=test_encryption_key_for_phase1_testing_only

# Performance
TEST_BATCH_SIZE=10
TEST_CLEANUP_ON_EXIT=true
```

## Test Coverage

### Authentication Tests
- API key validation
- JWT token handling
- Permission checking
- Rate limiting

### Agent System Tests
- Agent listing and filtering
- Agent detail retrieval
- Agent execution requests
- Status management

### Memory System Tests
- Memory storage and retrieval
- Vector similarity search
- Content querying
- Metadata handling

### Tool System Tests
- Tool listing and execution
- Schema validation
- Permission checking
- Error handling

### Security Tests
- Input sanitization
- CORS validation
- Rate limiting
- Authentication bypass attempts

### Database Tests
- Connection handling
- Data consistency
- Error recovery
- Performance

## File Structure

```
scripts/
├── generate-phase1-test-data.js    # Main test data generator
├── run-phase1-tests.js             # Complete test runner
└── README-phase1-testing.md        # This documentation

src/tests/integration/
└── phase1-test-suite.test.ts       # Integration test suite

.env.test                           # Test environment configuration
test-reports/                       # Generated test reports
test-data/                         # Saved test data files
```

## Troubleshooting

### Common Issues

**Database Connection Failed**
```bash
# Check Supabase configuration
node -e "console.log(process.env.SUPABASE_URL)"

# Test connection manually
npx supabase status
```

**Missing Dependencies**
```bash
# Install all dependencies
npm install

# Check for missing test dependencies
npm ls jest supertest @supabase/supabase-js
```

**Test Data Generation Fails**
```bash
# Check database permissions
node scripts/generate-phase1-test-data.js validate

# Clear existing test data
node scripts/generate-phase1-test-data.js cleanup
```

**Tests Fail**
```bash
# Run with verbose output
node scripts/run-phase1-tests.js --verbose

# Run tests only (skip data generation)
node scripts/run-phase1-tests.js --tests-only

# Check individual test categories
npm run test:integration
```

### Debug Mode

Enable debug output:
```bash
# Set debug environment
export LOG_LEVEL=debug

# Run with verbose output
node scripts/run-phase1-tests.js --verbose
```

### Cleanup

Complete cleanup of test environment:
```bash
# Clean test data
npm run test:phase1:cleanup

# Clean generated files
rm -rf test-reports/ test-data/

# Reset test database (if using local)
npx supabase db reset
```

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Phase 1 Tests
on: [push, pull_request]

jobs:
  phase1-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Setup test environment
        run: |
          cp .env.example .env.test
          # Configure test database
      
      - name: Run Phase 1 tests
        run: npm run test:phase1:report
        
      - name: Upload test reports
        uses: actions/upload-artifact@v3
        with:
          name: phase1-test-reports
          path: test-reports/
```

## Contributing

When adding new test scenarios:

1. **Add Data Generators**: Extend the generator methods for new data types
2. **Update Test Suite**: Add corresponding tests in `phase1-test-suite.test.ts`
3. **Document Changes**: Update this README with new features
4. **Test Integration**: Ensure new tests work with the test runner

### Example: Adding New Agent Type

```javascript
// In generate-phase1-test-data.js
generateNewAgentType() {
  return {
    id: this.generateTestId('NEWAGENT_'),
    name: 'new_agent_type',
    type: 'cognitive',
    category: 'new_type',
    // ... other properties
  };
}

// In phase1-test-suite.test.ts
it('should handle new agent type', async () => {
  const response = await request(testConfig.baseUrl)
    .get('/api/agents?type=new_type')
    .expect(200);
  // ... test assertions
});
```

## Support

For issues with the test data generator:

1. Check the troubleshooting section above
2. Verify environment configuration
3. Run with `--verbose` for detailed output
4. Check test reports for detailed error information

The test data generator is designed to be robust and provide clear error messages to help diagnose issues quickly.