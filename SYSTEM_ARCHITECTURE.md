# Universal AI Tools - System Architecture

## Overview

Universal AI Tools is a comprehensive polyglot microservices platform designed for AI-powered applications, featuring Rust services for performance-critical components, Go services for networking and orchestration, and Python scripts for ML workflows.

## Architecture Principles

- **Polyglot Design**: Right tool for the right job
- **Microservices**: Loosely coupled, independently deployable services
- **Event-Driven**: Asynchronous communication patterns
- **Cloud-Native**: Containerized, scalable, observable
- **Security-First**: Authentication, authorization, and data protection

## Service Architecture

### Core Services (Rust)

#### 1. LLM Router (`crates/llm-router`)

- **Port**: 3033
- **Purpose**: Intelligent routing to LLM providers
- **Features**: Multi-provider support, caching, health monitoring
- **Dependencies**: Ollama, MLX, OpenAI

#### 2. ML Inference (`crates/ml-inference`)

- **Port**: 8091
- **Purpose**: High-performance ML model inference
- **Features**: Model management, async processing, memory optimization
- **Dependencies**: Actix Web, Tokio

#### 3. Vision Service (`crates/vision-service`)

- **Port**: 8084
- **Purpose**: Computer vision and image processing
- **Features**: Image analysis, OCR, image generation
- **Dependencies**: Candle, Image processing libraries

#### 4. Vector Database (`crates/vector-db`)

- **Port**: 8085
- **Purpose**: Vector storage and similarity search
- **Features**: Embedding storage, ANN search, persistence
- **Dependencies**: RocksDB, Vector indexing

#### 5. Assistantd (`crates/assistantd`)

- **Port**: 8086
- **Purpose**: AI assistant with RAG capabilities
- **Features**: Context management, streaming responses, memory integration
- **Dependencies**: Memory Service, LLM Router

### Orchestration Services (Go)

#### 1. API Gateway (`go-services/api-gateway`)

- **Port**: 8080
- **Purpose**: Unified API access and routing
- **Features**: Authentication, load balancing, rate limiting
- **Dependencies**: All backend services

#### 2. Memory Service (`go-services/memory-service`)

- **Port**: 8017
- **Purpose**: Persistent memory and context storage
- **Features**: Multi-database support, semantic search, user isolation
- **Dependencies**: PostgreSQL, Redis, Weaviate

#### 3. Auth Service (`go-services/auth-service`)

- **Port**: 8015
- **Purpose**: Authentication and authorization
- **Features**: JWT tokens, API keys, user management
- **Dependencies**: PostgreSQL, Redis

#### 4. Chat Service (`go-services/chat-service`)

- **Port**: 8016
- **Purpose**: Chat orchestration and management
- **Features**: Conversation flow, context preservation
- **Dependencies**: LLM Router, Memory Service

#### 5. Fast LLM Service (`go-services/fast-llm-service`)

- **Port**: 3030
- **Purpose**: Optimized LLM inference
- **Features**: Low-latency responses, model caching
- **Dependencies**: Local LLM models

### Infrastructure Services

#### 1. Load Balancer (`go-services/load-balancer`)

- **Port**: 8011
- **Purpose**: Intelligent request distribution
- **Features**: Health-based routing, circuit breakers
- **Dependencies**: All services

#### 2. WebSocket Hub (`go-services/websocket-hub`)

- **Port**: 8018
- **Purpose**: Real-time communication
- **Features**: WebSocket management, message broadcasting
- **Dependencies**: NATS, Redis

#### 3. Cache Coordinator (`go-services/cache-coordinator`)

- **Port**: 8012
- **Purpose**: Distributed caching
- **Features**: Cache invalidation, consistency
- **Dependencies**: Redis, All services

#### 4. Metrics Aggregator (`go-services/metrics-aggregator`)

- **Port**: 8013
- **Purpose**: System metrics collection
- **Features**: Prometheus integration, alerting
- **Dependencies**: All services, Prometheus

#### 5. Parameter Analytics (`go-services/parameter-analytics`)

