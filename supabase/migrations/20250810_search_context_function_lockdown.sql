BEGIN;

-- Lock down search_context_storage_by_embedding: use SECURITY INVOKER and restrict EXECUTE
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='search_context_storage_by_embedding'
      AND pg_get_function_identity_arguments(p.oid)='vector, text, text, integer'
  ) THEN
    ALTER FUNCTION public.search_context_storage_by_embedding(vector, text, text, integer) SECURITY INVOKER;
    REVOKE ALL ON FUNCTION public.search_context_storage_by_embedding(vector, text, text, integer)
      FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.search_context_storage_by_embedding(vector, text, text, integer)
      TO postgres, service_role;
  END IF;
END$$;

COMMIT;


