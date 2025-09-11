-- Add Vector Columns to AI Tables
-- Since vector extension is already enabled, we just need to add the columns

BEGIN;

-- 1. Add embedding column to ai_memories if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ai_memories' 
        AND column_name = 'embedding'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE ai_memories ADD COLUMN embedding vector(1536);
        RAISE NOTICE 'Added embedding column to ai_memories';
    ELSE
        RAISE NOTICE 'ai_memories already has embedding column';
    END IF;
END $$;

-- 2. Add embedding column to knowledge_sources if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'knowledge_sources' 
        AND column_name = 'content_embedding'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE knowledge_sources ADD COLUMN content_embedding vector(1536);
        RAISE NOTICE 'Added content_embedding column to knowledge_sources';
    ELSE
        RAISE NOTICE 'knowledge_sources already has content_embedding column';
    END IF;
END $$;

-- 3. Create indexes for vector similarity search
CREATE INDEX IF NOT EXISTS idx_memories_embedding 
ON ai_memories USING ivfflat (embedding vector_cosine_ops)
WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_knowledge_embedding 
ON knowledge_sources USING ivfflat (content_embedding vector_cosine_ops)
WHERE content_embedding IS NOT NULL;

-- 4. Create similarity search functions
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

-- 5. Create function to search knowledge base
CREATE OR REPLACE FUNCTION search_knowledge(
    query_embedding vector,
    match_limit integer DEFAULT 10,
    similarity_threshold float DEFAULT 0.7
)
RETURNS TABLE (
    id uuid,
    title text,
    content text,
    similarity float,
    source text,
    metadata jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        k.id,
        k.title,
        k.content,
        1 - (k.content_embedding <=> query_embedding) as similarity,
        k.source,
        k.metadata
    FROM knowledge_sources k
    WHERE k.content_embedding IS NOT NULL
    AND 1 - (k.content_embedding <=> query_embedding) > similarity_threshold
    ORDER BY k.content_embedding <=> query_embedding
    LIMIT match_limit;
END;
$$;

-- 6. Set up a cron job to clean old memories (using pg_cron)
-- First delete any existing job with the same name
DELETE FROM cron.job WHERE jobname = 'cleanup-old-memories';

-- Schedule cleanup of memories older than 90 days
SELECT cron.schedule(
    'cleanup-old-memories',
    '0 3 * * *', -- 3 AM daily
    $$DELETE FROM ai_memories WHERE created_at < NOW() - INTERVAL '90 days' AND important != true$$
);

-- 7. Create a webhook trigger for new memories (using pg_net)
CREATE OR REPLACE FUNCTION notify_new_memory()
RETURNS TRIGGER AS $$
DECLARE
    webhook_url text;
BEGIN
    -- Get webhook URL from service configuration
    SELECT value INTO webhook_url
    FROM service_configurations
    WHERE key = 'memory_webhook_url'
    AND enabled = true
    LIMIT 1;
    
    -- Send webhook if URL is configured
    IF webhook_url IS NOT NULL THEN
        PERFORM net.http_post(
            url := webhook_url,
            headers := '{"Content-Type": "application/json"}'::jsonb,
            body := json_build_object(
                'event', 'memory.created',
                'memory_id', NEW.id,
                'user_id', NEW.user_id,
                'content_preview', LEFT(NEW.content, 100),
                'timestamp', NOW()
            )::text
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new memories
DROP TRIGGER IF EXISTS on_memory_created ON ai_memories;
CREATE TRIGGER on_memory_created
    AFTER INSERT ON ai_memories
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_memory();

-- 8. Add RLS policies for the vector columns
-- Allow users to update their own memory embeddings
CREATE POLICY "Users can update embeddings on their memories"
    ON ai_memories
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Allow users to update embeddings on their knowledge
CREATE POLICY "Users can update embeddings on their knowledge"
    ON knowledge_sources
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

COMMIT;

-- Verify the setup
SELECT 
    'ai_memories' as table_name,
    COUNT(*) FILTER (WHERE embedding IS NOT NULL) as with_embeddings,
    COUNT(*) as total_records
FROM ai_memories
UNION ALL
SELECT 
    'knowledge_sources' as table_name,
    COUNT(*) FILTER (WHERE content_embedding IS NOT NULL) as with_embeddings,
    COUNT(*) as total_records
FROM knowledge_sources;