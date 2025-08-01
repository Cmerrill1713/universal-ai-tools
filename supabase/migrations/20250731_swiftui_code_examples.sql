-- =====================================================
-- SwiftUI Code Examples Table
-- Version: 1.0.0
-- Date: 2025-07-31
-- =====================================================
-- This migration adds a dedicated table for storing code examples
-- from SwiftUI documentation with embeddings for semantic search

-- Create code_examples table if it doesn't exist
CREATE TABLE IF NOT EXISTS code_examples (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_url TEXT NOT NULL,
    title TEXT NOT NULL,
    code TEXT NOT NULL,
    language TEXT DEFAULT 'swift',
    category TEXT,
    tags TEXT[] DEFAULT '{}',
    embedding vector(1536),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(source_url, title)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_code_examples_category ON code_examples (category);
CREATE INDEX IF NOT EXISTS idx_code_examples_language ON code_examples (language);
CREATE INDEX IF NOT EXISTS idx_code_examples_tags ON code_examples USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_code_examples_source ON code_examples (source_url);

-- Add full-text search support
ALTER TABLE code_examples ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE INDEX IF NOT EXISTS idx_code_examples_search ON code_examples USING gin(search_vector);

-- Function to update search vector for code examples
CREATE OR REPLACE FUNCTION update_code_examples_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
                        setweight(to_tsvector('english', COALESCE(NEW.code, '')), 'B') ||
                        setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for search vector updates
DROP TRIGGER IF EXISTS update_code_examples_search_vector_trigger ON code_examples;
CREATE TRIGGER update_code_examples_search_vector_trigger 
BEFORE INSERT OR UPDATE ON code_examples 
FOR EACH ROW EXECUTE FUNCTION update_code_examples_search_vector();

-- Function to search code examples
CREATE OR REPLACE FUNCTION search_code_examples(
    query_text TEXT,
    query_embedding vector DEFAULT NULL,
    filter_category TEXT DEFAULT NULL,
    filter_language TEXT DEFAULT NULL,
    match_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    code TEXT,
    language TEXT,
    category TEXT,
    tags TEXT[],
    semantic_score REAL,
    text_score REAL,
    combined_score REAL
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH scores AS (
        SELECT 
            ce.id,
            ce.title,
            ce.code,
            ce.language,
            ce.category,
            ce.tags,
            CASE 
                WHEN query_embedding IS NOT NULL AND ce.embedding IS NOT NULL 
                THEN 1 - (ce.embedding <=> query_embedding)
                ELSE 0
            END as semantic_score,
            ts_rank(ce.search_vector, plainto_tsquery('english', query_text)) as text_score
        FROM code_examples ce
        WHERE 
            (filter_category IS NULL OR ce.category = filter_category) AND
            (filter_language IS NULL OR ce.language = filter_language)
    )
    SELECT 
        s.id,
        s.title,
        s.code,
        s.language,
        s.category,
        s.tags,
        s.semantic_score,
        s.text_score,
        (s.semantic_score * 0.6 + s.text_score * 0.4) as combined_score
    FROM scores s
    WHERE s.text_score > 0 OR s.semantic_score > 0.3
    ORDER BY combined_score DESC
    LIMIT match_limit;
END;
$$;

-- Add RLS policies
ALTER TABLE code_examples ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read code examples
CREATE POLICY "Code examples are viewable by all" ON code_examples
    FOR SELECT USING (true);

-- Only service role can insert/update/delete
CREATE POLICY "Code examples are manageable by service role" ON code_examples
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Create a view for SwiftUI-specific code examples
CREATE OR REPLACE VIEW swiftui_code_examples AS
SELECT 
    id,
    title,
    code,
    category,
    tags,
    metadata,
    created_at
FROM code_examples
WHERE 
    language = 'swift' AND 
    (category LIKE 'swiftui%' OR 'swiftui' = ANY(tags));

-- Grant permissions
GRANT SELECT ON code_examples TO anon, authenticated;
GRANT SELECT ON swiftui_code_examples TO anon, authenticated;