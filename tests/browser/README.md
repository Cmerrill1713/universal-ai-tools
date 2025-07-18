# Full System Integration Test

This comprehensive integration test demonstrates the complete Universal AI Tools system working together to solve a real-world TypeScript error scenario.

## Test Overview

The `full-system-integration.test.ts` file contains a complete end-to-end test that exercises:

1. **SearXNG Integration** - Online research using SearXNG search engine
2. **Knowledge Management** - Storage and retrieval of solutions and patterns
3. **Intelligent Extraction** - AI-powered content extraction from search results
4. **Multi-Agent Coordination** - Simulated coordination between multiple AI agents
5. **Browser Automation** - Real browser tasks using Puppeteer
6. **Learning and Evolution** - System learning from successful resolutions
7. **Error Handling** - Comprehensive error recovery and fallback mechanisms

## Test Scenario

The test uses a realistic TypeScript import error scenario:

```
Module import error: Cannot find module "@/components/ui/button" or its corresponding type declarations
```

The system demonstrates:
- **Research**: Finding solutions through online search
- **Extraction**: Intelligently extracting code examples and solutions
- **Knowledge**: Storing patterns and solutions for future use
- **Coordination**: Multi-agent task coordination
- **Execution**: Browser-based validation and testing
- **Learning**: System improvement through experience

## Running the Tests

### Prerequisites

Ensure you have the following dependencies installed:

```bash
npm install
```

Required packages:
- jest
- ts-jest
- @jest/globals
- puppeteer
- @supabase/supabase-js
- cheerio

### Running the Integration Test

#### Option 1: Using the Test Script
```bash
node scripts/run-integration-tests.js
```

#### Option 2: Using Jest Directly
```bash
npx jest tests/browser/full-system-integration.test.ts --verbose --maxWorkers=1
```

#### Option 3: Using npm script (if configured)
```bash
npm run test:integration
```

### Environment Configuration

The test can be configured using environment variables:

```bash
# Supabase configuration (optional - will use mock if not set)
export SUPABASE_URL=http://localhost:54321
export SUPABASE_SERVICE_KEY=your-service-key

# SearXNG configuration (optional - will use mock if not set)
export SEARXNG_URL=http://localhost:8080

# Test configuration
export NODE_ENV=test
export LOG_LEVEL=info
export CI=true  # For headless browser mode
```

## Test Structure

### Phase 1: Coordination Setup
- Creates a coordination plan for the TypeScript error
- Assigns virtual agents to different aspects of the problem
- Sets up communication channels and shared state

### Phase 2: Online Research
- Uses SearXNG to search for TypeScript import error solutions
- Searches multiple sources: Stack Overflow, GitHub, documentation
- Ranks and filters results based on relevance and confidence

### Phase 3: Intelligent Extraction
- Extracts structured information from search results
- Identifies code examples, solutions, and patterns
- Applies machine learning techniques for content analysis

### Phase 4: Knowledge Management
- Stores extracted solutions in the knowledge base
- Creates relationships between different pieces of knowledge
- Implements tagging and categorization systems

### Phase 5: Knowledge Retrieval
- Validates that stored knowledge can be retrieved
- Tests search and recommendation systems
- Verifies knowledge validation mechanisms

### Phase 6: Task Execution
- Simulates browser-based task execution
- Validates TypeScript configuration files
- Tests import resolution and file structure

### Phase 7: Learning and Evolution
- Updates knowledge based on successful execution
- Evolves patterns and solutions for future use
- Tracks system improvement over time

### Phase 8: System Health
- Checks all system components for proper operation
- Collects performance metrics and statistics
- Generates comprehensive test reports

## Test Metrics

The test collects comprehensive metrics including:

- **Performance**: Execution time, memory usage, CPU usage
- **Quality**: Success rates, error rates, confidence scores
- **Learning**: Knowledge items created, pattern evolution
- **Coordination**: Agent efficiency, task completion rates
- **Extraction**: Accuracy rates, content processing metrics

## Expected Outcomes

A successful test run should show:

- ✅ All 8 test phases completed successfully
- ✅ High confidence scores (>70%) for extracted solutions
- ✅ Successful knowledge storage and retrieval
- ✅ Proper system coordination and task execution
- ✅ Evidence of system learning and improvement
- ✅ Comprehensive error handling and recovery

## Test Reports

Test results are generated in multiple formats:

- **Console Output**: Real-time test progress and results
- **Coverage Reports**: Code coverage analysis
- **Performance Metrics**: Detailed system performance data
- **Error Logs**: Comprehensive error tracking and analysis

## Troubleshooting

### Common Issues

1. **Browser Launch Failures**
   - Ensure Chrome/Chromium is installed
   - Check that no other tests are running
   - Verify system resources are available

2. **Network Timeouts**
   - SearXNG service may not be available
   - Test will use mock data as fallback
   - Check network connectivity

3. **Database Connection Issues**
   - Supabase may not be configured
   - Test will use mock storage as fallback
   - Verify environment variables

4. **Memory Issues**
   - Increase Node.js memory limit: `--max-old-space-size=4096`
   - Run tests with fewer workers: `--maxWorkers=1`
   - Close other applications to free memory

### Debug Mode

For detailed debugging, run with:

```bash
DEBUG=* npx jest tests/browser/full-system-integration.test.ts --verbose
```

This will provide detailed logging of all system operations.

## Contributing

When adding new integration tests:

1. Follow the existing test structure and patterns
2. Include comprehensive error handling
3. Add appropriate test metrics and reporting
4. Document any new dependencies or configuration
5. Ensure tests can run in CI environments

## Architecture

The integration test demonstrates the complete system architecture:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   SearXNG       │    │   Knowledge     │    │   Intelligent   │
│   Client        │────│   Manager       │────│   Extractor     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         └──────────────│   Coordination  │──────────────┘
                        │   System        │
                        └─────────────────┘
                                 │
                        ┌─────────────────┐
                        │   Browser       │
                        │   Automation    │
                        └─────────────────┘
```

This test validates that all components work together seamlessly to provide intelligent, automated problem-solving capabilities.