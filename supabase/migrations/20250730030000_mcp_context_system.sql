-- MCP Context System Migration
-- Creates tables for Model Context Protocol integration with RLS policies
--
-- This migration creates the complete MCP infrastructure for:
-- - Context storage and retrieval
-- - Code pattern learning
-- - Task progress tracking
-- - Error analysis and learning
-- - Multi-tenant security with RLS

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";

CREATE TABLE IF NOT EXISTS public.mcp_context (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN (
        'project_overview',
        'code_patterns',
        'error_analysis',
        'conversation_history',
        'agent_responses',
        'user_feedback'
    )),
    metadata JSONB DEFAULT '{}',
    embedding vector(1536), -- OpenAI ada-002 embedding size
    user_id TEXT, -- Allow anonymous usage
    session_id TEXT,
    source TEXT,
    relevance_score FLOAT DEFAULT 0.0,
    access_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ -- Optional expiration for temporary context
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS mcp_context_category_idx ON public.mcp_context(category);
CREATE INDEX IF NOT EXISTS mcp_context_user_id_idx ON public.mcp_context(user_id);
CREATE INDEX IF NOT EXISTS mcp_context_created_at_idx ON public.mcp_context(created_at DESC);
CREATE INDEX IF NOT EXISTS mcp_context_relevance_idx ON public.mcp_context(relevance_score DESC);
CREATE INDEX IF NOT EXISTS mcp_context_metadata_idx ON public.mcp_context USING GIN(metadata);
CREATE INDEX IF NOT EXISTS mcp_context_search_idx ON public.mcp_context USING GIN(to_tsvector('english', content));

-- Vector similarity search index
CREATE INDEX IF NOT EXISTS mcp_context_embedding_idx ON public.mcp_context
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- =============================================================================
-- MCP CODE PATTERNS TABLE
-- Stores successful code patterns for learning and reuse
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.mcp_code_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    last_used_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT mcp_code_patterns_description_check CHECK (length(description) > 0),
    CONSTRAINT mcp_code_patterns_after_code_check CHECK (length(after_code) > 0)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS mcp_code_patterns_type_idx ON public.mcp_code_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS mcp_code_patterns_user_id_idx ON public.mcp_code_patterns(user_id);
CREATE INDEX IF NOT EXISTS mcp_code_patterns_success_rate_idx ON public.mcp_code_patterns(success_rate DESC);
CREATE INDEX IF NOT EXISTS mcp_code_patterns_language_idx ON public.mcp_code_patterns(programming_language);
CREATE INDEX IF NOT EXISTS mcp_code_patterns_complexity_idx ON public.mcp_code_patterns(complexity_level);
CREATE INDEX IF NOT EXISTS mcp_code_patterns_error_types_idx ON public.mcp_code_patterns USING GIN(error_types);
CREATE INDEX IF NOT EXISTS mcp_code_patterns_search_idx ON public.mcp_code_patterns
USING GIN(to_tsvector('english', description || ' ' || coalesce(before_code, '') || ' ' || after_code));

-- =============================================================================
-- MCP TASK PROGRESS TABLE
-- Tracks task execution and progress for learning and analytics
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.mcp_task_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    metadata JSONB DEFAULT '{}',
    user_id TEXT,
    agent_name TEXT,
    session_id TEXT,
    parent_task_id TEXT, -- For hierarchical tasks
    estimated_duration_ms INTEGER,
    actual_duration_ms INTEGER,
    resource_usage JSONB DEFAULT '{}', -- CPU, memory, tokens, etc.
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT mcp_task_progress_task_id_check CHECK (length(task_id) > 0),
    CONSTRAINT mcp_task_progress_description_check CHECK (length(description) > 0)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS mcp_task_progress_task_id_idx ON public.mcp_task_progress(task_id);
CREATE INDEX IF NOT EXISTS mcp_task_progress_status_idx ON public.mcp_task_progress(status);
CREATE INDEX IF NOT EXISTS mcp_task_progress_user_id_idx ON public.mcp_task_progress(user_id);
CREATE INDEX IF NOT EXISTS mcp_task_progress_updated_at_idx ON public.mcp_task_progress(updated_at DESC);
CREATE INDEX IF NOT EXISTS mcp_task_progress_agent_idx ON public.mcp_task_progress(agent_name);
CREATE INDEX IF NOT EXISTS mcp_task_progress_parent_idx ON public.mcp_task_progress(parent_task_id);

-- =============================================================================
-- MCP ERROR ANALYSIS TABLE
-- Stores error patterns and solutions for learning and prevention
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.mcp_error_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    error_category TEXT, -- syntax, runtime, logic, etc.
    resolution_status TEXT DEFAULT 'unresolved' CHECK (resolution_status IN ('unresolved', 'resolved', 'ignored')),
    first_seen TIMESTAMPTZ DEFAULT NOW(),
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT mcp_error_analysis_error_type_check CHECK (length(error_type) > 0),
    CONSTRAINT mcp_error_analysis_error_message_check CHECK (length(error_message) > 0),
    CONSTRAINT mcp_error_analysis_frequency_check CHECK (frequency > 0)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS mcp_error_analysis_type_idx ON public.mcp_error_analysis(error_type);
