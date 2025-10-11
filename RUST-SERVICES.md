# 🦀 Rust Services Documentation

## Overview

Rust services in Universal AI Tools are responsible for **performance-critical AI/ML operations**. They handle computationally intensive tasks, model inference, and data processing with memory safety and high performance.

## 🎯 Core Principles

- **Memory Safety**: Zero-copy operations where possible
- **Performance**: Sub-50ms response times for AI operations
- **Concurrency**: Handle 1000+ concurrent AI requests
- **Reliability**: Graceful error handling and recovery

## 📋 Service Inventory

### 1. LLM Router (`crates/llm-router/`)

**Port**: 3033  
**Status**: ✅ Operational

#### Responsibilities:

- **Model Selection**: Choose optimal model based on request characteristics
- **Provider Management**: Manage Ollama, MLX, and other AI providers
- **Load Balancing**: Distribute requests across available models
- **Token Analytics**: Track usage and optimize token consumption

#### Key Components:

```rust
// Core router configuration
pub struct RouterConfig {
    pub providers: Vec<ProviderConfig>,
    pub models: HashMap<String, ModelInfo>,
    pub load_balancing: LoadBalancingStrategy,
}

// Smart routing based on request characteristics
pub struct SmartLLMRouter {
    pub context_analyzer: ContextAnalyzer,
    pub performance_monitor: PerformanceMonitor,
    pub token_manager: TokenManager,
}
```

#### API Endpoints:

- `GET /health` - Service health check
- `POST /chat` - Chat with AI models
- `POST /chat/stream` - Streaming chat responses
- `GET /models` - List available models
- `GET /providers` - List available providers

#### Dependencies:

- `warp` - HTTP server framework
- `tokio` - Async runtime
- `serde` - Serialization
- `tracing` - Logging and observability

---

### 2. Assistantd (`crates/assistantd/`)

**Port**: 8080  
**Status**: ✅ Operational

#### Responsibilities:

- **Chat Interface**: Handle conversational AI interactions
- **RAG Pipeline**: Retrieval-Augmented Generation for context-aware responses
- **Memory Integration**: Connect with memory service for persistent context
- **Streaming**: Real-time response streaming

#### Key Components:

```rust
// RAG pipeline configuration
pub struct RagProvider {
    pub memory_service: MemoryServiceClient,
    pub embedding_service: EmbeddingServiceClient,
    pub llm_router: Arc<LLMRouter>,
}

// Chat request handling
pub struct ChatRequest {
    pub messages: Vec<Message>,
    pub model: Option<String>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
}
```

#### API Endpoints:

- `GET /health` - Service health check
- `POST /chat` - Non-streaming chat
- `POST /chat/stream` - Streaming chat
- `POST /rag/r1` - RAG pipeline execution
- `POST /memory/search` - Memory search operations

#### Dependencies:

- `axum` - HTTP server framework
- `tokio` - Async runtime
- `reqwest` - HTTP client for external services
- `serde` - Serialization

---

### 3. ML Inference (`crates/ml-inference/`)

**Port**: 8091  
**Status**: ✅ Operational

#### Responsibilities:

- **Model Management**: Load, unload, and manage AI models
- **Inference Execution**: Perform text generation and embeddings
- **Performance Optimization**: Optimize inference for speed and memory
- **Model Statistics**: Track model performance and usage

#### Key Components:

```rust
// Model information and management
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub task_type: String,
    pub parameters: u64,
    pub memory_usage_mb: u32,
    pub loaded: bool,
}

// Inference request handling
pub struct InferenceRequest {
    pub model_id: String,
    pub input: serde_json::Value,
    pub parameters: Option<serde_json::Value>,
}
```

#### API Endpoints:

- `GET /health` - Service health check
- `POST /infer` - Perform ML inference
- `GET /models` - List available models
- `POST /models/{id}/load` - Load a specific model
- `POST /models/{id}/unload` - Unload a specific model
- `GET /stats` - Service statistics

#### Dependencies:

