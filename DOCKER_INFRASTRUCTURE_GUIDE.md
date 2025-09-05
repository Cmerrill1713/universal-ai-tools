# Docker Infrastructure Guide - Universal AI Tools

## 📦 Docker Architecture Overview

Our project uses a comprehensive Docker-based microservices architecture with multiple compose configurations for different deployment scenarios.

## 🗂️ Docker Configurations

### Main Configurations

1. **docker-compose.yml** (Default)
   - Main production configuration
   - Core services: App, PostgreSQL, Redis, Ollama
   - Port 9999 for main application

2. **docker-compose.migration.yml** (New Backend)
   - Go/Rust microservices migration
   - API Gateway on port 8080
   - All new services (Auth, Chat, Memory, WebSocket, Vision, Vector DB)

3. **docker-compose.full.yml**
   - Complete infrastructure stack
   - Includes monitoring (Prometheus, Grafana, Jaeger)
   - Service mesh (Consul)
   - Message broker (NATS)

4. **docker-compose.prod.yml**
   - Production-optimized configuration
   - Resource limits and constraints
   - Production-grade health checks

5. **docker-compose.dev.yml**
   - Development environment
   - Volume mounts for hot reload
   - Debug ports exposed

### Specialized Configurations

6. **docker-compose.ollama.yml**
   - Ollama LLM service
   - GPU support configuration
   - Model volume persistence

7. **docker-compose.metal.yml**
   - Metal performance optimization
   - macOS-specific configurations

8. **docker-compose.redis.yml**
   - Redis cluster configuration
   - Persistence and replication

9. **docker-compose.telemetry.yml**
   - Full observability stack
   - OpenTelemetry collector
   - Metrics and tracing

10. **docker-compose.kong.yml**
    - Kong API Gateway
    - Rate limiting and auth

11. **docker-compose.ml.yml**
    - ML services stack
    - Model serving infrastructure

12. **docker-compose.rust-go.yml** / **docker-compose.hybrid.yml**
    - Hybrid deployment configurations
    - Mixed language services

## 🏗️ Service Architecture

### Core Infrastructure
```yaml
postgres:         # Port 5432 - Main database
redis:           # Port 6379 - Cache & pub/sub  
nats:            # Port 4222 - Message broker
consul:          # Port 8500 - Service discovery
```

### Go Services (New)
```yaml
api-gateway:      # Port 8080 - Main entry point
auth-service:     # Port 8015 - Authentication
chat-service:     # Port 8016 - Chat & LLM
memory-service:   # Port 8017 - Memory storage
websocket-hub:    # Port 8018 - Real-time comms
ml-inference:     # Port 8010 - ML operations
load-balancer:    # Port 8011 - Load distribution
cache-coordinator:# Port 8012 - Cache management
metrics-aggregator:# Port 8013 - Metrics collection
service-discovery:# Port 8014 - Service registry
```

### Rust Services (New)
```yaml
vision-service:        # Port 3033 - Image processing
vector-db:            # Port 3034 - Vector search
fast-llm-coordinator: # Port 3030 - LLM orchestration
llm-router:          # Port 3031 - Model routing
parameter-analytics: # Port 3032 - Analytics
```

### Monitoring Stack
```yaml
prometheus:      # Port 9090 - Metrics collection
grafana:        # Port 3000 - Visualization
jaeger:         # Port 16686 - Distributed tracing
```

### Legacy Services
```yaml
app:            # Port 9999 - TypeScript main app
legacy-api:     # Port 3001 - Legacy endpoints
```

## 🚀 Deployment Commands

### Development
```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# With hot reload
docker-compose -f docker-compose.dev.yml up -d --build
```

### Production
```bash
# Full production stack
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# With monitoring
docker-compose -f docker-compose.yml \
               -f docker-compose.prod.yml \
               -f docker-compose.telemetry.yml up -d
```

### Migration (New Backend)
```bash
# New Go/Rust services
docker-compose -f docker-compose.migration.yml up -d

# Hybrid mode (old + new)
docker-compose -f docker-compose.yml \
               -f docker-compose.migration.yml up -d
```

### ML Services
```bash
# ML stack with Ollama
docker-compose -f docker-compose.ml.yml \
               -f docker-compose.ollama.yml up -d
```

## 🔧 Docker Files Structure

### Service Dockerfiles
```
/go-services/
  ├── api-gateway/Dockerfile
  ├── auth-service/Dockerfile
  ├── chat-service/Dockerfile
  ├── memory-service/Dockerfile
  ├── websocket-hub/Dockerfile
  └── ml-inference/Dockerfile

/crates/
  ├── vision-service/Dockerfile
  ├── vector-db/Dockerfile
  └── fast-llm-coordinator/Dockerfile

/rust-services/
  ├── ab-mcts-service/Dockerfile
  └── parameter-analytics-service/Dockerfile
```

### Multi-stage Build Pattern
All our Dockerfiles use multi-stage builds for optimization:

