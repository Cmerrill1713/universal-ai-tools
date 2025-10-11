# Running LLMs Inside Supabase
## Overview

While Supabase doesn't natively host LLMs, there are several ways to embed LLM functionality directly within your Supabase infrastructure.
## Option 1: PostgreSQL + pgml (PostgresML)
PostgresML allows you to run ML models directly in PostgreSQL.
### Installation

```sql

-- Install PostgresML extension

CREATE EXTENSION IF NOT EXISTS pgml;
-- Install pgvector for embeddings

CREATE EXTENSION IF NOT EXISTS vector;

```
### Load a Model

```sql

-- Load a small language model

SELECT pgml.load_model('name', 'gpt2');
-- Or load a code-specific model

SELECT pgml.load_model('codegen', 'Salesforce/codegen-350M-mono');

```
### Create Function for Code Fixes

```sql

CREATE OR REPLACE FUNCTION fix_typescript_error_internal(

  p_error_code TEXT,

  p_error_message TEXT,

  p_code_snippet TEXT

)

RETURNS TABLE (

  fixed_code TEXT,

  explanation TEXT,

  confidence FLOAT

)

LANGUAGE plpgsql

AS $$

DECLARE

  v_prompt TEXT;

  v_result TEXT;

BEGIN

  -- Construct prompt

  v_prompt := format(

    'Fix TypeScript %s: %s\nCode: %s\nFixed code:',

    p_error_code,

    p_error_message,

    p_code_snippet

  );
  -- Generate using embedded model

  SELECT pgml.generate(

    'codegen',

    v_prompt,

    '{

      "max_length": 200,

      "temperature": 0.3,

      "top_p": 0.95

    }'::jsonb

  ) INTO v_result;
  -- Parse and return result

  RETURN QUERY

  SELECT 

    v_result AS fixed_code,

    'AI-generated fix' AS explanation,

    0.75 AS confidence;

END;

$$;

```
## Option 2: Supabase Edge Functions + WASM LLMs
Run smaller LLMs in WebAssembly within Edge Functions.
### Edge Function with WASM Model

```typescript

// supabase/functions/embedded-llm/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

import init, { Model } from 'https://deno.land/x/rwkv_wasm/mod.ts'
// Initialize WASM model

await init();
// Load a small model (e.g., RWKV, GPT-2 small)

const model = await Model.load({

  url: 'https://huggingface.co/BlinkDL/rwkv-4-pile-169m/resolve/main/RWKV-4-Pile-169M-20220807-8023.pth',

  tokenizerUrl: 'https://github.com/BlinkDL/ChatRWKV/raw/main/tokenizer/rwkv_vocab_v20230424.txt'

});
serve(async (req) => {

  const { code, error } = await req.json();

  

  // Generate fix using embedded model

  const prompt = `Fix TypeScript error: ${error}\nCode: ${code}\nFixed:`;

  const response = await model.generate(prompt, {

    maxTokens: 100,

    temperature: 0.3

  });
  return new Response(

    JSON.stringify({ 

      fixedCode: response.text,

      modelUsed: 'embedded-rwkv-169m'

    }),

    { headers: { 'Content-Type': 'application/json' } }

  );

});

```
## Option 3: PostgreSQL + Python (pl/python3u)
Use Python inside PostgreSQL to run small models.
### Enable PL/Python

```sql

CREATE EXTENSION IF NOT EXISTS plpython3u;

```
### Create Python Function

```sql

CREATE OR REPLACE FUNCTION llm_fix_code(

  error_info JSONB

)

RETURNS JSONB

LANGUAGE plpython3u

AS $$

import json

import transformers

# Cache model in GD (global dictionary)

if 'model' not in GD:

    from transformers import pipeline

    GD['model'] = pipeline(

        'text-generation',

        model='microsoft/CodeGPT-small-py',

        device=-1  # CPU

    )
prompt = f"Fix: {error_info['error']}\nCode: {error_info['code']}\nFixed:"

result = GD['model'](prompt, max_length=150, temperature=0.3)
return json.dumps({

    'fixed_code': result[0]['generated_text'],

    'confidence': 0.7

})

$$;

```
## Option 4: Supabase + Ollama Container
Run Ollama as a sidecar container with Supabase.
### Docker Compose Setup

```yaml

version: '3.8'

services:

  supabase-db:

    image: supabase/postgres:15.1.0.117

    environment:

      POSTGRES_PASSWORD: your-super-secret-password

    volumes:

      - ./postgres-data:/var/lib/postgresql/data

    

  ollama:

    image: ollama/ollama:latest

    volumes:

      - ./ollama-data:/root/.ollama

    ports:

      - "11434:11434"

    

  supabase-ollama-bridge:

    build:

      context: .

      dockerfile: Dockerfile.bridge

    environment:

      OLLAMA_URL: http://ollama:11434

      POSTGRES_URL: postgresql://postgres:password@supabase-db:5432/postgres

```
### Bridge Service

```typescript

// supabase-ollama-bridge/index.ts

import { Client } from 'pg';

import { Ollama } from 'ollama';
const pg = new Client(process.env.POSTGRES_URL);

const ollama = new Ollama({ host: process.env.OLLAMA_URL });
// Listen for PostgreSQL notifications

await pg.connect();

await pg.query('LISTEN llm_request');
pg.on('notification', async (msg) => {

  const request = JSON.parse(msg.payload);

  

  // Generate with Ollama

  const response = await ollama.generate({

    model: 'codellama:7b',

    prompt: request.prompt,

    options: { temperature: 0.3 }

  });

  

  // Store result back in database

  await pg.query(

    'UPDATE llm_requests SET response = $1 WHERE id = $2',

    [response.response, request.id]

  );

});

```
### PostgreSQL Function

