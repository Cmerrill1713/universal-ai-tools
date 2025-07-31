# Universal AI Tools Advanced Service Integration PRP

## Goal
Implement a sophisticated, production-ready AI service integration system that leverages Universal AI Tools' existing service-oriented architecture to add new advanced AI capabilities while maintaining security, performance, and architectural consistency with the platform's MLX fine-tuning, context injection, intelligent parameter automation, and DSPy cognitive orchestration systems.

## Why
- **Business Value**: Extends Universal AI Tools' advanced AI platform with new capabilities that can be rapidly deployed and scaled
- **Architecture Integration**: Leverages existing sophisticated services (Context Injection, MLX, DSPy, AB-MCTS) for maximum efficiency
- **Production-Ready**: Follows established patterns for security, performance, and multi-tenant isolation
- **Problems Solved**: Enables rapid development of new AI features without compromising the platform's advanced service-oriented architecture

## What
Implement a new AI service that integrates seamlessly with Universal AI Tools' sophisticated infrastructure:

### Success Criteria
- [ ] New service uses contextInjectionService for all LLM interactions (security requirement)
- [ ] Integration with intelligent parameter automation for ML-based optimization
- [ ] MLX fine-tuning integration for custom model training capabilities
- [ ] Supabase vault integration for secure secrets management
- [ ] Production-grade error handling, circuit breakers, and monitoring
- [ ] Multi-tenant isolation with Row Level Security (RLS)
- [ ] Performance benchmarks meet platform standards (sub-5s response times)
- [ ] DSPy cognitive orchestration integration for complex reasoning tasks

## All Needed Context

### Universal AI Tools Architecture (CRITICAL - Review these first)
```yaml
# MUST READ - Core architecture understanding
- file: CLAUDE.md
  why: Project-specific rules, service-oriented architecture, and development patterns
  
- file: src/services/context-injection-service.ts
  why: MANDATORY context injection for all LLM calls - includes security hardening and prompt injection protection
  
- file: src/services/intelligent-parameter-service.ts
  why: ML-based parameter optimization with 25+ task types and domain adjustments
  
- file: src/services/mlx-fine-tuning-service.ts
  why: Apple Silicon optimized model training integration
  
- file: supabase/migrations/001_consolidated_schema.sql
  why: Production database schema with RLS, vector embeddings, and multi-tenant patterns
```

### Service Integration Points
```yaml
# Core Services to Integrate With
- service: Context Injection Service
  file: src/services/context-injection-service.ts
  pattern: "await contextInjectionService.enrichWithContext(userRequest, projectContext)"
  security: "Includes prompt injection protection, sensitive data filtering, and user isolation"
  
- service: Intelligent Parameters
  file: src/services/intelligent-parameter-service.ts
  pattern: "intelligentParameterService.getTaskParameters(taskContext)"
  features: "25+ task types, complexity adjustment, domain-specific optimization"
  
- service: MLX Fine-Tuning
  file: src/services/mlx-fine-tuning-service.ts
  pattern: "Apple Silicon optimized model training with LoRA and full fine-tuning"
  
- service: Supabase Vault
  pattern: "await supabase.rpc('vault.read_secret', { secret_name: 'service_api_key' })"
  security: "ALL API keys stored in vault, never environment variables"
```

### Documentation & References
```yaml
# External Research - Advanced AI Platform Patterns
- research: Service-Oriented Architecture 2025 Patterns
  insight: "Microservices for AI with event-driven architecture, real-time processing"
  critical: "AI-enhanced SOA with intelligent decision-making and predictive analytics"
  
- research: MLX Apple Silicon Production Deployment
  insight: "Unified memory architecture, Metal GPU acceleration, LoRA fine-tuning"
  critical: "Prompt caching, rotating KV cache, 4-bit quantization for efficiency"
  
- research: Context Injection Security Patterns
  insight: "Multi-layered security: input validation, prompt templates, privilege control"
  critical: "Defense-in-depth approach with monitoring, semantic analysis, response format control"
```

