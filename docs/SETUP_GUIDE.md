# Universal AI Tools Setup Guide

## Quick Start

### 1. Launch the Assistant
- **Double-click** `AI Setup Assistant.app` on your Desktop
- **Or** open http://localhost:9999 in your browser

### 2. Service Management
```bash
# Check if service is running
lsof -i :9999

# Start service manually (if needed)
cd ~/Desktop/universal-ai-tools
npm run dev

# Check service status
curl http://localhost:9999/health
```

### 3. Claude Desktop Integration
Your Claude Desktop is already configured with enhanced MCP tools.

Configuration file: `~/Library/Application Support/Claude/claude_desktop_config.json`

Available tools in Claude:
- `universal_memory_store` - Store memories
- `universal_memory_search` - Search memories
- `universal_context_store` - Save project context
- `universal_context_retrieve` - Get project context
- `universal_knowledge_add` - Add knowledge
- `universal_knowledge_search` - Search knowledge base

## Environment Variables

Create or update `.env` file:
```bash
# Supabase
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_KEY=your-service-key

# Service
AI_TOOLS_PORT=9999
JWT_SECRET=your-jwt-secret

# Ollama
OLLAMA_HOST=http://localhost:11434
```

## Troubleshooting

### Service Won't Start
```bash
# Check port usage
lsof -i :9999

# Kill existing process
pkill -f universal-ai-tools

# Restart
npm run dev
```

### Claude Tools Not Available
1. Restart Claude Desktop
2. Check MCP configuration
3. Verify service is running

### Database Issues
```bash
# Check Supabase
cd ~/supabase
supabase status

# Restart if needed
supabase stop
supabase start
```

## Features

### Chat UI (http://localhost:9999)
- Interactive setup assistant
- Code generation for any language
- Custom tool creation
- Memory of previous setups

### Claude Integration
- Universal memory across all projects
- Context persistence
- Knowledge base integration
- Cross-project learning

### Ollama Integration
- Automatic model selection
- Intelligent tool suggestions
- Request routing
- Code generation assistance