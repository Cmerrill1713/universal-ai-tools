# 🔧 Service Testing Guide

## Architecture Overview

The Universal AI Tools system is built with **Go, Rust, and Python services**, with minimal TypeScript components. Services should be tested individually before integration.

## Service Hierarchy

### 🦀 **Rust Services (Core AI/ML)**
- **LLM Router** (Port 3033) - Multi-provider AI model routing and inference
- **Assistantd** (Port 8080) - Core AI assistant with RAG
- **ML Inference** (Port 8091) - Direct model inference
- **Vector DB** (Port 8092) - Vector storage and search

### 🐹 **Go Services (Infrastructure)**
- **API Gateway** (Port 8081) - Central API routing
- **Memory Service** (Port 8017) - Memory and context management
- **WebSocket Hub** (Port 8082) - Real-time communication
- **Service Discovery** (Port 8083) - Service registration
- **Chat Service** (Port 8013) - Chat management
- **Load Balancer** (Port 8015) - Request distribution

### 🐍 **Python Services (ML/AI)**
- **DSPy Orchestrator** (Port 8001) - ML orchestration
- **MLX Service** (Port 8002) - Apple Silicon ML

### 📝 **TypeScript Services (Minimal)**
- **Main Backend** (Port 9999) - Dynamic model orchestration with multi-provider support

## Prerequisites

### Native Services (Must Run on Host)
- **Ollama** (Port 11434) - Local LLM inference
- **LM Studio** (Port 1234) - Alternative LLM interface

### Docker Services (Optional)
- **PostgreSQL** (Port 5432) - Database
- **Redis** (Port 6379) - Caching
- **Supabase** (Ports 54321-54323) - Backend services

## Individual Service Testing

### 1. Test Ollama (Native)
```bash
# Check Ollama status
curl -sS http://localhost:11434/api/tags | jq -r '.models[0].name'

# Expected: Model name (e.g., "codellama:7b")
```

### 2. Test LLM Router (Rust) - Multi-Provider
```bash
# Start LLM Router
cd crates/llm-router
OLLAMA_URL=http://localhost:11434 LLM_ROUTER_PORT=3033 cargo run --release

# Test health
curl -sS http://localhost:3033/health | jq -r '.status'

# Test all available models (auto-discovered)
curl -sS http://localhost:3033/models | jq -r '.models[]'

# Test Ollama provider
curl -sS -X POST http://localhost:3033/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages": [{"role": "user", "content": "Hello"}], "model": "gpt-oss:20b"}' \
  | jq -r '.provider + " - " + .response[0:50]'

# Test LM Studio provider
curl -sS -X POST http://localhost:3033/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages": [{"role": "user", "content": "Hello"}], "model": "qwen/qwen3-30b-a3b-2507"}' \
  | jq -r '.provider + " - " + .response[0:50]'

# Test MLX provider
curl -sS -X POST http://localhost:3033/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages": [{"role": "user", "content": "Hello"}], "model": "hrm-mlx"}' \
  | jq -r '.provider + " - " + .response[0:50]'
```

### 3. Test Assistantd (Rust)
```bash
# Start Assistantd
cd crates/assistantd
ASSISTANTD_PORT=8085 cargo run --release

# Test health
curl -sS http://localhost:8085/health | jq -r '.status'

# Test chat
curl -sS -X POST http://localhost:8085/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages": [{"role": "user", "content": "Hello"}]}' \
  | jq -r '.content'

# Test RAG pipeline
curl -sS -X POST http://localhost:8085/api/v1/rag \
  -H 'Content-Type: application/json' \
  -d '{"query": "What is machine learning?", "k": 2}' \
  | jq -r '.response'
```

