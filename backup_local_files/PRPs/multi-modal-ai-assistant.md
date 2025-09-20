
name: "Universal AI Tools PRP - Multi-Modal AI Assistant with Real-Time Learning"

description: |
## Purpose

Implement a production-ready Multi-Modal AI Assistant that processes text, images, audio, and code simultaneously while learning from interactions in real-time. This feature leverages Universal AI Tools' sophisticated service architecture, MLX fine-tuning, intelligent parameter automation, and AB-MCTS orchestration to deliver a comprehensive AI experience with continuous improvement capabilities.
## Core Principles

1. **Context is King**: Full integration with MCP context injection system for conversation persistence

2. **Validation Loops**: Comprehensive testing with automatic error recovery and performance benchmarks

3. **Production-Ready**: Scalable, secure implementation with multi-tenant isolation

4. **Service-Oriented**: Extends existing services rather than creating new agents

5. **Global Rules**: Follows all CLAUDE.md patterns and architectural consistency
---
## Goal

Build a multi-modal AI assistant that:

- Processes text, images, audio, and code in unified conversations

- Learns from user interactions using MLX fine-tuning and AB-MCTS feedback

- Automatically optimizes responses using intelligent parameter service

- Provides real-time performance improvements through distributed learning

- Maintains conversation context across sessions via MCP integration
## Why

- **Business Value**: Differentiates Universal AI Tools as a comprehensive AI platform

- **User Impact**: Single interface for all AI interactions with personalized learning

- **Integration**: Leverages all existing advanced services (MLX, PyVision, DSPy, AB-MCTS)

- **Problems Solved**: Fragmented AI experiences, lack of personalization, context loss
## What

### User-Visible Behavior

- Unified chat interface supporting text, image uploads, audio input, and code blocks

- Real-time response optimization based on user preferences

- Continuous learning from feedback with visible improvement metrics

- Context-aware responses that remember previous interactions

- Multi-modal output generation (text + images + code)
### API Endpoints

```typescript

POST /api/v1/assistant/chat

POST /api/v1/assistant/feedback

GET  /api/v1/assistant/history/:userId

POST /api/v1/assistant/learn

GET  /api/v1/assistant/metrics/:sessionId

```
### Technical Requirements

- Sub-2 second response time for text interactions

- Support for 10MB+ image processing via PyVision

- Real-time audio transcription with Whisper integration

- Automatic model selection via AB-MCTS orchestration

- Continuous fine-tuning with MLX framework
### Success Criteria

- [ ] Multi-modal input processing with 95%+ accuracy

- [ ] Response time <2s for text, <5s for images

- [ ] 30%+ improvement in response quality after 100 interactions

- [ ] Zero data loss with full context persistence

- [ ] Production deployment with 99.9% uptime
## All Needed Context
### Universal AI Tools Architecture (CRITICAL - Review these first)

```yaml
# MUST READ - Core architecture understanding

- file: CLAUDE.md

  why: Project rules, service-oriented architecture, security patterns

  

- file: src/services/context-injection-service.ts

  why: MANDATORY context injection for all LLM calls

  critical: Must use enrichWithContext() for every LLM interaction

  

- file: src/services/mlx-fine-tuning-service.ts

  why: Real-time model training integration

  pattern: Use for personalization and continuous learning

  

- file: src/services/intelligent-parameter-service.ts

  why: Automatic parameter optimization for response quality

  critical: getOptimalParameters() for all model calls

  

- file: src/services/ab-mcts-orchestrator.ts

  why: Probabilistic model/agent selection

  pattern: Use for dynamic routing decisions

  

- file: src/services/pyvision-bridge.ts

  why: Image processing capabilities

  integration: processImage() for visual inputs

  

- file: src/agents/enhanced-base-agent.ts

  why: Base pattern for assistant implementation

  pattern: Extend for type-safe execution

  

- file: src/services/llm-router-service.ts

  why: Multi-tier LLM routing logic

  critical: Tier-based model selection

  

- file: src/services/mcp-integration-service.ts

  why: Context persistence across sessions

  pattern: Save/retrieve conversation context

  

- file: supabase/migrations/002_comprehensive_knowledge_system.sql

  why: Database schema for knowledge persistence

  tables: ai_memories, documents, agent_performance_metrics

```
### Service Integration Points

