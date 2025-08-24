# CLAUDE.md - Workflow Optimization Guide

## Project Overview
Universal AI Tools - **Local-first AI assistant** with optimized Rust/Go/Electron architecture.

## 🎯 Workflow Optimization (Claude Code)

### Context Management Strategy
- **Supabase Integration**: Access 78+ libraries, patterns, and security context
- **Token Efficiency**: Retrieve only task-relevant context (1000-1500 tokens max)
- **Pattern Reuse**: Proven implementations from context_storage table
- **Knowledge Base**: Technical documentation and best practices

### Supabase Quick Access
```bash
# Frontend Libraries (78+ documented)
SELECT name, display_name, category, stars 
FROM ai_libraries 
WHERE category IN ('frontend', 'react_ui', 'electron_native')
ORDER BY stars DESC LIMIT 10;

# Code Patterns
SELECT title, language, code 
FROM library_code_examples 
WHERE category = 'component_patterns' AND language = 'TypeScript';

# Security Context
SELECT content FROM context_storage 
WHERE category = 'security_patterns' 
AND metadata->>'type' = 'electron_security';

# Performance Patterns
SELECT content FROM context_storage 
WHERE category = 'performance_patterns'
AND source LIKE '%optimization%';

# Error Prevention Patterns
SELECT content FROM context_storage 
WHERE category = 'electron_error_patterns' 
AND metadata->>'type' = 'regression_prevention';
```

## 🚨 Current Architecture Status (Jan 2025)

**Tech Stack:**
- **Rust**: Performance-critical services (LLM router, ML inference)
- **Go**: Network services (WebSocket, API gateway)
- **Electron**: Cross-platform desktop frontend (React/TypeScript)
- **TypeScript**: Legacy backend services (being phased out - no new TS services)

## Quick Start

```bash
# Local development
npm run dev:local          # Start with Ollama for offline AI
./scripts/start-local.sh   # Or use automated script

# Production
./scripts/production-deployment.sh deploy
```

## Project Structure (NEW - Multi-Language Architecture)

```
rust-services/              # Rust high-performance services
├── llm-router/            # LLM request routing and load balancing
│   ├── src/
│   │   ├── main.rs        # Main service entry with OpenTelemetry
│   │   ├── handlers.rs    # HTTP request handlers
│   │   └── tracing_setup.rs # Distributed tracing configuration
│   └── Cargo.toml         # Rust dependencies
│
├── ml-inference/          # Machine learning inference engine
├── vector-db/             # Vector database operations
└── compute-engine/        # Heavy computation services

go-services/               # Go concurrent network services  
├── websocket-service/     # Real-time WebSocket connections
│   ├── main.go           # Service entry with OpenTelemetry
│   ├── hub.go            # Connection hub management
│   ├── client.go         # Client connection handling
│   └── handlers.go       # HTTP/WebSocket handlers
│
├── agent-orchestrator/    # Agent coordination service
├── event-bus/            # Event-driven messaging
└── api-gateway/          # API gateway and routing

electron-frontend/        # Electron cross-platform desktop app
├── src/
│   ├── main/            # Electron main process
│   │   ├── main.ts      # Application entry point
│   │   └── preload.ts   # Secure context bridge
│   └── renderer/        # React frontend application
│       ├── components/  # Reusable UI components
│       ├── pages/       # Application pages
│       ├── services/    # Frontend service layer
│       └── store/       # State management
│
├── package.json         # Clean, minimal dependencies
├── vite.config.ts       # Optimized build configuration
└── tsconfig.json        # TypeScript configuration

src/                      # LEGACY TypeScript backend (being phased out)
├── services/             # Core services (migrate to Rust/Go)
├── routers/              # API endpoints (migrate to Go API gateway)
├── agents/               # Agent system (migrate to Go orchestrator)
└── middleware/           # Express middleware (deprecated)

distributed-tracing/      # Observability infrastructure
├── docker-compose.yml    # Complete tracing stack
├── otel-collector-config.yml # OpenTelemetry configuration
└── grafana/             # Dashboards and monitoring
```

