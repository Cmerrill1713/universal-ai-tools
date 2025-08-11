BEGIN;

-- Revoke broad EXECUTE and grant only to postgres and service_role
-- ai_generate_sql(text, text, float)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='ai_generate_sql'
      AND pg_get_function_identity_arguments(p.oid)='text, text, double precision'
  ) THEN
    REVOKE ALL ON FUNCTION public.ai_generate_sql(text, text, float) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.ai_generate_sql(text, text, float) TO postgres, service_role;
  END IF;
END$$;

-- ai_explain_sql(text, text)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='ai_explain_sql'
      AND pg_get_function_identity_arguments(p.oid)='text, text'
  ) THEN
    REVOKE ALL ON FUNCTION public.ai_explain_sql(text, text) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.ai_explain_sql(text, text) TO postgres, service_role;
  END IF;
END$$;

-- ai_optimize_sql(text, text)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='ai_optimize_sql'
      AND pg_get_function_identity_arguments(p.oid)='text, text'
  ) THEN
    REVOKE ALL ON FUNCTION public.ai_optimize_sql(text, text) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.ai_optimize_sql(text, text) TO postgres, service_role;
  END IF;
END$$;

COMMIT;


