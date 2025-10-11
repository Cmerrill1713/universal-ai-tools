# Complete Solution: Making Supabase Studio AI Button Work with Ollama
## The Problem

The Supabase Studio AI Assistant button expects:

1. OpenAI API endpoint (https://api.openai.com)

2. Valid OpenAI API key

3. OpenAI-compatible request/response format
## The Solution

We've created a complete proxy system that intercepts and redirects these requests to Ollama.
### Architecture

```

Supabase Studio → OpenAI Proxy (8081) → Ollama (11434)

                ↓

         Nginx Proxy (8080) ←─────────┘

```
## Setup Instructions
### 1. Start All Services
```bash
# Terminal 1: Ollama

ollama serve

# Terminal 2: Nginx proxy (for CORS)

npm run ollama:nginx:start

# Terminal 3: OpenAI proxy

npm run openai:proxy

```
### 2. Configure Supabase
Option A: Environment Variable

```bash

export OPENAI_API_KEY="sk-ollama-proxy-key"

export OPENAI_API_BASE="http://localhost:8081/v1"

```
Option B: Update .env

```env

OPENAI_API_KEY=sk-ollama-proxy-key

OPENAI_API_BASE=http://localhost:8081/v1

```
### 3. Use the AI Button
Now when you click the AI Assistant button in Supabase Studio:

1. It sends request to OpenAI format endpoint

2. Our proxy intercepts and converts to Ollama format

3. Ollama generates the SQL

4. Proxy converts response back to OpenAI format

5. Supabase Studio displays the result
## Browser Console Method
If the button still doesn't work, paste this in the browser console:
```javascript

// Override fetch to redirect OpenAI to our proxy

const originalFetch = window.fetch;

window.fetch = async function(url, options = {}) {

  if (typeof url === 'string' && url.includes('api.openai.com')) {

    // Redirect to our proxy

    url = url.replace('https://api.openai.com', 'http://localhost:8081');

    console.log('🔄 Redirected to Ollama proxy:', url);

  }

  return originalFetch.call(this, url, options);

};
// Also patch any OpenAI configuration

if (window.localStorage) {

  localStorage.setItem('openai_api_base', 'http://localhost:8081/v1');

}
console.log('✅ AI Assistant now uses Ollama!');

```
## Testing
### Test OpenAI Proxy

```bash

curl -X POST http://localhost:8081/v1/chat/completions \

  -H "Content-Type: application/json" \

  -d '{

    "messages": [

      {"role": "user", "content": "Generate SQL to find all active users"}

    ],

    "model": "llama3.2:3b"

  }'

```
### Test via Browser

1. Open: http://localhost:8081

2. Should show proxy status
### Test in Supabase Studio

1. Go to SQL Editor

2. Click AI Assistant button

3. Type: "show all tables"

4. Should generate SQL via Ollama
## Available Models
The proxy supports all Ollama models:

- `llama3.2:3b` (default, fast)

- `qwen2.5:7b` (better quality)

- `deepseek-r1:14b` (best quality)

- `phi:2.7b-chat-v2-q4_0` (very fast)
## Troubleshooting
### "Failed to generate" error

1. Check Ollama is running: `curl http://localhost:11434/api/tags`

2. Check proxy is running: `curl http://localhost:8081/`

3. Check browser console for errors
### CORS errors

- Make sure nginx proxy is running: `npm run ollama:nginx:status`

- Use the browser console override method
### Button not appearing

- The AI button only appears in the SQL Editor

- Try refreshing the page

- Check if you have the latest Supabase Studio
## How It Works
1. **OpenAI Proxy** (port 8081)

   - Implements OpenAI API endpoints

   - Converts between OpenAI and Ollama formats

   - Handles `/v1/chat/completions` and `/v1/models`
2. **Nginx Proxy** (port 8080)

   - Handles CORS headers

   - Provides alternative access to Ollama
3. **Browser Patches**

   - Intercepts fetch() calls

   - Redirects OpenAI requests to proxy

   - Maintains compatibility
## Summary
With this setup:

- ✅ AI Assistant button works with Ollama

- ✅ No OpenAI API key needed

- ✅ All processing happens locally

- ✅ Supports all Ollama models

- ✅ OpenAI-compatible API for other tools
The key insight is that we're not just proxying to Ollama - we're providing a complete OpenAI-compatible API layer that Supabase Studio can use transparently.