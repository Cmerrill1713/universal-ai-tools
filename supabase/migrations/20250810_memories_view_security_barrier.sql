BEGIN;

-- Recreate compatibility view with SECURITY BARRIER to ensure RLS cannot be bypassed by planner rewrites
DROP VIEW IF EXISTS public.memories;
CREATE VIEW public.memories WITH (security_barrier=true) AS
SELECT
  id,
  content,
  metadata,
  user_id,
  created_at,
  updated_at
FROM public.ai_memories;

-- Read-only permissions remain
REVOKE ALL ON TABLE public.memories FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.memories TO anon, authenticated;

COMMENT ON VIEW public.memories IS 'Compatibility view with security barrier; source of truth is public.ai_memories (RLS-enforced).';

COMMIT;


