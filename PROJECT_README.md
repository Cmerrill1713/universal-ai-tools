# 🚀 Universal AI Tools

A comprehensive **multi-provider LLM orchestration platform** built with Go, Rust, and Python microservices. The system automatically discovers and routes requests across multiple AI providers for optimal performance and redundancy.

## 🎯 **Key Features**

- ✅ **Dynamic Model Discovery** - Automatically detects available models from all providers
- ✅ **Multi-Provider Support** - Seamless integration with Ollama, LM Studio, and MLX
- ✅ **Intelligent Routing** - Routes requests to the best available provider
- ✅ **Auto-Fallback** - Graceful failover between providers
- ✅ **No Hard-coded Models** - Fully dynamic model management
- ✅ **Real-time Communication** - WebSocket support for live interactions
- ✅ **Vector Database** - Semantic search and embeddings
- ✅ **Native macOS App** - SwiftUI frontend with native performance

## 🏗️ **Architecture**

### **Multi-Provider LLM Architecture**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Swift App     │    │   Go API        │    │   LLM Router    │
│   (Frontend)    │───▶│   Gateway       │───▶│  (Multi-Provider)│
│   Port: N/A     │    │   Port: 9999    │    │   Port: 3033    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                       ┌───────────────────────────────┼───────────────────────────────┐
                       │                               │                               │
              ┌────────▼────────┐              ┌────────▼────────┐              ┌────────▼────────┐
              │     Ollama      │              │   LM Studio     │              │      MLX        │
              │   Port: 11434   │              │   Port: 1234    │              │   Port: 8001    │
              │  gpt-oss:20b    │              │ qwen/qwen3-30b  │              │    hrm-mlx      │
              └─────────────────┘              └─────────────────┘              └─────────────────┘
```

### **Service Stack**

| Technology | Services | Purpose |
|------------|----------|---------|
| **🦀 Rust** | LLM Router, Assistantd, ML Inference, Vector DB | Core AI/ML operations |
| **🐹 Go** | API Gateway, Chat Service, Memory Service, WebSocket Hub, Orchestration Service | Infrastructure & orchestration |
| **🐍 Python** | DSPy Orchestrator, MLX Service | ML orchestration |
| **🍎 Swift** | macOS App | Native frontend |

## 🚀 **Quick Start**

### **Prerequisites**
- **Ollama** - Local LLM inference (Port 11434)
- **LM Studio** - Alternative LLM interface (Port 1234)
- **Docker** - For PostgreSQL, Redis, Supabase
- **Go 1.24+** - For Go services (main backend)
- **Rust** - For Rust services
- **Python 3.9+** - For Python services

### **Start All Services**

1. **Start Native Services:**
   ```bash
   # Start Ollama (if not already running)
   ollama serve
   
   # Start LM Studio (if not already running)
   # Launch LM Studio app and load models
   ```

2. **Start Docker Services:**
   ```bash
   docker-compose up -d
   ```

3. **Start Microservices:**
   ```bash
   # Start Rust services
   cd crates/llm-router && OLLAMA_URL=http://localhost:11434 LLM_ROUTER_PORT=3033 cargo run --release &
   cd crates/assistantd && ASSISTANTD_PORT=8085 cargo run --release &
   cd crates/ml-inference && ML_INFERENCE_PORT=8091 cargo run --release &
   cd crates/vector-db && PORT=8092 cargo run --release &
   
   # Start Go services (main backend)
   cd go-services/api-gateway && ./api-gateway &
   cd go-services/chat-service && go run main.go &
   cd go-services/memory-service && MEMORY_SERVICE_PORT=8017 go run main.go &
   cd go-services/websocket-hub && WEBSOCKET_PORT=8082 go run main.go &
   cd go-services/orchestration-service && ./orchestration-service &
   
   # Start Python services
   cd python-services/dspy-orchestrator && DSPY_PORT=8001 python3 server.py &
   ./start-hrm-service.sh &
   ```

5. **Record nightly self-correction runs (optional):**
   ```bash
   ./automation/nightly-self-correction.sh
   ```
   This script executes the end-to-end self-correction regression suite and archives the transcript under `knowledge/experiments/` for later analysis.

```bash
./automation/summarize_self_corrections.py
```
Generates a JSON summary (volume, pass rate, top issues) from `knowledge/self_corrections.jsonl`.

4. **Start Swift App:**
   ```bash
   # Open in Xcode
   open UniversalAIToolsApp.xcworkspace
   ```

### **Verify System Status**
```bash
# Check all services
curl -sS http://localhost:9999/api/health | jq '.status'

