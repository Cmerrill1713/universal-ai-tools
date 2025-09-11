# AB-MCTS TypeScript-Rust Bridge Integration

This directory contains the TypeScript integration layer for the high-performance AB-MCTS (Adaptive Bandit Monte Carlo Tree Search) Rust service.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    TypeScript Layer                         │
├─────────────────────────────────────────────────────────────┤
│  MCTSBridge.ts    │  Types.ts       │  Integration Layer   │
│  - Type-safe API  │  - Type defs    │  - Error handling    │
│  - Promise-based  │  - Interfaces   │  - JSON serialization │
│  - Error handling │  - Enums        │  - Async/await       │
├─────────────────────────────────────────────────────────────┤
│                      FFI Bridge                             │
│  - Node.js FFI / WASM / HTTP API / Subprocess             │
├─────────────────────────────────────────────────────────────┤
│                      Rust Layer                             │
│  MCTSBridge.rs    │  MCTSEngine.rs  │  Core Algorithms     │
│  - JSON interface │  - MCTS logic   │  - Thompson Sampling │
│  - Serialization  │  - Performance  │  - Bayesian Learning │
│  - Error mapping  │  - Caching      │  - UCB1 Selection    │
└─────────────────────────────────────────────────────────────┘
```

## Files Overview

### `types.ts`
Complete TypeScript type definitions for all AB-MCTS interfaces:
- **Configuration types**: `MCTSConfig`, `CacheConfig`, `SearchOptions`
- **Agent types**: `AgentContext`, `MCTSAction`, `AgentType`
- **Result types**: `SearchResult`, `AgentRecommendation`, `ExecutionPlan`
- **Performance types**: `SearchStatistics`, `PerformanceStats`
- **Utility types**: `BridgeError`, `HealthCheckResult`

### `bridge.ts`
High-level TypeScript wrapper providing:
- **Type-safe API**: Full TypeScript support with proper error handling
- **Async operations**: Promise-based interface for all operations
- **Error management**: Structured error handling with detailed context
- **Performance monitoring**: Built-in statistics and health checking
- **Test utilities**: Helper functions for development and testing

## Usage Examples

### Basic Setup

```typescript
import { MCTSBridge, TestHelpers } from './bridge';

// Create and initialize bridge
const config = TestHelpers.createTestConfig({
  maxIterations: 500,
  enableThompsonSampling: true,
  enableBayesianLearning: true
});

const bridge = new MCTSBridge(config);
await bridge.initialize();

// Verify it's ready
if (!bridge.isReady()) {
  throw new Error('Bridge not ready');
}
```

### Agent Search Operations

```typescript
// Create agent context
const context = TestHelpers.createTestContext(
  "Analyze customer feedback and generate insights",
  "session_12345"
);

// Available agents in your system
const availableAgents = [
  'enhanced-planner-agent',
  'enhanced-retriever-agent', 
  'enhanced-synthesizer-agent',
  'enhanced-code-assistant-agent'
];

// Perform full MCTS search
const searchOptions = TestHelpers.createSearchOptions({
  maxIterations: 200,
  timeLimitMs: 5000
});

const result = await bridge.searchOptimalAgents(
  context, 
  availableAgents, 
  searchOptions
);

console.log(`Found optimal sequence of ${result.bestPath.length} agents`);
console.log(`Confidence: ${result.confidence.toFixed(3)}`);
console.log(`Search completed in ${result.searchStatistics.searchTimeMs}ms`);

// Extract execution plan
const plan = result.executionPlan;
console.log(`Estimated total time: ${plan.totalEstimatedTimeMs}ms`);
console.log(`Estimated total cost: $${plan.totalEstimatedCost.toFixed(2)}`);
```

### Quick Recommendations

```typescript
// For faster responses, use quick recommendations
const recommendations = await bridge.recommendAgents(
  context,
  availableAgents,
  3 // max recommendations
);

recommendations.recommendations.forEach((rec, i) => {
  console.log(`${i + 1}. ${rec.agentName} (confidence: ${rec.confidence.toFixed(3)})`);
  console.log(`   Rationale: ${rec.rationale}`);
});
```

### Learning from Execution Results

```typescript
// After executing an agent, provide feedback for learning
const reward = TestHelpers.createTestReward(0.85, {
  components: {
    quality: 0.9,   // High quality output
    speed: 0.7,     // Moderate speed
    cost: 0.8       // Reasonable cost
  },
  metadata: {
    tokensUsed: 1250,
    apiCallsMade: 3,
    executionTimeMs: 2800
  }
});

