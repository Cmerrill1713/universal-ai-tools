# Universal AI Tools API Reference

## Overview

Universal AI Tools provides a comprehensive REST API and WebSocket interface for AI-powered applications. The system uses a hybrid architecture with Go (API Gateway, WebSocket), Rust (LLM Router, AI Core), and TypeScript (legacy compatibility).

**Base URL**: `http://localhost:8090` (Development)  
**WebSocket URL**: `ws://localhost:8080/ws`  
**Authentication**: JWT Bearer tokens

## Table of Contents

1. [Authentication](#authentication)
2. [Core Endpoints](#core-endpoints)
3. [Chat API](#chat-api)
4. [Agent Management](#agent-management)
5. [WebSocket Events](#websocket-events)
6. [Vector Search](#vector-search)
7. [Error Handling](#error-handling)
8. [Rate Limiting](#rate-limiting)

---

## Authentication

All API requests (except health checks) require JWT authentication.

### Generate Demo Token

**POST** `/api/v1/auth/demo-token`

Generate a demo token for testing purposes.

```bash
curl -X POST http://localhost:8090/api/v1/auth/demo-token \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-app",
    "duration": "24h"
  }'
```

**Request Body:**
```json
{
  "name": "string",        // Application name
  "duration": "string"     // Valid: "1h", "24h", "7d", "30d"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "tokenType": "Bearer",
    "expiresAt": "2025-08-23T13:16:27Z",
    "expiresIn": "24h",
    "user": {
      "id": "demo-123",
      "email": "demo@universal-ai-tools.com",
      "name": "my-app",
      "isDemoToken": true
    }
  }
}
```

### Login

**POST** `/api/v1/auth/login`

Authenticate with username and password.

```bash
curl -X POST http://localhost:8090/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "user@example.com",
    "password": "securepassword"
  }'
```

### Validate Token

**POST** `/api/v1/auth/validate`

Validate an existing token.

```bash
curl -X POST http://localhost:8090/api/v1/auth/validate \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Core Endpoints

### Health Check

**GET** `/api/health`

Check service health (no authentication required).

```bash
curl http://localhost:8090/api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-08-22T13:14:25Z",
  "uptime": "11m53s"
}
```

### Detailed Health

**GET** `/api/v1/health`

Get detailed health information for all services.

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8090/api/v1/health
```

**Response:**
```json
{
  "status": "healthy",
  "services": {
    "api_gateway": "healthy",
    "llm_router": "healthy",
    "websocket": "healthy",
    "vector_db": "healthy",
    "redis": "connected",
    "postgresql": "connected"
  },
  "metrics": {
    "memory_usage_mb": 987,
    "cpu_usage_percent": 12.5,
    "active_connections": 42,
    "request_rate_per_sec": 25
  }
}
```

---

## Chat API

### Send Chat Message

**POST** `/api/v1/chat`

Send a chat message and receive AI response.

```bash
curl -X POST http://localhost:8090/api/v1/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello, how can you help me?",
    "model": "gemma2:2b",
    "stream": false,
    "conversationId": "conv-123",
    "temperature": 0.7
  }'
```

**Request Body:**
```json
{
  "message": "string",           // Required: User message
  "model": "string",             // Optional: Model to use (default: gemma2:2b)
  "stream": false,               // Optional: Enable streaming response
  "conversationId": "string",    // Optional: Conversation context
  "temperature": 0.7,            // Optional: Creativity (0.0-1.0)
  "maxTokens": 1000,            // Optional: Max response length
  "systemPrompt": "string"       // Optional: System instructions
}
```

**Response (Non-streaming):**
```json
{
  "success": true,
  "response": "I'm here to help! I can assist with...",
  "usage": {
    "promptTokens": 15,
    "completionTokens": 120,
    "totalTokens": 135
  },
  "model": "gemma2:2b",
  "conversationId": "conv-123"
}
```

### Stream Chat Response

**POST** `/api/v1/chat/stream`

Stream chat responses using Server-Sent Events (SSE).

```bash
curl -X POST http://localhost:8090/api/v1/chat/stream \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{
    "message": "Write a poem about AI",
    "model": "llama3.2:3b"
  }'
```

**SSE Response Format:**
```
data: {"chunk": "Here", "index": 0}
data: {"chunk": " is", "index": 1}
data: {"chunk": " a", "index": 2}
data: {"chunk": " poem", "index": 3}
data: {"done": true, "usage": {...}}
```

### List Available Models

**GET** `/api/v1/models`

Get list of available AI models.

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8090/api/v1/models
```

**Response:**
```json
{
  "models": [
    {
      "id": "gemma2:2b",
      "name": "Gemma 2B",
      "size": "1.7GB",
      "quantization": "Q4_K_M",
      "context_length": 8192,
      "available": true
    },
    {
      "id": "llama3.2:3b",
      "name": "Llama 3.2 3B",
      "size": "2.0GB",
      "quantization": "Q4_K_M",
      "context_length": 128000,
      "available": true
    }
  ]
}
```

---

## Agent Management

### List Agents

**GET** `/api/v1/agents`

Get list of available AI agents.

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8090/api/v1/agents
```

**Response:**
```json
{
  "agents": [
    {
      "id": "code-assistant",
      "name": "Code Assistant",
      "description": "Helps with programming tasks",
      "capabilities": ["code_generation", "debugging", "refactoring"],
      "status": "active"
    },
    {
      "id": "research-agent",
      "name": "Research Agent",
      "description": "Performs web research and analysis",
      "capabilities": ["web_search", "summarization", "fact_checking"],
      "status": "active"
    }
  ]
}
```

### Execute Agent Task

**POST** `/api/v1/agents/{agentId}/execute`

Execute a task with a specific agent.

```bash
curl -X POST http://localhost:8090/api/v1/agents/code-assistant/execute \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Write a Python function to calculate fibonacci",
    "context": {},
    "options": {
      "language": "python",
      "style": "functional"
    }
  }'
```

---

## WebSocket Events

### Connection

Connect to WebSocket with authentication:

```javascript
const ws = new WebSocket('ws://localhost:8080/ws');
ws.addEventListener('open', () => {
  // Send authentication
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'YOUR_JWT_TOKEN'
  }));
});
```

### Message Types

**Chat Message:**
```json
{
  "type": "chat",
  "id": "msg-123",
  "content": "User message",
  "timestamp": "2025-08-22T13:30:00Z"
}
```

**Status Update:**
```json
{
  "type": "status",
  "service": "llm_router",
  "status": "processing",
  "details": "Generating response..."
}
```

**Heartbeat:**
```json
{
  "type": "heartbeat",
  "timestamp": "2025-08-22T13:30:00Z"
}
```

**Error:**
```json
{
  "type": "error",
  "code": "RATE_LIMIT",
  "message": "Too many requests",
  "retryAfter": 30
}
```

---

## Vector Search

### Search Documents

**POST** `/api/v1/search`

Perform semantic search on vector embeddings.

```bash
curl -X POST http://localhost:8090/api/v1/search \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How does authentication work?",
    "collection": "universal_ai_docs",
    "limit": 5,
    "scoreThreshold": 0.7
  }'
```

**Response:**
```json
{
  "results": [
    {
      "id": "doc-1",
      "score": 0.92,
      "text": "JWT authentication ensures secure API access...",
      "metadata": {
        "category": "security",
        "source": "documentation"
      }
    }
  ],
  "totalResults": 1,
  "searchTime": "12ms"
}
```

### Add Embeddings

**POST** `/api/v1/embeddings`

Add new documents to vector database.

```bash
curl -X POST http://localhost:8090/api/v1/embeddings \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "documents": [
      {
        "id": "doc-123",
        "text": "Sample document text",
        "metadata": {
          "category": "tutorial",
          "tags": ["api", "documentation"]
        }
      }
    ],
    "collection": "universal_ai_docs"
  }'
```

---

## Error Handling

All errors follow a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request format",
    "details": "Field 'model' is required",
    "timestamp": "2025-08-22T13:30:00Z",
    "requestId": "req-abc123"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request parameters |
| `RATE_LIMIT` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

---

## Rate Limiting

API requests are rate limited per token:

- **Demo tokens**: 100 requests/hour
- **Authenticated users**: 1000 requests/hour
- **Admin tokens**: Unlimited

Rate limit information is included in response headers:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 950
X-RateLimit-Reset: 1755872400
```

When rate limited, you'll receive:

```json
{
  "error": {
    "code": "RATE_LIMIT",
    "message": "Rate limit exceeded",
    "retryAfter": 3600
  }
}
```

---

## SDK Examples

### JavaScript/TypeScript

```typescript
import { UniversalAIClient } from '@universal-ai/sdk';

const client = new UniversalAIClient({
  apiKey: 'YOUR_TOKEN',
  baseURL: 'http://localhost:8090'
});

// Send chat message
const response = await client.chat.send({
  message: 'Hello!',
  model: 'gemma2:2b'
});

// Stream response
const stream = await client.chat.stream({
  message: 'Write a story',
  model: 'llama3.2:3b'
});

for await (const chunk of stream) {
  console.log(chunk.content);
}
```

### Python

```python
from universal_ai import Client

client = Client(
    api_key="YOUR_TOKEN",
    base_url="http://localhost:8090"
)

# Send chat message
response = client.chat.send(
    message="Hello!",
    model="gemma2:2b"
)

# Search vectors
results = client.search(
    query="authentication",
    collection="universal_ai_docs",
    limit=5
)
```

### Swift

```swift
import UniversalAIKit

let client = UniversalAIClient(
    token: "YOUR_TOKEN",
    baseURL: "http://localhost:8090"
)

// Send chat message
let response = try await client.chat.send(
    message: "Hello!",
    model: "gemma2:2b"
)

// WebSocket connection
try await client.websocket.connect()
client.websocket.onMessage = { message in
    print("Received: \(message)")
}
```

---

## Production Deployment

For production deployment, update the base URLs:

```javascript
// Production configuration
const API_BASE = 'https://api.universal-ai-tools.com';
const WS_BASE = 'wss://ws.universal-ai-tools.com';
```

Ensure you:
1. Use HTTPS/WSS for secure connections
2. Configure proper CORS headers
3. Implement request signing for additional security
4. Use environment-specific API keys
5. Enable request/response logging for audit trails

---

## Support

For issues or questions:
- GitHub: https://github.com/universal-ai-tools/api
- Documentation: https://docs.universal-ai-tools.com
- Email: support@universal-ai-tools.com