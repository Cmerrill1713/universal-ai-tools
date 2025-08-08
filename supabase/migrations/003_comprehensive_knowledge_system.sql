-- =====================================================
-- Comprehensive Knowledge Storage System for Supabase
-- Version: 2.0.0
-- Date: 2025-07-30
-- =====================================================
-- This migration adds comprehensive knowledge storage capabilities
-- to replace all external dependencies (Redis, file storage, etc.)

-- =====================================================
-- 1. CACHE SYSTEM (Replace Redis)
-- =====================================================

-- Generic cache table for temporary data
CREATE TABLE IF NOT EXISTS cache_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    access_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for cache key lookups
CREATE INDEX IF NOT EXISTS idx_cache_key ON cache_entries (key);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache_entries (expires_at) WHERE expires_at IS NOT NULL;

-- Function to get cache value
CREATE OR REPLACE FUNCTION get_cache_value(cache_key TEXT)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    -- Get value and update access count/time
    UPDATE cache_entries
    SET access_count = access_count + 1,
        last_accessed = NOW()
    WHERE key = cache_key
    AND (expires_at IS NULL OR expires_at > NOW())
    RETURNING value INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to set cache value with TTL
CREATE OR REPLACE FUNCTION set_cache_value(
    cache_key TEXT,
    cache_value JSONB,
    ttl_seconds INTEGER DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO cache_entries (key, value, expires_at)
    VALUES (
        cache_key,
        cache_value,
        CASE
            WHEN ttl_seconds IS NOT NULL THEN NOW() + (ttl_seconds || ' seconds')::INTERVAL
            ELSE NULL
        END
    )
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 2. DOCUMENT STORAGE (Replace file system)
-- =====================================================

-- Documents and files storage
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    content TEXT,
    content_type TEXT DEFAULT 'text/plain',
    size_bytes BIGINT,
    hash TEXT, -- For deduplication
    metadata JSONB DEFAULT '{}'::jsonb,
    tags TEXT[] DEFAULT '{}',
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, path)
);

-- Binary storage for non-text files
CREATE TABLE IF NOT EXISTS binary_objects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    data BYTEA NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(document_id, chunk_index)
);

-- =====================================================
-- 3. CONVERSATION HISTORY & CONTEXT
-- =====================================================

-- Conversation threads
CREATE TABLE IF NOT EXISTS conversation_threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    title TEXT,
    summary TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_archived BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversation messages with embeddings
CREATE TABLE IF NOT EXISTS conversation_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID REFERENCES conversation_threads(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    embedding vector(1536),
    tokens_used INTEGER,
    model_used TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 4. TRAINING DATA & FINE-TUNING
-- =====================================================

-- Training datasets for fine-tuning
CREATE TABLE IF NOT EXISTS training_datasets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    dataset_type TEXT CHECK (dataset_type IN ('conversation', 'completion', 'classification', 'embedding')),
    version TEXT DEFAULT '1.0.0',
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Training examples
CREATE TABLE IF NOT EXISTS training_examples (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dataset_id UUID REFERENCES training_datasets(id) ON DELETE CASCADE,
    input_text TEXT NOT NULL,
    output_text TEXT,
    input_embedding vector(1536),
    output_embedding vector(1536),
    labels TEXT[] DEFAULT '{}',
    quality_score REAL DEFAULT 1.0,
    is_validated BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 5. SEMANTIC SEARCH & KNOWLEDGE GRAPH
-- =====================================================

-- Knowledge graph nodes
CREATE TABLE IF NOT EXISTS knowledge_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_type TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    properties JSONB DEFAULT '{}'::jsonb,
    embedding vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Knowledge graph edges
CREATE TABLE IF NOT EXISTS knowledge_edges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_node_id UUID REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
    target_node_id UUID REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL,
    properties JSONB DEFAULT '{}'::jsonb,
    weight REAL DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(source_node_id, target_node_id, relationship_type)
);

-- =====================================================
-- 6. MODEL OUTPUTS & ANALYTICS
-- =====================================================

-- Model inference logs
CREATE TABLE IF NOT EXISTS model_inferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    model_name TEXT NOT NULL,
    model_version TEXT,
    input_text TEXT,
    output_text TEXT,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    latency_ms INTEGER,
    temperature REAL,
    parameters JSONB DEFAULT '{}'::jsonb,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Model performance metrics
CREATE TABLE IF NOT EXISTS model_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_name TEXT NOT NULL,
    metric_type TEXT NOT NULL,
    metric_value REAL NOT NULL,
    sample_size INTEGER,
    metadata JSONB DEFAULT '{}'::jsonb,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 7. WORKFLOW & AUTOMATION STORAGE
-- =====================================================

-- Workflow definitions
CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    workflow_definition JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    schedule_cron TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow execution logs
CREATE TABLE IF NOT EXISTS workflow_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    input_data JSONB DEFAULT '{}'::jsonb,
    output_data JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 8. FULL-TEXT SEARCH CONFIGURATION
-- =====================================================

-- Add full-text search columns to existing tables
ALTER TABLE knowledge_sources ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create full-text search indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_search ON knowledge_sources USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_documents_search ON documents USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_messages_search ON conversation_messages USING gin(search_vector);

-- Function to update search vectors
CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'knowledge_sources' THEN
        NEW.search_vector := setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
                            setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'B') ||
                            setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'C');
    ELSIF TG_TABLE_NAME = 'documents' THEN
        NEW.search_vector := setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
                            setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'B') ||
                            setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'C');
    ELSIF TG_TABLE_NAME = 'conversation_messages' THEN
        NEW.search_vector := to_tsvector('english', COALESCE(NEW.content, ''));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for search vector updates
