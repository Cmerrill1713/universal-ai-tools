# Universal AI Tools - AI Platform Development

A **Go-based AI platform** with planned hybrid architecture expansion. Currently features functional Go API Gateway with LM Studio integration and Docker infrastructure.

**🚧 Current Status** (August 22, 2025):
- **Working**: Go API Gateway with 104 endpoints
- **Working**: Chat functionality via LM Studio integration  
- **Working**: Docker infrastructure (PostgreSQL, Redis, Neo4j)
- **Working**: Demo authentication and health monitoring
- **In Progress**: Rust services, Swift macOS app, production deployment
- **Repository**: Organized and optimized (26GB → 5.6GB)

## 🚀 Quick Start

**Get started in 5 minutes:**

```bash
# Start the Go API Gateway
cd go-api-gateway && ./main

# Verify system health
curl http://localhost:8082/health

# Generate demo token
curl -X POST http://localhost:8082/api/v1/auth/demo-token \
  -H "Content-Type: application/json" \
  -d '{"purpose": "testing"}'

# Test API endpoints
curl http://localhost:8082/api/v1/agents/
```

📖 **[Complete Quick Start Guide →](QUICK_START_GUIDE.md)**

## 🏗️ Current Architecture

### ✅ **What's Implemented**

**Go API Gateway** (Port 8082):
- 104 REST API endpoints (many return demo data)
- Real chat functionality via LM Studio integration
- Authentication with demo token generation
- Health monitoring and system metrics
- Memory usage tracking

**Docker Infrastructure**:
- PostgreSQL database (Supabase stack)
- Redis caching layer
- Neo4j graph database
- Prometheus + Grafana (containers running)
- Jaeger tracing (container running)

**LM Studio Integration**:
- Local LLM inference (Qwen 30B model)
- Chat completions API
- Real AI responses (not mocked)

### ✅ **Implemented Architecture**

**Swift macOS App** (Substantially Complete):
- Native macOS interface with modern SwiftUI NavigationSplitView
- Real-time backend integration with Go API Gateway
- Complete chat interface with streaming responses
- News aggregation with category filtering
- Image generation with fallback mechanisms
- System health monitoring dashboard
- Professional glass morphism design system

### 🚧 **Planned Architecture** (In Development)

**Rust Services** (Not Yet Implemented):
- LLM routing and load balancing
- Vector database operations  
- ML inference engine
- GraphRAG knowledge processing

**Python ML Services** (Organized, Not Integrated):
- Machine learning models
- Training and optimization
- Data processing pipelines

### 🎯 Current Capabilities

* **✅ Working Features**
  * Go API Gateway with 104 endpoints
  * Real chat via LM Studio (Qwen 30B model)
  * Demo authentication with JWT tokens
  * System health and memory monitoring
  * Docker infrastructure stack

* **⚠️ Demo/Mock Features**
  * Agent management (returns demo data)
  * Hardware authentication (fictional devices)
  * Database performance metrics (mock data)
  * Most API endpoints return placeholder responses

* **🔧 Infrastructure Ready**
  * PostgreSQL, Redis, Neo4j containers
  * Prometheus + Grafana containers (not configured)
  * Jaeger tracing container (not configured)
  * Docker-based development environment

* **📋 Planned Features**
  * Real Rust microservices (LLM routing, vector operations, ML inference)
  * Voice services integration (UI complete, backend pending)
  * Production deployment automation
  * Real database integration

### 🔧 Local Infrastructure

* **Health Monitoring** - Simple health checks for local services
* **Local Security** - Basic auth for single-user operation
* **Efficient Caching** - In-memory caching with Redis fallback
* **Error Recovery** - Basic error handling and service restart
* **Real-Time Updates** - WebSocket for live chat responses

## 📋 Prerequisites

* Node.js (v18 or higher)
* npm or yarn
* Ollama and LM Studio (for local LLM inference)
* Docker & Docker Compose (optional - for services)
* macOS (for SwiftUI app)

## 🛠️ Installation

### Prerequisites Check

```bash
# Verify system requirements
node --version  # v18+ required
python3 --version  # 3.8+ required
redis-cli ping  # Optional, falls back to in-memory
```

### Quick Local Setup (5 minutes)

**Step 1: Install Local LLM Server**

```bash
# Option A: Install Ollama for local LLM
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull llama3.2:3b

# Option B: Install LM Studio (alternative)
# Download from https://lmstudio.ai/ and load a model

# Pull a lightweight model
ollama pull llama3.2:3b
```

**Step 2: Clone and Setup**

```bash
git clone https://github.com/Cmerrill1713/universal-ai-tools.git
cd universal-ai-tools
npm install
```

**Step 3: Start Local Mode**

```bash
# Quick start script (recommended)
./scripts/start-local.sh

# OR manual start:
docker-compose -f docker-compose.local.yml up -d
npm run dev:local
```

**Step 4: Verify Setup**

```bash
# Check health
curl http://localhost:9999/api/health

# Test chat
curl -X POST http://localhost:9999/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello!"}]}'
```

## 🚀 Usage Examples

