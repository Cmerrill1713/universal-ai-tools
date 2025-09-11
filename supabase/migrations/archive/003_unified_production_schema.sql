-- Universal AI Tools - Unified Production Schema v3.0
-- This is a consolidated, conflict-free production schema
-- Combines all features from previous migrations with proper structure

-- =====================================================
-- 1. EXTENSIONS
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "http" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA extensions;

-- =====================================================
-- 2. CUSTOM TYPES & ENUMS
-- =====================================================

-- Core enums
CREATE TYPE agent_status AS ENUM ('active', 'inactive', 'deprecated', 'testing');
CREATE TYPE task_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled', 'timeout');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE agent_capability AS ENUM (
  'text_generation', 'code_generation', 'data_analysis', 'web_scraping',
  'file_management', 'api_integration', 'task_planning', 'memory_management'
);

-- Memory and knowledge types
CREATE TYPE memory_type AS ENUM ('conversation', 'fact', 'experience', 'reflection', 'plan');
CREATE TYPE memory_importance AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE knowledge_status AS ENUM ('draft', 'active', 'archived', 'deprecated');
CREATE TYPE knowledge_type AS ENUM ('documentation', 'tutorial', 'reference', 'example', 'concept');

-- Widget types
CREATE TYPE widget_status AS ENUM ('draft', 'published', 'archived', 'flagged');
CREATE TYPE widget_category AS ENUM (
  'analytics', 'visualization', 'form', 'display', 'integration', 
  'automation', 'communication', 'utility', 'ai_powered'
);

-- Enhanced feature types
CREATE TYPE job_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
CREATE TYPE resource_type AS ENUM ('agent', 'model', 'api', 'database', 'storage', 'compute');
CREATE TYPE permission_level AS ENUM ('none', 'read', 'write', 'admin');

-- =====================================================
-- 3. CORE TABLES - User Management
-- =====================================================

-- User profiles extending Supabase auth
CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- API key management
CREATE TABLE api_keys (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  permissions JSONB DEFAULT '{}',
  rate_limit_config JSONB DEFAULT '{"requests_per_minute": 60}',
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Session management
CREATE TABLE user_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token TEXT UNIQUE NOT NULL,
  refresh_token TEXT UNIQUE,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. AI AGENT SYSTEM
-- =====================================================

-- Agent definitions
CREATE TABLE agents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  type TEXT NOT NULL,
  capabilities agent_capability[] DEFAULT '{}',
  configuration JSONB DEFAULT '{}',
  version TEXT DEFAULT '1.0.0',
  status agent_status DEFAULT 'active',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent capabilities registry
CREATE TABLE agent_capabilities_registry (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  capability agent_capability NOT NULL,
  configuration JSONB DEFAULT '{}',
  performance_metrics JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, capability)
);

-- Performance tracking
CREATE TABLE agent_performance_metrics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  task_id UUID,
  execution_time_ms INTEGER,
  success BOOLEAN,
  error_message TEXT,
  resource_usage JSONB,
  quality_score FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_performance_agent_id ON agent_performance_metrics(agent_id);
CREATE INDEX idx_agent_performance_created_at ON agent_performance_metrics(created_at);

-- =====================================================
-- 5. UNIFIED MEMORY SYSTEM
-- =====================================================

-- Main memories table with vector support
CREATE TABLE memories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id),
  type memory_type NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536), -- Standardized on OpenAI dimension
  importance memory_importance DEFAULT 'medium',
  metadata JSONB DEFAULT '{}',
  access_count INTEGER DEFAULT 0,
  last_accessed TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_memories_user_id ON memories(user_id);
CREATE INDEX idx_memories_agent_id ON memories(agent_id);
CREATE INDEX idx_memories_embedding ON memories USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_memories_type ON memories(type);
CREATE INDEX idx_memories_importance ON memories(importance);

-- Memory associations
CREATE TABLE memory_associations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  source_memory_id UUID REFERENCES memories(id) ON DELETE CASCADE,
  target_memory_id UUID REFERENCES memories(id) ON DELETE CASCADE,
  association_type TEXT NOT NULL,
  strength FLOAT DEFAULT 0.5 CHECK (strength >= 0 AND strength <= 1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_memory_id, target_memory_id, association_type)
);

-- =====================================================
-- 6. UNIFIED WIDGET SYSTEM
-- =====================================================

-- Main widgets table
CREATE TABLE widgets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  creator_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  description TEXT,
  category widget_category NOT NULL,
  type TEXT NOT NULL,
  configuration JSONB DEFAULT '{}',
  code TEXT,
  preview_url TEXT,
  icon TEXT,
  tags TEXT[] DEFAULT '{}',
  version TEXT DEFAULT '1.0.0',
  status widget_status DEFAULT 'draft',
  is_public BOOLEAN DEFAULT false,
  install_count INTEGER DEFAULT 0,
  star_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_widgets_creator ON widgets(creator_id);
