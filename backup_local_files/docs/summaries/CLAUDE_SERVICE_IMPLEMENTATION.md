# Service Implementation Guide: From Mocks to Production
## Current Mock Inventory
**CRITICAL**: Most core services are mocked or disabled. This guide helps Claude systematically replace mocks with real implementations.
## Mock Services Map
### 1. Cognitive Agents (ALL MOCKED!)

Location: `src/agents/cognitive/`
| Agent | Mock File | Purpose | Real Implementation Needed |

|-------|-----------|---------|---------------------------|

| CognitiveAgent | mock_cognitive_agent.ts | Base cognitive reasoning | Real reasoning engine with LLM |

| DevilsAdvocateAgent | devils_advocate_agent.ts | Challenge assumptions | Critical thinking prompts |

| PlannerAgent | planner_agent.ts | Task planning | Task decomposition with DSPy |

| ReflectorAgent | reflector_agent.ts | Self-reflection | Memory + analysis system |

| RetrieverAgent | retriever_agent.ts | Information retrieval | Vector search + reranking |

| SynthesizerAgent | synthesizer_agent.ts | Combine information | Multi-source aggregation |

| ResourceManagerAgent | resource_manager_agent.ts | Resource optimization | Real monitoring + allocation |

| EthicsAgent | ethics_agent.ts | Ethical evaluation | Ethics framework integration |

| UserIntentAgent | user_intent_agent.ts | Intent recognition | NLP intent classification |
### 2. DSPy Orchestration (MOCK ONLY!)

Location: `src/services/dspy-orchestrator/`
**Current State**: 

- `bridge.ts` connects to `mock_server.py` only

- No real DSPy backend implementation

- WebSocket communication ready but unused
**Files**:

- `mock_server.py` - Fake responses only

- `server.py` - Incomplete real implementation

- `orchestrator.py` - Has DSPy imports but not integrated
### 3. Infrastructure Services (DISABLED/MISSING)
| Service | Status | Location | Issue |

|---------|--------|----------|-------|

| Performance Monitor | Mocked | middleware/performance.ts | Returns no-op functions |

| GraphQL Server | Disabled | graphql/server.ts | Apollo dependency conflict |

| Port Integration | Disabled | services/port-integration-service.ts | Causes server hangs |

| Security Hardening | Commented | services/security-hardening.ts | Not imported |

| Redis Cache | Missing | - | No Redis implementation |

| Circuit Breaker | Imported only | services/circuit-breaker.ts | Not integrated |
## Implementation Priority & Strategy
### Phase 1: Enable Core Infrastructure (Week 1)

#### 1.1 Fix Performance Middleware

```typescript

// Current (BROKEN) - src/server.ts:58-67

let performanceMiddleware: any = {

  requestTimer: () => (req: any, res: any, next: any) => next(),

  compressionMiddleware: () => (req: any, res: any, next: any) => next(),

  rateLimiter: () => (req: any, res: any, next: any) => next(),

  databaseOptimizer: () => (req: any, res: any, next: any) => next(),

  close: () => Promise.resolve()

};
// REPLACE WITH:

import { PerformanceMiddleware } from './middleware/performance';

const performanceMiddleware = new PerformanceMiddleware({

  enableCompression: true,

  compressionThreshold: 1024,

  rateLimitWindowMs: 15 * 60 * 1000,

  rateLimitMax: 100,

  enableMetrics: true,

  metricsPort: 9090

});
// Initialize with timeout protection

try {

  await Promise.race([

    performanceMiddleware.initialize(),

    new Promise((_, reject) => 

      setTimeout(() => reject(new Error('Performance middleware timeout')), 5000)

    )

  ]);

} catch (error) {

  logger.error('Performance middleware init failed, using basic setup', error);

  // Use basic middleware instead of mocks

}

```

#### 1.2 Implement Redis Infrastructure

```typescript

// Create src/services/redis-service.ts

import { createClient } from 'redis';

import CircuitBreaker from 'opossum';
export class RedisService {

  private client: ReturnType<typeof createClient>;

  private breaker: CircuitBreaker;

  

  async initialize() {

    this.client = createClient({

      url: process.env.REDIS_URL || 'redis://localhost:6379',

      socket: {

        connectTimeout: 5000,

        reconnectStrategy: (retries) => {

          if (retries > 10) return false;

          return Math.min(retries * 100, 3000);

        }

      }

    });

    

    // Wrap operations in circuit breaker

    this.breaker = new CircuitBreaker(

      async (operation: Function) => operation(),

      {

        timeout: 3000,

        errorThresholdPercentage: 50,

        resetTimeout: 30000

      }

    );

    

    await this.client.connect();

  }

  

  async get(key: string): Promise<string | null> {

    return this.breaker.fire(() => this.client.get(key));

  }

  

  async set(key: string, value: string, ttl?: number): Promise<void> {

    return this.breaker.fire(() => 

      ttl ? this.client.setEx(key, ttl, value) : this.client.set(key, value)

    );

  }

}

```
### Phase 2: Real DSPy Implementation (Week 2)

