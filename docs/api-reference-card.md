# Universal AI Tools API - Quick Reference Card

## Authentication
```bash
# Bearer Token
Authorization: Bearer <token>

# API Key  
X-API-Key: <key>
```

## Base URLs
- **Production**: `https://api.universal-ai-tools.com/api/v1`
- **Local**: `http://localhost:3001/api/v1`
- **Docs**: `/api/docs`

## Core Endpoints

### 🗨️ Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/chat/message` | Send message |
| POST | `/chat/stream` | Stream response |
| GET | `/chat/conversations` | List conversations |
| GET | `/chat/history/{id}` | Get history |
| POST | `/chat/conversations` | New conversation |
| DELETE | `/chat/conversations/{id}` | Delete conversation |

### 🤖 Agents  
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/agents` | List all agents |
| GET | `/agents/{name}` | Agent details |
| POST | `/agents/{name}/execute` | Execute task |
| GET | `/agents/categories` | List categories |
| GET | `/agents/search?q={query}` | Search agents |

### 🧠 Models
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/models` | List models |
| GET | `/models/{id}` | Model details |
| POST | `/models/{id}/test` | Test model |
| GET | `/models/recommended` | Get recommendations |

### 👁️ Vision
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/vision/analyze` | Analyze image |
| POST | `/vision/ocr` | Extract text |
| POST | `/vision/face-detect` | Detect faces |
| POST | `/vision/describe` | Describe scene |

### 🎙️ Voice
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/voice/synthesize` | Text to speech |
| POST | `/voice/transcribe` | Speech to text |
| GET | `/voice/voices` | List voices |

### 💾 Memory
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/memory/context` | Get context |
| POST | `/memory/context` | Update context |
| DELETE | `/memory/context` | Clear context |
| GET | `/memory/stats` | Memory stats |

### 📊 Monitoring
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/monitoring/health` | Health check |
| GET | `/monitoring/metrics` | System metrics |
| GET | `/monitoring/status` | Service status |

### 🔌 WebSocket
| Protocol | Endpoint | Description |
|----------|----------|-------------|
| WS | `/ws/chat` | Chat WebSocket |
| WS | `/ws/agents` | Agent coordination |
| WS | `/ws/notifications` | System events |

## Request Examples

### Basic Chat
```bash
curl -X POST localhost:3001/api/v1/chat/message \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!"}'
```

### Stream Response
```bash
curl -N -X POST localhost:3001/api/v1/chat/stream \
  -H "Authorization: Bearer TOKEN" \
  -d '{"message": "Tell me a story", "stream": true}'
```

### Execute Agent
```bash
curl -X POST localhost:3001/api/v1/agents/code-assistant/execute \
  -H "X-API-Key: YOUR_KEY" \
  -d '{"task": "Review this code", "context": {"code": "..."}}'
```

### Analyze Image
```bash
curl -X POST localhost:3001/api/v1/vision/analyze \
  -H "Authorization: Bearer TOKEN" \
  -F "image=@photo.jpg" \
  -F "features=[\"objects\", \"text\"]"
```

## Response Format

### Success
```json
{
  "success": true,
  "data": { ... },
  "metadata": {
    "timestamp": "ISO-8601",
    "requestId": "uuid",
    "processingTime": 123
  }
}
```

### Error
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Description",
    "details": { ... }
  }
}
```

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 429 | Rate Limited |
| 500 | Server Error |
| 503 | Service Unavailable |

## Rate Limits

| Plan | Req/min | Burst/sec |
|------|---------|-----------|
| Free | 20 | 5 |
| Pro | 100 | 10 |
| Enterprise | 1000 | 50 |

## Headers

### Request
- `Authorization: Bearer <token>`
- `X-API-Key: <key>`
- `Content-Type: application/json`
- `X-Request-ID: <uuid>` (optional)

### Response
- `X-RateLimit-Limit: 100`
- `X-RateLimit-Remaining: 95`
- `X-RateLimit-Reset: 1704110400`
- `X-Request-ID: <uuid>`
- `X-Processing-Time: 123`

## WebSocket Messages

### Client → Server
```json
{
  "type": "auth|message|subscribe|ping",
  "data": { ... }
}
```

### Server → Client
```json
{
  "type": "response|stream|error|event",
  "data": { ... }
}
```

## Error Codes

| Code | Description | Action |
|------|-------------|--------|
| `UNAUTHORIZED` | Invalid auth | Check credentials |
| `RATE_LIMIT_EXCEEDED` | Too many requests | Wait & retry |
| `VALIDATION_ERROR` | Invalid params | Fix request |
| `AGENT_UNAVAILABLE` | Agent busy/offline | Try another |
| `INTERNAL_ERROR` | Server error | Retry later |

## Agent Categories

- 🎯 **General**: Multi-purpose assistants
- 💻 **Development**: Code, debugging, testing
- 📊 **Data**: Analysis, transformation
- 🛡️ **Security**: Validation, threats
- 📸 **Photos**: Images, faces, vision
- 🎨 **Creative**: Content, design

## Popular Agents

1. `assistant` - General purpose
2. `code-assistant` - Coding help
3. `code-reviewer` - Code review
4. `data-analyst` - Data analysis
5. `vision-analyst` - Image analysis
6. `content-writer` - Writing
7. `debugger` - Debug code
8. `face-detector` - Face detection
9. `translator` - Translation
10. `summarizer` - Summarization

## Model Options

### OpenAI
- `gpt-4-turbo` (128k context)
- `gpt-4` (8k context)
- `gpt-3.5-turbo` (16k context)

### Anthropic
- `claude-3-opus`
- `claude-3-sonnet`
- `claude-3-haiku`

### Google
- `gemini-pro`
- `gemini-pro-vision`

### Local
- `llama-2-70b`
- `mixtral-8x7b`
- `phi-2`

## Quick Tips

1. **Use streaming** for long responses
2. **Cache responses** when possible
3. **Batch requests** to reduce calls
4. **Select specific agents** for better results
5. **Include context** for continuity
6. **Handle rate limits** gracefully
7. **Use WebSockets** for real-time
8. **Monitor usage** via metrics endpoint

## Support

- 📚 Docs: `/api/docs`
- 📧 Email: support@universal-ai-tools.com
- 💬 Discord: [Join Community](https://discord.gg/uai)
- 🐛 Issues: [GitHub](https://github.com/universal-ai-tools)

---
*Version 2.0 | January 2025*