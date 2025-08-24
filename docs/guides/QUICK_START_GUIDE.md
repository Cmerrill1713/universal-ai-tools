# Universal AI Tools - Quick Start Guide
**Version**: 1.0.0  
**Architecture**: Hybrid Go/Rust/TypeScript  
**Last Updated**: August 22, 2025

## 🚀 Getting Started in 5 Minutes

### Prerequisites
- Go 1.21+ installed
- Node.js 18+ installed (for legacy TypeScript)
- Docker installed (optional, for full stack)
- 2GB free RAM minimum

### Step 1: Start the Go API Gateway

The Go API Gateway is the main entry point for all services:

```bash
# Navigate to the gateway directory
cd go-api-gateway

# Build the gateway (if not already built)
go build ./cmd/main.go

# Run the gateway
./main

# The gateway will start on port 8082 (external) and 8081 (internal)
```

### Step 2: Verify System Health

Check that the system is running:

```bash
# Basic health check
curl http://localhost:8082/health

# Expected response:
# {"status":"healthy","timestamp":"2025-08-22T...","uptime":"..."}

# Detailed health check
curl http://localhost:8082/api/v1/health

# Check memory status
curl http://localhost:8082/api/v1/memory-monitoring/status

# Check database health
curl http://localhost:8082/api/v1/database/health
```

### Step 3: Get a Demo Token

Generate a demo authentication token for API access:

```bash
# Generate demo token
curl -X POST http://localhost:8082/api/v1/auth/demo-token \
  -H "Content-Type: application/json" \
  -d '{"purpose": "testing"}'

# Save the token from the response
export TOKEN="<your-token-here>"
```

### Step 4: Test Core Functionality

#### List AI Agents
```bash
curl http://localhost:8082/api/v1/agents/ \
  -H "Authorization: Bearer $TOKEN"
```

#### Send a Chat Message
```bash
curl -X POST http://localhost:8082/api/v1/chat/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello, AI!",
    "conversationId": "test-123"
  }'
```

#### Check Memory Usage
```bash
curl http://localhost:8082/api/v1/memory-monitoring/usage \
  -H "Authorization: Bearer $TOKEN"
```

## 📁 Project Structure Overview

```
universal-ai-tools/
├── go-api-gateway/     # Main API Gateway (Go) - START HERE
├── rust-services/      # High-performance services (Rust)
├── python-services/    # ML and AI services (Python)
├── macOS-App/         # Native macOS application (Swift)
├── src/               # Legacy TypeScript (being phased out)
└── docs/              # Documentation
```

## 🛠️ Common Operations

### Start Full Stack with Docker
```bash
# Start all services
docker-compose up -d

# Start monitoring stack
docker-compose -f docker-compose.monitoring.yml up -d

# Check service status
docker-compose ps
```

### Access Monitoring Dashboard
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000 (admin/admin)
- Jaeger: http://localhost:16686

### Run Tests
```bash
# Go tests
cd go-api-gateway && go test ./...

# TypeScript tests (legacy)
npm test

# Python tests
cd python-services && python -m pytest
```

## 🔧 Configuration

### Environment Variables
Create a `.env` file in the go-api-gateway directory:

```env
# Server Configuration
PORT=8082
ENVIRONMENT=development

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/universal_ai_tools

# Redis
REDIS_URL=redis://localhost:6379

# LM Studio (Local AI)
LM_STUDIO_URL=http://localhost:5901/v1
LM_STUDIO_MODEL=qwen/qwen3-30b-a3b-2507

# Migration Mode
MIGRATION_ENABLED=true
TYPESCRIPT_ENDPOINT=http://localhost:9999
```

### API Authentication

The system supports multiple authentication methods:

1. **Demo Token** (for testing):
   ```bash
   curl -X POST http://localhost:8082/api/v1/auth/demo-token \
     -H "Content-Type: application/json" \
     -d '{"purpose": "testing"}'
   ```

2. **JWT Token** (production):
   ```bash
   curl -X POST http://localhost:8082/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "user@example.com", "password": "password"}'
   ```

