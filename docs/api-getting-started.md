# Getting Started with Universal AI Tools API

Welcome to the Universal AI Tools API! This guide will help you get up and running quickly.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Authentication](#authentication)
3. [Making Your First Request](#making-your-first-request)
4. [Core Features](#core-features)
5. [SDKs and Libraries](#sdks-and-libraries)
6. [Rate Limiting](#rate-limiting)
7. [Error Handling](#error-handling)
8. [WebSocket Support](#websocket-support)
9. [Best Practices](#best-practices)
10. [Support](#support)

## Quick Start

### 1. Get Your API Key

Sign up at [universal-ai-tools.com](https://universal-ai-tools.com) to get your API key.

### 2. Base URL

All API requests should be made to:

```
https://api.universal-ai-tools.com/api/v1
```

For local development:
```
http://localhost:3001/api/v1
```

### 3. Interactive Documentation

Explore our API interactively at:
- **Production**: [https://api.universal-ai-tools.com/api/docs](https://api.universal-ai-tools.com/api/docs)
- **Local**: [http://localhost:3001/api/docs](http://localhost:3001/api/docs)

## Authentication

The API supports two authentication methods:

### Bearer Token (JWT)

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://api.universal-ai-tools.com/api/v1/agents
```

### API Key

```bash
curl -H "X-API-Key: YOUR_API_KEY" \
  https://api.universal-ai-tools.com/api/v1/agents
```

### Getting a JWT Token

```bash
curl -X POST https://api.universal-ai-tools.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your@email.com",
    "password": "your_password"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 86400
  }
}
```

## Making Your First Request

### List Available Agents

```bash
curl https://api.universal-ai-tools.com/api/v1/agents \
  -H "X-API-Key: YOUR_API_KEY"
```

### Send a Chat Message

```bash
curl -X POST https://api.universal-ai-tools.com/api/v1/chat/message \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello, can you help me write a Python function?",
    "agentName": "code-assistant"
  }'
```

### Analyze an Image

```bash
curl -X POST https://api.universal-ai-tools.com/api/v1/vision/analyze \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "https://example.com/image.jpg",
    "prompt": "What objects are in this image?"
  }'
```

## Core Features

### 1. Chat API

Create conversations and exchange messages with AI agents.

**Key Endpoints:**
- `POST /chat/message` - Send a message
- `GET /chat/conversations` - List conversations
- `GET /chat/history/{conversationId}` - Get conversation history
- `POST /chat/stream` - Stream responses

**Example: Streaming Response**

```javascript
const response = await fetch('https://api.universal-ai-tools.com/api/v1/chat/stream', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: 'Write a story about space',
    stream: true
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  console.log(chunk);
}
```

### 2. Agent System

Access 50+ specialized AI agents for different tasks.

**Categories:**
- **General**: Multi-purpose assistants
- **Development**: Code review, debugging, optimization
- **Data**: Analysis, transformation, visualization
- **Security**: Validation, threat analysis
- **Photos**: Image processing, face detection
- **Creative**: Content generation, design

**Example: Using a Specific Agent**

```python
import requests

response = requests.post(
    'https://api.universal-ai-tools.com/api/v1/agents/code-reviewer/execute',
    headers={'Authorization': 'Bearer YOUR_TOKEN'},
    json={
        'task': 'Review this Python code for best practices',
        'context': {
            'code': 'def calculate_sum(numbers):\n    total = 0\n    for n in numbers:\n        total += n\n    return total'
        }
    }
)

print(response.json())
```

### 3. Vision API

Analyze images using computer vision models.

**Features:**
- Object detection
- Face recognition
- Text extraction (OCR)
- Scene understanding
- NSFW detection

**Example: Multi-feature Analysis**

```javascript
const formData = new FormData();
formData.append('image', fileInput.files[0]);
formData.append('features', JSON.stringify(['objects', 'text', 'faces']));

const response = await fetch('https://api.universal-ai-tools.com/api/v1/vision/analyze', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: formData
});

const result = await response.json();
console.log(result.data);
```

### 4. Voice API

Text-to-speech and speech-to-text capabilities.

**TTS Example:**

```python
response = requests.post(
    'https://api.universal-ai-tools.com/api/v1/voice/synthesize',
    headers={'Authorization': 'Bearer YOUR_TOKEN'},
    json={
        'text': 'Hello, this is a test of the voice synthesis API.',
        'voice': 'nova',
        'speed': 1.0
    }
)

with open('output.mp3', 'wb') as f:
    f.write(response.content)
```

### 5. Model Selection

Choose from multiple LLM providers and models.

**Available Providers:**
- OpenAI (GPT-4, GPT-3.5)
- Anthropic (Claude)
- Google (Gemini)
- Meta (LLaMA)
- Local models

**Example: Specify Model**

```javascript
const response = await fetch('https://api.universal-ai-tools.com/api/v1/chat/message', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: 'Explain quantum computing',
    model: 'gpt-4-turbo',
    temperature: 0.7,
    maxTokens: 2000
  })
});
```

## SDKs and Libraries

### Official SDKs

#### TypeScript/JavaScript

```bash
npm install @universal-ai/sdk
```

```typescript
import { UniversalAIClient } from '@universal-ai/sdk';

const client = new UniversalAIClient({
  apiKey: process.env.UAI_API_KEY
});

const response = await client.chat.sendMessage({
  message: 'Hello!',
  agentName: 'assistant'
});
```

#### Python

```bash
pip install universal-ai
```

```python
from universal_ai import UniversalAIClient

client = UniversalAIClient(api_key=os.environ['UAI_API_KEY'])

response = client.chat.send_message(
    message='Hello!',
    agent_name='assistant'
)
```

### Community SDKs

- **Ruby**: `gem install universal-ai-ruby`
- **Go**: `go get github.com/universal-ai/go-sdk`
- **PHP**: `composer require universal-ai/php-sdk`
- **Java**: Maven package available

## Rate Limiting

### Limits by Plan

| Plan | Requests/min | Burst | Concurrent |
|------|-------------|--------|------------|
| Free | 20 | 5/sec | 2 |
| Starter | 100 | 10/sec | 5 |
| Pro | 500 | 25/sec | 20 |
| Enterprise | Custom | Custom | Custom |

### Rate Limit Headers

All responses include rate limit information:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704110400
Retry-After: 60
```

### Handling Rate Limits

```javascript
async function makeRequestWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);
    
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || 60;
      console.log(`Rate limited. Waiting ${retryAfter} seconds...`);
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      continue;
    }
    
    return response;
  }
  
  throw new Error('Max retries exceeded');
}
```

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "message",
      "reason": "Required field missing"
    }
  }
}
```

### Common Error Codes

| Code | Description | Action |
|------|-------------|--------|
| `UNAUTHORIZED` | Missing or invalid auth | Check credentials |
| `FORBIDDEN` | Insufficient permissions | Upgrade plan or request access |
| `NOT_FOUND` | Resource not found | Verify resource ID |
| `VALIDATION_ERROR` | Invalid parameters | Check request format |
| `RATE_LIMIT_EXCEEDED` | Too many requests | Wait and retry |
| `INTERNAL_ERROR` | Server error | Retry or contact support |
| `AGENT_UNAVAILABLE` | Agent is busy/offline | Try different agent |

### Error Handling Example

```python
import requests
from time import sleep

def safe_api_call(url, **kwargs):
    max_retries = 3
    retry_delay = 1
    
    for attempt in range(max_retries):
        try:
            response = requests.post(url, **kwargs)
            response.raise_for_status()
            
            data = response.json()
            if not data.get('success'):
                error = data.get('error', {})
                print(f"API Error: {error.get('message')}")
                
                if error.get('code') == 'RATE_LIMIT_EXCEEDED':
                    retry_after = response.headers.get('Retry-After', 60)
                    sleep(int(retry_after))
                    continue
                    
            return data
            
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 503:
                sleep(retry_delay * (2 ** attempt))
                continue
            raise
            
        except Exception as e:
            print(f"Unexpected error: {e}")
            if attempt < max_retries - 1:
                sleep(retry_delay)
                continue
            raise
    
    return None
```

## WebSocket Support

### Establishing Connection

```javascript
const ws = new WebSocket('wss://api.universal-ai-tools.com/api/v1/ws/chat');

ws.onopen = () => {
  // Authenticate
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'YOUR_JWT_TOKEN'
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  handleMessage(message);
};
```

### Message Types

**Send Message:**
```json
{
  "type": "message",
  "data": {
    "content": "Hello!",
    "conversationId": "uuid",
    "stream": true
  }
}
```

**Receive Response:**
```json
{
  "type": "response",
  "data": {
    "content": "Hi there! How can I help?",
    "messageId": "uuid",
    "complete": true
  }
}
```

### Reconnection Logic

```javascript
class ReconnectingWebSocket {
  constructor(url, token) {
    this.url = url;
    this.token = token;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    this.connect();
  }
  
  connect() {
    this.ws = new WebSocket(this.url);
    
    this.ws.onopen = () => {
      this.reconnectDelay = 1000;
      this.authenticate();
    };
    
    this.ws.onclose = () => {
      setTimeout(() => {
        this.reconnectDelay = Math.min(
          this.reconnectDelay * 2,
          this.maxReconnectDelay
        );
        this.connect();
      }, this.reconnectDelay);
    };
  }
  
  authenticate() {
    this.send({ type: 'auth', token: this.token });
  }
  
  send(data) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}
```

## Best Practices

### 1. Efficient Token Usage

- Cache responses when appropriate
- Use streaming for long responses
- Batch related requests
- Set appropriate `maxTokens` limits

### 2. Context Management

```javascript
class ConversationManager {
  constructor(client) {
    this.client = client;
    this.contexts = new Map();
  }
  
  async sendMessage(conversationId, message) {
    // Include relevant context
    const context = this.contexts.get(conversationId) || {};
    
    const response = await this.client.chat.sendMessage({
      message,
      conversationId,
      context: {
        ...context,
        recentMessages: this.getRecentMessages(conversationId, 5)
      }
    });
    
    // Update context
    this.updateContext(conversationId, response);
    
    return response;
  }
  
  updateContext(conversationId, response) {
    const context = this.contexts.get(conversationId) || {};
    context.lastResponse = response.data.response;
    context.lastAgent = response.data.agentName;
    this.contexts.set(conversationId, context);
  }
}
```

### 3. Agent Selection

Choose the right agent for your task:

```javascript
function selectAgent(task) {
  const agentMap = {
    'code': ['code-assistant', 'code-reviewer', 'debugger'],
    'data': ['data-analyst', 'data-organizer'],
    'image': ['vision-analyst', 'face-detector'],
    'writing': ['content-writer', 'editor'],
    'general': ['assistant', 'coordinator']
  };
  
  const category = detectCategory(task);
  const agents = agentMap[category] || agentMap['general'];
  
  return agents[0]; // Or implement more sophisticated selection
}
```

### 4. Error Recovery

```python
class ResilientClient:
    def __init__(self, api_key):
        self.client = UniversalAIClient(api_key=api_key)
        self.fallback_agents = {
            'code-assistant': ['debugger', 'assistant'],
            'vision-analyst': ['assistant'],
            'data-analyst': ['data-organizer', 'assistant']
        }
    
    async def execute_with_fallback(self, agent_name, task):
        agents_to_try = [agent_name] + self.fallback_agents.get(agent_name, ['assistant'])
        
        for agent in agents_to_try:
            try:
                response = await self.client.agents.execute(
                    agent_name=agent,
                    task=task
                )
                
                if response['success']:
                    return response
                    
            except Exception as e:
                print(f"Agent {agent} failed: {e}")
                continue
        
        raise Exception("All agents failed")
```

### 5. Monitoring and Logging

```javascript
class APIMonitor {
  constructor(client) {
    this.client = client;
    this.metrics = {
      requests: 0,
      errors: 0,
      latencies: []
    };
    
    this.wrapClient();
  }
  
  wrapClient() {
    const originalRequest = this.client.request;
    
    this.client.request = async (...args) => {
      const start = Date.now();
      this.metrics.requests++;
      
      try {
        const response = await originalRequest.apply(this.client, args);
        
        const latency = Date.now() - start;
        this.metrics.latencies.push(latency);
        
        if (!response.success) {
          this.metrics.errors++;
          console.error('API Error:', response.error);
        }
        
        return response;
        
      } catch (error) {
        this.metrics.errors++;
        const latency = Date.now() - start;
        this.metrics.latencies.push(latency);
        
        console.error('Request failed:', error);
        throw error;
      }
    };
  }
  
  getStats() {
    const avgLatency = this.metrics.latencies.reduce((a, b) => a + b, 0) / 
                       this.metrics.latencies.length || 0;
    
    return {
      totalRequests: this.metrics.requests,
      errorRate: this.metrics.errors / this.metrics.requests,
      averageLatency: avgLatency,
      p95Latency: this.percentile(this.metrics.latencies, 0.95)
    };
  }
  
  percentile(arr, p) {
    const sorted = arr.slice().sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[index];
  }
}
```

## Support

### Resources

- **Documentation**: [https://docs.universal-ai-tools.com](https://docs.universal-ai-tools.com)
- **API Status**: [https://status.universal-ai-tools.com](https://status.universal-ai-tools.com)
- **GitHub**: [https://github.com/universal-ai-tools](https://github.com/universal-ai-tools)

### Contact

- **Email**: support@universal-ai-tools.com
- **Discord**: [Join our community](https://discord.gg/universal-ai)
- **Twitter**: [@UniversalAITools](https://twitter.com/UniversalAITools)

### FAQ

**Q: How do I increase my rate limits?**
A: Upgrade your plan or contact sales for enterprise options.

**Q: Can I use multiple API keys?**
A: Yes, but they must be for different accounts.

**Q: Is there a sandbox environment?**
A: Yes, use `sandbox.universal-ai-tools.com` for testing.

**Q: How do I report issues?**
A: Use our GitHub issues or email support.

**Q: Are there webhooks available?**
A: Yes, configure webhooks in your dashboard for async events.

## Next Steps

1. **Explore the interactive docs**: [/api/docs](http://localhost:3001/api/docs)
2. **Try different agents**: Each has unique capabilities
3. **Experiment with WebSockets**: For real-time features
4. **Join our Discord**: Get help and share feedback
5. **Build something amazing**: We'd love to see what you create!

---

*Last updated: January 2025*