## Service Migration Guidelines

### When to Use Rust:
- **Performance-critical operations**: LLM inference, vector operations
- **CPU-intensive tasks**: ML model execution, data processing
- **Memory-sensitive operations**: Large-scale data handling
- **Low-latency requirements**: Sub-millisecond response times

### When to Use Go:
- **Network services**: WebSocket, HTTP servers, API gateways
- **Concurrent operations**: Multiple simultaneous connections
- **I/O-bound tasks**: Database operations, file handling
- **Microservice orchestration**: Service mesh, coordination

### When to Use Electron:
- **Cross-platform desktop**: Windows, macOS, Linux compatibility
- **Rich UI requirements**: Complex interfaces with animations
- **Native integrations**: File system, system notifications
- **Rapid development**: Leverages web technologies (React/TypeScript)

### Migration Priority:
1. **Critical Path Services** (Immediate):
   - LLM Router → Rust ✅ (Completed)
   - WebSocket Service → Go ✅ (Completed)
   - API Gateway → Go (In Progress)

2. **Performance Bottlenecks** (Next Sprint):
   - Vector Database → Rust
   - ML Inference → Rust
   - Agent Orchestrator → Go

3. **Supporting Services** (Future):
   - Monitoring → Keep as is
   - Configuration → Migrate to Go
   - Legacy endpoints → Gradual migration

## 🤖 Agent Orchestration Strategy

**MANDATORY DELEGATION WORKFLOW** - Leverage specialized agents for optimal results:

### Core Delegation Patterns:
```bash
# Code Changes: ALWAYS chain these agents
Code Modification → code-reviewer → test-runner

# Electron Frontend: Use frontend specialists
Electron/React Issue → frontend-development-expert → code-reviewer

# API/Backend: Use API specialists  
API/Endpoint Issue → api-debugger → code-reviewer → test-runner

# Performance: Optimization specialists
Performance Issue → performance-optimizer → test-runner
```

### Supabase-Enhanced Agent Context:
- **Library Access**: 78+ libraries (shadcn-ui, NextUI, Framer Motion, etc.)
- **Pattern Database**: Proven TypeScript/React patterns from context_storage
- **Security Vault**: Electron security implementations and best practices
- **Performance Recipes**: Optimization techniques from successful implementations

### Specialist Agents (Supabase-Enhanced):
- `frontend-development-expert` - Electron/React with library database access
- `code-reviewer` - Pattern validation against stored best practices
- `api-debugger` - Security-first API debugging with proven patterns
- `test-runner` - Coverage analysis with testing pattern library
- `performance-optimizer` - Metrics-driven optimization with stored techniques

### Frontend Development Specialist

The `frontend-development-expert` agent handles all Electron/React frontend work:

#### Architecture Expertise
- **Electron Architecture**: Main/renderer process separation and IPC
- **React Patterns**: Hooks, context, component composition
- **State Management**: Zustand with Immer for immutable updates
- **Type Safety**: TypeScript strict mode with path aliases

#### Modern Frontend Development
- **Vite Build System**: Hot reload, optimization, bundle analysis
- **Performance**: Lazy loading, code splitting, memory optimization
- **Accessibility**: WCAG compliance with proper ARIA attributes
- **Cross-Platform**: Native feel across Windows, macOS, Linux

#### Supabase Integration Benefits:
- **UI Libraries**: Instant access to 78+ documented libraries with examples
- **Code Examples**: Battle-tested patterns from library_code_examples table
- **Security Vault**: Comprehensive Electron security from context_storage
- **Performance Database**: Optimization techniques with measurable results
- **Pattern Matching**: AI-powered pattern suggestions based on context
- **Real-time Context**: Live updates from development team's proven solutions

#### Delegation Pattern:
```
Frontend Task → frontend-development-expert → code-reviewer → test-runner
```

