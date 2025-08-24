# Universal AI Tools API Documentation

## Overview
Universal AI Tools provides a comprehensive REST API for AI-powered development assistance. The API is optimized for local-first operation with <1GB memory usage.

**Base URL**: `http://localhost:9999`  
**Production URL**: `https://yourdomain.com`

## Authentication
All authenticated endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

## Core Endpoints

### Health & Status

#### `GET /health`
Health check endpoint for monitoring.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-08-20T12:00:00Z",
  "services": {
    "database": "connected",
    "redis": "connected",
    "ollama": "connected"
  }
}
```

#### `GET /api/status`
Get detailed system status and metrics.

**Response:**
```json
{
  "status": "operational",
  "memory": {
    "used": 95.3,
    "total": 1024,
    "percentage": 9.3
  },
  "services": {
    "consolidated": 10,
    "original": 68,
    "reduction": "85%"
  },
  "performance": {
    "avgResponseTime": 223,
    "uptime": 3600
  }
}
```

### Authentication

#### `POST /api/auth/register`
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

#### `POST /api/auth/login`
Authenticate and receive JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

### Chat & AI Interactions

#### `POST /api/chat`
Send a message to the AI assistant.

**Headers:**
- `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "message": "How do I implement authentication in React?",
  "context": {
    "language": "javascript",
    "framework": "react"
  },
  "model": "gpt-4"
}
```

**Response:**
```json
{
  "response": "To implement authentication in React...",
  "tokens": {
    "prompt": 150,
    "completion": 450,
    "total": 600
  },
  "model": "gpt-4",
  "timestamp": "2025-08-20T12:00:00Z"
}
```

### Agent Management

#### `GET /api/agents`
List available AI agents.

**Response:**
```json
{
  "agents": [
    {
      "id": "code-reviewer",
      "name": "Code Reviewer",
      "description": "Reviews code for quality and best practices",
      "capabilities": ["code-review", "suggestions", "security-check"]
    }
  ]
}
```

#### `POST /api/agents/execute`
Execute a specific agent task.

**Request Body:**
```json
{
  "agentId": "code-reviewer",
  "task": "review",
  "data": {
    "code": "function add(a, b) { return a + b }",
    "language": "javascript"
  }
}
```

### Memory Optimization

#### `GET /api/memory/stats`
Get current memory usage statistics.

**Response:**
```json
{
  "current": {
    "heapUsed": 85.2,
    "heapTotal": 150.0,
    "rss": 95.3,
    "external": 5.1
  },
  "peak": {
    "heapUsed": 120.5,
    "timestamp": "2025-08-20T11:30:00Z"
  }
}
```

### Local LLM (Ollama)

#### `GET /api/local-llm/models`
List available Ollama models.

**Response:**
```json
{
  "models": [
    {
      "name": "llama3.2:3b",
      "size": "1.9GB",
      "loaded": true
    }
  ]
}
```

#### `POST /api/local-llm/generate`
Generate text using local Ollama model.

**Request Body:**
```json
{
  "model": "llama3.2:3b",
  "prompt": "Explain React hooks",
  "temperature": 0.7,
  "max_tokens": 500
}
```

## Rate Limiting

- **Default**: 200 requests per 15 minutes per IP
- **Authenticated**: 1000 requests per 15 minutes per user
- **Headers**:
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Requests remaining
  - `X-RateLimit-Reset`: Unix timestamp when limit resets

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Detailed error message",
    "timestamp": "2025-08-20T12:00:00Z"
  }
}
```

### Error Codes
- `INVALID_REQUEST` - Bad request parameters
- `UNAUTHORIZED` - Missing or invalid authentication
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `RATE_LIMITED` - Too many requests
- `INTERNAL_ERROR` - Server error