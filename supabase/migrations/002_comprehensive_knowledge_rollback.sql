-- =====================================================
-- Rollback script for comprehensive knowledge system
-- =====================================================

-- Remove scheduled jobs
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.unschedule('cleanup-expired-cache');
    END IF;
END $$;

-- Drop policies
DO $$
BEGIN
    -- Documents policies
    DROP POLICY IF EXISTS "Users can view their own documents" ON documents;
    DROP POLICY IF EXISTS "Users can create their own documents" ON documents;
    DROP POLICY IF EXISTS "Users can update their own documents" ON documents;
    DROP POLICY IF EXISTS "Users can delete their own documents" ON documents;
    
    -- Conversation policies
    DROP POLICY IF EXISTS "Users can view their own conversations" ON conversation_threads;
    DROP POLICY IF EXISTS "Users can create their own conversations" ON conversation_threads;
    
    -- Model inference policies
    DROP POLICY IF EXISTS "Users can view their own inferences" ON model_inferences;
EXCEPTION
    WHEN undefined_table THEN NULL;
END $$;

-- Drop triggers
DROP TRIGGER IF EXISTS update_knowledge_search_vector ON knowledge_sources;
DROP TRIGGER IF EXISTS update_documents_search_vector ON documents;
DROP TRIGGER IF EXISTS update_messages_search_vector ON conversation_messages;

-- Drop functions
DROP FUNCTION IF EXISTS hybrid_search(TEXT, vector, TEXT[], INTEGER, REAL);
DROP FUNCTION IF EXISTS update_search_vector();
DROP FUNCTION IF EXISTS set_cache_value(TEXT, JSONB, INTEGER);
DROP FUNCTION IF EXISTS get_cache_value(TEXT);

-- Drop tables (in reverse order of dependencies)
DROP TABLE IF EXISTS workflow_executions CASCADE;
DROP TABLE IF EXISTS workflows CASCADE;
DROP TABLE IF EXISTS model_metrics CASCADE;
DROP TABLE IF EXISTS model_inferences CASCADE;
DROP TABLE IF EXISTS knowledge_edges CASCADE;
DROP TABLE IF EXISTS knowledge_nodes CASCADE;
DROP TABLE IF EXISTS training_examples CASCADE;
DROP TABLE IF EXISTS training_datasets CASCADE;
DROP TABLE IF EXISTS conversation_messages CASCADE;
DROP TABLE IF EXISTS conversation_threads CASCADE;
DROP TABLE IF EXISTS binary_objects CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS cache_entries CASCADE;

-- Note: This doesn't remove the search_vector columns from existing tables
-- as they might be used by other migrations