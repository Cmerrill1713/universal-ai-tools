# API Gateway

A Go-based API Gateway providing unified access to all Universal AI Tools services with authentication, routing, and load balancing.

## Features

- **Service Discovery**: Automatic service registration and health checking
- **Authentication**: JWT and API key authentication
- **Load Balancing**: Intelligent request routing
- **Rate Limiting**: Protect services from overload
- **Request/Response Logging**: Comprehensive audit trail
- **Health Monitoring**: Service health aggregation

## Endpoints

- `GET /health` - Gateway health check
- `GET /services` - List registered services
- `POST /api/chat` - Chat service proxy
- `POST /api/rag` - RAG service proxy
- `GET /api/memories` - Memory service proxy
- `POST /api/memories` - Memory storage proxy
- `POST /api/infer` - ML inference proxy
- `GET /api/models` - Model listing proxy

## Configuration

Set the following environment variables:

- `PORT` - Gateway port (default: 8080)
- `JWT_SECRET` - JWT signing secret
- `API_KEY_HEADER` - API key header name (default: X-API-Key)
- `RATE_LIMIT_RPS` - Rate limit per second (default: 100)
- `SERVICE_TIMEOUT` - Service timeout in seconds (default: 30)

## Service Registry

The gateway automatically discovers and registers services:

```go
services := map[string]string{
    "llm-router":    "http://localhost:3033",
    "ml-inference":  "http://localhost:8091",
    "memory-service": "http://localhost:8017",
    "vision-service": "http://localhost:8084",
    "auth-service":   "http://localhost:8015",
    "chat-service":   "http://localhost:8016",
}
```

## Usage

```bash
# Start the gateway
go run main.go

# Health check
curl http://localhost:8080/health

# List services
curl http://localhost:8080/services

# Chat through gateway
curl -X POST http://localhost:8080/api/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "messages": [{"role": "user", "content": "Hello!"}],
    "model": "llama3.2:3b"
  }'

# Store memory through gateway
curl -X POST http://localhost:8080/api/memories \
  -H "Content-Type: application/json" \
  -H "X-User-ID: user123" \
  -d '{
    "content": "User preference noted",
    "tags": ["preference"]
  }'
```

## Authentication

### API Key Authentication

```bash
curl -H "X-API-Key: your-api-key" http://localhost:8080/api/chat
```

### JWT Authentication

```bash
curl -H "Authorization: Bearer your-jwt-token" http://localhost:8080/api/chat
```

### User ID Header

```bash
curl -H "X-User-ID: user123" http://localhost:8080/api/memories
```

## Request/Response Formats

### Chat Proxy

```json
// Request
{
  "messages": [{"role": "user", "content": "Hello!"}],
  "model": "llama3.2:3b",
  "max_tokens": 100
}

// Response
{
  "content": "Hello! How can I help you?",
  "model": "llama3.2:3b",
  "usage": {"prompt_tokens": 10, "completion_tokens": 15}
}
```

### Memory Proxy

```json
// Request
{
  "content": "User preference",
  "tags": ["preference"],
  "metadata": {}
}

// Response
{
  "id": "uuid",
  "user_id": "user123",
  "content": "User preference",
  "created_at": "2025-01-01T00:00:00Z"
}
```

## Load Balancing

The gateway implements intelligent load balancing:

- **Round Robin**: Default for stateless services
- **Least Connections**: For stateful services
- **Health-based**: Skip unhealthy services
- **Circuit Breaker**: Fail fast for down services

## Rate Limiting

Built-in rate limiting protects services:

- **Per-IP**: Limit requests per IP address
- **Per-User**: Limit requests per user ID
- **Per-Service**: Limit requests to specific services
- **Burst Handling**: Allow temporary bursts

## Development

```bash
# Run tests
go test

# Build
go build

# Run with debug logging
LOG_LEVEL=debug go run main.go

# Test service discovery
curl http://localhost:8080/services
```

## Monitoring

The gateway provides comprehensive monitoring:

- **Request Metrics**: Count, latency, error rates
- **Service Health**: Individual service status
- **Authentication**: Success/failure rates
- **Rate Limiting**: Throttled request counts
