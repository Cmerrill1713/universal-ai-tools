# Universal AI Tools Service

A comprehensive, production-ready AI tools service built with TypeScript, Express, and Supabase. This service provides a unified interface for working with multiple AI models, advanced memory management, and cognitive orchestration.

## 🚀 Features

### Core Capabilities
- **Multi-Model LLM Support**: OpenAI, Anthropic, Ollama, and local models
- **Advanced Memory System**: Intelligent storage, retrieval, and learning
- **Voice & Speech Processing**: TTS with personality profiles, speech recognition
- **Cognitive Orchestration**: Multi-agent system for complex task handling
- **Performance Monitoring**: Real-time metrics and optimization
- **Security**: JWT/API key authentication, rate limiting, input validation
- **Caching**: Redis-based caching with fallback mechanisms
- **Database Optimization**: Intelligent query optimization and connection pooling

### Speech & Voice Features
- **Multi-Provider TTS**: OpenAI TTS, ElevenLabs, Kokoro TTS
- **Speech Recognition**: Whisper-based transcription
- **Voice Personalities**: Sweet, shy, confident, caring, playful profiles
- **Dynamic Modulation**: Sweetness levels and emotional parameters
- **Local TTS**: High-quality Kokoro TTS for local processing

### Agent System
- **Cognitive Agent**: Higher-level reasoning and planning
- **Search Agent**: Intelligent information retrieval
- **Analysis Agent**: Data analysis and pattern recognition
- **Generation Agent**: Content creation and synthesis
- **Memory Agent**: Context-aware memory management
- **Performance Agent**: System optimization and monitoring

## 📋 Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- PostgreSQL database
- Redis server
- Supabase account (optional, for managed database)

## 🛠️ Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd universal-ai-tools
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
```

Edit the `.env` file with your configuration:

```env
# Server Configuration
NODE_ENV=development
PORT=8080
HOST=localhost

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/universal_ai_tools
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_KEY=your-supabase-service-key

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Security Configuration
JWT_SECRET=your-jwt-secret-key
ENCRYPTION_KEY=your-encryption-key
API_KEY_SALT=your-api-key-salt

# LLM Configuration
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
OLLAMA_URL=http://localhost:11434

# Speech & Voice Configuration
ELEVENLABS_API_KEY=your-elevenlabs-api-key
KOKORO_TTS_ENABLED=true
KOKORO_MODEL_PATH=/path/to/kokoro/models
WHISPER_API_URL=http://localhost:5000/transcribe

# Optional: MLX Configuration (for Apple Silicon)
MLX_ENABLED=true
MLX_MODEL_PATH=/path/to/mlx/models
```

4. **Initialize the database**
```bash
npm run setup
```

5. **Start the development server**
```bash
npm run dev
```

## 🏗️ Architecture

### System Overview
```
┌─────────────────────────────────────────────────────────────────┐
│                    Universal AI Tools Service                    │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              Cognitive Orchestrator                         │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │ │
│  │  │Cognitive│ │ Search  │ │Analysis │ │Generate │ │ Memory  │ │ │
│  │  │ Agent   │ │ Agent   │ │ Agent   │ │ Agent   │ │ Agent   │ │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                Memory Management                            │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │ │
│  │  │Enhanced │ │ Access  │ │ Cache   │ │Context  │ │Vector   │ │ │
│  │  │ Memory  │ │Pattern  │ │ System  │ │Manager  │ │ Store   │ │ │
│  │  │ System  │ │Learner  │ │         │ │         │ │         │ │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    LLM Orchestrator                         │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │ │
│  │  │ OpenAI  │ │Anthropic│ │ Ollama  │ │  Local  │ │  MLX    │ │ │
│  │  │   API   │ │   API   │ │  Local  │ │ Models  │ │ Apple   │ │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                 Infrastructure                              │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │ │
│  │  │Express  │ │Supabase │ │ Redis   │ │Security │ │Monitor  │ │ │
│  │  │  API    │ │Database │ │ Cache   │ │Middleware│ │ System  │ │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Key Components

#### 1. **Cognitive Orchestrator**
Coordinates multiple AI agents for complex task execution:
- Task decomposition and planning
- Agent coordination and communication
- Result synthesis and optimization
- Context management across agents

#### 2. **Memory Management**
Advanced memory system with learning capabilities:
- **Enhanced Memory System**: Intelligent storage and retrieval
- **Access Pattern Learner**: Adapts to usage patterns
- **Context Manager**: Maintains conversation context
- **Vector Store**: Semantic search capabilities