CREATE INDEX idx_widgets_category ON widgets(category);
CREATE INDEX idx_widgets_status ON widgets(status);
CREATE INDEX idx_widgets_tags ON widgets USING gin(tags);

-- Widget versioning
CREATE TABLE widget_versions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  widget_id UUID REFERENCES widgets(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  changes TEXT,
  configuration JSONB,
  code TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(widget_id, version)
);

-- Widget interactions
CREATE TABLE widget_likes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  widget_id UUID REFERENCES widgets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(widget_id, user_id)
);

CREATE TABLE widget_comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  widget_id UUID REFERENCES widgets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES widget_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 7. KNOWLEDGE MANAGEMENT
-- =====================================================

-- Knowledge base
CREATE TABLE knowledge_base (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type knowledge_type NOT NULL,
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  source_url TEXT,
  status knowledge_status DEFAULT 'draft',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_knowledge_embedding ON knowledge_base USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_knowledge_status ON knowledge_base(status);
CREATE INDEX idx_knowledge_type ON knowledge_base(type);
CREATE INDEX idx_knowledge_tags ON knowledge_base USING gin(tags);

-- Knowledge relationships
CREATE TABLE knowledge_relationships (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  source_id UUID REFERENCES knowledge_base(id) ON DELETE CASCADE,
  target_id UUID REFERENCES knowledge_base(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_id, target_id, relationship_type)
);

-- =====================================================
-- 8. TASK & WORKFLOW MANAGEMENT
-- =====================================================

-- Tasks
CREATE TABLE tasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  agent_id UUID REFERENCES agents(id),
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL,
  priority task_priority DEFAULT 'medium',
  status task_status DEFAULT 'pending',
  configuration JSONB DEFAULT '{}',
  dependencies UUID[] DEFAULT '{}',
  result JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  timeout_seconds INTEGER DEFAULT 300,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_agent ON tasks(agent_id);
CREATE INDEX idx_tasks_user ON tasks(user_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);

-- Task execution history
CREATE TABLE task_executions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id),
  status task_status NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  execution_time_ms INTEGER,
  input JSONB,
  output JSONB,
  error JSONB,
  logs TEXT[],
  resource_usage JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 9. ENHANCED FEATURES
-- =====================================================

-- Storage integration
CREATE TABLE storage_objects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  bucket_name TEXT NOT NULL,
  object_path TEXT NOT NULL,
  content_type TEXT,
  size_bytes BIGINT,
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bucket_name, object_path)
);

-- Job queue system
CREATE TABLE job_queue (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  queue_name TEXT NOT NULL DEFAULT 'default',
  payload JSONB NOT NULL,
  status job_status DEFAULT 'pending',
  priority INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_job_queue_status ON job_queue(status);
CREATE INDEX idx_job_queue_scheduled ON job_queue(scheduled_for);

-- Resource permissions
CREATE TABLE resource_permissions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  resource_type resource_type NOT NULL,
  resource_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_level permission_level NOT NULL,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  UNIQUE(resource_type, resource_id, user_id)
);

-- =====================================================
-- 10. SPECIALIZED SYSTEMS
-- =====================================================

-- Alpha Evolve System
CREATE TABLE alpha_evolve_iterations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  iteration_number INTEGER NOT NULL,
  parent_iteration_id UUID REFERENCES alpha_evolve_iterations(id),
  model_config JSONB NOT NULL,
  training_data JSONB,
  performance_metrics JSONB NOT NULL,
  improvement_delta FLOAT,
  is_best_performer BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MCP Agent Integration
CREATE TABLE mcp_agents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  protocol_version TEXT NOT NULL,
  capabilities JSONB NOT NULL,
  connection_config JSONB NOT NULL,
  status TEXT DEFAULT 'disconnected',
  last_heartbeat TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sweet Athena System
