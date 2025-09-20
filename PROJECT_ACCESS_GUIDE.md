# Universal AI Tools - Project Access Guide

## 🚀 **Quick Start**

Your Universal AI Tools project is ready! All core services are running locally.

### **Currently Running Services:**
- ✅ **Librarian Service** (Port 8032) - Knowledge management with embeddings
- ✅ **GitHub MCP Server** - 14 tools for GitHub operations
- ✅ **Agency Swarm Local MCP Server** - 12 tools for agent orchestration

### **Quick Access:**
```bash
# Start all services
./start-project.sh

# Check service status
ps aux | grep -E "(librarian|github-mcp|agency-swarm)"

# Test integration
node scripts/test-agency-swarm-local-integration.mjs
```

## 🎯 **Core Services Available**

### **1. Librarian Service** (Port 8032)
**Purpose**: Central knowledge management with semantic search
- **Health**: `curl http://localhost:8032/health`
- **Store Knowledge**: `POST http://localhost:8032/embed`
- **Search Knowledge**: `GET http://localhost:8032/search?query=YOUR_QUERY`
- **Embedding Model**: all-MiniLM-L6-v2

### **2. Agency Swarm Local** (MCP Server)
**Purpose**: Multi-agent orchestration with communication flows
- **4 Agents**: CEO, Developer, GitHub Specialist, Knowledge Manager
- **12 MCP Tools**: Complete agent management
- **Communication Flows**: 6 directional flows between agents
- **Local-Only**: No external API dependencies

### **3. GitHub MCP Server**
**Purpose**: GitHub operations through agents
- **14 Tools**: Repository management, issues, PRs, code review
- **Integration**: Works with Agency Swarm agents
- **Local**: Uses your GitHub token for operations

## 🛠️ **Available Services (Not Currently Running)**

### **AI/ML Services:**
- `ab-mcts-service.ts` - Alpha-Beta Monte Carlo Tree Search
- `llm-router-service.ts` - LLM routing and load balancing
- `mlx-service.ts` - MLX integration for Apple Silicon
- `ollama-service.ts` - Ollama integration
- `multi-tier-llm-service.ts` - Multi-tier LLM management

### **Knowledge Services:**
- `knowledge-scraper-service.ts` - Web scraping
- `knowledge-crawler/` - Advanced crawling
- `r1-rag/` - RAG implementation
- `searxng-integration/` - Search engine integration

### **Vision Services:**
- `pyvision-server.py` - Vision model server
- `vision-browser-debugger.ts` - Browser debugging
- `visual-memory-service.ts` - Visual memory management

### **Integration Services:**
- `dspy-orchestrator/` - DSPy orchestration
- `supabase-integration/` - Supabase integration
- `lm-studio-proxy/` - LM Studio proxy
- `mlx-proxy/` - MLX proxy

### **Advanced Services:**
- `constitutional-ai-training/` - Constitutional AI
- `sakana-ai/` - Sakana AI integration
- `data-quality-validation/` - Data validation
- `model-load-balancer/` - Model load balancing

## 🎮 **How to Use Your Project**

### **Option 1: Direct API Access**
```bash
# Store knowledge
curl -X POST http://localhost:8032/embed \
  -H "Content-Type: application/json" \
  -d '[{"content": "Your knowledge", "metadata": {"type": "test"}}]'

# Search knowledge
curl "http://localhost:8032/search?query=your search&limit=10"
```

### **Option 2: MCP Tools (Recommended)**
Use the MCP tools through your preferred MCP client:
- **Agency Swarm Tools**: `agency_swarm_execute_workflow`, `agency_swarm_collaborate`
- **GitHub Tools**: `github_create_issue`, `github_create_pr`, `github_review_code`

### **Option 3: Start Additional Services**
```bash
# Start LLM Router
tsx src/services/llm-router-service.ts &

# Start MLX Service
tsx src/services/mlx-service.ts &

# Start Knowledge Scraper
tsx src/services/knowledge-scraper-service.ts &
```

## 🔧 **Project Structure**

```
universal-ai-tools/
├── src/
│   ├── services/           # Core services (70+ services)
│   ├── mcp/               # MCP servers
│   └── agents/            # AI agents
├── scripts/               # Utility scripts
├── docs/                  # Documentation
├── start-project.sh       # Quick start script
└── PROJECT_ACCESS_GUIDE.md # This guide
```

## 🚀 **Next Steps**

1. **Explore Core Services**: Start with Librarian and Agency Swarm
2. **Add More Services**: Start additional services as needed
3. **Create Workflows**: Use Agency Swarm to orchestrate multi-agent workflows
4. **Integrate Knowledge**: Store and search knowledge through Librarian
5. **GitHub Operations**: Use GitHub MCP for repository management

## 💡 **Pro Tips**

- **Local-Only**: Everything runs locally for privacy and speed
- **Modular**: Start only the services you need
- **Extensible**: Easy to add new services and agents
- **Integrated**: All services work together through MCP

## 🆘 **Troubleshooting**

```bash
# Check all running services
ps aux | grep -E "(librarian|github|agency|mcp)"

# Check service health
curl http://localhost:8032/health

# View service logs
tail -f logs/*.log

# Restart services
./start-project.sh
```

---

**🎉 Your Universal AI Tools project is ready to use!**