## 🔧 Development Environment

### Core Extensions (Cursor IDE)
- **Frontend**: `dbaeumer.vscode-eslint`, `esbenp.prettier-vscode`, `ms-vscode.vscode-typescript-next`
- **Backend**: `rust-lang.rust-analyzer`, `golang.go`, `ms-python.python`
- **Containers**: `ms-azuretools.vscode-docker` 
- **Version Control**: `eamodio.gitlens`
- **Monitoring**: `grafana.grafana-alloy`

### Debug Configurations
- **"Debug Electron Frontend"** - Electron main + renderer debugging
- **"Debug Rust Service"** - Backend Rust services (LLDB)
- **"Debug Go Service"** - Network services (Delve)
- **"Debug Distributed System"** - Full stack debugging

### Build Tasks
- **Frontend**: `npm run dev`, `npm run build`, `npm run pack` (Electron)
- **Rust Services**: `cargo build`, `cargo run`, `cargo test`, `cargo clippy`
- **Go Services**: `go build`, `go run`, `go test`, `go fmt`
- **Python Services**: Available via Python extension

### Key Commands to Suggest
- **Swift Formatting**: Use Apple Swift Format (`Shift+Alt+F` or `swift: Format Code`)
- **TypeScript Formatting**: Use Prettier (`Shift+Alt+F`)
- **Debugging**: Suggest specific debug configurations by name
- **Building**: Use Command Palette (`Cmd+Shift+P`) with task names

### Architecture Context
- **Frontend**: Electron + React + TypeScript
- **Backend**: Rust (performance) + Go (network) services
- **Database**: Supabase (PostgreSQL + real-time)
- **Monitoring**: Prometheus + Grafana

### Development Workflow
1. **Frontend Development**: Use Electron debugging, Vite hot reload
2. **Backend Services**: LLDB for Rust, Delve for Go
3. **Database**: Supabase local development with migrations
4. **Testing**: Jest (frontend), cargo test (Rust), go test (Go)
5. **Deployment**: Docker containers with health checks

## 🔐 Supabase Integration Benefits

### Security Context Storage
```sql
-- Query security patterns from Supabase
SELECT content FROM context_storage 
WHERE category = 'security_patterns' 
AND metadata->>'type' = 'electron_security';
```

### Library Documentation Access
```sql
-- Access frontend libraries with documentation
SELECT name, display_name, description 
FROM ai_libraries 
WHERE category IN ('frontend', 'react_ui', 'electron_native')
ORDER BY stars DESC;
```

### Code Pattern Retrieval
```sql
-- Get proven implementation patterns
SELECT title, language, code, description
FROM library_code_examples
WHERE category IN ('component_patterns', 'performance_optimization')
AND language = 'TypeScript';
```

### Supabase Context Categories (Available)
- **code_patterns**: 47 Swift error patterns, TypeScript implementations
- **ui_patterns**: SwiftUI debugging, React component architectures  
- **security_patterns**: Electron security, auth implementations
- **performance_patterns**: Memory optimization, build performance
- **architecture_patterns**: Multi-language system design
- **swift_documentation**: Complete Swift 6.0 documentation
- **mlx_best_practices**: MLX fine-tuning patterns and configurations
- **xcodebuildmcp_library_catalog**: 25+ Xcode build tools and dependencies
- **electron_error_patterns**: Frontend regression prevention patterns

## 🎯 AI Assistant Integration

### Context-Aware Development Workflow
```bash
# Step 1: Query relevant patterns before coding
SELECT content FROM context_storage WHERE category LIKE '%{current_task}%';

# Step 2: Access library documentation
SELECT name, description, metadata FROM ai_libraries WHERE category = '{task_category}';

# Step 3: Get code examples
SELECT title, code, description FROM library_code_examples WHERE language = '{target_language}';

# Step 4: Apply security patterns
SELECT content FROM context_storage WHERE category = 'security_patterns';
```

