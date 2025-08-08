CREATE TABLE IF NOT EXISTS public.ai_memories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID NOT NULL,
  memory_type TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.ai_memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_memories_read_policy ON public.ai_memories FOR SELECT TO PUBLIC USING (true);
CREATE POLICY ai_memories_create_policy ON public.ai_memories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY ai_memories_update_policy ON public.ai_memories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY ai_memories_delete_policy ON public.ai_memories FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_ai_memories_service_id ON public.ai_memories (service_id);
CREATE INDEX IF NOT EXISTS idx_ai_memories_memory_type ON public.ai_memories (memory_type);

-- Sample data
INSERT INTO ai_memories (memory_id, memory_type, agent_name, context, action, reward, learned_value)
VALUES 
(1, 'task', 'agent_1', 'user interaction', ' responded with greeting', 0.8, 0.01),
(2, 'state', 'agent_2', 'system failure', 'switched to backup system', -0.5, 0.05),
(3, 'reward', 'agent_1', 'user feedback', ' provided positive feedback', 0.9, 0.02),
(4, 'context', 'agent_2', 'environment change', 'adapted to new environment', 0.7, 0.03),
(5, 'action', 'agent_3', 'task completion', 'completed task successfully', 1.0, 0.04);