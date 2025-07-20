# Universal AI Tools - Quick Start Guide
## Get Started in Under 5 Minutes

**Version**: 1.0.0  
**Status**: Production Ready  
**Deployment Time**: ~5 minutes  
**Prerequisites**: Docker & Docker Compose

---

## 🚀 Instant Deployment

### Option 1: Complete Production Stack (Recommended)
```bash
# 1. Clone repository
git clone <your-repository-url>
cd universal-ai-tools

# 2. Set up environment
cp .env.example .env
# Edit .env with your configuration

# 3. Deploy everything
docker-compose -f docker-compose.production.yml up -d

# 4. Verify deployment
curl http://localhost:9999/health
```

### Option 2: Development Setup
```bash
# 1. Install dependencies
npm install
cd ui && npm install && cd ..

# 2. Start development servers
npm run dev

# Backend: http://localhost:9999
# Frontend: http://localhost:3000
```

---

## 🔧 Essential Configuration

### Environment Variables (.env)
```bash
# Required - Supabase Connection
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Required - API Security
DEV_API_KEY=your-development-api-key
PRODUCTION_API_KEY=your-production-api-key

# Optional - External Services
OPENAI_API_KEY=your-openai-key
OLLAMA_URL=http://localhost:11434
REDIS_URL=redis://localhost:6379
```

### Quick Database Setup
```bash
# If using existing Supabase project
supabase db reset

# If setting up new project
supabase init
supabase start
supabase db push
```

---

## ✅ 30-Second Health Check

### Verify Core Services
```bash
# 1. Platform health
curl http://localhost:9999/health

# 2. API functionality  
curl -H "X-API-Key: test-dev-key-12345" \
     -H "X-AI-Service: quickstart" \
     http://localhost:9999/api/v1/health

# 3. Database connectivity
curl -H "X-API-Key: test-dev-key-12345" \
     -H "X-AI-Service: quickstart" \
     http://localhost:9999/api/v1/memory

# 4. Prometheus metrics
curl http://localhost:9999/metrics
```

**Expected Results:**
- Health endpoints return `status: "healthy"`
- Memory endpoint returns paginated data
- Metrics endpoint returns Prometheus format

---

## 🎯 First API Calls

### 1. Create Your First Memory
```bash
curl -X POST http://localhost:9999/api/v1/memory \
  -H "X-API-Key: test-dev-key-12345" \
  -H "X-AI-Service: quickstart" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Welcome to Universal AI Tools!",
    "metadata": {"source": "quickstart"},
    "tags": ["welcome", "first-memory"]
  }'
```

### 2. List Available Tools
```bash
curl -H "X-API-Key: test-dev-key-12345" \
     -H "X-AI-Service: quickstart" \
     http://localhost:9999/api/v1/tools
```

### 3. Execute Built-in Tool
```bash
curl -X POST http://localhost:9999/api/v1/tools/execute/builtin/store_context \
  -H "X-API-Key: test-dev-key-12345" \
  -H "X-AI-Service: quickstart" \
  -H "Content-Type: application/json" \
  -d '{
    "context_type": "quickstart",
    "context_key": "demo",
    "content": "Successfully executed first tool!"
  }'
```

---

## 🌟 Common Use Cases

### Use Case 1: Memory Management System
```javascript
// Store important information
const memory = await fetch('/api/v1/memory', {
  method: 'POST',
  headers: {
    'X-API-Key': 'your-api-key',
    'X-AI-Service': 'your-service',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    content: 'User prefers dark mode',
    metadata: { user_id: '123' },
    tags: ['user-preference']
  })
});

// Retrieve memories
const memories = await fetch('/api/v1/memory?tags=user-preference', {
  headers: {
    'X-API-Key': 'your-api-key',
    'X-AI-Service': 'your-service'
  }
});
```

### Use Case 2: Agent Coordination
```javascript
// Coordinate multiple agents for complex task
const coordination = await fetch('/api/v1/orchestration/coordinate', {
  method: 'POST',
  headers: {
    'X-API-Key': 'your-api-key',
    'X-AI-Service': 'your-service',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    task: 'Analyze user behavior and generate insights',
    available_agents: ['data_analyzer', 'insight_generator', 'report_writer'],
    context: { dataset: 'user_activity_2025' }
  })
});
```

### Use Case 3: Knowledge Management
```javascript
// Search existing knowledge
const knowledge = await fetch('/api/v1/orchestration/knowledge/search', {
  method: 'POST',
  headers: {
    'X-API-Key': 'your-api-key',
    'X-AI-Service': 'your-service',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: 'machine learning best practices',
    limit: 10
  })
});
```

---

## 🔍 Monitoring & Debugging

### Access Built-in Monitoring
```bash
# Grafana Dashboard (if using production stack)
open http://localhost:3001
# Default login: admin/admin

# Prometheus Metrics
open http://localhost:9090

# Raw metrics endpoint
curl http://localhost:9999/metrics
```

### View Real-time Logs
```bash
# All services
docker-compose -f docker-compose.production.yml logs -f

# Specific service
docker-compose -f docker-compose.production.yml logs -f universal-ai-tools

# Application logs only
docker-compose -f docker-compose.production.yml logs -f universal-ai-tools | grep -E "(ERROR|WARN|INFO)"
```

