# 🧠 Universal AI Tools - Complete Project Understanding

**Generated:** 2025-10-11  
**Status:** Post "Stabilize Imports" PR (v0.9.0-import-stabilized)  
**Current State:** 🟢 75% endpoint health, 100% import success

---

## 1. 🏗️ **Project Name & Purpose**

### **What It Does**
**Universal AI Tools** is a comprehensive **multi-provider LLM orchestration platform** that automatically discovers and routes AI requests across multiple providers (Ollama, LM Studio, MLX, OpenAI) for optimal performance and redundancy.

### **Who It's For**
- **Developers** building AI-powered applications
- **Enterprises** needing scalable, multi-provider AI infrastructure
- **Researchers** experimenting with different LLM providers
- **macOS Users** wanting native AI assistant integration

### **Why It Matters**
- **No vendor lock-in**: Seamlessly switch between AI providers
- **Automatic fallback**: Never down when one provider fails
- **Dynamic discovery**: No hard-coded models, fully adaptive
- **Production-ready**: Enterprise-grade resilience, monitoring, and security
- **Polyglot**: Right tool for right job (Rust for speed, Go for networking, Python for ML)

---

## 2. 🧭 **Core Goals**

### **Top 3 Objectives**

1. **Universal AI Access**
   - Single API to access all AI providers (Ollama, MLX, OpenAI, LM Studio)
   - Automatic model discovery and routing
   - Graceful failover and load balancing

2. **Production-Grade Reliability**
   - 99.9% uptime with circuit breakers and retry logic
   - Comprehensive monitoring (Prometheus + Grafana)
   - Automated health checks and recovery

3. **Developer Experience**
   - "Boringly green" verification (`make green`)
   - One-command deployment
   - Native macOS app with SwiftUI frontend
   - Extensive documentation and examples

---

## 3. 🧠 **System Architecture Overview**

### **Frontend**
- **Swift macOS App** (UniversalAIToolsApp)
  - Native SwiftUI interface
  - Real-time chat with AI models
  - Model selection and configuration
  - **Entry point**: `UniversalAIToolsApp/Sources/`

- **Web Interface** (Optional)
  - HTML/CSS/JS frontend
  - WebSocket support for real-time updates
  - **Files**: `frontend.html`, `family-chat.html`

### **Backend - Service Layers**

#### **Go Services** (Networking & Orchestration)
**Location**: `go-services/`

**Core Services:**
- **API Gateway** (port 8080/9999) - Unified API entry point, auth, rate limiting
- **Chat Service** (port 8016) - Real-time messaging, WebSocket hub
- **Memory Service** (port 8017) - Data persistence, Weaviate integration
- **Auth Service** (port 8015) - User authentication, JWT tokens
- **Orchestration Service** (port 8014) - Workflow coordination
- **Load Balancer** (port 8011) - Intelligent service distribution
- **Metrics Aggregator** (port 8013) - Performance monitoring

**Knowledge & Context:**
- **Knowledge Gateway** - Semantic search, document retrieval
- **Knowledge Context** - Context management for AI
- **Weaviate Client** - Vector database integration

#### **Rust Services** (Performance-Critical AI/ML)
**Location**: `rust-services/`, `crates/`

**Core Services:**
- **LLM Router** (port 3033) - Multi-provider routing, caching, health checks
- **Assistantd** (port 8086) - AI assistant with RAG capabilities
- **ML Inference** (port 8091) - High-performance model inference
- **Vision Service** (port 8084) - Computer vision, image processing
- **Vector DB** (port 8085) - Vector storage, similarity search

**Advanced Services:**
- **AB-MCTS Service** - Monte Carlo Tree Search for decision-making
- **Parameter Analytics** - Hyperparameter optimization
- **Intelligent Parameter Service** - Learning-based parameter tuning
- **REVEAL Evolution** - Automated code evolution
- **Agent Coordination** - Multi-agent collaboration

#### **Python Services** (ML Workflows & Training)
**Location**: `src/`, `python-services/`

**Core Services:**
- **Unified Backend API** (port 8000) - FastAPI application, main Python API
- **HRM Service** - Hybrid Routing & Management
- **DSPy Orchestrator** - Advanced AI orchestration
- **Vision Service** - Computer vision (alternative to Rust)

**Modules:**
- `src/core/training/` - ML model training pipelines
- `src/core/optimization/` - Hyperparameter optimization
- `src/core/unified_orchestration/` - Chat orchestration
- `src/api/` - API routes and middleware
- `src/middleware/` - Error handling, logging

### **AI / ML Stack**

