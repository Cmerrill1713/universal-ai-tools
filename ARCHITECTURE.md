# Universal AI Tools - Architecture Documentation

## 🏗️ System Architecture Overview

Universal AI Tools is a polyglot microservices architecture designed for production-scale AI operations. The system uses **Rust** for performance-critical AI/ML operations and **Go** for high-concurrency networking and API services.

## 🔧 Language-Specific Responsibilities

### 🦀 **Rust Services** (Performance-Critical AI/ML)

**Primary Focus**: AI/ML inference, data processing, and computational workloads

#### Core Rust Services:

1. **LLM Router** (`crates/llm-router/`)

   - **Port**: 3033
   - **Purpose**: Intelligent routing of AI requests to optimal models/providers
   - **Responsibilities**:
     - Model selection and load balancing
     - Provider management (Ollama, MLX)
     - Request routing and optimization
     - Token usage tracking and analytics
   - **Why Rust**: High-performance model inference, memory safety for AI operations

2. **Assistantd** (`crates/assistantd/`)

   - **Port**: 8080
   - **Purpose**: Core AI assistant service with RAG capabilities
   - **Responsibilities**:
     - Chat interface and conversation management
     - RAG (Retrieval-Augmented Generation) pipeline
     - Memory search and context management
     - Streaming responses
   - **Why Rust**: Complex AI pipeline processing, memory-efficient embeddings

3. **ML Inference** (`crates/ml-inference/`)

   - **Port**: 8091
   - **Purpose**: Direct model inference and embedding generation
   - **Responsibilities**:
     - Model loading and management
     - Text generation and embeddings
     - Inference optimization
     - Model statistics and monitoring
   - **Why Rust**: Zero-copy inference, optimal memory usage for large models

4. **Vector DB** (`crates/vector-db/`)
   - **Purpose**: Vector storage and similarity search
   - **Responsibilities**:
     - Embedding storage and indexing
     - Similarity search operations
     - Vector database management
   - **Why Rust**: High-performance vector operations, memory efficiency

### 🐹 **Go Services** (High-Concurrency Networking)

**Primary Focus**: API gateways, networking, concurrency, and service orchestration

#### Core Go Services:

1. **API Gateway** (`go-services/api-gateway/`)

   - **Port**: 8080 (conflicts with assistantd - needs resolution)
   - **Purpose**: Central API routing and load balancing
   - **Responsibilities**:
     - Request routing and load balancing
     - Authentication and authorization
     - Rate limiting and throttling
     - API versioning and management
   - **Why Go**: Excellent concurrency, fast HTTP handling, robust networking

2. **Memory Service** (`go-services/memory-service/`)

   - **Port**: 8017
   - **Purpose**: Persistent memory and context management
   - **Responsibilities**:
     - User memory storage and retrieval
     - Context persistence across sessions
     - Memory search and indexing
     - Integration with PostgreSQL and Weaviate
   - **Why Go**: Database connectivity, concurrent memory operations

3. **WebSocket Hub** (`go-services/websocket-hub/`)

   - **Purpose**: Real-time communication hub
   - **Responsibilities**:
     - WebSocket connection management
     - Real-time message broadcasting
     - Connection pooling and scaling
   - **Why Go**: Excellent WebSocket support, high concurrency

4. **Service Discovery** (`go-services/service-discovery/`)
   - **Purpose**: Service registration and discovery
   - **Responsibilities**:
     - Service health monitoring
     - Load balancer coordination
     - Service mesh management
   - **Why Go**: Network service coordination, concurrent health checks

## 🔄 Service Communication Patterns

### Inter-Service Communication:

- **Rust ↔ Rust**: Direct function calls, shared memory, channels
- **Go ↔ Go**: HTTP/gRPC, shared databases, message queues
- **Rust ↔ Go**: HTTP APIs, message queues (NATS), shared databases

### Data Flow:

```
Client Request → Go API Gateway → Rust LLM Router → Rust ML Inference
                     ↓
              Go Memory Service ← Rust Assistantd (RAG)
```

## 🚨 **CRITICAL PORT CONFLICTS TO RESOLVE**

### Current Conflicts:

1. **Port 8080**: Both `assistantd` (Rust) and `api-gateway` (Go) claim this port
2. **Port 8091**: ML Inference service conflicts with other services

### Recommended Port Allocation:

- **Rust Services**:

  - LLM Router: 3033 ✅
  - Assistantd: 8080 (needs Go API Gateway moved)
  - ML Inference: 8091 ✅
  - Vector DB: 8092

- **Go Services**:
  - API Gateway: 8081 (move from 8080)
  - Memory Service: 8017 ✅
  - WebSocket Hub: 8082
  - Service Discovery: 8083

## 📊 Performance Characteristics

### Rust Services:

- **Memory Usage**: 10-50MB per service
- **Response Time**: <50ms for inference
- **Concurrency**: 1000+ concurrent requests
- **CPU Usage**: Optimized for AI workloads

### Go Services:

- **Memory Usage**: 20-100MB per service
- **Response Time**: <10ms for API routing
- **Concurrency**: 10,000+ concurrent connections
- **CPU Usage**: Optimized for networking

## 🔧 Development Guidelines

### Rust Development:

- Use `tokio` for async runtime
- Implement proper error handling with `anyhow`/`thiserror`
- Follow Rust ownership patterns for memory safety
- Use `serde` for serialization
- Implement health checks and metrics

### Go Development:

- Use `gorilla/mux` for HTTP routing
- Implement proper context handling
- Use channels for concurrent operations
- Follow Go concurrency patterns
- Implement graceful shutdowns

## 🚀 Deployment Strategy

### Container Strategy:

- **Rust Services**: Single binary containers, minimal base images
- **Go Services**: Multi-stage builds, optimized for networking
- **Shared**: PostgreSQL, Redis, Weaviate for data persistence

### Scaling:

- **Rust Services**: Horizontal scaling based on CPU/memory
- **Go Services**: Horizontal scaling based on connection count
- **Load Balancing**: Go services handle load balancing

## 📝 Next Steps

1. **Resolve Port Conflicts**: Move Go API Gateway to port 8081
2. **Service Mesh**: Implement proper service discovery
3. **Monitoring**: Add comprehensive metrics and logging
4. **Documentation**: Update individual service documentation
5. **Testing**: Implement integration tests for Rust-Go communication

### Self-Correction Telemetry
- Go chat-service now logs each self-correction cycle as JSON lines to `knowledge/self_corrections.jsonl`.
- Go chat service now exposes `/self-corrections` and `/self-corrections/summary` for dashboards.
- `automation/summarize_self_corrections.py` produces aggregate statistics for analysis pipelines or CI reports.
- Nightly regression script (`scripts/nightly-self-correction.sh`) runs the self-correction workflow and archives transcripts in `knowledge/experiments/`.
