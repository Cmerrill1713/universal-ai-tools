# Supabase Native LLM & BYOM Integration Guide

## Overview
Supabase provides several ways to integrate LLMs directly into your database and edge functions, with a fully hosted LLM API in development.

## Current LLM Features

### 1. Built-in AI Inference (Edge Functions)

Supabase Edge Functions include native AI capabilities using the `gte-small` model.

```typescript
// supabase/functions/generate-embedding/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { env, pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.5.0'

// Configure embeddings pipeline
env.useBrowserCache = false;
env.allowLocalModels = false;
const pipe = await pipeline(
  'feature-extraction',
  'Supabase/gte-small',
);

serve(async (req) => {
  const { input } = await req.json()
  
  // Generate embedding using built-in model
  const output = await pipe(input, {
    pooling: 'mean',
    normalize: true,
  });
  
  // Extract embedding values
  const embedding = Array.from(output.data)
  
  return new Response(
    JSON.stringify({ embedding }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
```

### 2. BYOM with OpenAI-Compatible APIs

Connect any OpenAI-compatible LLM to Supabase:

```typescript
// supabase/functions/custom-llm/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { prompt, model = 'grok-beta' } = await req.json()
  
  // Use any OpenAI-compatible API (xAI, Ollama, etc.)
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('XAI_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
    }),
  })
  
  const data = await response.json()
  
  // Store in Supabase
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  
  await supabase.from('llm_responses').insert({
    prompt,
    response: data.choices[0].message.content,
    model,
    timestamp: new Date().toISOString()
  })
  
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

### 3. Local LLM Integration with Ollama

```typescript
// Connect to local Ollama instance
const OLLAMA_BASE_URL = Deno.env.get('OLLAMA_URL') || 'http://localhost:11434'

export async function generateWithOllama(prompt: string, model: string = 'codellama') {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: {
        temperature: 0.3,
        top_p: 0.9,
      }
    })
  })
  
  return await response.json()
}
```

## Vector Database Setup

### 1. Enable pgvector
```sql
-- Enable the extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create table with embeddings
CREATE TABLE code_snippets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  language TEXT,
  embedding vector(384), -- gte-small dimensions
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for similarity search
CREATE INDEX ON code_snippets 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

### 2. Automatic Embedding Generation
```sql
-- Function to generate embeddings automatically
CREATE OR REPLACE FUNCTION generate_embedding()
RETURNS TRIGGER AS $$
BEGIN
  -- Call edge function to generate embedding
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/generate-embedding',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('input', NEW.content)
  ) INTO NEW.embedding;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for automatic embeddings
CREATE TRIGGER embed_on_insert
BEFORE INSERT ON code_snippets
FOR EACH ROW
EXECUTE FUNCTION generate_embedding();
```

## Model Context Protocol (MCP) Integration

### 1. Connect AI Tools to Supabase
```typescript
// Use with Claude Desktop, Cursor, or other MCP-compatible tools
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-supabase",
        "--supabaseUrl",
        "https://your-project.supabase.co",
        "--supabaseServiceRoleKey",
        "your-service-role-key"
      ]
    }
  }
}
```

### 2. Available MCP Tools
- Query builder
- Database operations (select, insert, update, delete)
- Schema inspection
- Function execution
- Real-time subscriptions

## Practical Implementation: Code Fix System

### 1. Database Schema
```sql
-- Store code analysis with embeddings
CREATE TABLE code_analysis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  file_path TEXT NOT NULL,
  error_code TEXT,
  error_message TEXT,
  code_snippet TEXT,
  code_embedding vector(384),
  suggested_fix TEXT,
  fix_embedding vector(384),
  confidence FLOAT,
  llm_model TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Similarity search function
CREATE OR REPLACE FUNCTION find_similar_errors(
  query_embedding vector(384),
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  error_code TEXT,
  error_message TEXT,
  suggested_fix TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ca.id,
    ca.error_code,
    ca.error_message,
    ca.suggested_fix,
    1 - (ca.code_embedding <=> query_embedding) AS similarity
  FROM code_analysis ca
  WHERE ca.suggested_fix IS NOT NULL
  ORDER BY ca.code_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

### 2. Edge Function for Code Fixes
```typescript
// supabase/functions/fix-code-error/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

