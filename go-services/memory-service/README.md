# Memory Service

A Go-based memory and context management service providing persistent storage for AI conversations and user data.

## Features

- **Memory Storage**: Store and retrieve user memories
- **Context Management**: Maintain conversation context
- **Multi-Database Support**: PostgreSQL, Redis, and Weaviate integration
- **Tag-based Organization**: Organize memories with tags
- **Search Capabilities**: Full-text and semantic search
- **User Isolation**: Secure user data separation

## Endpoints

- `GET /health` - Service health check
- `POST /memories` - Store a new memory
- `GET /memories` - List memories for a user
- `GET /memories/{id}` - Get specific memory
- `PUT /memories/{id}` - Update a memory
- `DELETE /memories/{id}` - Delete a memory
- `POST /memories/search` - Search memories
- `GET /context/{user_id}` - Get user context
- `POST /context/{user_id}` - Update user context

## Configuration

Set the following environment variables:

- `PORT` - Service port (default: 8017)
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `WEAVIATE_URL` - Weaviate instance URL
- `WEAVIATE_API_KEY` - Weaviate API key (optional)

## Usage

```bash
# Start the service
go run main.go

# Health check
curl http://localhost:8017/health

# Store a memory
curl -X POST http://localhost:8017/memories \
  -H "Content-Type: application/json" \
  -H "X-User-ID: user123" \
  -d '{
    "content": "User mentioned they prefer detailed explanations",
    "tags": ["preference", "communication"],
    "metadata": {"source": "chat"}
  }'

# List user memories
curl -X GET "http://localhost:8017/memories?limit=10" \
  -H "X-User-ID: user123"

# Search memories
curl -X POST http://localhost:8017/memories/search \
  -H "Content-Type: application/json" \
  -H "X-User-ID: user123" \
  -d '{
    "query": "communication preferences",
    "limit": 5
  }'
```

## Request/Response Formats

### Store Memory

```json
{
  "content": "string",
  "tags": ["tag1", "tag2"],
  "metadata": {}
}
```

### Memory Response

```json
{
  "id": "uuid",
  "user_id": "string",
  "content": "string",
  "tags": ["tag1", "tag2"],
  "metadata": {},
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-01T00:00:00Z"
}
```

### List Memories

```json
{
  "memories": [
    {
      "id": "uuid",
      "content": "string",
      "tags": ["tag1"],
      "created_at": "2025-01-01T00:00:00Z"
    }
  ],
  "count": 1,
  "total": 1
}
```

### Search Request

```json
{
  "query": "string",
  "limit": 10,
  "tags": ["tag1"],
  "date_from": "2025-01-01T00:00:00Z",
  "date_to": "2025-01-31T23:59:59Z"
}
```

## Database Schema

### PostgreSQL Tables

- `memories` - Core memory storage
- `memory_tags` - Tag relationships
- `user_context` - User context data

### Redis Keys

- `user:{user_id}:memories` - User memory cache
- `memory:{id}` - Individual memory cache

### Weaviate Classes

- `Memory` - Vector embeddings for semantic search

## Development

```bash
# Run tests
go test

# Build
go build

# Run with debug logging
LOG_LEVEL=debug go run main.go

# Test database connections
go run main.go -test-db
```

## Security

- **User Isolation**: All operations require `X-User-ID` header
- **Input Validation**: All inputs are validated and sanitized
- **SQL Injection Protection**: Uses parameterized queries
- **Rate Limiting**: Built-in rate limiting for API endpoints
