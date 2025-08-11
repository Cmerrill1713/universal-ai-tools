BEGIN;

-- Enforce RLS for critical tables so even table owners are subject to policies
DO $$
BEGIN
  IF to_regclass('public.ai_memories') IS NOT NULL THEN
    ALTER TABLE public.ai_memories FORCE ROW LEVEL SECURITY;
  END IF;
  IF to_regclass('public.audit_events') IS NOT NULL THEN
    ALTER TABLE public.audit_events FORCE ROW LEVEL SECURITY;
  END IF;
  IF to_regclass('public.mcp_jobs') IS NOT NULL THEN
    ALTER TABLE public.mcp_jobs FORCE ROW LEVEL SECURITY;
  END IF;
  IF to_regclass('public.migration_suggestions') IS NOT NULL THEN
    ALTER TABLE public.migration_suggestions FORCE ROW LEVEL SECURITY;
  END IF;
END$$;

COMMIT;


