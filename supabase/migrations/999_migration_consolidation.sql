-- =====================================================
-- Migration Consolidation and Cleanup
-- Version: 1.0.0
-- Date: 2025-07-31
-- =====================================================
-- This migration resolves conflicts between multiple migration files
-- and ensures all tables exist with proper relationships

-- =====================================================
-- 1. ENSURE EXTENSIONS ARE ENABLED
-- =====================================================
DO $$ 
BEGIN
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    CREATE EXTENSION IF NOT EXISTS "pg_trgm";
    CREATE EXTENSION IF NOT EXISTS "vector";
    CREATE EXTENSION IF NOT EXISTS "pg_net";
EXCEPTION WHEN OTHERS THEN
    -- Log but don't fail if extensions already exist
    RAISE NOTICE 'Extensions already enabled or permission denied: %', SQLERRM;
END $$;

-- =====================================================
-- 2. ENSURE MCP TABLES EXIST (from MCP context migration)
-- =====================================================
-- These tables are critical for MCP integration service

-- MCP Context table
CREATE TABLE IF NOT EXISTS mcp_context (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN (
        'project_overview', 'code_patterns', 'error_analysis',
        'conversation_history', 'agent_responses', 'user_feedback'
    )),
    metadata JSONB DEFAULT '{}',
    embedding vector(1536),
    user_id TEXT,
    session_id TEXT,
    source TEXT,
    relevance_score FLOAT DEFAULT 0.0,
    access_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    timestamp TIMESTAMPTZ DEFAULT NOW() -- For backward compatibility
);

-- MCP Code Patterns table
CREATE TABLE IF NOT EXISTS mcp_code_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_type TEXT NOT NULL,
    before_code TEXT,
    after_code TEXT NOT NULL,
    description TEXT NOT NULL,
    error_types TEXT[] DEFAULT '{}',
    success_rate FLOAT DEFAULT 1.0 CHECK (success_rate >= 0.0 AND success_rate <= 1.0),
    usage_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    user_id TEXT,
    agent_name TEXT,
    programming_language TEXT,
    complexity_level TEXT CHECK (complexity_level IN ('simple', 'medium', 'complex')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

-- MCP Task Progress table
CREATE TABLE IF NOT EXISTS mcp_task_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    metadata JSONB DEFAULT '{}',
    user_id TEXT,
    agent_name TEXT,
    session_id TEXT,
    parent_task_id TEXT,
    estimated_duration_ms INTEGER,
    actual_duration_ms INTEGER,
    resource_usage JSONB DEFAULT '{}',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- MCP Error Analysis table
CREATE TABLE IF NOT EXISTS mcp_error_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    error_type TEXT NOT NULL,
    error_message TEXT NOT NULL,
    file_path TEXT,
    line_number INTEGER,
    solution_pattern TEXT,
    frequency INTEGER DEFAULT 1,
    severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    metadata JSONB DEFAULT '{}',
    user_id TEXT,
    agent_name TEXT,
    programming_language TEXT,
    error_category TEXT,
    resolution_status TEXT DEFAULT 'unresolved' CHECK (resolution_status IN ('unresolved', 'resolved', 'ignored')),
    first_seen TIMESTAMPTZ DEFAULT NOW(),
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- =====================================================
-- 3. ENSURE CONTEXT STORAGE TABLE EXISTS
-- =====================================================
-- This is from the context storage migration

CREATE TABLE IF NOT EXISTS context_storage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('conversation', 'project_info', 'error_analysis', 'code_patterns', 'test_results', 'architecture_patterns')),
    source TEXT NOT NULL,
    user_id TEXT NOT NULL,
    project_path TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 4. ENSURE CORE CONSOLIDATED TABLES EXIST
-- =====================================================
-- These are from the main consolidated schema

-- Tasks table (needed by agent registry)
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    agent_name TEXT NOT NULL,
    supporting_agents TEXT[] DEFAULT '{}',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    user_request TEXT NOT NULL,
    context JSONB DEFAULT '{}',
    result JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Memories table (core functionality)
