-- Stores LLM-proposed SQL migrations for human approval
BEGIN;

CREATE TABLE IF NOT EXISTS public.migration_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NULL REFERENCES public.mcp_jobs(id) ON DELETE SET NULL,
  user_id UUID NULL,
  request TEXT NOT NULL,
  sql_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','approved','applied','rejected')),
  reviewer TEXT NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Set user_id when available
CREATE OR REPLACE FUNCTION public.set_migration_suggestions_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    BEGIN
      NEW.user_id := public.get_current_user_id();
    EXCEPTION WHEN OTHERS THEN
      NEW.user_id := NEW.user_id;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

DROP TRIGGER IF EXISTS trg_set_migration_suggestions_user_id ON public.migration_suggestions;
CREATE TRIGGER trg_set_migration_suggestions_user_id
BEFORE INSERT ON public.migration_suggestions
FOR EACH ROW EXECUTE FUNCTION public.set_migration_suggestions_user_id();

-- Maintain updated_at
DROP TRIGGER IF EXISTS trg_migration_suggestions_updated_at ON public.migration_suggestions;
CREATE TRIGGER trg_migration_suggestions_updated_at
BEFORE UPDATE ON public.migration_suggestions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_migration_suggestions_status_created ON public.migration_suggestions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_migration_suggestions_user ON public.migration_suggestions(user_id);

-- Enable RLS
ALTER TABLE public.migration_suggestions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='migration_suggestions' AND policyname='migration_suggestions_select_own'
  ) THEN
    EXECUTE 'CREATE POLICY migration_suggestions_select_own ON public.migration_suggestions FOR SELECT USING (user_id = auth.uid())';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='migration_suggestions' AND policyname='migration_suggestions_insert_own'
  ) THEN
    EXECUTE 'CREATE POLICY migration_suggestions_insert_own ON public.migration_suggestions FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='migration_suggestions' AND policyname='migration_suggestions_update_own'
  ) THEN
    EXECUTE 'CREATE POLICY migration_suggestions_update_own ON public.migration_suggestions FOR UPDATE USING (user_id = auth.uid())';
  END IF;
END$$;

-- Service role full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='migration_suggestions' AND policyname='migration_suggestions_service_all'
  ) THEN
    EXECUTE 'CREATE POLICY migration_suggestions_service_all ON public.migration_suggestions FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END$$;

COMMIT;


