# Universal AI Tools - Unified Frontend + Backend Deployment Guide

## 🎯 Overview

This guide provides complete instructions for deploying the Universal AI Tools as a unified application with Swift frontend and Go backend services, all packaged together with monitoring and infrastructure.

## 📦 What's Included

### Frontend (Swift)
- **SwiftUI Application** with native macOS interface
- **Health Server** for monitoring and status checks
- **Backend Service Integration** with Go microservices
- **Real-time Status Monitoring** of all backend services

### Backend Services (Go)
- **Knowledge Gateway** (port 8088) - Unified knowledge operations
- **Knowledge Sync** (port 8089) - Data synchronization between systems
- **Knowledge Context** (port 8091) - Conversation and session management

### Infrastructure
- **Redis** (port 6379) - Caching and session storage
- **Weaviate** (port 8090) - Vector database for semantic search
- **Supabase** (port 54321) - PostgreSQL database and API
- **Grafana** (port 3000) - Monitoring dashboard
- **Prometheus** (port 9090) - Metrics collection

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose installed
- macOS (for Swift frontend) or Docker Desktop
- 8GB+ RAM recommended
- 10GB+ free disk space

### One-Command Deployment
```bash
./deploy-unified.sh
```

This single command will:
1. ✅ Check all requirements
2. ✅ Build all services (Swift + Go)
3. ✅ Start the complete stack
4. ✅ Wait for health checks
5. ✅ Test functionality
6. ✅ Display status and access points

## 📁 Project Structure

```
universal-ai-tools/
├── UniversalAIToolsApp/           # Swift Frontend
│   ├── Sources/
│   │   ├── UniversalAIToolsApp.swift
│   │   ├── BackendService.swift   # Go service integration
│   │   ├── HealthServer.swift     # HTTP health server
│   │   └── [other Swift files]
│   ├── config/
│   │   └── backend-config.json    # Service configuration
│   └── Dockerfile                 # Swift app containerization
├── go-services/                   # Go Backend Services
│   ├── knowledge-gateway/
│   ├── knowledge-sync/
│   └── knowledge-context/
├── docker-compose.unified.yml     # Complete stack definition
├── deploy-unified.sh              # Deployment script
├── test-unified.sh                # Test script
└── [other project files]
```

## 🔧 Manual Deployment Steps

### 1. Build Services
```bash
# Build Go services
docker-compose -f docker-compose.unified.yml build knowledge-gateway knowledge-sync knowledge-context

# Build Swift frontend
docker-compose -f docker-compose.unified.yml build universal-ai-frontend

# Build monitoring
docker-compose -f docker-compose.unified.yml build grafana prometheus
```

### 2. Start Infrastructure
```bash
# Start core infrastructure
docker-compose -f docker-compose.unified.yml up -d redis weaviate

# Wait for infrastructure
sleep 10
```

### 3. Start Backend Services
```bash
# Start Go knowledge services
docker-compose -f docker-compose.unified.yml up -d knowledge-gateway knowledge-sync knowledge-context

# Wait for services
sleep 15
```

### 4. Start Frontend & Monitoring
```bash
# Start monitoring
docker-compose -f docker-compose.unified.yml up -d prometheus grafana

# Start frontend
docker-compose -f docker-compose.unified.yml up -d universal-ai-frontend
```

## 🧪 Testing the Deployment

### Quick Health Check
```bash
./test-unified.sh
```

### Manual Testing
```bash
# Test frontend health
curl http://localhost:8080/health

# Test knowledge gateway
curl http://localhost:8088/health

# Test knowledge search
curl -X POST http://localhost:8088/search \
  -H "Content-Type: application/json" \
  -d '{"query":"test","limit":5}'

# Test context storage
curl -X POST http://localhost:8091/context \
  -H "Content-Type: application/json" \
  -d '{"session_id":"test","message":"Hello","user_id":"user123"}'
```

## 🌐 Access Points

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | http://localhost:8080 | Swift UI Application |
| **Knowledge Gateway** | http://localhost:8088 | Knowledge operations API |
| **Knowledge Sync** | http://localhost:8089 | Data synchronization API |
| **Knowledge Context** | http://localhost:8091 | Context management API |
| **Grafana** | http://localhost:3000 | Monitoring dashboard |
| **Prometheus** | http://localhost:9090 | Metrics collection |
| **Weaviate** | http://localhost:8090 | Vector database |
| **Supabase** | http://localhost:54321 | Database and API |

## 📊 Monitoring & Observability

### Health Checks
All services provide health endpoints:
- `GET /health` - Service health status
- `GET /status` - Detailed service information