- `actix-web` - HTTP server framework
- `tokio` - Async runtime
- `reqwest` - HTTP client for Ollama integration
- `serde` - Serialization

---

### 4. Vector DB (`crates/vector-db/`)

**Port**: 8092 (planned)  
**Status**: 🚧 In Development

#### Responsibilities:

- **Vector Storage**: Store and index embeddings
- **Similarity Search**: Perform fast similarity searches
- **Index Management**: Maintain vector indices for performance
- **Persistence**: Optional persistence for development

#### Key Components:

```rust
// Vector database configuration
pub struct VectorDBConfig {
    pub storage_path: Option<PathBuf>,
    pub index_type: IndexType,
    pub dimensions: usize,
    pub persistence_enabled: bool,
}

// Vector operations
pub struct VectorDB {
    pub storage: Arc<RwLock<HashMap<String, Vec<f32>>>>,
    pub index: Arc<RwLock<VectorIndex>>,
}
```

---

## 🔧 Development Guidelines

### Error Handling:

```rust
use anyhow::{Result, Context};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ServiceError {
    #[error("Model not found: {model_id}")]
    ModelNotFound { model_id: String },
    #[error("Inference failed: {reason}")]
    InferenceFailed { reason: String },
}

// Proper error handling pattern
async fn perform_inference(request: InferenceRequest) -> Result<InferenceResponse> {
    let model = load_model(&request.model_id)
        .context("Failed to load model")?;

    model.infer(&request.input)
        .context("Inference execution failed")
}
```

### Async Patterns:

```rust
use tokio::sync::{RwLock, Semaphore};
use std::sync::Arc;

// Shared state with proper concurrency
pub struct ServiceState {
    pub models: Arc<RwLock<HashMap<String, Model>>>,
    pub semaphore: Arc<Semaphore>,
}

// Concurrent request handling
async fn handle_concurrent_requests(state: Arc<ServiceState>) {
    let _permit = state.semaphore.acquire().await?;
    // Process request with acquired permit
}
```

### Health Checks:

```rust
async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "rust-service-name",
        "timestamp": chrono::Utc::now().timestamp(),
        "version": env!("CARGO_PKG_VERSION")
    }))
}
```

## 📊 Performance Metrics

### Target Performance:

- **Response Time**: <50ms for AI operations
- **Memory Usage**: <100MB per service
- **Concurrency**: 1000+ concurrent requests
- **CPU Usage**: <80% under normal load

### Monitoring:

```rust
use tracing::{info, warn, error};
use metrics::{counter, histogram, gauge};

// Metrics collection
counter!("requests_total", 1, "service" => "llm-router");
histogram!("request_duration_seconds", duration.as_secs_f64());
gauge!("active_connections", connections);
```

## 🚀 Deployment

### Build Configuration:

```toml
# Cargo.toml optimization
[profile.release]
opt-level = 3
lto = true
codegen-units = 1
panic = "abort"
```

### Container Strategy:

```dockerfile
# Multi-stage build for minimal image
FROM rust:1.75 as builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
COPY --from=builder /app/target/release/service-name /usr/local/bin/
EXPOSE 3033
CMD ["service-name"]
```

## 🔍 Testing Strategy

### Unit Tests:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use tokio_test;

    #[tokio::test]
    async fn test_model_loading() {
        let model = load_model("test-model").await.unwrap();
        assert!(model.is_loaded());
    }
}
```

### Integration Tests:

```rust
#[tokio::test]
async fn test_end_to_end_inference() {
    let client = reqwest::Client::new();
    let response = client
        .post("http://localhost:8091/infer")
        .json(&test_request)
        .send()
        .await
        .unwrap();

    assert!(response.status().is_success());
}
```

## 📝 Maintenance

### Logging:

- Use structured logging with `tracing`
- Include request IDs for traceability
- Log performance metrics
- Implement log rotation

### Updates:

- Regular dependency updates
- Security patch management
- Performance optimization
- Feature additions based on requirements

---

**Next Steps**: Resolve port conflicts with Go services and implement comprehensive monitoring.
