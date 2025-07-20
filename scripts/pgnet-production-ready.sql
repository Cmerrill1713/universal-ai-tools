-- Production-ready pg_net integration for Ollama
-- Works with pg_net 0.14.0 and handles timing properly

-- Drop existing functions
DROP FUNCTION IF EXISTS public.ai_sql CASCADE;
DROP FUNCTION IF EXISTS public.ai_generate_sql CASCADE;

-- Main AI SQL generation function
CREATE OR REPLACE FUNCTION public.ai_generate_sql(
  prompt text,
  model text DEFAULT 'llama3.2:3b',
  timeout_seconds int DEFAULT 30
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id bigint;
  response_record record;
  result_text text;
  formatted_prompt text;
  check_interval numeric := 0.5; -- Check every 500ms
  max_checks int;
BEGIN
  -- Calculate max checks based on timeout
  max_checks := timeout_seconds * 2; -- Since we check every 0.5 seconds
  
  -- Format prompt for SQL generation
  formatted_prompt := 'You are a PostgreSQL expert. Generate only SQL code for: ' || prompt || 
                     '. Return only the SQL query, no explanations, no markdown formatting.';
  
  -- Make HTTP request to Ollama via nginx proxy
  SELECT net.http_post(
    url => 'http://host.docker.internal:8080/api/generate',
    body => json_build_object(
      'model', model,
      'prompt', formatted_prompt,
      'stream', false,
      'temperature', 0.1,
      'top_p', 0.9
    )::jsonb,
    headers => '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds => timeout_seconds * 1000
  ) INTO request_id;
  
  -- Wait for response with periodic checks
  FOR i IN 1..max_checks LOOP
    -- Check for response
    SELECT * INTO response_record
    FROM net._http_response
    WHERE id = request_id;
    
    -- If we have a response, process it
    IF response_record.id IS NOT NULL THEN
      IF response_record.status_code = 200 THEN
        BEGIN
          -- Extract SQL from JSON response
          result_text := (response_record.content::jsonb)->>'response';
          
          -- Clean up common formatting
          result_text := regexp_replace(result_text, '```sql\s*', '', 'gi');
          result_text := regexp_replace(result_text, '```\s*', '', 'gi');
          result_text := regexp_replace(result_text, '^\s*sql\s*', '', 'i');
          result_text := trim(result_text);
          
          RETURN COALESCE(result_text, 'No SQL generated');
        EXCEPTION WHEN OTHERS THEN
          RETURN 'Error parsing Ollama response: ' || SQLERRM;
        END;
      ELSE
        RETURN 'HTTP Error ' || response_record.status_code || ': ' || 
               COALESCE(response_record.error_msg, left(response_record.content::text, 200));
      END IF;
    END IF;
    
    -- Wait before next check
    PERFORM pg_sleep(check_interval);
  END LOOP;
  
  -- Timeout reached
  RETURN 'Timeout: No response from Ollama after ' || timeout_seconds || ' seconds. ' ||
         'Ensure nginx proxy is running (npm run ollama:nginx:start) and Ollama is accessible.';
END;
$$;

-- Simpler wrapper function for basic use
CREATE OR REPLACE FUNCTION public.ai_sql(
  prompt text
)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT ai_generate_sql(prompt, 'llama3.2:3b', 30);
$$;

-- Function to test Ollama connectivity
CREATE OR REPLACE FUNCTION public.test_ollama_connection()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  request_id bigint;
  response record;
BEGIN
  -- Try to get model list
  SELECT net.http_get(
    url => 'http://host.docker.internal:8080/api/tags',
    timeout_milliseconds => 5000
  ) INTO request_id;
  
  -- Wait for response
  FOR i IN 1..10 LOOP
    SELECT * INTO response FROM net._http_response WHERE id = request_id;
    EXIT WHEN response.id IS NOT NULL;
    PERFORM pg_sleep(0.5);
  END LOOP;
  
  IF response.status_code = 200 THEN
    RETURN jsonb_build_object(
      'connected', true,
      'models', (response.content::jsonb)->'models',
      'message', 'Ollama is accessible via pg_net'
    );
  ELSE
    RETURN jsonb_build_object(
      'connected', false,
      'error', 'Status ' || COALESCE(response.status_code::text, 'No response'),
      'message', 'Check if nginx proxy is running on port 8080'
    );
  END IF;
END;
$$;

-- View for monitoring AI requests
CREATE OR REPLACE VIEW public.ai_request_log AS
SELECT 
  id,
  created,
  CASE 
    WHEN content::text LIKE '%"prompt":%' THEN 'SQL Generation'
    WHEN content::text LIKE '%/api/tags%' THEN 'Connection Test'
    ELSE 'Other'
  END as request_type,
  status_code,
  CASE 
    WHEN status_code = 200 THEN 'Success'
    WHEN status_code IS NULL THEN 'Pending/Timeout'
    ELSE 'Error ' || status_code
  END as status,
  CASE 
    WHEN content IS NOT NULL AND status_code = 200 AND content::text LIKE '%"response":%' THEN
      substring((content::jsonb)->>'response' from 1 for 100) || 
      CASE WHEN length((content::jsonb)->>'response') > 100 THEN '...' ELSE '' END
    ELSE
      left(coalesce(error_msg, content::text, 'No content'), 100)
  END as result_preview,
  EXTRACT(EPOCH FROM (updated - created)) as response_time_seconds
FROM net._http_response
WHERE created > now() - interval '1 hour'
  AND (content::text LIKE '%ollama%' OR content::text LIKE '%api/generate%' OR content::text LIKE '%api/tags%')
ORDER BY created DESC
LIMIT 50;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.ai_generate_sql TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ai_sql TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.test_ollama_connection TO postgres, anon, authenticated, service_role;
GRANT SELECT ON public.ai_request_log TO postgres, anon, authenticated;

-- Run connection test
SELECT test_ollama_connection() as ollama_status;

-- Example usage
SELECT ai_sql('show all tables in the public schema') as generated_sql;