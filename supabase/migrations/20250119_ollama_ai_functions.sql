
-- Function to generate SQL using Ollama
CREATE OR REPLACE FUNCTION public.ai_generate_sql(
  prompt text,
  model text DEFAULT 'llama3.2:3b',
  temperature float DEFAULT 0.1
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result text;
  response jsonb;
BEGIN
  -- Use pg_net to call Ollama API
  SELECT content INTO result
  FROM http((
    'POST',
    'http://host.docker.internal:11434/api/generate',
    ARRAY[http_header('Content-Type', 'application/json')],
    'application/json',
    jsonb_build_object(
      'model', model,
      'prompt', 'You are a PostgreSQL expert. Generate only SQL code, no explanations. ' || prompt,
      'temperature', temperature,
      'stream', false
    )::text
  ))
  WHERE status = 200;
  
  -- Extract response
  IF result IS NOT NULL THEN
    response := result::jsonb;
    RETURN response->>'response';
  ELSE
    RETURN 'Error: Could not generate SQL';
  END IF;
END;
$$;

-- Function to explain SQL using Ollama
CREATE OR REPLACE FUNCTION public.ai_explain_sql(
  sql_query text,
  model text DEFAULT 'llama3.2:3b'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result text;
  response jsonb;
BEGIN
  SELECT content INTO result
  FROM http((
    'POST',
    'http://host.docker.internal:11434/api/generate',
    ARRAY[http_header('Content-Type', 'application/json')],
    'application/json',
    jsonb_build_object(
      'model', model,
      'prompt', 'Explain this SQL query in simple terms: ' || sql_query,
      'temperature', 0.3,
      'stream', false
    )::text
  ))
  WHERE status = 200;
  
  IF result IS NOT NULL THEN
    response := result::jsonb;
    RETURN response->>'response';
  ELSE
    RETURN 'Error: Could not explain SQL';
  END IF;
END;
$$;

-- Function to optimize SQL using Ollama
CREATE OR REPLACE FUNCTION public.ai_optimize_sql(
  sql_query text,
  model text DEFAULT 'llama3.2:3b'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result text;
  response jsonb;
BEGIN
  SELECT content INTO result
  FROM http((
    'POST',
    'http://host.docker.internal:11434/api/generate',
    ARRAY[http_header('Content-Type', 'application/json')],
    'application/json',
    jsonb_build_object(
      'model', model,
      'prompt', 'Optimize this PostgreSQL query for performance. Return only the optimized SQL: ' || sql_query,
      'temperature', 0.1,
      'stream', false
    )::text
  ))
  WHERE status = 200;
  
  IF result IS NOT NULL THEN
    response := result::jsonb;
    RETURN response->>'response';
  ELSE
    RETURN 'Error: Could not optimize SQL';
  END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.ai_generate_sql TO postgres, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_explain_sql TO postgres, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_optimize_sql TO postgres, anon, authenticated;
