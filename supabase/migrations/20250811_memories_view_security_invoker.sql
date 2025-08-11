-- Ensure the compatibility view enforces RLS by executing with invoker privileges
DO $$
BEGIN
  BEGIN
    EXECUTE 'DROP VIEW IF EXISTS public.memories';
  EXCEPTION WHEN OTHERS THEN
    -- ignore
    NULL;
  END;

  EXECUTE 'CREATE VIEW public.memories WITH (security_barrier=true, security_invoker=true) AS '
          'SELECT id, content, metadata, user_id, created_at, updated_at '
          'FROM public.ai_memories';

  -- Harden privileges: read-only for anon/authenticated
  BEGIN
    EXECUTE 'REVOKE ALL ON TABLE public.memories FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT SELECT ON TABLE public.memories TO anon, authenticated';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END$$;


