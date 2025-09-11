-- Clean pg_net test for Ollama
-- First drop all conflicting functions
DROP FUNCTION IF EXISTS public.ai_generate_sql(text) CASCADE;
DROP FUNCTION IF EXISTS public.ai_generate_sql(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.ai_generate_sql(text, text, double precision) CASCADE;

-- Create a simple AI SQL generator
CREATE OR REPLACE FUNCTION public.ollama_sql(
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
BEGIN
  -- Build prompt
  full_prompt := 'You are a PostgreSQL expert. Generate only SQL code for: ' || user_prompt || '. Return only SQL, no explanations or markdown.';
  
  -- Make request to nginx proxy (v0.14 signature)
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
      RETURN 'Error parsing response: ' || SQLERRM;
    END;
  ELSIF result_record.id IS NOT NULL THEN
    RETURN 'HTTP Error ' || result_record.status_code || ': ' || COALESCE(result_record.error_msg, 'Unknown error');
  ELSE
    RETURN 'Timeout: No response from Ollama after 10 seconds';
  END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.ollama_sql(text) TO postgres, anon, authenticated, service_role;

-- Test it
SELECT ollama_sql('show all tables in the database') AS generated_sql;