### Debug Common Issues
```bash
# Check service status
docker-compose -f docker-compose.production.yml ps

# Restart specific service
docker-compose -f docker-compose.production.yml restart universal-ai-tools

# View container resource usage
docker stats
```

---

## 📚 Next Steps

### 1. Explore the Frontend (Optional)
```bash
cd ui
npm run dev
# Visit http://localhost:3000
```

### 2. Read Full Documentation
- **[API Documentation](./API_DOCUMENTATION.md)** - Complete API reference
- **[Production Deployment](./PRODUCTION_DEPLOYMENT_GUIDE.md)** - Enterprise deployment
- **[Future Roadmap](./FUTURE_ENHANCEMENT_ROADMAP.md)** - Enhancement plans

### 3. Customize for Your Needs
```bash
# Add custom tools
curl -X POST http://localhost:9999/api/v1/tools \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "my_custom_tool",
    "description": "Does something useful",
    "implementation": "function(params) { return { result: \"success\" }; }"
  }'

# Configure AI models
# Edit .env with your OpenAI/Ollama settings
OPENAI_API_KEY=sk-your-key
OLLAMA_URL=http://your-ollama-server:11434
```

### 4. Production Deployment
```bash
# Update environment for production
cp .env.example .env.production
# Edit with production values

# Deploy with production settings
docker-compose -f docker-compose.production.yml --env-file .env.production up -d

# Set up SSL/reverse proxy (optional)
# Configure nginx for HTTPS termination
```

---

## ⚡ Performance Tips

### Optimize for Production
1. **Enable Redis Caching**
   ```bash
   REDIS_URL=redis://localhost:6379
   ```

2. **Configure Database Connection Pooling**
   ```bash
   SUPABASE_DB_POOL_SIZE=20
   SUPABASE_DB_TIMEOUT=30000
   ```

3. **Set Up Health Checks**
   ```bash
   # Health check every 30 seconds
   curl -f http://localhost:9999/health || exit 1
   ```

4. **Monitor Resource Usage**
   ```bash
   # Watch memory and CPU
   docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"
   ```

---

## 🛠️ Development Workflow

### Local Development Setup
```bash
# 1. Start development dependencies
docker-compose up supabase redis ollama -d

# 2. Install and start application
npm install
npm run dev

# 3. Frontend development (optional)
cd ui
npm install
npm start
```

### Testing Your Changes
```bash
# Run health checks
npm run test:health

# Manual testing
curl http://localhost:9999/health
curl -H "X-API-Key: test-dev-key-12345" http://localhost:9999/api/v1/health
```

### Building for Production
```bash
# Build optimized Docker image
docker build -f Dockerfile.prod -t universal-ai-tools:latest .

# Test production build locally
docker run -p 9999:9999 --env-file .env universal-ai-tools:latest
```

---

## 🆘 Troubleshooting

### Common Issues & Solutions

#### Service Won't Start
```bash
# Check port availability
lsof -i :9999

# Check Docker resources
docker system df
docker system prune  # Free up space

# Check logs for errors
docker-compose -f docker-compose.production.yml logs universal-ai-tools
```

#### Database Connection Issues
```bash
# Verify Supabase connection
curl -H "Authorization: Bearer $SUPABASE_ANON_KEY" "$SUPABASE_URL/rest/v1/"

# Check environment variables
docker-compose -f docker-compose.production.yml exec universal-ai-tools env | grep SUPABASE
```

#### API Authentication Failures
```bash
# Test with correct headers
curl -H "X-API-Key: test-dev-key-12345" \
     -H "X-AI-Service: test" \
     http://localhost:9999/api/v1/health

# Check API key in environment
echo $DEV_API_KEY
```

#### Memory/Performance Issues
```bash
# Check resource usage
docker stats

# Restart with resource limits
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.production.yml up -d
```

---

## 📞 Getting Help

### Documentation Resources
- **API Reference**: `./API_DOCUMENTATION.md`
- **Production Guide**: `./PRODUCTION_DEPLOYMENT_GUIDE.md`
- **Architecture Overview**: `./PROJECT_HANDOFF_SUMMARY.md`

### Health Check URLs
- Basic Health: `http://localhost:9999/health`
- Detailed Health: `http://localhost:9999/api/health`
- Authenticated Health: `http://localhost:9999/api/v1/health`
- Metrics: `http://localhost:9999/metrics`

### Default Credentials
- **Development API Key**: `test-dev-key-12345`
- **Service Name**: Any string (e.g., `quickstart`)
- **Grafana**: `admin` / `admin`
- **Prometheus**: No authentication required

---

## 🎯 Success Checklist

After following this guide, you should have:
- [ ] Platform running on `http://localhost:9999`
- [ ] Health endpoints returning "healthy" status
- [ ] Successfully created a memory via API
- [ ] Successfully listed available tools
- [ ] Metrics being collected at `/metrics`
- [ ] (Optional) Frontend accessible at `http://localhost:3000`
- [ ] (Optional) Monitoring dashboards accessible

**Congratulations! You're now ready to build with Universal AI Tools.** 🎉

---

**Quick Start Status**: ✅ **Complete**  
**Next Step**: Explore the [API Documentation](./API_DOCUMENTATION.md) for advanced features  
**Support**: Enterprise-grade platform with comprehensive documentation