```yaml
# Core Services to Integrate With

- service: Context Injection Service

  file: src/services/context-injection-service.ts

  pattern: |

    const { enrichedPrompt, contextSummary } = await contextInjectionService.enrichWithContext(

      userMessage,

      { userId, sessionId, projectContext, conversationHistory }

    );

  critical: MUST use for every LLM call

  

- service: MLX Fine-Tuning

  file: src/services/mlx-fine-tuning-service.ts

  pattern: |

    const fineTuningJob = await mlxService.createFineTuningJob({

      baseModel: selectedModel,

      trainingData: userInteractions,

      optimization: 'lora',

      learningRate: 0.0001

    });

  usage: Triggered after every 100 interactions

  

- service: Intelligent Parameters

  file: src/services/intelligent-parameter-service.ts

  pattern: |

    const params = await intelligentParameterService.getOptimalParameters({

      model: currentModel,

      taskType: detectTaskType(userMessage),

      userContext: await getUserPreferences(userId),

      performanceGoals: ['accuracy', 'speed', 'creativity']

    });

  critical: Use for ALL model calls

  

- service: AB-MCTS Orchestration

  file: src/services/ab-mcts-orchestrator.ts

  pattern: |

    const orchestrationResult = await abMctsService.orchestrate({

      task: 'multi_modal_response',

      availableModels: ['gpt-4-vision', 'claude-3', 'llama3.2'],

      context: enrichedContext,

      explorationRate: 0.2

    });

  usage: Dynamic model selection per request

  

- service: PyVision Bridge

  file: src/services/pyvision-bridge.ts

  pattern: |

    const imageAnalysis = await pyVisionBridge.analyzeImage(imageBuffer, {

      features: ['objects', 'text', 'faces', 'scene'],

      backend: 'mlx',

      refineWithSDXL: userPreferences.highQualityImages

    });

  

- service: MCP Integration

  file: src/services/mcp-integration-service.ts

  pattern: |

    await mcpService.saveContext({

      category: 'conversation_history',

      userId,

      sessionId,

      content: conversationTurn,

      metadata: { timestamp, model, performance }

    });

  critical: Save after EVERY interaction

  

- service: Supabase Vault

  file: src/config/supabase.ts

  pattern: |

    const apiKey = await getSecretFromVault('openai_api_key');

    // NEVER use process.env for API keys

  critical: ALL API keys from vault

```
### Documentation & References

```yaml
# External Documentation

- url: https://github.com/ml-explore/mlx

  why: MLX fine-tuning patterns for Apple Silicon

  section: Fine-tuning with LoRA

  

- url: https://stanfordnlp.github.io/dspy/

  why: DSPy cognitive orchestration patterns

  section: Multi-agent reasoning chains

  

- url: https://supabase.com/docs/guides/database/vault

  why: Secret management patterns

  critical: Runtime secret retrieval

  
# Internal Patterns

- file: src/agents/cognitive/enhanced-planner-agent.ts

  why: Planning pattern for multi-step operations

  pattern: JSON-structured task decomposition

  

- file: src/services/feedback-collector.ts

  why: User feedback integration pattern

  critical: Continuous learning loop

  

- file: rust-services/ab-mcts-service/src/lib.rs

  why: Probabilistic orchestration implementation

  pattern: Beta distribution for performance tracking

```
### Current Service Architecture (Production-Ready Systems)

```bash

src/

├── services/               # Advanced AI Services

│   ├── multi-modal-assistant.ts        # NEW: Main assistant service

│   ├── context-injection-service.ts    # Mandatory for all LLM calls

│   ├── mlx-fine-tuning-service.ts      # Custom model training

│   ├── intelligent-parameter-service.ts # ML-based optimization

│   ├── ab-mcts-orchestrator.ts         # Probabilistic orchestration

│   ├── pyvision-bridge.ts              # Image processing

│   ├── audio-processor.ts              # NEW: Audio transcription

│   └── mcp-integration-service.ts      # Context persistence

├── routers/               # API Endpoints

│   ├── assistant.ts      # NEW: Assistant API routes

│   └── existing...       # All existing routers

└── middleware/           # Security & Performance

    ├── context-injection-middleware.ts # Auto context injection

    └── multi-modal-validator.ts        # NEW: Input validation

```
### Target Architecture Integration

