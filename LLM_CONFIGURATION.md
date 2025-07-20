# LLM Configuration for Universal AI Tools

This document explains how to configure various LLM providers for the DSPy/MIPRO integration.

## Available LLM Options

### 1. **Ollama (Recommended for Local Development)**

#### Stock Ollama (Port 11434)
- **URL**: `http://localhost:11434`
- **Available Models**: 
  - `llama3.2:3b` - Lightweight, fast responses
  - `qwen2.5:7b` - Good balance of speed and quality
  - `gemma:2b` - Very fast, suitable for simple tasks
  - `deepseek-r1:14b` - Higher quality, slower
  - `devstral:24b` - Highest quality, requires more resources

#### Docker Proxy Ollama (Port 8080)
- **URL**: `http://localhost:8080` 
- **Use Case**: When running services inside Docker containers
- **Configuration**: Same models as stock Ollama

### 2. **LM Studio (Port 1234)**
- **URL**: `http://localhost:1234`
- **Protocol**: OpenAI-compatible API
- **Configuration**: Load any GGUF model in LM Studio

### 3. **OpenAI API**
- **Models**: `gpt-4o-mini`, `gpt-4`, `gpt-3.5-turbo`
- **Configuration**: Set `OPENAI_API_KEY` environment variable

## Configuration Priority

DSPy will try LLM providers in this order:
1. OpenAI (if API key is set)
2. Ollama at stock location (11434)
3. Ollama via Docker proxy (8080)
4. LM Studio (1234)
5. Development mock mode (if NODE_ENV=development)

## Environment Variables

```bash
# Ollama configuration
export OLLAMA_URL=http://localhost:11434  # or http://localhost:8080 for proxy

# LM Studio configuration  
export LM_STUDIO_URL=http://localhost:1234

# OpenAI configuration
export OPENAI_API_KEY=your-api-key-here

# Development mode (allows fallback to mock)
export NODE_ENV=development
```

## Testing Your Configuration

Run the DSPy integration test:
```bash
node test-dspy-integration.mjs
```

Or test directly with curl:
```bash
# Test Ollama
curl http://localhost:11434/api/tags

# Test LM Studio
curl http://localhost:1234/v1/models

# Test Docker proxy
curl http://localhost:8080/api/tags
```

## Troubleshooting

### Ollama Not Found
If you see "model not found" errors:
```bash
# Pull the model first
ollama pull llama3.2:3b
ollama pull qwen2.5:7b
```

### Docker Proxy Issues
Ensure nginx proxy is running:
```bash
docker ps | grep ollama-proxy
```

### LM Studio Connection
1. Ensure LM Studio is running
2. Load a model in LM Studio
3. Enable the local server in LM Studio settings

## Performance Tips

- For development: Use `gemma:2b` or `phi:2.7b` for fast iteration
- For quality: Use `qwen2.5:7b` or `llama3.2:3b`
- For production: Consider OpenAI API or larger local models