```sql

CREATE OR REPLACE FUNCTION request_llm_fix(

  p_code TEXT,

  p_error TEXT

)

RETURNS TEXT

LANGUAGE plpgsql

AS $$

DECLARE

  v_request_id UUID;

  v_response TEXT;

BEGIN

  -- Insert request

  INSERT INTO llm_requests (prompt, status)

  VALUES (

    format('Fix TypeScript: %s\nCode: %s', p_error, p_code),

    'pending'

  )

  RETURNING id INTO v_request_id;

  

  -- Notify bridge service

  PERFORM pg_notify('llm_request', json_build_object(

    'id', v_request_id,

    'prompt', format('Fix TypeScript: %s\nCode: %s', p_error, p_code)

  )::text);

  

  -- Wait for response (with timeout)

  FOR i IN 1..30 LOOP

    SELECT response INTO v_response

    FROM llm_requests

    WHERE id = v_request_id AND status = 'completed';

    

    IF v_response IS NOT NULL THEN

      RETURN v_response;

    END IF;

    

    PERFORM pg_sleep(1);

  END LOOP;

  

  RETURN 'Timeout waiting for LLM response';

END;

$$;

```
## Option 5: Supabase Custom Postgres Extension
Create a custom PostgreSQL extension that embeds an LLM.
### Extension Structure

```c

// llm_extension.c
#include "postgres.h"
#include "onnxruntime_c_api.h"
PG_MODULE_MAGIC;
// Load ONNX model

static OrtSession* session = NULL;
void _PG_init(void) {

    // Initialize ONNX Runtime

    // Load small model like DistilGPT-2

    load_model("/usr/share/postgresql/models/distilgpt2.onnx");

}
PG_FUNCTION_INFO_V1(generate_fix);

Datum generate_fix(PG_FUNCTION_ARGS) {

    text *error = PG_GETARG_TEXT_PP(0);

    text *code = PG_GETARG_TEXT_PP(1);

    

    // Run inference

    char *result = run_model_inference(

        text_to_cstring(error),

        text_to_cstring(code)

    );

    

    PG_RETURN_TEXT_P(cstring_to_text(result));

}

```
## Comparison of Approaches
| Approach | Model Size | Performance | Complexity | Use Case |

|----------|------------|-------------|------------|----------|

| PostgresML | Small-Medium | Good | Low | Simple inference |

| WASM in Edge Functions | Tiny | Moderate | Medium | Serverless |

| PL/Python | Small | Good | Medium | Python ecosystem |

| Ollama Sidecar | Any size | Excellent | High | Full control |

| Custom Extension | Small | Excellent | Very High | Production |
## Practical Implementation
### 1. Start with PostgresML

```sql

-- Install and test

CREATE EXTENSION pgml;
-- Load a small model

SELECT pgml.load('codegen-350M');
-- Create helper function

CREATE OR REPLACE FUNCTION ai_suggest_fix(

  error_msg TEXT,

  code_context TEXT

)

RETURNS TEXT

LANGUAGE sql

AS $$

  SELECT pgml.generate(

    'codegen-350M',

    'Fix TypeScript error: ' || error_msg || E'\nCode: ' || code_context || E'\nSuggestion:',

    '{"max_new_tokens": 100}'::jsonb

  );

$$;
-- Use in queries

SELECT 

  e.file_path,

  e.error_message,

  ai_suggest_fix(e.error_message, e.code_snippet) as suggested_fix

FROM typescript_errors e

WHERE e.status = 'unfixed'

LIMIT 10;

```
### 2. Create Hybrid System

```sql

-- Store model outputs

CREATE TABLE ai_suggestions (

  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  error_id UUID REFERENCES typescript_errors(id),

  model_name TEXT,

  suggestion TEXT,

  confidence FLOAT,

  generated_at TIMESTAMPTZ DEFAULT NOW()

);
-- Automated fix pipeline

CREATE OR REPLACE FUNCTION process_typescript_errors()

RETURNS void

LANGUAGE plpgsql

AS $$

DECLARE

  error_record RECORD;

  fix TEXT;

BEGIN

  FOR error_record IN 

    SELECT * FROM typescript_errors 

    WHERE status = 'new' 

    LIMIT 10

  LOOP

    -- Try embedded model first

    fix := ai_suggest_fix(

      error_record.error_message,

      error_record.code_snippet

    );

    

    -- Store suggestion

    INSERT INTO ai_suggestions (

      error_id, 

      model_name, 

      suggestion, 

      confidence

    ) VALUES (

      error_record.id,

      'codegen-350M',

      fix,

      0.7

    );

    

    -- Update error status

    UPDATE typescript_errors

    SET status = 'ai_suggested'

    WHERE id = error_record.id;

  END LOOP;

END;

$$;
-- Schedule processing

SELECT cron.schedule(

  'process-errors',

  '*/5 * * * *',  -- Every 5 minutes

  'SELECT process_typescript_errors();'

);

```
## Benefits of Embedded LLMs
1. **Zero Latency**: No network calls

2. **Data Privacy**: Everything stays in your database

3. **Cost Effective**: No API charges

4. **Always Available**: No external dependencies

5. **Integrated**: Direct SQL access to AI
## Limitations
1. **Model Size**: Limited to smaller models

2. **GPU Access**: Usually CPU-only

3. **Updates**: Harder to update models

4. **Resources**: Uses database resources
## Conclusion
Running LLMs inside Supabase is possible and can be very effective for specific use cases. Start with PostgresML for the easiest integration, then explore other options based on your needs.