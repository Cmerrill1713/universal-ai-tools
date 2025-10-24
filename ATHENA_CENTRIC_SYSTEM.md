# 🎯 ATHENA-CENTRIC AI SYSTEM

## Overview

**Athena is now the central hub for all AI services.** Everything routes through Athena's unified API Gateway, providing a single entry point for all AI capabilities.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ATHENA-CENTRIC SYSTEM                    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              ATHENA API GATEWAY                     │   │
│  │                Port 8080                            │   │
│  │         (Central Hub & Router)                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                               │
│  ┌─────────────────────────┼─────────────────────────┐   │
│  │                         │                         │   │
│  ▼                         ▼                         ▼   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │   │
│  │   Athena    │  │ Evolution   │  │ Knowledge   │   │   │
│  │    API      │  │    API      │  │  Gateway    │   │   │
│  │  Port 8888  │  │ Port 8014   │  │ Port 8088   │   │   │
│  └─────────────┘  └─────────────┘  └─────────────┘   │   │
│                                                         │   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              USER INTERFACES                        │   │
│  │  • Native macOS App (Athena.app)                   │   │
│  │  • Web Frontend (localhost:3000)                   │   │
│  │  • iPhone Access (192.168.1.198)                   │   │
│  │  • Python GUI (neuroforge_native_gui.py)           │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### 1. Start Athena-Centric System
```bash
./start-athena-unified.sh
```

### 2. Access Points
- **Main Gateway**: http://localhost:8080
- **Web Frontend**: http://localhost:3000
- **iPhone Access**: http://192.168.1.198
- **Native macOS**: Open Athena.app

### 3. Test Integration
```bash
python3 test-athena-integration.py
```

## 📡 API Endpoints

All endpoints are available through the Athena Gateway (Port 8080):

### Core Endpoints
- `GET /health` - System health check
- `GET /api/services` - List all services
- `GET /` - System information

### AI Endpoints
- `POST /api/chat` - Chat with Athena
- `POST /api/evolution/analyze` - Evolution system
- `POST /api/orchestrate` - Unified orchestration

### Knowledge Endpoints
- `POST /api/knowledge/search` - Search knowledge base
- `POST /api/knowledge/context` - Get context
- `POST /api/search/web` - Web search

## 🔧 Service Integration

### Athena API Gateway
- **Port**: 8080
- **Purpose**: Central routing hub
- **Features**: 
  - Service discovery
  - Health monitoring
  - Request routing
  - Error handling

### Backend Services
- **Athena API** (Port 8888): Main AI processing
- **Evolution API** (Port 8014): Self-improvement system
- **Knowledge Gateway** (Port 8088): RAG and knowledge management
- **Knowledge Context** (Port 8091): Context management
- **Knowledge Sync** (Port 8089): Knowledge synchronization

### Data Services
- **Weaviate** (Port 8090): Vector database
- **PostgreSQL** (Port 5432): Relational database
- **Redis** (Port 6379): Cache and sessions
- **SearXNG** (Port 8081): Web search

## 🎯 Client Integration

### Native macOS App
```swift
// NeuroForgeApp/NeuroForgeApp.swift
class AthenaService {
    private let baseURL = "http://localhost:8080"  // Gateway URL
    
    func sendMessage(_ message: String) async throws -> String {
        let response = try await apiClient.post("\(baseURL)/api/chat", body: [
            "message": message,
            "model": "llama3.2:3b"
        ])
        return response.response
    }
}
```

### Python GUI
```python
# neuroforge_native_gui.py
class NeuroForgeApp:
    def __init__(self, root):
        self.backend_url = "http://localhost:8080"  # Gateway URL
        # ... rest of implementation
```

### Web Frontend
```javascript
// All API calls go through gateway
const API_BASE = 'http://localhost:8080';

async function sendMessage(message) {
    const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, model: 'llama3.2:3b' })
    });
    return response.json();
}
```

## 🔍 Monitoring & Health

### Health Check
```bash
curl http://localhost:8080/health
```

### Service Status
```bash
curl http://localhost:8080/api/services
```

### Monitoring Dashboards
- **Netdata**: http://localhost:19999
- **Grafana**: http://localhost:3001
- **Prometheus**: http://localhost:9090

## 🛠️ Management Commands

### Start System
```bash
./start-athena-unified.sh
```

### View Logs
```bash
docker-compose -f docker-compose.athena.yml logs -f
```

### Stop System
```bash
docker-compose -f docker-compose.athena.yml down
```

### Restart System
```bash
docker-compose -f docker-compose.athena.yml restart
```

### Rebuild Gateway
```bash
docker-compose -f docker-compose.athena.yml up -d --build athena-gateway
```

## 🧪 Testing

### Integration Test
```bash
python3 test-athena-integration.py
```

### Manual API Tests
```bash
# Test chat
curl -X POST http://localhost:8080/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello Athena!"}'

# Test health
curl http://localhost:8080/health

# Test services
curl http://localhost:8080/api/services
```

## 🔄 Service Routing

### Chat Requests
```
User → Gateway (8080) → Athena API (8888) → Response
```

### Evolution Requests
```
User → Gateway (8080) → Evolution API (8014) → Response
```

### Knowledge Requests
```
User → Gateway (8080) → Knowledge Gateway (8088) → Weaviate (8090) → Response
```

### Web Search
```
User → Gateway (8080) → SearXNG (8081) → Response
```

## 🎯 Benefits

### 1. Unified Interface
- Single entry point for all AI services
- Consistent API across all interfaces
- Centralized authentication and authorization

### 2. Service Orchestration
- Athena Evolution System coordinates all services
- Intelligent routing based on task type
- Automatic service discovery and health monitoring

### 3. Knowledge Integration
- All services share Athena's knowledge base
- Unified context management
- Centralized learning and evolution

### 4. Monitoring & Observability
- Single monitoring dashboard for all services
- Centralized logging and metrics
- Unified alerting and health checks

### 5. Scalability
- Easy to add new services through gateway
- Centralized load balancing
- Service mesh architecture

## 🚨 Troubleshooting

### Gateway Not Responding
```bash
# Check if gateway is running
docker-compose -f docker-compose.athena.yml ps athena-gateway

# Check gateway logs
docker-compose -f docker-compose.athena.yml logs athena-gateway

# Restart gateway
docker-compose -f docker-compose.athena.yml restart athena-gateway
```

### Service Health Issues
```bash
# Check all services
curl http://localhost:8080/health

# Check individual services
curl http://localhost:8888/health  # Athena API
curl http://localhost:8014/health  # Evolution API
```

### Client Connection Issues
```bash
# Test from client machine
curl http://192.168.1.198:8080/health  # iPhone access
curl http://localhost:8080/health      # Local access
```

## 📚 Documentation

- **API Documentation**: http://localhost:8080/docs
- **Integration Guide**: ATHENA_CENTRIC_INTEGRATION_PLAN.md
- **Setup Guide**: ATHENA_COMPLETE_SETUP.md
- **Architecture**: ARCHITECTURE.md

## 🎉 Success!

Your Athena-Centric AI System is now operational! All AI services route through Athena as the central hub, providing a unified, scalable, and maintainable platform for all your AI needs.

**Key Points:**
- ✅ All services accessible through port 8080
- ✅ Unified API across all interfaces
- ✅ Centralized monitoring and health checks
- ✅ Easy to add new services
- ✅ Consistent user experience

**Next Steps:**
1. Test all interfaces (macOS app, web, iPhone)
2. Monitor system health
3. Add new services through the gateway
4. Enjoy your unified AI system!