### Metrics
- **Prometheus**: Collects metrics from all services
- **Grafana**: Visualizes metrics and system status
- **AI Metrics Exporter**: Custom AI-specific metrics

### Logs
```bash
# View all logs
docker-compose -f docker-compose.unified.yml logs -f

# View specific service logs
docker-compose -f docker-compose.unified.yml logs -f universal-ai-frontend
docker-compose -f docker-compose.unified.yml logs -f knowledge-gateway
```

## 🔄 Development Workflow

### Making Changes
1. **Frontend Changes**: Edit Swift files in `UniversalAIToolsApp/Sources/`
2. **Backend Changes**: Edit Go files in `go-services/`
3. **Rebuild**: Run `./deploy-unified.sh` to rebuild and redeploy
4. **Test**: Run `./test-unified.sh` to verify changes

### Hot Reloading (Development)
```bash
# Start in development mode with file watching
docker-compose -f docker-compose.unified.yml up -d
# Make changes to source files
# Rebuild specific service
docker-compose -f docker-compose.unified.yml build knowledge-gateway
docker-compose -f docker-compose.unified.yml up -d knowledge-gateway
```

## 🛠️ Configuration

### Environment Variables
Create `.env` file:
```bash
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key
GRAFANA_PASSWORD=your_grafana_password
REDIS_PASSWORD=your_redis_password
```

### Service Configuration
Edit `UniversalAIToolsApp/config/backend-config.json` to modify:
- Service URLs and endpoints
- Timeout settings
- Feature flags
- Monitoring configuration

## 🚨 Troubleshooting

### Common Issues

**Services not starting:**
```bash
# Check Docker status
docker ps

# Check logs
docker-compose -f docker-compose.unified.yml logs

# Restart services
docker-compose -f docker-compose.unified.yml restart
```

**Port conflicts:**
```bash
# Check what's using ports
lsof -i :8080
lsof -i :8088
lsof -i :8089
lsof -i :8091

# Stop conflicting services
sudo lsof -ti:8080 | xargs kill -9
```

**Memory issues:**
```bash
# Check Docker memory usage
docker stats

# Increase Docker memory limit in Docker Desktop settings
```

### Health Check Failures
```bash
# Test individual services
curl http://localhost:8080/health  # Frontend
curl http://localhost:8088/health  # Knowledge Gateway
curl http://localhost:8089/health  # Knowledge Sync
curl http://localhost:8091/health  # Knowledge Context
```

## 📈 Performance Optimization

### Resource Limits
Add to `docker-compose.unified.yml`:
```yaml
services:
  universal-ai-frontend:
    deploy:
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M
```

### Scaling Services
```bash
# Scale knowledge services
docker-compose -f docker-compose.unified.yml up -d --scale knowledge-gateway=3
```

## 🔒 Security Considerations

### Production Deployment
1. **Change default passwords** in `.env`
2. **Enable authentication** for monitoring services
3. **Use HTTPS** for external access
4. **Restrict network access** with firewalls
5. **Regular security updates** for base images

### Network Security
```yaml
networks:
  universal-ai-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

## 📚 API Documentation

### Knowledge Gateway API
- `POST /search` - Search knowledge base
- `POST /store` - Store knowledge
- `GET /health` - Health check

### Knowledge Context API
- `POST /context` - Store context
- `GET /context/{id}` - Retrieve context
- `DELETE /context/{id}` - Delete context

### Knowledge Sync API
- `POST /sync` - Sync data
- `POST /sync/full` - Full synchronization
- `GET /status` - Sync status

## 🎉 Success Indicators

After successful deployment, you should see:

✅ **All containers running:**
```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

✅ **All health checks passing:**
```bash
curl http://localhost:8080/health | jq .status  # "healthy"
```

✅ **Frontend accessible:**
- Open http://localhost:8080 in browser
- See Universal AI Tools interface

✅ **Backend APIs responding:**
- Knowledge search working
- Context management working
- Data sync operational

✅ **Monitoring active:**
- Grafana dashboard at http://localhost:3000
- Prometheus metrics at http://localhost:9090

## 🆘 Support

### Getting Help
1. Check logs: `docker-compose -f docker-compose.unified.yml logs`
2. Run tests: `./test-unified.sh`
3. Check health: `curl http://localhost:8080/health`
4. Review this guide for troubleshooting steps

### Clean Restart
```bash
# Stop everything
docker-compose -f docker-compose.unified.yml down

# Remove volumes (WARNING: deletes data)
docker-compose -f docker-compose.unified.yml down -v

# Restart fresh
./deploy-unified.sh
```

---

**🎯 Your Universal AI Tools unified application is now ready for production use!**

*Generated: $(date)*
*Version: 1.0.0*
*Status: Production Ready*