CREATE TABLE sweet_athena_states (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  personality_mode TEXT NOT NULL DEFAULT 'friendly',
  emotion_state JSONB DEFAULT '{"happiness": 0.7, "energy": 0.8}',
  conversation_context JSONB DEFAULT '{}',
  visual_state JSONB DEFAULT '{}',
  last_interaction TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 11. FUNCTIONS (ALL SECURITY INVOKER)
-- =====================================================

-- Vector similarity search for memories
CREATE OR REPLACE FUNCTION search_memories(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  type memory_type,
  importance memory_importance,
  similarity FLOAT,
  metadata JSONB
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.content,
    m.type,
    m.importance,
    1 - (m.embedding <=> query_embedding) AS similarity,
    m.metadata
  FROM memories m
  WHERE 
    (p_user_id IS NULL OR m.user_id = p_user_id)
    AND 1 - (m.embedding <=> query_embedding) > match_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Vector similarity search for knowledge
CREATE OR REPLACE FUNCTION search_knowledge(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10,
  p_status knowledge_status DEFAULT 'active'
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  type knowledge_type,
  similarity FLOAT,
  metadata JSONB
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    k.id,
    k.title,
    k.content,
    k.type,
    1 - (k.embedding <=> query_embedding) AS similarity,
    k.metadata
  FROM knowledge_base k
  WHERE 
    k.status = p_status
    AND 1 - (k.embedding <=> query_embedding) > match_threshold
  ORDER BY k.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Get agent performance summary
CREATE OR REPLACE FUNCTION get_agent_performance_summary(
  p_agent_id UUID,
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  total_tasks INTEGER,
  successful_tasks INTEGER,
  failed_tasks INTEGER,
  average_execution_time_ms FLOAT,
  success_rate FLOAT,
  average_quality_score FLOAT
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER AS total_tasks,
    SUM(CASE WHEN success THEN 1 ELSE 0 END)::INTEGER AS successful_tasks,
    SUM(CASE WHEN NOT success THEN 1 ELSE 0 END)::INTEGER AS failed_tasks,
    AVG(execution_time_ms)::FLOAT AS average_execution_time_ms,
    (SUM(CASE WHEN success THEN 1 ELSE 0 END)::FLOAT / NULLIF(COUNT(*), 0))::FLOAT AS success_rate,
    AVG(quality_score)::FLOAT AS average_quality_score
  FROM agent_performance_metrics
  WHERE 
    agent_id = p_agent_id
    AND created_at >= NOW() - INTERVAL '1 day' * p_days;
END;
$$;

-- =====================================================
-- 12. TRIGGERS
-- =====================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update trigger to all tables with updated_at
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN 
    SELECT table_name 
    FROM information_schema.columns 
    WHERE column_name = 'updated_at' 
    AND table_schema = 'public'
  LOOP
    EXECUTE format('CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON %I 
                    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t, t);
  END LOOP;
END $$;

-- Update widget star count
CREATE OR REPLACE FUNCTION update_widget_star_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE widgets SET star_count = star_count + 1 WHERE id = NEW.widget_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE widgets SET star_count = star_count - 1 WHERE id = OLD.widget_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_widget_stars
AFTER INSERT OR DELETE ON widget_likes
FOR EACH ROW EXECUTE FUNCTION update_widget_star_count();

-- =====================================================
-- 13. ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on all tables
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN 
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- User profiles policies
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Memories policies
CREATE POLICY "Users can view own memories" ON memories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own memories" ON memories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own memories" ON memories
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own memories" ON memories
  FOR DELETE USING (auth.uid() = user_id);

-- Widgets policies
CREATE POLICY "Anyone can view public widgets" ON widgets
  FOR SELECT USING (is_public = true);

CREATE POLICY "Creators can manage own widgets" ON widgets
  FOR ALL USING (auth.uid() = creator_id);

-- Tasks policies
CREATE POLICY "Users can view own tasks" ON tasks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own tasks" ON tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks" ON tasks
  FOR UPDATE USING (auth.uid() = user_id);

-- Service role bypass for all tables (for backend operations)
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN 
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('CREATE POLICY "Service role has full access to %I" ON %I 
                    FOR ALL TO service_role USING (true)', t, t);
  END LOOP;
END $$;

-- =====================================================
-- 14. INDEXES FOR PERFORMANCE
-- =====================================================

-- Text search indexes
CREATE INDEX idx_widgets_search ON widgets USING gin(
  to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))
);

CREATE INDEX idx_knowledge_search ON knowledge_base USING gin(
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))
);

-- JSONB indexes
CREATE INDEX idx_memories_metadata ON memories USING gin(metadata);
CREATE INDEX idx_tasks_configuration ON tasks USING gin(configuration);
CREATE INDEX idx_widgets_configuration ON widgets USING gin(configuration);

-- Performance indexes
CREATE INDEX idx_task_executions_task_id ON task_executions(task_id);
CREATE INDEX idx_widget_versions_widget_id ON widget_versions(widget_id);
CREATE INDEX idx_memory_associations_source ON memory_associations(source_memory_id);
CREATE INDEX idx_memory_associations_target ON memory_associations(target_memory_id);

-- =====================================================
-- 15. INITIAL DATA (OPTIONAL)
-- =====================================================

-- Insert default agents
INSERT INTO agents (name, description, type, capabilities, status) VALUES
  ('Universal Assistant', 'General-purpose AI assistant', 'general', 
   ARRAY['text_generation', 'task_planning', 'memory_management']::agent_capability[], 'active'),
  ('Code Assistant', 'Specialized coding assistant', 'specialized', 
   ARRAY['code_generation', 'data_analysis', 'api_integration']::agent_capability[], 'active'),
  ('Research Assistant', 'Web research and data gathering', 'specialized', 
   ARRAY['web_scraping', 'data_analysis', 'memory_management']::agent_capability[], 'active')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 16. MIGRATION COMPLETION
-- =====================================================

-- Mark migration as complete
INSERT INTO schema_migrations (version, name, executed_at) VALUES
  ('003', 'unified_production_schema', NOW())
ON CONFLICT DO NOTHING;