CREATE INDEX IF NOT EXISTS mcp_error_analysis_frequency_idx ON public.mcp_error_analysis(frequency DESC);
CREATE INDEX IF NOT EXISTS mcp_error_analysis_severity_idx ON public.mcp_error_analysis(severity);
CREATE INDEX IF NOT EXISTS mcp_error_analysis_user_id_idx ON public.mcp_error_analysis(user_id);
CREATE INDEX IF NOT EXISTS mcp_error_analysis_language_idx ON public.mcp_error_analysis(programming_language);
CREATE INDEX IF NOT EXISTS mcp_error_analysis_category_idx ON public.mcp_error_analysis(error_category);
CREATE INDEX IF NOT EXISTS mcp_error_analysis_status_idx ON public.mcp_error_analysis(resolution_status);
CREATE INDEX IF NOT EXISTS mcp_error_analysis_search_idx ON public.mcp_error_analysis
USING GIN(to_tsvector('english', error_message || ' ' || coalesce(solution_pattern, '')));

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Multi-tenant security ensuring users only access their own data
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.mcp_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_code_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_task_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_error_analysis ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user ID from JWT or allow anonymous
CREATE OR REPLACE FUNCTION get_current_user_id() RETURNS TEXT AS $$
BEGIN
    -- Try to get user ID from JWT token
    RETURN COALESCE(
        auth.jwt() ->> 'sub',
        current_setting('request.jwt.claims', true)::json ->> 'sub',
        'anonymous'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN 'anonymous';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- MCP Context RLS Policies
CREATE POLICY mcp_context_select_policy ON public.mcp_context
FOR SELECT USING (user_id = get_current_user_id() OR user_id IS NULL);

CREATE POLICY mcp_context_insert_policy ON public.mcp_context
FOR INSERT WITH CHECK (user_id = get_current_user_id() OR user_id IS NULL);

CREATE POLICY mcp_context_update_policy ON public.mcp_context
FOR UPDATE USING (user_id = get_current_user_id() OR user_id IS NULL);

CREATE POLICY mcp_context_delete_policy ON public.mcp_context
FOR DELETE USING (user_id = get_current_user_id() OR user_id IS NULL);

-- MCP Code Patterns RLS Policies
CREATE POLICY mcp_code_patterns_select_policy ON public.mcp_code_patterns
FOR SELECT USING (user_id = get_current_user_id() OR user_id IS NULL);

CREATE POLICY mcp_code_patterns_insert_policy ON public.mcp_code_patterns
FOR INSERT WITH CHECK (user_id = get_current_user_id() OR user_id IS NULL);

CREATE POLICY mcp_code_patterns_update_policy ON public.mcp_code_patterns
FOR UPDATE USING (user_id = get_current_user_id() OR user_id IS NULL);

CREATE POLICY mcp_code_patterns_delete_policy ON public.mcp_code_patterns
FOR DELETE USING (user_id = get_current_user_id() OR user_id IS NULL);

-- MCP Task Progress RLS Policies
CREATE POLICY mcp_task_progress_select_policy ON public.mcp_task_progress
FOR SELECT USING (user_id = get_current_user_id() OR user_id IS NULL);

CREATE POLICY mcp_task_progress_insert_policy ON public.mcp_task_progress
FOR INSERT WITH CHECK (user_id = get_current_user_id() OR user_id IS NULL);

CREATE POLICY mcp_task_progress_update_policy ON public.mcp_task_progress
FOR UPDATE USING (user_id = get_current_user_id() OR user_id IS NULL);

CREATE POLICY mcp_task_progress_delete_policy ON public.mcp_task_progress
FOR DELETE USING (user_id = get_current_user_id() OR user_id IS NULL);

-- MCP Error Analysis RLS Policies
CREATE POLICY mcp_error_analysis_select_policy ON public.mcp_error_analysis
FOR SELECT USING (user_id = get_current_user_id() OR user_id IS NULL);

CREATE POLICY mcp_error_analysis_insert_policy ON public.mcp_error_analysis
FOR INSERT WITH CHECK (user_id = get_current_user_id() OR user_id IS NULL);

CREATE POLICY mcp_error_analysis_update_policy ON public.mcp_error_analysis
FOR UPDATE USING (user_id = get_current_user_id() OR user_id IS NULL);

CREATE POLICY mcp_error_analysis_delete_policy ON public.mcp_error_analysis
FOR DELETE USING (user_id = get_current_user_id() OR user_id IS NULL);

-- =============================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =============================================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all tables
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_mcp_context_updated_at'
    ) THEN
        CREATE TRIGGER update_mcp_context_updated_at
            BEFORE UPDATE ON public.mcp_context
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

