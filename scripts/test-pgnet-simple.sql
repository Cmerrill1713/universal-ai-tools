-- Simple pg_net test to verify it's working
-- Run these queries one by one in Supabase SQL Editor

-- 1. Check if pg_net is installed and version
SELECT extname, extversion 
FROM pg_extension 
WHERE extname = 'pg_net';

-- 2. Test a simple HTTP GET request to a known endpoint
DO $$
DECLARE
  request_id bigint;
BEGIN
  -- Make a simple request
  request_id := net.http_get('https://httpbin.org/get');
  RAISE NOTICE 'Request ID: %', request_id;
END $$;

-- 3. Check the response (wait a second then run this)
SELECT id, created, url, status_code, left(content::text, 200) as response
FROM net.http_response
ORDER BY created DESC
LIMIT 5;

-- 4. Test POST request to httpbin
DO $$
DECLARE
  request_id bigint;
BEGIN
  request_id := net.http_post(
    url := 'https://httpbin.org/post',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"test": "hello from supabase"}'
  );
  RAISE NOTICE 'POST Request ID: %', request_id;
END $$;

-- 5. Simple function to test Ollama via nginx
CREATE OR REPLACE FUNCTION test_ollama_simple()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  request_id bigint;
  response record;
BEGIN
  -- Try calling our nginx proxy
  request_id := net.http_get('http://host.docker.internal:8080/api/tags');
  
  -- Wait a bit
  PERFORM pg_sleep(2);
  
  -- Get response
  SELECT * INTO response
  FROM net.http_response
  WHERE id = request_id;
  
  IF response.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'status_code', response.status_code,
      'has_content', response.content IS NOT NULL,
      'content_preview', left(response.content::text, 100)
    );
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'No response');
  END IF;
END $$;

-- Run the test
SELECT test_ollama_simple();