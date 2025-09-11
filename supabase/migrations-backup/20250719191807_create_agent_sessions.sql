CREATE TABLE IF NOT EXISTS public.agent_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL,
  agent_id UUID NOT NULL,
  context JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.agent_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access to all users" ON public.agent_sessions FOR SELECT USING (true);
CREATE POLICY "Allow insert operations by authenticated users" ON public.agent_sessions FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_session_id ON public.agent_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_agent_id ON public.agent_sessions(agent_id);