### 4. Test Vector DB (Rust)
```bash
# Start Vector DB
cd crates/vector-db
VECTOR_DB_PORT=8092 cargo run --release

# Test health
curl -sS http://localhost:8092/health | jq -r '.status'

# Test collections
curl -sS http://localhost:8092/collections | jq -r '.[0].name'

# Test document storage
curl -sS -X POST http://localhost:8092/api/v1/collections/default/documents \
  -H 'Content-Type: application/json' \
  -d '{"id": "test-doc", "content": "Machine learning is a subset of AI", "metadata": {"title": "ML Basics"}}' \
  | jq -r '.success'

# Test semantic search
curl -sS -X POST http://localhost:8092/api/v1/collections/default/search \
  -H 'Content-Type: application/json' \
  -d '{"query": "artificial intelligence", "limit": 2}' \
  | jq -r '.results[0].content'
```

### 5. Test ML Inference (Rust)
```bash
# Start ML Inference
cd crates/ml-inference
ML_INFERENCE_PORT=8091 cargo run --release

# Test health
curl -sS http://localhost:8091/health | jq -r '.status'

# Test models
curl -sS http://localhost:8091/models | jq -r '.[0].name'
```

### 6. Test Go Services
```bash
# API Gateway
cd go-services/api-gateway
API_GATEWAY_PORT=9999 go run main.go
curl -sS http://localhost:9999/health | jq -r '.status'

# Chat Service
cd go-services/chat-service
CHAT_SERVICE_PORT=8016 go run main.go
curl -sS http://localhost:8016/health | jq -r '.status'

# Test chat endpoint
curl -sS -X POST http://localhost:8016/chat \
  -H 'Content-Type: application/json' \
  -d '{"message": "Hello", "user_id": "test"}' \
  | jq -r '.response'

# Memory Service
cd go-services/memory-service
MEMORY_SERVICE_PORT=8017 go run main.go
curl -sS http://localhost:8017/health | jq -r '.status'

# WebSocket Hub
cd go-services/websocket-hub
WEBSOCKET_PORT=8082 go run main.go
curl -sS http://localhost:8082/health | jq -r '.status'

# Service Discovery
cd go-services/service-discovery
PORT=8083 go run main.go
curl -sS http://localhost:8083/api/v1/discovery/health | jq -r '.status'
```

### 7. Test Python Services
```bash
# DSPy Orchestrator
cd python-services/dspy-orchestrator
DSPY_PORT=8001 python3 server.py
curl -sS http://localhost:8001/health | jq -r '.status'

# HRM Service
./start-hrm-service.sh
curl -sS http://localhost:8002/health | jq -r '.status'
```

## Service Dependencies

### Critical Path
1. **Ollama** (Native) → **LLM Router** → **Assistantd**
2. **PostgreSQL** (Docker) → **Memory Service** → **API Gateway**
3. **Redis** (Docker) → **WebSocket Hub** → **Service Discovery**

### Optional Services
- **Vector DB** - For RAG functionality
- **ML Inference** - For direct model access
- **DSPy Orchestrator** - For advanced ML workflows
- **MLX Service** - For Apple Silicon optimization

## Testing Order

### Phase 1: Core Infrastructure
1. Test Ollama (Native)
2. Test PostgreSQL (Docker)
3. Test Redis (Docker)

### Phase 2: AI Services
1. Test LLM Router (Rust)
2. Test Assistantd (Rust)
3. Test ML Inference (Rust)

### Phase 3: Infrastructure Services
1. Test Memory Service (Go)
2. Test API Gateway (Go)
3. Test WebSocket Hub (Go)

### Phase 4: Advanced Services
1. Test Vector DB (Rust)
2. Test DSPy Orchestrator (Python)
3. Test MLX Service (Python)

### Phase 5: Integration
1. Test Service Discovery (Go)
2. Test TypeScript Backend (Dynamic Models)
3. Test End-to-End Workflows

## Dynamic Model Testing