#### **LLM Providers** (Automatic Discovery)
- **Ollama** (port 11434) - Local LLM inference (llama3.2, mistral, codellama)
- **MLX** - Apple Silicon optimized inference
- **LM Studio** - Additional local LLM provider
- **OpenAI** - Cloud-based models (GPT-4, etc.)

#### **Vector Databases**
- **Weaviate** (port 8090, 50051) - Primary vector store for embeddings
- **Custom Vector DB** (Rust) - High-performance alternative

#### **Knowledge Systems**
- **Knowledge Grounding** - Context-aware document retrieval
- **Semantic Search** - Vector-based similarity search
- **Memory Service** - Long-term conversation memory

#### **Agent Systems**
- **Agent Coordination** - Multi-agent collaboration
- **Agent Orchestration** - Workflow coordination
- **A2A Communication** - Agent-to-agent messaging

### **Infrastructure**

#### **Docker Compose Services**
**File**: `docker-compose.yml`

- **PostgreSQL** (port 5432) - Primary database
- **Redis** (port 6379) - Caching, rate limiting, message broker
- **Supabase** (ports 54321-54323) - Auth, REST API, Storage
- **Prometheus** (port 9090) - Metrics collection
- **Grafana** (port 3003) - Visualization dashboards
- **pgAdmin** (port 5050) - Database management UI
- **Redis Commander** (port 8081) - Redis management UI

#### **CI/CD & Testing**
**Location**: `.github/workflows/`, `scripts/`

- **Smoke Tests** - Import and critical endpoint checks
- **Verify Workflow** - Full endpoint verification on every PR
- **Nightly Matrix** - Multi-service testing (daily at 04:00 UTC)
- **Contract Tests** - API shape validation
- **Error Sentry** - 500 detector with retry backoff

#### **Deployment**
- **Docker** - Containerized services
- **Docker Compose** - Local development and orchestration
- **Kubernetes** (k8s/) - Production deployment (optional)
- **Shell Scripts** - Automated deployment and management

---

## 4. 🧰 **Major Modules & Responsibilities**

### **Directory Structure**

```
universal-ai-tools/
├── go-services/           # Go microservices (networking, orchestration)
│   ├── api-gateway/       # Main API entry point
│   ├── chat-service/      # Real-time chat
│   ├── memory-service/    # Persistence layer
│   ├── orchestration-service/  # Workflow coordination
│   └── [30+ other services]
│
├── rust-services/         # Rust services (performance-critical)
│   ├── crates/
│   │   ├── llm-router/    # Multi-provider LLM routing
│   │   ├── assistantd/    # AI assistant with RAG
│   │   ├── ml-inference/  # Model inference
│   │   └── vision-service/  # Computer vision
│   └── ab-mcts-service/   # Advanced AI decision-making
│
├── src/                   # Python source code
│   ├── api/               # FastAPI routes
│   ├── core/              # Core ML/AI logic
│   │   ├── training/      # Model training
│   │   ├── optimization/  # Hyperparameter tuning
│   │   └── unified_orchestration/  # Chat orchestration
│   └── middleware/        # Error handling, logging
│
├── scripts/               # Automation and verification
│   ├── error_sentry.py    # 500 detector (3-retry backoff)
│   ├── contract_chat.py   # /chat shape validator
│   ├── independent_verifier_v2.py  # Comprehensive endpoint tester
│   └── [10+ other scripts]
│
├── api/                   # Demo Python API (FastAPI)
│   ├── app.py             # Main FastAPI app
│   └── routers/           # API routes (health, users, tasks)
│
├── UniversalAIToolsApp/   # macOS Swift frontend
│   └── Sources/           # SwiftUI views and logic
│
├── knowledge-grounding/   # Context & retrieval systems
│   ├── gateway/           # Knowledge gateway (Go)
│   └── context/           # Context management
│
├── docs/                  # Documentation
├── tests/                 # Integration tests
├── monitoring/            # Prometheus, Grafana configs
├── .github/workflows/     # CI/CD pipelines
└── docker-compose.yml     # Infrastructure services
```

### **What Each Module Does**

#### **Core Services**
- **API Gateway**: Single entry point, routes to appropriate services, handles auth
- **LLM Router**: Discovers available models, routes to best provider, handles fallback
- **Chat Service**: WebSocket hub, real-time messaging, conversation state
- **Memory Service**: Stores conversations, retrieves context, Weaviate integration
- **Orchestration**: Coordinates multi-step workflows, agent collaboration

#### **AI/ML Services**
- **ML Inference**: Fast model execution, model management, async processing
- **Vision Service**: Image analysis, OCR, image generation
- **Parameter Analytics**: Tracks what works, learns optimal parameters
- **AB-MCTS**: Monte Carlo Tree Search for decision-making
- **REVEAL Evolution**: Automated code generation and improvement