```dockerfile
# Build stage
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY . .
RUN go build -o service .

# Production stage
FROM alpine:latest
COPY --from=builder /app/service .
CMD ["./service"]
```

## 📊 Resource Management

### Production Limits
```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G
    reservations:
      cpus: '0.5'
      memory: 512M
```

### Health Checks
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:PORT/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

## 🌐 Networking

### Networks
- **universal-ai-network**: Internal service communication
- **ai-network**: Legacy network (being phased out)

### Service Discovery
- Consul for dynamic service registration
- Internal DNS via Docker networks
- Health-based routing

## 📦 Volumes

### Persistent Data
```yaml
volumes:
  postgres_data:     # Database storage
  redis_data:        # Cache persistence
  model_cache:       # ML models
  prometheus_data:   # Metrics history
  grafana_data:      # Dashboard configs
  consul_data:       # Service registry
  nats_data:         # Message persistence
```

### Bind Mounts
```yaml
- ./logs:/app/logs           # Application logs
- ./cache:/app/cache         # File cache
- ./data:/app/data           # User data
- ./models:/app/models       # AI models
```

## 🔐 Environment Variables

### Core Configuration
```env
# Database
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/universal_ai_tools
REDIS_URL=redis://redis:6379

# Security
JWT_SECRET=your-secret-key
ENCRYPTION_KEY=your-encryption-key

# AI Services
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
LOCAL_LLM_ENDPOINT=http://ollama:11434

# Service URLs (Internal)
AUTH_SERVICE_URL=http://auth-service:8015
CHAT_SERVICE_URL=http://chat-service:8016
MEMORY_SERVICE_URL=http://memory-service:8017
VECTOR_DB_URL=http://vector-db:3034
```

## 🔄 Migration Strategy

### Phase 1: Parallel Deployment
```bash
# Run both old and new services
docker-compose -f docker-compose.yml up -d          # Old stack
docker-compose -f docker-compose.migration.yml up -d # New stack
```

### Phase 2: Gradual Routing
- API Gateway routes to new services
- Legacy fallback for unimplemented endpoints
- Monitor performance and errors

### Phase 3: Complete Migration
```bash
# Shut down legacy services
docker-compose -f docker-compose.yml down

# Run only new services
docker-compose -f docker-compose.migration.yml up -d
```

## 📈 Monitoring & Observability

### Access Points
- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Jaeger**: http://localhost:16686
- **Consul UI**: http://localhost:8500

### Key Metrics
- Service health status
- Request latency
- Error rates
- Resource usage
- Distributed traces

## 🛠️ Maintenance Commands

### Logs
```bash
# View all logs
docker-compose logs -f

# Specific service
docker-compose logs -f api-gateway

# Last 100 lines
docker-compose logs --tail=100 chat-service
```

### Cleanup
```bash
# Stop all services
docker-compose down

# Remove volumes (WARNING: deletes data)
docker-compose down -v

# Clean build cache
docker system prune -a
```

### Updates
```bash
# Rebuild services
docker-compose build --no-cache

# Update and restart specific service
docker-compose up -d --build api-gateway
```

## 🚨 Troubleshooting

### Common Issues

1. **Port conflicts**
   ```bash
   # Check port usage
   lsof -i :8080
   netstat -an | grep 8080
   ```

2. **Memory issues**
   ```bash
   # Increase Docker memory
   docker system prune
   # Adjust in Docker Desktop settings
   ```

3. **Network issues**
   ```bash
   # Recreate networks
   docker-compose down
   docker network prune
   docker-compose up -d
   ```

4. **Volume permissions**
   ```bash
   # Fix permissions
   docker-compose exec service_name chown -R user:group /path
   ```

## 🎯 Best Practices

1. **Always use health checks** for production services
2. **Set resource limits** to prevent memory leaks
3. **Use multi-stage builds** to minimize image size
4. **Pin version tags** for reproducible builds
5. **Use .dockerignore** to exclude unnecessary files
6. **Implement graceful shutdown** in services
7. **Log to stdout/stderr** for Docker log management
8. **Use secrets management** for sensitive data
9. **Regular security scanning** with `docker scan`
10. **Monitor resource usage** with `docker stats`

## 📚 Quick Reference

### Service URLs (Internal Docker Network)
```
http://api-gateway:8080
http://auth-service:8015
http://chat-service:8016
http://memory-service:8017
http://websocket-hub:8018
http://vision-service:3033
http://vector-db:3034
http://postgres:5432
http://redis:6379
http://consul:8500
http://jaeger:14268
```

### External Access (Host Machine)
```
http://localhost:8080   # API Gateway
http://localhost:9999   # Legacy App
http://localhost:3000   # Grafana
http://localhost:9090   # Prometheus
http://localhost:16686  # Jaeger UI
http://localhost:8500   # Consul UI
```

---

**Last Updated**: January 2025
**Docker Version**: 24.0+
**Compose Version**: 2.23+