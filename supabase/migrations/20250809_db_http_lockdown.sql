BEGIN;

-- Lock down DB HTTP functions (Ollama) to prevent execution by app roles
-- ai_generate_sql(text, text, float)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'ai_generate_sql'
      AND pg_get_function_identity_arguments(p.oid) = 'text, text, double precision'
  ) THEN
    ALTER FUNCTION public.ai_generate_sql(text, text, float) SECURITY INVOKER;
    REVOKE ALL ON FUNCTION public.ai_generate_sql(text, text, float) FROM PUBLIC, anon, authenticated, service_role;
    COMMENT ON FUNCTION public.ai_generate_sql(text, text, float) IS 'Disabled: move to Edge Function or Node service';
  END IF;
END$$;

COMMIT;

