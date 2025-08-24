# Universal AI Tools - Quick Start Guide

## 🚀 One-Click Startup

### Start Everything

```bash
./start.sh
```

This will:

- ✅ Check all dependencies
- ✅ Start backend and frontend
- ✅ Open browser automatically
- ✅ Show system status

### Stop Everything

```bash
./stop.sh
```

Gracefully stops all services.

### Check Status

```bash
./status.sh
```

Quick health check of all services.

### Alternative Commands

```bash
npm start              # Same as ./start.sh
npm stop               # Same as ./stop.sh
npm run status         # Same as ./status.sh
npm run start:quick    # Backend only
npm run dev            # Backend only
```

## 🔧 System Requirements

### Required

- **Node.js** (v18+)
- **npm** (v8+)

### Optional (but recommended)

- **Ollama** - For full AI capabilities
- **Redis** - For caching and performance

## 📍 Access Points

Once started, access your AI tools at:

- **🌐 Main Interface**: http://localhost:5173
- **🔧 API Documentation**: http://localhost:3001/api/docs
- **💓 Health Check**: http://localhost:3001/api/health

## 🤖 Available Agents

Your Universal AI Tools system includes **18 specialized agents**:

### Core Agents

- 🎯 **Planner** - Strategic task planning and decomposition
- 🔍 **Retriever** - Information gathering and knowledge search
- 👤 **User Intent** - Understanding your goals and requirements
- 🛡️ **Ethics** - Safety validation and compliance checking

### Cognitive Agents

- 😈 **Devils Advocate** - Risk assessment and critical analysis
- 🔧 **Synthesizer** - Information integration and solution building
- 🪞 **Reflector** - Self-assessment and learning optimization
- 🎭 **Orchestrator** - Multi-agent coordination and consensus
- 🛠️ **Tool Maker** - Dynamic code generation and customization
- 📊 **Resource Manager** - System optimization and monitoring
- 🤖 **PydanticAI** - Type-safe structured AI interactions

### Personal Agents

- 🧠 **Enhanced Assistant** - High-level personal AI coordination
- 📅 **Calendar Agent** - Intelligent scheduling management
- 📸 **Photo Organizer** - ML-powered photo categorization
- 📁 **File Manager** - Smart document organization
- 💻 **Code Assistant** - Development workflow automation
- ⚙️ **System Control** - macOS integration and automation
- 🌐 **Web Scraper** - Intelligent data extraction

## 🔧 Troubleshooting

### Services Won't Start

```bash
# Check what's running
./status.sh

# Kill any stuck processes
pkill -f "npm run dev"
pkill -f "vite"

# Restart fresh
./start.sh
```

### Port Conflicts

If ports 3001 or 5173 are in use:

```bash
# Find what's using the ports
lsof -i :3001
lsof -i :5173

# Kill the processes or change ports in config
```

### Ollama Issues

```bash
# Start Ollama manually
ollama serve

# Check available models
ollama list

# Pull recommended model
ollama pull llama3.2:3b
```

### Dependencies

```bash
# Reinstall if needed
rm -rf node_modules ui/node_modules
npm install
cd ui && npm install
```

## ⚡ Quick Actions

- **Chat with agents**: Navigate to Chat interface
- **Create custom agents**: Use Tool Maker agent
- **Monitor performance**: Check Dashboard
- **View system health**: ./status.sh
- **Stop everything**: ./stop.sh or Ctrl+C in terminal

## 🎯 What's Next?

1. **Explore the Chat Interface** - Start conversing with your AI agents
2. **Try Agent Coordination** - Ask complex questions that require multiple agents
3. **Experiment with Tool Creation** - Use the Tool Maker to build custom capabilities
4. **Monitor Self-Improvement** - Watch the system learn and evolve

Your Universal AI Tools system is ready to help with development, research, organization, and creative projects!