### Current Service Architecture (Production-Ready Systems)
```bash
src/
├── services/               # Advanced AI Services (Production-Ready)
│   ├── context-injection-service.ts    # MANDATORY for all LLM calls - security hardened
│   ├── intelligent-parameter-service.ts # ML-based optimization with 25+ task types
│   ├── mlx-fine-tuning-service.ts      # Apple Silicon model training
│   ├── dspy-orchestrator/              # 10-agent cognitive reasoning chains
│   ├── ab-mcts-orchestrator.ts         # Probabilistic coordination
│   ├── fast-llm-coordinator.ts         # Multi-tier model routing
│   ├── alpha-evolve-service.ts         # Self-improvement system
│   └── supabase-client.ts              # Vault integration & database
├── agents/               # 6 Production-Ready Agents
│   ├── enhanced-base-agent.ts          # Base with LLM integration & AB-MCTS
│   ├── cognitive/                      # Strategic reasoning agents
│   └── specialized/                    # Domain-specific agents
├── routers/               # API Endpoints with Security
│   ├── mlx.ts            # MLX fine-tuning APIs
│   ├── vision.ts         # PyVision & SDXL APIs
│   ├── monitoring.ts     # Advanced metrics and health
│   └── ab-mcts.ts        # Probabilistic orchestration APIs
└── middleware/           # Production Security & Performance
    ├── context-injection-middleware.ts # Automatic context enrichment
    ├── intelligent-parameters.ts      # Dynamic parameter injection
    ├── sql-injection-protection.ts    # Security hardening
    └── rate-limiter-enhanced.ts       # Advanced rate limiting
```

### Target Architecture Integration
```bash
# New Advanced AI Service Integration Pattern
src/services/advanced-ai-integration-service.ts    # New service following platform patterns
src/routers/advanced-ai-integration.ts             # API endpoints with full middleware stack
supabase/migrations/004_advanced_ai_integration.sql # Database schema with RLS
src/middleware/advanced-ai-middleware.ts            # Service-specific middleware (optional)
```

### Known Patterns & Gotchas
```typescript
// CRITICAL: Universal AI Tools specific patterns

// 1. MANDATORY: All LLM calls must use context injection (SECURITY CRITICAL)
const { enrichedPrompt, contextSummary, sourcesUsed, securityWarnings } = 
  await contextInjectionService.enrichWithContext(
    userRequest,
    { userId, workingDirectory, currentProject, sessionId }
  );

// 2. Intelligent Parameter Automation (PERFORMANCE CRITICAL)
const taskContext = intelligentParameterService.createTaskContext(
  userInput, 
  TaskType.CODE_GENERATION, 
  { hasImage: false, language: 'typescript' },
  userPreferences
);
const optimizedParams = intelligentParameterService.getTaskParameters(taskContext);

// 3. Secrets MUST use Supabase Vault (SECURITY CRITICAL)
const apiKey = await getSecretFromVault('openai_api_key');
// NEVER: process.env.API_KEY

// 4. Enhanced Base Agent pattern for new agents
export class AdvancedAIAgent extends EnhancedBaseAgent {
  protected buildSystemPrompt(): string { 
    return `You are an advanced AI service agent with access to ${this.getAvailableCapabilities().join(', ')}`;
  }
  protected getInternalModelName(): string { 
    return 'ollama:llama3.2:3b'; // Use intelligent parameter service for optimization
  }
}

// 5. Service-oriented architecture - extend existing services
class AdvancedAIIntegrationService {
  constructor(
    private contextInjection: ContextInjectionService,
    private intelligentParams: IntelligentParameterService,
    private mlxService: MLXFineTuningService,
    private supabaseClient: SupabaseClient
  ) {}
  
  async processAdvancedRequest(request: AdvancedAIRequest): Promise<AdvancedAIResponse> {
    // 1. Security: Context injection with prompt protection
    const context = await this.contextInjection.enrichWithContext(request.prompt, request.context);
    
    // 2. Performance: Intelligent parameter optimization
    const params = this.intelligentParams.getTaskParameters(request.taskContext);
    
    // 3. Custom Models: MLX fine-tuning integration if needed
    const model = await this.getOptimalModel(request.requirements);
    
    // 4. Multi-tenant: Ensure user isolation
    return this.executeWithUserIsolation(request.userId, context, params, model);
  }
}
```

## Implementation Blueprint

### Data Models and Service Integration
Extend existing Supabase schema with new tables that integrate with the platform's sophisticated data architecture:

```sql
-- Extend existing database schema with advanced AI service tables
-- Following Universal AI Tools patterns from 001_consolidated_schema.sql

CREATE TABLE IF NOT EXISTS advanced_ai_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- References auth.users(id) with RLS
    service_type TEXT NOT NULL,
    configuration JSONB DEFAULT '{}'::jsonb,
    context_data JSONB DEFAULT '{}'::jsonb,
    performance_metrics JSONB DEFAULT '{}'::jsonb,
    mlx_model_id UUID, -- References mlx_fine_tuning_jobs(id)
    intelligent_params_id UUID, -- References intelligent_parameters(id)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_advanced_ai_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Vector embeddings for advanced AI processing
CREATE INDEX IF NOT EXISTS idx_advanced_ai_sessions_user ON advanced_ai_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_advanced_ai_sessions_type ON advanced_ai_sessions (service_type);
```

