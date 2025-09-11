-- Code Snippets and Examples Storage
-- For storing Supabase documentation and code examples

-- Create code snippets table
CREATE TABLE IF NOT EXISTS ai_code_snippets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    language VARCHAR(50) NOT NULL,
    code TEXT NOT NULL,
    category VARCHAR(100),
    subcategory VARCHAR(100),
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create code examples table
CREATE TABLE IF NOT EXISTS ai_code_examples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    code TEXT NOT NULL,
    language VARCHAR(50) NOT NULL,
    category VARCHAR(100),
    output TEXT, -- Expected output or result
    prerequisites TEXT[], -- Required setup or dependencies
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    difficulty VARCHAR(20) DEFAULT 'beginner', -- beginner, intermediate, advanced
    time_estimate INTEGER, -- Estimated time in minutes
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create Supabase features documentation table
CREATE TABLE IF NOT EXISTS supabase_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    capabilities TEXT[] NOT NULL,
    setup_instructions TEXT[] NOT NULL,
    prerequisites TEXT[],
    best_practices TEXT[],
    common_pitfalls TEXT[],
    performance_tips TEXT[],
    security_considerations TEXT[],
    pricing_notes TEXT,
    related_features TEXT[],
    documentation_url VARCHAR(500),
    video_tutorials JSONB[], -- Array of {title, url, duration}
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create integration patterns table
CREATE TABLE IF NOT EXISTS supabase_integration_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    use_cases TEXT[] NOT NULL,
    implementation_steps TEXT[] NOT NULL,
    code_template TEXT NOT NULL,
    language VARCHAR(50) NOT NULL,
    frameworks TEXT[], -- React, Vue, Next.js, etc.
    features_used TEXT[], -- Which Supabase features are used
    complexity VARCHAR(20) DEFAULT 'medium',
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better search performance
CREATE INDEX idx_code_snippets_language ON ai_code_snippets(language);
CREATE INDEX idx_code_snippets_category ON ai_code_snippets(category);
CREATE INDEX idx_code_snippets_tags ON ai_code_snippets USING gin(tags);
CREATE INDEX idx_code_snippets_search ON ai_code_snippets USING gin(
    to_tsvector('english', title || ' ' || COALESCE(description, '') || ' ' || code)
);

CREATE INDEX idx_code_examples_language ON ai_code_examples(language);
CREATE INDEX idx_code_examples_category ON ai_code_examples(category);
CREATE INDEX idx_code_examples_difficulty ON ai_code_examples(difficulty);
CREATE INDEX idx_code_examples_tags ON ai_code_examples USING gin(tags);

CREATE INDEX idx_supabase_features_category ON supabase_features(category);
CREATE INDEX idx_supabase_features_capabilities ON supabase_features USING gin(capabilities);

CREATE INDEX idx_integration_patterns_language ON supabase_integration_patterns(language);
CREATE INDEX idx_integration_patterns_frameworks ON supabase_integration_patterns USING gin(frameworks);
CREATE INDEX idx_integration_patterns_features ON supabase_integration_patterns USING gin(features_used);

