-- Fixed pg_net setup for v0.14.0
-- Uses correct table names

-- Function to call Ollama
CREATE OR REPLACE FUNCTION public.ai_generate_sql(
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
  -- Build prompt
  full_prompt := 'You are a PostgreSQL expert. Generate only SQL code for: ' || prompt || '. Return only SQL, no explanations.';
  
  -- Make request to nginx proxy
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
  PERFORM pg_sleep(3); -- Give it time
  
  -- Get response from correct table
  SELECT * INTO result_record
  FROM net._http_response
  WHERE id = request_id
  LIMIT 1;
  
  -- Process response
  IF result_record.id IS NOT NULL THEN
    IF result_record.status_code = 200 THEN
      BEGIN
        result_text := (result_record.content::jsonb)->>'response';
        -- Clean SQL
        result_text := regexp_replace(result_text, '```sql\s*', '', 'gi');
        result_text := regexp_replace(result_text, '```\s*', '', 'gi');
        RETURN trim(result_text);
      EXCEPTION WHEN OTHERS THEN
        RETURN 'Error parsing: ' || SQLERRM;
      END;
    ELSE
      RETURN 'HTTP Error: ' || result_record.status_code;
    END IF;
  ELSE
    RETURN 'No response from Ollama. Check nginx proxy is running.';
  END IF;
END;
$$;

-- Simple test function
CREATE OR REPLACE FUNCTION public.test_ollama()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  request_id bigint;
  response record;
BEGIN
  -- Test nginx proxy
  request_id := net.http_get('http://host.docker.internal:8080/api/tags');
  
  PERFORM pg_sleep(2);
  
  SELECT * INTO response
  FROM net._http_response
  WHERE id = request_id;
  
  IF response.status_code = 200 THEN
    RETURN 'Success! Ollama is reachable via pg_net';
  ELSE
    RETURN 'Failed: Status ' || COALESCE(response.status_code::text, 'No response');
  END IF;
END;
$$;

-- View recent requests
CREATE OR REPLACE VIEW public.recent_pg_net AS
SELECT 
  id,
  created,
  method,
  url,
  status_code,
  left(content::text, 100) as response_preview
FROM net._http_response
ORDER BY created DESC
LIMIT 10;

GRANT EXECUTE ON FUNCTION public.ai_generate_sql TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.test_ollama TO postgres, anon, authenticated, service_role;
GRANT SELECT ON public.recent_pg_net TO postgres, anon, authenticated;

-- Test connection
SELECT test_ollama();