# Universal AI Tools - Microservices Architecture

## Overview

This document describes the complete microservices architecture for Universal AI Tools, following a hybrid Go/Rust approach for maximum performance, reliability, and maintainability.

## Architecture Principles

- **Language Strategy**: Primary focus on Go and Rust services, with TypeScript/Node.js only where absolutely necessary
- **Service Independence**: Each service is independently deployable and scalable
- **Performance**: Rust for compute-intensive tasks, Go for network/API services
- **Security**: JWT-based authentication with bcrypt password hashing
- **Observability**: Structured logging, health checks, and metrics collection

## Service Map

### Running Services (Production Ready)

| Service | Language | Port | Status | Purpose |
|---------|----------|------|--------|---------|
| **API Gateway** | Go | 8080 | ✅ Running | Central entry point, routing, CORS |
| **Go Auth Service** | Go | 8015 | ✅ Running | Legacy authentication service |
| **Rust Auth Service** | Rust | 8016 | ✅ Running | High-performance JWT authentication |
| **Memory Service** | Go | 8012 | ✅ Running | Memory and state management |
| **WebSocket Service** | Go | 8014 | ✅ Running | Real-time communication |

### Rust Services (Built & Ready)

| Service | Language | Status | Purpose |
|---------|----------|--------|---------|
| **rust-llm-service** | Rust | ✅ Built | LLM request routing and coordination |
| **rust-auth-service** | Rust | ✅ Deployed | JWT authentication with bcrypt |
| **ab-mcts-service** | Rust | ✅ Built | Adaptive Bandit Monte Carlo Tree Search |
| **multimodal-fusion-service** | Rust | ✅ Built | Cross-modal AI processing |
| **intelligent-parameter-service** | Rust | ✅ Built | ML-based parameter optimization |

## Detailed Service Architecture

### API Gateway (Go - Port 8080)
**Purpose**: Central entry point for all client requests

**Features**:
- Request routing to appropriate services
- CORS handling for web clients
- Health check aggregation
- Load balancing and failover

**Health Status**:
```json
{
  "services": {
    "auth": true,
    "memory": true, 
    "websocket": true,
    "chat": false,
    "vision": false,
    "weaviate": false
  },
  "status": "healthy"
}
```

### Rust Auth Service (Rust - Port 8016)
**Purpose**: High-performance authentication and authorization

**Features**:
- JWT token generation and validation
- bcrypt password hashing
- Role-based access control (RBAC)
- User registration and login
- Token refresh and expiration
- Admin user management

**Endpoints**:
- `GET /health` - Service health check
- `POST /register` - User registration
- `POST /login` - User authentication
- `GET /verify` - Token validation [AUTH]
- `GET /profile` - User profile [AUTH]
- `PUT /profile` - Update profile [AUTH]
- `GET /users` - List users [ADMIN]
- `GET /users/:id` - Get user [ADMIN]
- `PUT /users/:id` - Update user [ADMIN]
- `DELETE /users/:id` - Delete user [ADMIN]

**Security**:
- JWT secret from environment variables
- bcrypt cost factor: 12
- Token expiration: 24 hours
- Role-based middleware protection

### Go Auth Service (Go - Port 8015)
**Purpose**: Legacy authentication service (for backward compatibility)

**Status**: Running alongside Rust service for gradual migration

### Memory Service (Go - Port 8012)
**Purpose**: Centralized memory and state management

**Features**:
- Session storage
- Cache management
- State persistence
- Memory optimization

### WebSocket Service (Go - Port 8014)
**Purpose**: Real-time communication and event streaming

**Features**:
- WebSocket connection management
- Real-time message broadcasting
- Event streaming
- Connection pooling

### Rust LLM Service (Rust)
**Purpose**: LLM request coordination and routing

**Features**:
- Provider management (OpenAI, Anthropic, etc.)
- Request routing and load balancing
- Response caching
- Performance metrics
- Circuit breakers

### AB-MCTS Service (Rust)
**Purpose**: Adaptive Bandit Monte Carlo Tree Search for AI decision making

**Features**:
- Tree search algorithms
- Bandit optimization
- Performance benchmarking
- Redis persistence for trees
- Concurrent tree exploration

### Multimodal Fusion Service (Rust)
**Purpose**: Cross-modal AI processing (text, image, audio)

**Features**:
- Signal processing (FFT, audio, image)
- Feature extraction
- Cross-modal alignment
- Performance optimization
- Parallel processing

### Intelligent Parameter Service (Rust)
**Purpose**: ML-based parameter optimization for LLM calls

**Features**:
- Machine learning models (smartcore, linfa)
- Parameter optimization algorithms
- Performance tracking
- Cache management (Redis, LRU)
- Reinforcement learning (optional)

## Technology Stack

### Languages & Frameworks
- **Rust**: High-performance services, ML processing
  - Frameworks: Axum (HTTP), Tokio (async runtime)
  - Auth: jsonwebtoken, bcrypt
  - ML: smartcore, linfa, ndarray
  - Caching: redis, moka, lru
- **Go**: Network services, API gateway
  - HTTP routing and middleware
  - Concurrent request handling
- **TypeScript**: Frontend and legacy services (being phased out)

