-- Add only missing extensions and features
-- First run check-extensions.sql to see what's already enabled

BEGIN;

-- Only enable extensions that aren't already enabled
DO $$ 
BEGIN
    -- Vector extension for embeddings (most important for AI)
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        CREATE EXTENSION vector;
        RAISE NOTICE 'Enabled vector extension';
    ELSE
        RAISE NOTICE 'Vector extension already enabled';
    END IF;

    -- pg_cron for scheduled jobs (useful for cleanup and aggregation)
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        CREATE EXTENSION pg_cron;
        RAISE NOTICE 'Enabled pg_cron extension';
    ELSE
        RAISE NOTICE 'pg_cron extension already enabled';
    END IF;

    -- pg_net for HTTP requests (webhooks)
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
        CREATE EXTENSION pg_net;
        RAISE NOTICE 'Enabled pg_net extension';
    ELSE
        RAISE NOTICE 'pg_net extension already enabled';
    END IF;
END $$;

-- Add vector columns only if they don't exist
DO $$
BEGIN
    -- Add embedding column to ai_memories if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ai_memories' 
        AND column_name = 'embedding'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE ai_memories ADD COLUMN embedding vector(1536);
        CREATE INDEX idx_memories_embedding ON ai_memories 
        USING ivfflat (embedding vector_cosine_ops)
        WHERE embedding IS NOT NULL;
        RAISE NOTICE 'Added embedding column to ai_memories';
    ELSE
        RAISE NOTICE 'ai_memories already has embedding column';
    END IF;

    -- Add embedding column to knowledge_sources if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'knowledge_sources' 
        AND column_name = 'content_embedding'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE knowledge_sources ADD COLUMN content_embedding vector(1536);
        CREATE INDEX idx_knowledge_embedding ON knowledge_sources 
        USING ivfflat (content_embedding vector_cosine_ops)
        WHERE content_embedding IS NOT NULL;
        RAISE NOTICE 'Added content_embedding column to knowledge_sources';
    ELSE
        RAISE NOTICE 'knowledge_sources already has content_embedding column';
    END IF;
END $$;

-- Create similarity search function if vector is enabled
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        -- Drop function if exists and recreate
        DROP FUNCTION IF EXISTS search_similar_memories(vector, integer, float);
        
        CREATE FUNCTION search_similar_memories(
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
        AS $func$
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
        $func$;
        
        RAISE NOTICE 'Created search_similar_memories function';
    END IF;
END $$;

-- Create a simple cron job for cleanup if pg_cron is enabled
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Remove old job if exists
        DELETE FROM cron.job WHERE jobname = 'cleanup-old-performance-metrics';
        
        -- Schedule cleanup of old performance metrics
        INSERT INTO cron.job (schedule, command, nodename, nodeport, database, username, jobname)
        VALUES (
            '0 3 * * *', -- 3 AM daily
            'DELETE FROM agent_performance_metrics WHERE created_at < NOW() - INTERVAL ''90 days'';',
            'localhost',
            5432,
            current_database(),
            current_user,
            'cleanup-old-performance-metrics'
        );
        
        RAISE NOTICE 'Created cleanup cron job';
    END IF;
END $$;

COMMIT;

-- Show what was done
SELECT 
    extname,
    extversion
FROM pg_extension
WHERE extname IN ('vector', 'pg_cron', 'pg_net')
ORDER BY extname;