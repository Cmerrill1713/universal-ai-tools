# Athena Container Status

## Current Setup: 14 Essential Containers

### ✅ Running Containers (Production Ready)

| # | Container Name | Port | Purpose | Status |
|---|---|---|---|---|
| 1 | athena-frontend | 3000 | Web UI | ✅ Running |
| 2 | universal-ai-tools-python-api | 8888 | Main API | ✅ Healthy |
| 3 | unified-evolutionary-api | 8014 | Prompt Engineering | ✅ Healthy |
| 4 | unified-postgres | 5432 | Database | ✅ Healthy |
| 5 | unified-redis | 6379 | Cache | ✅ Healthy |
| 6 | athena-weaviate | 8090 | Vector DB | ✅ Running |
| 7 | athena-searxng | 8081 | Search Engine | ✅ Running |
| 8 | grafana | 3001 | Dashboards | ✅ Running |
| 9 | unified-netdata | 19999 | System Monitoring | ✅ Healthy |
| 10 | unified-prometheus | 9090 | Metrics | ✅ Running |
| 11 | unified-alertmanager | 9093 | Alerts | ✅ Running |
| 12 | unified-node-exporter | 9100 | Node Metrics | ✅ Running |
| 13 | unified-postgres-exporter | 9187 | DB Metrics | ✅ Running |
| 14 | unified-redis-exporter | 9121 | Cache Metrics | ✅ Running |

**Plus Native Services:**
- MLX TTS Kokoro (port 8877) - Native process for high-quality TTS

---

## Available Container Sets

### Option 1: Current (14 containers) ✅ **ACTIVE**
**Status:** Working perfectly
**Resource Usage:** ~6 GB RAM
**Best For:** Chat tuning, development, feature testing

### Option 2: Knowledge Enhanced (21 containers)
**Would Add:**
- knowledge-gateway (8088) - Advanced RAG
- knowledge-sync (8089) - Data sync
- knowledge-context (8091) - Context mgmt
- 10 Supabase containers - Auth & DB
- loki-grounded (3101) - Log aggregation
- ai-metrics-exporter (9092) - AI metrics

**Status:** Requires working docker-compose build
**Resource Usage:** ~10 GB RAM
**Best For:** Production deployment, advanced knowledge features

### Option 3: Full Enterprise (30 containers)
**Would Add Everything Above Plus:**
- trivy-scanner - Security scanning
- opa - Policy enforcement
- falco - Threat detection
- k6-load-tester - Performance testing
- circuit-breaker - Resilience
- auto-scaler - Auto scaling
- backup-service - Automated backups
- bias-detector - AI bias detection
- performance-benchmark - Benchmarking

**Status:** Requires fixes to docker-compose.grounding.yml
**Resource Usage:** ~15 GB RAM
**Best For:** Enterprise production, compliance requirements

---

## Recommendation for Chat Tuning

### ✅ Stick with Current 14 Containers

**Why:**
1. **All Core Features Present**
   - Backend API with prompt engineering ✅
   - Vector database for RAG ✅
   - Search integration ✅
   - TTS with natural voices ✅
   - Complete monitoring stack ✅

2. **Perfect for Tuning**
   - Fast iteration cycles
   - Lower resource overhead
   - Easy to monitor changes
   - All chat features accessible

3. **Monitoring Capabilities**
   - Grafana dashboards
   - Prometheus metrics
   - Netdata real-time monitoring
   - All exporters active

4. **What You Can Tune**
   - Prompt engineering (unified-evolutionary-api)
   - Response quality (main API)
   - Context management (Weaviate)
   - TTS voice selection
   - Search integration
   - Performance metrics

---

## Adding More Containers Later

When you need additional features:

### Add Supabase (Auth & Advanced DB)
```bash
docker-compose -f docker-compose.supabase.yml up -d
```

### Add Log Aggregation (Loki)
```bash
docker run -d --name loki \
  -p 3100:3100 \
  grafana/loki:latest
```

### Add Knowledge Gateway
```bash
# Build from source when ready
cd services/knowledge-gateway
docker build -t knowledge-gateway .
docker run -d --name knowledge-gateway \
  -p 8088:8088 \
  knowledge-gateway
```

---

## Quick Commands

### View All Containers
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### Check Resource Usage
```bash
docker stats --no-stream
```

### View Logs
```bash
# API logs
docker logs universal-ai-tools-python-api --tail 50

# Evolutionary API logs
docker logs unified-evolutionary-api --tail 50

# Frontend logs
docker logs athena-frontend --tail 50
```

### Restart All Services
```bash
docker restart $(docker ps -q)
```

### Health Check All Services
```bash
echo "API:" && curl -s http://localhost:8888/health | jq
echo "Evolutionary:" && curl -s http://localhost:8014/health | jq
echo "Weaviate:" && curl -s http://localhost:8090/v1/.well-known/ready
echo "TTS:" && curl -s http://localhost:8877/health | jq
```

---

## Current System Capabilities

### ✅ Chat Features Available Now
- [x] AI chat with context
- [x] Prompt engineering (agentic)
- [x] TTS with 6 voices (sarah, eric, bella, adam, jessica, michael)
- [x] Vector database for RAG
- [x] Web search integration
- [x] Conversation history (PostgreSQL)
- [x] Response caching (Redis)
- [x] Performance monitoring
- [x] Real-time metrics

### ✅ Tuning Capabilities
- [x] Prompt optimization via evolutionary API
- [x] Response quality metrics
- [x] Latency tracking
- [x] Error monitoring
- [x] Resource usage tracking
- [x] A/B testing support (via metrics)

---

## System Health

**Status:** ✅ All systems operational

**Access Points:**
- Web Frontend: http://localhost:3000
- Main API: http://localhost:8888
- Evolutionary API: http://localhost:8014
- Grafana: http://localhost:3001
- Netdata: http://localhost:19999
- Prometheus: http://localhost:9090

**Native App:**
- Athena.app: Running on macOS
- Connected to: localhost:8888

---

## Next Steps for Chat Tuning

1. **Use Grafana** (http://localhost:3001)
   - Track response times
   - Monitor API usage
   - View error rates

2. **Use Netdata** (http://localhost:19999)
   - Real-time system metrics
   - Container resource usage
   - Network performance

3. **Use Evolutionary API** (port 8014)
   - Generate optimized prompts
   - A/B test different approaches
   - Analyze prompt performance

4. **Test with Both Interfaces**
   - Native Athena.app (keyboard input working)
   - Web frontend (port 3000)
   - Compare experiences

---

*Last Updated: 2025-10-11*
*Container Count: 14 active, all healthy*

