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
CREATE POLICY "Allow read access to all users" ON public.agent_tools
  FOR SELECT TO PUBLIC USING (true);
CREATE INDEX IF NOT EXISTS idx_agent_tools_name ON public.agent_tools (name);
CREATE INDEX IF NOT EXISTS idx_agent_tools_enabled ON public.agent_tools (enabled);
CREATE INDEX IF NOT EXISTS idx_agent_tools_created_at ON public.agent_tools (created_at);

-- Sample data
INSERT INTO agent_tools (name, description, parameters, enabled)
VALUES 
('web_search', 'Search the web for information', '{"query": {"type": "string", "required": true}}'::jsonb, true),
('code_executor', 'Execute code snippets safely', '{"language": {"type": "string", "required": true}, "code": {"type": "string", "required": true}}'::jsonb, true),
('memory_store', 'Store information in long-term memory', '{"key": {"type": "string", "required": true}, "value": {"type": "any", "required": true}}'::jsonb, true),
('memory_retrieve', 'Retrieve information from memory', '{"key": {"type": "string", "required": true}}'::jsonb, true),
('task_scheduler', 'Schedule tasks for future execution', '{"task": {"type": "string", "required": true}, "schedule": {"type": "string", "required": true}}'::jsonb, true);