-- Universal AI Tools - Rollback Script
-- Reverts from unified schema (v3) back to v2
-- USE WITH CAUTION - This will drop all v3 tables

-- =====================================================
-- SAFETY CHECK
-- =====================================================

DO $$
BEGIN
  -- Confirm this is intentional
  IF NOT EXISTS (
    SELECT 1 FROM schema_migrations 
    WHERE version = '003' 
    AND name = 'unified_production_schema'
  ) THEN
    RAISE EXCEPTION 'Cannot rollback - v3 schema not found';
  END IF;
  
  RAISE NOTICE 'WARNING: This will DROP all v3 tables and data!';
  RAISE NOTICE 'Make sure you have backed up any important data';
  -- Uncomment the line below to proceed with rollback
  -- RAISE NOTICE 'Proceeding with rollback...';
  RAISE EXCEPTION 'Rollback safety check - uncomment line 19 to proceed';
END $$;

-- =====================================================
-- DROP V3 TABLES
-- =====================================================

-- Drop policies first
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own memories" ON memories;
DROP POLICY IF EXISTS "Users can create own memories" ON memories;
DROP POLICY IF EXISTS "Users can update own memories" ON memories;
DROP POLICY IF EXISTS "Users can delete own memories" ON memories;
DROP POLICY IF EXISTS "Anyone can view public widgets" ON widgets;
DROP POLICY IF EXISTS "Creators can manage own widgets" ON widgets;
DROP POLICY IF EXISTS "Users can view own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can create own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update own tasks" ON tasks;

-- Drop service role policies
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
    EXECUTE format('DROP POLICY IF EXISTS "Service role has full access to %I" ON %I', t, t);
  END LOOP;
END $$;

-- Drop triggers
DROP TRIGGER IF EXISTS update_widget_stars ON widget_likes;
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
    EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON %I', t, t);
  END LOOP;
END $$;

-- Drop functions
DROP FUNCTION IF EXISTS search_memories(vector(1536), FLOAT, INT, UUID);
DROP FUNCTION IF EXISTS search_knowledge(vector(1536), FLOAT, INT, knowledge_status);
DROP FUNCTION IF EXISTS get_agent_performance_summary(UUID, INTEGER);
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS update_widget_star_count();

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS sweet_athena_states CASCADE;
DROP TABLE IF EXISTS mcp_agents CASCADE;
DROP TABLE IF EXISTS alpha_evolve_iterations CASCADE;
DROP TABLE IF EXISTS resource_permissions CASCADE;
DROP TABLE IF EXISTS job_queue CASCADE;
DROP TABLE IF EXISTS storage_objects CASCADE;
DROP TABLE IF EXISTS task_executions CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS knowledge_relationships CASCADE;
DROP TABLE IF EXISTS knowledge_base CASCADE;
DROP TABLE IF EXISTS widget_comments CASCADE;
DROP TABLE IF EXISTS widget_likes CASCADE;
DROP TABLE IF EXISTS widget_versions CASCADE;
DROP TABLE IF EXISTS widgets CASCADE;
DROP TABLE IF EXISTS memory_associations CASCADE;
DROP TABLE IF EXISTS memories CASCADE;
DROP TABLE IF EXISTS agent_performance_metrics CASCADE;
DROP TABLE IF EXISTS agent_capabilities_registry CASCADE;
DROP TABLE IF EXISTS agents CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS api_keys CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- Drop types
DROP TYPE IF EXISTS permission_level CASCADE;
DROP TYPE IF EXISTS resource_type CASCADE;
DROP TYPE IF EXISTS job_status CASCADE;
DROP TYPE IF EXISTS widget_category CASCADE;
DROP TYPE IF EXISTS widget_status CASCADE;
DROP TYPE IF EXISTS knowledge_type CASCADE;
DROP TYPE IF EXISTS knowledge_status CASCADE;
DROP TYPE IF EXISTS memory_importance CASCADE;
DROP TYPE IF EXISTS memory_type CASCADE;
DROP TYPE IF EXISTS agent_capability CASCADE;
DROP TYPE IF EXISTS task_priority CASCADE;
DROP TYPE IF EXISTS task_status CASCADE;
DROP TYPE IF EXISTS agent_status CASCADE;

-- =====================================================
-- REMOVE MIGRATION RECORD
-- =====================================================

DELETE FROM schema_migrations WHERE version IN ('003', '004');

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE 'Rollback completed successfully';
  RAISE NOTICE 'Database has been reverted to v2 schema';
  RAISE NOTICE 'You may now run 002_production_schema_fixed.sql if needed';
END $$;