CREATE TABLE IF NOT EXISTS public.agent_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  agent_id UUID NOT NULL,
  context JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.agent_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access to all users" ON public.agent_sessions USING (true);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_session_id ON public.agent_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_updated_at ON public.agent_sessions(updated_at DESC);