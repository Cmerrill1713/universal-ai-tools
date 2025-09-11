-- Enable Essential Extensions for Universal AI Tools
-- Migration: 040_enable_extensions.sql

BEGIN;

-- Vector extension for AI/ML embeddings
CREATE EXTENSION IF NOT EXISTS vector;
COMMENT ON EXTENSION vector IS 'Vector data type and similarity search for AI/ML embeddings';

-- pg_cron for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
COMMENT ON EXTENSION pg_cron IS 'Job scheduler for PostgreSQL';

-- pg_net for HTTP requests (webhooks, external APIs)
CREATE EXTENSION IF NOT EXISTS pg_net;
COMMENT ON EXTENSION pg_net IS 'HTTP client for PostgreSQL';

-- pgjwt for JWT token operations
CREATE EXTENSION IF NOT EXISTS pgjwt;
COMMENT ON EXTENSION pgjwt IS 'JSON Web Token API for PostgreSQL';

-- pg_jsonschema for JSON validation
CREATE EXTENSION IF NOT EXISTS pg_jsonschema;
COMMENT ON EXTENSION pg_jsonschema IS 'JSON Schema validation for PostgreSQL';

-- UUID generation (usually already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Crypto functions (usually already enabled)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enhanced monitoring
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
COMMENT ON EXTENSION pg_stat_statements IS 'Track execution statistics of SQL statements';

-- Add vector column to ai_memories table
ALTER TABLE IF EXISTS ai_memories
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_memories_embedding 
ON ai_memories USING ivfflat (embedding vector_cosine_ops)
WHERE embedding IS NOT NULL;

-- Add vector column to knowledge_sources
ALTER TABLE IF EXISTS knowledge_sources
ADD COLUMN IF NOT EXISTS content_embedding vector(1536);

-- Create index for knowledge vector search
CREATE INDEX IF NOT EXISTS idx_knowledge_embedding
ON knowledge_sources USING ivfflat (content_embedding vector_cosine_ops)
WHERE content_embedding IS NOT NULL;

-- Create a table for scheduled jobs management
CREATE TABLE IF NOT EXISTS scheduled_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_name VARCHAR(255) UNIQUE NOT NULL,
    schedule VARCHAR(100) NOT NULL,
    command TEXT NOT NULL,
    enabled BOOLEAN DEFAULT true,
    last_run TIMESTAMP,
    next_run TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create webhook events table for pg_net
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    webhook_url TEXT NOT NULL,
    headers JSONB DEFAULT '{}',
    method VARCHAR(10) DEFAULT 'POST',
    sent_at TIMESTAMP,
    response_status INTEGER,
    response_body TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for webhook events
CREATE INDEX idx_webhook_events_pending 
ON webhook_events (created_at) 
WHERE sent_at IS NULL AND retry_count < max_retries;

-- Function to send webhooks using pg_net
CREATE OR REPLACE FUNCTION send_webhook(
    p_event_type VARCHAR,
    p_payload JSONB,
    p_webhook_url TEXT,
    p_headers JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
BEGIN
    -- Insert webhook event
    INSERT INTO webhook_events (event_type, payload, webhook_url, headers)
    VALUES (p_event_type, p_payload, p_webhook_url, p_headers)
    RETURNING id INTO v_event_id;
    
    -- Send HTTP request
    PERFORM net.http_post(
        url := p_webhook_url,
        headers := p_headers,
        body := p_payload::text
    );
    
    -- Update sent timestamp
    UPDATE webhook_events 
    SET sent_at = NOW()
    WHERE id = v_event_id;
    
    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate vector similarity
CREATE OR REPLACE FUNCTION calculate_similarity(
    embedding1 vector,
    embedding2 vector
)
RETURNS FLOAT AS $$
BEGIN
    RETURN 1 - (embedding1 <=> embedding2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to find similar memories
CREATE OR REPLACE FUNCTION find_similar_memories(
    query_embedding vector,
    limit_count INTEGER DEFAULT 10,
    threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    similarity FLOAT,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.content,
        1 - (m.embedding <=> query_embedding) as similarity,
        m.metadata
    FROM ai_memories m
    WHERE m.embedding IS NOT NULL
    AND 1 - (m.embedding <=> query_embedding) > threshold
    ORDER BY m.embedding <=> query_embedding
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- Schedule cleanup of old webhook events (using pg_cron)
SELECT cron.schedule(
    'cleanup-webhook-events',
    '0 4 * * *', -- 4 AM daily
    $$DELETE FROM webhook_events WHERE created_at < NOW() - INTERVAL '30 days' AND sent_at IS NOT NULL$$
);

-- Schedule aggregation of agent metrics
SELECT cron.schedule(
    'aggregate-agent-metrics',
    '*/30 * * * *', -- Every 30 minutes
    $$
    INSERT INTO agent_performance_metrics (agent_id, metric_type, value, metadata)
    SELECT 
        agent_id,
        'hourly_success_rate',
        AVG(CASE WHEN success THEN 1 ELSE 0 END),
        jsonb_build_object(
            'hour', date_trunc('hour', NOW()),
            'total_requests', COUNT(*),
            'successful_requests', SUM(CASE WHEN success THEN 1 ELSE 0 END)
        )
    FROM agent_requests
    WHERE created_at >= NOW() - INTERVAL '1 hour'
    GROUP BY agent_id
    $$
);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL ON cron.job TO postgres;

-- Create RLS policies for new tables
ALTER TABLE scheduled_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Admin-only access to scheduled jobs
CREATE POLICY admin_all_scheduled_jobs ON scheduled_jobs
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Users can view their own webhook events
CREATE POLICY users_own_webhook_events ON webhook_events
    FOR SELECT USING (
        payload->>'user_id' = auth.uid()::text
        OR auth.jwt() ->> 'role' = 'admin'
    );

COMMIT;

-- Verify extensions are enabled
SELECT 
    extname,
    extversion,
    extnamespace::regnamespace as schema
FROM pg_extension
WHERE extname IN (
    'vector', 'pg_cron', 'pg_net', 'pgjwt', 
    'pg_jsonschema', 'pg_stat_statements'
)
ORDER BY extname;