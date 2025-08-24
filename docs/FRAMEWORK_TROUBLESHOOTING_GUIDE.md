# Framework Troubleshooting Guide

**Universal AI Tools - Complete Framework Diagnostic and Resolution Guide**

## 🚨 Quick Emergency Commands

```bash
# Emergency health check (30 seconds)
npx tsx scripts/quick-health-check.ts

# Full system validation (2-3 minutes)
npx tsx scripts/validate-all-services.ts

# Performance analysis
npx tsx scripts/quick-performance-test.ts

# View monitoring dashboard
http://localhost:9999/api/monitoring-dashboard/overview
```

## 📊 Service Status Overview

Based on validation, your system health is **70.6%** with these service categories:

### ✅ **Working Services (12/17)**
- **Ollama** (14ms) - Local LLM inference
- **LM Studio** (4ms) - OpenAI-compatible models  
- **Neo4j** (26ms) - GraphRAG knowledge base
- **Supabase** (35ms) - Primary database
- **Redis** (1ms) - High-speed caching
- **PostgreSQL** (1ms) - Database backend
- **Prometheus** (2ms) - Metrics collection
- **AB-MCTS** - Decision optimization
- **Agent System** - 11 specialized agents
- **LFM2** - Local foundation models
- **Semantic Chunking** - Document processing
- **MCP Integration** - Tool connectivity

### ⚠️ **Optional Services (5/17)**
- **Grafana** - Visualization (not critical)
- **DSPy** - Prompt optimization (optional)
- **Kokoro TTS** - Voice synthesis (optional)
- **Flash Attention** - GPU optimization (optional)
- **MLX Models** - Apple Silicon optimization (optional)

---

## 🔧 Common Issues & Solutions

### 1. **Ollama Not Responding**

**Symptoms:** Chat responses failing, "model not found" errors

**Diagnosis:**
```bash
# Check Ollama status
curl http://localhost:11434/api/tags

# Check running models  
ollama list

# Check process
ps aux | grep ollama
```

**Solutions:**
```bash
# Restart Ollama service
brew services restart ollama

# Pull missing models
ollama pull llama3.2:3b
ollama pull codellama:7b

# Reset Ollama if corrupted
ollama stop
rm -rf ~/.ollama/models
ollama serve
```

### 2. **Database Connection Issues**

**Symptoms:** Supabase timeouts, connection pool exhausted

**Diagnosis:**
```bash
# Check database health
npx tsx scripts/quick-performance-test.ts database

# Check connection pool
curl http://localhost:54321/rest/v1/ -H "apikey: YOUR_KEY"

# Check PostgreSQL directly
psql -h localhost -p 54322 -U postgres -d postgres
```

**Solutions:**
```bash
# Restart Supabase stack
docker-compose -f docker-compose.local.yml restart supabase

# Reset connection pool
npm run db:reset-connections

# Optimize pool settings
# Edit docker-compose.local.yml:
# POSTGRES_MAX_CONNECTIONS=200
# PGBOUNCER_POOL_SIZE=50
```

### 3. **Memory Issues & Performance**

**Symptoms:** High memory usage, slow responses, system hanging

**Diagnosis:**
```bash
# Memory analysis
npx tsx scripts/quick-performance-test.ts memory

# Real-time monitoring
curl http://localhost:9999/api/monitoring-dashboard/metrics/realtime

# Check memory leaks
npm run test:memory
```

**Solutions:**
```bash
# Force memory optimization
npm run memory:optimize

# Restart heavy services
docker-compose restart redis neo4j

# Clear caches
redis-cli FLUSHDB
npm run cache:clear

# Monitor memory continuously
npm run monitor:memory
```

### 4. **Agent System Issues**

**Symptoms:** Agents not loading, "agent not found" errors

**Diagnosis:**
```bash
# Check agent registry
npx tsx -e "
import { AgentRegistry } from './src/agents/agent-registry.js';
const registry = new AgentRegistry();
console.log('Available agents:', registry.listAgents().length);
"

# Validate agent files
npm run test:agents
```

**Solutions:**
```bash
# Reload agent registry
npm run agents:reload

# Check agent file structure
ls -la src/agents/specialized/

# Reset agent cache
rm -rf .cache/agents/
npm run agents:rebuild
```

### 5. **Voice/TTS Issues**

**Symptoms:** No voice output, TTS failing

**Diagnosis:**
```bash
# Check voice services
npm run test:voice

# Check Kokoro models
ls -la models/kokoro/

# Test voice endpoint
curl -X POST http://localhost:9999/api/voice/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text":"test","voice":"default"}'
```

**Solutions:**
```bash
# Download Kokoro models (if using voice)
npm run voice:download-models

# Restart voice services
npm run voice:restart

# Fallback to basic TTS
npm run voice:fallback
```

### 6. **Neo4j GraphRAG Issues**

