# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Universal AI Tools is a **next-generation AI platform** featuring advanced service-oriented architecture, MLX fine-tuning capabilities, intelligent parameter automation, and distributed learning systems. This is a production-ready platform with sophisticated AI orchestration, not a simple collection of individual agents.

## Advanced Architecture Status (Updated 2025-07-26)

**🚀 Sophisticated Systems Implemented:**

- ✅ **MLX Fine-Tuning Framework** - Custom model training and optimization
- ✅ **Intelligent Parameter Automation** - Self-optimizing AI systems with ML-based parameter selection
- ✅ **AB-MCTS Orchestration** - Probabilistic learning and advanced coordination
- ✅ **Multi-Tier LLM Architecture** - Efficient model routing (LFM2, Ollama, External APIs)
- ✅ **PyVision Integration** - Advanced image processing with SDXL refiner support
- ✅ **DSPy Cognitive Orchestration** - 10-agent reasoning chains with internal LLM relay
- ✅ **Distributed Learning Systems** - Feedback loops, performance optimization, and analytics
- ✅ **Production Infrastructure** - Health monitoring, resource management, and auto-scaling
- ✅ **Supabase Vault Integration** - Secure secrets management for all API keys and sensitive data
- ✅ **Enterprise Security Implementation** - Comprehensive security remediation completed and verified

**✅ All Critical Systems Operational:**

- Server starts successfully with graceful fallbacks
- All TypeScript compilation errors resolved
- Production-ready authentication and security
- Comprehensive API coverage with intelligent routing
- Advanced error handling and recovery systems
- **SECURITY VERIFIED:** All 200+ vulnerabilities remediated with enterprise-grade measures

## Critical Development Commands

```bash
# Primary Development
npm run dev                 # Start dev server with tsx watch and auto-reload
npm start                   # Production server startup with health checks
npm run build              # Clean build with TypeScript compilation
npm run build:prod         # Production build with optimization

# MLX & Fine-Tuning
npm run mlx:setup           # Initialize MLX framework
npm run mlx:fine-tune       # Start model fine-tuning process
npm run mlx:test            # Test MLX integration

# Intelligent Parameters
npm run params:optimize     # Run parameter optimization
npm run params:analytics    # View parameter performance analytics
npm run params:cache        # Manage distributed parameter cache

# Vision & Image Processing
npm run vision:test         # Test PyVision integration
npm run vision:refine       # Test SDXL refiner capabilities
npm run vision:batch        # Test batch processing

# Code Quality & Testing
npm run lint:fix           # ESLint autofix with TypeScript rules
npm run format             # Prettier formatting
npm test                   # Comprehensive test suite
npm run test:integration   # Integration tests with all services
npm run test:performance   # Performance benchmarking

# Database & Infrastructure
npm run migrate            # Run Supabase migrations
npm run redis:test         # Test Redis integration
npm run supabase:start     # Start local Supabase
npm run health:check       # Check all service health

# Advanced Features
npm run ab-mcts:demo       # Demonstrate AB-MCTS orchestration
npm run dspy:orchestrate   # Test DSPy cognitive chains
npm run feedback:collect   # Run feedback collection system
```

## Advanced Architecture & Key Components

### Service-Oriented Architecture

