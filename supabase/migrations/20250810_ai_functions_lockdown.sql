BEGIN;

-- Lock down AI helper functions to avoid DB egress and privilege escalation
DO $$
BEGIN
  -- ai_explain_sql(sql_query text, model text DEFAULT 'llama3.2:3b')
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='ai_explain_sql'
  ) THEN
    ALTER FUNCTION public.ai_explain_sql(text, text) SECURITY INVOKER;
    REVOKE ALL ON FUNCTION public.ai_explain_sql(text, text) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.ai_explain_sql(text, text) TO postgres;
  END IF;

  -- ai_optimize_sql(sql_query text, model text DEFAULT 'llama3.2:3b')
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='ai_optimize_sql'
  ) THEN
    ALTER FUNCTION public.ai_optimize_sql(text, text) SECURITY INVOKER;
    REVOKE ALL ON FUNCTION public.ai_optimize_sql(text, text) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.ai_optimize_sql(text, text) TO postgres;
  END IF;
END$$;

COMMIT;


