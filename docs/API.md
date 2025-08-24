# Universal AI Tools API Documentation

## Overview

The Universal AI Tools platform provides a comprehensive REST API for AI model interaction, memory management, agent orchestration, and system monitoring. This documentation covers all available endpoints, authentication, and integration patterns.

## Base URL

```
Local Development: http://localhost:3001/api/v1
Production: https://your-domain.com/api/v1
```

## Authentication

All API endpoints (except health checks) require authentication using JWT tokens.

### Headers
```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Getting a Token
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "deviceId": "your-device-id",
  "deviceType": "Mac|iPhone|iPad|AppleWatch"
}
```

## Core Endpoints

### 🤖 Agent Management

#### List Available Agents
```http
GET /api/v1/agents
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "enhanced-planner",
      "name": "Enhanced Planning Agent",
      "type": "cognitive",
      "status": "active",
      "capabilities": ["planning", "reasoning", "optimization"],
      "version": "1.0.0"
    }
  ]
}
```

#### Execute Agent Task
```http
POST /api/v1/agents/{agentId}/execute
```

**Request Body:**
```json
{
  "task": "Plan a software architecture review",
  "context": {
    "projectType": "web-application",
    "teamSize": 5,
    "timeline": "2 weeks"
  },
  "priority": "high"
}
```

#### Get Agent Status
```http
GET /api/v1/agents/{agentId}/status
```

### 💬 Chat & LLM Interaction

#### Send Chat Message
```http
POST /api/v1/chat/message
```

**Request Body:**
```json
{
  "message": "Explain quantum computing",
  "model": "gpt-4",
  "sessionId": "session_123",
  "context": {
    "conversationHistory": true,
    "useMemory": true
  },
  "options": {
    "maxTokens": 1000,
    "temperature": 0.7,
    "stream": false
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "msg_456",
    "content": "Quantum computing is a revolutionary...",
    "model": "gpt-4",
    "usage": {
      "promptTokens": 15,
      "completionTokens": 200,
      "totalTokens": 215
    },
    "responseTime": 1250,
    "sessionId": "session_123"
  }
}
```

#### Stream Chat Response
```http
POST /api/v1/chat/stream
Content-Type: application/json
Accept: text/event-stream
```

**Server-Sent Events Response:**
```
data: {"type": "start", "sessionId": "session_123"}
data: {"type": "token", "content": "Quantum"}
data: {"type": "token", "content": " computing"}
data: {"type": "end", "usage": {"totalTokens": 215}}
```

### 🧠 Memory Management

#### Store Memory
```http
POST /api/v1/memory/store
```

**Request Body:**
```json
{
  "content": "User prefers morning meetings",
  "userId": "user_123",
  "sessionId": "session_456",
  "importance": 0.8,
  "contextType": "preference",
  "retentionPolicy": "permanent",
  "tags": ["meetings", "schedule", "preference"]
}
```

#### Retrieve Memories
```http
POST /api/v1/memory/retrieve
```

**Request Body:**
```json
{
  "query": "meeting preferences",
  "userId": "user_123",
  "limit": 10,
  "threshold": 0.7,
  "filters": {
    "contextType": "preference"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "entries": [
      {
        "id": "mem_789",
        "content": "User prefers morning meetings",
        "importance": 0.8,
        "relevanceScore": 0.95,
        "createdAt": "2024-01-15T10:30:00Z",
        "tags": ["meetings", "schedule", "preference"]
      }
    ],
    "totalResults": 1,
    "searchTime": 45
  }
}
```

#### Get Memory Analytics
```http
GET /api/v1/memory/analytics?userId={userId}
```

### 🔍 Model Management

#### List Available Models
```http
GET /api/v1/models
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "gpt-4",
      "name": "GPT-4",
      "provider": "openai",
      "type": "text",
      "contextLength": 8192,
      "available": true,
      "pricing": {
        "inputCostPer1kTokens": 0.03,
        "outputCostPer1kTokens": 0.06
      }
    },
    {
      "id": "llama3.1",
      "name": "Llama 3.1",
      "provider": "ollama",
      "type": "text",
      "contextLength": 4096,
      "available": true,
      "local": true
    }
  ]
}
```

