BEGIN;

-- Remove legacy permissive policies that may coexist alongside secure ones
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='ai_memories') THEN
    -- Drop any old broad/public policies by name if present
    PERFORM 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_memories' AND policyname='ai_memories_read_policy';
    IF FOUND THEN EXECUTE 'DROP POLICY ai_memories_read_policy ON public.ai_memories'; END IF;
    PERFORM 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_memories' AND policyname='ai_memories_create_policy';
    IF FOUND THEN EXECUTE 'DROP POLICY ai_memories_create_policy ON public.ai_memories'; END IF;
    PERFORM 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_memories' AND policyname='ai_memories_update_policy';
    IF FOUND THEN EXECUTE 'DROP POLICY ai_memories_update_policy ON public.ai_memories'; END IF;
    PERFORM 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_memories' AND policyname='ai_memories_delete_policy';
    IF FOUND THEN EXECUTE 'DROP POLICY ai_memories_delete_policy ON public.ai_memories'; END IF;
  END IF;
END$$;

COMMIT;


