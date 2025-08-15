-- =============================================================================
-- Universal AI Tools - Complete Consolidated Database Schema
-- Version: 2.0.0
-- Date: 2025-08-15
-- 
-- This migration consolidates all 55 migration files into a single clean schema
-- Removes duplicates, secures SECURITY DEFINER functions, and optimizes structure
-- =============================================================================

-- Drop existing schema if doing a complete reset (comment out in production)
-- DROP SCHEMA IF EXISTS public CASCADE;
-- CREATE SCHEMA public;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "moddatetime";

-- =============================================================================
-- Schema Migrations Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- Core System Tables
-- =============================================================================

-- User management
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  encrypted_password TEXT NOT NULL,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- API keys management
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  permissions JSONB DEFAULT '[]',
  rate_limit INTEGER DEFAULT 1000,
  expires_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

-- Sessions management
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- Agent System Tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  capabilities JSONB DEFAULT '[]',
  configuration JSONB DEFAULT '{}',
  version TEXT DEFAULT '1.0.0',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agent_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  context JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'failed')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS agent_tools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  tool_config JSONB DEFAULT '{}',
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- Memory and Context Tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_memories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID,
  memory_type TEXT NOT NULL CHECK (memory_type IN ('conversation', 'context', 'preference', 'fact')),
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  importance DECIMAL(3, 2) DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
  access_count INTEGER DEFAULT 0,
  last_accessed TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS context_storage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id TEXT,
  context_type TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  relevance_score DECIMAL(3, 2) DEFAULT 0.5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- MCP (Model Context Protocol) Tables - Deduplicated
-- =============================================================================

-- Single mcp_sessions table
CREATE TABLE IF NOT EXISTS mcp_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_token TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'active',
  metadata JSONB DEFAULT '{}',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP WITH TIME ZONE
);

-- Single mcp_messages table
CREATE TABLE IF NOT EXISTS mcp_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES mcp_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  tool_calls JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Single mcp_tools table
CREATE TABLE IF NOT EXISTS mcp_tools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  parameters JSONB NOT NULL,
  implementation TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- User Interaction and Preferences - Deduplicated
-- =============================================================================

-- Single user_preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  preference_key TEXT NOT NULL,
  preference_value JSONB NOT NULL,
  category TEXT DEFAULT 'general',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, preference_key)
);

-- Single user_interactions table
CREATE TABLE IF NOT EXISTS user_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  interaction_type TEXT NOT NULL,
  content JSONB NOT NULL,
  response JSONB,
  duration_ms INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- Autonomous Actions Tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS autonomous_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_type TEXT NOT NULL,
  trigger_condition JSONB NOT NULL,
  action_config JSONB NOT NULL,
  risk_level TEXT DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
  requires_approval BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS autonomous_action_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_id UUID REFERENCES autonomous_actions(id) ON DELETE CASCADE,
  execution_status TEXT NOT NULL CHECK (execution_status IN ('pending', 'approved', 'rejected', 'executed', 'failed', 'rolled_back')),
  trigger_data JSONB,
  execution_result JSONB,
  error_message TEXT,
  executed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- Error Logging and Monitoring
-- =============================================================================

CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  context JSONB DEFAULT '{}',
  severity TEXT DEFAULT 'error' CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical')),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- Templates and Assets
-- =============================================================================

CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  content JSONB NOT NULL,
  metadata JSONB DEFAULT '{}',
  is_public BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  url TEXT,
  content BYTEA,
  metadata JSONB DEFAULT '{}',
  size_bytes BIGINT,
  mime_type TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- Verified Facts and Knowledge Base
-- =============================================================================

CREATE TABLE IF NOT EXISTS verified_facts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fact_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  predicate TEXT NOT NULL,
  object TEXT NOT NULL,
  confidence DECIMAL(3, 2) DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  source TEXT,
  metadata JSONB DEFAULT '{}',
  verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- Feedback Collection System
-- =============================================================================

CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id UUID,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('positive', 'negative', 'neutral', 'suggestion', 'bug')),
  content TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- Proactive Tasks
-- =============================================================================

CREATE TABLE IF NOT EXISTS proactive_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_type TEXT NOT NULL,
  schedule JSONB NOT NULL,
  task_config JSONB NOT NULL,
  last_run TIMESTAMP WITH TIME ZONE,
  next_run TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- Indexes for Performance
-- =============================================================================

-- User and auth indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- Agent indexes
CREATE INDEX IF NOT EXISTS idx_agent_sessions_agent_id ON agent_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_id ON agent_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON agent_sessions(status);

