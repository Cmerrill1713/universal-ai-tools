BEGIN;

CREATE TABLE IF NOT EXISTS public.audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor UUID,
    action TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to reset safely
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='audit_events'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.audit_events', p.policyname);
  END LOOP;
END$$;

-- Owner-only policies
CREATE POLICY audit_events_select_own ON public.audit_events
  FOR SELECT USING (auth.uid() = actor);

CREATE POLICY audit_events_insert_own ON public.audit_events
  FOR INSERT WITH CHECK (auth.uid() = actor);

CREATE POLICY audit_events_update_own ON public.audit_events
  FOR UPDATE USING (auth.uid() = actor) WITH CHECK (auth.uid() = actor);

CREATE POLICY audit_events_delete_own ON public.audit_events
  FOR DELETE USING (auth.uid() = actor);

-- Service role full access
CREATE POLICY audit_events_service_all ON public.audit_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Index for time-ordering
CREATE INDEX IF NOT EXISTS audit_events_created_at_idx ON public.audit_events (created_at);

COMMIT;