### Test TypeScript Backend with Dynamic Models
```bash
# Test available models endpoint
curl -sS http://localhost:9999/api/v1/models | jq -r '.data.models[]'

# Test multimodal chat with auto-detection
curl -sS -X POST http://localhost:9999/api/v1/chat/multimodal \
  -H 'Content-Type: application/json' \
  -d '{"text": "Hello! What models are available?"}' \
  | jq -r '.data.metadata.model'

# Test multimodal chat with specific model
curl -sS -X POST http://localhost:9999/api/v1/chat/multimodal \
  -H 'Content-Type: application/json' \
  -d '{"text": "What is 2+2?", "model": "qwen/qwen3-30b-a3b-2507"}' \
  | jq -r '.data.content[0:50]'

# Test multimodal chat with Ollama model
curl -sS -X POST http://localhost:9999/api/v1/chat/multimodal \
  -H 'Content-Type: application/json' \
  -d '{"text": "What is 3+3?", "model": "gpt-oss:20b"}' \
  | jq -r '.data.content[0:50]'
```

## Troubleshooting

### Common Issues

1. **Port Conflicts**
   ```bash
   # Find process using port
   lsof -i :PORT_NUMBER
   
   # Kill process
   kill -9 PID
   ```

2. **Service Not Starting**
   ```bash
   # Check logs
   tail -f /tmp/service-name.log
   
   # Check dependencies
   curl -sS http://localhost:DEPENDENCY_PORT/health
   ```

3. **Compilation Errors**
   ```bash
   # Rust services
   cargo clean && cargo build --release
   
   # Go services
   go mod tidy && go run main.go
   
   # Python services
   pip install -r requirements.txt
   ```

## Health Check Endpoints

| Service | Port | Health Endpoint |
|---------|------|----------------|
| LLM Router | 3033 | `/health` |
| Assistantd | 8085 | `/health` |
| Vector DB | 8092 | `/health` |
| ML Inference | 8091 | `/health` |
| API Gateway | 9999 | `/health` |
| Chat Service | 8016 | `/health` |
| Memory Service | 8017 | `/health` |
| WebSocket Hub | 8082 | `/health` |
| Service Discovery | 8083 | `/api/v1/discovery/health` |
| DSPy Orchestrator | 8001 | `/health` |
| MLX Service | 8002 | `/health` |

## Expected Responses

### Healthy Service
```json
{
  "status": "healthy",
  "service": "service-name",
  "timestamp": "2025-01-17T21:00:00Z"
}
```

### Service with Models
```json
{
  "models": [
    {
      "name": "codellama:7b",
      "provider": "ollama",
      "status": "available"
    }
  ]
}
```

### Chat Response
```json
{
  "response": "Hello! How can I help you?",
  "model": "codellama:7b",
  "provider": "ollama"
}
```

## Librarian System Testing

### End-to-End Librarian Workflow
```bash
# 1. Store documents in Vector DB
curl -sS -X POST http://localhost:8092/api/v1/collections/default/documents \
  -H 'Content-Type: application/json' \
  -d '{"id": "librarian-doc", "content": "The librarian system helps users find information using semantic search", "metadata": {"title": "Librarian System", "source": "docs"}}' \
  | jq -r '.success'

# 2. Test semantic search
curl -sS -X POST http://localhost:8092/api/v1/collections/default/search \
  -H 'Content-Type: application/json' \
  -d '{"query": "librarian system information", "limit": 1}' \
  | jq -r '.results[0].content'

# 3. Test Chat Service with librarian query
curl -sS -X POST http://localhost:8016/chat \
  -H 'Content-Type: application/json' \
  -d '{"message": "What is the librarian system?", "user_id": "test"}' \
  | jq -r '.response'

# 4. Test RAG pipeline
curl -sS -X POST http://localhost:8085/api/v1/rag \
  -H 'Content-Type: application/json' \
  -d '{"query": "How does the librarian system work?", "k": 2}' \
  | jq -r '.response'
```

### Librarian System Status
- ✅ **Document Storage**: Vector DB service storing documents with embeddings
- ✅ **Semantic Search**: Vector search finding relevant documents  
- ✅ **Chat Integration**: Chat Service responding to user queries
- ✅ **RAG Pipeline**: Assistantd retrieving context from Vector DB
- ✅ **End-to-End Workflow**: Complete librarian functionality operational

## Next Steps

After individual service testing:
1. Document any failing services
2. Fix configuration issues
3. Test service-to-service communication
4. Test librarian system end-to-end workflow
5. Implement proper Docker orchestration
6. Set up monitoring and logging
