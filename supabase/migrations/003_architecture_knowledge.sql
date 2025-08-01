-- =====================================================
-- Architecture Knowledge System for Universal AI Tools
-- Version: 1.0.0
-- Date: 2025-07-30
-- =====================================================
-- This migration adds comprehensive architecture pattern storage
-- to enable context-aware architectural guidance

-- =====================================================
-- 1. ARCHITECTURE PATTERNS TABLE
-- =====================================================

-- Main table for storing architectural patterns
CREATE TABLE IF NOT EXISTS architecture_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    framework TEXT NOT NULL CHECK (framework IN ('memgpt', 'langchain', 'langgraph', 'crewai', 'autogen', 'llamaindex', 'superagent', 'opendevin', 'general')),
    pattern_type TEXT NOT NULL CHECK (pattern_type IN ('memory', 'orchestration', 'tool_use', 'multi_model', 'context_management', 'agent_coordination')),
    description TEXT NOT NULL,
    implementation TEXT,
    pros TEXT[] DEFAULT '{}',
    cons TEXT[] DEFAULT '{}',
    use_cases TEXT[] DEFAULT '{}',
    embedding vector(1536),
    success_rate REAL DEFAULT 0.5 CHECK (success_rate >= 0 AND success_rate <= 1),
    usage_count INTEGER DEFAULT 0,
    complexity TEXT CHECK (complexity IN ('simple', 'medium', 'complex')),
    required_services TEXT[] DEFAULT '{}',
    performance_impact TEXT CHECK (performance_impact IN ('low', 'medium', 'high')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(name, framework)
);

-- =====================================================
-- 2. FRAMEWORK COMPARISONS TABLE
-- =====================================================

-- Store comparisons between different frameworks
CREATE TABLE IF NOT EXISTS framework_comparisons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    framework_a TEXT NOT NULL,
    framework_b TEXT NOT NULL,
    comparison_aspect TEXT NOT NULL,
    analysis TEXT NOT NULL,
    recommendation TEXT,
    embedding vector(1536),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_comparison UNIQUE(framework_a, framework_b, comparison_aspect)
);

-- =====================================================
-- 3. PATTERN USAGE TRACKING
-- =====================================================