```bash
# New files to be added

src/

├── services/

│   ├── multi-modal-assistant.ts        # Main orchestrator service

│   └── audio-processor.ts              # Whisper integration

├── routers/

│   └── assistant.ts                    # API endpoints

├── middleware/

│   └── multi-modal-validator.ts        # Input validation

└── types/

    └── assistant.ts                     # Type definitions

# Database migrations

supabase/migrations/

└── 004_multi_modal_assistant.sql       # Assistant-specific tables

```
### Known Patterns & Gotchas

```typescript

// CRITICAL: Universal AI Tools specific patterns
// 1. MANDATORY: All LLM calls must use context injection

const { enrichedPrompt, contextSummary } = await contextInjectionService.enrichWithContext(

  userRequest,

  { userId, workingDirectory, currentProject, sessionId }

);

// NEVER call LLM directly without context injection
// 2. Secrets MUST use Supabase Vault

const apiKey = await getSecretFromVault('service_name_api_key');

// NEVER: process.env.API_KEY

// NEVER: hardcoded API keys
// 3. Enhanced Base Agent pattern for new agents

export class MultiModalAssistant extends EnhancedBaseAgent {

  protected buildSystemPrompt(): string { 

    // Context-aware prompts with user preferences

    return `You are a multi-modal AI assistant with access to:

      - Text understanding and generation

      - Image analysis via PyVision

      - Code understanding and generation

      - Audio transcription capabilities

      User preferences: ${JSON.stringify(this.userPreferences)}

      Previous context: ${this.contextSummary}`;

  }

  

  protected getInternalModelName(): string { 

    // Dynamic model selection via AB-MCTS

    return this.orchestrationResult.selectedModel;

  }

}
// 4. Service-oriented architecture - extend existing services

// Don't create isolated components, integrate with:

// - MLX for custom models

// - DSPy for cognitive orchestration  

// - Intelligent parameters for optimization

// - AB-MCTS for probabilistic routing
// 5. Performance tracking with AB-MCTS

await abMctsService.updatePerformance({

  model: selectedModel,

  success: responseQuality > 0.8,

  latency: responseTime,

  tokens: tokenUsage,

  userFeedback: feedbackScore

});
// 6. Real-time learning trigger

if (interactionCount % 100 === 0) {

  await mlxService.triggerFineTuning({

    baseModel: currentModel,

    trainingData: recentInteractions,

    optimization: 'lora'

  });

}

```
## Implementation Blueprint
### Data Models and Service Integration

```typescript

// src/types/assistant.ts

import { z } from 'zod';
export const MultiModalMessageSchema = z.object({

  userId: z.string().uuid(),

  sessionId: z.string().uuid(),

  content: z.object({

    text: z.string().optional(),

    images: z.array(z.string().url()).optional(),

    audio: z.string().base64().optional(),

    code: z.object({

      language: z.string(),

      content: z.string()

    }).optional()

  }),

  context: z.object({

    projectId: z.string().optional(),

    workingDirectory: z.string().optional(),

    previousMessageId: z.string().uuid().optional()

  })

});
export const AssistantResponseSchema = z.object({

  messageId: z.string().uuid(),

  content: z.object({

    text: z.string(),

    images: z.array(z.string().url()).optional(),

    code: z.array(z.object({

      language: z.string(),

      content: z.string(),

      explanation: z.string()

    })).optional(),

    suggestions: z.array(z.string()).optional()

  }),

  metadata: z.object({

    model: z.string(),

    latency: z.number(),

    tokens: z.number(),

    confidence: z.number(),

    parameters: z.record(z.any())

  })

});
// Database schema extension

interface AssistantInteraction {

  id: string;

  userId: string;

  sessionId: string;

  messageType: 'user' | 'assistant';

  content: MultiModalContent;

  metadata: InteractionMetadata;

  createdAt: Date;

  feedbackScore?: number;

  embedding?: number[];

}

```
### Task List (Production-Ready Implementation Order)