```
src/
├── services/               # Advanced AI Services (Production-Ready)
│   ├── dspy-orchestrator/  # 10-agent cognitive reasoning chains
│   ├── mlx-fine-tuning-service.ts    # Custom model training
│   ├── intelligent-parameter-service.ts # ML-based parameter optimization
│   ├── ab-mcts-orchestrator.ts       # Probabilistic learning system
│   ├── fast-llm-coordinator.ts       # Multi-tier model routing
│   ├── pyvision-bridge.ts            # Advanced image processing
│   ├── vision-resource-manager.ts    # GPU/VRAM optimization
│   ├── alpha-evolve-service.ts       # Self-improvement system
│   ├── feedback-collector.ts         # Learning optimization
│   └── parameter-analytics-service.ts # Performance tracking
├── routers/               # Advanced API Endpoints
│   ├── mlx.ts            # MLX fine-tuning APIs
│   ├── mlx-fine-tuning.ts # Model customization endpoints
│   ├── ab-mcts.ts        # Probabilistic orchestration APIs
│   ├── vision.ts         # PyVision & SDXL refiner APIs
│   ├── fast-coordinator.ts # Multi-tier LLM routing
│   ├── monitoring.ts     # Advanced metrics and health
│   └── huggingface.ts    # External model integration
├── agents/               # Enhanced Agent System (6 Core Agents)
│   ├── cognitive/        # Strategic reasoning agents
│   ├── personal/         # Personal AI assistant capabilities
│   └── specialized/      # Domain-specific agents
├── middleware/           # Production Middleware
│   ├── intelligent-parameters.ts # Dynamic parameter injection
│   ├── rate-limiter-enhanced.ts  # Advanced rate limiting
│   └── auth.ts          # JWT + API key authentication
└── utils/               # Advanced Utilities
    ├── bayesian-model.ts         # Bayesian optimization
    ├── thompson-sampling.ts      # Multi-armed bandit algorithms
    ├── circuit-breaker.ts        # Resilience patterns
    └── validation.ts             # Comprehensive validation
```

### Production-Ready Systems

**🧠 Cognitive Orchestration:**
- **DSPy Orchestrator**: 10-agent reasoning chains (user intent, devils advocate, ethics, planner, resource manager, synthesizer, executor, reflector, validator, reporter)
- **AB-MCTS Service**: Probabilistic coordination with Bayesian optimization
- **Agent Registry**: Dynamic agent loading with A2A communication mesh
- **Enhanced Base Agents**: Production-ready with memory integration and LLM connectivity

**🎯 MLX Integration & Fine-Tuning:**
- **MLX Framework**: Apple Silicon optimized model training
- **Fine-Tuning Service**: Custom model creation and optimization
- **Model Lifecycle Management**: Automated training, evaluation, and deployment
- **Parameter Analytics**: ML-based performance tracking and optimization

**🤖 Intelligent Parameter Automation:**
- **Automatic Parameter Selection**: ML-based optimization for all LLM calls
- **Performance Learning**: Continuous improvement through feedback loops
- **Distributed Caching**: Redis-based parameter cache with multi-tenant isolation
- **Analytics Dashboard**: Real-time parameter effectiveness tracking

**👁️ Advanced Vision Capabilities:**
- **PyVision Bridge**: Python-TypeScript integration for image processing
- **SDXL Refiner**: High-quality image enhancement with MLX optimization
- **Resource Management**: GPU/VRAM optimization for 24GB hardware
- **Batch Processing**: Efficient multi-image processing pipelines

**🔧 Multi-Tier LLM Architecture:**
- **Fast Coordinator**: Intelligent routing between LFM2, Ollama, external APIs
- **Tier-Based Processing**: Small models for routing, large models for complex tasks
- **Automatic Fallbacks**: Graceful degradation with backup services
- **Performance Optimization**: Dynamic model selection based on task complexity

## API Structure (Production-Ready)

```
Base URL: http://localhost:9999

Authentication:
- JWT: Bearer token in Authorization header
- API Key: X-API-Key header + X-AI-Service header
- Multi-tenant support with resource isolation

Core APIs:
/api/v1/mlx/*              # MLX fine-tuning and model management
/api/v1/vision/*           # PyVision & SDXL refiner capabilities
/api/v1/ab-mcts/*          # Probabilistic orchestration
/api/v1/parameters/*       # Intelligent parameter automation
/api/v1/fast-coordinator/* # Multi-tier LLM routing
/api/v1/feedback/*         # Learning and optimization
/api/v1/monitoring/*       # Advanced metrics and health

Enhanced APIs:
/api/v1/agents/*           # Enhanced agent system
/api/v1/auth/*             # Authentication and authorization
/api/v1/huggingface/*      # External model integration
/api/v1/memory/*           # Vector memory management
/api/v1/orchestration/*    # DSPy cognitive orchestration
```