- **Port**: 3032
- **Purpose**: Performance analytics
- **Features**: Parameter tracking, optimization insights
- **Dependencies**: PostgreSQL, Redis

## Data Flow Architecture

### Request Flow

```
Client → API Gateway → Service Router → Target Service → Response
```

### Chat Flow

```
User → API Gateway → Chat Service → LLM Router → Ollama → Response
```

### RAG Flow

```
Query → Assistantd → Memory Service → Vector Search → LLM Router → Response
```

### Vision Flow

```
Image → Vision Service → ML Models → Analysis → Response
```

## Technology Stack

### Languages

- **Rust**: Performance-critical services (ML, data processing)
- **Go**: Networking, orchestration, APIs
- **Python**: ML workflows, data analysis
- **TypeScript**: Frontend applications (phasing out)

### Databases

- **PostgreSQL**: Primary relational database
- **Redis**: Caching and session storage
- **Weaviate**: Vector database for embeddings
- **RocksDB**: Local vector storage

### Infrastructure

- **Docker**: Containerization
- **NATS**: Message broker
- **Prometheus**: Metrics collection
- **Grafana**: Monitoring dashboards

## Security Architecture

### Authentication

- **JWT Tokens**: Stateless authentication
- **API Keys**: Service-to-service authentication
- **User Isolation**: Multi-tenant data separation

### Authorization

- **Role-Based Access Control (RBAC)**
- **Service-to-Service Authentication**
- **Input Validation**: All endpoints validate inputs

### Data Protection

- **Encryption in Transit**: HTTPS/TLS
- **Encryption at Rest**: Database encryption
- **Secure Random**: Cryptographically secure random generation

## Monitoring and Observability

### Metrics

- **Service Health**: Health check endpoints
- **Performance Metrics**: Response times, throughput
- **Business Metrics**: User interactions, model usage

### Logging

- **Structured Logging**: JSON format
- **Log Aggregation**: Centralized logging
- **Correlation IDs**: Request tracing

### Alerting

- **Service Down**: Immediate alerts
- **Performance Degradation**: Threshold-based alerts
- **Error Rate**: Error rate monitoring

## Deployment Architecture

### Development

- **Local Services**: Individual service development
- **Docker Compose**: Local orchestration
- **Hot Reloading**: Development efficiency

### Production

- **Kubernetes**: Container orchestration
- **Service Mesh**: Istio for traffic management
- **Auto-scaling**: Horizontal pod autoscaling

## Performance Characteristics

### Latency Targets

- **API Gateway**: < 10ms
- **LLM Router**: < 50ms
- **ML Inference**: < 100ms
- **Memory Service**: < 20ms

### Throughput Targets

- **Concurrent Users**: 10,000+
- **Requests/Second**: 1,000+
- **Memory Operations**: 10,000+ ops/sec

## Scalability Patterns

### Horizontal Scaling

- **Stateless Services**: Easy horizontal scaling
- **Load Balancing**: Intelligent request distribution
- **Database Sharding**: Data partitioning

### Vertical Scaling

- **Resource Optimization**: CPU/Memory tuning
- **Model Optimization**: Quantization, pruning
- **Cache Optimization**: Memory usage optimization

## Development Workflow

### Code Quality

- **Rust**: Clippy, rustfmt, cargo test
- **Go**: go vet, go fmt, go test
- **Python**: flake8, black, pytest

### CI/CD Pipeline

- **Automated Testing**: Unit and integration tests
- **Code Quality Gates**: Linting and security scanning
- **Automated Deployment**: Blue-green deployments

## Future Enhancements

### Planned Features

- **Multi-Region Deployment**: Global distribution
- **Advanced Caching**: Intelligent cache strategies
- **ML Model Management**: Model versioning and A/B testing
- **Enhanced Security**: Zero-trust architecture

### Performance Optimizations

- **Edge Computing**: CDN integration
- **Model Optimization**: Quantization and pruning
- **Database Optimization**: Query optimization and indexing
