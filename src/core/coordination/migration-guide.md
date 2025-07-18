# Agent Coordinator Migration Guide

## Overview
The complex 1,200+ line `agent-coordinator.ts` has been replaced with a lightweight DSPy-based coordinator (`dspy-coordinator.ts`) that is under 200 lines.

## Migration Steps

### 1. Update Imports

Replace:
```typescript
import { AgentCoordinator } from './agent-coordinator';
```

With:
```typescript
import { AgentCoordinator } from './dspy-coordinator';
```

### 2. Key Changes

- **Simplified API**: The core `coordinateGroupFix` method remains the same
- **DSPy Integration**: Agent selection and coordination is now handled by DSPy
- **Reduced Complexity**: From 1,263 lines to 195 lines
- **Better Intelligence**: DSPy provides smarter agent selection and task assignment

### 3. Features Comparison

| Feature | Old (agent-coordinator.ts) | New (dspy-coordinator.ts) |
|---------|---------------------------|---------------------------|
| Lines of Code | 1,263 | 195 |
| Agent Selection | Manual logic | DSPy AI-driven |
| Task Assignment | Complex role system | DSPy coordination |
| Message Passing | Complex EventEmitter | Simplified |
| Session Management | Manual tracking | DSPy handles |
| Error Recovery | Complex retry logic | DSPy fallback |

### 4. Removed Features (Now Handled by DSPy)

- Complex strategy creation
- Manual agent role assignment
- Detailed step execution
- Communication channels
- Message broker integration
- Task manager integration

### 5. Benefits

1. **Reduced Maintenance**: 85% less code to maintain
2. **Better Performance**: DSPy optimizes agent selection
3. **Smarter Coordination**: AI-driven task assignment
4. **Easier to Extend**: Simple, clean interface

## Example Usage

```typescript
const coordinator = new AgentCoordinator(agentPool);

// Same API as before
const plan = await coordinator.coordinateGroupFix(
  "Connection refused error",
  { url: "http://localhost:5173" }
);

// DSPy handles all the complexity internally
console.log(`Completed with ${plan.assignedAgents.length} agents`);
```

## Files to Update

1. `test-coordination.ts` - Update import
2. `hot-reload-orchestrator.ts` - Update import
3. `task-execution-engine.deprecated.ts` - Already deprecated, can ignore

## Next Steps

1. Test the new coordinator with existing use cases
2. Remove the old `agent-coordinator.ts` file
3. Update any documentation references