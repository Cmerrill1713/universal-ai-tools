-- Local Memory Layer for AI Agents
-- Creates tables and functions for self-hosted ByteRover alternative

-- Enable vector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create code memories table
CREATE TABLE IF NOT EXISTS code_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  context_type TEXT NOT NULL CHECK (context_type IN ('bug_fix', 'feature', 'refactor', 'optimization', 'pattern', 'decision')),
  content TEXT NOT NULL,
  code_snippet TEXT,
  file_path TEXT,
  programming_language TEXT,
  tags TEXT[] DEFAULT '{}',
  success_metrics JSONB,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed TIMESTAMPTZ DEFAULT NOW(),
  access_count INTEGER DEFAULT 0
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_code_memories_session ON code_memories(session_id);
CREATE INDEX IF NOT EXISTS idx_code_memories_agent ON code_memories(agent_name);
CREATE INDEX IF NOT EXISTS idx_code_memories_type ON code_memories(context_type);
CREATE INDEX IF NOT EXISTS idx_code_memories_language ON code_memories(programming_language);
CREATE INDEX IF NOT EXISTS idx_code_memories_created ON code_memories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_code_memories_accessed ON code_memories(last_accessed DESC);

-- Create vector similarity index
CREATE INDEX IF NOT EXISTS idx_code_memories_embedding 
ON code_memories USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Function to create the table (for compatibility)
CREATE OR REPLACE FUNCTION create_code_memory_table(sql TEXT)
RETURNS VOID AS $$
BEGIN
  -- Table creation is handled above, this is for compatibility
  NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to search memories by vector similarity
CREATE OR REPLACE FUNCTION search_code_memories(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5,
  agent_filter TEXT DEFAULT NULL,
  language_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  session_id TEXT,
  agent_name TEXT,
  context_type TEXT,
  content TEXT,
  code_snippet TEXT,
  file_path TEXT,
  programming_language TEXT,
  tags TEXT[],
  success_metrics JSONB,
  created_at TIMESTAMPTZ,
  last_accessed TIMESTAMPTZ,
  access_count INTEGER,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cm.id,
    cm.session_id,
    cm.agent_name,
    cm.context_type,
    cm.content,
    cm.code_snippet,
    cm.file_path,
    cm.programming_language,
    cm.tags,
    cm.success_metrics,
    cm.created_at,
    cm.last_accessed,
    cm.access_count,
    1 - (cm.embedding <=> query_embedding) AS similarity
  FROM code_memories cm
  WHERE 
    (1 - (cm.embedding <=> query_embedding)) > match_threshold
    AND (agent_filter IS NULL OR cm.agent_name = agent_filter)
    AND (language_filter IS NULL OR cm.programming_language = language_filter)
  ORDER BY cm.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get memory statistics
CREATE OR REPLACE FUNCTION get_memory_stats()
RETURNS TABLE (
  total_memories BIGINT,
  by_agent JSONB,
  by_type JSONB,
  by_language JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_memories,
    (
      SELECT jsonb_object_agg(agent_name, count)
      FROM (
        SELECT agent_name, COUNT(*) as count
        FROM code_memories
        GROUP BY agent_name
      ) agent_counts
    ) as by_agent,
    (
      SELECT jsonb_object_agg(context_type, count)
      FROM (
        SELECT context_type, COUNT(*) as count
        FROM code_memories
        GROUP BY context_type
      ) type_counts
    ) as by_type,
    (
      SELECT jsonb_object_agg(programming_language, count)
      FROM (
        SELECT programming_language, COUNT(*) as count
        FROM code_memories
        WHERE programming_language IS NOT NULL
        GROUP BY programming_language
      ) lang_counts
    ) as by_language
  FROM code_memories;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old memories (optional maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_memories(
  older_than_days INTEGER DEFAULT 90,
  min_access_count INTEGER DEFAULT 1
)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM code_memories
  WHERE 
    created_at < NOW() - INTERVAL '1 day' * older_than_days
    AND access_count < min_access_count;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create sample data for testing
INSERT INTO code_memories (
  session_id,
  agent_name,
  context_type,
  content,
  code_snippet,
  file_path,
  programming_language,
  tags,
  success_metrics,
  embedding
) VALUES 
(
  'sample-session-1',
  'code_assistant',
  'bug_fix',
  'Fixed authentication token validation issue',
  'if (!token || typeof token !== "string") { throw new Error("Invalid token"); }',
  'src/middleware/auth.ts',
  'typescript',
  ARRAY['auth', 'validation', 'token', 'bug_fix'],
  '{"compilation_success": true, "test_passing": true}',
  -- Mock embedding vector
  ARRAY(SELECT random() - 0.5 FROM generate_series(1, 1536))::VECTOR(1536)
),
(
  'sample-session-1',
  'code_assistant',
  'optimization',
  'Optimized database query by adding proper indexes',
  'CREATE INDEX idx_users_email ON users(email);',
  'migrations/001_optimize_queries.sql',
  'sql',
  ARRAY['database', 'optimization', 'index', 'performance'],
  '{"compilation_success": true, "test_passing": true, "performance_improvement": 2.5}',
  ARRAY(SELECT random() - 0.5 FROM generate_series(1, 1536))::VECTOR(1536)
);

-- Grant necessary permissions
GRANT ALL ON code_memories TO authenticated;
GRANT ALL ON code_memories TO service_role;

GRANT EXECUTE ON FUNCTION search_code_memories TO authenticated;
GRANT EXECUTE ON FUNCTION search_code_memories TO service_role;

GRANT EXECUTE ON FUNCTION get_memory_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_memory_stats TO service_role;

GRANT EXECUTE ON FUNCTION cleanup_old_memories TO service_role;