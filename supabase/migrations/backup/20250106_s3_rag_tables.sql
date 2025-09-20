-- S3 RAG System Tables Migration
-- This creates all necessary tables for the S3 (Smart Search Strategy) RAG implementation

-- Training examples table for S3 searcher training
CREATE TABLE IF NOT EXISTS training_examples (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question TEXT NOT NULL,
    gold_answer TEXT NOT NULL,
    difficulty_score FLOAT DEFAULT 0.5,
    dataset_source VARCHAR(100) NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient querying
CREATE INDEX idx_training_examples_source ON training_examples(dataset_source);
CREATE INDEX idx_training_examples_created ON training_examples(created_at DESC);

-- Search sessions table to store S3 search results
CREATE TABLE IF NOT EXISTS search_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    original_question TEXT NOT NULL,
    final_answer TEXT,
    gbr_reward FLOAT,
    turns_count INTEGER NOT NULL DEFAULT 0,
    documents_count INTEGER NOT NULL DEFAULT 0,
    search_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Index for session lookups
CREATE INDEX idx_search_sessions_user ON search_sessions(user_id);
CREATE INDEX idx_search_sessions_created ON search_sessions(created_at DESC);

-- Search turns table (details of each iteration)
CREATE TABLE IF NOT EXISTS search_turns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL,
    turn_number INTEGER NOT NULL,
    query TEXT NOT NULL,
    documents_retrieved INTEGER DEFAULT 0,
    documents_selected INTEGER DEFAULT 0,
    should_continue BOOLEAN DEFAULT true,
    reasoning TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (session_id) REFERENCES search_sessions(id) ON DELETE CASCADE
);

-- Index for turn lookups
CREATE INDEX idx_search_turns_session ON search_turns(session_id, turn_number);

-- Search documents table (documents found during search)
CREATE TABLE IF NOT EXISTS search_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL,
    turn_number INTEGER NOT NULL,
    document_id VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    title TEXT,
    relevance_score FLOAT NOT NULL,
    selected BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (session_id) REFERENCES search_sessions(id) ON DELETE CASCADE
);

-- Index for document lookups
CREATE INDEX idx_search_documents_session ON search_documents(session_id, turn_number);
CREATE INDEX idx_search_documents_relevance ON search_documents(relevance_score DESC);

-- GBR evaluation results table
CREATE TABLE IF NOT EXISTS gbr_evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL,
    training_example_id UUID,
    s3_accuracy FLOAT NOT NULL,
    baseline_accuracy FLOAT NOT NULL,
    gbr_score FLOAT NOT NULL,
    s3_documents_count INTEGER NOT NULL,
    baseline_documents_count INTEGER NOT NULL,
    evaluation_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (session_id) REFERENCES search_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (training_example_id) REFERENCES training_examples(id) ON DELETE SET NULL
);

-- Index for GBR lookups
CREATE INDEX idx_gbr_evaluations_session ON gbr_evaluations(session_id);
CREATE INDEX idx_gbr_evaluations_score ON gbr_evaluations(gbr_score DESC);

-- PPO training checkpoints table
CREATE TABLE IF NOT EXISTS ppo_checkpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    checkpoint_name VARCHAR(255) NOT NULL UNIQUE,
    step INTEGER NOT NULL,
    epoch INTEGER NOT NULL,
    total_reward FLOAT NOT NULL,
    average_gbr FLOAT NOT NULL,
    success_rate FLOAT NOT NULL,
    examples_seen INTEGER NOT NULL,
    model_params JSONB NOT NULL,
    is_best BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for checkpoint lookups
CREATE INDEX idx_ppo_checkpoints_name ON ppo_checkpoints(checkpoint_name);
CREATE INDEX idx_ppo_checkpoints_best ON ppo_checkpoints(is_best) WHERE is_best = true;

-- Training metrics table for monitoring
CREATE TABLE IF NOT EXISTS training_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    checkpoint_id UUID,
    metric_type VARCHAR(50) NOT NULL, -- 'loss', 'reward', 'gbr', 'accuracy', etc.
    metric_value FLOAT NOT NULL,
    step INTEGER NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (checkpoint_id) REFERENCES ppo_checkpoints(id) ON DELETE CASCADE
);