## Advanced Capabilities

### 1. MLX Fine-Tuning System
```typescript
// Custom model training with MLX
const fineTuningJob = await mlxService.createFineTuningJob({
  baseModel: 'llama3.2:3b',
  trainingData: trainingDataset,
  optimization: 'lora',
  epochs: 10,
  learningRate: 0.0001
});
```

### 2. Intelligent Parameter Automation
```typescript
// Automatic parameter optimization
const optimizedParams = await intelligentParameterService.getOptimalParameters({
  model: 'ollama:llama3.2:3b',
  taskType: 'code_generation',
  userContext: context,
  performanceGoals: ['accuracy', 'speed']
});
```

### 3. AB-MCTS Orchestration
```typescript
// Probabilistic agent coordination
const orchestrationResult = await abMctsService.orchestrate({
  task: 'complex_analysis',
  agents: ['planner', 'devils_advocate', 'synthesizer'],
  explorationRate: 0.3,
  maxIterations: 100
});
```

### 4. PyVision & SDXL Integration
```typescript
// Advanced image processing
const refinedImage = await pyVisionBridge.refineImage(imageBuffer, {
  strength: 0.3,
  steps: 20,
  backend: 'mlx',
  guidance: 7.5
});
```

## Working with the Enhanced Agent System

### Current Agent Architecture

**6 Production-Ready Agents:**
- `enhanced-planner-agent` - Strategic planning with JSON-structured responses
- `enhanced-retriever-agent` - Information research and context gathering
- `enhanced-synthesizer-agent` - Information synthesis and consensus building
- `enhanced-personal-assistant-agent` - Personal AI with conversational capabilities
- `enhanced-code-assistant-agent` - Code generation, review, and development
- `multi-tier-planner-agent` - Advanced multi-tier LLM planning

**DSPy Cognitive Orchestration (10 Specialized Functions):**
- User Intent Analysis, Devils Advocate, Ethics Check, Strategic Planning
- Resource Management, Synthesis, Execution, Reflection, Validation, Reporting

### Agent Capabilities

All enhanced agents feature:
- **Structured JSON Responses**: Consistent, parseable outputs
- **Context-Aware Prompting**: Dynamic system prompts based on task context
- **Confidence Calculation**: ML-based confidence scoring
- **Memory Integration**: Vector-based memory with Supabase storage
- **Performance Optimization**: Temperature and token limit optimization
- **Error Handling**: Comprehensive error recovery and fallbacks

## Database Schema (Production)

Uses Supabase (PostgreSQL) with comprehensive migrations:

**Core Tables:**
- `ai_memories` - Vector-based memory storage with embeddings
- `ai_service_keys` - API authentication and rate limiting
- `agent_performance_metrics` - Real-time performance tracking
- `self_improvement_logs` - System learning and evolution logs
- `mlx_fine_tuning_jobs` - Model training job management
- `parameter_analytics` - Intelligent parameter performance data
- `vision_processing_jobs` - Image processing task tracking

## Development Workflow

### 1. **System Architecture Understanding**
- This is a **service-oriented architecture**, not individual agents
- Services communicate through well-defined APIs and message queues
- All systems have production-ready error handling and fallbacks
- Advanced features like MLX and intelligent parameters are fully integrated

### 2. **Adding New Features**
- Extend existing services rather than creating new agents
- Use the intelligent parameter system for automatic optimization
- Leverage MLX for any custom model requirements
- Integrate with the feedback collection system for continuous improvement

### 3. **Testing & Validation**
- Use comprehensive test suites with performance benchmarking
- Test all fallback scenarios and error conditions
- Validate with production-like data and load patterns
- Monitor parameter effectiveness and system performance

### 4. **Critical Security Pattern: Supabase Vault for Secrets**
- **ALWAYS** use Supabase Vault for storing API keys, never environment variables
- **NEVER** commit API keys to code or configuration files
- **RETRIEVE** secrets at runtime using the vault service
- **FOLLOW** the migration pattern when updating existing services
- **MAINTAIN** consistent naming: `service_name_api_key` format
- **DOCUMENT** which secrets each service requires in its comments

