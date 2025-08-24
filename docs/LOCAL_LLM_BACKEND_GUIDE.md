# Local LLM Backend Access Guide

## ✅ Backend is Now Available!

Your local LLM backend is now running and accessible at:

### 🚀 Local LLM Server
- **Port**: `7456`
- **Health Check**: `http://localhost:7456/health`
- **Status**: ✅ **RUNNING**

### 📡 Available Endpoints

#### 1. Health & Status
```bash
# Check server health
curl http://localhost:7456/health

# Check LLM services health 
curl http://localhost:7456/local/health
```

#### 2. Available Models
```bash
# List all available models
curl http://localhost:7456/local/models
```

#### 3. OpenAI-Compatible Chat Endpoint
```bash
# Chat with your local LLM
curl -X POST http://localhost:7456/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "tinyllama:latest",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "temperature": 0.7,
    "max_tokens": 100
  }'
```

### 🎯 Your Available Models

1. **tinyllama:latest** (1B parameters) - Good for testing
2. **gpt-oss:20b** (20.9B parameters) - More capable responses  
3. **nomic-embed-text:latest** - For embeddings only

### 🔗 Integration Options

#### For Your LLM Client/Tool:

**Base URL**: `http://localhost:7456`

**OpenAI-Compatible Endpoint**: `http://localhost:7456/v1/chat/completions`

**Authentication**: None required (local access)

#### Example Configurations:

**For OpenAI-compatible clients:**
```json
{
  "base_url": "http://localhost:7456/v1",
  "api_key": "not-required",
  "model": "tinyllama:latest"
}
```

**For direct REST calls:**
```javascript
const response = await fetch('http://localhost:7456/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-oss:20b',
    messages: [
      { role: 'user', content: 'Your question here' }
    ],
    temperature: 0.7,
    max_tokens: 500
  })
});
```

### 🧠 Advanced Features

#### With R1 Reasoning & Status Streaming:
```bash
# Main chat endpoint with status streaming
curl -X POST http://localhost:9999/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Explain quantum computing",
    "forceRealAI": true
  }'
```

#### With Knowledge Graph Integration:
```bash
# Chat with GraphRAG knowledge enhancement
curl -X POST http://localhost:9999/api/v1/graphrag/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How does our conversation system work?",
    "useRL": true,
    "maxHops": 3
  }'
```

### 🚦 Server Status

✅ **Local LLM Server**: Running on port 7456  
✅ **Ollama**: Connected (3 models available)  
❌ **LM Studio**: Not detected (optional)  
✅ **Main Backend**: Running on port 9999  

### 🛠️ Troubleshooting

#### If connection fails:
1. **Check if server is running:**
   ```bash
   curl http://localhost:7456/health
   ```

2. **Restart if needed:**
   ```bash
   # Kill existing process
   pkill -f "local-llm-server"
   
   # Start fresh
   npx tsx src/local-llm-server.ts &
   ```

3. **Check Ollama is running:**
   ```bash
   curl http://localhost:11434/api/tags
   ```

#### If models aren't showing:
- Restart Ollama: `ollama restart` (if installed via CLI)
- Or restart Ollama desktop app

### 🔒 Security Notes

- **Local only**: Server only accepts connections from localhost
- **No authentication**: Designed for local development only
- **Rate limited**: 100 requests per minute per IP
- **CORS enabled**: For frontend integration

### 🎮 Next Steps

Your local LLM is now accessible! You can:

1. **Point your LLM client** to `http://localhost:7456/v1/chat/completions`
2. **Use larger models** like `gpt-oss:20b` for better responses
3. **Enable R1 reasoning** by using the main chat endpoint with complex queries
4. **View real-time status** with the streaming indicators we built

The backend is fully operational and ready for your local LLM to connect! 🚀