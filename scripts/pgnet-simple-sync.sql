-- Simplified synchronous pg_net function for Ollama
-- This version waits properly for the response

DROP FUNCTION IF EXISTS public.ai_sql CASCADE;

CREATE OR REPLACE FUNCTION public.ai_sql(
  prompt text
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  req_id bigint;
  resp record;
  result text;
BEGIN
  -- Make request
  SELECT net.http_post(
    url => 'http://host.docker.internal:8080/api/generate',
    body => json_build_object(
      'model', 'llama3.2:3b',
      'prompt', 'PostgreSQL expert. SQL only for: ' || prompt,
      'stream', false
    )::jsonb
  ) INTO req_id;
  
  -- Wait for completion (check every second)
  FOR i IN 1..30 LOOP
    SELECT * INTO resp FROM net._http_response WHERE id = req_id;
    EXIT WHEN resp.id IS NOT NULL;
    PERFORM pg_sleep(1);
  END LOOP;
  
  -- Extract result
  IF resp.status_code = 200 THEN
    result := (resp.content::jsonb)->>'response';
    result := regexp_replace(result, '```[sql]*', '', 'gi');
    RETURN trim(result);
  ELSE
    RETURN 'Error: ' || COALESCE(resp.status_code::text, 'timeout');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ai_sql TO postgres, anon, authenticated, service_role;

-- Test it immediately
SELECT ai_sql('list all tables') as sql_query;