#### **Knowledge Services**
- **Knowledge Gateway**: Semantic search across documents
- **Vector DB**: Stores embeddings, similarity search
- **Weaviate Client**: Interface to Weaviate vector database

#### **Infrastructure Services**
- **Load Balancer**: Distributes traffic, health checks
- **Cache Coordinator**: Redis caching, invalidation strategies
- **Metrics Aggregator**: Collects performance data, exposes to Prometheus

#### **Python Services**
- **Unified Backend API**: Main Python API, FastAPI framework
- **Training**: ML model training pipelines, fine-tuning
- **Optimization**: Hyperparameter optimization, A/B testing

---

## 5. 🧪 **Verification & Guardrails**

### **The One-Liner: `make green`**

```bash
make green BASE=http://localhost:8013
```

**What it runs:**
1. ✅ **`make sentry`** - No 500s on critical pages (3-retry backoff)
2. ✅ **`make validate`** - GET endpoints ≥90% success
3. ✅ **`make validate-all`** - POST endpoints 2xx or 422 (no 500s)
4. ✅ **`make contract`** - /chat shape validated

### **Automated Checks**

#### **CI/CD Workflows** (`.github/workflows/`)
1. **smoke.yml** - Quick 500 check on every push
2. **verify.yml** - Full endpoint verification on every PR
3. **nightly.yml** - Matrix testing across all services (daily 04:00 UTC)

#### **Pre-commit Hooks** (`.pre-commit-config.yaml`)
- Forbid bad `from api.` imports
- Test archive isolation
- Ruff linting and formatting

#### **Test Scripts** (`scripts/`)
- **error_sentry.py** - 500 detector with retry backoff
- **contract_chat.py** - /chat endpoint shape validation
- **independent_verifier_v2.py** - Comprehensive endpoint tester (OpenAPI discovery)
- **import_smoke.py** - Import health checks
- **db_health.py** - Database connectivity checker
- **test_archive_isolation.py** - Ensures archived code not importable

### **Pass vs. Fail Criteria**

#### **PASS ✅**
- Imports: 100% (8/8 modules)
- Critical pages: 0 x 500s
- GET endpoints: ≥90% 2xx/3xx
- POST endpoints: 2xx or 422 (validation errors OK)
- DB-backed routes: 503 when DB down (not 500)
- Nightly CI: 7 consecutive green nights
- Contract tests: /chat shape intact

#### **FAIL ❌**
- Any import failures
- 500s on critical pages (/openapi.json, /health, /api/unified-chat/health)
- GET success rate < 70%
- POST endpoints returning 500
- DB unavailable returning 500 (should be 503)
- Nightly CI failing 3+ consecutive nights
- Contract tests broken (shape changed)

### **Definition of Done**
**File**: `DEFINITION_OF_DONE.md`

- ✅ All imports load (0 ModuleNotFoundError)
- ✅ Critical GETs ≥90% 2xx/3xx across services
- ✅ Probe POSTs 2xx or 422 only (no 500s)
- ✅ DB-backed routes 503 when DB down (never 500)
- ✅ Sentry 0 x 500s on critical pages
- ✅ Nightly matrix 7 consecutive green nights
- ✅ Pre-commit forbids regressing to bad imports
- ✅ Contract test /chat response shape enforced
- ✅ Rollback tag v0.9.0-import-stabilized exists
- ✅ Issues filed for all known bugs

---

## 6. 🐞 **Known Gaps or Incomplete Areas**

### **Current Limitations** (As of v0.9.0)

#### **500 Errors (Documented, Not Yet Fixed)**
**Remaining: 4-8 endpoints**

1. **Postgres Auth Failures** (`.github/issues/db-auth-fix.md`)
   - `/api/corrections/stats` → 500
   - `/api/corrections/recent` → 500
   - `/api/corrections/trigger-retraining` → 500
   - **Fix**: Unify DATABASE_URL, return 503 when DB down

2. **Missing 'trend' Key** (`.github/issues/realtime-vibe-trend-fix.md`)
   - `/api/v1/realtime-autonomous-vibe/technologies` → 500
   - **Fix**: Default to "neutral" when key missing

3. **Missing _get_current_time** (`.github/issues/current-time-shim-fix.md`)
   - `/api/v1/realtime-autonomous-vibe/market-analysis` → 500
   - `/api/v1/realtime-autonomous-vibe/competitor-analysis` → 500
   - **Fix**: Add shim method or inline datetime