-- Index for metrics lookups
CREATE INDEX idx_training_metrics_checkpoint ON training_metrics(checkpoint_id);
CREATE INDEX idx_training_metrics_type ON training_metrics(metric_type, step);

-- Document embeddings cache table (if not using ai_memories)
CREATE TABLE IF NOT EXISTS document_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA256 hash of content
    content TEXT NOT NULL,
    embedding vector(1536),
    model_name VARCHAR(100) NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    accessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for embedding lookups
CREATE INDEX idx_document_embeddings_hash ON document_embeddings(document_hash);
CREATE INDEX idx_document_embeddings_vector ON document_embeddings USING ivfflat (embedding vector_cosine_ops);

-- S3 configuration table
CREATE TABLE IF NOT EXISTS s3_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_name VARCHAR(100) NOT NULL UNIQUE,
    max_turns INTEGER DEFAULT 4,
    docs_per_turn INTEGER DEFAULT 3,
    temperature FLOAT DEFAULT 0.7,
    top_p FLOAT DEFAULT 0.9,
    stop_threshold FLOAT DEFAULT 0.8,
    cache_enabled BOOLEAN DEFAULT true,
    embedding_model VARCHAR(100) DEFAULT 'e5-base-v2',
    generator_models JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only one config can be active at a time
CREATE UNIQUE INDEX idx_s3_config_active ON s3_config(is_active) WHERE is_active = true;

-- Insert default configuration
INSERT INTO s3_config (
    config_name,
    max_turns,
    docs_per_turn,
    temperature,
    top_p,
    stop_threshold,
    cache_enabled,
    embedding_model,
    generator_models,
    is_active
) VALUES (
    'default',
    4,
    3,
    0.7,
    0.9,
    0.8,
    true,
    'e5-base-v2',
    '[
        {"name": "ollama", "endpoint": "http://localhost:11434", "max_context": 32768},
        {"name": "gpt-4", "endpoint": "https://api.openai.com/v1", "max_context": 128000}
    ]'::jsonb,
    true
) ON CONFLICT (config_name) DO NOTHING;

-- Function to update accessed_at for cache management
CREATE OR REPLACE FUNCTION update_document_accessed_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.accessed_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update accessed_at on SELECT
CREATE TRIGGER update_document_embeddings_accessed
    BEFORE UPDATE ON document_embeddings
    FOR EACH ROW
    EXECUTE FUNCTION update_document_accessed_at();

-- Function to clean old cache entries
CREATE OR REPLACE FUNCTION clean_old_cache_entries()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM document_embeddings
    WHERE accessed_at < NOW() - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions for the service
GRANT ALL ON training_examples TO service_role;
GRANT ALL ON search_sessions TO service_role;
GRANT ALL ON search_turns TO service_role;
GRANT ALL ON search_documents TO service_role;
GRANT ALL ON gbr_evaluations TO service_role;
GRANT ALL ON ppo_checkpoints TO service_role;
GRANT ALL ON training_metrics TO service_role;
GRANT ALL ON document_embeddings TO service_role;
GRANT ALL ON s3_config TO service_role;

-- Comments for documentation
COMMENT ON TABLE training_examples IS 'Training examples for S3 searcher with questions and gold answers';
COMMENT ON TABLE search_sessions IS 'S3 search sessions tracking complete search interactions';
COMMENT ON TABLE search_turns IS 'Individual search iterations within a session';
COMMENT ON TABLE search_documents IS 'Documents retrieved and selected during search';
COMMENT ON TABLE gbr_evaluations IS 'GBR (Gain Beyond RAG) evaluation results';
COMMENT ON TABLE ppo_checkpoints IS 'PPO training checkpoints for model versioning';
COMMENT ON TABLE training_metrics IS 'Training metrics for monitoring and analysis';
COMMENT ON TABLE document_embeddings IS 'Cache for document embeddings to avoid recomputation';
COMMENT ON TABLE s3_config IS 'S3 searcher configuration management';