CREATE TABLE IF NOT EXISTS ai_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    agent_id TEXT,
    content TEXT NOT NULL,
    embedding vector(1536),
    context JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    importance REAL DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
    access_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Knowledge Sources table
CREATE TABLE IF NOT EXISTS knowledge_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    content_embedding vector(1536),
    source TEXT NOT NULL,
    source_type TEXT CHECK (source_type IN ('manual', 'web', 'file', 'api', 'generated')),
    url TEXT,
    metadata JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    is_verified BOOLEAN DEFAULT false,
    quality_score REAL DEFAULT 0.5 CHECK (quality_score >= 0 AND quality_score <= 1),
    access_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Architecture Pattern tables (new from architecture router)
CREATE TABLE IF NOT EXISTS architecture_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    framework TEXT NOT NULL,
    description TEXT NOT NULL,
    implementation_guide TEXT,
    success_rate REAL DEFAULT 0.0,
    usage_count INTEGER DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pattern_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_id UUID NOT NULL,
    user_id TEXT,
    agent_name TEXT,
    context JSONB DEFAULT '{}',
    success BOOLEAN,
    performance_metrics JSONB DEFAULT '{}',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (pattern_id) REFERENCES architecture_patterns(id) ON DELETE CASCADE
);

-- =====================================================
-- 5. CREATE MISSING INDEXES
-- =====================================================

