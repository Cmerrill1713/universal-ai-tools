BEGIN;

-- Fully reset RLS policies on ai_memories to remove legacy permissive ones
DO $$
DECLARE
  p record;
BEGIN
  IF to_regclass('public.ai_memories') IS NOT NULL THEN
    -- Enable RLS
    ALTER TABLE public.ai_memories ENABLE ROW LEVEL SECURITY;

    -- Drop all existing policies regardless of name
    FOR p IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname='public' AND tablename='ai_memories'
    LOOP
      EXECUTE format('DROP POLICY %I ON public.ai_memories', p.policyname);
    END LOOP;

    -- Per-user policies (owner-only) and service role full-access
    EXECUTE 'CREATE POLICY ai_memories_select_own ON public.ai_memories FOR SELECT USING (auth.uid() = user_id)';

    EXECUTE 'CREATE POLICY ai_memories_insert_own ON public.ai_memories FOR INSERT WITH CHECK (auth.uid() = user_id)';

    EXECUTE 'CREATE POLICY ai_memories_update_own ON public.ai_memories FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';

    EXECUTE 'CREATE POLICY ai_memories_delete_own ON public.ai_memories FOR DELETE USING (auth.uid() = user_id)';

    EXECUTE 'CREATE POLICY ai_memories_service_all ON public.ai_memories FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END$$;

COMMIT;


