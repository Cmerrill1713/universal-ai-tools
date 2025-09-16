# Assistantd Service

A comprehensive AI assistant service providing RAG (Retrieval-Augmented Generation), chat capabilities, and streaming responses.

## Features

- **RAG Integration**: Retrieval-augmented generation with context
- **Streaming Responses**: Real-time response streaming
- **Memory Management**: Persistent memory and context storage
- **Multi-Model Support**: Integration with various LLM providers
- **Context Awareness**: Maintains conversation context
- **Performance Monitoring**: Built-in metrics and health checks

## Endpoints

- `GET /health` - Service health check
- `POST /chat` - Chat completion with context
- `POST /rag` - RAG-powered responses
- `GET /memory` - Retrieve stored memories
- `POST /memory` - Store new memories
- `GET /context` - Get current context
- `POST /context` - Update context

## Configuration

Set the following environment variables:

- `PORT` - Service port (default: 8086)
- `MEMORY_SERVICE_URL` - Memory service URL (default: http://localhost:8017)
- `LLM_ROUTER_URL` - LLM router URL (default: http://localhost:3033)
- `MAX_CONTEXT_LENGTH` - Maximum context length (default: 4000)
- `MEMORY_RETENTION_DAYS` - Memory retention period (default: 30)

## Usage

```bash
# Start the service
cargo run -p assistantd

# Health check
curl http://localhost:8086/health

# Chat with context
curl -X POST http://localhost:8086/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What did we discuss about AI?",
    "user_id": "user123",
    "context_id": "session456"
  }'

# RAG-powered response
curl -X POST http://localhost:8086/rag \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How does machine learning work?",
    "user_id": "user123",
    "max_iterations": 3,
    "context_threshold": 0.8
  }'

# Store memory
curl -X POST http://localhost:8086/memory \
  -H "Content-Type: application/json" \
  -d '{
    "content": "User prefers detailed explanations",
    "user_id": "user123",
    "tags": ["preference", "communication"]
  }'
```

## Request/Response Formats

### Chat Request

```json
{
  "message": "string",
  "user_id": "string",
  "context_id": "string",
  "stream": true
}
```

### RAG Request

```json
{
  "query": "string",
  "user_id": "string",
  "max_iterations": 3,
  "context_threshold": 0.8,
  "max_context_length": 4000
}
```

### Memory Storage

```json
{
  "content": "string",
  "user_id": "string",
  "tags": ["tag1", "tag2"],
  "metadata": {}
}
```

### Streaming Response

```
data: {"type": "content", "content": "Hello"}
data: {"type": "content", "content": " there"}
data: {"type": "done", "final_response": "Hello there"}
```

## Architecture

The service integrates:

- **Memory Service** for persistent storage
- **LLM Router** for model access
- **Context Management** for conversation flow
- **RAG Pipeline** for enhanced responses

## Development

```bash
# Run tests
cargo test -p assistantd

# Run with debug logging
RUST_LOG=debug cargo run -p assistantd

# Test streaming
curl -X POST http://localhost:8086/chat \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"message": "Hello", "user_id": "test", "stream": true}'
```
