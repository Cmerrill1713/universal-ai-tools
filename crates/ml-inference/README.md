# ML Inference Service

A high-performance machine learning inference service built with Rust and Actix Web.

## Features

- **Model Management**: Load, unload, and manage ML models dynamically
- **High Performance**: Built with Rust for maximum performance
- **Async Processing**: Non-blocking inference with async/await
- **Health Monitoring**: Comprehensive health checks and metrics
- **Memory Management**: Efficient memory usage and garbage collection

## Endpoints

- `GET /health` - Service health check
- `POST /infer` - Perform ML inference
- `GET /models` - List available models
- `POST /models/{id}/load` - Load a specific model
- `POST /models/{id}/unload` - Unload a specific model
- `GET /stats` - Service statistics

## Configuration

Set the following environment variables:

- `PORT` - Service port (default: 8091)
- `MAX_CONCURRENT_REQUESTS` - Maximum concurrent requests (default: 100)
- `MODEL_CACHE_SIZE` - Model cache size (default: 10)

## Usage

```bash
# Start the service
cargo run -p ml-inference

# Health check
curl http://localhost:8091/health

# List models
curl http://localhost:8091/models

# Perform inference
curl -X POST http://localhost:8091/infer \
  -H "Content-Type: application/json" \
  -d '{
    "model_id": "llama3.2:3b",
    "input": "Hello, world!",
    "parameters": {
      "max_tokens": 100,
      "temperature": 0.7
    }
  }'
```

## Request Format

```json
{
  "model_id": "string",
  "input": "any",
  "parameters": {
    "max_tokens": 100,
    "temperature": 0.7
  }
}
```

## Response Format

```json
{
  "result": "any",
  "model_id": "string",
  "inference_time_ms": 150,
  "tokens_generated": 50
}
```

## Development

```bash
# Run tests
cargo test -p ml-inference

# Run with debug logging
RUST_LOG=debug cargo run -p ml-inference
```
