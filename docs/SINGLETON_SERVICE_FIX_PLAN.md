# Singleton Service Initialization Fix Plan

## Problem Summary

The application hangs during startup due to singleton services being instantiated at import time with blocking constructors and circular dependencies.

## Root Causes

1. **Eager instantiation**: Services are created using `export const service = new Service()` at module level
2. **Blocking constructors**: Some services perform async operations or wait for connections in constructors
3. **Circular dependencies**: Services import each other creating dependency cycles
4. **Import-time side effects**: Critical operations happen during module import rather than controlled initialization

## Proposed Solution

### Phase 1: Convert to Lazy Initialization Pattern

Transform all singleton services from eager to lazy initialization:

```typescript
// Before (problematic):
export const dspyService = new DSPyService();

// After (fixed):
let _dspyService: DSPyService | null = null;
export function getDSPyService(): DSPyService {
  if (!_dspyService) {
    _dspyService = new DSPyService();
  }
  return _dspyService;
}
```

### Phase 2: Move Blocking Operations Out of Constructors

Separate construction from initialization:

```typescript
class DSPyService {
  private initialized = false;

  constructor() {
    // Only set up basic properties, no async operations
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Move all async/blocking operations here
    await this.connectToBridge();
    this.initialized = true;
  }
}
```

### Phase 3: Implement Service Manager

Create a centralized service manager to handle initialization order:

```typescript
class ServiceManager {
  private services: Map<string, any> = new Map();
  private initOrder = [
    'supabase',
    'memoryManager',
    'circuitBreaker',
    'dspyBridge',
    'dspyService',
    // ... other services in dependency order
  ];

  async initializeAll(): Promise<void> {
    for (const serviceName of this.initOrder) {
      await this.initializeService(serviceName);
    }
  }
}
```

### Phase 4: Update Server Startup

Modify server.ts to use controlled initialization:

```typescript
// server.ts
import { serviceManager } from './services/service-manager';

async function startServer() {
  logger.info('Initializing services...');
  await serviceManager.initializeAll();

  logger.info('Starting Express server...');
  // ... rest of server setup
}
```

## Implementation Order

1. **Start with leaf services** (no dependencies):
   - TelemetryService
   - CircuitBreakerService
   - MemoryManager

2. **Then services with simple dependencies**:
   - DSPyBridge
   - SupabaseEnhanced
   - KokoroTTS

3. **Finally complex services**:
   - DSPyService
   - DSPyPerformanceOptimizer
   - EnhancedAgentCoordinator

## Benefits

1. **No breaking changes**: Existing code using services continues to work
2. **Deterministic startup**: Services initialize in correct order
3. **Better error handling**: Can catch and handle initialization failures
4. **Faster startup**: Non-critical services can initialize lazily
5. **Easier testing**: Services can be mocked without import side effects

## Migration Strategy

1. Add getter functions alongside existing exports (backward compatible)
2. Update imports gradually to use getters
3. Once all imports updated, remove direct exports
4. Add deprecation warnings to guide migration

## Example Implementation

Here's how to fix DSPyService:

```typescript
// dspy-service.ts
let _instance: DSPyService | null = null;

export class DSPyService {
  private initialized = false;

  constructor() {
    // No async operations here
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      if (process.env.ENABLE_DSPY_MOCK === 'true') {
        await this.waitForConnection(5000);
      }
      this.initialized = true;
    } catch (error) {
      logger.warn('DSPy initialization failed', error);
    }
  }
}

export function getDSPyService(): DSPyService {
  if (!_instance) {
    _instance = new DSPyService();
  }
  return _instance;
}

// Temporary backward compatibility
export const dspyService = new Proxy({} as DSPyService, {
  get(target, prop) {
    logger.warn('Direct access to dspyService is deprecated. Use getDSPyService() instead.');
    return getDSPyService()[prop as keyof DSPyService];
  },
});
```

## Testing Approach

1. Create unit tests for each service's lazy initialization
2. Test initialization order in service manager
3. Verify no import-time side effects
4. Test error scenarios during initialization
5. Ensure backward compatibility during migration
