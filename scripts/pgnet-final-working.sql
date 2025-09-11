-- Final working pg_net setup for Ollama integration
-- This version properly handles the response and works with pg_net 0.14.0

-- Drop any existing functions
DROP FUNCTION IF EXISTS public.ollama_sql(text) CASCADE;
DROP FUNCTION IF EXISTS public.ai_generate_sql(text) CASCADE;

-- Main function to generate SQL using Ollama via pg_net
CREATE OR REPLACE FUNCTION public.ai_generate_sql(
  user_prompt text
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
  max_wait int := 100; -- 20 seconds (100 * 0.2)
BEGIN
  -- Build prompt
  full_prompt := 'You are a PostgreSQL expert. Generate only SQL code for: ' || user_prompt || '. Return only SQL, no explanations or markdown.';
  
  -- Make request to nginx proxy
  request_id := net.http_post(
    url => 'http://host.docker.internal:8080/api/generate',
    body => json_build_object(
      'model', 'llama3.2:3b',
      'prompt', full_prompt,
      'stream', false,
      'temperature', 0.1
    )::jsonb,
    headers => '{"Content-Type": "application/json"}'::jsonb
  );
  
  -- Wait for response (up to 20 seconds)
  WHILE wait_counter < max_wait LOOP
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
      
      -- Clean up SQL formatting
      result_text := regexp_replace(result_text, '```sql\s*', '', 'gi');
      result_text := regexp_replace(result_text, '```\s*', '', 'gi');
      result_text := trim(result_text);
      
      RETURN COALESCE(result_text, 'No SQL generated');
    EXCEPTION WHEN OTHERS THEN
      RETURN 'Error parsing response: ' || SQLERRM;
    END;
  ELSIF result_record.id IS NOT NULL THEN
    RETURN 'HTTP Error ' || result_record.status_code || ': ' || COALESCE(result_record.error_msg, 'Unknown error');
  ELSE
    RETURN 'Timeout: No response from Ollama after 20 seconds. Make sure nginx proxy is running.';
  END IF;
END;
$$;

-- Create a simpler wrapper for Supabase Studio
CREATE OR REPLACE FUNCTION public.sql_ai_assistant(
  query text
)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT ai_generate_sql(query);
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.ai_generate_sql(text) TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sql_ai_assistant(text) TO postgres, anon, authenticated, service_role;

-- Create a view to monitor pg_net requests
CREATE OR REPLACE VIEW public.ollama_requests AS
SELECT 
  id,
  created,
  CASE 
    WHEN content::text LIKE '%/api/generate%' THEN 'SQL Generation'
    WHEN content::text LIKE '%/api/tags%' THEN 'Model List'
    ELSE 'Other'
  END as request_type,
  status_code,
  CASE 
    WHEN status_code = 200 THEN 'Success'
    WHEN status_code IS NULL THEN 'Pending'
    ELSE 'Error'
  END as status,
  CASE 
    WHEN content IS NOT NULL AND status_code = 200 THEN
      substring((content::jsonb)->>'response' from 1 for 100) || '...'
    ELSE
      left(content::text, 100)
  END as preview
FROM net._http_response
WHERE created > now() - interval '1 hour'
ORDER BY created DESC;

GRANT SELECT ON public.ollama_requests TO postgres, anon, authenticated;

-- Test the function
DO $$
DECLARE
  result text;
BEGIN
  result := ai_generate_sql('show all tables');
  RAISE NOTICE 'Generated SQL: %', result;
END $$;