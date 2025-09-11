-- Production Consolidated Schema v2
-- This migration creates a clean, conflict-free schema for production deployment
-- Resolves all conflicts identified in the migration analysis report

-- =====================================================
-- EXTENSIONS
-- =====================================================
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_net" SCHEMA extensions;

-- =====================================================
-- AUTH FOUNDATION
-- =====================================================
-- Create auth schema if not exists
CREATE SCHEMA IF NOT EXISTS auth;

-- Create auth.users table (required for RLS policies)
CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    encrypted_password TEXT NOT NULL,
    email_confirmed_at TIMESTAMPTZ,
    raw_app_meta_data JSONB DEFAULT '{}'::jsonb,
    raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_sign_in_at TIMESTAMPTZ,
    role TEXT DEFAULT 'authenticated',
    instance_id UUID,
    aud TEXT DEFAULT 'authenticated',
    confirmation_token TEXT,
    recovery_token TEXT,
    email_change_token_new TEXT,
    email_change TEXT,
    phone TEXT,
    phone_confirmed_at TIMESTAMPTZ,
    phone_change TEXT,
    phone_change_token TEXT,
    email_change_token_current TEXT,
    email_change_confirm_status SMALLINT DEFAULT 0,
    banned_until TIMESTAMPTZ,
    reauthentication_token TEXT,
    reauthentication_sent_at TIMESTAMPTZ,
    is_sso_user BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ
);

-- Create indexes for auth.users
CREATE INDEX IF NOT EXISTS users_email_idx ON auth.users (email);
CREATE INDEX IF NOT EXISTS users_instance_id_idx ON auth.users (instance_id);
CREATE INDEX IF NOT EXISTS users_created_at_idx ON auth.users (created_at);

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'inactive',
    config JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Agent capabilities
CREATE TABLE IF NOT EXISTS agent_capabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    capability TEXT NOT NULL,
    parameters JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agent_id, capability)
);

-- Agent memories
CREATE TABLE IF NOT EXISTS agent_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    memory_type TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata JSONB DEFAULT '{}'::jsonb,
    importance FLOAT DEFAULT 0.5,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    accessed_at TIMESTAMPTZ DEFAULT NOW(),
    access_count INTEGER DEFAULT 0,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Memory consolidations
CREATE TABLE IF NOT EXISTS memory_consolidations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_memories UUID[] NOT NULL,
    consolidated_content TEXT NOT NULL,
    consolidation_type TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Knowledge base
CREATE TABLE IF NOT EXISTS knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    source TEXT,
    category TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    title TEXT,
    status TEXT DEFAULT 'active',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    priority INTEGER DEFAULT 0,
    payload JSONB DEFAULT '{}'::jsonb,
    result JSONB,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- =====================================================
-- UNIFIED WIDGET SYSTEM (Resolving Conflicts)
-- =====================================================

-- Single unified widgets table
CREATE TABLE IF NOT EXISTS widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL, -- 'ai_generated', 'dspy', 'custom', etc.
    category TEXT,
    tags TEXT[],
    
    -- Code and configuration
    code TEXT,
    config JSONB DEFAULT '{}'::jsonb,
    dependencies JSONB DEFAULT '[]'::jsonb,
    
    -- DSPy specific fields
    dspy_module_code TEXT,
    dspy_config JSONB DEFAULT '{}'::jsonb,
    
    -- AI generation metadata
    ai_prompt TEXT,
    ai_model TEXT,
    ai_generation_metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Common metadata
    version INTEGER DEFAULT 1,
    is_public BOOLEAN DEFAULT FALSE,
    is_published BOOLEAN DEFAULT FALSE,
    usage_count INTEGER DEFAULT 0,
    rating FLOAT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    
    -- Search and versioning
    search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(array_to_string(tags, ' '), '')), 'C')
    ) STORED
);

-- Widget versions for history tracking
CREATE TABLE IF NOT EXISTS widget_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    widget_id UUID REFERENCES widgets(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    code TEXT,
    config JSONB DEFAULT '{}'::jsonb,
    changelog TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    UNIQUE(widget_id, version)
);

-- Widget usage analytics
CREATE TABLE IF NOT EXISTS widget_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    widget_id UUID REFERENCES widgets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ENHANCED FEATURES
-- =====================================================

-- Model configurations
CREATE TABLE IF NOT EXISTS model_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL,
    model_name TEXT NOT NULL,
    config JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- System health metrics
CREATE TABLE IF NOT EXISTS system_health_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name TEXT NOT NULL,
    metric_value FLOAT NOT NULL,
    metric_unit TEXT,
    component TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    changes JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Agents indexes
