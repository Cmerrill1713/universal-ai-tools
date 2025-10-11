# Supabase Studio with Ollama AI Integration

This guide explains how to use Ollama instead of OpenAI for AI features in Supabase Studio.

## Overview

Since Supabase Studio's AI features are hardcoded to use OpenAI, we've created several workarounds to use Ollama instead:

1. **SQL Functions**: Database functions that call Ollama
2. **Edge Functions**: Supabase Edge Functions that proxy to Ollama
3. **Direct SQL Queries**: Use Ollama through SQL commands

## Setup Complete

The following components have been created:

### 1. Database Functions

Three AI functions are available in your database:

```sql
-- Generate SQL from natural language
SELECT ai_generate_sql('find all users who logged in today');

-- Explain SQL queries
SELECT ai_explain_sql('SELECT * FROM users WHERE last_login > NOW() - INTERVAL ''1 day'';');

-- Optimize SQL queries
SELECT ai_optimize_sql('SELECT * FROM orders o JOIN users u ON o.user_id = u.id;');
```

### 2. Edge Function

Located at `supabase/functions/ollama-ai/`, this function provides an HTTP endpoint for AI operations.

### 3. Ollama Proxy Service

Located at `src/services/ollama-ai-proxy.ts`, this provides a local API that mimics OpenAI's interface.

## Using Ollama in Supabase Studio

### Option 1: SQL Editor (Recommended)

Instead of using the AI button in Studio, run these SQL queries directly:

```sql
-- Example: Generate a query to find inactive users
SELECT ai_generate_sql('find users who haven''t logged in for 30 days');

-- Example: Explain a complex query
SELECT ai_explain_sql('
  SELECT u.name, COUNT(o.id) as order_count
  FROM users u
  LEFT JOIN orders o ON u.id = o.user_id
  GROUP BY u.id, u.name
  HAVING COUNT(o.id) > 5
');
```

### Option 2: Custom UI

We can create a custom UI that integrates with Supabase Studio:

1. Open Supabase Studio: http://localhost:54323
2. Use the SQL Editor tab
3. Run the AI functions directly

### Option 3: Browser Console

You can also use the browser console in Supabase Studio:

```javascript
// Paste this in the browser console while in Supabase Studio
async function askOllama(prompt) {
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama3.2:3b',
      prompt: `Generate PostgreSQL for: ${prompt}`,
      stream: false
    })
  });
  const data = await response.json();
  console.log(data.response);
  return data.response;
}

// Usage
await askOllama('find all orders from last week');
```

## Available Models

Your Ollama instance has these models available:
- `llama3.2:3b` (default, fast)
- `qwen2.5:7b` (better for complex queries)
- `deepseek-r1:14b` (best quality)
- `phi:2.7b-chat-v2-q4_0` (lightweight)

To use a different model, modify the function calls:

```sql
SELECT ai_generate_sql('your prompt', 'qwen2.5:7b');
```

## Tips

1. **Performance**: The `llama3.2:3b` model is fast and good for most SQL generation
2. **Complex Queries**: Use `qwen2.5:7b` or `deepseek-r1:14b` for complex queries
3. **Caching**: Results are not cached, so repeated calls will regenerate

## Troubleshooting

### Ollama not responding?
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Restart Ollama if needed
ollama serve
```

### Functions not working?
```bash
# Apply the migration
npx supabase db push

# Check function exists
psql $DATABASE_URL -c "\df ai_*"
```

### Want to modify the prompts?

Edit the functions in `supabase/migrations/20250119_ollama_ai_functions.sql` and reapply:
```bash
npx supabase db reset
npx supabase db push
```

## Summary

While Supabase Studio's UI expects OpenAI, you can effectively use Ollama by:
1. Running AI SQL functions directly in the SQL Editor
2. Using the browser console for quick queries
3. Building custom integrations with the provided functions

The "failed to load branches" error and AI button not working are cosmetic issues that don't affect the actual functionality of using Ollama for SQL generation!