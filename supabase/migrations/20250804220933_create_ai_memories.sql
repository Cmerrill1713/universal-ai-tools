CREATE TABLE IF NOT EXISTS public.ai_memories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- service_id removed from canonical schema; keep table creation minimal here
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

DO $$
BEGIN
  -- Only create service_id index if the column exists (older schema variant)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ai_memories' AND column_name = 'service_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ai_memories_service_id ON public.ai_memories (service_id)';
  END IF;
END $$;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ai_memories' AND column_name = 'memory_type'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ai_memories_memory_type ON public.ai_memories (memory_type)';
  END IF;
END $$;

-- Sample data removed (non-canonical schema)