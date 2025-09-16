# LLM Router Service

A high-performance LLM routing service that intelligently routes requests to the best available language model provider.

## Features

- **Multi-Provider Support**: Routes to Ollama, MLX, and other LLM providers
- **Intelligent Caching**: Smart response caching with similarity matching
- **Health Monitoring**: Real-time provider health checks and failover
- **Performance Metrics**: Comprehensive monitoring and analytics
- **Streaming Support**: Real-time response streaming

## Endpoints

- `GET /health` - Service health check
- `GET /models` - List available models
- `POST /chat` - Chat completion endpoint
- `GET /metrics` - Performance metrics

## Configuration

Set the following environment variables:

- `OLLAMA_BASE_URL` - Ollama service URL (default: http://localhost:11434)
- `CACHE_TTL_HOURS` - Cache time-to-live in hours (default: 24)
- `SIMILARITY_THRESHOLD` - Cache similarity threshold (default: 0.8)

## Usage

```bash
# Start the service
cargo run -p llm-router

# Health check
curl http://localhost:3033/health

# List models
curl http://localhost:3033/models

# Chat completion
curl -X POST http://localhost:3033/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Hello!"}],
    "model": "llama3.2:3b",
    "max_tokens": 100
  }'
```

## Architecture

The service uses a smart routing algorithm that considers:

- Provider health and availability
- Response time and performance
- Model capabilities and quality
- Load balancing across providers

## Development

```bash
# Run tests
cargo test -p llm-router

# Run with debug logging
RUST_LOG=debug cargo run -p llm-router
```
