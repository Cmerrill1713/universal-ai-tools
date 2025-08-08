CREATE TABLE IF NOT EXISTS public.memories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT,
  metadata JSONB,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY memories_read_policy ON public.memories FOR SELECT TO PUBLIC USING (true);
CREATE POLICY memories_create_update_delete_policy ON public.memories FOR INSERT UPDATE DELETE TO PUBLIC USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_memories_user_id ON public.memories (user_id);
CREATE INDEX IF NOT EXISTS idx_memories_created_at ON public.memories (created_at);