#### Get Model Performance
```http
GET /api/v1/models/{modelId}/performance
```

**Response:**
```json
{
  "success": true,
  "data": {
    "modelId": "gpt-4",
    "averageLatency": 1250,
    "errorRate": 0.02,
    "tokensPerSecond": 45,
    "availability": 0.99,
    "qualityScore": 0.95,
    "totalRequests": 10547,
    "successfulRequests": 10333
  }
}
```

### 🔧 System Monitoring

#### Health Check
```http
GET /api/v1/monitoring/health
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-15T15:30:00Z",
    "uptime": 3600000,
    "service": "Universal AI Tools",
    "version": "1.0.0",
    "environment": "production",
    "metrics": {
      "consecutiveErrors": 0,
      "recentErrorCount": 1,
      "averageResponseTime": 450,
      "totalErrors": 23
    },
    "checks": {
      "errorRate": "pass",
      "responseTime": "pass",
      "consecutiveErrors": "pass"
    }
  }
}
```

#### System Metrics
```http
GET /api/v1/monitoring/metrics
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "errors": {
      "totalErrors": 23,
      "errorsByType": {"ValidationError": 5, "TimeoutError": 3},
      "errorsByPath": {"/api/v1/chat": 8, "/api/v1/agents": 4},
      "consecutiveErrors": 0,
      "recentErrorCount": 1
    },
    "rateLimiting": {
      "activeClients": 45,
      "totalRules": 12,
      "blockedRequests": 3
    },
    "system": {
      "uptime": 3600000,
      "memory": {"heapUsed": 89123456, "heapTotal": 134217728},
      "cpu": {"user": 123456, "system": 67890},
      "nodeVersion": "v18.17.0"
    }
  }
}
```

#### Error Logs
```http
GET /api/v1/monitoring/errors?limit=50&since=2024-01-15T10:00:00Z
Authorization: Bearer <admin_token>
```

### 🎙️ Speech & Audio

#### Text-to-Speech
```http
POST /api/v1/speech/synthesize
```

**Request Body:**
```json
{
  "text": "Hello, this is a test of the speech synthesis system.",
  "voice": "kokoro",
  "format": "mp3",
  "options": {
    "speed": 1.0,
    "pitch": 1.0,
    "volume": 0.8
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "audioUrl": "/api/v1/speech/audio/abc123.mp3",
    "duration": 3.5,
    "format": "mp3",
    "size": 56789
  }
}
```

### 👤 User Management

#### Get User Preferences
```http
GET /api/v1/users/preferences
```

**Response:**
```json
{
  "success": true,
  "data": {
    "theme": "dark",
    "defaultModel": "gpt-4",
    "maxTokens": 1000,
    "temperature": 0.7,
    "streamResponses": true,
    "enableAnalytics": true,
    "notifications": {
      "email": true,
      "push": false,
      "alerts": true
    }
  }
}
```

#### Update User Preferences
```http
PUT /api/v1/users/preferences
```

**Request Body:**
```json
{
  "defaultModel": "claude-3-sonnet",
  "temperature": 0.8,
  "notifications": {
    "email": false,
    "push": true
  }
}
```

### 📊 Analytics & Feedback

#### Submit Feedback
```http
POST /api/v1/feedback
```

**Request Body:**
```json
{
  "type": "suggestion",
  "category": "model_performance",
  "rating": 4,
  "title": "Model Response Quality",
  "description": "The model responses are generally good but could be more concise.",
  "context": {
    "modelUsed": "gpt-4",
    "taskType": "summarization",
    "responseTime": 1250
  }
}
```

#### Get Feedback Analytics
```http
GET /api/v1/feedback/analytics?timeRange=7d
Authorization: Bearer <admin_token>
```

