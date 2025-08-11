-- If a view named public.memories already exists (our canonical compat view), skip table creation
DO $$ BEGIN
IF NOT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'memories' AND table_type = 'BASE TABLE'
) AND NOT EXISTS (
  SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'memories'
) THEN
CREATE TABLE public.memories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT,
  metadata JSONB,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
END IF; END $$;

-- Only apply RLS and policies if public.memories is a table, not a view
DO $$ BEGIN
IF EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'memories' AND table_type = 'BASE TABLE'
) THEN
  EXECUTE 'ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY';
  EXECUTE 'CREATE POLICY memories_read_policy ON public.memories FOR SELECT TO PUBLIC USING (true)';
  EXECUTE 'CREATE POLICY memories_create_update_delete_policy ON public.memories FOR INSERT UPDATE DELETE TO PUBLIC USING (true) WITH CHECK (true)';
END IF; END $$;

DO $$ BEGIN
IF EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'memories' AND table_type = 'BASE TABLE'
) THEN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_memories_user_id ON public.memories (user_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_memories_created_at ON public.memories (created_at)';
END IF; END $$;