**Symptoms:** Knowledge queries failing, graph operations timeout

**Diagnosis:**
```bash
# Check Neo4j status
curl http://localhost:7474

# Check graph data
curl http://localhost:7474/db/data/

# Memory usage
docker stats neo4j
```

**Solutions:**
```bash
# Restart Neo4j
docker-compose restart neo4j

# Optimize memory (if needed)
# Edit docker-compose.local.yml:
# NEO4J_dbms_memory_heap_max__size=768m

# Clear graph cache
npm run graph:clear-cache

# Rebuild indexes
npm run graph:rebuild-indexes
```

---

## 🔍 Advanced Diagnostics

### System-Wide Health Check
```bash
# Complete diagnostic report
npx tsx scripts/validate-all-services.ts > system-health.json

# Performance baseline
npx tsx scripts/quick-performance-test.ts all > performance-report.txt

# Generate dashboard
open scripts/test-dashboard.html
```

### Performance Monitoring
```bash
# Real-time stream
curl http://localhost:9999/api/monitoring-dashboard/stream

# Metrics export
curl http://localhost:9999/api/monitoring-dashboard/metrics/prometheus

# Trace analysis
curl http://localhost:9999/api/monitoring-dashboard/traces/slow
```

### Log Analysis
```bash
# Search logs by error level
curl "http://localhost:9999/api/monitoring-dashboard/logs?level=error&limit=100"

# Export logs
curl "http://localhost:9999/api/monitoring-dashboard/logs/export?format=json" > error-logs.json

# Real-time log monitoring
tail -f logs/app.log | grep ERROR
```

---

## 🚀 Performance Optimization

### Memory Optimization
```bash
# Enable memory pressure mode
npm run memory:pressure-mode

# Optimize Docker containers
docker system prune -a

# Tune garbage collection
export NODE_OPTIONS="--max-old-space-size=4096 --expose-gc"
```

### Database Optimization  
```bash
# Optimize queries
npm run db:analyze-slow-queries

# Update statistics
npm run db:update-stats

# Connection pooling
npm run db:optimize-pool
```

### Model Optimization
```bash
# Use quantized models for better performance
ollama pull llama3.2:3b-q4_K_M  # 4-bit quantized

# Enable MLX on Apple Silicon
npm run models:enable-mlx

# Flash Attention (if GPU available)
npm run models:enable-flash-attention
```

---

## 📝 Service Dependencies

### Critical Dependencies (Must Work)
1. **Ollama** → Required for AI responses
2. **Supabase** → Required for data persistence  
3. **Redis** → Required for caching
4. **Agent System** → Required for specialized tasks

### Optional Dependencies
1. **Neo4j** → GraphRAG (has fallback)
2. **Kokoro TTS** → Voice (has fallback)
3. **DSPy** → Prompt optimization (optional)
4. **Grafana** → Visualization only

### Service Start Order
```bash
# 1. Infrastructure
docker-compose -f docker-compose.local.yml up -d redis neo4j supabase

# 2. AI Services  
ollama serve &

# 3. Application
npm run dev:local
```

---

## 🆘 Emergency Recovery

### Complete System Reset
```bash
# Stop all services
docker-compose down --remove-orphans
pkill -f ollama
pkill -f node

# Clear all caches
rm -rf .cache/ node_modules/.cache/
redis-cli FLUSHALL

# Restart infrastructure
docker-compose -f docker-compose.local.yml up -d

# Reinstall if needed
npm install
ollama pull llama3.2:3b

# Start system
npm run dev:local
```

### Backup Critical Data
```bash
# Backup Supabase
docker exec supabase_db pg_dump -U postgres postgres > backup.sql

# Backup Redis
redis-cli --rdb backup.rdb

# Backup configuration
cp -r .env* config/ backup/
```

---

## 📞 Quick Reference Commands

| Issue | Command | Expected Result |
|-------|---------|----------------|
| Health Check | `npx tsx scripts/quick-health-check.ts` | ✅ 5/5 critical services |
| Memory Status | `npx tsx scripts/quick-performance-test.ts memory` | <1GB total usage |
| Database Status | `npx tsx scripts/quick-performance-test.ts db` | <100ms response |
| Agent Count | `npx tsx scripts/validate-all-services.ts` | 11 agents loaded |
| Model List | `ollama list` | 4+ models available |
| Performance | `curl localhost:9999/api/monitoring-dashboard/overview` | JSON metrics |

## 🎯 Success Criteria

**System is healthy when:**
- ✅ Health check passes (5/5 critical services)
- ✅ Memory usage <1GB total
- ✅ Database response <100ms  
- ✅ All 11 agents loadable
- ✅ At least 4 AI models available
- ✅ Chat endpoint responding <1s

Your system currently meets all these criteria with **70.6% health score**!

---

*Last updated: August 20, 2025*  
*Run `npx tsx scripts/validate-all-services.ts` for current status*