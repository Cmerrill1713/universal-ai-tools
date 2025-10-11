# 🔌 Port Configuration Guide

## 🚨 Critical Port Conflicts Resolution

This document defines the port allocation strategy for the Universal AI Tools system, which is built with **Go, Rust, and Python services** (TypeScript backend has been replaced with Go services).

## 📋 Port Allocation Strategy

### 🦀 Rust Services (Core AI/ML Operations)

| Service          | Port | Status     | Purpose                        | Dependencies |
| ---------------- | ---- | ---------- | ------------------------------ | ------------ |
| **LLM Router**   | 3033 | ✅ Active  | Multi-provider AI model routing and inference | Ollama (11434), LM Studio (1234), MLX (8002) |
| **Assistantd**   | 8085 | ✅ Active  | Core AI assistant with RAG     | LLM Router (3033) |
| **ML Inference** | 8091 | ✅ Active  | Direct model inference         | Ollama (11434) |
| **Vector DB**    | 8092 | ✅ Active  | Vector storage and search      | None |

### 🐹 Go Services (Infrastructure & APIs)

| Service               | Port | Status          | Purpose                       | Dependencies |
| --------------------- | ---- | --------------- | ----------------------------- | ------------ |
| **API Gateway**       | 9999 | ✅ Active       | Main backend (replaces TypeScript) | All services |
| **Orchestration Service** | 8080 | ✅ Active   | Multi-service coordination    | All services |
| **Chat Service**      | 8016 | ✅ Active       | Chat management               | Memory Service (8017) |
| **Memory Service**    | 8017 | ✅ Active       | Memory and context management | PostgreSQL (5432) |
| **WebSocket Hub**     | 8082 | ✅ Active       | Real-time communication       | Redis (6379) |
| **Service Discovery** | 8083 | ✅ Active       | Service registration          | Consul (8500) |

### 🐍 Python Services (ML/AI Operations)

| Service               | Port | Status          | Purpose                       | Dependencies |
| --------------------- | ---- | --------------- | ----------------------------- | ------------ |
| **DSPy Orchestrator** | 8001 | ✅ Active       | ML orchestration              | None |
| **MLX Service**       | 8002 | ✅ Active       | Apple Silicon ML              | None |

### 🔧 Infrastructure Services

#### Native Services (Must Run on Host)
| Service          | Port | Status      | Purpose                                     |
| ---------------- | ---- | ----------- | ------------------------------------------- |
| **Ollama**       | 11434| ✅ Active   | Local LLM inference (Native)              |
| **LM Studio**    | 1234 | ✅ Active   | Alternative LLM interface (Native)         |

#### Docker Services (Optional)
| Service          | Port | Status      | Purpose                                     |
| ---------------- | ---- | ----------- | ------------------------------------------- |
| **PostgreSQL**   | 5432 | ✅ Active   | Primary database (Docker)                   |
| **Redis**        | 6379 | ✅ Active   | Caching and sessions (Docker)               |
| **Supabase DB**  | 54321| ✅ Active   | Supabase database (Docker)                  |
| **Supabase API** | 54322| ✅ Active   | Supabase API (Docker)                       |
| **Supabase REST**| 54323| ✅ Active   | Supabase REST (Docker)                     |

#### Minimal TypeScript Services
| Service          | Port | Status      | Purpose                                     |
| ---------------- | ---- | ----------- | ------------------------------------------- |
| **Main Backend** | 9999 | ✅ Active   | Dynamic model orchestration with multi-provider support |

## 🚨 Current Conflicts

### 1. Port 8080 Conflict

**Problem**: Both `assistantd` (Rust) and `weaviate` (Infrastructure) use port 8080

**Solution**:

- Keep `assistantd` on port 8080 (Rust AI service takes priority)
- Move `weaviate` to port 8084

### 2. Port 8080 Conflict (API Gateway)

**Problem**: Go API Gateway was configured for port 8080

**Solution**:

- Move Go API Gateway to port 8081
- Update all client configurations

## 🔧 Configuration Updates Required

### 1. Update Go API Gateway Port

**File**: `go-services/api-gateway/main.go`

```go
// Change from port 8080 to 8081
func main() {
    port := os.Getenv("API_GATEWAY_PORT")
    if port == "" {
        port = "8081" // Changed from 8080
    }

    log.Printf("API Gateway starting on port %s", port)
    // ... rest of configuration
}
```

### 2. Update Weaviate Port

**File**: `docker-compose.yml` or Weaviate configuration

```yaml
services:
  weaviate:
    ports:
      - "8084:8080" # Map external 8084 to internal 8080
    environment:
      - WEAVIATE_PORT=8080
```

### 3. Update Client Configurations

**File**: `web-frontend/index.html`

```javascript
// Update API Gateway URL if needed
this.apiGatewayURL = "http://127.0.0.1:8081"; // Changed from 8080
```

**File**: Rust services connecting to API Gateway

```rust
// Update any hardcoded API Gateway URLs
const API_GATEWAY_URL: &str = "http://127.0.0.1:8081"; // Changed from 8080
```

## 📊 Service Communication Matrix

### Request Flow:

