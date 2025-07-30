-- Universal AI Tools - Consolidated Production Schema
-- Created: 2025-07-20
-- Consolidates all previous migrations into single production-ready schema
-- 
-- IMPORTANT: This replaces all previous migrations for production deployments
-- For development: Backup existing data before applying

BEGIN;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_net";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- Core AI Services Tables
CREATE TABLE IF NOT EXISTS ai_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    api_endpoint TEXT,
    auth_type VARCHAR(50) DEFAULT 'api_key',
    api_key TEXT,
    capabilities JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    rate_limit INTEGER DEFAULT 1000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Memory Storage (Vector-enabled)
CREATE TABLE IF NOT EXISTS ai_memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID REFERENCES ai_services(id) ON DELETE CASCADE,
    memory_type VARCHAR(50) NOT NULL DEFAULT 'general',
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding vector(1536), -- OpenAI ada-002 dimension
    importance_score FLOAT DEFAULT 0.5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT now(),
    access_count INTEGER DEFAULT 0
);

-- Context Storage
CREATE TABLE IF NOT EXISTS ai_contexts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID REFERENCES ai_services(id) ON DELETE CASCADE,
    context_type VARCHAR(50) NOT NULL,
    context_key VARCHAR(200) NOT NULL,
    content JSONB NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(service_id, context_type, context_key)
);

-- Agent Tools
CREATE TABLE IF NOT EXISTS ai_custom_tools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tool_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    input_schema JSONB NOT NULL,
    output_schema JSONB,
    implementation_type VARCHAR(50) NOT NULL, -- 'sql', 'function', 'api', 'script'
    implementation TEXT NOT NULL,
    created_by UUID REFERENCES ai_services(id),
    is_active BOOLEAN DEFAULT true,
    rate_limit INTEGER DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tool Execution Logs
CREATE TABLE IF NOT EXISTS ai_tool_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID REFERENCES ai_services(id),
    tool_name VARCHAR(100) NOT NULL,
    input_params JSONB,
    output_result JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    error_message TEXT,
    execution_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Agent Sessions
CREATE TABLE IF NOT EXISTS ai_agent_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID REFERENCES ai_services(id),
    session_type VARCHAR(50) NOT NULL,
    session_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(20) DEFAULT 'active',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT now(),
    ended_at TIMESTAMP WITH TIME ZONE
);

-- Knowledge Base
CREATE TABLE IF NOT EXISTS ai_knowledge_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    content_type VARCHAR(50) DEFAULT 'text',
    source_url TEXT,
    embedding vector(1536),
    metadata JSONB DEFAULT '{}'::jsonb,
    knowledge_type VARCHAR(50) DEFAULT 'general',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Communications
CREATE TABLE IF NOT EXISTS ai_communications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_service_id UUID REFERENCES ai_services(id),
    to_service_id UUID REFERENCES ai_services(id),
    message_type VARCHAR(50) NOT NULL,
    content JSONB NOT NULL,
    thread_id UUID,
    status VARCHAR(20) DEFAULT 'sent',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    read_at TIMESTAMP WITH TIME ZONE
);

-- Performance Analytics
CREATE TABLE IF NOT EXISTS ai_performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID REFERENCES ai_services(id),
    metric_type VARCHAR(50) NOT NULL,
    metric_value FLOAT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Security Audit Logs
CREATE TABLE IF NOT EXISTS security_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'info',
    details JSONB NOT NULL,
    user_id TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_memories_service_id ON ai_memories(service_id);
CREATE INDEX IF NOT EXISTS idx_ai_memories_type ON ai_memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_ai_memories_embedding ON ai_memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_ai_contexts_service_context ON ai_contexts(service_id, context_type);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_embedding ON ai_knowledge_base USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_ai_performance_service_type ON ai_performance_metrics(service_id, metric_type);
CREATE INDEX IF NOT EXISTS idx_security_audit_type_time ON security_audit_logs(event_type, created_at);

-- Vector search functions
CREATE OR REPLACE FUNCTION search_memories(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.78,
    match_count int DEFAULT 10,
    service_filter uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    content text,
    metadata jsonb,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ai_memories.id,
        ai_memories.content,
        ai_memories.metadata,
        1 - (ai_memories.embedding <=> query_embedding) as similarity
    FROM ai_memories
    WHERE 
        ai_memories.embedding <=> query_embedding < 1 - match_threshold
        AND (service_filter IS NULL OR ai_memories.service_id = service_filter)
    ORDER BY ai_memories.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION search_knowledge(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.78,
    match_count int DEFAULT 10,
    knowledge_type_filter text DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    title text,
    content text,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ai_knowledge_base.id,
        ai_knowledge_base.title,
        ai_knowledge_base.content,
        1 - (ai_knowledge_base.embedding <=> query_embedding) as similarity
    FROM ai_knowledge_base
    WHERE 
        ai_knowledge_base.embedding <=> query_embedding < 1 - match_threshold
        AND (knowledge_type_filter IS NULL OR ai_knowledge_base.knowledge_type = knowledge_type_filter)
    ORDER BY ai_knowledge_base.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- RLS Policies for security
ALTER TABLE ai_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_custom_tools ENABLE ROW LEVEL SECURITY;

-- Basic service-level isolation policies
CREATE POLICY "Services can access own data" ON ai_memories
    FOR ALL USING (auth.uid()::text = service_id::text);

CREATE POLICY "Services can access own contexts" ON ai_contexts
    FOR ALL USING (auth.uid()::text = service_id::text);

-- Insert default system service
INSERT INTO ai_services (id, service_name, description, capabilities) 
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'system',
    'System service for internal operations',
    '["memory", "context", "tools", "admin"]'::jsonb
) ON CONFLICT (service_name) DO NOTHING;

COMMIT;