```yaml

Task 1: Security & Context Integration

  CREATE: src/middleware/multi-modal-validator.ts

  MODIFY: Integrate with context-injection-service

  VALIDATE: Input sanitization and size limits

  SECURITY: Implement rate limiting per modality
Task 2: Database Integration  

  CREATE: supabase/migrations/004_multi_modal_assistant.sql

  SCHEMA: |

    CREATE TABLE assistant_interactions (

      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      user_id UUID REFERENCES auth.users(id),

      session_id UUID NOT NULL,

      message_type TEXT CHECK (message_type IN ('user', 'assistant')),

      content JSONB NOT NULL,

      metadata JSONB,

      feedback_score DECIMAL(3,2),

      embedding vector(1536),

      created_at TIMESTAMPTZ DEFAULT NOW()

    );

    

    CREATE INDEX idx_assistant_user_session ON assistant_interactions(user_id, session_id);

    CREATE INDEX idx_assistant_embedding ON assistant_interactions USING ivfflat (embedding vector_l2_ops);

  RLS: Enable row-level security for multi-tenant isolation
Task 3: Core Service Implementation

  CREATE: src/services/multi-modal-assistant.ts

  PATTERN: |

    export class MultiModalAssistantService extends EnhancedBaseAgent {

      async processMessage(message: MultiModalMessage): Promise<AssistantResponse> {

        // 1. Validate input

        const validated = MultiModalMessageSchema.parse(message);

        

        // 2. Context injection (MANDATORY)

        const { enrichedPrompt, contextSummary } = 

          await this.contextInjectionService.enrichWithContext(

            validated.content,

            { userId: validated.userId, sessionId: validated.sessionId }

          );

        

        // 3. Process multi-modal inputs

        const processedInputs = await this.processMultiModalInputs(validated);

        

        // 4. Get optimal parameters

        const parameters = await this.intelligentParameterService.getOptimalParameters({

          model: this.currentModel,

          taskType: this.detectTaskType(processedInputs),

          userContext: await this.getUserContext(validated.userId)

        });

        

        // 5. AB-MCTS orchestration for model selection

        const orchestration = await this.abMctsService.orchestrate({

          task: 'multi_modal_response',

          context: enrichedPrompt,

          availableModels: this.getAvailableModels(processedInputs)

        });

        

        // 6. Generate response

        const response = await this.generateResponse(

          processedInputs,

          parameters,

          orchestration

        );

        

        // 7. Save to MCP (MANDATORY)

        await this.mcpService.saveContext({

          category: 'conversation_history',

          userId: validated.userId,

          sessionId: validated.sessionId,

          content: response

        });

        

        // 8. Track performance for AB-MCTS

        await this.trackPerformance(orchestration, response);

        

        // 9. Trigger learning if threshold met

        await this.checkLearningTrigger(validated.userId);

        

        return response;

      }

      

      private async processMultiModalInputs(message: MultiModalMessage) {

        const processed: ProcessedInputs = {};

        

        if (message.content.text) {

          processed.text = message.content.text;

        }

        

        if (message.content.images?.length) {

          processed.imageAnalysis = await Promise.all(

            message.content.images.map(img => 

              this.pyVisionBridge.analyzeImage(img, {

                features: ['objects', 'text', 'scene'],

                backend: 'mlx'

              })

            )

          );

        }

        

        if (message.content.audio) {

          processed.transcript = await this.audioProcessor.transcribe(

            message.content.audio,

            { model: 'whisper-large-v3' }

          );

        }

        

        if (message.content.code) {

          processed.code = {

            ...message.content.code,

            analysis: await this.analyzeCode(message.content.code)

          };

        }

        

        return processed;

      }

    }
Task 4: Audio Processing Service

  CREATE: src/services/audio-processor.ts

  INTEGRATE: Whisper API or local model

  PATTERN: Follow existing service patterns

  CACHE: Use Supabase cache for transcriptions
Task 5: API Endpoints

  CREATE: src/routers/assistant.ts

  ENDPOINTS: |

    router.post('/chat', authenticate, validateMultiModal, async (req, res) => {

      const response = await assistantService.processMessage(req.body);

      res.json(response);

    });

    

    router.post('/feedback', authenticate, async (req, res) => {

      await assistantService.processFeedback(req.body);

      res.json({ success: true });

    });

    

    router.get('/history/:userId', authenticate, authorize, async (req, res) => {

      const history = await assistantService.getHistory(req.params.userId);

      res.json(history);

    });
Task 6: Real-time Learning Integration

  MODIFY: src/services/mlx-fine-tuning-service.ts

  ADD: Automatic trigger after interaction threshold

  PATTERN: |

    if (userInteractionCount % 100 === 0) {

      const trainingData = await this.prepareTrainingData(userId);

      await mlxService.createFineTuningJob({

        baseModel: 'llama3.2:3b',

        trainingData,

        optimization: 'lora',

        epochs: 3

      });

    }
Task 7: Frontend Integration (Optional)

  CREATE: ui/src/components/MultiModalChat.tsx

  FEATURES: Drag-drop images, audio recording, code syntax highlighting

  WEBSOCKET: Real-time streaming responses

```
### Integration Points (Production Architecture)

