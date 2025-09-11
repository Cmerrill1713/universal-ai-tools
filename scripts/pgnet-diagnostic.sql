-- Diagnostic script for pg_net Ollama integration

-- Function to diagnose pg_net issues
CREATE OR REPLACE FUNCTION diagnose_pgnet()
RETURNS TABLE(
  check_name text,
  status text,
  details text
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check 1: pg_net extension
  RETURN QUERY
  SELECT 
    'pg_net extension'::text,
    CASE WHEN EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_net') 
      THEN 'OK' ELSE 'MISSING' END,
    (SELECT extversion FROM pg_extension WHERE extname = 'pg_net')::text;
    
  -- Check 2: Recent successful requests
  RETURN QUERY
  SELECT 
    'Recent Ollama requests'::text,
    CASE WHEN COUNT(*) > 0 THEN 'OK' ELSE 'NONE' END,
    COUNT(*)::text || ' successful in last 10 minutes'
  FROM net._http_response
  WHERE status_code = 200 
    AND created > now() - interval '10 minutes'
    AND content::text LIKE '%llama%';
    
  -- Check 3: Test direct request
  DECLARE
    test_id bigint;
    test_response record;
  BEGIN
    SELECT net.http_get(
      url => 'http://host.docker.internal:8080/api/tags'
    ) INTO test_id;
    
    -- Wait a bit
    PERFORM pg_sleep(2);
    
    SELECT * INTO test_response FROM net._http_response WHERE id = test_id;
    
    RETURN QUERY
    SELECT 
      'Direct nginx test'::text,
      CASE WHEN test_response.status_code = 200 THEN 'OK' ELSE 'FAILED' END,
      'Status: ' || COALESCE(test_response.status_code::text, 'No response');
  END;
  
  -- Check 4: Show a recent request/response
  RETURN QUERY
  SELECT 
    'Latest Ollama response'::text,
    'INFO'::text,
    left((content::jsonb)->>'response', 50) || '...'
  FROM net._http_response
  WHERE status_code = 200 
    AND content::text LIKE '%response%'
  ORDER BY created DESC
  LIMIT 1;
END;
$$;

-- Fixed AI SQL function with better response handling
CREATE OR REPLACE FUNCTION ai_sql_fixed(prompt text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  req_id bigint;
  resp record;
  attempts int := 0;
  max_attempts int := 60; -- 30 seconds with 0.5s intervals
BEGIN
  -- Make request
  req_id := net.http_post(
    url => 'http://host.docker.internal:8080/api/generate',
    body => json_build_object(
      'model', 'llama3.2:3b',
      'prompt', 'PostgreSQL SQL only: ' || prompt,
      'stream', false
    )::jsonb
  );
  
  -- Log the request ID
  RAISE NOTICE 'Request ID: %', req_id;
  
  -- Wait for response
  WHILE attempts < max_attempts LOOP
    SELECT * INTO resp 
    FROM net._http_response 
    WHERE id = req_id;
    
    IF resp.id IS NOT NULL THEN
      RAISE NOTICE 'Got response with status: %', resp.status_code;
      EXIT;
    END IF;
    
    attempts := attempts + 1;
    PERFORM pg_sleep(0.5);
  END LOOP;
  
  -- Process response
  IF resp.id IS NOT NULL AND resp.status_code = 200 THEN
    RETURN regexp_replace((resp.content::jsonb)->>'response', '```[sql]*', '', 'gi');
  ELSIF resp.id IS NOT NULL THEN
    RETURN 'Error: Status ' || resp.status_code;
  ELSE
    -- Check if there's a newer response that might be ours
    SELECT * INTO resp 
    FROM net._http_response 
    WHERE created > now() - interval '1 minute'
      AND status_code = 200
      AND content::text LIKE '%' || left(prompt, 20) || '%'
    ORDER BY created DESC
    LIMIT 1;
    
    IF resp.id IS NOT NULL THEN
      RETURN 'Found delayed response: ' || regexp_replace((resp.content::jsonb)->>'response', '```[sql]*', '', 'gi');
    ELSE
      RETURN 'Timeout after ' || attempts || ' attempts. Request ID was: ' || req_id;
    END IF;
  END IF;
END;
$$;

-- Run diagnostics
SELECT * FROM diagnose_pgnet();

-- Test the fixed function
SELECT ai_sql_fixed('show all tables') as test_result;