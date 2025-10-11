# 🤖 Universal AI Tools - Athena AI Assistant

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![Swift](https://img.shields.io/badge/swift-5.9+-orange.svg)](https://swift.org)
[![Docker](https://img.shields.io/badge/docker-ready-brightgreen.svg)](https://www.docker.com/)
[![Status](https://img.shields.io/badge/status-production-success.svg)](https://github.com/Cmerrill1713/universal-ai-tools)

> **Athena** - A comprehensive, multi-platform AI orchestration system with native macOS/iOS apps, advanced RAG capabilities, TTS/STT integration, and autonomous evolution features.

## 🌟 Features

### 🎯 Core Capabilities
- **Multi-Model LLM Orchestration** - Seamless integration with MLX, Ollama, OpenAI, and more
- **TRM-Driven Routing** - Intelligent capability-based model selection (no hard-coded names)
- **Knowledge Grounding (RAG)** - Weaviate-powered vector database with context retrieval
- **Native Apps** - SwiftUI macOS and iOS applications with offline support
- **TTS/STT** - High-quality voice synthesis (Kokoro MLX) and speech recognition
- **Autonomous Evolution** - Self-improving system with nightly optimization cycles
- **Multi-Agent System** - Coordinated AI agents for complex task orchestration

### 🏗️ Architecture
- **Backend**: Python (FastAPI), Node.js, Go microservices
- **Frontend**: Swift (macOS/iOS), Next.js web interface
- **Database**: PostgreSQL, Weaviate (vector), Redis (cache)
- **Infrastructure**: Docker Compose, Kubernetes-ready
- **Monitoring**: Prometheus, Grafana, Netdata
- **CI/CD**: GitHub Actions, CodeQL security scanning

## 🚀 Quick Start

### Prerequisites
- **macOS** (for native app) or **Linux/macOS** (for backend)
- **Python 3.11+**
- **Docker & Docker Compose**
- **Node.js 18+** (for web frontend)
- **Swift 5.9+** (for native apps)

### 1. Clone & Setup

```bash
git clone https://github.com/Cmerrill1713/universal-ai-tools.git
cd universal-ai-tools

# Install Python dependencies
pip install -r requirements.txt

# Install Node.js dependencies
npm install
```

### 2. Launch Backend Services

```bash
# Start all services with Docker Compose
docker-compose -f docker-compose.athena-clean.yml up -d

# Or use the unified stack
docker-compose -f docker-compose.unified.yml up -d
```

### 3. Run Native macOS App

```bash
cd NeuroForgeApp
swift run
```

### 4. Access Web Interface

```
http://localhost:3000  # Web Frontend
http://localhost:8014  # Chat API
http://localhost:8888  # TTS API
http://localhost:9090  # Prometheus
http://localhost:3001  # Grafana
```

## 📦 Project Structure

```
universal-ai-tools/
├── src/                          # Python backend
│   ├── api/                      # FastAPI routes
│   │   ├── api_server.py         # Main API server
│   │   ├── trm_router.py         # TRM-based routing
│   │   ├── e2e_probe.py          # Health probing
│   │   └── tts_proxy_routes.py   # TTS integration
│   ├── core/                     # Core logic
│   │   ├── routing/              # Model selection
│   │   ├── chat/                 # Chat services
│   │   └── storage/              # Data persistence
│   └── services/                 # Background services
├── NeuroForgeApp/                # Native macOS app (Swift)
│   ├── Sources/                  # Swift source code
│   ├── Tests/                    # XCUITests
│   └── Package.swift             # SPM configuration
├── AthenaIOS/                    # Native iOS app
├── go-services/                  # Go microservices
├── nodejs-api-server/            # Node.js API
├── docker-compose*.yml           # Docker orchestration
├── .github/workflows/            # CI/CD pipelines
└── scripts/                      # Automation scripts
```

## 🧠 TRM-Driven Routing

Athena uses a **Tiny Recursive Model (TRM)** for intelligent model selection:

```python
# No hard-coded model names!
policy = await router.route(
    prompt="Refactor this Swift code",
    meta={"hasFiles": True}
)

# Returns:
{
  "engine": "mlx",
  "mode": "code",
  "reason_loops": 2,
  "rag": {"enabled": True, "k": 6},
  "tools": ["filesystem"]
}
```

**Benefits:**
- 🔮 Future-proof - add models without code changes
- 🎯 Optimal selection - based on capabilities, not names
- 🔒 Privacy-first - defaults to local/offline
- ⚡ Fast routing - <50ms decision time

## 🛠️ Development

### Run Tests

```bash
# Python tests
pytest

# Swift tests
cd NeuroForgeApp && swift test

# Node.js tests
npm test

# UI tests (requires macOS)
cd NeuroForgeApp && make test-ui
```

### Code Quality

```bash
# Python linting
ruff check src/

# Format code
ruff format src/

# Type checking
mypy src/

# Security scan
bandit -r src/
```

### Docker Development

```bash
# Build all services
docker-compose build

# View logs
docker-compose logs -f athena-api

# Restart specific service
docker-compose restart athena-evolutionary
```

## 📱 Native Apps

### macOS App (Athena)
- **Swift 5.9+**, macOS 13.0+
- SwiftUI interface with native performance
- Offline-capable with local MLX models
- Voice input/output with "Hey Athena" wake word
- Dark mode support

### iOS App
- **Swift 5.9+**, iOS 16.0+
- Shared codebase with macOS
- Cellular access with secure pinning
- Touch-optimized interface

## 🔧 Configuration

### Environment Variables

```bash
# API Configuration
API_BASE=http://localhost:8014
OPENAI_API_KEY=your_key_here

# Database
POSTGRES_URL=postgresql://user:pass@localhost:5432/athena
WEAVIATE_URL=http://localhost:8090

# Feature Flags
TRM_ENABLED=true
ROUTER_MODE=trm
QA_MODE=0
```

### Docker Compose Profiles

```bash
# Production stack
docker-compose -f docker-compose.production.yml up -d

# Development with hot reload
docker-compose -f docker-compose.dev.yml up -d

# Full stack with monitoring
docker-compose -f docker-compose.unified.yml up -d
```

## 🔒 Security

- **CodeQL** security scanning on every PR
- **Dependabot** for dependency updates
- **Branch protection** on main branch
- **Secrets scanning** in CI/CD
- **Sandboxed** macOS app
- **Certificate pinning** for mobile access

## 📊 Monitoring

- **Prometheus** - Metrics collection (`:9090`)
- **Grafana** - Visualization dashboards (`:3001`)
- **Netdata** - Real-time system monitoring
- **Health Probes** - `/api/probe/e2e` endpoint

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **TRM (Tiny Recursive Model)** - Samsung SAIL Montréal
- **MLX** - Apple's ML framework for Apple Silicon
- **Weaviate** - Vector database
- **FastAPI** - Modern Python web framework
- **SwiftUI** - Apple's declarative UI framework

## 📮 Contact & Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/Cmerrill1713/universal-ai-tools/issues)
- **Discussions**: [Ask questions and share ideas](https://github.com/Cmerrill1713/universal-ai-tools/discussions)
- **Repository**: https://github.com/Cmerrill1713/universal-ai-tools

## 🗺️ Roadmap

- [ ] Enhanced multi-modal support (vision, audio)
- [ ] Distributed training pipeline
- [ ] Mobile app release (iOS/iPadOS)
- [ ] Plugin ecosystem
- [ ] Advanced RAG with graph reasoning
- [ ] Real-time collaboration features

---

**Built with ❤️ using cutting-edge AI technologies**

⭐ **Star this repo** if you find it useful!
