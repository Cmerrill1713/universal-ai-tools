
name: "Universal AI Tools PRP Template v1 - Context-Rich Implementation for Advanced AI Systems"

description: |
## Purpose

Template optimized for Claude Code to implement advanced AI features in the Universal AI Tools platform with sufficient context and self-validation capabilities to achieve working production-ready code through iterative refinement.
## Core Principles

1. **Context is King**: Include ALL necessary documentation, examples, and architectural patterns

2. **Validation Loops**: Provide executable tests/lints Claude can run and fix

3. **Production-Ready**: Focus on scalable, secure, performant implementations

4. **Service-Oriented**: Leverage existing sophisticated services and infrastructure

5. **Global Rules**: Follow all rules in CLAUDE.md and maintain architectural consistency
---
## Goal

[What needs to be built - be specific about the end state and integration with existing advanced systems]
## Why

- [Business value and user impact for AI platform]

- [Integration with existing services (MLX, DSPy, Context Injection, etc.)]

- [Problems this solves in the advanced AI workflow]
## What

[User-visible behavior, API endpoints, and technical requirements]
### Success Criteria

- [ ] [Specific measurable outcomes for production deployment]

- [ ] [Integration with existing services validated]

- [ ] [Performance benchmarks met]
## All Needed Context
### Universal AI Tools Architecture (CRITICAL - Review these first)

```yaml
# MUST READ - Core architecture understanding

- file: CLAUDE.md

  why: Project-specific rules, architecture, and development patterns

  

- file: src/services/context-injection-service.ts

  why: Mandatory context injection for all LLM calls - security hardened

  

- file: src/agents/enhanced-base-agent.ts

  why: Base agent pattern with LLM integration and AB-MCTS

  

- file: src/services/llm-router-service.ts

  why: Multi-tier LLM routing (LFM2, Ollama, External APIs)

  

- file: supabase/migrations/002_comprehensive_knowledge_system.sql

  why: Database schema and knowledge management patterns

```
### Service Integration Points

```yaml
# Core Services to Integrate With

- service: Context Injection Service

  file: src/services/context-injection-service.ts

  pattern: "Must use contextInjectionService.enrichWithContext() for all LLM calls"

  

- service: MLX Fine-Tuning

  file: src/services/mlx-fine-tuning-service.ts

  pattern: "Apple Silicon optimized model training integration"

  

- service: Intelligent Parameters

  file: src/services/intelligent-parameter-service.ts

  pattern: "ML-based parameter optimization for LLM calls"

  

- service: Supabase Vault

  file: src/config/supabase.ts

  pattern: "ALL API keys stored in vault, never environment variables"

```
### Documentation & References

```yaml
# MUST READ - Include these in your context window

- url: [Official API docs URL]

  why: [Specific sections/methods you'll need]

  

- file: [path/to/existing/service.ts]

  why: [Service pattern to follow, integration points]

  

- doc: [Library documentation URL] 

  section: [Specific section about advanced usage]

  critical: [Key insight for production deployment]

```
### Current Service Architecture (Production-Ready Systems)

```bash

src/

├── services/               # Advanced AI Services

│   ├── context-injection-service.ts    # Mandatory for all LLM calls

│   ├── mlx-fine-tuning-service.ts      # Custom model training

│   ├── intelligent-parameter-service.ts # ML-based optimization

│   ├── dspy-orchestrator/              # 10-agent cognitive chains

│   └── ollama-supabase-bridge.ts       # Local LLM integration

├── scripts/                # Codebase Automation (v2.0)

│   ├── auto-organize-files.ts          # Automated file organization

│   └── cleanup-unused.ts               # Intelligent cleanup system

├── agents/                # 6 Production-Ready Agents

│   ├── enhanced-base-agent.ts          # Base with LLM integration

│   └── cognitive/                      # Strategic reasoning agents

├── routers/               # API Endpoints

│   ├── mlx.ts            # MLX fine-tuning APIs

│   ├── vision.ts         # PyVision & SDXL APIs

│   └── monitoring.ts     # Health and metrics

└── middleware/           # Security & Performance

    ├── context-injection-middleware.ts

    └── sql-injection-protection.ts

```
### Target Architecture Integration

```bash
# New files/services to be added

[Show where new code will fit in the sophisticated architecture]

```
### Known Patterns & Gotchas

```typescript

// CRITICAL: Universal AI Tools specific patterns
// 1. MANDATORY: All LLM calls must use context injection

const { enrichedPrompt, contextSummary } = await contextInjectionService.enrichWithContext(

  userRequest,

  { userId, workingDirectory, currentProject, sessionId }

);
// 2. Secrets MUST use Supabase Vault

const apiKey = await getSecretFromVault('service_name_api_key');

// NEVER: process.env.API_KEY
// 3. Enhanced Base Agent pattern for new agents

export class NewAgent extends EnhancedBaseAgent {

  protected buildSystemPrompt(): string { /* context-aware prompts */ }

  protected getInternalModelName(): string { /* model selection */ }

}
// 4. Service-oriented architecture - extend existing services

// Don't create isolated components, integrate with:

// - MLX for custom models

// - DSPy for cognitive orchestration  

// - Intelligent parameters for optimization

```
## Implementation Blueprint
### Data Models and Service Integration

