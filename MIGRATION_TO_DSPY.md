# Migration Guide: Enhanced Orchestrator to DSPy Service

This guide explains how to migrate from the old Enhanced Orchestrator to the new DSPy service integration.

## Overview

The Enhanced Orchestrator has been replaced with a more powerful DSPy service that provides:

- Better performance and scalability
- Advanced prompt optimization
- Improved multi-agent coordination
- Enhanced knowledge management capabilities

## Key Changes

### 1. Direct API Usage

**Old way (Enhanced Orchestrator):**

```typescript
import { EnhancedOrchestrator } from './agents/enhanced_orchestrator';

const orchestrator = new EnhancedOrchestrator(config);
await orchestrator.initialize();

const response = await orchestrator.processRequest({
  requestId: 'req-123',
  userRequest: 'Help me with task X',
  userId: 'user-123',
  orchestrationMode: 'cognitive',
  timestamp: new Date(),
});
```

**New way (DSPy Service):**

```typescript
import { dspyService } from './services/dspy-service';

const response = await dspyService.orchestrate({
  requestId: 'req-123',
  userRequest: 'Help me with task X',
  userId: 'user-123',
  orchestrationMode: 'cognitive',
  timestamp: new Date(),
});
```

### 2. REST API Endpoints

The following new endpoints are available:

- `POST /api/orchestration/orchestrate` - Main orchestration endpoint
- `POST /api/orchestration/coordinate` - Agent coordination
- `POST /api/orchestration/knowledge/search` - Knowledge search
- `POST /api/orchestration/knowledge/extract` - Knowledge extraction
- `POST /api/orchestration/knowledge/evolve` - Knowledge evolution
- `POST /api/orchestration/optimize/prompts` - Prompt optimization
- `GET /api/orchestration/status` - Service status

### 3. Backward Compatibility

If you have existing code using the Enhanced Orchestrator, a compatibility adapter is available:

```typescript
import { createEnhancedOrchestrator } from './agents/enhanced_orchestrator';

// This will create an adapter that uses DSPy service internally
const orchestrator = createEnhancedOrchestrator(config);
```

**Note:** Using the adapter will show a deprecation warning. It's recommended to migrate to the DSPy service directly.

## Response Format Changes

### Enhanced Orchestrator Response:

```json
{
  "requestId": "req-123",
  "success": true,
  "data": {...},
  "confidence": 0.9,
  "reasoning": "...",
  "latencyMs": 150,
  "agentId": "enhanced-orchestrator",
  "orchestrationMode": "cognitive",
  "participatingAgents": ["agent1", "agent2"],
  "consensusReached": true,
  "mlxOptimized": false,
  "cacheHit": false,
  "nextActions": ["action1", "action2"]
}
```

### DSPy Service Response:

```json
{
  "requestId": "req-123",
  "success": true,
  "mode": "cognitive",
  "result": {...},
  "complexity": 0.7,
  "confidence": 0.9,
  "reasoning": "...",
  "participatingAgents": ["agent1", "agent2"],
  "executionTime": 150,
  "error": null
}
```

## New Features Available

### 1. Knowledge Management

The DSPy service provides advanced knowledge management:

```typescript
// Search knowledge
const searchResult = await dspyService.searchKnowledge('query', {
  filters: { type: 'technical' },
  limit: 10,
});

// Extract knowledge from content
const extraction = await dspyService.extractKnowledge('Some complex content...', {
  domain: 'engineering',
});

// Evolve knowledge with new information
const evolved = await dspyService.evolveKnowledge('existing knowledge', 'new information');
```

### 2. Prompt Optimization

Optimize your prompts for better performance:

```typescript
const optimized = await dspyService.optimizePrompts([
  { input: 'example input 1', output: 'expected output 1' },
  { input: 'example input 2', output: 'expected output 2' },
]);
```

### 3. Agent Coordination

Better multi-agent coordination:

```typescript
const coordination = await dspyService.coordinateAgents(
  'Complex task requiring multiple agents',
  ['agent1', 'agent2', 'agent3'],
  { priority: 'high' }
);
```

## Migration Steps

1. **Update imports**: Replace Enhanced Orchestrator imports with DSPy service
2. **Update API calls**: Use the new orchestration endpoints
3. **Update response handling**: Adjust for the new response format
4. **Test thoroughly**: Ensure all functionality works as expected
5. **Remove old code**: Once migrated, remove references to Enhanced Orchestrator

## Support

If you encounter any issues during migration:

1. Check the service status: `GET /api/orchestration/status`
2. Review the logs for any errors
3. Use the backward compatibility adapter as a temporary solution
4. Report any bugs or issues

## Future Deprecation

The Enhanced Orchestrator compatibility layer will be removed in a future version. Please plan to complete your migration within the next major release cycle.