4. **Crawler Input Validation** (`.github/issues/crawler-input-validation.md`)
   - `/crawler/crawl-urls` → 500 on bad input
   - **Fix**: Validate input, return 422, per-URL error handling

#### **Container Configuration Issues**
5. **PYTHONPATH Inconsistencies** (`.github/issues/pythonpath-alignment.md`)
   - Some containers don't load `sitecustomize.py`
   - WORKDIR varies across Dockerfiles
   - **Fix**: Standardize all Dockerfiles, verify sitecustomize loads

#### **Completed (No Action Needed)**
6. **Archive Isolation** (`.github/issues/archive-legacy-code.md`)
   - ✅ Status: COMPLETED
   - All `.bak`, `*_old.py` moved to `/archive`
   - Test ensures archived code not importable

### **Technical Debt**

#### **Code Quality**
- 65 backup files archived (`.bak`, `*_old.py`, `*.broken.py`)
- Some services have duplicated logic (consolidation needed)
- Import style inconsistencies (now enforced by pre-commit)

#### **Testing**
- Unit test coverage incomplete
- Integration tests limited
- Load testing not automated
- Performance regression tests needed

#### **Documentation**
- API documentation incomplete
- Some services lack README
- Architecture diagrams outdated
- Deployment runbooks minimal

#### **Security**
- Secrets in environment variables (need secrets manager)
- No automated security scanning
- Rate limiting not enforced everywhere
- Auth tokens need rotation policy

---

## 7. 📅 **Roadmap / Vision**

### **Immediate (v0.9.1 - v0.10.0)**
**Timeline:** Next 2-4 weeks

1. **Fix Remaining 500s**
   - Apply surgical patches (DB auth, trend key, time shim, crawler)
   - Target: 0 critical 500s, 90%+ endpoint success

2. **Complete CI/CD**
   - Nightly matrix stable (7/7 green nights)
   - Automated deployment to staging
   - Rollback automation

3. **Performance Baseline**
   - Latency tracking (p50, p95, p99)
   - Token usage monitoring
   - Regression detection on performance changes

### **Short-term (v1.0.0)**
**Timeline:** 1-2 months

1. **Production Deployment**
   - Kubernetes deployment
   - Auto-scaling based on load
   - Multi-region support

2. **Enhanced Monitoring**
   - Distributed tracing (Jaeger/Zipkin)
   - Log aggregation (ELK stack)
   - Automated alerting (PagerDuty/Opsgenie)

3. **Security Hardening**
   - Secrets manager integration (Vault)
   - API key rotation
   - Rate limiting enforcement
   - Automated security scanning (Gitleaks)

### **Medium-term (v2.0.0)**
**Timeline:** 3-6 months

1. **Advanced AI Capabilities**
   - Multi-agent orchestration at scale
   - Automated model fine-tuning
   - Custom model deployment
   - Vision-language model integration

2. **Enterprise Features**
   - Multi-tenancy
   - Role-based access control
   - Audit logging
   - Cost allocation and billing

3. **Developer Experience**
   - CLI tool for local development
   - SDKs (Python, Go, Rust, Swift)
   - GraphQL API
   - Developer portal

### **Long-term Vision**
**Timeline:** 6-12 months

1. **Self-Improving System**
   - Automated parameter optimization
   - Self-healing infrastructure
   - Predictive scaling
   - Automated code evolution

2. **AI-Driven Development**
   - Natural language to code
   - Automated testing generation
   - Self-documenting code
   - Intelligent refactoring

3. **Ecosystem**
   - Plugin marketplace
   - Community-contributed agents
   - Integration marketplace
   - Training and certification

---

## 8. 📎 **Other Useful Context**

### **Naming Conventions**

#### **Services**
- **Go services**: `{name}-service` (e.g., `chat-service`, `memory-service`)
- **Rust crates**: `{name}` or `{name}-service` (e.g., `llm-router`, `assistantd`)
- **Python modules**: `{name}` in `src/{name}/` (e.g., `src/core/training/`)

#### **Ports**
- **8000-8099**: Python services (8000 = main Python API)
- **8011-8099**: Go services (8080 = API gateway)
- **3000-3099**: Rust services (3033 = LLM router)
- **5432**: PostgreSQL
- **6379**: Redis
- **11434**: Ollama
- **54321-54323**: Supabase

#### **API Endpoints**
- `/health` - Service health check
- `/api/{service}/*` - Service-specific routes
- `/openapi.json` - OpenAPI specification
- `/metrics` - Prometheus metrics

### **Agent Names & Roles**