```yaml

DATABASE:

  - migration: "supabase/migrations/004_multi_modal_assistant.sql"

  - tables: "assistant_interactions, assistant_sessions, assistant_feedback"

  - indexes: "Optimized for vector similarity and user queries"

  - RLS: "Multi-tenant isolation with user_id policies"

  

SERVICES:

  - context-injection: "MANDATORY for all LLM interactions"

  - mlx-fine-tuning: "Triggered every 100 interactions"

  - intelligent-parameters: "Automatic optimization for each request"

  - ab-mcts: "Probabilistic model selection"

  - pyvision: "Image analysis and generation"

  - mcp-integration: "Context persistence"

  

API:

  - router: "src/routers/assistant.ts"

  - middleware: "Authentication, validation, rate limiting"

  - monitoring: "Health checks and metrics collection"

  - websocket: "Real-time streaming support"

  

AGENTS:

  - base: "Extend EnhancedBaseAgent"

  - orchestration: "Integrate with DSPy cognitive chains"

  - coordination: "AB-MCTS probabilistic selection"

```
## Validation Loop (Production Standards)
### Level 1: Syntax, Security & Architecture

```bash
# Run these FIRST - fix any errors before proceeding

npm run lint:fix              # ESLint with TypeScript rules

npm run build                 # TypeScript compilation check

npm run security:audit        # Security vulnerability scan

# Validate architecture patterns

npm run validate:services     # Check service integration

npm run validate:security     # Verify vault usage

# Expected: No errors. If errors, READ and fix systematically.

```
### Level 2: Service Integration Tests

```typescript

// src/services/__tests__/multi-modal-assistant.test.ts

import { MultiModalAssistantService } from '../multi-modal-assistant';
describe('MultiModalAssistantService', () => {

  let service: MultiModalAssistantService;

  

  beforeEach(() => {

    service = new MultiModalAssistantService();

  });

  

  test('integrates with context injection service', async () => {

    const message = createMockMessage();

    const spy = jest.spyOn(contextInjectionService, 'enrichWithContext');

    

    await service.processMessage(message);

    

    expect(spy).toHaveBeenCalledWith(

      expect.any(Object),

      expect.objectContaining({

        userId: message.userId,

        sessionId: message.sessionId

      })

    );

  });

  

  test('uses intelligent parameter optimization', async () => {

    const message = createMockMessage();

    const spy = jest.spyOn(intelligentParameterService, 'getOptimalParameters');

    

    await service.processMessage(message);

    

    expect(spy).toHaveBeenCalled();

  });

  

  test('saves context to MCP after processing', async () => {

    const message = createMockMessage();

    const spy = jest.spyOn(mcpService, 'saveContext');

    

    await service.processMessage(message);

    

    expect(spy).toHaveBeenCalledWith(

      expect.objectContaining({

        category: 'conversation_history',

        userId: message.userId

      })

    );

  });

  

  test('handles multi-modal inputs correctly', async () => {

    const message = createMultiModalMessage();

    const response = await service.processMessage(message);

    

    expect(response.content.text).toBeDefined();

    expect(response.metadata.model).toBeDefined();

    expect(response.metadata.confidence).toBeGreaterThan(0);

  });

  

  test('triggers MLX fine-tuning at threshold', async () => {

    // Simulate 100 interactions

    for (let i = 0; i < 100; i++) {

      await service.processMessage(createMockMessage());

    }

    

    const spy = jest.spyOn(mlxService, 'createFineTuningJob');

    expect(spy).toHaveBeenCalled();

  });

});

```
```bash
# Run comprehensive test suite:

npm test                      # Unit tests

npm run test:integration      # Integration tests

npm run test:performance      # Performance benchmarks

npm run test:multi-modal      # Multi-modal specific tests

```
### Level 3: Performance Testing