await bridge.updateWithFeedback(
  context.executionContext.sessionId,
  'enhanced-planner-agent',
  reward
);

console.log('Feedback recorded for learning');
```

### Performance Monitoring

```typescript
// Get performance statistics
const stats = await bridge.getPerformanceStats();

console.log(`Total searches: ${stats.totalIterations}`);
console.log(`Nodes explored: ${stats.nodesExplored}`);
console.log(`Average depth: ${stats.averageDepth.toFixed(2)}`);
console.log(`Cache hit rate: ${(stats.cacheHitRate * 100).toFixed(1)}%`);

// Health check
const health = await bridge.healthCheck();

if (health.bridgeStatus === 'healthy') {
  console.log('✅ Bridge is healthy');
  console.log(`Engine status: ${health.engine.status}`);
  console.log(`Features: Thompson Sampling=${health.features.thompsonSampling}`);
} else {
  console.error('❌ Bridge health issues detected');
}
```

## Integration Approaches

The bridge can be integrated with the Rust service using several approaches:

### 1. Node.js FFI (Recommended for Performance)
```typescript
// Using node-ffi-napi or similar
import ffi from 'ffi-napi';

const rustLib = ffi.Library('./target/release/ab_mcts_service', {
  'bridge_search': ['string', ['string', 'string', 'string']],
  'bridge_initialize': ['string', ['string']],
  // ... other functions
});
```

### 2. WebAssembly (WASM)
```typescript
// Compile Rust to WASM and load in Node.js
import { MCTSWasm } from './ab_mcts_service.wasm';

const wasmModule = await MCTSWasm.initialize();
```

### 3. HTTP API Service
```typescript
// Run Rust as a separate HTTP service
const response = await fetch('http://localhost:8080/api/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ context, availableAgents, options })
});
```

### 4. Subprocess Communication
```typescript
// Spawn Rust process and communicate via stdin/stdout
import { spawn } from 'child_process';

const rustProcess = spawn('./target/release/ab_mcts_service', ['--mode', 'bridge']);
// Communicate via JSON messages
```

## Error Handling

The bridge provides structured error handling:

```typescript
import { BridgeError } from './bridge';

try {
  const result = await bridge.searchOptimalAgents(context, agents);
} catch (error) {
  if (error instanceof BridgeError) {
    console.error(`Bridge Error [${error.code}]: ${error.message}`);
    console.error('Details:', error.details);
    
    switch (error.code) {
      case 'NOT_INITIALIZED':
        await bridge.initialize();
        break;
      case 'SEARCH_FAILED':
        // Handle search failure
        break;
      case 'CONFIG_UPDATE_FAILED':
        // Handle config issues
        break;
    }
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Testing and Development

The integration includes comprehensive test utilities:

```typescript
import { TestHelpers } from './bridge';

// Create test data
const testConfig = TestHelpers.createTestConfig();
const testContext = TestHelpers.createTestContext("Test task");
const testReward = TestHelpers.createTestReward(0.8);
const searchOptions = TestHelpers.createSearchOptions();

// Use in unit tests
describe('MCTS Integration', () => {
  let bridge: MCTSBridge;
  
  beforeEach(async () => {
    bridge = new MCTSBridge(testConfig);
    await bridge.initialize();
  });
  
  it('should perform search', async () => {
    const result = await bridge.searchOptimalAgents(
      testContext, 
      ['agent1', 'agent2']
    );
    expect(result.confidence).toBeGreaterThan(0);
  });
});
```

## Performance Considerations

1. **Initialization**: Bridge initialization is async and should be done once
2. **Caching**: Enable Redis caching for production use
3. **Parallel searches**: Configure `parallelSimulations` based on your CPU cores
4. **Time limits**: Set appropriate `timeLimitMs` based on your latency requirements
5. **Memory usage**: Monitor memory usage with large search spaces

## Next Steps

1. **Implement FFI binding**: Choose and implement the actual Rust-TypeScript communication layer
2. **Add integration tests**: Create comprehensive tests with real Rust binary
3. **Performance benchmarking**: Compare performance with TypeScript implementation
4. **Production deployment**: Add monitoring, logging, and error recovery
5. **Documentation**: Add API documentation and integration guides

## Requirements

- Node.js 16+ (for proper async/await and TypeScript support)
- TypeScript 4.5+ (for advanced type features)
- Rust 1.70+ (for the AB-MCTS service)
- Redis (optional, for caching)

For questions or issues, refer to the main AB-MCTS service documentation or create an issue in the project repository.