## Secrets Management with Supabase Vault

### Critical Pattern: Use Supabase Vault for ALL API Keys

**NEVER store API keys in environment variables or code!** Universal AI Tools uses Supabase Vault for secure secrets management.

#### Storing Secrets in Vault
```typescript
// Store API keys securely in Supabase Vault
await supabase.rpc('vault.create_secret', {
  secret: apiKey,
  name: 'openai_api_key',
  description: 'OpenAI API key for production'
});
```

#### Retrieving Secrets from Vault
```typescript
// Retrieve secrets securely at runtime
const { data: secret } = await supabase.rpc('vault.read_secret', {
  secret_name: 'openai_api_key'
});
const apiKey = secret.decrypted_secret;
```

#### Best Practices for API Key Management
1. **Store Once, Retrieve at Runtime**: API keys are stored in Vault during initial setup
2. **Namespace Your Secrets**: Use prefixes like `llm_`, `service_`, `auth_`
3. **Rotate Regularly**: Use Vault's built-in rotation capabilities
4. **Audit Access**: All secret access is logged in Supabase

#### Migration Pattern for Existing Services
```typescript
// Old pattern (AVOID):
const apiKey = process.env.OPENAI_API_KEY;

// New pattern (USE THIS):
const apiKey = await getSecretFromVault('openai_api_key');
```

## Environment Configuration

Required `.env` variables (Note: API keys are stored in Supabase Vault, NOT here):

```bash
# Server Configuration
PORT=9999
NODE_ENV=production

# Database & Storage
DATABASE_URL=postgresql://...
SUPABASE_URL=...
SUPABASE_ANON_KEY=...        # Public key only
SUPABASE_SERVICE_KEY=...      # Store in Vault for production

# Redis (for caching and distributed systems)
REDIS_URL=redis://localhost:6379

# LLM Services Configuration (API keys in Vault)
OLLAMA_URL=http://localhost:11434
LM_STUDIO_URL=http://localhost:1234

# MLX Configuration
MLX_MODELS_PATH=/Users/christianmerrill/Desktop/universal-ai-tools/models
ENABLE_MLX_FINE_TUNING=true

# Vision Processing
ENABLE_SDXL_REFINER=true
SDXL_REFINER_PATH=/Users/christianmerrill/Downloads/stable-diffusion-xl-refiner-1.0-Q4_1.gguf
VISION_BACKEND=mlx
VISION_MAX_VRAM=20

# Intelligent Parameters
ENABLE_INTELLIGENT_PARAMETERS=true
PARAMETER_LEARNING_RATE=0.01
PARAMETER_CACHE_TTL=3600

# Security
API_RATE_LIMIT=1000

# API Keys - Now stored in Supabase Vault:
# - openai_api_key
# - anthropic_api_key
# - jwt_secret
# - encryption_key
# - Any other sensitive keys
```

### Setting Up Vault Secrets (One-time Setup)
```bash
# Use the provided script to securely store all API keys
npm run setup:vault-secrets

# Or manually via Supabase Dashboard:
# 1. Go to Settings > Vault
# 2. Create secrets for each API key
# 3. Use consistent naming: service_name_api_key
```

## Future Development Plans

### Swift Companion App (Planned)
The user plans to build a Swift companion app for macOS/iOS/watchOS that will provide:

**Authentication Features:**
- **Bluetooth Proximity Authentication** - Unlock the AI tools when iPhone/Apple Watch is nearby
- **Apple Watch Integration** - Use WatchConnectivity framework for seamless authentication
- **Biometric Security** - Leverage Touch ID/Face ID through LocalAuthentication framework
- **Secure Token Exchange** - CoreBluetooth for device communication with backend

**Technical Stack:**
- Swift with SwiftUI for native Apple platform development
- CoreBluetooth for proximity detection and BLE communication
- WatchConnectivity for Apple Watch integration
- LocalAuthentication for biometric authentication
- Security/Keychain for secure credential storage

