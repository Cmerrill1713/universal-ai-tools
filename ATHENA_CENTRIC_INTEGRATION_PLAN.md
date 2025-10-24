# 🎯 ATHENA-CENTRIC INTEGRATION PLAN

## Executive Summary

**Goal**: Route all AI services, tools, and interfaces through Athena as the central hub
**Current State**: Multiple separate systems (NeuroForge, Universal AI Tools, etc.)
**Target State**: Single unified system with Athena as the central orchestrator

## 🏗️ Current Athena Architecture

### ✅ **Already Working**
- **Native macOS Swift App** - Primary interface
- **Web Frontend** (Port 3000) - Browser access  
- **iPhone Access** (Port 80 via Nginx) - Mobile access
- **Unified Backend** (Port 8888) - Main API
- **Evolution System** (Port 8014) - Self-improvement
- **Complete Monitoring Stack** - Prometheus, Grafana, Netdata

### 🔄 **Integration Points**
- **Knowledge Gateway** (Port 8088) - RAG and knowledge management
- **Knowledge Context** (Port 8091) - Context management
- **Knowledge Sync** (Port 8089) - Knowledge synchronization
- **Weaviate** (Port 8090) - Vector database
- **SearXNG** (Port 8081) - Web search

## 📋 Integration Plan

### **Phase 1: Service Consolidation** (Week 1)

#### 1.1 Create Athena API Gateway
```yaml
# New service: athena-gateway
athena-gateway:
  image: universal-ai-tools-gateway:latest
  container_name: athena-gateway
  ports:
    - "127.0.0.1:8080:8080"  # Main gateway port
  environment:
    - ATHENA_API_URL=http://athena-api:8000
    - EVOLUTION_API_URL=http://athena-evolutionary:8004
    - KNOWLEDGE_GATEWAY_URL=http://athena-knowledge-gateway:8080
  depends_on:
    - athena-api
    - athena-evolutionary
```

#### 1.2 Route All Services Through Athena
- **NeuroForge** → Route through Athena API Gateway
- **Universal AI Tools** → Integrate with Athena backend
- **DSPy Orchestration** → Connect to Athena Evolution System
- **TRM/HRM Systems** → Integrate with Athena Knowledge Gateway

#### 1.3 Unified Service Discovery
```python
# athena-service-registry.py
SERVICES = {
    "athena-api": "http://athena-api:8000",
    "athena-evolutionary": "http://athena-evolutionary:8004", 
    "athena-knowledge-gateway": "http://athena-knowledge-gateway:8080",
    "athena-knowledge-context": "http://athena-knowledge-context:8080",
    "athena-knowledge-sync": "http://athena-knowledge-sync:8080",
    "athena-weaviate": "http://athena-weaviate:8080",
    "athena-searxng": "http://athena-searxng:8080"
}
```

### **Phase 2: API Gateway Implementation** (Week 2)

#### 2.1 Create Unified API Gateway
```python
# athena-gateway/main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx

app = FastAPI(title="Athena API Gateway", version="1.0.0")

# CORS for all interfaces
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Service routing
@app.post("/api/chat")
async def chat_endpoint(request: dict):
    """Route chat requests to Athena API"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://athena-api:8000/api/chat",
            json=request
        )
        return response.json()

@app.post("/api/evolution/analyze")
async def evolution_endpoint(request: dict):
    """Route evolution requests to Evolution API"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://athena-evolutionary:8004/api/evolution/analyze",
            json=request
        )
        return response.json()

@app.post("/api/knowledge/search")
async def knowledge_search(request: dict):
    """Route knowledge requests to Knowledge Gateway"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://athena-knowledge-gateway:8080/api/search",
            json=request
        )
        return response.json()
```

#### 2.2 Update All Client Applications
- **NeuroForge Swift App** → Point to `http://localhost:8080`
- **NeuroForge Python GUI** → Point to `http://localhost:8080`
- **Web Frontend** → Use gateway endpoints
- **iPhone App** → Route through gateway

### **Phase 3: Service Integration** (Week 3)

#### 3.1 Integrate DSPy Orchestration
```python
# athena-dspy-integration.py
class AthenaDSPyOrchestrator:
    def __init__(self):
        self.athena_api = "http://athena-api:8000"
        self.evolution_api = "http://athena-evolutionary:8004"
    
    async def orchestrate(self, task: str, context: dict):
        """Route DSPy orchestration through Athena"""
        # Use Athena's evolution system for orchestration
        response = await self.call_athena_evolution({
            "task": task,
            "context": context,
            "orchestration_mode": "dspy"
        })
        return response
```

#### 3.2 Integrate TRM/HRM Systems
```python
# athena-trm-integration.py
class AthenaTRMRouter:
    def __init__(self):
        self.athena_api = "http://athena-api:8000"
        self.knowledge_gateway = "http://athena-knowledge-gateway:8080"
    
    async def route_request(self, prompt: str, meta: dict):
        """Route TRM requests through Athena knowledge system"""
        # Use Athena's knowledge gateway for intelligent routing
        response = await self.call_athena_knowledge({
            "prompt": prompt,
            "meta": meta,
            "routing_mode": "trm"
        })
        return response
```

