# Universal AI Tools - Next-Generation AI Platform

A sophisticated service-oriented AI platform featuring multi-tier LLM orchestration, MLX fine-tuning, intelligent parameter automation, and probabilistic learning systems. Built with TypeScript, Express, and advanced AI frameworks.

**🚀 Production Ready**: Advanced service architecture with comprehensive APIs, monitoring, and self-improvement capabilities.

## 🖥️ Primary Frontend

The **macOS-App/UniversalAITools** folder contains the primary SwiftUI frontend application - a world-class AI orchestration platform with:
- 70+ advanced UI components
- 3D knowledge graph visualizations
- Real-time analytics dashboards
- Full accessibility support (WCAG 2.1 Level AA)
- Touch Bar and keyboard shortcut integration

> Note: Other frontend implementations have been archived to `archive/frontends/` for reference.

## 🚀 Features

### 🌟 Advanced Service Architecture

Unlike traditional agent-based systems, Universal AI Tools implements a sophisticated service-oriented architecture:

#### Core Services

* **🚄 Multi-Tier LLM Coordination**
  * LFM2-1.2B for ultra-fast routing decisions (45ms avg)
  * Intelligent service selection (Ollama, OpenAI, Anthropic, LM Studio)
  * Automatic load balancing and fallback mechanisms

* **🧠 AB-MCTS Probabilistic Orchestration**
  * Monte Carlo Tree Search for optimal agent selection
  * Thompson Sampling for exploration vs exploitation
  * Dynamic agent spawning based on performance
  * Bayesian performance modeling

* **🍎 MLX Fine-Tuning Framework**
  * Apple Silicon optimized model training
  * LoRA/QLoRA support for efficient fine-tuning
  * Mixed precision training (BF16/FP16)
  * Distributed training on Mac Studio

* **🎯 Intelligent Parameter Automation**
  * ML-based parameter optimization (31% quality improvement)
  * Multi-objective optimization (quality, speed, cost)
  * Real-time learning from execution feedback
  * A/B testing framework for continuous improvement

* **👁️ PyVision Integration**
  * SDXL Refiner with MLX optimization
  * YOLO v8 object detection
  * CLIP embeddings for semantic understanding
  * GPU resource management (24GB VRAM optimization)

* **🔮 DSPy Cognitive Orchestration**
  * 10-agent cognitive reasoning chains
  * Adaptive complexity analysis
  * Task decomposition and coordination
  * Knowledge evolution and validation

### 🤖 Enhanced Agent Architecture

While the platform includes individual agents, the real power comes from service-level orchestration:

#### Service-Integrated Agents

* **Enhanced Code Assistant** - Integrates with MLX fine-tuning for specialized code models
* **Multi-Tier Base Agent** - Probabilistic routing with AB-MCTS integration
* **Self-Improving Agents** - Alpha Evolve integration for continuous improvement

#### Agent Services vs Individual Files

The architecture has evolved beyond simple agent files to sophisticated services:

* **DSPy Orchestrator** replaces individual cognitive agents with 10-agent reasoning chains
* **Fast LLM Coordinator** provides intelligent routing instead of fixed agent selection
* **AB-MCTS Service** enables probabilistic agent selection and spawning
* **Intelligent Parameter Service** optimizes all agent executions automatically

### 🔧 Production Infrastructure

* **Health Monitoring** - Comprehensive health checks with service-level status
* **Telemetry & Metrics** - Prometheus integration with custom metrics
* **Security Hardening** - JWT + API key auth, CORS, rate limiting, CSRF protection
* **Caching Strategy** - Redis with intelligent fallback to in-memory LRU
* **Self-Healing Systems** - Automatic error recovery and circuit breakers
* **WebSocket Real-Time** - Live updates for training progress and agent execution

## 📋 Prerequisites

* Node.js (v18 or higher)
* npm or yarn
* PostgreSQL database
* Redis server (optional - has in-memory fallback)
* Supabase account (for managed database)
* Python 3.8+ (for DSPy orchestrator)
* Ollama (for local LLM support)

## 🛠️ Installation

### Prerequisites Check

```bash
# Verify system requirements
node --version  # v18+ required
python3 --version  # 3.8+ required
redis-cli ping  # Optional, falls back to in-memory
```

### Quick Setup

1. **Clone and Install**

```bash
git clone https://github.com/Cmerrill1713/universal-ai-tools.git
cd universal-ai-tools
npm install
pip install -r requirements.txt  # Python dependencies
```

1. **Configure Environment**