#### 3. **LLM Orchestrator**
Unified interface for multiple AI models:
- Automatic model selection based on task requirements
- Load balancing and failover
- Cost optimization
- Response caching and optimization

#### 4. **Security Layer**
Enterprise-grade security features:
- JWT and API key authentication
- Rate limiting and IP blocking
- Input validation and sanitization
- Security headers and CORS policies

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `NODE_ENV` | Environment (development/production) | No | `development` |
| `PORT` | Server port | No | `8080` |
| `DATABASE_URL` | PostgreSQL connection string | Yes | - |
| `REDIS_URL` | Redis connection string | Yes | - |
| `JWT_SECRET` | JWT signing secret | Yes | - |
| `OPENAI_API_KEY` | OpenAI API key | No | - |
| `ANTHROPIC_API_KEY` | Anthropic API key | No | - |
| `OLLAMA_URL` | Ollama server URL | No | `http://localhost:11434` |

### Database Setup

The service uses PostgreSQL with Supabase for managed hosting. Run the setup script to create required tables:

```bash
npm run setup
```

This creates tables for:
- Users and authentication
- Memory storage and metadata
- Agent configurations
- Performance metrics
- API usage tracking

## 🚀 Usage

### Starting the Service

**Development mode:**
```bash
npm run dev
```

**Production mode:**
```bash
npm run build
npm start
```

### API Endpoints

#### Authentication
```bash
# Login with credentials
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password"
}

# Get API key
POST /api/auth/api-key
Authorization: Bearer <jwt-token>
```

#### Memory Management
```bash
# Store memory
POST /api/memory/store
{
  "content": "Important information to remember",
  "metadata": { "source": "user", "importance": 0.8 },
  "tags": ["important", "user-input"]
}

# Search memories
GET /api/memory/search?query=information&limit=10

# Get memory by ID
GET /api/memory/{id}

# Update memory
PUT /api/memory/{id}
{
  "content": "Updated information",
  "importance": 0.9
}
```

#### LLM Operations
```bash
# Chat completion
POST /api/llm/chat
{
  "messages": [
    {"role": "user", "content": "Hello, how are you?"}
  ],
  "model": "gpt-4",
  "temperature": 0.7
}

# Text completion
POST /api/llm/completion
{
  "prompt": "The future of AI is",
  "model": "gpt-3.5-turbo",
  "max_tokens": 150
}
```

#### Agent Operations
```bash
# Create agent
POST /api/agents
{
  "name": "Research Assistant",
  "type": "cognitive",
  "config": {
    "model": "gpt-4",
    "temperature": 0.2
  }
}

# List agents
GET /api/agents?type=cognitive&active=true

# Execute agent task
POST /api/agents/{id}/execute
{
  "task": "Research the latest AI trends",
  "context": "Focus on enterprise applications"
}
```

#### Speech & Voice Operations
```bash
# Speech transcription
POST /api/speech/transcribe
Content-Type: multipart/form-data
# Form data: audio file, conversation_id (optional), context (optional)

# Voice synthesis
POST /api/speech/synthesize
{
  "text": "Hello! How can I help you today?",
  "personality": "sweet",
  "sweetness_level": 0.7,
  "format": "mp3"
}

# Kokoro TTS synthesis (high-quality local)
POST /api/speech/synthesize/kokoro
{
  "text": "Natural sounding local TTS",
  "voiceId": "athena-sweet",
  "format": "wav"
}

# Get available voices
GET /api/speech/voices

# Voice configuration
POST /api/speech/configure-voice
{
  "personality": "sweet",
  "voice_id": "EXAVITQu4vr4xnSDxMaL",
  "settings": {
    "pitch_adjustment": 0.1,
    "speaking_rate": 0.95
  }
}
```

#### Performance Monitoring
```bash
# Get system health
GET /api/health

# Get performance metrics
GET /api/metrics

# Get detailed analytics
GET /api/analytics?startDate=2024-01-01&endDate=2024-01-31
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test types
npm run test:unit
npm run test:integration

# Run tests in watch mode
npm run test:watch
```

### Test Structure

```
tests/
├── unit/                 # Unit tests
│   ├── services/
│   ├── middleware/
│   └── utils/
├── integration/          # Integration tests
│   ├── api/
│   ├── database/
│   └── cache/
└── e2e/                  # End-to-end tests
    ├── auth/
    ├── memory/
    └── agents/
```

## 🔍 Monitoring

### Health Checks

The service provides comprehensive health checks:

```bash
# Basic health check
GET /api/health

# Detailed health check
GET /api/health?detailed=true

# Component-specific health
GET /api/health?component=database
GET /api/health?component=redis
GET /api/health?component=ollama
```