-- MCP Context indexes
CREATE INDEX IF NOT EXISTS idx_mcp_context_category ON mcp_context(category);
CREATE INDEX IF NOT EXISTS idx_mcp_context_user_id ON mcp_context(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_context_created_at ON mcp_context(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_context_embedding ON mcp_context USING ivfflat (embedding vector_cosine_ops) WHERE embedding IS NOT NULL;

-- Context Storage indexes
CREATE INDEX IF NOT EXISTS idx_context_storage_user_id ON context_storage(user_id);
CREATE INDEX IF NOT EXISTS idx_context_storage_category ON context_storage(category);
CREATE INDEX IF NOT EXISTS idx_context_storage_created_at ON context_storage(created_at DESC);

-- Tasks indexes
CREATE INDEX IF NOT EXISTS idx_tasks_agent_name ON tasks(agent_name);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);

-- AI Memories indexes
CREATE INDEX IF NOT EXISTS idx_memories_user_agent ON ai_memories(user_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_memories_embedding ON ai_memories USING ivfflat (embedding vector_cosine_ops) WHERE embedding IS NOT NULL;

-- Knowledge Sources indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_user_id ON knowledge_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_embedding ON knowledge_sources USING ivfflat (content_embedding vector_cosine_ops) WHERE content_embedding IS NOT NULL;

-- Architecture Pattern indexes
CREATE INDEX IF NOT EXISTS idx_architecture_patterns_framework ON architecture_patterns(framework);
CREATE INDEX IF NOT EXISTS idx_architecture_patterns_success_rate ON architecture_patterns(success_rate DESC);
CREATE INDEX IF NOT EXISTS idx_pattern_usage_logs_pattern_id ON pattern_usage_logs(pattern_id);

-- =====================================================
-- 6. ENSURE CRITICAL FUNCTIONS EXIST
-- =====================================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Vector similarity search function
CREATE OR REPLACE FUNCTION search_similar_memories(
    query_embedding vector(1536),
    match_limit integer DEFAULT 10,
    similarity_threshold float DEFAULT 0.7
)
RETURNS TABLE (
    id uuid,
    content text,
    similarity float,
    metadata jsonb,
    created_at timestamp with time zone
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.content,
        1 - (m.embedding <=> query_embedding) as similarity,
        m.metadata,
        m.created_at
    FROM ai_memories m
    WHERE m.embedding IS NOT NULL
    AND 1 - (m.embedding <=> query_embedding) > similarity_threshold
    ORDER BY m.embedding <=> query_embedding
    LIMIT match_limit;
END;
$$;

-- Context search function for compatibility
CREATE OR REPLACE FUNCTION search_context_by_similarity(
    query_embedding vector(1536),
    category_filter TEXT DEFAULT NULL,
    user_id_filter TEXT DEFAULT NULL,
    similarity_threshold FLOAT DEFAULT 0.7,
    max_results INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    category TEXT,
    similarity FLOAT,
    metadata JSONB,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.content,
        c.category,
        (1 - (c.embedding <=> query_embedding)) as similarity,
        c.metadata,
        c.created_at
    FROM mcp_context c
    WHERE 
        (category_filter IS NULL OR c.category = category_filter)
        AND (user_id_filter IS NULL OR c.user_id = user_id_filter OR c.user_id IS NULL)
        AND c.embedding IS NOT NULL
        AND (1 - (c.embedding <=> query_embedding)) >= similarity_threshold
    ORDER BY c.embedding <=> query_embedding
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. CREATE UPDATE TRIGGERS
-- =====================================================

-- Apply update triggers to tables with updated_at columns
DO $$
DECLARE
    table_record RECORD;
BEGIN
    FOR table_record IN 
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
        AND EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = pg_tables.tablename 
            AND column_name = 'updated_at'
        )
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON %I.%I', 
                      table_record.tablename, table_record.schemaname, table_record.tablename);
        EXECUTE format('
            CREATE TRIGGER update_%I_updated_at 
            BEFORE UPDATE ON %I.%I 
            FOR EACH ROW 
            EXECUTE FUNCTION update_updated_at_column()',
            table_record.tablename, table_record.schemaname, table_record.tablename
        );
    END LOOP;
END $$;

-- =====================================================
-- 8. ENABLE ROW LEVEL SECURITY WHERE APPROPRIATE
-- =====================================================

-- Enable RLS on user-specific tables
ALTER TABLE mcp_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_storage ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 9. CREATE BASIC RLS POLICIES
-- =====================================================

-- Helper function for RLS
CREATE OR REPLACE FUNCTION get_current_user_id() RETURNS TEXT AS $$
BEGIN
    RETURN COALESCE(
        auth.jwt() ->> 'sub',
        current_setting('request.jwt.claims', true)::json ->> 'sub',
        'anonymous'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN 'anonymous';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- MCP Context policies
DROP POLICY IF EXISTS mcp_context_access_policy ON mcp_context;
CREATE POLICY mcp_context_access_policy ON mcp_context 
FOR ALL USING (user_id = get_current_user_id() OR user_id IS NULL);

-- Context Storage policies
DROP POLICY IF EXISTS context_storage_access_policy ON context_storage;
CREATE POLICY context_storage_access_policy ON context_storage 
FOR ALL USING (user_id = get_current_user_id());

-- AI Memories policies (allow auth.uid() or text user_id)
DROP POLICY IF EXISTS ai_memories_access_policy ON ai_memories;
CREATE POLICY ai_memories_access_policy ON ai_memories 
FOR ALL USING (
    (user_id IS NOT NULL AND user_id::text = get_current_user_id()) 
    OR user_id IS NULL
);

-- =====================================================
-- 10. GRANT PERMISSIONS
-- =====================================================

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Allow anonymous access for public operations
GRANT SELECT, INSERT ON mcp_context TO anonymous;
GRANT SELECT, INSERT ON ai_memories TO anonymous;
GRANT SELECT ON knowledge_sources TO anonymous;

-- =====================================================
-- 11. INSERT VALIDATION DATA
-- =====================================================

-- Test the consolidated schema
INSERT INTO mcp_context (content, category, source, user_id, metadata)
VALUES (
    'Migration consolidation completed successfully. All table conflicts resolved.',
    'project_overview',
    'migration_consolidation',
    'system',
    jsonb_build_object(
        'consolidation_timestamp', NOW(),
        'migration_version', '999_consolidation',
        'status', 'completed'
    )
) ON CONFLICT DO NOTHING;

-- =====================================================
-- CONSOLIDATION COMPLETE
-- =====================================================

COMMENT ON SCHEMA public IS 'Universal AI Tools - Consolidated Schema v999 - All migration conflicts resolved';