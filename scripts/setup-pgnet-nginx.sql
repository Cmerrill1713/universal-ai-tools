-- pg_net with nginx proxy for Ollama
-- This uses the nginx proxy on port 8080 which handles CORS

-- Ensure pg_net is enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function using nginx proxy (more reliable for Docker)
CREATE OR REPLACE FUNCTION public.ai_generate_sql_pgnet(
  prompt text,
  model text DEFAULT 'llama3.2:3b'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id bigint;
  result_text text;
  response_body jsonb;
  full_prompt text;
BEGIN
  -- Build prompt
  full_prompt := 'You are a PostgreSQL expert. Generate only SQL code for: ' || prompt || '. No explanations or markdown, just SQL.';
  
  -- Make request via nginx proxy
  SELECT net.http_post(
    url := 'http://host.docker.internal:8080/api/generate',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := json_build_object(
      'model', model,
      'prompt', full_prompt,
      'stream', false,
      'temperature', 0.1
    )::text
  ) INTO request_id;
  
  -- Give it a moment to process
  PERFORM pg_sleep(1);
  
  -- Check for response
  SELECT body::text INTO result_text
  FROM net._http_response
  WHERE id = request_id;
  
  IF result_text IS NOT NULL THEN
    BEGIN
      response_body := result_text::jsonb;
      result_text := response_body->>'response';
      
      -- Clean SQL
      result_text := regexp_replace(result_text, '```sql\s*', '', 'gi');
      result_text := regexp_replace(result_text, '```\s*', '', 'gi');
      
      RETURN COALESCE(trim(result_text), 'No SQL generated');
    EXCEPTION WHEN OTHERS THEN
      RETURN 'Error parsing response: ' || SQLERRM;
    END;
  ELSE
    RETURN 'No response from Ollama. Ensure nginx proxy is running: npm run ollama:nginx:start';
  END IF;
END;
$$;

-- Simple test
CREATE OR REPLACE FUNCTION public.test_pgnet_ollama()
RETURNS text
LANGUAGE sql
AS $$
  SELECT ai_generate_sql_pgnet('show all tables');
$$;

GRANT EXECUTE ON FUNCTION public.ai_generate_sql_pgnet TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.test_pgnet_ollama TO postgres, anon, authenticated, service_role;

-- View to check recent pg_net requests
CREATE OR REPLACE VIEW public.recent_pgnet_requests AS
SELECT 
  id,
  created,
  url,
  method,
  headers,
  left(body::text, 100) as body_preview,
  status
FROM net._http_response
ORDER BY created DESC
LIMIT 10;

GRANT SELECT ON public.recent_pgnet_requests TO postgres, anon, authenticated;

-- Test it
SELECT test_pgnet_ollama();