CREATE TABLE IF NOT EXISTS memories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT,
  metadata JSONB,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY memories_select_policy ON memories FOR SELECT TO PUBLIC USING (true);
CREATE POLICY memories_insert_policy ON memories FOR INSERT TO PUBLIC WITH CHECK (true);
CREATE POLICY memories_update_policy ON memories FOR UPDATE TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY memories_delete_policy ON memories FOR DELETE TO PUBLIC USING (true);

CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories (user_id);
CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories (created_at);