## Error Handling

All endpoints return errors in a consistent format:

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Invalid request parameters",
  "metadata": {
    "requestId": "req_abc123",
    "timestamp": "2024-01-15T15:30:00Z"
  }
}
```

### Common Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `AUTHENTICATION_FAILED` | Invalid or expired token | 401 |
| `AUTHORIZATION_FAILED` | Insufficient permissions | 403 |
| `VALIDATION_ERROR` | Invalid request data | 400 |
| `RATE_LIMIT_EXCEEDED` | Too many requests | 429 |
| `MODEL_UNAVAILABLE` | Requested model not available | 503 |
| `INTERNAL_ERROR` | Server error | 500 |
| `TIMEOUT_ERROR` | Request timeout | 408 |

## Rate Limiting

The API implements comprehensive rate limiting:

- **Global**: 1000 requests per hour
- **Per User**: 100 requests per hour  
- **Per IP**: 500 requests per hour
- **Chat**: 50 messages per hour
- **Memory**: 200 operations per hour

Rate limit headers are included in responses:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642248000
```

## WebSocket Events

For real-time features, connect to the WebSocket endpoint:

```
ws://localhost:3001/api/v1/ws
```

### Event Types

#### Chat Streaming
```json
{
  "type": "chat.stream",
  "sessionId": "session_123",
  "token": "Hello",
  "isComplete": false
}
```

#### Agent Status Updates
```json
{
  "type": "agent.status",
  "agentId": "enhanced-planner",
  "status": "processing",
  "progress": 0.75
}
```

#### System Alerts
```json
{
  "type": "system.alert",
  "severity": "warning",
  "message": "High memory usage detected",
  "service": "memory-service"
}
```

## Integration Examples

### cURL Examples

#### Send Chat Message
```bash
curl -X POST http://localhost:3001/api/v1/chat/message \
  -H "Authorization: Bearer your_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is the weather like?",
    "model": "gpt-4",
    "sessionId": "session_123"
  }'
```

#### Store Memory
```bash
curl -X POST http://localhost:3001/api/v1/memory/store \
  -H "Authorization: Bearer your_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "User prefers concise responses",
    "userId": "user_123",
    "importance": 0.8,
    "contextType": "preference"
  }'
```

### JavaScript SDK Example

```javascript
import { UniversalAIClient } from '@universal-ai/client';

const client = new UniversalAIClient({
  baseURL: 'http://localhost:3001/api/v1',
  apiKey: 'your_api_key_here'
});

// Send chat message
const response = await client.chat.send({
  message: 'Explain machine learning',
  model: 'gpt-4',
  sessionId: 'session_123'
});

// Store memory
await client.memory.store({
  content: 'User is interested in machine learning',
  userId: 'user_123',
  contextType: 'interest'
});

// Execute agent
const result = await client.agents.execute('enhanced-planner', {
  task: 'Create project timeline',
  context: { projectType: 'web-app' }
});
```

### Python SDK Example

```python
from universal_ai import UniversalAIClient

client = UniversalAIClient(
    base_url="http://localhost:3001/api/v1",
    api_key="your_api_key_here"
)

# Send chat message
response = client.chat.send(
    message="What is quantum computing?",
    model="gpt-4",
    session_id="session_123"
)

# Store memory
client.memory.store(
    content="User asked about quantum computing",
    user_id="user_123",
    context_type="interest",
    importance=0.9
)
```

## Changelog

### v1.0.0 (2024-01-15)
- Initial API release
- Chat and LLM integration
- Memory management
- Agent orchestration
- Monitoring and analytics
- User preferences
- Feedback collection

## Support

For API support and questions:
- GitHub Issues: [Universal AI Tools Issues](https://github.com/your-org/universal-ai-tools/issues)
- Documentation: [Full Documentation](https://docs.universalaitools.com)
- Discord: [Developer Community](https://discord.gg/universalai)