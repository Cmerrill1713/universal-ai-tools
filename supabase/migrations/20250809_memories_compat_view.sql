BEGIN;

DROP VIEW IF EXISTS public.memories;
CREATE VIEW public.memories AS
SELECT
  id,
  content,
  metadata,
  user_id,
  created_at,
  updated_at
FROM public.ai_memories;

-- Read-only permissions
REVOKE ALL ON TABLE public.memories FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.memories TO anon, authenticated;

COMMENT ON VIEW public.memories IS 'Compatibility view. Source of truth is public.ai_memories.';

COMMIT;