### 1. Basic Local Chat

```typescript
// All processing happens locally - no external APIs
const response = await fetch('http://localhost:9999/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [
      { role: "user", content: "Explain quantum computing" }
    ],
    model: "llama3.2:3b"
  })
});

const result = await response.json();
// Response generated locally via Ollama or LM Studio
```

### 2. Use Different Local Models

```bash
# Install more models
ollama pull mistral:7b
ollama pull codellama:7b

# Use in chat
curl -X POST http://localhost:9999/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Write Python code"}], "model":"codellama:7b"}'
```

### Access Points

* **Go API Gateway**: http://localhost:8082/api/v1/
* **Health Check**: http://localhost:8082/health
* **Chat API**: http://localhost:8082/api/v1/chat/
* **Swift macOS App**: Open `macOS-App/UniversalAITools/UniversalAITools.xcodeproj`

## 🏗️ Local Architecture

### Simplified Design

```text
┌─────────────────────────────────────────┐
│          Universal AI Tools             │
│           (Local Mode)                  │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────┐   ┌─────────────┐    │
│  │   Ollama    │──▶│  Chat API   │    │
│  │ (Local LLM) │   │ (Node.js)   │    │
│  └─────────────┘   └─────────────┘    │
│          │                │            │
│          ▼                ▼            │
│  ┌─────────────┐   ┌─────────────┐    │
│  │   SQLite    │   │ macOS App   │    │
│  │ (Local DB)  │   │ (SwiftUI)   │    │
│  └─────────────┘   └─────────────┘    │
└─────────────────────────────────────────┘
```

### Key Benefits

1. **100% Offline Operation** - No internet required after setup
2. **Privacy First** - All data stays on your device
3. **Low Resource Usage** - <1GB memory, minimal CPU
4. **Fast Startup** - 5-10 second boot time

## 🔧 API Endpoints

Simple REST API on port 9999:

### Core APIs

```text
/api/chat                 # Chat with local LLM via Ollama
/api/health               # Service health check
/api/models               # List available local models
```

### Agent APIs

```text
/api/agents               # List active agents
/api/agents/:id/chat      # Chat with specific agent
```

### Utility APIs

```text
/ws                       # WebSocket for real-time chat
/api/memory               # Local conversation memory
```

## 🧪 Testing

### Test Suites

```bash
npm test                  # Run all tests
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests
npm run test:local        # Local mode tests
```

### Health Checks

```bash
npm run health            # Check all local services
curl http://localhost:9999/api/health  # API health check
```

## 📚 Documentation

### Core Documentation

* [CLAUDE.md](CLAUDE.md) - Project context and local optimization status
* [LOCAL_LLM_BACKEND_GUIDE.md](LOCAL_LLM_BACKEND_GUIDE.md) - Ollama integration guide
* [DEVELOPMENT_QUICKSTART.md](DEVELOPMENT_QUICKSTART.md) - Development setup

### macOS App

* [macOS-App/UniversalAITools/README.md](macOS-App/UniversalAITools/README.md) - SwiftUI app guide

### Configuration

* [.env.local](.env.local) - Local development environment
* [docker-compose.local.yml](docker-compose.local.yml) - Local Docker setup

## 🤝 Contributing

### Development Standards

1. **Local-First Design** - Features should work offline
2. **TypeScript Strict Mode** - All code must pass strict type checking
3. **Low Resource Usage** - Keep memory and CPU usage minimal
4. **Test Coverage** - Test core functionality
5. **Documentation** - Keep docs simple and up-to-date

### Adding New Features

```typescript
// 1. Add to local API
app.post('/api/my-feature', async (req, res) => {
  // Local processing only
});

// 2. Update macOS app if needed
// 3. Add tests
// 4. Update documentation
```

## 🎯 Performance Benchmarks

| Service | Metric | Target | Current |
|---------|--------|--------|---------|
| Local LLM Chat | Response Time | < 2s | ~1.5s |
| Memory Usage | Total RAM | < 1GB | ~800MB |
| Startup Time | Boot to Ready | < 10s | ~7s |
| API Response | Health Check | < 100ms | ~50ms |

## 🚀 Roadmap

### Current Status (August 2025)

* ✅ Go API Gateway with 104 endpoints functional
* ✅ Complete Swift macOS application with modern SwiftUI architecture
* ✅ Real chat functionality via LM Studio integration
* ✅ Docker infrastructure with PostgreSQL, Redis, Neo4j
* ✅ News integration and system monitoring
* ✅ Professional UI with glass morphism design

### Future Goals

* 📋 Rust microservices implementation (LLM routing, vector DB, ML inference)
* 📋 Voice services backend implementation (UI already complete)
* 📋 Real database integration replacing mock data
* 📋 CI/CD pipeline and production deployment automation

## 📝 License

ISC License

## 🏆 Acknowledgments

* Ollama and LM Studio teams for excellent local LLM support
* Apple for SwiftUI and macOS development frameworks
* Open source contributors and the local-first community

---

**Universal AI Tools** - Local-first AI assistant. Privacy-focused, offline-capable, resource-efficient.
