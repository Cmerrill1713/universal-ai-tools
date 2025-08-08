-- =====================================================
-- Rollback script for consolidated schema
-- =====================================================

-- Remove scheduled jobs (if pg_cron exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
        DELETE FROM cron.job WHERE jobname IN ('cleanup-old-memories', 'cleanup-old-metrics');
    END IF;
END $$;

-- Drop policies (only if tables exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_memories') THEN
        DROP POLICY IF EXISTS "Users can view their own memories" ON ai_memories;
        DROP POLICY IF EXISTS "Users can create their own memories" ON ai_memories;
        DROP POLICY IF EXISTS "Users can update their own memories" ON ai_memories;
        DROP POLICY IF EXISTS "Users can delete their own memories" ON ai_memories;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'knowledge_sources') THEN
        DROP POLICY IF EXISTS "Users can view their own knowledge" ON knowledge_sources;
        DROP POLICY IF EXISTS "Users can create knowledge" ON knowledge_sources;
        DROP POLICY IF EXISTS "Users can update their own knowledge" ON knowledge_sources;
        DROP POLICY IF EXISTS "Users can delete their own knowledge" ON knowledge_sources;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks') THEN
        DROP POLICY IF EXISTS "Users can view their own tasks" ON tasks;
        DROP POLICY IF EXISTS "Users can create their own tasks" ON tasks;
        DROP POLICY IF EXISTS "Users can update their own tasks" ON tasks;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mlx_fine_tuning_jobs') THEN
        DROP POLICY IF EXISTS "Users can view their own fine-tuning jobs" ON mlx_fine_tuning_jobs;
        DROP POLICY IF EXISTS "Users can create their own fine-tuning jobs" ON mlx_fine_tuning_jobs;
    END IF;
END $$;

-- Drop triggers
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
DROP FUNCTION IF EXISTS search_similar_memories(vector, integer, float);
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop tables (in reverse order of dependencies)
DROP TABLE IF EXISTS webhook_events CASCADE;
DROP TABLE IF EXISTS api_secrets CASCADE;
DROP TABLE IF EXISTS alpha_evolve_experiments CASCADE;
DROP TABLE IF EXISTS self_improvement_logs CASCADE;
DROP TABLE IF EXISTS intelligent_parameters CASCADE;
DROP TABLE IF EXISTS mlx_fine_tuning_jobs CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS agent_performance_metrics CASCADE;
DROP TABLE IF EXISTS agents CASCADE;
DROP TABLE IF EXISTS knowledge_sources CASCADE;
DROP TABLE IF EXISTS ai_memories CASCADE;
DROP TABLE IF EXISTS ai_service_keys CASCADE;

-- Drop types
DROP TYPE IF EXISTS model_status CASCADE;
DROP TYPE IF EXISTS task_priority CASCADE;
DROP TYPE IF EXISTS task_status CASCADE;
DROP TYPE IF EXISTS agent_status CASCADE;

-- Note: Extensions are not dropped as they may be used by other schemas