-- Create search function for code snippets
CREATE OR REPLACE FUNCTION search_code_snippets(
    search_query TEXT,
    filter_language VARCHAR(50) DEFAULT NULL,
    filter_category VARCHAR(100) DEFAULT NULL,
    filter_tags TEXT[] DEFAULT NULL,
    limit_count INTEGER DEFAULT 10
) RETURNS TABLE(
    id UUID,
    title VARCHAR(255),
    description TEXT,
    language VARCHAR(50),
    code TEXT,
    category VARCHAR(100),
    tags TEXT[],
    relevance REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cs.id,
        cs.title,
        cs.description,
        cs.language,
        cs.code,
        cs.category,
        cs.tags,
        ts_rank(
            to_tsvector('english', cs.title || ' ' || COALESCE(cs.description, '') || ' ' || cs.code),
            plainto_tsquery('english', search_query)
        ) AS relevance
    FROM ai_code_snippets cs
    WHERE 
        (search_query IS NULL OR search_query = '' OR
         to_tsvector('english', cs.title || ' ' || COALESCE(cs.description, '') || ' ' || cs.code) @@ 
         plainto_tsquery('english', search_query))
        AND (filter_language IS NULL OR cs.language = filter_language)
        AND (filter_category IS NULL OR cs.category = filter_category)
        AND (filter_tags IS NULL OR cs.tags && filter_tags)
    ORDER BY relevance DESC, cs.usage_count DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get Supabase feature documentation
CREATE OR REPLACE FUNCTION get_supabase_feature_docs(
    feature_category VARCHAR(50) DEFAULT NULL,
    include_examples BOOLEAN DEFAULT true
) RETURNS TABLE(
    feature JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        jsonb_build_object(
            'id', sf.id,
            'feature_name', sf.feature_name,
            'category', sf.category,
            'description', sf.description,
            'capabilities', sf.capabilities,
            'setup_instructions', sf.setup_instructions,
            'prerequisites', sf.prerequisites,
            'best_practices', sf.best_practices,
            'examples', CASE 
                WHEN include_examples THEN (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'title', ce.title,
                            'description', ce.description,
                            'code', ce.code,
                            'language', ce.language
                        )
                    )
                    FROM ai_code_examples ce
                    WHERE ce.category = sf.feature_name
                )
                ELSE NULL
            END,
            'snippets', CASE
                WHEN include_examples THEN (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'title', cs.title,
                            'code', cs.code,
                            'language', cs.language
                        )
                    )
                    FROM ai_code_snippets cs
                    WHERE cs.category = sf.feature_name
                )
                ELSE NULL
            END
        )
    FROM supabase_features sf
    WHERE feature_category IS NULL OR sf.category = feature_category
    ORDER BY sf.category, sf.feature_name;
END;
$$ LANGUAGE plpgsql;

-- Create function to increment usage count
CREATE OR REPLACE FUNCTION increment_snippet_usage(snippet_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE ai_code_snippets 
    SET usage_count = usage_count + 1,
        updated_at = NOW()
    WHERE id = snippet_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to get integration patterns
CREATE OR REPLACE FUNCTION get_integration_patterns(
    filter_language VARCHAR(50) DEFAULT NULL,
    filter_framework TEXT DEFAULT NULL,
    filter_features TEXT[] DEFAULT NULL
) RETURNS TABLE(
    pattern JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        jsonb_build_object(
            'id', ip.id,
            'pattern_name', ip.pattern_name,
            'description', ip.description,
            'use_cases', ip.use_cases,
            'implementation_steps', ip.implementation_steps,
            'code_template', ip.code_template,
            'language', ip.language,
            'frameworks', ip.frameworks,
            'features_used', ip.features_used,
            'complexity', ip.complexity
        )
    FROM supabase_integration_patterns ip
    WHERE 
        (filter_language IS NULL OR ip.language = filter_language)
        AND (filter_framework IS NULL OR filter_framework = ANY(ip.frameworks))
        AND (filter_features IS NULL OR ip.features_used && filter_features)
    ORDER BY ip.pattern_name;
END;
$$ LANGUAGE plpgsql;

-- RLS policies
ALTER TABLE ai_code_snippets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_code_examples ENABLE ROW LEVEL SECURITY;
ALTER TABLE supabase_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE supabase_integration_patterns ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "code_snippets_read" ON ai_code_snippets
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "code_examples_read" ON ai_code_examples
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "supabase_features_read" ON supabase_features
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "integration_patterns_read" ON supabase_integration_patterns
    FOR SELECT TO authenticated
    USING (true);

-- Allow LLM services to insert/update documentation
CREATE POLICY "code_snippets_write" ON ai_code_snippets
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "code_examples_write" ON ai_code_examples
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "supabase_features_write" ON supabase_features
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "integration_patterns_write" ON supabase_integration_patterns
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_code_snippets_updated_at BEFORE UPDATE ON ai_code_snippets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_code_examples_updated_at BEFORE UPDATE ON ai_code_examples
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supabase_features_updated_at BEFORE UPDATE ON supabase_features
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_integration_patterns_updated_at BEFORE UPDATE ON supabase_integration_patterns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON ai_code_snippets TO authenticated;
GRANT SELECT, INSERT, UPDATE ON ai_code_examples TO authenticated;
GRANT SELECT, INSERT, UPDATE ON supabase_features TO authenticated;
GRANT SELECT, INSERT, UPDATE ON supabase_integration_patterns TO authenticated;

GRANT EXECUTE ON FUNCTION search_code_snippets TO authenticated;
GRANT EXECUTE ON FUNCTION get_supabase_feature_docs TO authenticated;
GRANT EXECUTE ON FUNCTION increment_snippet_usage TO authenticated;
GRANT EXECUTE ON FUNCTION get_integration_patterns TO authenticated;