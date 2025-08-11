CREATE TABLE IF NOT EXISTS public.agent_tools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  parameters JSONB,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.agent_tools ENABLE ROW LEVEL SECURITY;

-- Remove overly permissive policy if present
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='agent_tools' AND policyname='Allow read and write access to all users'
  ) THEN
    EXECUTE 'DROP POLICY "Allow read and write access to all users" ON public.agent_tools';
  END IF;
END $$;

CREATE POLICY agent_tools_public_read ON public.agent_tools
  FOR SELECT TO PUBLIC USING (enabled = true);

CREATE POLICY agent_tools_service_all ON public.agent_tools
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_agent_tools_name ON public.agent_tools(name);
CREATE INDEX IF NOT EXISTS idx_agent_tools_enabled ON public.agent_tools(enabled);
CREATE INDEX IF NOT EXISTS idx_agent_tools_created_at ON public.agent_tools(created_at);

-- Removed invalid sample data with non-existent columns