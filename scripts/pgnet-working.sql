-- Working pg_net setup for Ollama
-- This is tested and works with pg_net 0.14.0

-- Drop old functions to avoid conflicts
DROP FUNCTION IF EXISTS public.ai_generate_sql(text, text);
DROP FUNCTION IF EXISTS public.ai_generate_sql(text);

-- Main function to generate SQL using Ollama
CREATE OR REPLACE FUNCTION public.ai_generate_sql(
  prompt text
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
  wait_counter int := 0;
BEGIN
  -- Build prompt
  full_prompt := 'You are a PostgreSQL expert. Generate only SQL code for: ' || prompt || '. Return only SQL, no explanations or markdown.';
  
  -- Make request
  request_id := net.http_post(
    url := 'http://host.docker.internal:8080/api/generate',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := json_build_object(
      'model', 'llama3.2:3b',
      'prompt', full_prompt,
      'stream', false,
      'temperature', 0.1
    )::text
  );
  
  -- Wait for response (up to 10 seconds)
  WHILE wait_counter < 50 LOOP
    SELECT * INTO result_record
    FROM net._http_response
    WHERE id = request_id;
    
    IF result_record.id IS NOT NULL THEN
      EXIT;
    END IF;
    
    PERFORM pg_sleep(0.2);
    wait_counter := wait_counter + 1;
  END LOOP;
  
  -- Process response
  IF result_record.id IS NOT NULL AND result_record.status_code = 200 THEN
    BEGIN
      -- Extract SQL from response
      result_text := (result_record.content::jsonb)->>'response';
      
      -- Clean up
      result_text := regexp_replace(result_text, '```sql\s*', '', 'gi');
      result_text := regexp_replace(result_text, '```\s*', '', 'gi');
      result_text := trim(result_text);
      
      RETURN COALESCE(result_text, 'No SQL generated');
    EXCEPTION WHEN OTHERS THEN
      RETURN 'Error parsing response: ' || SQLERRM || ' (Response: ' || left(result_record.content, 100) || ')';
    END;
  ELSIF result_record.id IS NOT NULL THEN
    RETURN 'HTTP Error ' || result_record.status_code || ': ' || COALESCE(result_record.error_msg, 'Unknown error');
  ELSE
    RETURN 'Timeout: No response from Ollama after 10 seconds. Make sure nginx proxy is running (npm run ollama:nginx:start)';
  END IF;
END;
$$;

-- Test function
CREATE OR REPLACE FUNCTION public.test_ai_sql()
RETURNS text
LANGUAGE sql
AS $$
  SELECT ai_generate_sql('show all tables in the database');
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.ai_generate_sql(text) TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.test_ai_sql() TO postgres, anon, authenticated, service_role;

-- Create a helper view for debugging
CREATE OR REPLACE VIEW public.pgnet_logs AS
SELECT 
  id,
  created,
  CASE 
    WHEN content LIKE '%/api/generate%' THEN 'Ollama Generate'
    WHEN content LIKE '%/api/tags%' THEN 'Ollama Tags'
    ELSE 'Other'
  END as request_type,
  status_code,
  CASE 
    WHEN status_code = 200 THEN 'Success'
    WHEN status_code IS NULL THEN 'Pending/Timeout'
    ELSE 'Error'
  END as status,
  left(content, 200) as response_preview,
  error_msg
FROM net._http_response
ORDER BY created DESC
LIMIT 20;

GRANT SELECT ON public.pgnet_logs TO postgres, anon, authenticated;

-- Run test
SELECT test_ai_sql();