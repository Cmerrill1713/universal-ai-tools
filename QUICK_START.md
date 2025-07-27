# Universal AI Tools - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### 1. Prerequisites

- Node.js 18+
- PostgreSQL or Supabase account
- Redis (optional)
- Ollama (optional, for local models)

### 2. Installation

```bash
# Clone repository
git clone https://github.com/your-org/universal-ai-tools.git
cd universal-ai-tools

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your Supabase credentials
```

### 3. Configure Supabase

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
JWT_SECRET=your-secret-key
```

### 4. Initialize Database

```bash
# Run database migrations
npm run migrate

# (Optional) Load Supabase documentation
npm run scrape:supabase
```

### 5. Start Development

```bash
# Start the server
npm run dev

# Server runs on http://localhost:3456
```

## 🎯 First API Call

### 1. Register Your Service

```bash
curl -X POST http://localhost:3456/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "service_name": "my-ai-app",
    "service_type": "custom",
    "capabilities": ["memory", "tools", "ai_chat"]
  }'

# Response:
# {
#   "service_id": "...",
#   "api_key": "your-api-key",
#   "endpoints": {...}
# }
```

### 2. Store a Memory

```bash
curl -X POST http://localhost:3456/api/v1/memory \
  -H "X-API-Key: your-api-key" \
  -H "X-AI-Service: my-ai-app" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "The user prefers dark mode interfaces",
    "metadata": {"type": "preference"}
  }'
```

### 3. Search Memories

```bash
curl -X POST http://localhost:3456/api/v1/memory/search \
  -H "X-API-Key: your-api-key" \
  -H "X-AI-Service: my-ai-app" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "user preferences",
    "limit": 5
  }'
```

### 4. Chat with AI

```bash
curl -X POST http://localhost:3456/api/v1/assistant/chat \
  -H "X-API-Key: your-api-key" \
  -H "X-AI-Service: my-ai-app" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What are the user preferences?",
    "model": "llama3.2:3b"
  }'
```

## 📚 Key Features

### Memory Management

- Store and retrieve contextual information
- Semantic search capabilities
- Automatic relevance scoring
- Memory evolution and learning

### Multi-Model Support

- OpenAI GPT models
- Anthropic Claude
- Local Ollama models
- Custom model integration

### Supabase Integration

- Database with RLS
- Real-time subscriptions
- Vector embeddings
- GraphQL API
- Edge Functions
- Scheduled jobs

### API Features

- RESTful endpoints
- API versioning (/api/v1/)
- WebSocket support
- Rate limiting
- Circuit breakers

## 🛠️ Common Commands

```bash
# Development
npm run dev              # Start dev server
npm run test:fast       # Quick tests
npm run lint:fix        # Fix linting

# Database
npm run migrate         # Run migrations
npm run migrate:status  # Check status

# Documentation
npm run scrape:supabase # Update Supabase docs

# Production
npm run build          # Build for production
npm start             # Start production server
```

## 📖 Next Steps

1. **Explore the API**: Check [API Documentation](docs/API.md)
2. **View all commands**: See [Command Reference](docs/COMMANDS.md)
3. **Understand architecture**: Read [Architecture Guide](docs/ARCHITECTURE.md)
4. **Learn Supabase features**: Review scraped documentation via API
5. **Set up monitoring**: Configure health checks and metrics

## 🔍 Useful Endpoints

- **Health**: `GET /health`
- **API Docs**: `GET /api/docs`
- **Versions**: `GET /api/versions`
- **Metrics**: `GET /api/performance/metrics`
- **Supabase Docs**: `GET /api/v1/docs/supabase/features`

## 💡 Tips

1. Use local models (Ollama) for development to save API costs
2. Enable Redis for better performance
3. Run `npm run scrape:supabase` to get comprehensive Supabase docs
4. Use the health check endpoints for monitoring
5. Check the command reference for all available commands

## 🚨 Troubleshooting

```bash
# Check service health
curl http://localhost:3456/api/health/detailed

# View logs
npm run dev  # Logs appear in console

# Reset database (development only)
supabase db reset

# Check TypeScript errors
npm run type-check
```

## 🎉 Success!

You now have a running Universal AI Tools service with:

- ✅ Multi-model AI support
- ✅ Advanced memory management
- ✅ Supabase integration
- ✅ API authentication
- ✅ Health monitoring

Happy coding! 🚀
