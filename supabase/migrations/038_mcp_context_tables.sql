-- MCP Context Storage Tables for Universal AI Tools
-- These tables support context persistence and pattern learning for the MCP server

-- Enable vector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Context storage table
CREATE TABLE IF NOT EXISTS mcp_context (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    embedding VECTOR(1536) -- For future semantic search with embeddings
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_mcp_context_category ON mcp_context(category);
CREATE INDEX IF NOT EXISTS idx_mcp_context_timestamp ON mcp_context(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_context_content_gin ON mcp_context USING gin(to_tsvector('english', content));

-- Code patterns table for storing successful fixes
CREATE TABLE IF NOT EXISTS mcp_code_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_type VARCHAR(100) NOT NULL,
    before_code TEXT NOT NULL,
    after_code TEXT NOT NULL,
    description TEXT NOT NULL,
    error_types TEXT[] DEFAULT '{}',
    success_rate DECIMAL(3,2) DEFAULT 1.0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for code patterns
CREATE INDEX IF NOT EXISTS idx_mcp_patterns_type ON mcp_code_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_mcp_patterns_success_rate ON mcp_code_patterns(success_rate DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_patterns_error_types ON mcp_code_patterns USING gin(error_types);

-- Task progress tracking
CREATE TABLE IF NOT EXISTS mcp_task_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id VARCHAR(200) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for task progress
CREATE INDEX IF NOT EXISTS idx_mcp_tasks_status ON mcp_task_progress(status);
CREATE INDEX IF NOT EXISTS idx_mcp_tasks_updated_at ON mcp_task_progress(updated_at DESC);

-- Error analysis table for TypeScript error patterns
CREATE TABLE IF NOT EXISTS mcp_error_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    error_type VARCHAR(100) NOT NULL,
    error_message TEXT NOT NULL,
    file_path TEXT,
    line_number INTEGER,
    solution_pattern TEXT,
    frequency INTEGER DEFAULT 1,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for error analysis
CREATE INDEX IF NOT EXISTS idx_mcp_errors_type ON mcp_error_analysis(error_type);
CREATE INDEX IF NOT EXISTS idx_mcp_errors_frequency ON mcp_error_analysis(frequency DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_errors_last_seen ON mcp_error_analysis(last_seen DESC);

-- Update timestamp triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers
DROP TRIGGER IF EXISTS update_mcp_code_patterns_updated_at ON mcp_code_patterns;
CREATE TRIGGER update_mcp_code_patterns_updated_at 
    BEFORE UPDATE ON mcp_code_patterns 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_mcp_task_progress_updated_at ON mcp_task_progress;
CREATE TRIGGER update_mcp_task_progress_updated_at 
    BEFORE UPDATE ON mcp_task_progress 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE mcp_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_code_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_task_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_error_analysis ENABLE ROW LEVEL SECURITY;

-- Allow all operations for service role (used by MCP server)
CREATE POLICY "Allow all for service role on mcp_context" ON mcp_context
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow all for service role on mcp_code_patterns" ON mcp_code_patterns
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow all for service role on mcp_task_progress" ON mcp_task_progress
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow all for service role on mcp_error_analysis" ON mcp_error_analysis
    FOR ALL USING (auth.role() = 'service_role');

-- Grant permissions to authenticated users (for development)
GRANT ALL ON mcp_context TO authenticated;
GRANT ALL ON mcp_code_patterns TO authenticated;
GRANT ALL ON mcp_task_progress TO authenticated;
GRANT ALL ON mcp_error_analysis TO authenticated;

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Comments for documentation
COMMENT ON TABLE mcp_context IS 'Stores project context, patterns, and knowledge for MCP server';
COMMENT ON TABLE mcp_code_patterns IS 'Stores successful code fix patterns for pattern learning';
COMMENT ON TABLE mcp_task_progress IS 'Tracks task progress and development milestones';
COMMENT ON TABLE mcp_error_analysis IS 'Analyzes TypeScript error patterns and solutions';

-- Insert some initial context to test the system
INSERT INTO mcp_context (content, category, metadata) VALUES 
(
    'Universal AI Tools is a sophisticated AI platform featuring service-oriented architecture, MLX fine-tuning, intelligent parameter automation, and distributed learning systems.',
    'project_overview',
    '{"importance": "high", "source": "project_setup"}'
) ON CONFLICT DO NOTHING;

INSERT INTO mcp_context (content, category, metadata) VALUES 
(
    'TypeScript errors were reduced from 33,131 to 7,075 through systematic pattern-based fixes. Aggressive string replacement caused regressions, requiring more conservative approaches.',
    'error_reduction_history',
    '{"error_count_before": 33131, "error_count_after": 7075, "improvement_percentage": 78.6}'
) ON CONFLICT DO NOTHING;

INSERT INTO mcp_code_patterns (pattern_type, before_code, after_code, description, error_types) VALUES 
(
    'nested_ternary_fix',
    'const result = condition ? value1 : condition2 ? value2 : value3;',
    'const result = determineResult(condition, condition2, value1, value2, value3);',
    'Replace nested ternary operators with explicit functions for better readability',
    ARRAY['readability', 'complexity']
) ON CONFLICT DO NOTHING;