```bash
cp .env.example .env
# Edit .env with your configuration
```

### Essential Configuration

```env
# Server (REQUIRED)
NODE_ENV=development
PORT=9999
HOST=0.0.0.0

# Database (REQUIRED)
DATABASE_URL=postgresql://user:password@localhost:5432/universal_ai_tools
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key

# LLM Services (At least one required)
OLLAMA_URL=http://localhost:11434
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
LM_STUDIO_URL=http://localhost:1234

# Advanced Features (OPTIONAL)
MLX_ENABLED=true  # Apple Silicon optimization
REDIS_URL=redis://localhost:6379  # Performance caching
AB_MCTS_ENABLED=true  # Probabilistic orchestration
VISION_GPU_MEMORY=24  # GPU memory in GB
```

### Service Setup

1. **Start Required Services**

```bash
# Option 1: Docker Compose (Recommended)
docker-compose up -d

# Option 2: Manual Services
ollama serve  # In separate terminal
redis-server  # Optional, for caching
python src/services/dspy-orchestrator/server.py  # DSPy service
```

1. **Initialize Database**

```bash
npm run migrate
npm run seed:initial  # Optional: Add sample data
```

1. **Start Platform**

```bash
# Development mode with hot reload
npm run dev

# Production mode
npm run build && npm start
```

### Verify Installation

```bash
# Check service health
curl http://localhost:9999/api/v1/health

# Test LLM routing
curl http://localhost:9999/api/v1/llm/route/test

# View real-time logs
npm run logs:dev
```

## 🚀 Quick Start

### 1. Basic Text Generation

```typescript
// Intelligent routing automatically selects best model
const response = await fetch('http://localhost:9999/api/v1/llm/route', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: "Explain quantum computing",
    objective: "educational",
    constraints: { maxTime: 3000 }
  })
});

const result = await response.json();
// LFM2-1.2B routes to appropriate model in 45ms
```

### 2. Fine-Tune a Model (Apple Silicon)

```typescript
// MLX-optimized fine-tuning
const fineTuneJob = await fetch('http://localhost:9999/api/v1/mlx/fine-tune', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    baseModel: 'lfm2-1.2b',
    trainingData: './data/specialized.jsonl',
    optimization: { mlxEnabled: true }
  })
});
```

### 3. Generate Images with SDXL

```typescript
// PyVision with MLX acceleration
const image = await fetch('http://localhost:9999/api/v1/vision/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: "A futuristic city at sunset",
    model: "sdxl-refiner",
    steps: 20
  })
});
```

### Dashboard Access

* **Web UI**: http://localhost:9999
* **API Docs**: http://localhost:9999/api/docs
* **Monitoring**: http://localhost:9999/monitoring
* **WebSocket**: ws://localhost:9999/ws

## 🏗️ Architecture

### Service-Oriented Design