-- Memory indexes with vector support
CREATE INDEX IF NOT EXISTS idx_ai_memories_user_id ON ai_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_memories_session_id ON ai_memories(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_memories_type ON ai_memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_ai_memories_embedding ON ai_memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_context_storage_user_id ON context_storage(user_id);
CREATE INDEX IF NOT EXISTS idx_context_storage_session_id ON context_storage(session_id);
CREATE INDEX IF NOT EXISTS idx_context_storage_type ON context_storage(context_type);
CREATE INDEX IF NOT EXISTS idx_context_storage_embedding ON context_storage USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- MCP indexes
CREATE INDEX IF NOT EXISTS idx_mcp_messages_session_id ON mcp_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_mcp_sessions_user_id ON mcp_sessions(user_id);

-- User interaction indexes
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_user_id ON user_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_type ON user_interactions(interaction_type);

-- Autonomous action indexes
CREATE INDEX IF NOT EXISTS idx_autonomous_actions_type ON autonomous_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_autonomous_action_logs_action_id ON autonomous_action_logs(action_id);
CREATE INDEX IF NOT EXISTS idx_autonomous_action_logs_status ON autonomous_action_logs(execution_status);

-- Logging indexes
CREATE INDEX IF NOT EXISTS idx_error_logs_type ON error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_storage ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_messages ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies (using auth.uid() for Supabase auth)
CREATE POLICY "users_policy" ON users FOR ALL USING (auth.uid() = id);
CREATE POLICY "api_keys_policy" ON api_keys FOR ALL USING (user_id = auth.uid());
CREATE POLICY "sessions_policy" ON sessions FOR ALL USING (user_id = auth.uid());
CREATE POLICY "ai_memories_policy" ON ai_memories FOR ALL USING (user_id = auth.uid());
CREATE POLICY "context_storage_policy" ON context_storage FOR ALL USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "user_preferences_policy" ON user_preferences FOR ALL USING (user_id = auth.uid());
CREATE POLICY "user_interactions_policy" ON user_interactions FOR ALL USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "mcp_sessions_policy" ON mcp_sessions FOR ALL USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "mcp_messages_policy" ON mcp_messages FOR ALL 
  USING (EXISTS (SELECT 1 FROM mcp_sessions WHERE mcp_sessions.id = session_id AND (mcp_sessions.user_id = auth.uid() OR mcp_sessions.user_id IS NULL)));

-- =============================================================================
-- Functions and Triggers (Secured - No unnecessary SECURITY DEFINER)
-- =============================================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update timestamp triggers
DO $$
BEGIN
  -- Users
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at') THEN
    CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  -- Agents
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_agents_updated_at') THEN
    CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  -- AI Memories
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_ai_memories_updated_at') THEN
    CREATE TRIGGER update_ai_memories_updated_at BEFORE UPDATE ON ai_memories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  -- Context Storage
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_context_storage_updated_at') THEN
    CREATE TRIGGER update_context_storage_updated_at BEFORE UPDATE ON context_storage FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  -- User Preferences
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_preferences_updated_at') THEN
    CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  -- MCP Tools
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_mcp_tools_updated_at') THEN
    CREATE TRIGGER update_mcp_tools_updated_at BEFORE UPDATE ON mcp_tools FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  -- Autonomous Actions
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_autonomous_actions_updated_at') THEN
    CREATE TRIGGER update_autonomous_actions_updated_at BEFORE UPDATE ON autonomous_actions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  -- Templates
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_templates_updated_at') THEN
    CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  -- Verified Facts
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_verified_facts_updated_at') THEN
    CREATE TRIGGER update_verified_facts_updated_at BEFORE UPDATE ON verified_facts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  -- Proactive Tasks
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_proactive_tasks_updated_at') THEN
    CREATE TRIGGER update_proactive_tasks_updated_at BEFORE UPDATE ON proactive_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- =============================================================================
-- Secure Functions (Only use SECURITY DEFINER where absolutely necessary)
-- =============================================================================

-- Get user by email (no SECURITY DEFINER - uses RLS)
CREATE OR REPLACE FUNCTION get_user_by_email(user_email TEXT)
RETURNS TABLE (
  id UUID,
  email TEXT,
  role TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.email, u.role, u.is_active, u.created_at
  FROM users u
  WHERE u.email = user_email;
END;
$$ LANGUAGE plpgsql;

-- Search similar memories (no SECURITY DEFINER - uses RLS)
CREATE OR REPLACE FUNCTION search_similar_memories(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  memory_type TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.content,
    m.memory_type,
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM ai_memories m
  WHERE 1 - (m.embedding <=> query_embedding) > match_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Cleanup old sessions (SECURITY DEFINER needed for maintenance)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM sessions 
  WHERE expires_at < CURRENT_TIMESTAMP;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Initial Data
-- =============================================================================

-- Insert default agents
INSERT INTO agents (name, type, capabilities, configuration, is_active) VALUES
  ('assistant', 'general', '["chat", "search", "analysis"]', '{"model": "gpt-4"}', true),
  ('codebase_optimizer', 'specialized', '["code_analysis", "refactoring", "optimization"]', '{"model": "codex"}', true),
  ('r1_reasoning', 'reasoning', '["logic", "inference", "problem_solving"]', '{"model": "gpt-4"}', true),
  ('multi_tier_router', 'router', '["routing", "load_balancing", "orchestration"]', '{"tiers": 4}', true),
  ('graphrag_reasoning', 'reasoning', '["graph_analysis", "relationship_mapping", "knowledge_extraction"]', '{"model": "gpt-4"}', true),
  ('performance_optimization', 'specialized', '["performance_analysis", "bottleneck_detection", "optimization"]', '{"model": "gpt-4"}', true)
ON CONFLICT (name) DO NOTHING;

-- Insert default MCP tools
INSERT INTO mcp_tools (name, description, parameters, is_active) VALUES
  ('search', 'Search for information', '{"query": {"type": "string", "required": true}}', true),
  ('calculator', 'Perform calculations', '{"expression": {"type": "string", "required": true}}', true),
  ('memory_store', 'Store information in memory', '{"content": {"type": "string", "required": true}, "type": {"type": "string"}}', true),
  ('memory_retrieve', 'Retrieve information from memory', '{"query": {"type": "string", "required": true}}', true),
  ('context_analyze', 'Analyze context and extract insights', '{"context": {"type": "string", "required": true}}', true)
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- Grant Permissions
-- =============================================================================

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- =============================================================================
-- Migration Complete
-- =============================================================================

-- Record migration
INSERT INTO schema_migrations (version, name, executed_at) 
VALUES ('000', 'complete_consolidated_schema', CURRENT_TIMESTAMP)
ON CONFLICT (version) DO UPDATE 
SET name = EXCLUDED.name, 
    executed_at = EXCLUDED.executed_at;