-- Track how patterns are used and their effectiveness
CREATE TABLE IF NOT EXISTS pattern_usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pattern_id UUID REFERENCES architecture_patterns(id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL,
    user_id UUID,
    context JSONB NOT NULL,
    success BOOLEAN NOT NULL,
    performance_metrics JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    execution_time_ms INTEGER,
    tokens_used INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 4. PATTERN RELATIONSHIPS
-- =====================================================

-- Define relationships between patterns (complementary, alternative, etc.)
CREATE TABLE IF NOT EXISTS pattern_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pattern_a_id UUID REFERENCES architecture_patterns(id) ON DELETE CASCADE,
    pattern_b_id UUID REFERENCES architecture_patterns(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL CHECK (relationship_type IN ('complements', 'alternative_to', 'requires', 'conflicts_with', 'extends')),
    strength REAL DEFAULT 1.0 CHECK (strength >= 0 AND strength <= 1),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_relationship UNIQUE(pattern_a_id, pattern_b_id, relationship_type),
    CONSTRAINT no_self_reference CHECK (pattern_a_id != pattern_b_id)
);

-- =====================================================
-- 5. IMPLEMENTATION EXAMPLES
-- =====================================================

-- Store real implementation examples for patterns
CREATE TABLE IF NOT EXISTS pattern_implementations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pattern_id UUID REFERENCES architecture_patterns(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    code TEXT NOT NULL,
    language TEXT NOT NULL,
    description TEXT,
    success_metrics JSONB,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 6. INDEXES FOR PERFORMANCE
-- =====================================================

-- Vector similarity search indexes
CREATE INDEX IF NOT EXISTS idx_patterns_embedding ON architecture_patterns 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_comparisons_embedding ON framework_comparisons 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Standard indexes
CREATE INDEX IF NOT EXISTS idx_patterns_framework ON architecture_patterns (framework);
CREATE INDEX IF NOT EXISTS idx_patterns_type ON architecture_patterns (pattern_type);
CREATE INDEX IF NOT EXISTS idx_patterns_success ON architecture_patterns (success_rate DESC);
CREATE INDEX IF NOT EXISTS idx_patterns_usage ON architecture_patterns (usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_usage_pattern ON pattern_usage_logs (pattern_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_agent ON pattern_usage_logs (agent_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_success ON pattern_usage_logs (success, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_relationships_pattern_a ON pattern_relationships (pattern_a_id);
CREATE INDEX IF NOT EXISTS idx_relationships_pattern_b ON pattern_relationships (pattern_b_id);

-- =====================================================
-- 7. FUNCTIONS FOR PATTERN MATCHING
-- =====================================================

-- Function to find similar patterns using vector similarity
CREATE OR REPLACE FUNCTION match_architecture_patterns(
    query_embedding vector,
    match_threshold REAL DEFAULT 0.7,
    match_count INTEGER DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    framework TEXT,
    pattern_type TEXT,
    description TEXT,
    implementation TEXT,
    similarity_score REAL,
    success_rate REAL,
    usage_count INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ap.id,
        ap.name,
        ap.framework,
        ap.pattern_type,
        ap.description,
        ap.implementation,
        1 - (ap.embedding <=> query_embedding) as similarity_score,
        ap.success_rate,
        ap.usage_count
    FROM architecture_patterns ap
    WHERE ap.embedding IS NOT NULL
    AND 1 - (ap.embedding <=> query_embedding) >= match_threshold
    ORDER BY 
        (1 - (ap.embedding <=> query_embedding)) * 0.7 + 
        ap.success_rate * 0.2 + 
        (LEAST(ap.usage_count, 100) / 100.0) * 0.1 DESC
    LIMIT match_count;
END;
$$;

-- Function to get pattern recommendations with alternatives
CREATE OR REPLACE FUNCTION get_pattern_recommendations(
    pattern_id UUID,
    include_alternatives BOOLEAN DEFAULT true
)
RETURNS TABLE (
    pattern_id UUID,
    pattern_name TEXT,
    relationship_type TEXT,
    strength REAL,
    description TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- Get the main pattern
    RETURN QUERY
    SELECT 
        ap.id,
        ap.name,
        'primary'::TEXT,
        1.0::REAL,
        ap.description
    FROM architecture_patterns ap
    WHERE ap.id = get_pattern_recommendations.pattern_id;
    
    -- Get related patterns if requested
    IF include_alternatives THEN
        RETURN QUERY
        SELECT 
            ap.id,
            ap.name,
            pr.relationship_type,
            pr.strength,
            COALESCE(pr.description, ap.description)
        FROM pattern_relationships pr
        JOIN architecture_patterns ap ON ap.id = pr.pattern_b_id
        WHERE pr.pattern_a_id = get_pattern_recommendations.pattern_id
        AND pr.relationship_type IN ('complements', 'alternative_to')
        ORDER BY pr.strength DESC;
    END IF;
END;
$$;

-- Function to update pattern success rate based on recent usage
CREATE OR REPLACE FUNCTION update_pattern_success_rate(pattern_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    new_success_rate REAL;
    total_usage INTEGER;
BEGIN
    -- Calculate success rate from last 100 uses
    SELECT 
        COUNT(*)::REAL / NULLIF(COUNT(*), 0),
        COUNT(*)
    INTO new_success_rate, total_usage
    FROM (
        SELECT success
        FROM pattern_usage_logs
        WHERE pattern_usage_logs.pattern_id = update_pattern_success_rate.pattern_id
        ORDER BY created_at DESC
        LIMIT 100
    ) recent_logs
    WHERE success = true;
    
    -- Update the pattern with new success rate and increment usage count
    UPDATE architecture_patterns
    SET 
        success_rate = COALESCE(new_success_rate, success_rate),
        usage_count = usage_count + 1,
        updated_at = NOW()
    WHERE id = update_pattern_success_rate.pattern_id;
END;
$$;

-- =====================================================
-- 8. TRIGGERS
-- =====================================================

-- Trigger to update success rate after each usage log
CREATE OR REPLACE FUNCTION trigger_update_pattern_stats()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM update_pattern_success_rate(NEW.pattern_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_pattern_stats_after_usage
AFTER INSERT ON pattern_usage_logs
FOR EACH ROW
EXECUTE FUNCTION trigger_update_pattern_stats();

-- =====================================================
-- 9. ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on pattern usage logs for user isolation
ALTER TABLE pattern_usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies (when auth schema exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
        -- Users can only see their own pattern usage
        EXECUTE 'CREATE POLICY "Users can view their own pattern usage" ON pattern_usage_logs
            FOR SELECT USING (auth.uid() = user_id)';
        
        -- Anyone can read patterns (they're shared knowledge)
        EXECUTE 'CREATE POLICY "Anyone can view architecture patterns" ON architecture_patterns
            FOR SELECT USING (true)';
        
        -- Only admins can modify patterns
        EXECUTE 'CREATE POLICY "Only admins can modify patterns" ON architecture_patterns
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM auth.users
                    WHERE auth.uid() = id
                    AND raw_user_meta_data->>"role" = "admin"
                )
            )';
    END IF;
END $$;

-- =====================================================
-- 10. INITIAL SEED DATA
-- =====================================================

-- Insert some foundational patterns
INSERT INTO architecture_patterns (name, framework, pattern_type, description, pros, cons, use_cases, complexity) VALUES
('Virtual Extended Context', 'memgpt', 'memory', 'Manage LLM context by swapping information in and out like an OS manages memory', 
 ARRAY['Virtually unlimited context', 'Efficient memory usage', 'Preserves conversation flow'],
 ARRAY['Complex implementation', 'Latency for context swaps', 'Requires external storage'],
 ARRAY['Long conversations', 'Document analysis', 'Multi-session memory'],
 'complex'),

('Graph-Based Workflows', 'langgraph', 'orchestration', 'Define agent workflows as directed graphs with nodes and edges',
 ARRAY['Visual workflow design', 'Complex logic support', 'Easy debugging'],
 ARRAY['Learning curve', 'Overhead for simple tasks'],
 ARRAY['Multi-step processes', 'Conditional workflows', 'State machines'],
 'medium'),

('Role-Based Agent Crews', 'crewai', 'agent_coordination', 'Organize agents with human team metaphors (manager, worker, etc)',
 ARRAY['Intuitive design', 'Clear responsibilities', 'Easy to understand'],
 ARRAY['May oversimplify complex interactions', 'Role rigidity'],
 ARRAY['Team simulations', 'Hierarchical tasks', 'Delegation patterns'],
 'simple')
ON CONFLICT (name, framework) DO NOTHING;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================