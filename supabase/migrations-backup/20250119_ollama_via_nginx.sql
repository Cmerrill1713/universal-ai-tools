-- Ollama AI functions using nginx proxy
-- Requires pg_net extension

-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function to generate SQL using Ollama via nginx
CREATE OR REPLACE FUNCTION public.ai_generate_sql(
  prompt text,
  model text DEFAULT 'llama3.2:3b',
  temperature float DEFAULT 0.1
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id bigint;
  result text;
  response jsonb;
  ollama_response text;
BEGIN
  -- Make HTTP request to Ollama via nginx proxy
  SELECT net.http_post(
    url := 'http://ollama-proxy:8080/api/generate',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'model', model,
      'prompt', 'You are a PostgreSQL expert. Generate only SQL code, no explanations or markdown. Request: ' || prompt,
      'temperature', temperature,
      'stream', false
    )::text
  ) INTO request_id;
  
  -- Wait for response (with timeout)
  PERFORM pg_sleep(0.5);
  
  -- Get response
  SELECT response_body::text INTO result
  FROM net.http_response
  WHERE request_id = ai_generate_sql.request_id
  LIMIT 1;
  
  -- Parse response
  IF result IS NOT NULL THEN
    BEGIN
      response := result::jsonb;
      ollama_response := response->>'response';
      -- Clean up response (remove markdown if present)
      ollama_response := regexp_replace(ollama_response, '```sql\s*', '', 'gi');
      ollama_response := regexp_replace(ollama_response, '```\s*', '', 'gi');
      RETURN trim(ollama_response);
    EXCEPTION WHEN OTHERS THEN
      RETURN 'Error parsing response: ' || SQLERRM;
    END;
  ELSE
    RETURN 'Error: No response from Ollama. Make sure nginx proxy and Ollama are running.';
  END IF;
END;
$$;

-- Function to explain SQL using Ollama via nginx
CREATE OR REPLACE FUNCTION public.ai_explain_sql(
  sql_query text,
  model text DEFAULT 'llama3.2:3b'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id bigint;
  result text;
  response jsonb;
BEGIN
  SELECT net.http_post(
    url := 'http://ollama-proxy:8080/api/generate',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'model', model,
      'prompt', 'Explain this PostgreSQL query in simple terms: ' || sql_query,
      'temperature', 0.3,
      'stream', false
    )::text
  ) INTO request_id;
  
  PERFORM pg_sleep(0.5);
  
  SELECT response_body::text INTO result
  FROM net.http_response
  WHERE request_id = ai_explain_sql.request_id
  LIMIT 1;
  
  IF result IS NOT NULL THEN
    BEGIN
      response := result::jsonb;
      RETURN response->>'response';
    EXCEPTION WHEN OTHERS THEN
      RETURN 'Error parsing response: ' || SQLERRM;
    END;
  ELSE
    RETURN 'Error: No response from Ollama';
  END IF;
END;
$$;

-- Function to optimize SQL using Ollama via nginx
CREATE OR REPLACE FUNCTION public.ai_optimize_sql(
  sql_query text,
  model text DEFAULT 'llama3.2:3b'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id bigint;
  result text;
  response jsonb;
  ollama_response text;
BEGIN
  SELECT net.http_post(
    url := 'http://ollama-proxy:8080/api/generate',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'model', model,
      'prompt', 'Optimize this PostgreSQL query for better performance. Return only the optimized SQL code: ' || sql_query,
      'temperature', 0.1,
      'stream', false
    )::text
  ) INTO request_id;
  
  PERFORM pg_sleep(0.5);
  
  SELECT response_body::text INTO result
  FROM net.http_response
  WHERE request_id = ai_optimize_sql.request_id
  LIMIT 1;
  
  IF result IS NOT NULL THEN
    BEGIN
      response := result::jsonb;
      ollama_response := response->>'response';
      -- Clean up response
      ollama_response := regexp_replace(ollama_response, '```sql\s*', '', 'gi');
      ollama_response := regexp_replace(ollama_response, '```\s*', '', 'gi');
      RETURN trim(ollama_response);
    EXCEPTION WHEN OTHERS THEN
      RETURN 'Error parsing response: ' || SQLERRM;
    END;
  ELSE
    RETURN 'Error: No response from Ollama';
  END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.ai_generate_sql TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ai_explain_sql TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ai_optimize_sql TO postgres, anon, authenticated, service_role;

-- Test function to verify nginx proxy is working
CREATE OR REPLACE FUNCTION public.test_ollama_connection()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  request_id bigint;
  result text;
BEGIN
  -- Try to get Ollama version via nginx
  SELECT net.http_get(
    url := 'http://ollama-proxy:8080/api/version'
  ) INTO request_id;
  
  PERFORM pg_sleep(0.5);
  
  SELECT response_body::text INTO result
  FROM net.http_response
  WHERE request_id = test_ollama_connection.request_id
  LIMIT 1;
  
  IF result IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Ollama connected via nginx proxy',
      'version', result::jsonb
    );
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Could not connect to Ollama via nginx proxy',
      'hint', 'Make sure nginx proxy is running: docker-compose -f docker-compose.ollama.yml up -d'
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.test_ollama_connection TO postgres, anon, authenticated, service_role;