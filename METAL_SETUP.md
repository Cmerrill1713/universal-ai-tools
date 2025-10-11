# macOS Metal GPU Setup Guide

This guide provides instructions for running Universal AI Tools on macOS with Metal GPU acceleration.

## Prerequisites

- macOS 12.0+ (Monterey or later)
- Apple Silicon Mac (M1/M2/M3) or Intel Mac with AMD GPU
- Docker Desktop for Mac
- Homebrew

## Quick Setup

```bash
# Run the automated setup script
./setup-metal.sh
```

## Manual Setup

### 1. Install Ollama Natively

For best Metal GPU performance, run Ollama natively on macOS:

```bash
# Install Ollama
brew install ollama

# Start Ollama service
brew services start ollama

# Verify Metal acceleration
ollama run llama3.2:1b "Hello, test Metal acceleration"
```

### 2. Configure Docker Services

Use the Metal-optimized Docker Compose configuration:

```bash
# Start services (Ollama runs natively, not in Docker)
docker-compose -f docker-compose.metal.yml up -d

# Check service status
docker-compose -f docker-compose.metal.yml ps
```

### 3. Environment Configuration

Update your `.env` file:

```env
# Point to native Ollama installation
OLLAMA_HOST=http://host.docker.internal:11434

# Other configurations
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Architecture

```
┌─────────────────┐
│   macOS Host    │
│                 │
│  ┌───────────┐  │     ┌─────────────────────┐
│  │  Ollama   │  │     │   Docker Services   │
│  │  (Metal)  │◄─┼─────┤  • API             │
│  └───────────┘  │     │  • Dashboard       │
│                 │     │  • Redis           │
│                 │     │  • PostgreSQL      │
│                 │     │  • SearXNG         │
│                 │     │  • Monitoring      │
│                 │     └─────────────────────┘
└─────────────────┘
```

## Performance Optimization

### Metal-Specific Settings

1. **Memory Allocation**

   ```bash
   # Set Ollama memory limit (in GB)
   export OLLAMA_MAX_MEMORY=8
   ```

2. **Model Loading**

   ```bash
   # Optimize for Metal
   export OLLAMA_ACCELERATOR=metal
   export OLLAMA_NUM_PARALLEL=4
   ```

3. **Recommended Models for Metal**
   - `llama3.2:1b` - Fastest, lowest memory
   - `llama3.2:3b` - Good balance
   - `phi3:mini` - Excellent for coding
   - `mistral:7b` - High quality, more memory

## Monitoring Performance

### Check Metal GPU Usage

```bash
# Monitor GPU usage
sudo powermetrics --samplers gpu_power -i500 -n1

# Check Ollama GPU utilization
ollama ps
```

### Docker Resource Usage

```bash
# Monitor Docker containers
docker stats

# Check API logs
docker-compose -f docker-compose.metal.yml logs -f api
```

## Troubleshooting

### Issue: Ollama not using Metal

```bash
# Verify Metal support
ollama show llama3.2:1b --verbose

# Check for Metal in capabilities
system_profiler SPDisplaysDataType | grep Metal
```

### Issue: Docker can't connect to Ollama

```bash
# Ensure Ollama is running
brew services list | grep ollama

# Test connection
curl http://localhost:11434/api/tags
```

### Issue: High memory usage

```bash
# Limit Ollama models in memory
export OLLAMA_MAX_LOADED_MODELS=2

# Restart Ollama
brew services restart ollama
```

## Best Practices

1. **Run Ollama natively** - Don't containerize Ollama on macOS for best Metal performance
2. **Use smaller models** - Metal performs best with models under 7B parameters
3. **Monitor temperature** - Use `sudo powermetrics` to watch GPU temperature
4. **Allocate memory wisely** - Leave 4-8GB for system use

## Useful Commands

```bash
# Start everything
brew services start ollama
docker-compose -f docker-compose.metal.yml up -d

# Stop everything
docker-compose -f docker-compose.metal.yml down
brew services stop ollama

# Update models
ollama pull llama3.2:latest

# Clean up Docker
docker system prune -a
```

## Performance Benchmarks

Typical performance on Apple Silicon with Metal:

| Model       | M1        | M1 Pro    | M2        | M3        |
| ----------- | --------- | --------- | --------- | --------- |
| llama3.2:1b | 120 tok/s | 150 tok/s | 140 tok/s | 160 tok/s |
| llama3.2:3b | 60 tok/s  | 80 tok/s  | 75 tok/s  | 90 tok/s  |
| mistral:7b  | 30 tok/s  | 45 tok/s  | 40 tok/s  | 55 tok/s  |

## Additional Resources

- [Ollama Metal Documentation](https://github.com/ollama/ollama/blob/main/docs/gpu.md)
- [Docker Desktop for Mac](https://docs.docker.com/desktop/mac/)
- [Apple Metal Developer](https://developer.apple.com/metal/)