```bash
# Load testing with multi-modal inputs

npm run test:load -- --concurrent=50 --duration=60s

# Benchmark response times

npm run benchmark:assistant

# Memory profiling

npm run profile:memory -- --service=multi-modal-assistant

# Expected metrics:
# - Text response: <2s
# - Image processing: <5s
# - Audio transcription: <3s
# - Concurrent users: 50+
# - Memory usage: <512MB

```
### Level 4: Production Deployment Test

```bash
# Build production image

docker build -t universal-ai-tools:assistant .

# Run production stack

docker-compose -f docker-compose.production.yml up -d

# Test production endpoints

curl -X POST http://localhost:9999/api/v1/assistant/chat \

  -H "Authorization: Bearer $JWT_TOKEN" \

  -H "Content-Type: application/json" \

  -d '{

    "userId": "test-user-id",

    "sessionId": "test-session-id",

    "content": {

      "text": "Analyze this image and explain what you see",

      "images": ["https://example.com/image.jpg"]

    }

  }'

# Monitor production metrics

curl http://localhost:9999/api/v1/assistant/metrics/test-session-id

# Check logs for proper execution

docker-compose logs -f app | grep "assistant"

```
### Level 5: Learning & Adaptation Test

```bash
# Simulate user interactions for learning

npm run simulate:interactions -- --count=100 --userId=test-user

# Verify MLX fine-tuning triggered

npm run mlx:status

# Check performance improvements

npm run metrics:comparison -- --before=baseline --after=finetuned

# Validate AB-MCTS adaptation

npm run ab-mcts:stats -- --service=assistant

```
## Final Production Checklist

- [ ] All tests pass: `npm test && npm run test:integration`

- [ ] No linting errors: `npm run lint`

- [ ] TypeScript compilation clean: `npm run build`

- [ ] Security audit clean: `npm run security:audit`

- [ ] Context injection integration verified

- [ ] Supabase vault secrets properly configured

- [ ] MLX fine-tuning triggers working

- [ ] Intelligent parameters optimizing correctly

- [ ] AB-MCTS orchestration selecting optimal models

- [ ] PyVision processing images successfully

- [ ] MCP saving/retrieving context properly

- [ ] Response times meet SLA (<2s text, <5s images)

- [ ] Memory usage within limits (<512MB)

- [ ] Monitoring and logging implemented

- [ ] Documentation updated in CLAUDE.md

- [ ] Production deployment successful

- [ ] Learning loop validated with 100+ interactions
---
## Advanced Architecture Anti-Patterns to Avoid

- ❌ Don't bypass context injection service - it's mandatory for security and quality

- ❌ Don't store API keys in environment variables - use Supabase vault

- ❌ Don't create isolated services - integrate with existing architecture

- ❌ Don't ignore existing patterns - follow service-oriented design

- ❌ Don't skip performance testing - this is production infrastructure

- ❌ Don't implement without AB-MCTS integration for model coordination

- ❌ Don't forget MLX optimization opportunities for personalization

- ❌ Don't bypass intelligent parameter automation

- ❌ Don't ignore the sophisticated monitoring and analytics systems

- ❌ Don't process multi-modal inputs without proper validation

- ❌ Don't skip MCP context saving - it's critical for learning

- ❌ Don't hardcode model selection - use AB-MCTS orchestration
## Quality Score: 9.5/10
**Strengths:**

- Fully leverages existing sophisticated architecture

- Comprehensive integration with all core services

- Production-ready with security and performance considerations

- Real-time learning capabilities through MLX

- Multi-modal processing with existing PyVision service

- Proper context persistence via MCP

- Executable validation gates

- Clear implementation blueprint
**Minor Gap:**

- Could include more specific WebSocket implementation details for real-time streaming (-0.5)
This PRP provides a complete, production-ready implementation guide for a Multi-Modal AI Assistant that fully leverages Universal AI Tools' sophisticated service architecture while maintaining all security, performance, and architectural patterns.