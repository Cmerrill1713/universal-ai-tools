# API Documentation

## Overview

The Universal AI Tools platform provides a comprehensive REST API for AI-powered applications. All APIs are accessible through the API Gateway at `http://localhost:8080`.

## Authentication

### API Key Authentication

```bash
curl -H "X-API-Key: your-api-key" http://localhost:8080/api/endpoint
```

### JWT Authentication

```bash
curl -H "Authorization: Bearer your-jwt-token" http://localhost:8080/api/endpoint
```

### User ID Header

```bash
curl -H "X-User-ID: user123" http://localhost:8080/api/endpoint
```

## Base URLs

- **Development**: `http://localhost:8080`
- **Production**: `https://api.yourdomain.com`

## API Endpoints

### 1. Chat API

#### POST /api/chat

Send a chat message and receive a response.

**Request:**

```json
{
  "messages": [
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "model": "llama3.2:3b",
  "max_tokens": 100,
  "temperature": 0.7,
  "stream": false
}
```

**Response:**

```json
{
  "content": "Hello! I'm doing well, thank you for asking. How can I help you today?",
  "model": "llama3.2:3b",
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 15,
    "total_tokens": 25
  },
  "finish_reason": "stop"
}
```

**Streaming Response:**

```
data: {"type": "content", "content": "Hello"}
data: {"type": "content", "content": " there"}
data: {"type": "done", "final_response": "Hello there"}
```

### 2. RAG API

#### POST /api/rag

Retrieval-Augmented Generation with context.

**Request:**

```json
{
  "query": "What did we discuss about machine learning?",
  "user_id": "user123",
  "max_iterations": 3,
  "context_threshold": 0.8,
  "max_context_length": 4000
}
```

**Response:**

```json
{
  "response": "Based on our previous conversation, we discussed the fundamentals of machine learning, including supervised and unsupervised learning algorithms...",
  "sources": [
    {
      "id": "memory_123",
      "content": "User mentioned interest in ML algorithms",
      "relevance_score": 0.95
    }
  ],
  "iterations": 2,
  "context_used": 1200
}
```

### 3. Memory API

#### POST /api/memories

Store a new memory.

**Request:**

```json
{
  "content": "User prefers detailed explanations with examples",
  "tags": ["preference", "communication"],
  "metadata": {
    "source": "chat",
    "importance": "high"
  }
}
```

**Response:**

```json
{
  "id": "uuid-123",
  "user_id": "user123",
  "content": "User prefers detailed explanations with examples",
  "tags": ["preference", "communication"],
  "metadata": {
    "source": "chat",
    "importance": "high"
  },
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-01T00:00:00Z"
}
```

#### GET /api/memories

Retrieve memories for a user.

**Query Parameters:**

- `limit` (optional): Number of memories to return (default: 10)
- `offset` (optional): Number of memories to skip (default: 0)
- `tags` (optional): Filter by tags (comma-separated)

**Response:**

```json
{
  "memories": [
    {
      "id": "uuid-123",
      "content": "User prefers detailed explanations",
      "tags": ["preference"],
      "created_at": "2025-01-01T00:00:00Z"
    }
  ],
  "count": 1,
  "total": 1,
  "has_more": false
}
```

#### POST /api/memories/search

Search memories using semantic search.

**Request:**

```json
{
  "query": "communication preferences",
  "limit": 5,
  "tags": ["preference"],
  "date_from": "2025-01-01T00:00:00Z",
  "date_to": "2025-01-31T23:59:59Z"
}
```

**Response:**

```json
{
  "results": [
    {
      "id": "uuid-123",
      "content": "User prefers detailed explanations",
      "relevance_score": 0.95,
      "tags": ["preference", "communication"]
    }
  ],
  "total": 1
}
```

### 4. ML Inference API

#### POST /api/infer

Perform ML inference.

**Request:**

```json
{
  "model_id": "llama3.2:3b",
  "input": "Generate a creative story about a robot",
  "parameters": {
    "max_tokens": 200,
    "temperature": 0.8
  }
}
```

**Response:**

```json
{
  "output": "Once upon a time, in a world where technology and humanity coexisted...",
  "model_id": "llama3.2:3b",
  "inference_time": 1.23,
  "tokens_generated": 45
}
```

#### GET /api/models

List available models.

**Response:**

```json
{
  "models": [
    {
      "id": "llama3.2:3b",
      "name": "Llama 3.2 3B",
      "type": "text-generation",
      "status": "loaded",
      "memory_usage": "2.1GB"
    }
  ]
}
```

### 5. Vision API

#### POST /api/vision/analyze

Analyze an image.

**Request:**

```json
{
  "image_url": "https://example.com/image.jpg",
  "analysis_type": "general",
  "options": {
    "extract_text": true,
    "detect_objects": true,
    "generate_caption": true
  }
}
```

**Response:**

```json
{
  "analysis": {
    "caption": "A beautiful sunset over the ocean",
    "objects": [
      {
        "name": "sun",
        "confidence": 0.95,
        "bbox": [100, 50, 200, 150]
      }
    ],
    "text": "Welcome to Paradise Beach",
    "colors": ["#FF6B35", "#F7931E", "#FFD23F"]
  },
  "processing_time": 2.1
}
```

#### POST /api/vision/upload

Upload and analyze an image.

**Request:** Multipart form data