serve(async (req) => {
  const { error, code, file_path } = await req.json()
  
  // 1. Generate embedding for the error
  const embeddingResponse = await fetch(
    `${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-embedding`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: `${error} ${code}` })
    }
  )
  
  const { embedding } = await embeddingResponse.json()
  
  // 2. Find similar errors
  const { data: similarErrors } = await supabase.rpc(
    'find_similar_errors',
    { 
      query_embedding: embedding,
      match_count: 3 
    }
  )
  
  // 3. Generate fix using LLM
  const llmResponse = await fetch(`${Deno.env.get('OLLAMA_URL')}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'codellama',
      prompt: `Fix this TypeScript error:
Error: ${error}
Code: ${code}

Similar fixes that worked:
${similarErrors?.map(e => `- ${e.error_message}: ${e.suggested_fix}`).join('\n')}

Provide the fixed code:`,
      options: { temperature: 0.3 }
    })
  })
  
  const { response: fixedCode } = await llmResponse.json()
  
  // 4. Store the analysis
  const { data, error: dbError } = await supabase
    .from('code_analysis')
    .insert({
      file_path,
      error_code: error.match(/TS\d+/)?.[0],
      error_message: error,
      code_snippet: code,
      code_embedding: embedding,
      suggested_fix: fixedCode,
      confidence: 0.85,
      llm_model: 'codellama'
    })
    .select()
    .single()
  
  return new Response(
    JSON.stringify({ 
      success: true,
      fix: fixedCode,
      similar: similarErrors,
      stored: data
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
```

### 3. Database Function for Batch Processing
```sql
CREATE OR REPLACE FUNCTION process_typescript_errors_batch()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  error_record RECORD;
  embedding vector(384);
  similar_fixes JSONB;
  fix_suggestion TEXT;
BEGIN
  -- Process unresolved errors
  FOR error_record IN 
    SELECT * FROM typescript_errors 
    WHERE status = 'pending' 
    LIMIT 10
  LOOP
    -- Generate embedding via Edge Function
    SELECT result->>'embedding' INTO embedding
    FROM net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/generate-embedding',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := jsonb_build_object('input', error_record.error_message || ' ' || error_record.code_snippet)
    );
    
    -- Find similar errors
    SELECT jsonb_agg(row_to_json(t.*)) INTO similar_fixes
    FROM find_similar_errors(embedding::vector, 3) t;
    
    -- Get fix via Edge Function
    SELECT result->>'fix' INTO fix_suggestion
    FROM net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/fix-code-error',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := jsonb_build_object(
        'error', error_record.error_message,
        'code', error_record.code_snippet,
        'file_path', error_record.file_path
      )
    );
    
    -- Update error with fix
    UPDATE typescript_errors
    SET 
      status = 'ai_suggested',
      suggested_fix = fix_suggestion,
      processed_at = NOW()
    WHERE id = error_record.id;
  END LOOP;
END;
$$;

-- Schedule batch processing
SELECT cron.schedule(
  'process-ts-errors',
  '*/10 * * * *',
  'SELECT process_typescript_errors_batch();'
);
```

## database.build v2 Integration

Use Supabase's AI-powered database management:

```bash
# Connect your LLM to database.build
# Supports any OpenAI-compatible provider

# Example with xAI
export OPENAI_API_KEY="your-xai-api-key"
export OPENAI_BASE_URL="https://api.x.ai/v1"

# Use with database.build for AI-powered database operations
# No login required, no rate limits
```

## Best Practices

1. **Model Selection**
   - Use `gte-small` for embeddings (built-in, fast)
   - Use Ollama for code-specific tasks (codellama)
   - Use cloud providers for complex reasoning

2. **Performance Optimization**
   - Pre-generate embeddings during off-peak hours
   - Cache similar error lookups
   - Use connection pooling for Ollama

3. **Cost Management**
   - Use built-in models when possible
   - Implement request batching
   - Set up usage monitoring

4. **Security**
   - Store API keys in Supabase Vault
   - Use RLS policies for AI data
   - Implement rate limiting

## Future: Hosted LLM API

Supabase is developing a fully hosted LLM API that will:
- Automatically scale and manage GPUs
- Provide native PostgreSQL functions for LLM calls
- Support fine-tuned models
- Include usage-based pricing

To get early access:
1. Join the waitlist on Supabase dashboard
2. Follow updates on the Supabase blog
3. Test with current Edge Function AI features

## Conclusion

Supabase's BYOM approach lets you integrate any LLM while providing native tools for embeddings and vector search. The upcoming hosted LLM API will make this even more powerful by eliminating the need for external infrastructure.