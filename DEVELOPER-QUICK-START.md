# 🚀 Developer Quick Start Guide

## 📋 Service Overview

### 🦀 Rust Services (AI/ML)

- **LLM Router** (3033) - AI model routing and inference
- **Assistantd** (8080) - Core AI assistant with RAG
- **ML Inference** (8091) - Direct model inference
- **Vector DB** (8092) - Vector storage and search

### 🐹 Go Services (Networking)

- **API Gateway** (8081) - Central API routing
- **Memory Service** (8017) - Memory and context management
- **WebSocket Hub** (8082) - Real-time communication
- **Service Discovery** (8083) - Service registration

## 🔧 Quick Commands

### Start All Services

```bash
# Start Rust services
cargo run -p llm-router &
cargo run -p assistantd &
cargo run -p ml-inference &

# Start Go services
go run go-services/api-gateway/main.go &
go run go-services/memory-service/main.go &

# Start web frontend
cd web-frontend && python3 -m http.server 3000 &
```

### Health Checks

```bash
curl http://127.0.0.1:3033/health  # LLM Router
curl http://127.0.0.1:8080/health  # Assistantd
curl http://127.0.0.1:8091/health  # ML Inference
curl http://127.0.0.1:8017/health  # Memory Service
```

### Test AI Chat

```bash
curl -X POST http://127.0.0.1:3033/chat \
  -H "Content-Type: application/json" \
  -H "X-User-ID: test-user" \
  -d '{
    "messages": [{"role": "user", "content": "Hello!"}],
    "model": "llama3.1:8b"
  }'
```

## 🌐 Web Interface

- **Frontend**: http://localhost:3000
- **Backend**: http://127.0.0.1:3033

## 📚 Documentation

- **Architecture**: `ARCHITECTURE.md`
- **Rust Services**: `RUST-SERVICES.md`
- **Go Services**: `GO-SERVICES.md`
- **Port Configuration**: `PORT-CONFIGURATION.md`

## 🚨 Common Issues

### Port Conflicts

```bash
# Check active ports
lsof -i :3033 -i :8080 -i :8081 -i :8091

# Kill conflicting processes
pkill -f "service-name"
```

### Service Won't Start

```bash
# Check compilation
cargo check --workspace

# Check Go modules
go mod tidy
```

### Connection Refused

```bash
# Verify service is running
curl -v http://127.0.0.1:PORT/health

# Check service logs
journalctl -u service-name -f
```

## 🔍 Development Workflow

### 1. Make Changes

- Edit Rust code in `crates/`
- Edit Go code in `go-services/`

### 2. Test Changes

```bash
# Rust services
cargo test --workspace

# Go services
go test ./go-services/...
```

### 3. Restart Services

```bash
# Kill and restart
pkill -f "service-name"
cargo run -p service-name &
```

### 4. Verify

```bash
# Health check
curl http://127.0.0.1:PORT/health

# Functional test
curl -X POST http://127.0.0.1:PORT/endpoint -d '{"test": "data"}'
```

## 📊 Performance Targets

### Rust Services

- Response time: <50ms
- Memory usage: <100MB
- Concurrency: 1000+ requests

### Go Services

- Response time: <10ms
- Memory usage: <200MB
- Concurrency: 10,000+ connections

## 🛠️ Tools

### Monitoring

```bash
# Check service status
ps aux | grep -E "(llm-router|assistantd|ml-inference)"

# Check port usage
netstat -tulpn | grep -E "(3033|8080|8081|8091)"
```

### Logging

```bash
# Rust services
RUST_LOG=debug cargo run -p service-name

# Go services
go run service-name -log-level=debug
```

---

**Need Help?** Check the detailed documentation in `ARCHITECTURE.md`, `RUST-SERVICES.md`, and `GO-SERVICES.md`.
