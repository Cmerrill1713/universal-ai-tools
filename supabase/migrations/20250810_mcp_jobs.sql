-- MCP Jobs queue with NOTIFY trigger for local workers
BEGIN;

CREATE TABLE IF NOT EXISTS public.mcp_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL,
  tool_name TEXT NOT NULL,
  tool_args JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','in_progress','completed','failed')),
  result JSONB NULL,
  error TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-assign user_id via current authenticated user when available
CREATE OR REPLACE FUNCTION public.set_mcp_jobs_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    BEGIN
      NEW.user_id := public.get_current_user_id();
    EXCEPTION WHEN OTHERS THEN
      -- leave NULL if helper is unavailable
      NEW.user_id := NEW.user_id;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

DROP TRIGGER IF EXISTS trg_set_mcp_jobs_user_id ON public.mcp_jobs;
CREATE TRIGGER trg_set_mcp_jobs_user_id
BEFORE INSERT ON public.mcp_jobs
FOR EACH ROW EXECUTE FUNCTION public.set_mcp_jobs_user_id();

-- Notify workers on insert
CREATE OR REPLACE FUNCTION public.notify_mcp_jobs()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('mcp_jobs_insert', NEW.id::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_mcp_jobs ON public.mcp_jobs;
CREATE TRIGGER trg_notify_mcp_jobs
AFTER INSERT ON public.mcp_jobs
FOR EACH ROW EXECUTE FUNCTION public.notify_mcp_jobs();

-- Maintain updated_at
DROP TRIGGER IF EXISTS trg_mcp_jobs_updated_at ON public.mcp_jobs;
CREATE TRIGGER trg_mcp_jobs_updated_at
BEFORE UPDATE ON public.mcp_jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mcp_jobs_status_created ON public.mcp_jobs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_jobs_user ON public.mcp_jobs(user_id);

-- RLS
ALTER TABLE public.mcp_jobs ENABLE ROW LEVEL SECURITY;

-- Owner policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='mcp_jobs' AND policyname='mcp_jobs_select_own'
  ) THEN
    EXECUTE 'CREATE POLICY mcp_jobs_select_own ON public.mcp_jobs FOR SELECT USING (user_id = auth.uid())';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='mcp_jobs' AND policyname='mcp_jobs_insert_own'
  ) THEN
    EXECUTE 'CREATE POLICY mcp_jobs_insert_own ON public.mcp_jobs FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='mcp_jobs' AND policyname='mcp_jobs_update_own'
  ) THEN
    EXECUTE 'CREATE POLICY mcp_jobs_update_own ON public.mcp_jobs FOR UPDATE USING (user_id = auth.uid())';
  END IF;
END$$;

-- Service role full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='mcp_jobs' AND policyname='mcp_jobs_service_all'
  ) THEN
    EXECUTE 'CREATE POLICY mcp_jobs_service_all ON public.mcp_jobs FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END$$;

COMMIT;