```
Client → TypeScript Backend (9999) → LLM Router (3033) → Multi-Provider LLM Services
                                    ↓                           ↓
                              API Gateway (8081)         Ollama (11434)
                                    ↓                           ↓
                              Go Services (8013, 8015, 8017, 8082, 8083)  LM Studio (1234)
                                    ↓                           ↓
                              Python Services (8001, 8002)    MLX (8002)
                                    ↓
                              Infrastructure (5432 Docker, 6379 Docker)
```

### Multi-Provider LLM Architecture:

```
LLM Router (3033) - Intelligent Routing
├── Ollama Provider (11434)
│   ├── gpt-oss:20b
│   ├── llama3.2:3b
│   └── mistral:7b
├── LM Studio Provider (1234)
│   ├── qwen/qwen3-30b-a3b-2507
│   └── text-embedding-nomic-embed-text-v1.5
└── MLX Provider (8002)
    └── hrm-mlx
```

### Inter-Service Communication:

- **Rust ↔ Rust**: Direct function calls, shared memory
- **Go ↔ Go**: HTTP/gRPC, shared databases
- **Python ↔ Python**: HTTP APIs, shared models
- **Rust ↔ Go**: HTTP APIs, message queues
- **Rust ↔ Python**: HTTP APIs, model sharing
- **Go ↔ Python**: HTTP APIs, orchestration
- **All ↔ Infrastructure**: Database connections, cache access, LLM providers

## 🔍 Port Verification Commands

### Check Active Ports:

```bash
# Check Rust services
lsof -i :3033 -i :8080 -i :8091 -i :8092

# Check Go services  
lsof -i :8013 -i :8015 -i :8017 -i :8081 -i :8082 -i :8083

# Check Python services
lsof -i :8001 -i :8002

# Check TypeScript services
lsof -i :9999

# Check Native services
lsof -i :11434 -i :1234

# Check Docker services
lsof -i :5432 -i :6379 -i :54321 -i :54322 -i :54323

# Check specific service
curl http://127.0.0.1:3033/health  # LLM Router
curl http://127.0.0.1:8080/health  # Assistantd
curl http://127.0.0.1:8081/health  # API Gateway (after update)
curl http://127.0.0.1:8091/health  # ML Inference
curl http://127.0.0.1:8017/health  # Memory Service
```

### Service Health Check:

```bash
#!/bin/bash
# health-check.sh

echo "🔍 Universal AI Tools - Service Health Check"
echo "============================================="

services=(
    "LLM Router:3033"
    "Assistantd:8080"
    "API Gateway:8081"
    "ML Inference:8091"
    "Memory Service:8017"
    "Weaviate:8084"
)

for service in "${services[@]}"; do
    name=$(echo $service | cut -d: -f1)
    port=$(echo $service | cut -d: -f2)

    if curl -s http://127.0.0.1:$port/health >/dev/null 2>&1; then
        echo "✅ $name (port $port) - Healthy"
    else
        echo "❌ $name (port $port) - Unhealthy"
    fi
done
```

## 🚀 Implementation Steps

### Phase 1: Immediate Fixes

1. **Stop conflicting services**:

   ```bash
   pkill -f "api-gateway\|weaviate"
   ```

2. **Update API Gateway port**:

   ```bash
   # Edit go-services/api-gateway/main.go
   # Change port from 8080 to 8081
   ```

3. **Update Weaviate port**:
   ```bash
   # Update docker-compose.yml or Weaviate config
   # Change external port to 8084
   ```

### Phase 2: Service Restart

1. **Start services in order**:

   ```bash
   # Infrastructure first
   docker-compose up -d weaviate redis postgres

   # Go services
   go run go-services/api-gateway/main.go &
   go run go-services/memory-service/main.go &

   # Rust services
   cargo run -p llm-router &
   cargo run -p assistantd &
   cargo run -p ml-inference &
   ```

2. **Verify all services**:
   ```bash
   ./health-check.sh
   ```

### Phase 3: Client Updates

1. **Update web frontend**:

   - Update any hardcoded API Gateway URLs
   - Test frontend connectivity

2. **Update service configurations**:
   - Update inter-service communication URLs
   - Test service-to-service communication

## 📝 Environment Variables

### Service Port Configuration:

```bash
# Rust Services
export LLM_ROUTER_PORT=3033
export ASSISTANTD_PORT=8080
export ML_INFERENCE_PORT=8091
export VECTOR_DB_PORT=8092

# Go Services
export API_GATEWAY_PORT=8081
export MEMORY_SERVICE_PORT=8017
export WEBSOCKET_HUB_PORT=8082
export SERVICE_DISCOVERY_PORT=8083

# Infrastructure
export POSTGRES_PORT=5432
export REDIS_PORT=6379
export WEAVIATE_PORT=8084
```

## 🔧 Troubleshooting

### Common Issues:

1. **Port Already in Use**:

   ```bash
   # Find process using port
   lsof -i :8080

   # Kill process
   kill -9 <PID>
   ```

2. **Service Won't Start**:

   ```bash
   # Check port availability
   netstat -tulpn | grep :8080

   # Check service logs
   journalctl -u service-name -f
   ```

3. **Connection Refused**:

   ```bash
   # Verify service is running
   curl -v http://127.0.0.1:8080/health

   # Check firewall
   sudo ufw status
   ```

---

**Next Steps**: Implement the port changes and verify all services are running without conflicts.
