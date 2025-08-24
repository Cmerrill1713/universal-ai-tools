-- Enhanced memory tables with vector embeddings and advanced features

-- Add vector columns and enhanced fields to existing ai_memories table
ALTER TABLE ai_memories 
ADD COLUMN IF NOT EXISTS embedding vector(1536),
ADD COLUMN IF NOT EXISTS embedding_model TEXT DEFAULT 'text-embedding-ada-002',
ADD COLUMN IF NOT EXISTS importance_score FLOAT DEFAULT 0.5 CHECK (importance_score >= 0 AND importance_score <= 1),
ADD COLUMN IF NOT EXISTS access_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_accessed TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS memory_category TEXT,
ADD COLUMN IF NOT EXISTS keywords TEXT[],
ADD COLUMN IF NOT EXISTS related_entities JSONB DEFAULT '[]';

-- Create memory connections table (replaces Neo4j relationships)
CREATE TABLE IF NOT EXISTS memory_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_memory_id UUID NOT NULL REFERENCES ai_memories(id) ON DELETE CASCADE,
  target_memory_id UUID NOT NULL REFERENCES ai_memories(id) ON DELETE CASCADE,
  connection_type TEXT NOT NULL,
  strength FLOAT DEFAULT 0.5 CHECK (strength >= 0 AND strength <= 1),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Prevent duplicate connections
  UNIQUE(source_memory_id, target_memory_id, connection_type)
);

-- Create memory clusters for topic grouping
CREATE TABLE IF NOT EXISTS memory_clusters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cluster_name TEXT NOT NULL,
  cluster_type TEXT DEFAULT 'topic',
  centroid_embedding vector(1536),
  member_count INTEGER DEFAULT 0,
  avg_importance FLOAT DEFAULT 0.5,
  keywords TEXT[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create memory cluster membership table
CREATE TABLE IF NOT EXISTS memory_cluster_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cluster_id UUID NOT NULL REFERENCES memory_clusters(id) ON DELETE CASCADE,
  memory_id UUID NOT NULL REFERENCES ai_memories(id) ON DELETE CASCADE,
  distance_from_centroid FLOAT,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cluster_id, memory_id)
);

-- Create agent memory preferences table
CREATE TABLE IF NOT EXISTS agent_memory_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_name TEXT NOT NULL,
  user_id TEXT NOT NULL,
  preference_type TEXT NOT NULL,
  preferences JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_name, user_id, preference_type)
);

-- Create memory access patterns table for analytics
CREATE TABLE IF NOT EXISTS memory_access_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  memory_id UUID NOT NULL REFERENCES ai_memories(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  access_type TEXT NOT NULL,
  query_embedding vector(1536),
  similarity_score FLOAT,
  response_useful BOOLEAN,
  access_context JSONB DEFAULT '{}',
  accessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for optimal performance
-- Vector similarity search indexes
CREATE INDEX IF NOT EXISTS idx_ai_memories_embedding ON ai_memories 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- JSONB and text search indexes
CREATE INDEX IF NOT EXISTS idx_ai_memories_metadata_gin ON ai_memories USING gin (metadata);
CREATE INDEX IF NOT EXISTS idx_ai_memories_keywords_gin ON ai_memories USING gin (keywords);
CREATE INDEX IF NOT EXISTS idx_ai_memories_entities_gin ON ai_memories USING gin (related_entities);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_ai_memories_importance ON ai_memories(importance_score DESC);
CREATE INDEX IF NOT EXISTS idx_ai_memories_access_count ON ai_memories(access_count DESC);
CREATE INDEX IF NOT EXISTS idx_ai_memories_last_accessed ON ai_memories(last_accessed DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_ai_memories_category ON ai_memories(memory_category);

-- Connection indexes
CREATE INDEX IF NOT EXISTS idx_memory_connections_source ON memory_connections(source_memory_id);
CREATE INDEX IF NOT EXISTS idx_memory_connections_target ON memory_connections(target_memory_id);
CREATE INDEX IF NOT EXISTS idx_memory_connections_type ON memory_connections(connection_type);

-- Cluster indexes
CREATE INDEX IF NOT EXISTS idx_memory_cluster_members_cluster ON memory_cluster_members(cluster_id);
CREATE INDEX IF NOT EXISTS idx_memory_cluster_members_memory ON memory_cluster_members(memory_id);

-- Access pattern indexes
CREATE INDEX IF NOT EXISTS idx_memory_access_patterns_memory ON memory_access_patterns(memory_id);
CREATE INDEX IF NOT EXISTS idx_memory_access_patterns_agent ON memory_access_patterns(agent_name);
CREATE INDEX IF NOT EXISTS idx_memory_access_patterns_time ON memory_access_patterns(accessed_at DESC);

-- Create trigger to update access stats
CREATE OR REPLACE FUNCTION update_memory_access_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ai_memories 
  SET 
    access_count = access_count + 1,
    last_accessed = NOW()
  WHERE id = NEW.memory_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_memory_access_stats
AFTER INSERT ON memory_access_patterns
FOR EACH ROW
EXECUTE FUNCTION update_memory_access_stats();

-- Create function to calculate memory importance decay
CREATE OR REPLACE FUNCTION calculate_importance_decay(
  base_importance FLOAT,
  last_accessed TIMESTAMPTZ,
  access_count INTEGER
)
RETURNS FLOAT AS $$
DECLARE
  days_since_access INTEGER;
  decay_factor FLOAT;
  access_boost FLOAT;
BEGIN
  -- Calculate days since last access
  days_since_access := EXTRACT(DAY FROM NOW() - COALESCE(last_accessed, NOW() - INTERVAL '30 days'));
  
  -- Calculate decay factor (exponential decay)
  decay_factor := EXP(-0.05 * days_since_access);
  
  -- Calculate access boost (logarithmic growth)
  access_boost := 1 + (LN(access_count + 1) * 0.1);
  
  -- Return adjusted importance
  RETURN LEAST(base_importance * decay_factor * access_boost, 1.0);
END;
$$ LANGUAGE plpgsql;

-- Update existing triggers for new tables
CREATE TRIGGER update_memory_connections_updated_at BEFORE UPDATE ON memory_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_memory_clusters_updated_at BEFORE UPDATE ON memory_clusters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_memory_preferences_updated_at BEFORE UPDATE ON agent_memory_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Validation for memory JSON structures (simplified for compatibility)
-- Note: Full JSON schema validation would be added when pg_jsonschema is properly available
ALTER TABLE ai_memories 
ADD CONSTRAINT check_memory_metadata_basic CHECK (
  metadata IS NOT NULL AND 
  jsonb_typeof(metadata) = 'object'
);