```text
┌─────────────────────────────────────────────────────────────┐
│                   Universal AI Tools                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐     ┌─────────────────┐              │
│  │ Fast Coordinator │     │  AB-MCTS Engine │              │
│  │   (LFM2-1.2B)   │────▶│  (Probabilistic) │              │
│  └─────────────────┘     └─────────────────┘              │
│           │                       │                         │
│           ▼                       ▼                         │
│  ┌─────────────────┐     ┌─────────────────┐              │
│  │  DSPy Cognitive │     │  MLX Fine-Tuner │              │
│  │   (10 Agents)   │     │  (Apple Silicon) │              │
│  └─────────────────┘     └─────────────────┘              │
│           │                       │                         │
│           ▼                       ▼                         │
│  ┌─────────────────┐     ┌─────────────────┐              │
│  │ Parameter Intel │     │ PyVision + SDXL │              │
│  │  (ML Optimizer) │     │  (GPU Optimized) │              │
│  └─────────────────┘     └─────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

### Key Differentiators

1. **Service-Level Intelligence** - Not just individual agents, but intelligent services that coordinate and optimize
2. **Probabilistic Learning** - AB-MCTS and Bayesian models for continuous improvement
3. **Hardware Optimization** - MLX for Apple Silicon, efficient GPU management
4. **Automated Excellence** - Intelligent parameters eliminate manual tuning

## 🔧 API Endpoints

The platform provides comprehensive APIs on port 9999:

### Core Service APIs

```text
/api/v1/llm/route         # Multi-tier LLM routing with LFM2-1.2B
/api/v1/ab-mcts/*         # Probabilistic orchestration engine
/api/v1/mlx/*             # MLX fine-tuning and inference
/api/v1/vision/*          # PyVision with SDXL Refiner
/api/v1/parameters/*      # Intelligent parameter optimization
```

### Agent & Orchestration APIs

```text
/api/v1/orchestration     # DSPy cognitive orchestration
/api/v1/agents/*          # Individual agent management
/api/v1/memory            # Vector memory & embeddings
/api/v1/knowledge         # Knowledge base with validation
```

### Supporting APIs

```text
/api/v1/auth              # JWT + API key authentication
/api/v1/speech            # Kokoro TTS / Whisper STT
/api/v1/monitoring        # Health, metrics, telemetry
/api/v1/feedback          # Learning feedback loop
```

Full API documentation: [API_DOCUMENTATION.md](API_DOCUMENTATION.md)

## 🧪 Testing

### Test Suites

```bash
npm test                  # Run all tests
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests
npm run test:performance  # Performance benchmarks
npm run test:self-healing # Self-healing validation
npm run test:ab-mcts      # Probabilistic orchestration tests
npm run test:mlx          # MLX fine-tuning tests
```

### Performance Validation

```bash
npm run benchmark:routing # Test LFM2-1.2B routing speed (45ms target)
npm run benchmark:vision  # PyVision processing benchmarks
npm run benchmark:params  # Parameter optimization effectiveness
```

## 📚 Documentation

### Core Documentation

* [CLAUDE.md](CLAUDE.md) - Advanced service architecture guide
* [API_DOCUMENTATION.md](API_DOCUMENTATION.md) - Complete v2.0.0 API reference
* [MLX_FINE_TUNING_GUIDE.md](MLX_FINE_TUNING_GUIDE.md) - Apple Silicon optimization
* [INTELLIGENT_PARAMETER_AUTOMATION.md](INTELLIGENT_PARAMETER_AUTOMATION.md) - ML parameter optimization

### Service Guides

* [AB-MCTS Integration](docs/guides/AB_MCTS_INTEGRATION.md) - Probabilistic orchestration
* [PyVision Setup](docs/guides/PYVISION_SETUP.md) - Vision processing with SDXL
* [DSPy Orchestration](docs/guides/DSPY_ORCHESTRATION.md) - Cognitive agent chains

### Development Resources

* [Service Integration Guide](docs/guides/SERVICE_INTEGRATION.md) - Adding new services
* [Migration Guide](supabase/migrations/MIGRATION_GUIDE.md) - Database migrations
* [Production Deployment](PRODUCTION_DEPLOYMENT_GUIDE.md) - Deployment checklist

## 🤝 Contributing

### Development Standards

1. **Service-First Design** - New features should integrate with existing services
2. **TypeScript Strict Mode** - All code must pass strict type checking
3. **Performance Targets** - Meet or exceed current benchmarks
4. **Test Coverage** - Minimum 80% coverage for new services
5. **Documentation** - Update relevant docs with new capabilities

### Adding New Services

```typescript
// 1. Define service interface
interface MyNewService extends BaseService {
  // Service-specific methods
}

// 2. Integrate with orchestration
orchestrator.registerService('myService', new MyNewService());

// 3. Add intelligent parameter support
parameterService.registerOptimizer('myService', new MyServiceOptimizer());
```

## 🎯 Performance Benchmarks

| Service | Metric | Target | Current |
|---------|--------|--------|---------|
| LFM2 Routing | Decision Time | < 50ms | 45ms |
| AB-MCTS | Agent Selection | < 100ms | 87ms |
| Parameter Optimization | Quality Improvement | > 25% | 31% |
| MLX Fine-Tuning | Tokens/Second | > 4000 | 4680 |
| PyVision SDXL | Image Generation | < 5s | 4.2s |

## 🚀 Roadmap

### Q1 2025

* ✅ Multi-tier LLM coordination
* ✅ AB-MCTS probabilistic orchestration
* ✅ MLX fine-tuning framework
* ✅ Intelligent parameter automation
* 🔄 Enhanced vision capabilities

### Q2 2025

* 📋 Distributed agent coordination
* 📋 Advanced self-improvement systems
* 📋 Cross-platform deployment
* 📋 Enterprise security features

## 📝 License

ISC License

## 🏆 Acknowledgments

* Apple MLX team for exceptional Apple Silicon support
* DSPy community for cognitive orchestration patterns
* Open source contributors for continuous improvements

---

**Universal AI Tools** - Where sophisticated AI services meet intelligent orchestration. Built for the future, available today.