**Backend Integration (Implemented):**
- Device registration endpoints (`POST /api/v1/device-auth/register`)
- Device authentication endpoints (`POST /api/v1/device-auth/challenge`, `POST /api/v1/device-auth/verify`)
- Proximity tracking endpoints (`POST /api/v1/device-auth/proximity`)
- JWT token generation with device-specific claims
- WebSocket connections for real-time authentication events (`ws://localhost:8080/ws/device-auth`)
  - Real-time device registration/removal notifications
  - Authentication state change broadcasts
  - Proximity-based lock/unlock events
  - Auto-disconnect detection with cleanup
  - Heartbeat monitoring for connection health

This companion app will provide a seamless, secure authentication experience that eliminates passwords by using the user's trusted Apple devices.

## Key Insights & Architecture Advantages

### Why This Architecture is Superior

**1. Service-Oriented Design:**
- Better resource sharing and efficiency than isolated agents
- Comprehensive error handling and recovery
- Production-ready scalability and monitoring

**2. Advanced Learning Systems:**
- Intelligent parameter automation reduces manual tuning
- AB-MCTS provides probabilistic optimization
- Feedback loops enable continuous improvement

**3. MLX Integration:**
- Custom model training for specific use cases
- Apple Silicon optimization for maximum performance
- Automated model lifecycle management

**4. Production Infrastructure:**
- Health monitoring and auto-scaling
- Comprehensive security and authentication
- Advanced caching and performance optimization

**5. Modern AI Stack:**
- DSPy for cognitive orchestration
- PyVision for advanced image processing
- Multi-tier LLM architecture for optimal resource utilization

Focus on leveraging the sophisticated systems that are already built rather than adding individual agent files. The architecture supports rapid feature development through service composition and intelligent automation.

## VS Code / Cursor Development Setup

### IDE Configuration
The project includes comprehensive VS Code/Cursor configuration in the `.vscode` directory:

**Extensions** (`.vscode/extensions.json`):
- **TypeScript/JavaScript**: ESLint, Prettier, Jest, TypeScript Next
- **Python**: Python, Pylance, Black Formatter, Ruff (for DSPy)
- **API Development**: REST Client, Thunder Client, OpenAPI tools
- **Database**: Redis client (Supabase via MCP - no PostgreSQL needed)
- **AI Assistants**: Cursor built-in AI, Continue, ChatGPT
- **Git**: GitLens, Git Graph, Git History
- **Productivity**: TODO Tree, Error Lens, Better Comments

**Settings** (`.vscode/settings.json`):
- Format on save enabled with ESLint auto-fix
- TypeScript strict mode with auto-imports
- Python linting with Ruff for DSPy orchestrator
- Custom TODO highlighting for BUG, SECURITY, PERFORMANCE
- File nesting for cleaner explorer view
- Spell checker with project-specific technical terms

**Debugging** (`.vscode/launch.json`):
- Debug configurations for dev/production server
- Jest test debugging with coverage
- Python DSPy orchestrator debugging
- CLI command debugging
- Full stack debugging (Node + Python)

**Tasks** (`.vscode/tasks.json`):
- Build tasks (dev/production)
- Test runners with watch mode
- Service launchers (Redis, Supabase, DSPy)
- Database migrations and health checks
- Security audits and production readiness checks

### Quick Setup
```bash
# Install all VS Code/Cursor extensions
./install-vscode-extensions.sh

# For Cursor users with GitHub Copilot subscription:
# Go to Cursor Settings → Features → Enable "Use Copilot"
```

### Development Commands Reference
All npm scripts are configured as VS Code tasks (Cmd+Shift+B):
- `Start All Services` - Launches Redis, Supabase, DSPy, and dev server
- `Run Tests` - Execute test suite with coverage
- `Build Project` - TypeScript compilation with type checking
- `Fix Lint Issues` - Auto-fix ESLint and format code

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.