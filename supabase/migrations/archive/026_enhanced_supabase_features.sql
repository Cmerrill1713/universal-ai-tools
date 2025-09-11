-- Enhanced Supabase Features Schema
-- Created: 2025-01-22
-- Adds comprehensive tables for Storage, Realtime, Vector DB, Queues, and AI Processing

-- =====================================================
-- FILE METADATA AND STORAGE
-- =====================================================

-- File metadata table for Storage integration
CREATE TABLE IF NOT EXISTS file_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket VARCHAR(255) NOT NULL,
    path TEXT NOT NULL,
    hash VARCHAR(64) NOT NULL, -- SHA256 hash for deduplication
    size BIGINT NOT NULL,
    content_type VARCHAR(255),
    public_url TEXT,
    metadata JSONB DEFAULT '{}',
    processing_status VARCHAR(50) DEFAULT 'pending',
    processed_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    UNIQUE(bucket, hash) -- Prevent duplicate files in same bucket
);

-- Indexes for file metadata
CREATE INDEX idx_file_metadata_bucket_path ON file_metadata(bucket, path);
CREATE INDEX idx_file_metadata_hash ON file_metadata(hash);
CREATE INDEX idx_file_metadata_processing_status ON file_metadata(processing_status);
CREATE INDEX idx_file_metadata_created_by ON file_metadata(created_by);

-- =====================================================
-- JOB QUEUE SYSTEM
-- =====================================================

-- Job queue table for background processing
CREATE TABLE IF NOT EXISTS job_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_name VARCHAR(100) NOT NULL,
    job_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
    status VARCHAR(50) DEFAULT 'pending',
    scheduled_for TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    result JSONB,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for job queue
CREATE INDEX idx_job_queue_status_scheduled ON job_queue(status, scheduled_for);
CREATE INDEX idx_job_queue_queue_name ON job_queue(queue_name);
CREATE INDEX idx_job_queue_created_at ON job_queue(created_at);

-- =====================================================
-- DOCUMENT EMBEDDINGS FOR VECTOR SEARCH
-- =====================================================

-- Document embeddings table
CREATE TABLE IF NOT EXISTS document_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID REFERENCES file_metadata(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(1536), -- OpenAI embeddings dimension
    metadata JSONB DEFAULT '{}',
    chunk_index INTEGER,
    chunk_total INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create vector index for similarity search
CREATE INDEX idx_document_embeddings_vector ON document_embeddings 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Index for file lookups
CREATE INDEX idx_document_embeddings_file_id ON document_embeddings(file_id);

-- =====================================================
-- MEMORY EMBEDDINGS WITH ENHANCED METADATA
-- =====================================================

-- Enhanced memories table with better vector support
CREATE TABLE IF NOT EXISTS memory_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata JSONB DEFAULT '{}',
    context JSONB DEFAULT '{}',
    importance_score DECIMAL(3,2) DEFAULT 0.5 CHECK (importance_score >= 0 AND importance_score <= 1),
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for memory embeddings
CREATE INDEX idx_memory_embeddings_vector ON memory_embeddings 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
CREATE INDEX idx_memory_embeddings_user_id ON memory_embeddings(user_id);
CREATE INDEX idx_memory_embeddings_type ON memory_embeddings(type);
CREATE INDEX idx_memory_embeddings_importance ON memory_embeddings(importance_score DESC);

-- =====================================================
-- REALTIME EVENTS TRACKING
-- =====================================================

-- Table for tracking realtime events
CREATE TABLE IF NOT EXISTS realtime_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for event queries
CREATE INDEX idx_realtime_events_channel ON realtime_events(channel);
CREATE INDEX idx_realtime_events_created_at ON realtime_events(created_at DESC);

-- =====================================================
-- AI PROCESSING RESULTS
-- =====================================================

-- Table for storing AI processing results
CREATE TABLE IF NOT EXISTS ai_processing_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID REFERENCES file_metadata(id) ON DELETE CASCADE,
    processing_type VARCHAR(100) NOT NULL,
    results JSONB NOT NULL,
    confidence_scores JSONB DEFAULT '{}',
    processing_time_ms INTEGER,
    model_used VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for AI results
CREATE INDEX idx_ai_processing_file_id ON ai_processing_results(file_id);
CREATE INDEX idx_ai_processing_type ON ai_processing_results(processing_type);

-- =====================================================
-- RESOURCE PERMISSIONS
-- =====================================================

-- Fine-grained permissions for resources
CREATE TABLE IF NOT EXISTS resource_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID NOT NULL,
    permission VARCHAR(50) NOT NULL,
    granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, resource_type, resource_id, permission)
);

-- Index for permission lookups
CREATE INDEX idx_resource_permissions_lookup ON resource_permissions(user_id, resource_type, resource_id);

-- =====================================================
-- RPC FUNCTIONS
-- =====================================================