#### 2.1 Create Real DSPy Server

```python
# src/services/dspy-orchestrator/production_server.py

import asyncio

import websockets

import json

import dspy

from dspy.teleprompt import MIPROv2

from typing import Dict, Any

import logging
class DSPyProductionServer:

    def __init__(self):

        # Initialize real DSPy with proper LLM

        self.lm = dspy.LM(

            model=os.getenv("DSPY_MODEL", "openai/gpt-4"),

            api_key=os.getenv("OPENAI_API_KEY"),

            max_tokens=2000

        )

        dspy.settings.configure(lm=self.lm)

        

        # Load optimized programs

        self.programs = {}

        self.load_programs()

        

    async def handle_request(self, websocket, path):

        try:

            async for message in websocket:

                request = json.loads(message)

                response = await self.process_request(request)

                await websocket.send(json.dumps(response))

        except Exception as e:

            error_response = {

                "requestId": request.get("requestId", "unknown"),

                "success": False,

                "error": str(e)

            }

            await websocket.send(json.dumps(error_response))

    

    async def process_request(self, request: Dict[str, Any]) -> Dict[str, Any]:

        method = request.get("method")

        params = request.get("params", {})

        

        handlers = {

            "orchestrate": self.orchestrate_task,

            "optimize": self.optimize_program,

            "evaluate": self.evaluate_task

        }

        

        handler = handlers.get(method)

        if not handler:

            raise ValueError(f"Unknown method: {method}")

            

        result = await handler(params)

        

        return {

            "requestId": request.get("requestId"),

            "success": True,

            "data": result

        }

    

    async def orchestrate_task(self, params: Dict[str, Any]) -> Dict[str, Any]:

        # Real task orchestration with DSPy

        task = params.get("task")

        context = params.get("context", {})

        

        # Use appropriate program based on task type

        program = self.select_program(task)

        result = program(task=task, context=context)

        

        return {

            "result": result.output,

            "reasoning": result.reasoning,

            "confidence": result.confidence

        }

```

#### 2.2 Update Bridge to Use Real Server

```typescript

// src/services/dspy-orchestrator/bridge.ts

export class DSPyBridge extends EventEmitter {

  private async startPythonService(): Promise<void> {

    try {

      logger.info('🐍 Starting DSPy Python service (production mode)...');

      

      // Use production server instead of mock

      const pythonScript = path.join(__dirname, 'production_server.py');

      

      // Check if Python environment is set up

      const venvPath = path.join(__dirname, 'venv');

      const pythonBin = process.platform === 'win32' 

        ? path.join(venvPath, 'Scripts', 'python')

        : path.join(venvPath, 'bin', 'python');

      

      if (!fs.existsSync(pythonBin)) {

        throw new Error('Python virtual environment not found. Run setup script first.');

      }

      

      this.pythonProcess = spawn(pythonBin, [pythonScript], {

        env: {

          ...process.env,

          PYTHONUNBUFFERED: '1',

          DSPY_CACHE_DIR: path.join(__dirname, '.dspy_cache')

        }

      });

      

      // Handle process output

      this.pythonProcess.stdout?.on('data', (data) => {

        logger.info(`DSPy: ${data.toString().trim()}`);

      });

      

      this.pythonProcess.stderr?.on('data', (data) => {

        logger.error(`DSPy Error: ${data.toString().trim()}`);

      });

      

      // Wait for server to be ready

      await this.waitForServer();

    } catch (error) {

      logger.error('Failed to start DSPy service', error);

      throw error;

    }

  }

}

```
### Phase 3: Implement Real Agents (Week 3)

#### 3.1 Base Cognitive Agent Implementation

```typescript

// src/agents/cognitive/real_cognitive_agent.ts

import { BaseAgent } from '../base_agent';

import { dspyService } from '../../services/dspy-service';

import { memoryService } from '../../services/memory-service';
export class RealCognitiveAgent extends BaseAgent {

  async execute(input: any): Promise<any> {

    try {

      // Store context in memory

      await memoryService.store({

        content: input.task,

        metadata: {

          agent: this.name,

          timestamp: new Date().toISOString(),

          context: input.context

        }

      });

      

      // Retrieve relevant memories

      const memories = await memoryService.search(input.task, 5);

      

      // Use DSPy for reasoning

      const result = await dspyService.execute({

        method: 'orchestrate',

        params: {

          task: input.task,

          context: {

            ...input.context,

            memories: memories.map(m => m.content),

            agentType: 'cognitive'

          }

        }

      });

      

      // Store result for future reference

      await memoryService.store({

        content: result.data.result,

        metadata: {

          agent: this.name,

          taskId: input.taskId,

          confidence: result.data.confidence

        }

      });

      

      return {

        success: true,

        output: result.data.result,

        reasoning: result.data.reasoning,

        confidence: result.data.confidence

      };

    } catch (error) {

      logger.error(`${this.name} execution failed`, error);

      return {

        success: false,

        error: error.message

      };

    }

  }

}

```

