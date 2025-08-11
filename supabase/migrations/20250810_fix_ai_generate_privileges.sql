BEGIN;

-- Ensure privileges are locked down for ai_generate_sql regardless of identity signature
DO $$
BEGIN
  -- Signature: (text, text, double precision)
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='ai_generate_sql'
      AND pg_get_function_identity_arguments(p.oid)='text, text, double precision'
  ) THEN
    REVOKE ALL ON FUNCTION public.ai_generate_sql(text, text, double precision) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.ai_generate_sql(text, text, double precision) TO postgres, service_role;
  END IF;

  -- Signature: (text, text, float)
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='ai_generate_sql'
      AND pg_get_function_identity_arguments(p.oid)='text, text, float'
  ) THEN
    REVOKE ALL ON FUNCTION public.ai_generate_sql(text, text, float) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.ai_generate_sql(text, text, float) TO postgres, service_role;
  END IF;
END$$;

COMMIT;