# Check available models
curl -sS http://localhost:9999/api/v1/models | jq '.data.models[]'

# Test multi-provider routing
curl -X POST http://localhost:9999/api/v1/chat/multimodal \
  -H 'Content-Type: application/json' \
  -d '{"text": "Hello! What models are available?"}'
```

## 📊 **System Status**

**Current Status**: 🟢 **100% OPERATIONAL**

| Service Category | Status | Count |
|------------------|--------|-------|
| 🦀 Rust Services | ✅ Healthy | 4/4 |
| 🐹 Go Services | ✅ Healthy | 4/4 |
| 🐍 Python Services | ✅ Healthy | 2/2 |
| 📝 TypeScript Services | ✅ Healthy | 1/1 |
| 🔧 Native Services | ✅ Healthy | 2/2 |

**Total**: 13/13 Services Operational

## 🤖 **Available Models**

### **Ollama Provider**
- `gpt-oss:20b` - Large language model for complex reasoning
- Auto-detection enabled for additional models

### **LM Studio Provider**
- `qwen/qwen3-30b-a3b-2507` - Advanced reasoning model
- `text-embedding-nomic-embed-text-v1.5` - Text embedding model

### **MLX Provider**
- `hrm-mlx` - Apple Silicon optimized model

## 🧪 **Testing**

### **Individual Service Testing**
See [SERVICE_TESTING_GUIDE.md](./SERVICE_TESTING_GUIDE.md) for detailed testing procedures.

### **Multi-Provider Testing**
```bash
# Test Ollama routing
curl -X POST http://localhost:3033/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages": [{"role": "user", "content": "Hello"}], "model": "gpt-oss:20b"}'

# Test LM Studio routing
curl -X POST http://localhost:3033/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages": [{"role": "user", "content": "Hello"}], "model": "qwen/qwen3-30b-a3b-2507"}'

# Test MLX routing
curl -X POST http://localhost:3033/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages": [{"role": "user", "content": "Hello"}], "model": "hrm-mlx"}'
```

## 📚 **Documentation**

- **[SERVICE_TESTING_GUIDE.md](./SERVICE_TESTING_GUIDE.md)** - Comprehensive testing procedures
- **[PORT-CONFIGURATION.md](./PORT-CONFIGURATION.md)** - Port allocation and service configuration
- **[SYSTEM_STATUS.md](./SYSTEM_STATUS.md)** - Current system status and metrics

## 🔧 **Configuration**

### **Environment Variables**
```bash
# LLM Providers
OLLAMA_URL=http://localhost:11434
LM_STUDIO_URL=http://localhost:1234
MLX_URL=http://localhost:8002

# Service Ports
LLM_ROUTER_PORT=3033
ASSISTANTD_PORT=8080
API_GATEWAY_PORT=8081
MEMORY_SERVICE_PORT=8017
WEBSOCKET_PORT=8082
DSPY_PORT=8001
```

### **Model Configuration**
Models are automatically discovered from providers. No manual configuration required.

## 🚨 **Troubleshooting**

### **Common Issues**

1. **Service Not Starting**
   ```bash
   # Check if port is in use
   lsof -i :PORT_NUMBER
   
   # Kill conflicting process
   kill -9 PID
   ```

2. **Model Not Available**
   ```bash
   # Check available models
   curl -sS http://localhost:9999/api/v1/models
   
   # Check provider health
   curl -sS http://localhost:3033/health
   ```

3. **Docker Issues**
   ```bash
   # Restart Docker services
   docker-compose down && docker-compose up -d
   ```

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly using the service testing guide
5. Submit a pull request

## 📄 **License**

MIT License - see [LICENSE](./LICENSE) file for details.

## 🆘 **Support**

- **Issues**: [GitHub Issues](https://github.com/universal-ai-tools/universal-ai-tools/issues)
- **Documentation**: See the `/docs` directory
- **Status**: Check [SYSTEM_STATUS.md](./SYSTEM_STATUS.md) for current system status

---

**Built with ❤️ using Go, Rust, Python, TypeScript, and Swift**
