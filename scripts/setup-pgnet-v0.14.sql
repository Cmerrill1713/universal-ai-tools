-- pg_net v0.14.0 setup for Ollama integration
-- This version uses slightly different syntax

-- Ensure pg_net is enabled (you said it's already on)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Check pg_net version
SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_net';

-- Function to call Ollama using pg_net v0.14
CREATE OR REPLACE FUNCTION public.ai_generate_sql_v14(
  prompt text,
  model text DEFAULT 'llama3.2:3b'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id bigint;
  result_record record;
  result_text text;
  full_prompt text;
  max_attempts int := 50;
  attempt int := 0;
BEGIN
  -- Build the full prompt
  full_prompt := 'You are a PostgreSQL expert. Generate only SQL code for: ' || prompt || '. Return only SQL, no explanations or markdown.';
  
  -- Make HTTP request to nginx proxy
  -- v0.14 syntax might be slightly different
  request_id := net.http_post(
    url := 'http://host.docker.internal:8080/api/generate',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := json_build_object(
      'model', model,
      'prompt', full_prompt,
      'stream', false,
      'temperature', 0.1
    )::text
  );
  
  -- Wait for response
  LOOP
    attempt := attempt + 1;
    
    -- Check for response
    SELECT * INTO result_record
    FROM net.http_response
    WHERE id = request_id
    LIMIT 1;
    
    -- If we got a response, exit loop
    IF result_record.id IS NOT NULL THEN
      EXIT;
    END IF;
    
    -- Timeout check
    IF attempt > max_attempts THEN
      RETURN 'Timeout waiting for Ollama response. Check if nginx proxy is running.';
    END IF;
    
    -- Wait a bit before checking again
    PERFORM pg_sleep(0.2);
  END LOOP;
  
  -- Process response
  IF result_record.status_code = 200 AND result_record.content IS NOT NULL THEN
    BEGIN
      -- Parse JSON response
      result_text := (result_record.content::jsonb)->>'response';
      
      -- Clean up SQL
      result_text := regexp_replace(result_text, '```sql\s*', '', 'gi');
      result_text := regexp_replace(result_text, '```\s*', '', 'gi');
      
      RETURN COALESCE(trim(result_text), 'No SQL generated');
    EXCEPTION WHEN OTHERS THEN
      RETURN 'Error parsing response: ' || SQLERRM || ' | Raw: ' || left(result_record.content::text, 200);
    END;
  ELSE
    RETURN 'HTTP Error: ' || COALESCE(result_record.status_code::text, 'No response') || 
           ' | Content: ' || COALESCE(left(result_record.content::text, 200), 'None');
  END IF;
END;
$$;

-- Alternative using different host for Docker
CREATE OR REPLACE FUNCTION public.ai_generate_sql_docker(
  prompt text,
  model text DEFAULT 'llama3.2:3b'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id bigint;
  result_record record;
  result_text text;
  full_prompt text;
BEGIN
  full_prompt := 'PostgreSQL expert mode. Generate SQL for: ' || prompt || '. Only SQL code, no markdown.';
  
  -- Try with Docker internal networking
  request_id := net.http_post(
    url := 'http://172.17.0.1:8080/api/generate',  -- Docker host IP
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := json_build_object(
      'model', model,
      'prompt', full_prompt,
      'stream', false
    )::text
  );
  
  -- Wait up to 10 seconds
  FOR i IN 1..50 LOOP
    SELECT * INTO result_record
    FROM net.http_response
    WHERE id = request_id;
    
    EXIT WHEN result_record.id IS NOT NULL;
    PERFORM pg_sleep(0.2);
  END LOOP;
  
  IF result_record.content IS NOT NULL THEN
    BEGIN
      result_text := (result_record.content::jsonb)->>'response';
      result_text := regexp_replace(result_text, '```[sql]*\s*', '', 'gi');
      RETURN trim(result_text);
    EXCEPTION WHEN OTHERS THEN
      RETURN 'Parse error: ' || SQLERRM;
    END;
  ELSE
    RETURN 'No response from Ollama';
  END IF;
END;
$$;

-- Test function that tries multiple endpoints
CREATE OR REPLACE FUNCTION public.test_ollama_endpoints()
RETURNS TABLE(endpoint text, status text)
LANGUAGE plpgsql
AS $$
DECLARE
  request_id bigint;
  response record;
  endpoints text[] := ARRAY[
    'http://host.docker.internal:8080/api/tags',
    'http://172.17.0.1:8080/api/tags',
    'http://ollama-proxy:8080/api/tags',
    'http://localhost:8080/api/tags'
  ];
  ep text;
BEGIN
  FOREACH ep IN ARRAY endpoints LOOP
    BEGIN
      request_id := net.http_get(url := ep);
      
      -- Wait briefly
      PERFORM pg_sleep(1);
      
      SELECT * INTO response
      FROM net.http_response
      WHERE id = request_id;
      
      IF response.status_code = 200 THEN
        RETURN QUERY SELECT ep, 'OK - Connected'::text;
      ELSE
        RETURN QUERY SELECT ep, ('Failed: ' || COALESCE(response.status_code::text, 'No response'))::text;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT ep, ('Error: ' || SQLERRM)::text;
    END;
  END LOOP;
END;
$$;

-- View to see recent HTTP requests
CREATE OR REPLACE VIEW public.pgnet_recent_requests AS
SELECT 
  id,
  created,
  method,
  url,
  status_code,
  left(content::text, 200) as response_preview,
  error_msg
FROM net.http_response
ORDER BY created DESC
LIMIT 20;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.ai_generate_sql_v14 TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ai_generate_sql_docker TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.test_ollama_endpoints TO postgres, anon, authenticated, service_role;
GRANT SELECT ON public.pgnet_recent_requests TO postgres, anon, authenticated;

-- Test which endpoint works
SELECT * FROM test_ollama_endpoints();

-- Then test SQL generation
-- SELECT ai_generate_sql_v14('show all tables');