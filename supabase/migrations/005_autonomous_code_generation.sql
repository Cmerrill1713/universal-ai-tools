-- =====================================================
-- Autonomous Code Generation System for Universal AI Tools
-- Version: 1.0.0
-- Date: 2025-08-01
-- =====================================================
-- This migration adds comprehensive code generation, analysis, and security
-- capabilities to support autonomous coding with MLX fine-tuning integration

-- =====================================================
-- 1. REPOSITORY PATTERNS & KNOWLEDGE STORAGE
-- =====================================================

-- Repository patterns for code generation training and context
CREATE TABLE IF NOT EXISTS repository_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repository_url TEXT NOT NULL,
    repository_name TEXT NOT NULL,
    language TEXT NOT NULL,
    pattern_type TEXT NOT NULL, -- 'function', 'class', 'interface', 'component', 'api_endpoint', 'test_pattern'
    pattern_name TEXT NOT NULL,
    pattern_content TEXT NOT NULL,
    pattern_signature TEXT, -- Function/method signatures for quick matching
    usage_frequency INTEGER DEFAULT 1,
    quality_score FLOAT DEFAULT 0.0,
    security_score FLOAT DEFAULT 1.0,
    performance_score FLOAT DEFAULT 0.0,
    complexity_score FLOAT DEFAULT 0.0,
    file_path TEXT,
    line_start INTEGER,
    line_end INTEGER,
    git_commit_hash TEXT,
    extracted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient pattern matching and retrieval