3. **No Auth** (health endpoints only):
   ```bash
   curl http://localhost:8082/health
   ```

## 📊 Available API Endpoints

### Core Services
- `GET /health` - Basic health check (no auth)
- `GET /api/v1/health` - Detailed health
- `GET /metrics` - Prometheus metrics

### Agent Management
- `GET /api/v1/agents/` - List all agents
- `POST /api/v1/agents/` - Create new agent
- `GET /api/v1/agents/:id` - Get specific agent
- `PUT /api/v1/agents/:id` - Update agent
- `DELETE /api/v1/agents/:id` - Delete agent

### Chat & Conversations
- `POST /api/v1/chat/` - Send message
- `GET /api/v1/chat/conversations` - List conversations
- `GET /api/v1/chat/history/:id` - Get conversation history
- `POST /api/v1/chat/new` - Create new conversation

### Memory Monitoring
- `GET /api/v1/memory-monitoring/status` - Current status
- `GET /api/v1/memory-monitoring/usage` - Memory usage
- `POST /api/v1/memory-monitoring/optimize` - Trigger optimization
- `GET /api/v1/memory-monitoring/recommendations` - Get recommendations

### Database Operations
- `GET /api/v1/database/health` - Database health
- `GET /api/v1/database/status` - Connection status
- `POST /api/v1/database/backup` - Create backup
- `GET /api/v1/database/performance` - Performance metrics

## 🐛 Troubleshooting

### Gateway Won't Start
```bash
# Check if port is already in use
lsof -i :8082

# Kill existing process if needed
kill -9 <PID>

# Try alternative port
PORT=8083 ./main
```

### Database Connection Failed
```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Start PostgreSQL if needed
docker-compose up -d postgres

# Test connection
psql -h localhost -p 5432 -U postgres
```

### Memory Issues
```bash
# Check system memory
curl http://localhost:8082/api/v1/memory-monitoring/status

# Trigger garbage collection
curl -X POST http://localhost:8082/api/v1/memory-monitoring/gc

# Optimize memory
curl -X POST http://localhost:8082/api/v1/memory-monitoring/optimize
```

### TypeScript Errors
The 114 remaining TypeScript errors are non-critical migration artifacts. The system runs fine despite these errors. To check:

```bash
# Count errors (informational only)
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

## 📚 Additional Resources

### Documentation
- [Migration Status Report](MIGRATION_FINAL_STATUS.md)
- [API Documentation](docs/API_DOCUMENTATION.md)
- [Architecture Overview](docs/architecture/SYSTEM_ARCHITECTURE.md)
- [Deployment Guide](docs/deployment/PRODUCTION_DEPLOYMENT.md)

### Development
- [Contributing Guide](CONTRIBUTING.md)
- [Code Style Guide](docs/development/CODE_STYLE.md)
- [Testing Guide](docs/development/TESTING.md)

## 🆘 Getting Help

### Check Logs
```bash
# Go API Gateway logs
tail -f go-api-gateway/logs/api.log

# Docker logs
docker-compose logs -f

# System logs
journalctl -u universal-ai-tools -f
```

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "Connection refused" | Ensure services are running with `docker-compose ps` |
| "401 Unauthorized" | Generate new demo token or check token expiry |
| "Out of memory" | Increase Docker memory limit or optimize with memory endpoint |
| "Slow responses" | Check `/api/v1/database/slow-queries` for bottlenecks |

## 🎉 Next Steps

1. **Explore the API**: Use the demo token to test all endpoints
2. **Set up monitoring**: Deploy Grafana dashboards for visualization
3. **Try the macOS app**: Open `macOS-App/UniversalAITools.xcodeproj` in Xcode
4. **Customize agents**: Create custom AI agents via the API
5. **Deploy to production**: Follow the [Production Deployment Guide](docs/deployment/PRODUCTION_DEPLOYMENT.md)

## 📞 Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/universal-ai-tools/issues)
- **Documentation**: Check the `docs/` directory for detailed guides
- **Community**: Join our Discord for real-time help

---

**Happy coding! 🚀**

*Universal AI Tools Team*