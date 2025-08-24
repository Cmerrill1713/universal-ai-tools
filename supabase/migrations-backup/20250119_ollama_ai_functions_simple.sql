-- Simple Ollama AI functions for local development
-- These are placeholder functions that demonstrate the API

-- Function to generate SQL using Ollama (placeholder)
CREATE OR REPLACE FUNCTION public.ai_generate_sql(
  prompt text,
  model text DEFAULT 'llama3.2:3b',
  temperature float DEFAULT 0.1
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- In production, this would call Ollama API
  -- For now, return a helpful message
  RETURN format('-- Generated SQL for: %s
-- Model: %s
-- Note: Run this query in your Ollama-powered client:
-- SELECT ai_generate_sql(''%s'');
-- Or use the Supabase Edge Function for real AI generation
SELECT * FROM your_table WHERE condition = true;', 
    prompt, model, replace(prompt, '''', ''''''));
END;
$$;

-- Function to explain SQL using Ollama (placeholder)
CREATE OR REPLACE FUNCTION public.ai_explain_sql(
  sql_query text,
  model text DEFAULT 'llama3.2:3b'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN format('SQL Explanation for: %s
This query would be explained by Ollama model: %s
For real AI explanations, use the Edge Function or external client.', 
    substring(sql_query, 1, 100), model);
END;
$$;

-- Function to optimize SQL using Ollama (placeholder)
CREATE OR REPLACE FUNCTION public.ai_optimize_sql(
  sql_query text,
  model text DEFAULT 'llama3.2:3b'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN format('-- Optimized version (placeholder)
-- Original: %s
-- Model: %s
-- For real optimization, use Ollama via Edge Function
%s -- Consider adding indexes', 
    substring(sql_query, 1, 50), model, sql_query);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.ai_generate_sql TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ai_explain_sql TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ai_optimize_sql TO postgres, anon, authenticated, service_role;

-- Create a helper function for the UI
CREATE OR REPLACE FUNCTION public.ai_assistant_help()
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN 'AI Assistant is configured to use Ollama locally.

To use AI features:
1. Direct SQL: SELECT ai_generate_sql(''your prompt'');
2. Via Terminal: npm run ollama:test
3. Via Browser Console: await askOllama(''your prompt'')

Available functions:
- ai_generate_sql(prompt) - Generate SQL from natural language
- ai_explain_sql(query) - Explain what a query does
- ai_optimize_sql(query) - Get optimization suggestions

Note: These are placeholder functions. For real AI responses, 
ensure Ollama is running (ollama serve) and use the Edge Functions
or the command-line tools.';
END;
$$;

GRANT EXECUTE ON FUNCTION public.ai_assistant_help TO postgres, anon, authenticated, service_role;