-- SDK Documentation Storage for LLMs
-- This migration creates tables to store SDK documentation and examples for AI agents

-- Create SDK documentation table
CREATE TABLE IF NOT EXISTS sdk_documentation (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sdk_name TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT 'latest',
    category TEXT NOT NULL CHECK (category IN (
        'initialization', 'database', 'authentication', 'realtime', 
        'storage', 'edge_functions', 'vectors', 'error_handling', 
        'advanced_patterns', 'utilities', 'examples', 'best_practices'
    )),
    subcategory TEXT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    code_example TEXT,
    language TEXT DEFAULT 'typescript',
    tags TEXT[] DEFAULT '{}',
    usage_notes TEXT,
    related_functions TEXT[] DEFAULT '{}',
    performance_considerations TEXT,
    security_notes TEXT,
    embedding VECTOR(1536), -- For semantic search
    search_text tsvector,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(sdk_name, category, title)
);

-- Function to update search_text
CREATE OR REPLACE FUNCTION update_sdk_search_text()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_text := to_tsvector('english',
        coalesce(NEW.title, '') || ' ' ||
        coalesce(NEW.description, '') || ' ' ||
        coalesce(NEW.code_example, '') || ' ' ||
        coalesce(NEW.usage_notes, '') || ' ' ||
        coalesce(array_to_string(NEW.tags, ' '), '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update search_text
CREATE TRIGGER update_sdk_search_text_trigger
BEFORE INSERT OR UPDATE ON sdk_documentation
FOR EACH ROW
EXECUTE FUNCTION update_sdk_search_text();

-- Create index for text search
CREATE INDEX idx_sdk_docs_search ON sdk_documentation USING gin(search_text);

-- Create index for vector similarity search
CREATE INDEX idx_sdk_docs_embedding ON sdk_documentation 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100)
WHERE embedding IS NOT NULL;

-- Create index for category filtering
CREATE INDEX idx_sdk_docs_category ON sdk_documentation(category, subcategory);

-- Create SDK patterns table for common usage patterns
CREATE TABLE IF NOT EXISTS sdk_patterns (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    pattern_name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    use_case TEXT NOT NULL,
    implementation TEXT NOT NULL,
    pros TEXT[] DEFAULT '{}',
    cons TEXT[] DEFAULT '{}',
    when_to_use TEXT,
    when_not_to_use TEXT,
    example_scenario TEXT,
    related_patterns TEXT[] DEFAULT '{}',
    embedding VECTOR(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for pattern embeddings
CREATE INDEX idx_sdk_patterns_embedding ON sdk_patterns 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 50)
WHERE embedding IS NOT NULL;

-- Function to search SDK documentation
CREATE OR REPLACE FUNCTION search_sdk_documentation(
    search_query TEXT,
    p_category TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    category TEXT,
    description TEXT,
    code_example TEXT,
    relevance REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.title,
        s.category,
        s.description,
        s.code_example,
        ts_rank(s.search_text, plainto_tsquery('english', search_query)) as relevance
    FROM sdk_documentation s
    WHERE 
        s.search_text @@ plainto_tsquery('english', search_query)
        AND (p_category IS NULL OR s.category = p_category)
    ORDER BY relevance DESC, s.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to search SDK documentation by embedding
CREATE OR REPLACE FUNCTION search_sdk_by_embedding(
    query_embedding VECTOR(1536),
    similarity_threshold FLOAT DEFAULT 0.7,
    match_count INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    category TEXT,
    description TEXT,
    code_example TEXT,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.title,
        s.category,
        s.description,
        s.code_example,
        1 - (s.embedding <=> query_embedding) as similarity
    FROM sdk_documentation s
    WHERE 
        s.embedding IS NOT NULL
        AND 1 - (s.embedding <=> query_embedding) > similarity_threshold
    ORDER BY s.embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get SDK examples by category
CREATE OR REPLACE FUNCTION get_sdk_examples(
    p_category TEXT,
    p_subcategory TEXT DEFAULT NULL
)
RETURNS TABLE (
    title TEXT,
    description TEXT,
    code_example TEXT,
    usage_notes TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.title,
        s.description,
        s.code_example,
        s.usage_notes
    FROM sdk_documentation s
    WHERE 
        s.category = p_category
        AND (p_subcategory IS NULL OR s.subcategory = p_subcategory)
        AND s.code_example IS NOT NULL
    ORDER BY s.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Create view for most used SDK features
CREATE OR REPLACE VIEW sdk_usage_stats AS
WITH tag_data AS (
    SELECT 
        category,
        subcategory,
        unnest(tags) as tag
    FROM sdk_documentation
),
usage_data AS (
    SELECT 
        s.category,
        s.subcategory,
        COUNT(DISTINCT s.id) as example_count,
        array_agg(DISTINCT t.tag) as all_tags
    FROM sdk_documentation s
    LEFT JOIN tag_data t ON s.category = t.category 
        AND (s.subcategory = t.subcategory OR (s.subcategory IS NULL AND t.subcategory IS NULL))
    GROUP BY s.category, s.subcategory
)
SELECT 
    category,
    subcategory,
    example_count,
    array_length(all_tags, 1) as unique_tags,
    all_tags
FROM usage_data
ORDER BY example_count DESC;

-- Function to insert SDK documentation with auto-embedding
CREATE OR REPLACE FUNCTION insert_sdk_documentation(
    p_sdk_name TEXT,
    p_category TEXT,
    p_title TEXT,
    p_description TEXT,
    p_code_example TEXT DEFAULT NULL,
    p_subcategory TEXT DEFAULT NULL,
    p_tags TEXT[] DEFAULT '{}',
    p_usage_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_doc_id UUID;
BEGIN
    INSERT INTO sdk_documentation (
        sdk_name,
        category,
        subcategory,
        title,
        description,
        code_example,
        tags,
        usage_notes
    ) VALUES (
        p_sdk_name,
        p_category,
        p_subcategory,
        p_title,
        p_description,
        p_code_example,
        p_tags,
        p_usage_notes
    )
    ON CONFLICT (sdk_name, category, title) 
    DO UPDATE SET
        description = EXCLUDED.description,
        code_example = EXCLUDED.code_example,
        tags = EXCLUDED.tags,
        usage_notes = EXCLUDED.usage_notes,
        updated_at = NOW()
    RETURNING id INTO v_doc_id;
    
    RETURN v_doc_id;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT ON sdk_documentation TO authenticated;
GRANT SELECT ON sdk_patterns TO authenticated;
GRANT SELECT ON sdk_usage_stats TO authenticated;
GRANT EXECUTE ON FUNCTION search_sdk_documentation TO authenticated;
GRANT EXECUTE ON FUNCTION search_sdk_by_embedding TO authenticated;
GRANT EXECUTE ON FUNCTION get_sdk_examples TO authenticated;
GRANT EXECUTE ON FUNCTION insert_sdk_documentation TO authenticated;

-- Enable RLS
ALTER TABLE sdk_documentation ENABLE ROW LEVEL SECURITY;
ALTER TABLE sdk_patterns ENABLE ROW LEVEL SECURITY;

-- RLS policies - read access for all authenticated users
CREATE POLICY "sdk_docs_read" ON sdk_documentation
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "sdk_patterns_read" ON sdk_patterns
    FOR SELECT TO authenticated
    USING (true);

-- Only service role can insert/update
CREATE POLICY "sdk_docs_write" ON sdk_documentation
    FOR ALL TO service_role
    USING (true);

CREATE POLICY "sdk_patterns_write" ON sdk_patterns
    FOR ALL TO service_role
    USING (true);