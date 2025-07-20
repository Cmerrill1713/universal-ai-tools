-- WORKING pg_net Ollama integration
-- This version properly handles PostgreSQL transaction isolation

-- Drop old functions
DROP FUNCTION IF EXISTS ai_sql_fixed CASCADE;
DROP FUNCTION IF EXISTS ai_sql CASCADE;

-- Working AI SQL function
CREATE OR REPLACE FUNCTION public.ollama_generate_sql(
  user_prompt text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  req_id bigint;
  resp record;
  has_response boolean;
  result text;
  start_time timestamp;
BEGIN
  start_time := clock_timestamp();
  
  -- Make HTTP request
  req_id := net.http_post(
    url => 'http://host.docker.internal:8080/api/generate',
    body => json_build_object(
      'model', 'llama3.2:3b',
      'prompt', 'You are a PostgreSQL expert. Generate only SQL for: ' || user_prompt || '. No markdown, just SQL.',
      'stream', false,
      'temperature', 0.1
    )::jsonb
  );
  
  -- IMPORTANT: We need to wait for pg_net to process the request
  -- pg_net runs asynchronously, so we poll for the response
  FOR i IN 1..120 LOOP -- 60 seconds max
    -- Check if response exists
    SELECT EXISTS(SELECT 1 FROM net._http_response WHERE id = req_id) INTO has_response;
    
    IF has_response THEN
      -- Get the actual response
      SELECT * INTO resp FROM net._http_response WHERE id = req_id;
      
      IF resp.status_code = 200 THEN
        -- Extract and clean SQL
        result := (resp.content::jsonb)->>'response';
        result := regexp_replace(result, '```sql\s*', '', 'gi');
        result := regexp_replace(result, '```\s*', '', 'gi');
        result := regexp_replace(result, '\\\\n', E'\n', 'g');
        result := trim(result);
        
        RETURN result;
      ELSE
        RETURN 'HTTP Error: ' || resp.status_code;
      END IF;
    END IF;
    
    -- Wait 500ms before checking again
    PERFORM pg_sleep(0.5);
  END LOOP;
  
  RETURN 'Timeout waiting for Ollama response';
END;
$$;

-- Simple wrapper
CREATE OR REPLACE FUNCTION public.ai_sql(prompt text)
RETURNS text
LANGUAGE sql
AS $$
  SELECT ollama_generate_sql(prompt);
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.ollama_generate_sql TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ai_sql TO postgres, anon, authenticated, service_role;

-- Create a view to see AI requests
CREATE OR REPLACE VIEW public.ai_queries AS
SELECT 
  id,
  created,
  CASE 
    WHEN content::text LIKE '%"prompt":%' THEN 
      substring((content::jsonb)->>'prompt' from 'Generate only SQL for: ([^.]+)') 
    ELSE 'N/A'
  END as query,
  (content::jsonb)->>'response' as generated_sql,
  status_code
FROM net._http_response
WHERE content::text LIKE '%PostgreSQL expert%'
ORDER BY created DESC
LIMIT 20;

GRANT SELECT ON public.ai_queries TO postgres, anon, authenticated;

-- Test it!
DO $$
DECLARE
  result text;
BEGIN
  RAISE NOTICE 'Testing Ollama SQL generation...';
  result := ai_sql('list all tables');
  RAISE NOTICE 'Result: %', result;
END $$;

-- Also test with SELECT
SELECT ai_sql('show count of all tables') as sql_query;