CREATE INDEX IF NOT EXISTS idx_repository_patterns_repo_lang ON repository_patterns (repository_url, language);
CREATE INDEX IF NOT EXISTS idx_repository_patterns_type ON repository_patterns (pattern_type);
CREATE INDEX IF NOT EXISTS idx_repository_patterns_quality ON repository_patterns (quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_repository_patterns_usage ON repository_patterns (usage_frequency DESC);
CREATE INDEX IF NOT EXISTS idx_repository_patterns_signature ON repository_patterns USING GIN (to_tsvector('english', pattern_signature));

-- =====================================================
-- 2. CODE GENERATION TRACKING & LEARNING
-- =====================================================

-- Track all code generations for continuous learning
CREATE TABLE IF NOT EXISTS code_generations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    session_id TEXT,
    prompt TEXT NOT NULL,
    generated_code TEXT NOT NULL,
    language TEXT NOT NULL,
    model_used TEXT NOT NULL,
    repository_context JSONB, -- Context about the repository/project
    generation_type TEXT DEFAULT 'completion', -- 'completion', 'refactoring', 'review', 'optimization'
    
    -- Quality metrics
    quality_score FLOAT DEFAULT 0.0,
    security_score FLOAT DEFAULT 0.0,
    performance_score FLOAT DEFAULT 0.0,
    maintainability_score FLOAT DEFAULT 0.0,
    
    -- User feedback and acceptance
    accepted BOOLEAN DEFAULT NULL,
    user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
    feedback TEXT,
    
    -- Performance metrics
    execution_time_ms INTEGER,
    token_count INTEGER,
    context_tokens INTEGER,
    
    -- Integration tracking
    integrated_at TIMESTAMP WITH TIME ZONE,
    git_commit_hash TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for analytics and learning
CREATE INDEX IF NOT EXISTS idx_code_generations_user ON code_generations (user_id);
CREATE INDEX IF NOT EXISTS idx_code_generations_model ON code_generations (model_used);
CREATE INDEX IF NOT EXISTS idx_code_generations_language ON code_generations (language);
CREATE INDEX IF NOT EXISTS idx_code_generations_accepted ON code_generations (accepted) WHERE accepted IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_code_generations_quality ON code_generations (quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_code_generations_performance ON code_generations (execution_time_ms);

-- =====================================================
-- 3. SECURITY VULNERABILITY PATTERNS & FIXES
-- =====================================================

-- Security patterns for vulnerability detection and automated fixes
CREATE TABLE IF NOT EXISTS security_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vulnerability_type TEXT NOT NULL, -- 'sql_injection', 'xss', 'csrf', 'buffer_overflow', etc.
    language TEXT NOT NULL,
    framework TEXT, -- Optional framework context (express, react, etc.)
    pattern_regex TEXT NOT NULL,
    pattern_description TEXT NOT NULL,
    fix_template TEXT NOT NULL,
    fix_explanation TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    cwe_id TEXT, -- Common Weakness Enumeration ID
    owasp_category TEXT, -- OWASP Top 10 category
    
    -- Pattern effectiveness tracking
    detection_accuracy FLOAT DEFAULT 0.0,
    false_positive_rate FLOAT DEFAULT 0.0,
    fix_success_rate FLOAT DEFAULT 0.0,
    
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for security scanning performance
CREATE INDEX IF NOT EXISTS idx_security_patterns_lang ON security_patterns (language);
CREATE INDEX IF NOT EXISTS idx_security_patterns_type ON security_patterns (vulnerability_type);
CREATE INDEX IF NOT EXISTS idx_security_patterns_severity ON security_patterns (severity);
CREATE INDEX IF NOT EXISTS idx_security_patterns_enabled ON security_patterns (enabled) WHERE enabled = true;

-- =====================================================
-- 4. CODE QUALITY METRICS & ASSESSMENT
-- =====================================================

-- Code quality assessments for continuous improvement
CREATE TABLE IF NOT EXISTS code_quality_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code_generation_id UUID REFERENCES code_generations(id),
    file_path TEXT,
    language TEXT NOT NULL,
    
    -- Quality metrics
    cyclomatic_complexity INTEGER DEFAULT 0,
    lines_of_code INTEGER DEFAULT 0,
    code_duplication_score FLOAT DEFAULT 0.0,
    test_coverage FLOAT DEFAULT 0.0,
    documentation_score FLOAT DEFAULT 0.0,
    naming_convention_score FLOAT DEFAULT 0.0,
    
    -- Security assessment
    security_vulnerabilities INTEGER DEFAULT 0,
    security_score FLOAT DEFAULT 1.0,
    
    -- Performance assessment
    performance_score FLOAT DEFAULT 0.0,
    memory_efficiency_score FLOAT DEFAULT 0.0,
    
    -- Overall assessment
    overall_quality_score FLOAT DEFAULT 0.0,
    recommendations JSONB, -- Array of improvement recommendations
    
    assessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for quality analytics
CREATE INDEX IF NOT EXISTS idx_quality_assessments_generation ON code_quality_assessments (code_generation_id);
CREATE INDEX IF NOT EXISTS idx_quality_assessments_language ON code_quality_assessments (language);
CREATE INDEX IF NOT EXISTS idx_quality_assessments_overall ON code_quality_assessments (overall_quality_score DESC);

-- =====================================================
-- 5. MLX FINE-TUNING JOB TRACKING (Extend existing)
-- =====================================================

-- Extend MLX fine-tuning for code-specific models
CREATE TABLE IF NOT EXISTS mlx_code_fine_tuning_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    repository_url TEXT NOT NULL,
    base_model TEXT NOT NULL,
    target_languages TEXT[] NOT NULL,
    
    -- Training configuration
    training_data_size INTEGER,
    lora_rank INTEGER DEFAULT 16,
    learning_rate FLOAT DEFAULT 1e-5,
    batch_size INTEGER DEFAULT 4,
    max_iterations INTEGER DEFAULT 1000,
    
    -- Training metrics
    training_loss FLOAT,
    validation_loss FLOAT,
    accuracy_score FLOAT,
    perplexity_score FLOAT,
    
    -- Model metadata
    model_path TEXT,
    model_size_mb INTEGER,
    inference_speed_ms INTEGER,
    
    -- Job status and timing
    status TEXT DEFAULT 'pending', -- 'pending', 'training', 'completed', 'failed'
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    training_duration_seconds INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for MLX job management
CREATE INDEX IF NOT EXISTS idx_mlx_code_jobs_user ON mlx_code_fine_tuning_jobs (user_id);
CREATE INDEX IF NOT EXISTS idx_mlx_code_jobs_repo ON mlx_code_fine_tuning_jobs (repository_url);
CREATE INDEX IF NOT EXISTS idx_mlx_code_jobs_status ON mlx_code_fine_tuning_jobs (status);
CREATE INDEX IF NOT EXISTS idx_mlx_code_jobs_accuracy ON mlx_code_fine_tuning_jobs (accuracy_score DESC);

-- =====================================================
-- 6. CODE ANALYSIS CACHE & PERFORMANCE
-- =====================================================

-- Cache for AST analysis and repository context
CREATE TABLE IF NOT EXISTS code_analysis_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cache_key TEXT UNIQUE NOT NULL, -- Hash of file content + analysis type
    file_path TEXT NOT NULL,
    repository_url TEXT,
    language TEXT NOT NULL,
    analysis_type TEXT NOT NULL, -- 'ast', 'complexity', 'patterns', 'security'
    
    -- Analysis results
    analysis_result JSONB NOT NULL,
    confidence_score FLOAT DEFAULT 0.0,
    
    -- Cache management
    file_hash TEXT NOT NULL, -- SHA256 of file content
    expires_at TIMESTAMP WITH TIME ZONE,
    access_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for cache performance
CREATE INDEX IF NOT EXISTS idx_code_analysis_cache_key ON code_analysis_cache (cache_key);
CREATE INDEX IF NOT EXISTS idx_code_analysis_cache_file ON code_analysis_cache (file_path);
CREATE INDEX IF NOT EXISTS idx_code_analysis_cache_type ON code_analysis_cache (analysis_type);
CREATE INDEX IF NOT EXISTS idx_code_analysis_cache_expires ON code_analysis_cache (expires_at) WHERE expires_at IS NOT NULL;

-- =====================================================
-- 7. ROW LEVEL SECURITY (RLS) SETUP
-- =====================================================

-- Enable RLS on all tables for multi-tenant isolation
ALTER TABLE repository_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_quality_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mlx_code_fine_tuning_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_analysis_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies for repository_patterns
CREATE POLICY "Users can view their own repository patterns" ON repository_patterns
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert their own repository patterns" ON repository_patterns
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for code_generations
CREATE POLICY "Users can view their own code generations" ON code_generations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own code generations" ON code_generations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own code generations" ON code_generations
    FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for MLX fine-tuning jobs
CREATE POLICY "Users can view their own MLX jobs" ON mlx_code_fine_tuning_jobs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own MLX jobs" ON mlx_code_fine_tuning_jobs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own MLX jobs" ON mlx_code_fine_tuning_jobs
    FOR UPDATE USING (auth.uid() = user_id);

-- Security patterns are globally readable but only admins can modify
CREATE POLICY "Anyone can view security patterns" ON security_patterns
    FOR SELECT USING (true);

-- Code analysis cache is shared but access-controlled
CREATE POLICY "Users can access code analysis cache" ON code_analysis_cache
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert into code analysis cache" ON code_analysis_cache
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- =====================================================
-- 8. UTILITY FUNCTIONS FOR CODE GENERATION
-- =====================================================

-- Function to get repository patterns by language and type
CREATE OR REPLACE FUNCTION get_repository_patterns(
    p_language TEXT,
    p_pattern_type TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    pattern_name TEXT,
    pattern_content TEXT,
    pattern_signature TEXT,
    quality_score FLOAT,
    usage_frequency INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rp.id,
        rp.pattern_name,
        rp.pattern_content,
        rp.pattern_signature,
        rp.quality_score,
        rp.usage_frequency
    FROM repository_patterns rp
    WHERE rp.language = p_language
    AND (p_pattern_type IS NULL OR rp.pattern_type = p_pattern_type)
    ORDER BY rp.quality_score DESC, rp.usage_frequency DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record code generation feedback
CREATE OR REPLACE FUNCTION record_code_feedback(
    p_generation_id UUID,
    p_accepted BOOLEAN,
    p_rating INTEGER DEFAULT NULL,
    p_feedback TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE code_generations
    SET 
        accepted = p_accepted,
        user_rating = p_rating,
        feedback = p_feedback,
        updated_at = NOW()
    WHERE id = p_generation_id
    AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get security patterns for scanning
CREATE OR REPLACE FUNCTION get_security_patterns(p_language TEXT)
RETURNS TABLE (
    vulnerability_type TEXT,
    pattern_regex TEXT,
    fix_template TEXT,
    severity TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sp.vulnerability_type,
        sp.pattern_regex,
        sp.fix_template,
        sp.severity
    FROM security_patterns sp
    WHERE sp.language = p_language
    AND sp.enabled = true
    ORDER BY 
        CASE sp.severity
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            WHEN 'low' THEN 4
        END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 9. INITIAL SECURITY PATTERNS DATA
-- =====================================================

-- Insert common security patterns for TypeScript/JavaScript
INSERT INTO security_patterns (vulnerability_type, language, pattern_regex, pattern_description, fix_template, fix_explanation, severity, cwe_id) VALUES
('sql_injection', 'typescript', '\$\{[^}]*\}.*(?:SELECT|INSERT|UPDATE|DELETE)', 'SQL injection via template literals', 'Use parameterized queries or prepared statements', 'Replace template literals in SQL with parameterized queries to prevent SQL injection', 'critical', 'CWE-89'),
('xss', 'typescript', 'innerHTML\s*=\s*[^;]*\$\{', 'XSS via innerHTML with template literals', 'Use textContent or sanitize input', 'Sanitize user input before inserting into DOM to prevent XSS attacks', 'high', 'CWE-79'),
('path_traversal', 'typescript', '(path\.join|fs\.[^(]*)\([^)]*\.\.\/', 'Path traversal vulnerability', 'Validate and sanitize file paths', 'Validate file paths to prevent directory traversal attacks', 'high', 'CWE-22'),
('weak_crypto', 'typescript', 'Math\.random\(\)', 'Weak random number generation', 'Use crypto.randomBytes() for security-sensitive operations', 'Use cryptographically secure random number generation for security purposes', 'medium', 'CWE-338'),
('hardcoded_secret', 'typescript', '(password|secret|key|token)\s*[:=]\s*["\'']\w+', 'Hardcoded secrets in code', 'Use environment variables or secure vault', 'Store secrets in environment variables or secure configuration', 'high', 'CWE-798');

-- Insert Python security patterns
INSERT INTO security_patterns (vulnerability_type, language, pattern_regex, pattern_description, fix_template, fix_explanation, severity, cwe_id) VALUES
('sql_injection', 'python', 'execute\([^)]*%[^)]*\)', 'SQL injection via string formatting', 'Use parameterized queries', 'Use parameterized queries instead of string formatting in SQL', 'critical', 'CWE-89'),
('command_injection', 'python', 'os\.(system|popen)\([^)]*input\(', 'Command injection via user input', 'Use subprocess with shell=False', 'Validate input and use subprocess securely to prevent command injection', 'critical', 'CWE-78'),
('pickle_injection', 'python', 'pickle\.loads?\([^)]*input', 'Unsafe deserialization with pickle', 'Use safe serialization formats like JSON', 'Avoid pickle with untrusted data; use safer alternatives like JSON', 'high', 'CWE-502'),
('weak_crypto', 'python', 'random\.(choice|randint)', 'Weak random number generation', 'Use secrets module for cryptographic purposes', 'Use secrets module instead of random for security-sensitive operations', 'medium', 'CWE-338');

-- =====================================================
-- 10. PERFORMANCE OPTIMIZATIONS
-- =====================================================

-- Create materialized view for repository pattern analytics
CREATE MATERIALIZED VIEW IF NOT EXISTS repository_pattern_stats AS
SELECT 
    language,
    pattern_type,
    COUNT(*) as pattern_count,
    AVG(quality_score) as avg_quality,
    AVG(usage_frequency) as avg_usage,
    MAX(updated_at) as last_updated
FROM repository_patterns
GROUP BY language, pattern_type;

-- Index on the materialized view
CREATE INDEX IF NOT EXISTS idx_repo_pattern_stats ON repository_pattern_stats (language, pattern_type);

-- Function to refresh pattern stats
CREATE OR REPLACE FUNCTION refresh_repository_pattern_stats()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW repository_pattern_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Autonomous Code Generation System v1.0.0 installed successfully
-- Tables: 6 new tables for comprehensive code generation support
-- Functions: 4 utility functions for pattern matching and feedback
-- Security: RLS enabled with appropriate policies
-- Performance: Optimized indexes and materialized views
-- Initial Data: Common security patterns for TypeScript and Python
-- =====================================================