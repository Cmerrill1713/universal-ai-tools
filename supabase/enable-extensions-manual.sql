-- Enable Extensions and Add Vector Support
-- Run this in Supabase SQL Editor after enabling extensions in Dashboard

-- 1. Verify extensions are enabled
SELECT extname, extversion 
FROM pg_extension 
WHERE extname IN ('vector', 'pg_cron', 'pg_net');

-- 2. Add vector columns for AI embeddings
ALTER TABLE ai_memories 
ADD COLUMN IF NOT EXISTS embedding vector(1536);

ALTER TABLE knowledge_sources 
ADD COLUMN IF NOT EXISTS content_embedding vector(1536);

-- 3. Create indexes for fast similarity search
CREATE INDEX IF NOT EXISTS idx_memories_embedding 
ON ai_memories USING ivfflat (embedding vector_cosine_ops)
WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_knowledge_embedding 
ON knowledge_sources USING ivfflat (content_embedding vector_cosine_ops)
WHERE content_embedding IS NOT NULL;

-- 4. Create similarity search function
CREATE OR REPLACE FUNCTION search_similar_memories(
    query_embedding vector,
    match_limit integer DEFAULT 10,
    similarity_threshold float DEFAULT 0.7
)
RETURNS TABLE (
    id uuid,
    content text,
    similarity float,
    metadata jsonb,
    created_at timestamp with time zone
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.content,
        1 - (m.embedding <=> query_embedding) as similarity,
        m.metadata,
        m.created_at
    FROM ai_memories m
    WHERE m.embedding IS NOT NULL
    AND 1 - (m.embedding <=> query_embedding) > similarity_threshold
    ORDER BY m.embedding <=> query_embedding
    LIMIT match_limit;
END;
$$;

-- 5. Test vector functionality
SELECT 'Vector extension is working!' as message
WHERE EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'vector'
);

-- 6. Show what columns we have
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND column_name IN ('embedding', 'content_embedding')
ORDER BY table_name, column_name;