### Infrastructure
- **Workspace Structure**: Cargo workspace for Rust services
- **Containerization**: Docker support with multi-stage builds
- **Monitoring**: Prometheus metrics, structured logging
- **Caching**: Redis for distributed cache
- **Development**: Hot reload, development environments

## Communication Patterns

### Request Flow
1. **Client** → **API Gateway** (Port 8080)
2. **API Gateway** → **Appropriate Service**
3. **Service Processing** → **Response**
4. **API Gateway** → **Client**

### Authentication Flow
1. **Client** → `POST /register` or `POST /login` → **Rust Auth Service**
2. **Rust Auth Service** → JWT Token → **Client**
3. **Client** → `Authorization: Bearer <token>` → **Protected Endpoints**
4. **Service** → Token Validation → **Rust Auth Service**
5. **Rust Auth Service** → User Claims → **Service**

### Inter-Service Communication
- **HTTP/REST**: Synchronous service-to-service calls
- **WebSocket**: Real-time bidirectional communication
- **Redis**: Shared cache and state management
- **Message Queues**: Asynchronous processing (future)

## Security Architecture

### Authentication & Authorization
- **JWT Tokens**: Stateless authentication
- **bcrypt Hashing**: Secure password storage (cost factor 12)
- **Role-Based Access Control**: User, Admin roles
- **Token Expiration**: 24-hour token lifecycle
- **CORS Policy**: Configured for web client access

### Security Best Practices
- Environment-based secret management
- HTTPS enforcement (production)
- Input validation and sanitization
- Rate limiting (planned)
- Security headers

## Performance Characteristics

### Rust Services
- **Memory Safety**: Zero-cost abstractions
- **Concurrency**: Async/await with Tokio
- **Performance**: High-throughput, low-latency
- **Resource Usage**: Efficient memory and CPU usage

### Go Services
- **Concurrency**: Goroutines for concurrent processing
- **Network Performance**: Optimized HTTP handling
- **Simplicity**: Easy maintenance and deployment

## Monitoring & Observability

### Health Checks
- Individual service health endpoints
- Aggregated health status via API Gateway
- Dependency health tracking

### Logging
- Structured logging with tracing
- Request/response logging
- Error tracking and alerting
- Performance metrics

### Metrics (Planned)
- Prometheus metrics collection
- Request latency and throughput
- Error rates and patterns
- Resource utilization

## Development Workflow

### Local Development
1. **Start Core Services**:
   ```bash
   # API Gateway
   go run simple-api-gateway.go &
   
   # Auth Services
   go run simple-auth-service.go &
   PORT=8016 cargo run -p rust-auth-service --bin rust-auth-server &
   
   # Support Services  
   go run simple-memory-service.go &
   go run simple-websocket-service.go &
   ```

2. **Test Integration**:
   ```bash
   # Health check
   curl http://localhost:8080/health
   
   # User registration
   curl -X POST http://localhost:8016/register \
     -H "Content-Type: application/json" \
     -d '{"username":"test","email":"test@example.com","password":"pass123"}'
   ```

### Build & Test
- **Rust**: `cargo build`, `cargo test`
- **Go**: `go build`, `go test`
- **Integration**: Health checks and API testing
- **Linting**: `cargo clippy`, Go fmt

## Migration Status

### ✅ Completed
- Rust auth service with full JWT implementation
- Go services running in parallel
- Service integration and testing
- Health check aggregation
- Basic CORS and middleware

### 🚧 In Progress  
- Documentation and architecture guides
- Performance optimization
- Advanced monitoring

### 📋 Planned
- Vision and chat service migration
- Database integration
- Container orchestration
- Production deployment automation
- Advanced security features

## Port Allocation

| Port | Service | Language | Status |
|------|---------|----------|--------|
| 8080 | API Gateway | Go | ✅ Active |
| 8012 | Memory Service | Go | ✅ Active |
| 8014 | WebSocket Service | Go | ✅ Active |
| 8015 | Go Auth Service | Go | ✅ Active |
| 8016 | Rust Auth Service | Rust | ✅ Active |
| 8017-8020 | Reserved | - | Available |

## Configuration

### Environment Variables
- `JWT_SECRET`: JWT signing secret (default: development key)
- `PORT`: Service port override
- `HOST`: Bind address (default: 0.0.0.0)
- `LOG_LEVEL`: Logging verbosity
- `REDIS_URL`: Redis connection string

### Build Configuration
- **Rust**: Optimized release builds with LTO
- **Go**: Standard build with race detection in dev
- **Docker**: Multi-stage builds for minimal images

## Conclusion

The Universal AI Tools microservices architecture successfully implements a high-performance, secure, and scalable system using Go and Rust. The hybrid approach leverages each language's strengths while maintaining service independence and operational simplicity.

Key achievements:
- ✅ **Full JWT Authentication** with Rust service
- ✅ **Service Integration** across Go and Rust
- ✅ **Performance Optimization** with async processing
- ✅ **Security Best Practices** with bcrypt and RBAC
- ✅ **Operational Readiness** with health checks and logging

The architecture is production-ready for core authentication and routing functionality, with clear paths for extending additional AI services and features.