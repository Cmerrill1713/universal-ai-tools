-- =============================================================================
-- Universal AI Tools - Complete Schema Rollback
-- Version: 2.0.0
-- Date: 2025-08-15
-- 
-- This script safely rolls back the consolidated schema
-- =============================================================================

-- Disable foreign key checks temporarily
SET session_replication_role = 'replica';

-- =============================================================================
-- Drop all policies first (to avoid dependencies)
-- =============================================================================

DROP POLICY IF EXISTS "mcp_messages_policy" ON mcp_messages;
DROP POLICY IF EXISTS "mcp_sessions_policy" ON mcp_sessions;
DROP POLICY IF EXISTS "user_interactions_policy" ON user_interactions;
DROP POLICY IF EXISTS "user_preferences_policy" ON user_preferences;
DROP POLICY IF EXISTS "context_storage_policy" ON context_storage;
DROP POLICY IF EXISTS "ai_memories_policy" ON ai_memories;
DROP POLICY IF EXISTS "sessions_policy" ON sessions;
DROP POLICY IF EXISTS "api_keys_policy" ON api_keys;
DROP POLICY IF EXISTS "users_policy" ON users;

-- =============================================================================
-- Drop all triggers
-- =============================================================================

DROP TRIGGER IF EXISTS update_proactive_tasks_updated_at ON proactive_tasks;
DROP TRIGGER IF EXISTS update_verified_facts_updated_at ON verified_facts;
DROP TRIGGER IF EXISTS update_templates_updated_at ON templates;
DROP TRIGGER IF EXISTS update_autonomous_actions_updated_at ON autonomous_actions;
DROP TRIGGER IF EXISTS update_mcp_tools_updated_at ON mcp_tools;
DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
DROP TRIGGER IF EXISTS update_context_storage_updated_at ON context_storage;
DROP TRIGGER IF EXISTS update_ai_memories_updated_at ON ai_memories;
DROP TRIGGER IF EXISTS update_agents_updated_at ON agents;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;

-- =============================================================================
-- Drop all functions
-- =============================================================================

DROP FUNCTION IF EXISTS cleanup_expired_sessions();
DROP FUNCTION IF EXISTS search_similar_memories(vector(1536), FLOAT, INT);
DROP FUNCTION IF EXISTS get_user_by_email(TEXT);
DROP FUNCTION IF EXISTS update_updated_at_column();

-- =============================================================================
-- Drop all indexes
-- =============================================================================

DROP INDEX IF EXISTS idx_audit_logs_action;
DROP INDEX IF EXISTS idx_audit_logs_user_id;
DROP INDEX IF EXISTS idx_error_logs_user_id;
DROP INDEX IF EXISTS idx_error_logs_severity;
DROP INDEX IF EXISTS idx_error_logs_type;
DROP INDEX IF EXISTS idx_autonomous_action_logs_status;
DROP INDEX IF EXISTS idx_autonomous_action_logs_action_id;
DROP INDEX IF EXISTS idx_autonomous_actions_type;
DROP INDEX IF EXISTS idx_user_interactions_type;
DROP INDEX IF EXISTS idx_user_interactions_user_id;
DROP INDEX IF EXISTS idx_user_preferences_user_id;
DROP INDEX IF EXISTS idx_mcp_sessions_user_id;
DROP INDEX IF EXISTS idx_mcp_messages_session_id;
DROP INDEX IF EXISTS idx_context_storage_embedding;
DROP INDEX IF EXISTS idx_context_storage_type;
DROP INDEX IF EXISTS idx_context_storage_session_id;
DROP INDEX IF EXISTS idx_context_storage_user_id;
DROP INDEX IF EXISTS idx_ai_memories_embedding;
DROP INDEX IF EXISTS idx_ai_memories_type;
DROP INDEX IF EXISTS idx_ai_memories_session_id;
DROP INDEX IF EXISTS idx_ai_memories_user_id;
DROP INDEX IF EXISTS idx_agent_sessions_status;
DROP INDEX IF EXISTS idx_agent_sessions_user_id;
DROP INDEX IF EXISTS idx_agent_sessions_agent_id;
DROP INDEX IF EXISTS idx_sessions_user_id;
DROP INDEX IF EXISTS idx_sessions_token;
DROP INDEX IF EXISTS idx_api_keys_key_hash;
DROP INDEX IF EXISTS idx_api_keys_user_id;
DROP INDEX IF EXISTS idx_users_email;

-- =============================================================================
-- Drop all tables in correct order (respecting foreign keys)
-- =============================================================================

-- Drop dependent tables first
DROP TABLE IF EXISTS proactive_tasks CASCADE;
DROP TABLE IF EXISTS feedback CASCADE;
DROP TABLE IF EXISTS verified_facts CASCADE;
DROP TABLE IF EXISTS assets CASCADE;
DROP TABLE IF EXISTS templates CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS error_logs CASCADE;
DROP TABLE IF EXISTS autonomous_action_logs CASCADE;
DROP TABLE IF EXISTS autonomous_actions CASCADE;
DROP TABLE IF EXISTS user_interactions CASCADE;
DROP TABLE IF EXISTS user_preferences CASCADE;
DROP TABLE IF EXISTS mcp_messages CASCADE;
DROP TABLE IF EXISTS mcp_tools CASCADE;
DROP TABLE IF EXISTS mcp_sessions CASCADE;
DROP TABLE IF EXISTS context_storage CASCADE;
DROP TABLE IF EXISTS ai_memories CASCADE;
DROP TABLE IF EXISTS agent_tools CASCADE;
DROP TABLE IF EXISTS agent_sessions CASCADE;
DROP TABLE IF EXISTS agents CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS api_keys CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS schema_migrations CASCADE;

-- =============================================================================
-- Re-enable foreign key checks
-- =============================================================================

SET session_replication_role = 'origin';

-- =============================================================================
-- Verification
-- =============================================================================

DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name NOT LIKE 'pg_%';
    
  IF table_count > 0 THEN
    RAISE NOTICE 'Warning: % tables still exist after rollback', table_count;
  ELSE
    RAISE NOTICE 'Rollback completed successfully - all tables removed';
  END IF;
END $$;