CREATE TRIGGER update_mcp_code_patterns_updated_at
    BEFORE UPDATE ON public.mcp_code_patterns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mcp_task_progress_updated_at
    BEFORE UPDATE ON public.mcp_task_progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- UTILITY FUNCTIONS FOR CONTEXT SEARCH AND MANAGEMENT
-- =============================================================================

-- Function to search context by similarity (using vector embeddings)
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
    FROM public.mcp_context c
    WHERE
        (category_filter IS NULL OR c.category = category_filter)
        AND (user_id_filter IS NULL OR c.user_id = user_id_filter OR c.user_id IS NULL)
        AND c.embedding IS NOT NULL
        AND (1 - (c.embedding <=> query_embedding)) >= similarity_threshold
    ORDER BY c.embedding <=> query_embedding
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired context
CREATE OR REPLACE FUNCTION cleanup_expired_context()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.mcp_context
    WHERE expires_at IS NOT NULL AND expires_at < NOW();

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update access counts
CREATE OR REPLACE FUNCTION increment_context_access(context_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.mcp_context
    SET access_count = access_count + 1,
        updated_at = NOW()
    WHERE id = context_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- PERFORMANCE VIEWS FOR ANALYTICS
-- =============================================================================

-- View for context usage analytics
CREATE OR REPLACE VIEW mcp_context_analytics AS
SELECT
    category,
    COUNT(*) as total_entries,
    AVG(access_count) as avg_access_count,
    MAX(access_count) as max_access_count,
    COUNT(DISTINCT user_id) as unique_users,
    DATE_TRUNC('day', created_at) as created_date
FROM public.mcp_context
GROUP BY category, DATE_TRUNC('day', created_at)
ORDER BY created_date DESC, total_entries DESC;

-- View for code pattern effectiveness
CREATE OR REPLACE VIEW mcp_pattern_effectiveness AS
SELECT
    pattern_type,
    programming_language,
    COUNT(*) as pattern_count,
    AVG(success_rate) as avg_success_rate,
    AVG(usage_count) as avg_usage_count,
    MAX(last_used_at) as last_used
FROM public.mcp_code_patterns
GROUP BY pattern_type, programming_language
ORDER BY avg_success_rate DESC, pattern_count DESC;

-- View for error trends
CREATE OR REPLACE VIEW mcp_error_trends AS
SELECT
    error_type,
    error_category,
    programming_language,
    COUNT(*) as occurrence_count,
    SUM(frequency) as total_frequency,
    AVG(frequency) as avg_frequency,
    COUNT(CASE WHEN resolution_status = 'resolved' THEN 1 END) as resolved_count,
    MAX(last_seen) as last_occurrence
FROM public.mcp_error_analysis
GROUP BY error_type, error_category, programming_language
ORDER BY total_frequency DESC, occurrence_count DESC;

-- =============================================================================
-- GRANTS AND PERMISSIONS
-- =============================================================================

-- Grant appropriate permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mcp_context TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mcp_code_patterns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mcp_task_progress TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mcp_error_analysis TO authenticated;

-- Grant usage permissions for sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant permissions for utility functions
GRANT EXECUTE ON FUNCTION search_context_by_similarity TO authenticated;
GRANT EXECUTE ON FUNCTION increment_context_access TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_user_id TO authenticated;

-- Grant permissions for views
GRANT SELECT ON mcp_context_analytics TO authenticated;
GRANT SELECT ON mcp_pattern_effectiveness TO authenticated;
GRANT SELECT ON mcp_error_trends TO authenticated;

-- Allow anonymous access for public context (controlled by RLS)
-- Supabase roles are typically 'anon' and 'authenticated'; skip grants to non-existent 'anonymous' role
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anonymous') THEN
        EXECUTE 'GRANT SELECT, INSERT ON public.mcp_context TO anonymous';
        EXECUTE 'GRANT SELECT, INSERT ON public.mcp_code_patterns TO anonymous';
        EXECUTE 'GRANT SELECT, INSERT ON public.mcp_task_progress TO anonymous';
        EXECUTE 'GRANT SELECT, INSERT ON public.mcp_error_analysis TO anonymous';
    END IF;
END $$;

-- =============================================================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE public.mcp_context IS 'Stores context data for Model Context Protocol with vector embeddings for similarity search';
COMMENT ON TABLE public.mcp_code_patterns IS 'Stores successful code patterns for learning and reuse';
COMMENT ON TABLE public.mcp_task_progress IS 'Tracks task execution and progress for analytics';
COMMENT ON TABLE public.mcp_error_analysis IS 'Stores error patterns and solutions for learning';

COMMENT ON FUNCTION search_context_by_similarity IS 'Searches context using vector similarity with configurable thresholds';
COMMENT ON FUNCTION cleanup_expired_context IS 'Removes expired context entries to maintain database performance';
COMMENT ON FUNCTION increment_context_access IS 'Updates access count for context analytics';

-- Migration completed successfully
COMMENT ON SCHEMA public IS 'MCP Context System v1.0 - Production Ready with RLS and Vector Search';
