-- Enable pg_net and configure for Ollama integration
-- Run this in Supabase SQL Editor

-- Ensure pg_net is enabled (it shows as installed in your screenshot)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant permissions
GRANT USAGE ON SCHEMA net TO postgres, anon, authenticated, service_role;

-- Function to call Ollama via pg_net
CREATE OR REPLACE FUNCTION public.ollama_generate(
  prompt text,
  model text DEFAULT 'llama3.2:3b'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id bigint;
  response_record record;
  result text;
BEGIN
  -- Make async request to Ollama
  SELECT net.http_post(
    url := 'http://host.docker.internal:11434/api/generate',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'model', model,
      'prompt', prompt,
      'stream', false,
      'temperature', 0.1
    )::text
  ) INTO request_id;
  
  -- Wait for response (with timeout)
  FOR i IN 1..30 LOOP
    SELECT * INTO response_record
    FROM net._http_response
    WHERE id = request_id;
    
    IF response_record.id IS NOT NULL THEN
      EXIT;
    END IF;
    
    PERFORM pg_sleep(0.1);
  END LOOP;
  
  -- Parse response
  IF response_record.body IS NOT NULL THEN
    result := response_record.body::jsonb->>'response';
    RETURN COALESCE(result, 'No response from Ollama');
  ELSE
    RETURN 'Timeout or error calling Ollama';
  END IF;
END;
$$;

-- SQL generation function using pg_net
CREATE OR REPLACE FUNCTION public.ai_generate_sql(
  prompt text,
  model text DEFAULT 'llama3.2:3b'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  full_prompt text;
  result text;
BEGIN
  full_prompt := 'You are a PostgreSQL expert. Generate only SQL code for: ' || prompt || '. No explanations, just SQL.';
  
  result := ollama_generate(full_prompt, model);
  
  -- Clean up response
  result := regexp_replace(result, '```sql\s*', '', 'gi');
  result := regexp_replace(result, '```\s*', '', 'gi');
  
  RETURN trim(result);
END;
$$;

-- Test function
CREATE OR REPLACE FUNCTION public.test_ollama_pgnet()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  test_result text;
BEGIN
  -- Try a simple test
  test_result := ollama_generate('Say "Hello from Ollama"', 'llama3.2:3b');
  
  RETURN jsonb_build_object(
    'success', test_result IS NOT NULL,
    'response', test_result,
    'timestamp', now()
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.ollama_generate TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ai_generate_sql TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.test_ollama_pgnet TO postgres, anon, authenticated, service_role;

-- Test the connection
SELECT test_ollama_pgnet();