#### 3.2 Agent Registry Update

```typescript

// src/agents/universal_agent_registry.ts

import { RealCognitiveAgent } from './cognitive/real_cognitive_agent';

import { RealPlannerAgent } from './cognitive/real_planner_agent';

// ... other real implementations
export class UniversalAgentRegistry {

  private async loadAgents(): Promise<void> {

    // Replace mock check with environment-based loading

    const useRealAgents = process.env.USE_REAL_AGENTS === 'true';

    

    if (useRealAgents) {

      // Load real implementations

      this.agentLoaders.set('cognitive', async () => new RealCognitiveAgent());

      this.agentLoaders.set('planner', async () => new RealPlannerAgent());

      // ... etc

    } else {

      // Keep mocks for development only

      logger.warn('⚠️  Using MOCK agents - not for production!');

      // ... load mocks

    }

  }

}

```
## Testing Strategy for Real Services
### 1. Unit Tests for Each Service

```typescript

// src/tests/services/redis-service.test.ts

describe('RedisService', () => {

  let service: RedisService;

  

  beforeAll(async () => {

    service = new RedisService();

    await service.initialize();

  });

  

  test('should handle connection failures gracefully', async () => {

    // Simulate Redis down

    await service.close();

    

    // Should not throw, circuit breaker should open

    const result = await service.get('test-key');

    expect(result).toBeNull();

  });

  

  test('should cache and retrieve values', async () => {

    await service.set('test-key', 'test-value', 60);

    const value = await service.get('test-key');

    expect(value).toBe('test-value');

  });

});

```
### 2. Integration Tests

```typescript

// src/tests/integration/real-agents.test.ts

describe('Real Agent Integration', () => {

  test('cognitive agent should process tasks with DSPy', async () => {

    const agent = new RealCognitiveAgent();

    const result = await agent.execute({

      task: 'Analyze the sentiment of customer feedback',

      context: { feedback: 'Great product but slow delivery' }

    });

    

    expect(result.success).toBe(true);

    expect(result.confidence).toBeGreaterThan(0.7);

    expect(result.output).toContain('mixed sentiment');

  });

});

```
## Common Implementation Pitfalls
### 1. Timeout Issues

```typescript

// BAD: No timeout protection

await someService.initialize();
// GOOD: Always use timeout

await Promise.race([

  someService.initialize(),

  new Promise((_, reject) => 

    setTimeout(() => reject(new Error('Init timeout')), 5000)

  )

]);

```
### 2. Missing Error Boundaries

```typescript

// BAD: Errors crash the server

app.use(someMiddleware.handler());
// GOOD: Wrap in error boundary

app.use((req, res, next) => {

  try {

    someMiddleware.handler()(req, res, next);

  } catch (error) {

    logger.error('Middleware error', error);

    next(); // Continue without this middleware

  }

});

```
### 3. Hardcoded Service Locations

```typescript

// BAD: Hardcoded URLs

const redis = createClient({ url: 'redis://localhost:6379' });
// GOOD: Environment-based

const redis = createClient({ 

  url: process.env.REDIS_URL || 'redis://localhost:6379' 

});

```
## Deployment Checklist
- [ ] All mock imports removed from production code

- [ ] Environment variable to control mock usage (dev only)

- [ ] Real services have timeout protection

- [ ] Circuit breakers on all external calls

- [ ] Health checks for each service

- [ ] Graceful degradation when services fail

- [ ] Monitoring and alerts configured

- [ ] Load testing completed

- [ ] Documentation updated

- [ ] No hardcoded credentials or URLs
## Quick Service Status Check
```bash
# Check for remaining mocks

npm run check:mocks

# Verify real services are enabled

grep -n "USE_REAL_AGENTS\|ENABLE_DSPY_MOCK" .env

# Test service health

curl http://localhost:8080/api/health?detailed=true

# Check Redis connection

redis-cli ping

# Verify DSPy server is running

ps aux | grep production_server.py

```
## Migration Path
1. **Development**: Keep mocks, use feature flags

2. **Staging**: Enable real services one by one

3. **Production**: All real services, no mocks
```bash
# Development

USE_REAL_AGENTS=false

ENABLE_DSPY_MOCK=true

# Staging

USE_REAL_AGENTS=true

ENABLE_DSPY_MOCK=false

USE_REAL_REDIS=true

# Production

USE_REAL_AGENTS=true

ENABLE_DSPY_MOCK=false

USE_REAL_REDIS=true

ENABLE_MONITORING=true

```