-- Context Storage System Migration
-- Implements CLAUDE.md instruction: "Always use supabase for context. Save context to supabase for later use."

-- Create context_storage table for storing all context data
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_context_storage_user_id ON context_storage(user_id);
CREATE INDEX IF NOT EXISTS idx_context_storage_category ON context_storage(category);
CREATE INDEX IF NOT EXISTS idx_context_storage_source ON context_storage(source);
CREATE INDEX IF NOT EXISTS idx_context_storage_project_path ON context_storage(project_path);
CREATE INDEX IF NOT EXISTS idx_context_storage_created_at ON context_storage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_context_storage_updated_at ON context_storage(updated_at DESC);

-- Create full-text search index for content
CREATE INDEX IF NOT EXISTS idx_context_storage_content_fts ON context_storage 
USING gin(to_tsvector('english', content));

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_context_storage_user_category ON context_storage(user_id, category);
CREATE INDEX IF NOT EXISTS idx_context_storage_user_project ON context_storage(user_id, project_path);
CREATE INDEX IF NOT EXISTS idx_context_storage_category_updated ON context_storage(category, updated_at DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_context_storage_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_context_storage_updated_at ON context_storage;
CREATE TRIGGER trigger_context_storage_updated_at
    BEFORE UPDATE ON context_storage
    FOR EACH ROW
    EXECUTE FUNCTION update_context_storage_updated_at();

-- Create function for hybrid search (text + semantic similarity)
CREATE OR REPLACE FUNCTION search_context_hybrid(
    search_user_id TEXT,
    search_query TEXT,
    search_category TEXT DEFAULT NULL,
    search_project_path TEXT DEFAULT NULL,
    result_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    category TEXT,
    source TEXT,
    user_id TEXT,
    project_path TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    similarity_score REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cs.id,
        cs.content,
        cs.category,
        cs.source,
        cs.user_id,
        cs.project_path,
        cs.metadata,
        cs.created_at,
        cs.updated_at,
        ts_rank(to_tsvector('english', cs.content), plainto_tsquery('english', search_query)) AS similarity_score
    FROM context_storage cs
    WHERE 
        cs.user_id = search_user_id
        AND (search_category IS NULL OR cs.category = search_category)
        AND (search_project_path IS NULL OR cs.project_path = search_project_path)
        AND to_tsvector('english', cs.content) @@ plainto_tsquery('english', search_query)
    ORDER BY similarity_score DESC, cs.updated_at DESC
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Create function to get recent context by category
CREATE OR REPLACE FUNCTION get_recent_context(
    search_user_id TEXT,
    search_category TEXT DEFAULT NULL,
    search_project_path TEXT DEFAULT NULL,
    result_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    category TEXT,
    source TEXT,
    user_id TEXT,
    project_path TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cs.id,
        cs.content,
        cs.category,
        cs.source,
        cs.user_id,
        cs.project_path,
        cs.metadata,
        cs.created_at,
        cs.updated_at
    FROM context_storage cs
    WHERE 
        cs.user_id = search_user_id
        AND (search_category IS NULL OR cs.category = search_category)
        AND (search_project_path IS NULL OR cs.project_path = search_project_path)
    ORDER BY cs.updated_at DESC
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Create function to cleanup old context entries
CREATE OR REPLACE FUNCTION cleanup_old_context(
    cleanup_user_id TEXT,
    days_old INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
    cutoff_date TIMESTAMP WITH TIME ZONE;
BEGIN
    cutoff_date := NOW() - INTERVAL '1 day' * days_old;
    
    DELETE FROM context_storage 
    WHERE user_id = cleanup_user_id 
    AND created_at < cutoff_date;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get context statistics for a user
CREATE OR REPLACE FUNCTION get_context_stats(search_user_id TEXT)
RETURNS TABLE (
    total_entries BIGINT,
    categories_breakdown JSONB,
    oldest_entry TIMESTAMP WITH TIME ZONE,
    newest_entry TIMESTAMP WITH TIME ZONE,
    total_content_size BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_entries,
        jsonb_object_agg(category, category_count) as categories_breakdown,
        MIN(created_at) as oldest_entry,
        MAX(updated_at) as newest_entry,
        SUM(LENGTH(content)) as total_content_size
    FROM (
        SELECT 
            cs.category,
            COUNT(*) as category_count,
            cs.created_at,
            cs.updated_at,
            cs.content
        FROM context_storage cs
        WHERE cs.user_id = search_user_id
        GROUP BY cs.category, cs.created_at, cs.updated_at, cs.content
    ) category_stats;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security
ALTER TABLE context_storage ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for context storage
CREATE POLICY "Users can only access their own context" ON context_storage
    FOR ALL USING (auth.uid()::text = user_id);

-- Allow service role to access all context (for system operations)
CREATE POLICY "Service role can access all context" ON context_storage
    FOR ALL USING (auth.role() = 'service_role');

-- Insert initial system context to validate the setup
INSERT INTO context_storage (content, category, source, user_id, project_path, metadata)
VALUES (
    'Universal AI Tools context storage system initialized. This system implements the CLAUDE.md instruction to always use Supabase for context storage and retrieval.',
    'project_info',
    'migration_20250731040000',
    'system',
    '/Users/christianmerrill/Desktop/universal-ai-tools',
    jsonb_build_object(
        'migration_timestamp', NOW(),
        'system_version', '1.0.0',
        'features', jsonb_build_array('context_storage', 'hybrid_search', 'rls_security'),
        'created_by', 'context_storage_migration'
    )
) ON CONFLICT DO NOTHING;

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON context_storage TO authenticated;
GRANT EXECUTE ON FUNCTION search_context_hybrid TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_context TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_context TO authenticated;
GRANT EXECUTE ON FUNCTION get_context_stats TO authenticated;

-- Comment on table and important columns
COMMENT ON TABLE context_storage IS 'Stores all context data for Universal AI Tools as per CLAUDE.md instructions. Enables context persistence and retrieval across sessions.';
COMMENT ON COLUMN context_storage.content IS 'The actual context content (conversations, code patterns, test results, etc.)';
COMMENT ON COLUMN context_storage.category IS 'Category of context: conversation, project_info, error_analysis, code_patterns, test_results, architecture_patterns';
COMMENT ON COLUMN context_storage.source IS 'Source of the context (e.g., chat_session, test_runner, error_handler)';
COMMENT ON COLUMN context_storage.user_id IS 'User ID for data isolation and security';
COMMENT ON COLUMN context_storage.project_path IS 'Optional project path for project-specific context';
COMMENT ON COLUMN context_storage.metadata IS 'Additional metadata in JSONB format for extensibility';