CREATE INDEX IF NOT EXISTS agents_user_id_idx ON agents(user_id);
CREATE INDEX IF NOT EXISTS agents_type_idx ON agents(type);
CREATE INDEX IF NOT EXISTS agents_status_idx ON agents(status);

-- Memories indexes
CREATE INDEX IF NOT EXISTS agent_memories_agent_id_idx ON agent_memories(agent_id);
CREATE INDEX IF NOT EXISTS agent_memories_user_id_idx ON agent_memories(user_id);
CREATE INDEX IF NOT EXISTS agent_memories_memory_type_idx ON agent_memories(memory_type);
CREATE INDEX IF NOT EXISTS agent_memories_embedding_idx ON agent_memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Knowledge base indexes
CREATE INDEX IF NOT EXISTS knowledge_base_user_id_idx ON knowledge_base(user_id);
CREATE INDEX IF NOT EXISTS knowledge_base_category_idx ON knowledge_base(category);
CREATE INDEX IF NOT EXISTS knowledge_base_embedding_idx ON knowledge_base USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Widget indexes
CREATE INDEX IF NOT EXISTS widgets_user_id_idx ON widgets(user_id);
CREATE INDEX IF NOT EXISTS widgets_type_idx ON widgets(type);
CREATE INDEX IF NOT EXISTS widgets_category_idx ON widgets(category);
CREATE INDEX IF NOT EXISTS widgets_is_public_idx ON widgets(is_public);
CREATE INDEX IF NOT EXISTS widgets_search_idx ON widgets USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS widgets_tags_idx ON widgets USING GIN(tags);

-- Task indexes
CREATE INDEX IF NOT EXISTS tasks_agent_id_idx ON tasks(agent_id);
CREATE INDEX IF NOT EXISTS tasks_user_id_idx ON tasks(user_id);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status);
CREATE INDEX IF NOT EXISTS tasks_created_at_idx ON tasks(created_at);

-- Conversation indexes
CREATE INDEX IF NOT EXISTS conversations_user_id_idx ON conversations(user_id);
CREATE INDEX IF NOT EXISTS conversations_agent_id_idx ON conversations(agent_id);
CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON messages(conversation_id);

-- Audit indexes
CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS audit_logs_resource_idx ON audit_logs(resource_type, resource_id);

-- =====================================================
-- FUNCTIONS (Using SECURITY INVOKER)
-- =====================================================

-- Get current user ID function
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY INVOKER
AS $$
    SELECT auth.jwt() ->> 'sub'
$$;

-- Get current user role
CREATE OR REPLACE FUNCTION auth.role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY INVOKER
AS $$
    SELECT auth.jwt() ->> 'role'
$$;

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Vector similarity search for memories
CREATE OR REPLACE FUNCTION search_memories(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10,
    filter_agent_id UUID DEFAULT NULL,
    filter_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    agent_id UUID,
    content TEXT,
    memory_type TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        am.id,
        am.agent_id,
        am.content,
        am.memory_type,
        am.metadata,
        1 - (am.embedding <=> query_embedding) AS similarity
    FROM agent_memories am
    WHERE 
        (filter_agent_id IS NULL OR am.agent_id = filter_agent_id)
        AND (filter_user_id IS NULL OR am.user_id = filter_user_id)
        AND 1 - (am.embedding <=> query_embedding) > match_threshold
    ORDER BY am.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Vector similarity search for knowledge base
CREATE OR REPLACE FUNCTION search_knowledge(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10,
    filter_category TEXT DEFAULT NULL,
    filter_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    content TEXT,
    category TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        kb.id,
        kb.title,
        kb.content,
        kb.category,
        kb.metadata,
        1 - (kb.embedding <=> query_embedding) AS similarity
    FROM knowledge_base kb
    WHERE 
        (filter_category IS NULL OR kb.category = filter_category)
        AND (filter_user_id IS NULL OR kb.user_id = filter_user_id)
        AND 1 - (kb.embedding <=> query_embedding) > match_threshold
    ORDER BY kb.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update timestamp triggers
CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_base_updated_at BEFORE UPDATE ON knowledge_base
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_widgets_updated_at BEFORE UPDATE ON widgets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_model_configurations_updated_at BEFORE UPDATE ON model_configurations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE widget_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE widget_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Agents policies
CREATE POLICY "Users can view their own agents" ON agents
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own agents" ON agents
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own agents" ON agents
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own agents" ON agents
    FOR DELETE USING (auth.uid() = user_id);

-- Agent capabilities policies (inherit from agents)
CREATE POLICY "Users can view capabilities of their agents" ON agent_capabilities
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM agents 
            WHERE agents.id = agent_capabilities.agent_id 
            AND agents.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage capabilities of their agents" ON agent_capabilities
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM agents 
            WHERE agents.id = agent_capabilities.agent_id 
            AND agents.user_id = auth.uid()
        )
    );

