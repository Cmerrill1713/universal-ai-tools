# Universal AI Tools - Quick Start Guide

## 🚀 Getting Started in 5 Minutes

Universal AI Tools is a local-first AI assistant optimized for developers. It runs entirely on your machine with <1GB memory usage.

### Prerequisites
- Node.js 18+ 
- Docker Desktop
- 4GB RAM minimum
- macOS, Linux, or Windows with WSL2

## Installation

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/yourusername/universal-ai-tools.git
cd universal-ai-tools

# Install dependencies
npm install
```

### 2. Quick Local Setup (Recommended)

```bash
# Run the automated local setup
./scripts/start-local.sh
```

This script will:
- ✅ Install Ollama for local AI
- ✅ Start minimal Docker services
- ✅ Configure environment variables
- ✅ Launch the application

### 3. Manual Setup (Alternative)

```bash
# Install Ollama (one-time)
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull llama3.2:3b

# Copy environment configuration
cp .env.example .env.local

# Start Docker services
docker-compose -f docker-compose.local.yml up -d

# Run the application
npm run dev:local
```

## 🎯 First Steps

### 1. Access the Web Interface
Open your browser to: `http://localhost:9999`

### 2. Test the API
```bash
# Health check
curl http://localhost:9999/health

# Chat with AI (no auth required in local mode)
curl -X POST http://localhost:9999/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, AI!"}'
```

### 3. Use the macOS App (Optional)
If on macOS, open the companion app:
```bash
cd macOS-App/UniversalAITools
open UniversalAITools.xcodeproj
# Press Cmd+R to run
```

## 💡 Key Features

### Local AI Models
- **Ollama Integration**: Run LLMs completely offline
- **Models**: llama3.2, codellama, mistral
- **No API Keys Required**: 100% local operation

### Memory Optimized
- **<1GB Total Usage**: Down from 2.5GB
- **Fast Startup**: 5-10 seconds
- **Efficient Caching**: Redis with 64MB limit

### Development Tools
- **Code Review**: Automated code quality checks
- **Test Generation**: Create unit tests automatically
- **Documentation**: Generate API docs from code
- **Multi-Language**: JavaScript, Python, Swift, Go, Rust, and more

## 📋 Common Tasks

### Chat with AI
```javascript
// Using the API
fetch('http://localhost:9999/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'How do I optimize React performance?',
    model: 'ollama/llama3.2'
  })
})
```

### Review Code
```bash
curl -X POST http://localhost:9999/api/agents/execute \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "code-reviewer",
    "task": "review",
    "data": {
      "code": "const add = (a, b) => a + b",
      "language": "javascript"
    }
  }'
```

### Check Memory Usage
```bash
curl http://localhost:9999/api/memory/stats
```

## 🔧 Configuration

### Environment Variables
Edit `.env.local` for local development:

```env
# Core Settings
PORT=9999
NODE_ENV=development

# Local AI
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b

# Optional: External APIs
OPENAI_API_KEY=your_key_here  # Optional
ANTHROPIC_API_KEY=your_key_here  # Optional
```

### Docker Memory Limits
Services are pre-configured with optimal limits:
- API: 512MB
- PostgreSQL: 256MB
- Redis: 64MB
- Ollama: 256MB

## 🚨 Troubleshooting

### Port Already in Use
```bash
# Check what's using port 9999
lsof -i :9999

# Use a different port
PORT=3000 npm run dev:local
```

### Docker Issues
```bash
# Reset Docker services
docker-compose down
docker-compose -f docker-compose.local.yml up -d
```

### High Memory Usage
```bash
# Trigger memory optimization
curl -X POST http://localhost:9999/api/memory/optimize
```

### Ollama Not Working
```bash
# Check Ollama status
ollama list

# Restart Ollama
ollama serve
```

## 📚 Next Steps

1. **Explore the API**: See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
2. **Configure Agents**: Customize AI agents for your workflow
3. **Set Up Monitoring**: Access Grafana at `http://localhost:3003`
4. **Join Community**: [GitHub Discussions](https://github.com/yourusername/universal-ai-tools/discussions)

## 🆘 Getting Help

- **Documentation**: [Full Docs](./docs/README.md)
- **Issues**: [GitHub Issues](https://github.com/yourusername/universal-ai-tools/issues)
- **Discord**: [Join our Discord](https://discord.gg/universal-ai-tools)

## 🎉 You're Ready!

Universal AI Tools is now running locally on your machine. Start chatting with AI, reviewing code, and boosting your productivity - all without sending data to external services!

**Memory Usage**: <1GB | **Response Time**: ~200ms | **100% Local**