Create models that integrate with existing Supabase schema and service architecture.
```typescript

// Extend existing database schema

// Use production patterns from supabase/migrations/

// Integrate with knowledge_sources, agent_performance_metrics, etc.

```
### Task List (Production-Ready Implementation Order)

```yaml

Task 1: Security & Context Integration

  MODIFY: Ensure new service uses contextInjectionService

  CREATE: Integration with existing security middleware

  VALIDATE: Security patterns match existing services
Task 2: Database Integration  

  EXTEND: supabase/migrations/003_new_feature.sql

  PATTERN: Follow existing RLS and indexing patterns

  INTEGRATE: With knowledge_sources and caching tables
Task 3: Service Implementation

  CREATE: src/services/new-feature-service.ts

  PATTERN: Mirror existing service architecture

  INTEGRATE: With MLX, DSPy, and parameter optimization
Task 4: API Endpoints

  CREATE: src/routers/new-feature.ts

  PATTERN: Follow existing router patterns with validation

  INTEGRATE: With monitoring and performance middleware
Task 5: Agent Integration (if applicable)

  EXTEND: Existing agents or create new EnhancedBaseAgent

  PATTERN: Use AB-MCTS probabilistic coordination

  INTEGRATE: With cognitive orchestration system

```
### Integration Points (Production Architecture)

```yaml

DATABASE:

  - migration: "supabase/migrations/003_feature_name.sql"

  - pattern: "Row Level Security (RLS) for multi-tenant isolation"

  - indexes: "Optimized for hybrid search and analytics"

  

SERVICES:

  - context-injection: "Mandatory for all LLM interactions"

  - mlx-fine-tuning: "Custom model training integration"

  - intelligent-parameters: "Automatic parameter optimization"

  

API:

  - router: "src/routers/feature-name.ts"

  - middleware: "Security, validation, and performance"

  - monitoring: "Health checks and metrics collection"

  

AGENTS:

  - base: "Extend EnhancedBaseAgent for new agent types"

  - orchestration: "Integrate with DSPy cognitive chains"

  - coordination: "AB-MCTS probabilistic agent selection"

```
## Validation Loop (Production Standards)
### Level 1: Syntax, Security & Architecture

```bash
# Run these FIRST - fix any errors before proceeding

npm run lint:fix              # ESLint with TypeScript rules

npm run build                 # TypeScript compilation check

npm run security:audit        # Security vulnerability scan

# NEW: Automated codebase management (v2.0)

npm run organize:files:check   # Preview file organization

npm run cleanup:unused:check   # Preview cleanup operations

npm run organize:files         # Execute file organization

npm run cleanup:unused         # Execute safe cleanup

# Expected: No errors. If errors, READ and fix systematically.

```
### Level 2: Service Integration Tests

```typescript

// CREATE test files following existing patterns

// Test integration with core services:
describe('NewFeatureService', () => {

  test('integrates with context injection service', async () => {

    // Test mandatory context enrichment

  });

  

  test('uses Supabase vault for secrets', async () => {

    // Verify secure secret retrieval

  });

  

  test('follows service-oriented patterns', async () => {

    // Validate architecture compliance

  });

});

```
```bash
# Run comprehensive test suite:

npm test                      # Unit tests

npm run test:integration      # Integration tests

npm run test:performance      # Performance benchmarks

```
### Level 3: Production Deployment Test

```bash
# Start production-like environment

npm run build:prod

npm start

# Test API endpoints with production data

curl -X POST http://localhost:9999/api/v1/new-feature \

  -H "Authorization: Bearer $JWT_TOKEN" \

  -H "Content-Type: application/json" \

  -d '{"test": "production_data"}'

# Expected: Production-ready response with proper logging
# Check: logs/combined.log for detailed execution traces

```
### Level 4: Advanced AI Integration Test

```bash
# Test MLX integration (if applicable)

npm run mlx:test

# Test intelligent parameter optimization

npm run params:analytics

# Test context injection effectiveness
# Monitor: Context relevance and user satisfaction metrics

```
## Final Production Checklist

- [ ] All tests pass: `npm test && npm run test:integration`

- [ ] No linting errors: `npm run lint`

- [ ] TypeScript compilation clean: `npm run build`

- [ ] Security audit clean: `npm run security:audit`

- [ ] Context injection integration verified

- [ ] Supabase vault secrets properly configured

- [ ] Service architecture patterns followed

- [ ] Performance benchmarks met

- [ ] Monitoring and logging implemented

- [ ] Documentation updated in CLAUDE.md

- [ ] Production deployment successful
---
## Advanced Architecture Anti-Patterns to Avoid

- ❌ Don't bypass context injection service - it's mandatory for security

- ❌ Don't store API keys in environment variables - use Supabase vault

- ❌ Don't create isolated services - integrate with existing architecture

- ❌ Don't ignore existing patterns - follow service-oriented design

- ❌ Don't skip performance testing - this is production infrastructure

- ❌ Don't implement without AB-MCTS integration for agent coordination

- ❌ Don't forget MLX optimization opportunities for custom models

- ❌ Don't bypass intelligent parameter automation

- ❌ Don't ignore the sophisticated monitoring and analytics systems