### Task List (Production-Ready Implementation Order)
```yaml
Task 1: Database Integration & Security
  CREATE: supabase/migrations/004_advanced_ai_integration.sql
  PATTERN: Follow RLS patterns from 001_consolidated_schema.sql
  INTEGRATE: With existing knowledge_sources, ai_memories, intelligent_parameters
  VALIDATE: Multi-tenant isolation, vector embeddings, performance indexes

Task 2: Core Service Implementation
  CREATE: src/services/advanced-ai-integration-service.ts
  PATTERN: Mirror existing service architecture with dependency injection
  INTEGRATE: contextInjectionService, intelligentParameterService, mlxService
  VALIDATE: Context injection security, parameter optimization, vault secrets

Task 3: API Router & Middleware
  CREATE: src/routers/advanced-ai-integration.ts
  PATTERN: Follow existing router patterns with full middleware stack
  INTEGRATE: auth.ts, rate-limiter-enhanced.ts, validation.ts
  VALIDATE: Security headers, SQL injection protection, request validation

Task 4: Agent Integration (Optional)
  EXTEND: src/agents/specialized/advanced-ai-integration-agent.ts
  PATTERN: Extend EnhancedBaseAgent with context-aware prompts
  INTEGRATE: AB-MCTS probabilistic coordination, DSPy orchestration
  VALIDATE: Memory integration, performance optimization, error handling

Task 5: MLX Fine-Tuning Integration
  EXTEND: Integration with existing mlx-fine-tuning-service.ts
  PATTERN: Custom model training for service-specific requirements
  INTEGRATE: Apple Silicon optimization, LoRA fine-tuning, model lifecycle
  VALIDATE: Training metrics, model deployment, inference optimization

Task 6: Monitoring & Analytics
  EXTEND: Integration with existing monitoring.ts router
  PATTERN: Advanced metrics collection and health monitoring
  INTEGRATE: Performance tracking, error reporting, usage analytics
  VALIDATE: Real-time dashboards, alerting, performance benchmarks
```

### Integration Points (Production Architecture)
```yaml
DATABASE:
  - migration: "supabase/migrations/004_advanced_ai_integration.sql"
  - pattern: "Row Level Security (RLS) with auth.users foreign keys"
  - indexes: "Vector embeddings, performance indexes, user isolation"
  
SERVICES:
  - context-injection: "MANDATORY enrichWithContext() for all LLM interactions"
  - intelligent-parameters: "ML-based optimization with task-specific tuning"
  - mlx-fine-tuning: "Apple Silicon model training integration"
  - supabase-vault: "Secure secrets management for all API keys"
  
API:
  - router: "src/routers/advanced-ai-integration.ts"
  - middleware: "Full stack: auth, rate-limiting, validation, security headers"
  - monitoring: "Health checks, metrics collection, performance tracking"
  
AGENTS:
  - base: "Extend EnhancedBaseAgent for new agent types"
  - orchestration: "DSPy cognitive chains with 10-agent reasoning"
  - coordination: "AB-MCTS probabilistic agent selection and learning"
```

## Validation Loop (Production Standards)

### Level 1: Syntax, Security & Architecture
```bash
# Run these FIRST - fix any errors before proceeding
npm run lint:fix              # ESLint with TypeScript rules - MUST pass
npm run build                 # TypeScript compilation check - MUST pass
npm run security:audit        # Security vulnerability scan - MUST pass

# Expected: No errors. If errors exist, systematically fix each one.
# Universal AI Tools has zero-tolerance for compilation errors.
```

### Level 2: Service Integration Tests
```typescript
// CREATE comprehensive test files following existing patterns
// Test integration with ALL core services:

describe('AdvancedAIIntegrationService', () => {
  test('MANDATORY: integrates with context injection service', async () => {
    const service = new AdvancedAIIntegrationService(...deps);
    const result = await service.processRequest({
      prompt: 'test request',
      context: { userId: 'test-user', workingDirectory: '/test' }
    });
    
    expect(result.contextSummary).toBeDefined();
    expect(result.sourcesUsed).toBeInstanceOf(Array);
    expect(result.securityWarnings).toBeUndefined(); // No security issues
  });
  
  test('uses intelligent parameter optimization', async () => {
    const taskContext = { type: TaskType.CODE_GENERATION, userInput: 'test' };
    const params = intelligentParameterService.getTaskParameters(taskContext);
    
    expect(params.temperature).toBeGreaterThan(0);
    expect(params.maxTokens).toBeGreaterThan(0);
    expect(params.contextLength).toBeGreaterThan(0);
  });
  
  test('follows service-oriented architecture patterns', async () => {
    // Verify dependency injection, error handling, circuit breakers
    const service = new AdvancedAIIntegrationService(...deps);
    expect(service).toHaveProperty('contextInjection');
    expect(service).toHaveProperty('intelligentParams');
    expect(service).toHaveProperty('mlxService');
  });

  test('SECURITY: uses Supabase vault for secrets', async () => {
    const secret = await getSecretFromVault('test_api_key');
    expect(secret).toBeDefined();
    expect(typeof secret).toBe('string');
  });
});
```