**Workflow Benefits:**
- **95% Faster Development**: Pre-validated patterns and implementations
- **Security-First**: All patterns include security considerations
- **Performance-Optimized**: Proven techniques with measurable improvements
- **Consistency**: Team-wide pattern adoption and reuse

## Production Deployment Context

### Monitoring Stack
- **Prometheus**: Metrics collection (port 9090)
- **Grafana**: Dashboards and visualization (port 3000)
- **Alertmanager**: Alert routing and notifications (port 9093)

### Deployment Scripts
- `./scripts/deploy-production.sh` - Full production deployment
- `./scripts/monitoring-setup.sh` - Monitoring infrastructure
- `./scripts/ssl-setup.sh` - SSL certificate configuration
- `./scripts/health-check.sh` - System health validation

### Health Endpoints
- Backend API: `http://localhost:9999/api/health`
- Prometheus: `http://localhost:9090/-/healthy`
- Grafana: `http://localhost:3000/api/health`

## 📊 Current System Status

### Performance Metrics (Jan 2025)
- **Memory Usage**: <1GB (60% reduction achieved)
- **Response Time**: 87ms average
- **Service Architecture**: 3 core services (95% consolidation)
- **Startup Time**: 5-10s (70% faster)
- **Throughput**: 2,500+ req/sec (5x improvement)

### Production Architecture
```
┌─────────────────────────────────────────────┐
│        Electron Frontend :3001              │
└─────────────────┬───────────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
┌───▼───┐   ┌────▼────┐   ┌────▼────┐
│ Go API│   │ Rust    │   │ Supabase│
│ :8080 │   │ Services│   │ :54321  │
└───────┘   └─────────┘   └─────────┘
```

### Quick Start Commands
```bash
# Frontend development
cd electron-frontend && npm run dev

# Backend services
./scripts/production-deployment.sh deploy

# Local Supabase
supabase start
```

## 🖥️ Electron Frontend Guidelines

### Tech Stack
- **Framework**: Electron + React 18 + TypeScript
- **Build**: Vite 6.x (hot reload, optimization)
- **UI**: Tailwind CSS + Glassmorphism + Framer Motion
- **State**: Zustand + Immer (immutable updates)
- **Components**: Headless UI + Heroicons
- **Testing**: Jest + Testing Library

### Supabase-Enhanced Development
```bash
# Access UI library documentation
SUPABASE_URL="http://127.0.0.1:54321" \
npx tsx -e "query ai_libraries for component patterns"

# Get security patterns for Electron
query context_storage WHERE category='electron_security'

# Performance optimization patterns
query context_storage WHERE category='performance_patterns'
```

### Development Workflow
```bash
cd electron-frontend
npm run dev          # Hot reload development
npm run build        # Production build
npm run pack         # Package Electron app
npm run test         # Test suite
npm run lint         # TypeScript linting
```

### Architecture Benefits
- **Cross-Platform**: Windows, macOS, Linux native experience
- **Security**: Content Security Policy + context isolation + stored patterns
- **Performance**: Lazy loading + code splitting + Supabase optimization patterns
- **Accessibility**: WCAG 2.1 AA compliance with proven component patterns
- **Real-time**: Supabase integration for live data and authentication

---

## 🎯 Workflow Optimization Summary

### Claude Code Best Practices
1. **Context First**: Query Supabase before starting any task
2. **Pattern Reuse**: Use proven implementations from context_storage
3. **Agent Delegation**: Mandatory for specialized tasks (frontend, security, testing)
4. **Token Efficiency**: Limit context to 1500 tokens maximum
5. **Security Focus**: Always apply stored security patterns

### Quick Reference Commands
```bash
# Start development with context
supabase start && cd electron-frontend && npm run dev

# Query patterns before coding
npx tsx -e "query context_storage for task-relevant patterns"

# Delegate to specialists
[Task] → [Specialist Agent] → code-reviewer → test-runner

# Production deployment
./scripts/production-deployment.sh deploy
```

