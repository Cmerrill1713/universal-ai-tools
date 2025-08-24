-- Universal AI Tools Knowledge Base Schema for Supabase
-- This creates a comprehensive vector-based knowledge system using pgvector

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ============================================================================
-- 1. KNOWLEDGE DOCUMENTS TABLE
-- ============================================================================

CREATE TABLE knowledge_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    subcategory TEXT,
    source TEXT NOT NULL, -- 'user_input', 'code_analysis', 'web_research', 'ai_generated'
    source_url TEXT,
    file_path TEXT,
    
    -- Vector embedding for semantic search (384 dimensions for gte-small model)
    embedding vector(384),
    
    -- Metadata for enhanced search and filtering
    metadata JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    language TEXT DEFAULT 'en',
    
    -- Quality and relevance scoring
    relevance_score REAL DEFAULT 0.0,
    confidence_score REAL DEFAULT 0.0,
    usage_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed TIMESTAMPTZ,
    
    -- User and session tracking
    created_by_user_id TEXT,
    session_id TEXT,
    
    -- Status and lifecycle management
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'draft', 'deprecated')),
    version INTEGER DEFAULT 1,
    parent_document_id UUID REFERENCES knowledge_documents(id),
    
    -- Full-text search
    search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', title || ' ' || content)) STORED
);

-- ============================================================================
-- 2. CODE PATTERNS TABLE
-- ============================================================================

CREATE TABLE code_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pattern_name TEXT NOT NULL,
    pattern_type TEXT NOT NULL, -- 'error_fix', 'optimization', 'best_practice', 'anti_pattern'
    language TEXT NOT NULL, -- 'rust', 'typescript', 'swift', 'go', 'python'
    framework TEXT, -- 'axum', 'react', 'swiftui', 'gin'
    
    -- Pattern definition
    problem_description TEXT NOT NULL,
    solution_code TEXT NOT NULL,
    example_usage TEXT,
    explanation TEXT,
    
    -- Vector embedding for pattern matching
    embedding vector(384),
    
    -- Context and applicability
    applicable_contexts TEXT[] DEFAULT '{}',
    prerequisites TEXT[] DEFAULT '{}',
    related_patterns UUID[] DEFAULT '{}',
    
    -- Metrics and effectiveness
    success_rate REAL DEFAULT 0.0,
    performance_impact TEXT, -- 'low', 'medium', 'high', 'critical'
    difficulty_level INTEGER DEFAULT 1 CHECK (difficulty_level BETWEEN 1 AND 5),
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_used TIMESTAMPTZ,
    
    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'deprecated', 'experimental'))
);

-- ============================================================================
-- 3. AI INSIGHTS TABLE
-- ============================================================================

CREATE TABLE ai_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    insight_type TEXT NOT NULL, -- 'performance', 'security', 'architecture', 'maintenance'
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    
    -- AI-generated content
    reasoning TEXT,
    recommendations TEXT[],
    confidence REAL DEFAULT 0.0 CHECK (confidence BETWEEN 0.0 AND 1.0),
    
    -- Vector embedding for similarity search
    embedding vector(384),
    
    -- Context and source
    source_data JSONB, -- Original data that led to this insight
    generated_by TEXT, -- 'ollama', 'lm_studio', 'claude', 'gpt'
    model_used TEXT,
    prompt_used TEXT,
    
    -- Validation and feedback
    validated BOOLEAN DEFAULT FALSE,
    user_feedback JSONB,
    effectiveness_score REAL,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'validated', 'rejected', 'pending'))
);

-- ============================================================================
-- 4. SYSTEM KNOWLEDGE TABLE
-- ============================================================================