### **Phase 4: Unified Interface** (Week 4)

#### 4.1 Create Unified Startup Script
```bash
#!/bin/bash
# start-athena-unified.sh

echo "🎯 Starting Athena-Centric AI System"
echo "====================================="

# Start Athena stack
docker-compose -f docker-compose.athena.yml up -d

# Start additional integrated services
docker-compose -f docker-compose.integrated.yml up -d

# Wait for services
sleep 15

# Health check
echo "🔍 Checking service health..."
curl -f http://localhost:8080/health || echo "❌ Gateway not ready"
curl -f http://localhost:8888/health || echo "❌ Athena API not ready"
curl -f http://localhost:8014/health || echo "❌ Evolution API not ready"

echo "✅ Athena-Centric System Ready!"
echo "Access Points:"
echo "  • Main Gateway: http://localhost:8080"
echo "  • Athena API: http://localhost:8888"
echo "  • Web Frontend: http://localhost:3000"
echo "  • iPhone Access: http://192.168.1.198"
echo "  • Native App: Open Athena.app"
```

#### 4.2 Update All Documentation
- Update all service URLs to use Athena gateway
- Create unified API documentation
- Update setup guides for Athena-centric approach

## 🎯 Implementation Steps

### **Step 1: Create Athena Gateway Service**
```bash
# Create gateway service
mkdir -p athena-gateway
cd athena-gateway

# Create Dockerfile
cat > Dockerfile << 'EOF'
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
EOF

# Create requirements.txt
cat > requirements.txt << 'EOF'
fastapi==0.104.1
uvicorn==0.24.0
httpx==0.25.2
pydantic==2.5.0
EOF
```

### **Step 2: Update Docker Compose**
```yaml
# Add to docker-compose.athena.yml
athena-gateway:
  build: ./athena-gateway
  container_name: athena-gateway
  restart: unless-stopped
  ports:
    - "127.0.0.1:8080:8080"
  environment:
    - ATHENA_API_URL=http://athena-api:8000
    - EVOLUTION_API_URL=http://athena-evolutionary:8004
    - KNOWLEDGE_GATEWAY_URL=http://athena-knowledge-gateway:8080
  depends_on:
    - athena-api
    - athena-evolutionary
    - athena-knowledge-gateway
  networks:
    - athena-network
```

### **Step 3: Update Client Applications**
```swift
// NeuroForgeApp/NeuroForgeApp.swift
class AthenaService {
    private let baseURL = "http://localhost:8080"  // Gateway URL
    
    func sendMessage(_ message: String) async throws -> String {
        // Route through Athena gateway
        let response = try await apiClient.post("\(baseURL)/api/chat", body: [
            "message": message,
            "model": "llama3.2:3b"
        ])
        return response.response
    }
}
```

```python
# neuroforge_native_gui.py
class NeuroForgeApp:
    def __init__(self, root):
        self.backend_url = "http://localhost:8080"  # Gateway URL
        # ... rest of implementation
```

## 🚀 Benefits of Athena-Centric Approach

### **1. Unified Interface**
- Single entry point for all AI services
- Consistent API across all interfaces
- Centralized authentication and authorization

### **2. Service Orchestration**
- Athena Evolution System coordinates all services
- Intelligent routing based on task type
- Automatic service discovery and health monitoring

### **3. Knowledge Integration**
- All services share Athena's knowledge base
- Unified context management
- Centralized learning and evolution

### **4. Monitoring & Observability**
- Single monitoring dashboard for all services
- Centralized logging and metrics
- Unified alerting and health checks

### **5. Scalability**
- Easy to add new services through gateway
- Centralized load balancing
- Service mesh architecture

## 📊 Success Metrics

### **Phase 1 Complete**
- [ ] Athena Gateway running on port 8080
- [ ] All services accessible through gateway
- [ ] Client applications updated to use gateway
- [ ] Health checks passing for all services

### **Phase 2 Complete**
- [ ] DSPy orchestration integrated with Athena
- [ ] TRM/HRM systems routed through Athena
- [ ] Knowledge systems unified
- [ ] API documentation updated

### **Phase 3 Complete**
- [ ] Single startup script for entire system
- [ ] All interfaces working through Athena
- [ ] Monitoring dashboard shows all services
- [ ] Performance benchmarks met

## 🎯 Next Steps

1. **Create Athena Gateway Service** (Today)
2. **Update Docker Compose** (Today)
3. **Update Client Applications** (Tomorrow)
4. **Test Integration** (Day 3)
5. **Deploy and Monitor** (Day 4)

This plan ensures everything runs through Athena as the central hub while maintaining all existing functionality and adding new capabilities.