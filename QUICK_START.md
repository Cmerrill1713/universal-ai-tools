# 🚀 Universal AI Tools - Quick Start Guide

Welcome to Universal AI Tools! This guide will get you up and running in minutes with our production-ready AI platform.

## ⚡ Quick Start (2 Minutes)

### 1. Prerequisites

- Node.js 18+
- Supabase project (optional for demo mode)
- Redis (optional)
- Ollama (optional, for local models)

### 2. Start the Server

```bash
# Clone and install
git clone https://github.com/your-org/universal-ai-tools.git
cd universal-ai-tools
npm install

# Start development server
npm run dev

# Server runs on http://localhost:9999
```

### 3. Generate Demo Token (No Account Required!)

```bash
# Generate a 24-hour demo token instantly
curl -X POST http://localhost:9999/api/v1/auth/demo-token \
  -H "Content-Type: application/json" \
  -d '{"name":"Your Name","purpose":"Testing the API"}'

# Save the token from response
TOKEN="eyJhbGciOiJIUzI1NiIs..."
```

### 4. Test the API

```bash
# Check available parameter presets
curl -H "Authorization: Bearer $TOKEN" \
  'http://localhost:9999/api/v1/parameters/presets'

# Submit feedback
curl -H "Authorization: Bearer $TOKEN" \
  -X POST 'http://localhost:9999/api/v1/feedback/submit' \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session",
    "feedbackType": "general",
    "category": "usability",
    "rating": 5,
    "title": "Great API!",
    "description": "Easy to use and fast."
  }'

# Chat with AI assistant
curl -H "Authorization: Bearer $TOKEN" \
  -X POST 'http://localhost:9999/api/v1/assistant/chat' \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello! Can you help me?"}'
```

## 🌟 Core Features

### 🔐 Authentication System
- **Demo Tokens**: Instant access, no account required
- **JWT-based**: Secure token validation
- **Configurable**: 1h to 30d expiration periods

### 🎯 Parameter Optimization
- **Smart Presets**: Pre-configured for different tasks
- **ML-Based Selection**: Intelligent parameter optimization
- **Analytics**: Performance tracking and improvement metrics

### 📝 Feedback Collection
- **Multiple Types**: General, feature requests, bug reports
- **Category Support**: Performance, usability, accuracy, etc.
- **Real-time Analytics**: Instant feedback processing

### 🤖 AI Assistant
- **Context-Aware**: Supabase-backed context retrieval
- **Multi-Model**: Ollama, LM Studio, external APIs
- **Conversation Storage**: Persistent chat history

### 🔧 Model Management
- **16 Available Models**: Across multiple tiers and providers
- **Auto-Discovery**: Dynamic model detection
- **Performance Monitoring**: Real-time model metrics

## 🎯 Use Case Examples

### Calendar Task Management
```bash
# Optimize parameters for calendar tasks
curl -H "Authorization: Bearer $TOKEN" \
  -X POST 'http://localhost:9999/api/v1/parameters/optimize' \
  -H "Content-Type: application/json" \
  -d '{"taskType": "calendar_management"}'
```

### Swift/iOS Development
```bash
# Get code generation presets
curl -H "Authorization: Bearer $TOKEN" \
  'http://localhost:9999/api/v1/parameters/presets?taskType=code_generation'
```

### Web Scraping & Data Analysis
```bash
# Get analytics on optimization performance
curl -H "Authorization: Bearer $TOKEN" \
  'http://localhost:9999/api/v1/parameters/analytics'
```

## 🛠️ Available Endpoints

### Authentication
- `POST /api/v1/auth/demo-token` - Generate demo token
- `GET /api/v1/auth/info` - Get auth info
- `POST /api/v1/auth/validate` - Validate token

### Parameters & Optimization
- `GET /api/v1/parameters/presets` - List parameter presets
- `GET /api/v1/parameters/models` - Available models
- `GET /api/v1/parameters/analytics` - Optimization analytics
- `POST /api/v1/parameters/optimize` - Optimize parameters

### Feedback System
- `POST /api/v1/feedback/submit` - Submit feedback
- `GET /api/v1/feedback/history` - Feedback history
- `GET /api/v1/feedback/analytics` - Feedback analytics

### AI Assistant
- `POST /api/v1/assistant/chat` - Chat with AI
- `GET /api/v1/assistant/status` - Assistant status

## 📊 Categories & Types

### Feedback Categories
- `model_performance` - AI model quality
- `user_interface` - UI/UX experience  
- `speed` - Performance and response times
- `accuracy` - Result correctness
- `usability` - Ease of use
- `other` - Other feedback

### Task Types
- `calendar_management` - Scheduling and reminders
- `code_generation` - Programming tasks
- `creative_writing` - Content creation
- `analysis` - Data analysis and reasoning
- `conversation` - Chat and general assistance

## 🚨 Troubleshooting

```bash
# Check service health
curl http://localhost:9999/health

# Check API status
curl http://localhost:9999/api/v1/status

# Test authentication
curl -H "Authorization: Bearer $TOKEN" \
  'http://localhost:9999/api/v1/auth/info'

# View server logs
npm run dev  # Logs appear in console
```

## 🎉 You're Ready!

Your Universal AI Tools service now provides:

- ✅ **Instant Demo Access** - No signup required
- ✅ **JWT Authentication** - Secure and scalable
- ✅ **Parameter Optimization** - ML-powered tuning
- ✅ **Feedback Collection** - User-driven improvements
- ✅ **Multi-Model AI** - 16 available models
- ✅ **Production Ready** - Built for scale

Start building amazing AI applications! 🚀

## 📚 Next Steps

1. **Explore Complex Scenarios**: Try calendar management, Swift development, web scraping
2. **Check System Health**: Monitor `/health` and `/api/v1/status`
3. **Submit Feedback**: Help improve the system with your experience
4. **Scale Up**: Configure Supabase, Redis, and production settings

Happy coding! 💻✨