### Performance Metrics

Monitor system performance through:

1. **Built-in Dashboard**: `/api/dashboard`
2. **Metrics API**: `/api/metrics`
3. **Prometheus Integration**: `/api/metrics/prometheus`
4. **Custom Alerts**: Configurable thresholds

### Logging

Structured logging with different levels:

```javascript
// Log levels: error, warn, info, debug, trace
logger.info('Memory stored successfully', { 
  memoryId: 'uuid', 
  userId: 'user123', 
  size: 1024 
});
```

## 🔒 Security

### Authentication

The service supports multiple authentication methods:

1. **JWT Tokens**: For user sessions
2. **API Keys**: For service-to-service communication
3. **Role-Based Access Control**: Admin, user, service roles

### Security Features

- **Input Validation**: Comprehensive validation using Zod schemas
- **Rate Limiting**: Configurable rate limits per IP/user
- **Security Headers**: HSTS, CSP, XSS protection
- **CORS Configuration**: Configurable allowed origins
- **Request Sanitization**: Automatic input sanitization
- **Audit Logging**: Complete audit trail

## 📊 Performance

### Optimization Features

- **Intelligent Caching**: Multi-level caching strategy
- **Database Optimization**: Query optimization and connection pooling
- **Memory Management**: Efficient memory usage patterns
- **Request Deduplication**: Automatic duplicate request handling
- **Compression**: Response compression for large payloads

### Performance Metrics

Key performance indicators:

- **Response Time**: P50, P95, P99 percentiles
- **Memory Usage**: Heap, RSS, external memory
- **Database Performance**: Query time, connection pool usage
- **Cache Hit Rate**: Cache efficiency metrics
- **Error Rate**: Error frequency and types

## 🚢 Deployment

### Docker Deployment

```bash
# Build image
docker build -t universal-ai-tools .

# Run container
docker run -p 8080:8080 \
  -e DATABASE_URL="postgresql://..." \
  -e REDIS_URL="redis://..." \
  -e JWT_SECRET="your-secret" \
  universal-ai-tools
```

### Docker Compose

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@db:5432/universal_ai_tools
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
      
  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=universal_ai_tools
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data
      
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### Production Considerations

1. **Environment Variables**: Use proper secrets management
2. **Database**: Use managed PostgreSQL (Supabase, AWS RDS)
3. **Caching**: Use managed Redis (AWS ElastiCache, Redis Cloud)
4. **Monitoring**: Set up APM and alerting
5. **SSL/TLS**: Enable HTTPS with proper certificates
6. **Load Balancing**: Use load balancer for high availability

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Write comprehensive tests
- Use conventional commits
- Update documentation
- Ensure security compliance

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 📚 Documentation

### Quick Links

- **[Command Reference](docs/COMMANDS.md)** - All available CLI commands
- **[API Documentation](docs/API.md)** - Complete API reference
- **[Speech API](docs/SPEECH_API.md)** - Voice synthesis and recognition
- **[API Versioning Guide](docs/API_VERSIONING.md)** - API versioning details
- **[Architecture Overview](docs/ARCHITECTURE.md)** - System design and components
- **[Migration Guide](docs/MIGRATIONS.md)** - Database migration documentation
- **[Supabase Integration](docs/SUPABASE.md)** - Supabase features and setup

### Important Commands

```bash
# Development
npm run dev                    # Start development server
npm run dev:backend           # Backend only
npm run dev:frontend          # Frontend only

# Database
npm run migrate               # Run migrations
npm run migrate:status        # Check migration status
npm run migrate:create <name> # Create new migration

# Documentation
npm run scrape:supabase       # Scrape Supabase docs for LLM access

# Testing
npm test                      # Run all tests
npm run test:fast            # Run fast tests
npm run test:coverage        # Run with coverage

# Code Quality
npm run lint                 # Run ESLint
npm run format               # Format with Prettier
npm run type-check           # TypeScript check
```

For the complete list of commands, see [docs/COMMANDS.md](docs/COMMANDS.md).

## 🆘 Support

For support and questions:

- **Documentation**: [Full Documentation](docs/)
- **Command Reference**: [All Commands](docs/COMMANDS.md)
- **Issues**: [GitHub Issues](https://github.com/your-org/universal-ai-tools/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/universal-ai-tools/discussions)

## 🏆 Acknowledgments

- OpenAI for GPT models
- Anthropic for Claude models
- Supabase for database infrastructure
- The open-source community for various tools and libraries

---

**Made with ❤️ by the Universal AI Tools team**