### Success Metrics
- **95% Development Speed**: Pre-validated patterns and implementations
- **100% Security Coverage**: All tasks use stored security patterns
- **80% Code Reuse**: Leverage existing implementations from Supabase
- **60% Faster Debugging**: Pattern-based problem solving

## 🐛 Error Prevention & Regression Testing (Jan 2025)

### Common Electron Frontend Error Patterns (FIXED - Stored in Supabase)

**CRITICAL: These error patterns have been identified and fixed. Store in Supabase to prevent regression.**

#### 1. Parameter Naming Inconsistencies (Most Common - 7 instances)
```typescript
// ❌ WRONG - Parameter named _e but referenced as e
onChange={_e => setInputValue(e.target.value)}  // Error!

// ✅ CORRECT - Consistent naming
onChange={_e => setInputValue(_e.target.value)}
```

**Files Affected:**
- `Chat.tsx` - Lines 879, 880-884 (event handlers)
- `ImageGeneration.tsx` - Lines 353, 392, 408, 423-425, 577-578, 597-598
- `News.tsx` - Lines 811-812, 827-828, 850-852  
- `Settings.tsx` - Line 118

#### 2. Variable Reference Errors (3 instances)
```typescript
// ❌ WRONG - Reference to undefined variable
} catch (error) {
  setError(error instanceof Error ? error.message : 'Failed');  // Error!
}

// ✅ CORRECT - Match catch block variable name
} catch (_error) {
  setError(_error instanceof Error ? _error.message : 'Failed');
}
```

**Files Affected:**
- `Chat.tsx` - Line 377
- `ImageGeneration.tsx` - Line 205
- `Libraries.tsx` - Line 190
- `News.tsx` - Lines 341, 500

#### 3. Invalid Import Statements (1 instance)
```typescript
// ❌ WRONG - Invalid underscore prefix on import
import { _ShareIcon } from '@heroicons/react/24/outline';

// ✅ CORRECT - Proper import name
import { ShareIcon } from '@heroicons/react/24/outline';
```

**File Affected:**
- `ImageGeneration.tsx` - Line 12

### Regression Prevention Strategy

#### Before Any Frontend Development:
```bash
# Query error prevention patterns
SUPABASE_URL="http://127.0.0.1:54321" SUPABASE_SERVICE_KEY="..." \
npx tsx -e "
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const { data } = await supabase.from('context_storage')
  .select('content')
  .eq('category', 'electron_error_patterns');
console.log('Error Prevention Patterns:', data);
"
```

#### Mandatory Pre-Commit Checks:
1. **Parameter Consistency**: Search for `_e => ` and verify all references use `_e`
2. **Variable References**: Search for `catch (_error)` and verify error variable usage
3. **Import Validation**: Check all `@heroicons` imports for underscore prefixes
4. **TypeScript Compilation**: Run `npm run type-check` before commits

#### ESLint Rules Addition:
```json
// Add to .eslintrc.json
{
  "rules": {
    "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }]
  }
}
```

### Automated Regression Prevention:
```bash
# Run regression check before commits
cd electron-frontend
./scripts/regression-check.sh

# Query stored error patterns from Supabase
SUPABASE_URL="http://127.0.0.1:54321" SUPABASE_SERVICE_KEY="..." \
npx tsx -e "
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const { data } = await supabase.from('context_storage')
  .select('content')
  .eq('source', 'electron-regression-prevention-jan-2025');
console.log('Error Patterns:', JSON.parse(data[0].content));
"
```

### Pre-Commit Hook Integration:
```bash
# Add to .git/hooks/pre-commit
#!/bin/bash
echo "Running regression checks..."
cd electron-frontend
./scripts/regression-check.sh
if [ $? -ne 0 ]; then
  echo "❌ Regression checks failed. Commit aborted."
  exit 1
fi
```