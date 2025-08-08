BEGIN;

-- 1) Canonicalize memory to ai_memories; archive duplicate table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema='public' AND table_name='memories'
  ) THEN
    ALTER TABLE public.memories RENAME TO memories_legacy;
    COMMENT ON TABLE public.memories_legacy IS 'Legacy copy; do not use. Will be dropped after verification.';
  END IF;
END$$;

-- 2) ai_memories: add user_id + secure RLS
ALTER TABLE public.ai_memories
  ADD COLUMN IF NOT EXISTS user_id uuid;

-- Trigger to auto-set user_id on insert
CREATE OR REPLACE FUNCTION public.set_ai_memories_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_ai_memories_user_id ON public.ai_memories;
CREATE TRIGGER trg_set_ai_memories_user_id
BEFORE INSERT ON public.ai_memories
FOR EACH ROW
EXECUTE FUNCTION public.set_ai_memories_user_id();

-- RLS: remove permissive PUBLIC policies
DROP POLICY IF EXISTS ai_memories_read_policy ON public.ai_memories;
DROP POLICY IF EXISTS ai_memories_create_policy ON public.ai_memories;
DROP POLICY IF EXISTS ai_memories_update_policy ON public.ai_memories;
DROP POLICY IF EXISTS ai_memories_delete_policy ON public.ai_memories;

ALTER TABLE public.ai_memories ENABLE ROW LEVEL SECURITY;

-- Per-user access
CREATE POLICY ai_memories_select_own ON public.ai_memories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY ai_memories_insert_own ON public.ai_memories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY ai_memories_update_own ON public.ai_memories
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY ai_memories_delete_own ON public.ai_memories
  FOR DELETE USING (auth.uid() = user_id);

-- Service role full access (system jobs, migrations)
CREATE POLICY ai_memories_service_all ON public.ai_memories
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- 3) agent_tools: remove world-write, keep public read of enabled tools
DROP POLICY IF EXISTS "Allow read and write access to all users" ON public.agent_tools;

ALTER TABLE public.agent_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_tools_public_read ON public.agent_tools
  FOR SELECT TO PUBLIC USING (enabled = true);

CREATE POLICY agent_tools_service_all ON public.agent_tools
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- 4) mcp_context policies: remove NULL-user access and fix helper function
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE v_sub text;
BEGIN
  v_sub := COALESCE(
    auth.jwt() ->> 'sub',
    (current_setting('request.jwt.claims', true)::json ->> 'sub')
  );
  RETURN v_sub; -- may be NULL; RLS below will treat NULL as no-access
END;
$$;

-- Drop and recreate policies only if mcp tables exist
DO $$
BEGIN
  IF to_regclass('public.mcp_context') IS NOT NULL THEN
    DROP POLICY IF EXISTS mcp_context_select_policy ON public.mcp_context;
    DROP POLICY IF EXISTS mcp_context_insert_policy ON public.mcp_context;
    DROP POLICY IF EXISTS mcp_context_update_policy ON public.mcp_context;
    DROP POLICY IF EXISTS mcp_context_delete_policy ON public.mcp_context;

    CREATE POLICY mcp_context_select_secure ON public.mcp_context
      FOR SELECT USING (user_id::text = get_current_user_id() OR auth.role() = 'service_role');

    CREATE POLICY mcp_context_insert_secure ON public.mcp_context
      FOR INSERT WITH CHECK (user_id::text = get_current_user_id() OR auth.role() = 'service_role');

    CREATE POLICY mcp_context_update_secure ON public.mcp_context
      FOR UPDATE USING (user_id::text = get_current_user_id() OR auth.role() = 'service_role');

    CREATE POLICY mcp_context_delete_secure ON public.mcp_context
      FOR DELETE USING (user_id::text = get_current_user_id() OR auth.role() = 'service_role');
  END IF;
END$$;

-- 5) Restrict DEFINER/DB-HTTP function execution
-- Example: ai_generate_sql(text,text,float)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='ai_generate_sql'
      AND pg_get_function_identity_arguments(p.oid)='text, text, double precision'
  ) THEN
    ALTER FUNCTION public.ai_generate_sql(text, text, float) SECURITY INVOKER;
    REVOKE ALL ON FUNCTION public.ai_generate_sql(text, text, float) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.ai_generate_sql(text, text, float) TO postgres;
  END IF;
END$$;

COMMIT;