```bash
# Run comprehensive test suite:
npm test                      # Unit tests - MUST pass
npm run test:integration      # Integration tests - MUST pass
npm run test:performance      # Performance benchmarks - MUST meet standards
```

### Level 3: Production Deployment Test
```bash
# Start production-like environment
npm run build:prod           # Production build - MUST pass
npm start                    # Production server startup - MUST succeed

# Test API endpoints with production data
curl -X POST http://localhost:9999/api/v1/advanced-ai-integration/process \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Generate TypeScript code for user authentication",
    "context": {
      "userId": "test-user",
      "workingDirectory": "/Users/test/project",
      "taskType": "code_generation"
    }
  }'

# Expected: Production-ready response with:
# - Context enrichment applied
# - Intelligent parameters optimized
# - Security headers present
# - Performance metrics logged
```

### Level 4: Advanced AI Integration Test
```bash
# Test MLX integration capabilities
npm run mlx:test             # MLX framework integration - MUST succeed

# Test intelligent parameter analytics
npm run params:analytics     # Parameter performance tracking - MUST show data

# Test context injection security
# Monitor: Context relevance, security filtering, user isolation
npm run security:context-test

# Test DSPy cognitive orchestration integration
npm run dspy:orchestrate     # 10-agent reasoning chains - MUST coordinate

# Test AB-MCTS probabilistic coordination
npm run ab-mcts:demo         # Probabilistic agent selection - MUST optimize
```

## Final Production Checklist
- [ ] All tests pass: `npm test && npm run test:integration && npm run test:performance`
- [ ] No linting errors: `npm run lint:fix` (zero warnings/errors)
- [ ] TypeScript compilation clean: `npm run build` (zero errors)
- [ ] Security audit clean: `npm run security:audit` (zero vulnerabilities)
- [ ] Context injection integration verified (MANDATORY security requirement)
- [ ] Intelligent parameter optimization integrated and tested
- [ ] MLX fine-tuning integration functional (Apple Silicon optimized)
- [ ] Supabase vault secrets properly configured (NO environment variables)
- [ ] Service architecture patterns followed (dependency injection, error handling)
- [ ] Multi-tenant isolation with RLS implemented and tested
- [ ] Performance benchmarks met (sub-5s response times, efficient memory usage)
- [ ] DSPy cognitive orchestration integration verified
- [ ] AB-MCTS probabilistic coordination functional
- [ ] Monitoring and logging implemented (health checks, metrics, error tracking)
- [ ] Production deployment successful with zero downtime
- [ ] Documentation updated in CLAUDE.md (architecture consistency maintained)

---

## Advanced Architecture Anti-Patterns to Avoid (Universal AI Tools Specific)
- ❌ **Never bypass context injection service** - It's mandatory for security and includes prompt injection protection
- ❌ **Never store API keys in environment variables** - Use Supabase vault exclusively
- ❌ **Never create isolated services** - Integrate with existing sophisticated architecture
- ❌ **Never ignore intelligent parameter automation** - Reduces manual tuning by 80%
- ❌ **Never skip MLX optimization opportunities** - Apple Silicon performance gains
- ❌ **Never bypass AB-MCTS coordination** - Probabilistic optimization for agent selection
- ❌ **Never ignore DSPy orchestration** - 10-agent reasoning chains for complex tasks
- ❌ **Never skip RLS implementation** - Multi-tenant isolation is mandatory
- ❌ **Never ignore performance testing** - This is production infrastructure serving real users
- ❌ **Never implement without monitoring** - Comprehensive observability is required

## Production Architecture Score: 9/10

**Strengths:**
- Comprehensive integration with all Universal AI Tools sophisticated services
- Security-first approach with context injection and vault integration
- Performance optimization through intelligent parameters and MLX
- Multi-tenant isolation and production-grade error handling
- Extensive validation gates and testing requirements

**Areas for Enhancement:**
- Could benefit from more specific performance SLAs
- Additional edge case handling for distributed learning scenarios

This PRP provides a complete blueprint for implementing advanced AI features that leverage Universal AI Tools' sophisticated service-oriented architecture while maintaining the platform's high standards for security, performance, and production readiness.