CREATE TABLE system_knowledge (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    knowledge_type TEXT NOT NULL, -- 'configuration', 'dependency', 'service', 'api', 'deployment'
    system_component TEXT NOT NULL, -- 'api_gateway', 'llm_router', 'database', 'auth'
    
    -- Knowledge content
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    current_value TEXT,
    recommended_value TEXT,
    
    -- Context and documentation
    documentation_url TEXT,
    configuration_path TEXT,
    environment TEXT DEFAULT 'development',
    
    -- Vector embedding for intelligent configuration matching
    embedding vector(384),
    
    -- Dependencies and relationships
    dependencies TEXT[],
    affects_components TEXT[],
    required_for TEXT[],
    
    -- Health and monitoring
    last_checked TIMESTAMPTZ,
    health_status TEXT DEFAULT 'unknown', -- 'healthy', 'warning', 'critical', 'unknown'
    monitoring_enabled BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    version TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 5. CONVERSATION CONTEXT TABLE
-- ============================================================================

CREATE TABLE conversation_context (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id TEXT NOT NULL,
    user_id TEXT,
    
    -- Conversation details
    conversation_topic TEXT,
    context_summary TEXT NOT NULL,
    key_decisions TEXT[],
    action_items TEXT[],
    
    -- Vector embedding for context retrieval
    embedding vector(384),
    
    -- Context metadata
    participants TEXT[],
    conversation_length INTEGER DEFAULT 0,
    complexity_level INTEGER DEFAULT 1 CHECK (complexity_level BETWEEN 1 AND 5),
    
    -- Relationships
    related_documents UUID[],
    related_patterns UUID[],
    followup_required BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
    
    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived'))
);

-- ============================================================================
-- 6. LEARNING FEEDBACK TABLE
-- ============================================================================

CREATE TABLE learning_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feedback_type TEXT NOT NULL, -- 'correction', 'validation', 'enhancement', 'rating'
    
    -- Reference to source
    source_table TEXT NOT NULL,
    source_id UUID NOT NULL,
    
    -- Feedback content
    feedback_content TEXT NOT NULL,
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    is_positive BOOLEAN,
    
    -- User information
    user_id TEXT,
    session_id TEXT,
    
    -- Processing
    processed BOOLEAN DEFAULT FALSE,
    applied_changes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Vector similarity search indexes (using HNSW for performance)
CREATE INDEX knowledge_documents_embedding_idx ON knowledge_documents 
USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

CREATE INDEX code_patterns_embedding_idx ON code_patterns 
USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

CREATE INDEX ai_insights_embedding_idx ON ai_insights 
USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

CREATE INDEX system_knowledge_embedding_idx ON system_knowledge 
USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

CREATE INDEX conversation_context_embedding_idx ON conversation_context 
USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- Full-text search indexes
CREATE INDEX knowledge_documents_search_idx ON knowledge_documents USING gin(search_vector);
CREATE INDEX knowledge_documents_content_idx ON knowledge_documents USING gin(to_tsvector('english', content));

-- Category and filtering indexes
CREATE INDEX knowledge_documents_category_idx ON knowledge_documents (category, subcategory);
CREATE INDEX code_patterns_language_idx ON code_patterns (language, framework);
CREATE INDEX ai_insights_type_idx ON ai_insights (insight_type, category);
CREATE INDEX system_knowledge_component_idx ON system_knowledge (system_component, environment);
CREATE INDEX conversation_context_session_idx ON conversation_context (session_id, user_id);

-- Timestamp indexes for time-based queries
CREATE INDEX knowledge_documents_created_idx ON knowledge_documents (created_at DESC);
CREATE INDEX knowledge_documents_updated_idx ON knowledge_documents (updated_at DESC);
CREATE INDEX conversation_context_expires_idx ON conversation_context (expires_at);

-- Composite indexes for common query patterns
CREATE INDEX knowledge_documents_status_category_idx ON knowledge_documents (status, category) WHERE status = 'active';
CREATE INDEX code_patterns_success_idx ON code_patterns (success_rate DESC, difficulty_level) WHERE status = 'active';

-- ============================================================================
-- FUNCTIONS FOR SEMANTIC SEARCH
-- ============================================================================

-- Generic semantic search function for knowledge documents
CREATE OR REPLACE FUNCTION match_knowledge_documents(
    query_embedding vector(384),
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 10,
    category_filter text DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    content TEXT,
    category TEXT,
    source TEXT,
    similarity float,
    metadata JSONB
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        kd.id,
        kd.title,
        kd.content,
        kd.category,
        kd.source,
        1 - (kd.embedding <=> query_embedding) AS similarity,
        kd.metadata
    FROM knowledge_documents kd
    WHERE 
        kd.status = 'active'
        AND (category_filter IS NULL OR kd.category = category_filter)
        AND 1 - (kd.embedding <=> query_embedding) > match_threshold
    ORDER BY kd.embedding <=> query_embedding
    LIMIT match_count;
$$;

-- Code pattern matching function
CREATE OR REPLACE FUNCTION match_code_patterns(
    query_embedding vector(384),
    match_threshold float DEFAULT 0.6,
    match_count int DEFAULT 5,
    language_filter text DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    pattern_name TEXT,
    problem_description TEXT,
    solution_code TEXT,
    language TEXT,
    similarity float,
    success_rate REAL
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        cp.id,
        cp.pattern_name,
        cp.problem_description,
        cp.solution_code,
        cp.language,
        1 - (cp.embedding <=> query_embedding) AS similarity,
        cp.success_rate
    FROM code_patterns cp
    WHERE 
        cp.status = 'active'
        AND (language_filter IS NULL OR cp.language = language_filter)
        AND 1 - (cp.embedding <=> query_embedding) > match_threshold
    ORDER BY cp.embedding <=> query_embedding
    LIMIT match_count;
$$;

-- AI insights search function
CREATE OR REPLACE FUNCTION match_ai_insights(
    query_embedding vector(384),
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 8,
    insight_type_filter text DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    reasoning TEXT,
    recommendations TEXT[],
    similarity float,
    confidence REAL
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        ai.id,
        ai.title,
        ai.description,
        ai.reasoning,
        ai.recommendations,
        1 - (ai.embedding <=> query_embedding) AS similarity,
        ai.confidence
    FROM ai_insights ai
    WHERE 
        ai.status IN ('active', 'validated')
        AND (insight_type_filter IS NULL OR ai.insight_type = insight_type_filter)
        AND 1 - (ai.embedding <=> query_embedding) > match_threshold
    ORDER BY ai.embedding <=> query_embedding
    LIMIT match_count;
$$;

-- ============================================================================
-- AUTOMATIC CLEANUP AND MAINTENANCE
-- ============================================================================

-- Function to clean expired conversation contexts
CREATE OR REPLACE FUNCTION cleanup_expired_contexts()
RETURNS INTEGER
LANGUAGE SQL
AS $$
    DELETE FROM conversation_context 
    WHERE expires_at < NOW() AND status = 'completed'
    RETURNING (SELECT COUNT(*) FROM conversation_context WHERE expires_at < NOW());
$$;

-- Schedule automatic cleanup (runs daily at 2 AM)
SELECT cron.schedule('cleanup-expired-contexts', '0 2 * * *', 'SELECT cleanup_expired_contexts();');

-- Function to update document usage statistics
CREATE OR REPLACE FUNCTION update_document_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE knowledge_documents 
    SET 
        usage_count = usage_count + 1,
        last_accessed = NOW()
    WHERE id = NEW.source_id AND NEW.source_table = 'knowledge_documents';
    RETURN NEW;
END;
$$;

-- Trigger to automatically update usage stats
CREATE TRIGGER update_usage_stats
    AFTER INSERT ON learning_feedback
    FOR EACH ROW
    EXECUTE FUNCTION update_document_usage();

-- ============================================================================
-- INITIAL DATA SEEDING
-- ============================================================================

-- Insert some foundational knowledge documents
INSERT INTO knowledge_documents (title, content, category, source, metadata) VALUES
(
    'Universal AI Tools System Architecture',
    'The Universal AI Tools system is built on a hybrid Rust/Go/Swift architecture designed for local-first AI operations. Key components include: API Gateway (Rust), LLM Router (Rust), WebSocket Service (Go), macOS Client (Swift), and Vector Database integration.',
    'architecture',
    'system_documentation',
    '{"version": "2024.1", "components": ["api_gateway", "llm_router", "websocket_service", "macos_client"]}'
),
(
    'Local LLM Integration Best Practices',
    'For optimal local LLM integration: Use Ollama (port 11434) as primary, LM Studio (port 1234) as fallback. Configure temperature 0.1 for deterministic responses, max_tokens 2048, timeout 15 seconds. Always implement Rust-only fallback for 100% reliability.',
    'integration',
    'technical_documentation',
    '{"llm_providers": ["ollama", "lm_studio"], "fallback": "rust_only", "performance": "optimized"}'
),
(
    'Supabase Vector Database Setup',
    'Enable pgvector extension, create tables with vector(384) columns for embeddings, use HNSW indexing for performance. Implement semantic search functions with cosine similarity. Store metadata as JSONB for flexible querying.',
    'database',
    'technical_documentation',
    '{"database": "postgresql", "extension": "pgvector", "dimensions": 384, "index_type": "hnsw"}'
);

-- Insert some code patterns
INSERT INTO code_patterns (pattern_name, pattern_type, language, problem_description, solution_code, explanation) VALUES
(
    'Rust Error Handling with ?',
    'best_practice',
    'rust',
    'Replace .unwrap() calls with proper error propagation',
    'fn example() -> Result<String, Box<dyn Error>> {\n    let result = risky_operation()?;\n    Ok(result.to_string())\n}',
    'Use the ? operator to propagate errors up the call stack instead of panicking with .unwrap()'
),
(
    'SwiftUI @Observable Pattern',
    'best_practice',
    'swift',
    'Modern state management without ViewModels',
    '@Observable\nclass AppState {\n    var selectedView: String = "dashboard"\n    \n    func navigateTo(_ view: String) {\n        selectedView = view\n    }\n}',
    'Use @Observable macro for reactive state management in SwiftUI without traditional MVVM ViewModels'
);

COMMENT ON TABLE knowledge_documents IS 'Comprehensive knowledge base with vector embeddings for semantic search';
COMMENT ON TABLE code_patterns IS 'Reusable code patterns and solutions with intelligent matching';
COMMENT ON TABLE ai_insights IS 'AI-generated insights and recommendations for system improvement';
COMMENT ON TABLE system_knowledge IS 'System configuration and operational knowledge';
COMMENT ON TABLE conversation_context IS 'Conversation history and context for continued interactions';
COMMENT ON TABLE learning_feedback IS 'User feedback for continuous improvement of the knowledge base';