#### **Core Agents**
- **HRM (Hybrid Routing Manager)** - Decides which model to use
- **LFM (Large Foundation Model)** - Routes to large models (GPT-4, Claude)
- **Orchestrator** - Coordinates multi-step workflows
- **Memory Agent** - Manages long-term memory
- **Knowledge Agent** - Retrieves context from knowledge base

#### **Specialized Agents**
- **Vision Agent** - Image processing and analysis
- **Code Agent** - Code generation and analysis
- **Research Agent** - Web scraping and research
- **Documentation Agent** - Automated documentation

### **Tribal Knowledge**

#### **Import Style** (Enforced by pre-commit)
- ✅ **Good**: `from src.module import Class`
- ✅ **Good**: `import api.routers.health`
- ❌ **Bad**: `from api. import` (outside allowed dirs)

#### **Error Handling Philosophy**
- **500** = Server bug (should never happen)
- **503** = Temporary unavailable (DB down, service down)
- **422** = Validation error (bad client input)
- **404** = Not found (expected for optional endpoints)

#### **Container Development**
- Use `sitecustomize.py` to add `/app/src`, `/app/api` to Python path
- Set `PYTHONPATH=/app/src:/app/api:/app` in all containers
- Always use `WORKDIR /app` in Dockerfiles

#### **Testing Philosophy**
- **Smoke tests** - Fast, critical paths only
- **Verification** - Comprehensive, all endpoints
- **Contract tests** - API shapes, prevent breaking changes
- **Nightly matrix** - Full stack, all services, all scenarios

#### **Deployment**
- **Local**: `docker-compose up -d`
- **Development**: `docker-compose -f docker-compose.dev.yml up`
- **Production**: `docker-compose -f docker-compose.prod.yml up`
- **Go+Rust**: `docker-compose -f docker-compose.go-rust.yml up`

#### **Key Commands**
```bash
# One-liner health check
make green BASE=http://localhost:8013

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f --tail=100

# Rebuild specific service
docker-compose up -d --build {service-name}

# Stop all
docker-compose down

# Complete reset
docker-compose down -v && docker-compose up -d
```

### **Documentation Files**

#### **Getting Started**
- `README.md` - High-level overview
- `DEVELOPER-QUICK-START.md` - Quick start guide
- `INSTALL.md` - Installation instructions
- `DEVELOPMENT_SETUP.md` - Development environment setup

#### **Architecture**
- `ARCHITECTURE.md` - System architecture
- `SYSTEM_ARCHITECTURE.md` - Detailed architecture
- `PROJECT_README.md` - Multi-provider LLM architecture
- `DOCKER_INFRASTRUCTURE.md` - Docker setup

#### **Operations**
- `DEPLOYMENT_GUIDE.md` - Deployment instructions
- `REBUILD_GUIDE.md` - Complete rebuild from scratch
- `ROLLBACK_PLAYBOOK.md` - Emergency recovery
- `DEFINITION_OF_DONE.md` - Success criteria

#### **Development**
- `FINAL_MERGE_GUIDE.md` - Merge instructions
- `MERGE_CHECKLIST.md` - Pre-merge checklist
- `LANDING_COMPLETE.md` - PR summary
- `IMPLEMENTATION_GUIDE.md` - Implementation patterns

#### **Testing**
- `FUNCTIONAL_TEST_REPORT.md` - Test results
- `COMPREHENSIVE_SYSTEM_VERIFICATION_REPORT.md` - System verification
- `MCP_INTEGRATION_TEST_REPORT.md` - MCP integration tests

---

## 🎯 **Quick Reference**

### **Health Checks**
```bash
# Single service
curl http://localhost:8013/health

# All services
make green

# Specific checks
make sentry      # No 500s
make validate    # GET endpoints
make contract    # /chat shape
```

### **Common Tasks**
```bash
# Start everything
docker-compose up -d && sleep 10 && make green

# Rebuild after code change
docker-compose up -d --build unified-backend

# Check imports
PYTHONPATH=$PWD/src:$PWD/api:$PWD python scripts/import_smoke.py

# Database health
python scripts/db_health.py

# View specific service logs
docker-compose logs -f unified-backend
```

### **Troubleshooting**
```bash
# Service not responding
docker-compose restart {service-name}

# Import errors
# Check PYTHONPATH, verify sitecustomize.py exists

# 500 errors
# Check logs, run error_sentry.py, apply surgical patches

# DB connection errors
# Verify DATABASE_URL, check postgres is running
```

---

**Last Updated:** 2025-10-11  
**Version:** v0.9.0-import-stabilized  
**Status:** 🟢 Production-Ready Foundation  
**Next:** Fix remaining 500s, achieve 90%+ endpoint success