CREATE TRIGGER update_knowledge_search_vector
BEFORE INSERT OR UPDATE ON knowledge_sources
FOR EACH ROW EXECUTE FUNCTION update_search_vector();

CREATE TRIGGER update_documents_search_vector
BEFORE INSERT OR UPDATE ON documents
FOR EACH ROW EXECUTE FUNCTION update_search_vector();

CREATE TRIGGER update_messages_search_vector
BEFORE INSERT OR UPDATE ON conversation_messages
FOR EACH ROW EXECUTE FUNCTION update_search_vector();

-- =====================================================
-- 9. SCHEDULED JOBS
-- =====================================================

-- Clean up expired cache entries (requires pg_cron)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.schedule(
            'cleanup-expired-cache',
            '*/5 * * * *', -- Every 5 minutes
            'DELETE FROM cache_entries WHERE expires_at < NOW()'
        );
    END IF;
END $$;

-- =====================================================
-- 10. HYBRID SEARCH FUNCTION
-- =====================================================

-- Combined semantic + full-text search
CREATE OR REPLACE FUNCTION hybrid_search(
    query_text TEXT,
    query_embedding vector,
    search_tables TEXT[] DEFAULT ARRAY['knowledge_sources', 'documents', 'conversation_messages'],
    match_limit INTEGER DEFAULT 10,
    semantic_weight REAL DEFAULT 0.5
)
RETURNS TABLE (
    id UUID,
    table_name TEXT,
    content TEXT,
    title TEXT,
    semantic_score REAL,
    text_score REAL,
    combined_score REAL
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH semantic_results AS (
        -- Semantic search across tables
        SELECT
            ks.id,
            'knowledge_sources'::TEXT as table_name,
            ks.content,
            ks.title,
            1 - (ks.content_embedding <=> query_embedding) as semantic_score,
            ts_rank(ks.search_vector, plainto_tsquery('english', query_text)) as text_score
        FROM knowledge_sources ks
        WHERE 'knowledge_sources' = ANY(search_tables)
        AND ks.content_embedding IS NOT NULL

        UNION ALL

        SELECT
            d.id,
            'documents'::TEXT as table_name,
            d.content,
            d.name as title,
            1 - (d.metadata->>'embedding' <=> query_embedding) as semantic_score,
            ts_rank(d.search_vector, plainto_tsquery('english', query_text)) as text_score
        FROM documents d
        WHERE 'documents' = ANY(search_tables)

        UNION ALL

        SELECT
            cm.id,
            'conversation_messages'::TEXT as table_name,
            cm.content,
            NULL as title,
            1 - (cm.embedding <=> query_embedding) as semantic_score,
            ts_rank(cm.search_vector, plainto_tsquery('english', query_text)) as text_score
        FROM conversation_messages cm
        WHERE 'conversation_messages' = ANY(search_tables)
        AND cm.embedding IS NOT NULL
    )
    SELECT
        sr.id,
        sr.table_name,
        sr.content,
        sr.title,
        sr.semantic_score,
        sr.text_score,
        (sr.semantic_score * semantic_weight + sr.text_score * (1 - semantic_weight)) as combined_score
    FROM semantic_results sr
    ORDER BY combined_score DESC
    LIMIT match_limit;
END;
$$;

-- =====================================================
-- 11. INDEXES FOR PERFORMANCE
-- =====================================================

-- Cache indexes
CREATE INDEX IF NOT EXISTS idx_cache_access ON cache_entries (last_accessed DESC);

-- Document indexes
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents (user_id);
CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents (hash);
CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents USING gin(tags);

-- Conversation indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversation_threads (user_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON conversation_messages (thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON conversation_messages (created_at DESC);

-- Training data indexes
CREATE INDEX IF NOT EXISTS idx_training_dataset ON training_examples (dataset_id);
CREATE INDEX IF NOT EXISTS idx_training_quality ON training_examples (quality_score DESC);

-- Knowledge graph indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_type ON knowledge_nodes (node_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_source ON knowledge_edges (source_node_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_target ON knowledge_edges (target_node_id);

-- Model analytics indexes
CREATE INDEX IF NOT EXISTS idx_inferences_user ON model_inferences (user_id);
CREATE INDEX IF NOT EXISTS idx_inferences_model ON model_inferences (model_name);
CREATE INDEX IF NOT EXISTS idx_inferences_created ON model_inferences (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_model ON model_metrics (model_name, metric_type);

-- =====================================================
-- 12. ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on user-specific tables
ALTER TABLE cache_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_inferences ENABLE ROW LEVEL SECURITY;

-- RLS policies (only when auth schema exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
        -- Documents policies
        EXECUTE 'CREATE POLICY "Users can view their own documents" ON documents
            FOR SELECT USING (auth.uid() = user_id OR is_public = true)';

        EXECUTE 'CREATE POLICY "Users can create their own documents" ON documents
            FOR INSERT WITH CHECK (auth.uid() = user_id)';

        EXECUTE 'CREATE POLICY "Users can update their own documents" ON documents
            FOR UPDATE USING (auth.uid() = user_id)';

        EXECUTE 'CREATE POLICY "Users can delete their own documents" ON documents
            FOR DELETE USING (auth.uid() = user_id)';

        -- Conversation policies
        EXECUTE 'CREATE POLICY "Users can view their own conversations" ON conversation_threads
            FOR SELECT USING (auth.uid() = user_id)';

        EXECUTE 'CREATE POLICY "Users can create their own conversations" ON conversation_threads
            FOR INSERT WITH CHECK (auth.uid() = user_id)';

        -- Model inference policies
        EXECUTE 'CREATE POLICY "Users can view their own inferences" ON model_inferences
            FOR SELECT USING (auth.uid() = user_id)';
    END IF;
END $$;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