-- Agent memories policies
CREATE POLICY "Users can view their own memories" ON agent_memories
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own memories" ON agent_memories
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own memories" ON agent_memories
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own memories" ON agent_memories
    FOR DELETE USING (auth.uid() = user_id);

-- Knowledge base policies
CREATE POLICY "Users can view their own knowledge" ON knowledge_base
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own knowledge" ON knowledge_base
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own knowledge" ON knowledge_base
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own knowledge" ON knowledge_base
    FOR DELETE USING (auth.uid() = user_id);

-- Conversations policies
CREATE POLICY "Users can view their own conversations" ON conversations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own conversations" ON conversations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations" ON conversations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations" ON conversations
    FOR DELETE USING (auth.uid() = user_id);

-- Messages policies (inherit from conversations)
CREATE POLICY "Users can view messages in their conversations" ON messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM conversations 
            WHERE conversations.id = messages.conversation_id 
            AND conversations.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create messages in their conversations" ON messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM conversations 
            WHERE conversations.id = messages.conversation_id 
            AND conversations.user_id = auth.uid()
        )
    );

-- Tasks policies
CREATE POLICY "Users can view their own tasks" ON tasks
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tasks" ON tasks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tasks" ON tasks
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tasks" ON tasks
    FOR DELETE USING (auth.uid() = user_id);

-- Widgets policies
CREATE POLICY "Users can view their own widgets" ON widgets
    FOR SELECT USING (auth.uid() = user_id OR is_public = TRUE);

CREATE POLICY "Users can create their own widgets" ON widgets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own widgets" ON widgets
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own widgets" ON widgets
    FOR DELETE USING (auth.uid() = user_id);

-- Widget versions policies (inherit from widgets)
CREATE POLICY "Users can view versions of accessible widgets" ON widget_versions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM widgets 
            WHERE widgets.id = widget_versions.widget_id 
            AND (widgets.user_id = auth.uid() OR widgets.is_public = TRUE)
        )
    );

CREATE POLICY "Users can create versions of their widgets" ON widget_versions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM widgets 
            WHERE widgets.id = widget_versions.widget_id 
            AND widgets.user_id = auth.uid()
        )
    );

-- Widget usage policies
CREATE POLICY "Users can view usage of their widgets" ON widget_usage
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM widgets 
            WHERE widgets.id = widget_usage.widget_id 
            AND widgets.user_id = auth.uid()
        )
    );

CREATE POLICY "Anyone can log widget usage" ON widget_usage
    FOR INSERT WITH CHECK (TRUE);

-- Audit logs policies
CREATE POLICY "Users can view their own audit logs" ON audit_logs
    FOR SELECT USING (auth.uid() = user_id);

-- System health metrics (public read)
CREATE POLICY "Anyone can view system health metrics" ON system_health_metrics
    FOR SELECT USING (TRUE);

-- Model configurations (public read for active models)
CREATE POLICY "Anyone can view active model configurations" ON model_configurations
    FOR SELECT USING (is_active = TRUE);

-- =====================================================
-- DEFAULT DATA
-- =====================================================

-- Insert default model configurations
INSERT INTO model_configurations (name, provider, model_name, config, is_active) VALUES
    ('gpt-4', 'openai', 'gpt-4', '{"temperature": 0.7, "max_tokens": 4096}'::jsonb, TRUE),
    ('gpt-3.5-turbo', 'openai', 'gpt-3.5-turbo', '{"temperature": 0.7, "max_tokens": 4096}'::jsonb, TRUE),
    ('claude-3-opus', 'anthropic', 'claude-3-opus-20240229', '{"temperature": 0.7, "max_tokens": 4096}'::jsonb, TRUE),
    ('llama-2-70b', 'ollama', 'llama2:70b', '{"temperature": 0.7, "max_tokens": 4096}'::jsonb, TRUE)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- GRANTS (for service role)
-- =====================================================

-- Grant usage on schemas
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;

-- Grant permissions on tables
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Grant permissions on sequences
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Grant execute on functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.role() TO anon, authenticated;

-- =====================================================
-- MIGRATION COMPLETION
-- =====================================================

-- Log migration completion
INSERT INTO system_health_metrics (metric_name, metric_value, metric_unit, component, metadata)
VALUES (
    'migration_completed',
    20,
    'version',
    'database',
    jsonb_build_object(
        'migration_name', '020_production_consolidated_schema_v2',
        'timestamp', NOW(),
        'description', 'Production consolidated schema with resolved conflicts'
    )
);