- `image`: Image file
- `analysis_type`: Type of analysis (optional)

**Response:**

```json
{
  "id": "vision_123",
  "status": "processing",
  "upload_url": "http://localhost:8084/vision/result/vision_123"
}
```

### 6. Vector Database API

#### POST /api/vectors/collections

Create a new vector collection.

**Request:**

```json
{
  "id": "embeddings",
  "dimension": 1536,
  "description": "Text embeddings collection"
}
```

**Response:**

```json
{
  "id": "embeddings",
  "dimension": 1536,
  "description": "Text embeddings collection",
  "created_at": "2025-01-01T00:00:00Z",
  "vector_count": 0
}
```

#### POST /api/vectors/collections/{id}/vectors

Add vectors to a collection.

**Request:**

```json
{
  "vectors": [
    {
      "id": "doc1",
      "vector": [0.1, 0.2, 0.3],
      "metadata": {
        "text": "Sample document",
        "source": "file1.txt"
      }
    }
  ]
}
```

**Response:**

```json
{
  "inserted_count": 1,
  "collection_id": "embeddings",
  "total_vectors": 1
}
```

#### GET /api/vectors/collections/{id}/search

Search for similar vectors.

**Query Parameters:**

- `query`: Query vector (comma-separated values)
- `limit`: Number of results (default: 10)
- `threshold`: Similarity threshold (default: 0.5)

**Response:**

```json
{
  "results": [
    {
      "id": "doc1",
      "score": 0.95,
      "metadata": {
        "text": "Sample document",
        "source": "file1.txt"
      }
    }
  ],
  "total": 1
}
```

## Error Responses

### Standard Error Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input parameters",
    "details": {
      "field": "messages",
      "reason": "Required field is missing"
    }
  },
  "timestamp": "2025-01-01T00:00:00Z",
  "request_id": "req_123"
}
```

### Error Codes

| Code                   | HTTP Status | Description                       |
| ---------------------- | ----------- | --------------------------------- |
| `VALIDATION_ERROR`     | 400         | Invalid request parameters        |
| `AUTHENTICATION_ERROR` | 401         | Invalid or missing authentication |
| `AUTHORIZATION_ERROR`  | 403         | Insufficient permissions          |
| `NOT_FOUND`            | 404         | Resource not found                |
| `RATE_LIMIT_EXCEEDED`  | 429         | Too many requests                 |
| `INTERNAL_ERROR`       | 500         | Internal server error             |
| `SERVICE_UNAVAILABLE`  | 503         | Service temporarily unavailable   |

## Rate Limiting

### Limits

- **Free Tier**: 100 requests/hour
- **Pro Tier**: 1,000 requests/hour
- **Enterprise**: Custom limits

### Headers

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

## Webhooks

### Event Types

- `memory.created`
- `memory.updated`
- `memory.deleted`
- `chat.completed`
- `inference.completed`

### Webhook Payload

```json
{
  "event": "memory.created",
  "data": {
    "id": "uuid-123",
    "user_id": "user123",
    "content": "New memory created"
  },
  "timestamp": "2025-01-01T00:00:00Z"
}
```

## SDKs and Examples

### Python SDK

```python
from universal_ai_tools import Client

client = Client(api_key="your-api-key")

# Chat
response = client.chat(
    messages=[{"role": "user", "content": "Hello!"}],
    model="llama3.2:3b"
)

# Store memory
memory = client.memories.store(
    content="User prefers detailed explanations",
    tags=["preference"]
)

# Search memories
results = client.memories.search(
    query="communication preferences",
    limit=5
)
```

### JavaScript SDK

```javascript
import { UniversalAITools } from "universal-ai-tools";

const client = new UniversalAITools({
  apiKey: "your-api-key",
});

// Chat
const response = await client.chat({
  messages: [{ role: "user", content: "Hello!" }],
  model: "llama3.2:3b",
});

// Store memory
const memory = await client.memories.store({
  content: "User prefers detailed explanations",
  tags: ["preference"],
});
```

### cURL Examples

```bash
# Chat
curl -X POST http://localhost:8080/api/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "messages": [{"role": "user", "content": "Hello!"}],
    "model": "llama3.2:3b"
  }'

# Store memory
curl -X POST http://localhost:8080/api/memories \
  -H "Content-Type: application/json" \
  -H "X-User-ID: user123" \
  -d '{
    "content": "User preference noted",
    "tags": ["preference"]
  }'

# Search memories
curl -X POST http://localhost:8080/api/memories/search \
  -H "Content-Type: application/json" \
  -H "X-User-ID: user123" \
  -d '{
    "query": "preferences",
    "limit": 5
  }'
```

## Testing

### Postman Collection

Import the Postman collection from `docs/postman/Universal-AI-Tools.postman_collection.json`

### Test Environment

- **Base URL**: `http://localhost:8080`
- **Test API Key**: `test-api-key-123`
- **Test User ID**: `test-user-123`

## Support

### Documentation

- **API Reference**: This document
- **System Architecture**: `SYSTEM_ARCHITECTURE.md`
- **Deployment Guide**: `DEPLOYMENT_GUIDE.md`

### Contact

- **Email**: support@yourdomain.com
- **Discord**: https://discord.gg/your-server
- **GitHub Issues**: https://github.com/your-org/universal-ai-tools/issues
