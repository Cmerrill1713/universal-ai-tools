# Quick Reference Guide

## 🚀 Launch
- **Desktop App**: Double-click `AI Setup Assistant.app`
- **Browser**: http://localhost:9999
- **Service**: `cd ~/Desktop/universal-ai-tools && npm run dev`

## 🛠️ Control Commands

### Service Management
```bash
# Check status
lsof -i :9999

# Start service
cd ~/Desktop/universal-ai-tools && npm run dev

# Stop service
pkill -f universal-ai-tools

# Check logs
tail -f /tmp/universal-ai-tools.out

# Health check
curl http://localhost:9999/health
```

### Database
```bash
# Supabase status
cd ~/supabase && supabase status

# Restart Supabase
supabase stop && supabase start

# Database backup
supabase db dump > backup-$(date +%Y%m%d).sql
```

## 🤖 Claude Tools

### Memory
```
universal_memory_store      # Store memories
universal_memory_search     # Search memories
```

### Context
```
universal_context_store     # Save project context
universal_context_retrieve  # Get project context
```

### Knowledge
```
universal_knowledge_add     # Add to knowledge base
universal_knowledge_search  # Search knowledge base
```

## 🌐 API Endpoints

### Chat Assistant
- **Base**: http://localhost:9999
- **Health**: http://localhost:9999/health
- **Docs**: http://localhost:9999/api/docs

### Helper Endpoints (No Auth)
- **Suggest Tools**: `POST /api/assistant/suggest-tools`
- **Generate Code**: `POST /api/assistant/generate-integration`
- **Create Tool**: `POST /api/assistant/create-tool`

## 🔧 Common Issues

### Service Won't Start
```bash
# Check port
lsof -i :9999

# Kill process
pkill -f universal-ai-tools

# Restart
npm run dev
```

### Claude Tools Missing
1. Restart Claude Desktop
2. Check service: `curl http://localhost:9999/health`
3. Verify config: `~/Library/Application Support/Claude/claude_desktop_config.json`

### Database Connection
```bash
# Check Supabase
cd ~/supabase && supabase status

# Test connection
psql -h localhost -p 54322 -U postgres -d postgres -c "SELECT 1"
```

## 📂 File Locations

### Configuration
- **Claude MCP**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Service Config**: `~/Desktop/universal-ai-tools/.env`

### Logs
- **Service**: `/tmp/universal-ai-tools.out`
- **Errors**: `/tmp/universal-ai-tools.err`

### Data
- **Supabase**: `~/supabase/`
- **Universal AI**: `~/Desktop/universal-ai-tools/`

## 💡 Pro Tips

### Memory Best Practices
- Use consistent tags
- Store important patterns
- Regular backups

### Context Management
- Use descriptive keys
- Save project setups
- Version important configs

### Service Maintenance
- Monitor logs regularly
- Backup database weekly
- Update dependencies monthly