-- Function for semantic search on documents
CREATE OR REPLACE FUNCTION search_document_semantic(
    query_embedding vector(1536),
    similarity_threshold float DEFAULT 0.7,
    match_count int DEFAULT 10,
    filter_params jsonb DEFAULT '{}'
)
RETURNS TABLE (
    id uuid,
    content text,
    similarity float,
    metadata jsonb,
    file_id uuid
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        de.id,
        de.content,
        1 - (de.embedding <=> query_embedding) as similarity,
        de.metadata,
        de.file_id
    FROM document_embeddings de
    WHERE 1 - (de.embedding <=> query_embedding) > similarity_threshold
        AND (filter_params IS NULL OR filter_params = '{}' OR de.metadata @> filter_params)
    ORDER BY de.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Function for semantic search on memories
CREATE OR REPLACE FUNCTION search_memory_semantic(
    query_embedding vector(1536),
    similarity_threshold float DEFAULT 0.7,
    match_count int DEFAULT 10,
    filter_params jsonb DEFAULT '{}'
)
RETURNS TABLE (
    id uuid,
    content text,
    similarity float,
    metadata jsonb,
    type varchar
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        me.id,
        me.content,
        1 - (me.embedding <=> query_embedding) as similarity,
        me.metadata,
        me.type
    FROM memory_embeddings me
    WHERE 1 - (me.embedding <=> query_embedding) > similarity_threshold
        AND (filter_params IS NULL OR filter_params = '{}' OR me.metadata @> filter_params)
    ORDER BY me.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Function for hybrid search combining text and vector
CREATE OR REPLACE FUNCTION hybrid_search_document(
    text_query text,
    query_embedding vector(1536),
    match_count int DEFAULT 10,
    text_weight float DEFAULT 0.5,
    vector_weight float DEFAULT 0.5
)
RETURNS TABLE (
    id uuid,
    content text,
    combined_score float,
    text_rank float,
    vector_similarity float,
    metadata jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH text_search AS (
        SELECT 
            de.id,
            de.content,
            de.metadata,
            ts_rank_cd(to_tsvector('english', de.content), plainto_tsquery('english', text_query)) as text_rank
        FROM document_embeddings de
        WHERE to_tsvector('english', de.content) @@ plainto_tsquery('english', text_query)
    ),
    vector_search AS (
        SELECT 
            de.id,
            1 - (de.embedding <=> query_embedding) as vector_similarity
        FROM document_embeddings de
    ),
    combined AS (
        SELECT 
            COALESCE(ts.id, vs.id) as id,
            ts.content,
            ts.metadata,
            COALESCE(ts.text_rank, 0) as text_rank,
            COALESCE(vs.vector_similarity, 0) as vector_similarity,
            (COALESCE(ts.text_rank, 0) * text_weight + COALESCE(vs.vector_similarity, 0) * vector_weight) as combined_score
        FROM text_search ts
        FULL OUTER JOIN vector_search vs ON ts.id = vs.id
    )
    SELECT 
        c.id,
        c.content,
        c.combined_score,
        c.text_rank,
        c.vector_similarity,
        c.metadata
    FROM combined c
    WHERE c.combined_score > 0
    ORDER BY c.combined_score DESC
    LIMIT match_count;
END;
$$;

-- Function to check resource permissions
CREATE OR REPLACE FUNCTION check_resource_permission(
    user_id uuid,
    resource_type text,
    resource_id uuid,
    permission text
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM resource_permissions rp
        WHERE rp.user_id = check_resource_permission.user_id
            AND rp.resource_type = check_resource_permission.resource_type
            AND rp.resource_id = check_resource_permission.resource_id
            AND rp.permission = check_resource_permission.permission
            AND (rp.expires_at IS NULL OR rp.expires_at > NOW())
    );
END;
$$;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update timestamp triggers
CREATE TRIGGER update_file_metadata_updated_at
    BEFORE UPDATE ON file_metadata
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_job_queue_updated_at
    BEFORE UPDATE ON job_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_document_embeddings_updated_at
    BEFORE UPDATE ON document_embeddings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_memory_embeddings_updated_at
    BEFORE UPDATE ON memory_embeddings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE file_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE realtime_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_processing_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_permissions ENABLE ROW LEVEL SECURITY;

-- File metadata policies
CREATE POLICY "Users can view their own files" ON file_metadata
    FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can insert their own files" ON file_metadata
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own files" ON file_metadata
    FOR UPDATE USING (auth.uid() = created_by);

-- Memory embeddings policies
CREATE POLICY "Users can manage their own memories" ON memory_embeddings
    FOR ALL USING (auth.uid() = user_id);

-- Resource permissions policies
CREATE POLICY "Users can view their permissions" ON resource_permissions
    FOR SELECT USING (auth.uid() = user_id);

-- Service role bypass for all tables (for backend operations)
CREATE POLICY "Service role bypass" ON file_metadata
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role bypass" ON job_queue
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role bypass" ON document_embeddings
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role bypass" ON memory_embeddings
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role bypass" ON realtime_events
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role bypass" ON ai_processing_results
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role bypass" ON resource_permissions
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');