-- Universal AI Tools - Fixed Production Schema
-- Created: 2025-01-20
-- This is the corrected schema that works with Supabase's existing auth system
-- Removes attempts to create tables in the auth schema

-- =====================================================
-- EXTENSIONS
-- =====================================================
-- Enable required extensions (pg_net only created once in extensions schema)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_net" SCHEMA extensions;

-- =====================================================
-- ENHANCED JWT AUTH SYSTEM TABLES
-- =====================================================

-- Enhanced users profile table that extends auth.users
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) DEFAULT 'user' NOT NULL,
    is_active BOOLEAN DEFAULT true,
    failed_login_attempts INTEGER DEFAULT 0,
    account_locked_until TIMESTAMPTZ,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Refresh tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_id UUID NOT NULL UNIQUE,
    encrypted_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_revoked BOOLEAN DEFAULT false,
    revoked_at TIMESTAMPTZ,
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User activity tracking
CREATE TABLE IF NOT EXISTS user_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    session_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Authentication events logging
CREATE TABLE IF NOT EXISTS auth_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    additional_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User sessions management
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_token TEXT NOT NULL UNIQUE,
    refresh_token_id UUID REFERENCES refresh_tokens(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- AI AGENTS FOUNDATION
-- =====================================================

-- Agent service types
CREATE TYPE agent_type AS ENUM ('cognitive', 'tool', 'coordinator', 'specialist');
CREATE TYPE agent_status AS ENUM ('active', 'inactive', 'maintenance', 'error');

-- AI Agents table
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    type agent_type NOT NULL,
    description TEXT,
    capabilities JSONB DEFAULT '[]'::jsonb,
    configuration JSONB DEFAULT '{}'::jsonb,
    status agent_status DEFAULT 'active',
    version VARCHAR(20) DEFAULT '1.0.0',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Agent capabilities
CREATE TABLE IF NOT EXISTS agent_capabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    capability_name VARCHAR(100) NOT NULL,
    parameters JSONB DEFAULT '{}'::jsonb,
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- MEMORY AND KNOWLEDGE MANAGEMENT
-- =====================================================

-- Core memories table with vector embeddings
CREATE TABLE IF NOT EXISTS memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Support for different memory sources
    source_type TEXT NOT NULL CHECK (source_type IN ('agent', 'service', 'athena', 'user')),
    source_id UUID, -- Can reference agents.id, ai_services.id, or auth.users.id
    
    -- Core memory fields
    content TEXT NOT NULL,
    embedding vector(1536),
    
    -- Memory metadata
    memory_type TEXT NOT NULL DEFAULT 'general',
    importance FLOAT DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
    
    -- Memory management
    access_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    
    -- Contextual metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    tags TEXT[] DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- User association
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Indexes for performance
    CONSTRAINT memories_source_check CHECK (
        (source_type = 'agent' AND source_id IS NOT NULL) OR
        (source_type = 'service' AND source_id IS NOT NULL) OR
        (source_type = 'athena' AND source_id IS NOT NULL) OR
        (source_type = 'user' AND user_id IS NOT NULL)
    )
);

-- Create indexes for memories
CREATE INDEX idx_memories_embedding ON memories USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_memories_source ON memories (source_type, source_id);
CREATE INDEX idx_memories_user_id ON memories (user_id);
CREATE INDEX idx_memories_created_at ON memories (created_at DESC);
CREATE INDEX idx_memories_memory_type ON memories (memory_type);
CREATE INDEX idx_memories_tags ON memories USING gin (tags);
CREATE INDEX idx_memories_metadata ON memories USING gin (metadata);

-- Knowledge base entries
CREATE TABLE IF NOT EXISTS knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(100),
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}'::jsonb,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- =====================================================
-- CONVERSATIONS AND MESSAGES
-- =====================================================

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    conversation_id TEXT, -- For external conversation tracking
    title VARCHAR(255),
    context JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

-- Messages within conversations
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT NOT NULL,
    tool_calls JSONB,
    tool_results JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TASK MANAGEMENT
-- =====================================================

-- Task status enum
CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed', 'failed', 'cancelled');

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    task_type VARCHAR(100),
    parameters JSONB DEFAULT '{}'::jsonb,
    result JSONB,
    status task_status DEFAULT 'pending',
    priority INTEGER DEFAULT 5,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- =====================================================
-- WIDGETS SYSTEM
-- =====================================================

-- Widgets table
CREATE TABLE IF NOT EXISTS widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- User association
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_by TEXT, -- For legacy compatibility
    
    -- Basic widget info
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'custom',
    category TEXT,
    tags TEXT[] DEFAULT '{}',
    
    -- Widget configuration
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    style JSONB DEFAULT '{}'::jsonb,
    
    -- Natural language support
    natural_language_query TEXT,
    natural_language_context JSONB DEFAULT '{}'::jsonb,
    
    -- DSPy support
    dspy_pipeline JSONB,
    dspy_examples JSONB[] DEFAULT '{}',
    dspy_metrics JSONB DEFAULT '{}'::jsonb,
    dspy_optimized BOOLEAN DEFAULT false,
    
    -- Widget code/template
    code TEXT,
    template TEXT,
    
    -- Features and settings
    is_public BOOLEAN DEFAULT false,
    is_template BOOLEAN DEFAULT false,
    parent_widget_id UUID REFERENCES widgets(id) ON DELETE SET NULL,
    
    -- Performance and analytics
    execution_count INTEGER DEFAULT 0,
    average_execution_time FLOAT,
    last_executed_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    
    -- Search
    search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(natural_language_query, '')), 'C')
    ) STORED
);

-- Widget versions
CREATE TABLE IF NOT EXISTS widget_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    widget_id UUID REFERENCES widgets(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL DEFAULT 1,
    version TEXT,
    config JSONB NOT NULL,
    code TEXT,
    changelog TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    UNIQUE(widget_id, version),
    UNIQUE(widget_id, version_number)
);

-- Widget dependencies
CREATE TABLE IF NOT EXISTS widget_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    widget_id UUID REFERENCES widgets(id) ON DELETE CASCADE,
    depends_on_widget_id UUID REFERENCES widgets(id) ON DELETE CASCADE,
    dependency_type TEXT DEFAULT 'uses',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(widget_id, depends_on_widget_id)
);

-- Widget usage tracking
CREATE TABLE IF NOT EXISTS widget_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    widget_id UUID REFERENCES widgets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    service_id TEXT,
    action TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Widget sharing
CREATE TABLE IF NOT EXISTS widget_shares (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    widget_id UUID REFERENCES widgets(id) ON DELETE CASCADE,
    shared_with UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    permission TEXT CHECK (permission IN ('view', 'edit')) DEFAULT 'view',
    shared_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(widget_id, shared_with)
);

-- Widget likes
CREATE TABLE IF NOT EXISTS widget_likes (
    widget_id UUID REFERENCES widgets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (widget_id, user_id)
);

-- Widget comments
CREATE TABLE IF NOT EXISTS widget_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    widget_id UUID REFERENCES widgets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_id UUID REFERENCES widget_comments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Widget generation tracking
CREATE TABLE IF NOT EXISTS widget_generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    widget_id UUID REFERENCES widgets(id) ON DELETE CASCADE,
    generation_prompt TEXT NOT NULL,
    generation_params JSONB DEFAULT '{}'::jsonb,
    model_used TEXT,
    tokens_used INTEGER,
    generation_time_ms INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TOOLS AND INTEGRATIONS
-- =====================================================

-- Tools registry
CREATE TABLE IF NOT EXISTS tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    category VARCHAR(100),
    configuration JSONB DEFAULT '{}'::jsonb,
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tool executions
CREATE TABLE IF NOT EXISTS tool_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_id UUID REFERENCES tools(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    input_params JSONB DEFAULT '{}'::jsonb,
    output_result JSONB,
    execution_time_ms INTEGER,
    status VARCHAR(50) NOT NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- External integrations
CREATE TABLE IF NOT EXISTS integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    configuration JSONB DEFAULT '{}'::jsonb,
    credentials JSONB, -- Should be encrypted
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SECURITY AND MONITORING
-- =====================================================

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- API keys
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_hash TEXT NOT NULL UNIQUE,
    name VARCHAR(100),
    permissions JSONB DEFAULT '[]'::jsonb,
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- System health metrics
CREATE TABLE IF NOT EXISTS system_health_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_type VARCHAR(100) NOT NULL,
    metric_value JSONB NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- AI SERVICES AND WORKFLOW
-- =====================================================

-- AI service definitions
CREATE TABLE IF NOT EXISTS ai_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL,
    endpoint TEXT,
    api_key_encrypted TEXT,
    configuration JSONB DEFAULT '{}'::jsonb,
    rate_limits JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflow definitions
CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    definition JSONB NOT NULL,
    trigger_config JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflow executions
CREATE TABLE IF NOT EXISTS workflow_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- =====================================================
-- DSPY OPTIMIZATION SYSTEM
-- =====================================================

-- DSPy pipelines
CREATE TABLE IF NOT EXISTS dspy_pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    pipeline_config JSONB NOT NULL,
    optimization_config JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- DSPy examples for training
CREATE TABLE IF NOT EXISTS dspy_examples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID REFERENCES dspy_pipelines(id) ON DELETE CASCADE,
    input_data JSONB NOT NULL,
    expected_output JSONB NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_training BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DSPy optimization runs
CREATE TABLE IF NOT EXISTS dspy_optimization_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID REFERENCES dspy_pipelines(id) ON DELETE CASCADE,
    optimizer_type VARCHAR(100) NOT NULL,
    parameters JSONB DEFAULT '{}'::jsonb,
    metrics JSONB,
    best_score FLOAT,
    status VARCHAR(50) NOT NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- =====================================================
-- SECURITY HARDENING TABLES
-- =====================================================

-- Security key rotations
CREATE TABLE IF NOT EXISTS security_key_rotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_type VARCHAR(50) NOT NULL,
    old_key_hash TEXT NOT NULL,
    new_key_hash TEXT NOT NULL,
    rotated_by UUID REFERENCES auth.users(id),
    rotation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Security audit results
CREATE TABLE IF NOT EXISTS security_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_type VARCHAR(100) NOT NULL,
    findings JSONB DEFAULT '[]'::jsonb,
    severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rate limiting
CREATE TABLE IF NOT EXISTS rate_limit_violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL, -- Can be user_id, ip_address, api_key, etc.
    limit_type VARCHAR(50) NOT NULL,
    attempted_at TIMESTAMPTZ DEFAULT NOW(),
    limit_exceeded_count INTEGER DEFAULT 1
);

-- =====================================================
-- ATHENA WIDGET CREATION SYSTEM
-- =====================================================

-- Widget templates
CREATE TABLE IF NOT EXISTS widget_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    template_config JSONB NOT NULL,
    example_usage TEXT,
    required_capabilities TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Widget creation sessions
CREATE TABLE IF NOT EXISTS widget_creation_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_prompt TEXT NOT NULL,
    generated_config JSONB,
    iterations INTEGER DEFAULT 0,
    final_widget_id UUID REFERENCES widgets(id),
    feedback JSONB DEFAULT '[]'::jsonb,
    success BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Note: auth.uid(), auth.jwt(), and auth.role() functions are provided by Supabase
-- No need to create them manually

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Search widgets function
CREATE OR REPLACE FUNCTION search_widgets(search_query TEXT)
RETURNS TABLE (
    id UUID,
    name TEXT,
    description TEXT,
    rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        w.id,
        w.name,
        w.description,
        ts_rank(w.search_vector, plainto_tsquery('english', search_query)) AS rank
    FROM widgets w
    WHERE w.search_vector @@ plainto_tsquery('english', search_query)
    ORDER BY rank DESC;
END;
$$ LANGUAGE plpgsql;

-- Cleanup expired data
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS void AS $$
BEGIN
    -- Delete expired memories
    DELETE FROM memories WHERE expires_at < NOW();
    
    -- Delete old audit logs (keep 90 days)
    DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days';
    
    -- Delete expired refresh tokens
    DELETE FROM refresh_tokens WHERE expires_at < NOW();
    
    -- Delete old system health metrics (keep 30 days)
    DELETE FROM system_health_metrics WHERE timestamp < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Fork a widget
CREATE OR REPLACE FUNCTION fork_widget(source_widget_id UUID)
RETURNS UUID AS $$
DECLARE
    new_widget_id UUID;
BEGIN
    INSERT INTO widgets (
        user_id,
        name,
        description,
        type,
        category,
        tags,
        config,
        style,
        natural_language_query,
        natural_language_context,
        dspy_pipeline,
        dspy_examples,
        code,
        template,
        parent_widget_id
    )
    SELECT
        auth.uid(),
        name || ' (Fork)',
        description,
        type,
        category,
        tags,
        config,
        style,
        natural_language_query,
        natural_language_context,
        dspy_pipeline,
        dspy_examples,
        code,
        template,
        source_widget_id
    FROM widgets
    WHERE id = source_widget_id
    AND (
        is_public = true
        OR user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM widget_shares
            WHERE widget_id = source_widget_id
            AND shared_with = auth.uid()
        )
    )
    RETURNING id INTO new_widget_id;
    
    RETURN new_widget_id;
END;
$$ LANGUAGE plpgsql;

-- Get widget statistics
CREATE OR REPLACE FUNCTION get_widget_stats(widget_id UUID)
RETURNS TABLE (
    total_uses INTEGER,
    total_likes INTEGER,
    total_comments INTEGER,
    total_forks INTEGER,
    average_execution_time FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(COUNT(DISTINCT wu.id), 0)::INTEGER AS total_uses,
        COALESCE(COUNT(DISTINCT wl.user_id), 0)::INTEGER AS total_likes,
        COALESCE(COUNT(DISTINCT wc.id), 0)::INTEGER AS total_comments,
        COALESCE(COUNT(DISTINCT w2.id), 0)::INTEGER AS total_forks,
        COALESCE(AVG(w.average_execution_time), 0)::FLOAT AS average_execution_time
    FROM widgets w
    LEFT JOIN widget_usage wu ON wu.widget_id = w.id
    LEFT JOIN widget_likes wl ON wl.widget_id = w.id
    LEFT JOIN widget_comments wc ON wc.widget_id = w.id
    LEFT JOIN widgets w2 ON w2.parent_widget_id = w.id
    WHERE w.id = get_widget_stats.widget_id
    GROUP BY w.id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update timestamp triggers
CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_memories_updated_at BEFORE UPDATE ON memories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_base_updated_at BEFORE UPDATE ON knowledge_base
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_widgets_updated_at BEFORE UPDATE ON widgets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tools_updated_at BEFORE UPDATE ON tools
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON integrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_services_updated_at BEFORE UPDATE ON ai_services
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dspy_pipelines_updated_at BEFORE UPDATE ON dspy_pipelines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_widget_templates_updated_at BEFORE UPDATE ON widget_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_refresh_tokens_updated_at BEFORE UPDATE ON refresh_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_activity_updated_at BEFORE UPDATE ON user_activity
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_sessions_updated_at BEFORE UPDATE ON user_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_widget_comments_updated_at BEFORE UPDATE ON widget_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE widget_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE widget_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE widget_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE widget_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE widget_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE widget_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE widget_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dspy_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE dspy_examples ENABLE ROW LEVEL SECURITY;
ALTER TABLE dspy_optimization_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_key_rotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE widget_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE widget_creation_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies

-- User profiles policies
CREATE POLICY "Users can view their own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Agents policies
CREATE POLICY "Users can view their own agents" ON agents
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own agents" ON agents
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own agents" ON agents
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own agents" ON agents
    FOR DELETE USING (auth.uid() = user_id);

-- Agent capabilities policies
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

-- Memories policies
CREATE POLICY "Users can view their own memories" ON memories
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own memories" ON memories
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own memories" ON memories
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own memories" ON memories
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

-- Messages policies
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

-- Widget versions policies
CREATE POLICY "Users can view versions of accessible widgets" ON widget_versions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM widgets 
            WHERE widgets.id = widget_versions.widget_id 
            AND (widgets.user_id = auth.uid() OR widgets.is_public = TRUE)
        )
    );

CREATE POLICY "Users can create versions for their widgets" ON widget_versions
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

CREATE POLICY "Users can track widget usage" ON widget_usage
    FOR INSERT WITH CHECK (true);

-- Widget shares policies
CREATE POLICY "Widget owners can manage shares" ON widget_shares
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM widgets
            WHERE widgets.id = widget_shares.widget_id
            AND widgets.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view their shares" ON widget_shares
    FOR SELECT USING (shared_with = auth.uid());

-- Widget likes policies
CREATE POLICY "Users can view likes on accessible widgets" ON widget_likes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM widgets
            WHERE widgets.id = widget_likes.widget_id
            AND (widgets.is_public = true OR widgets.user_id = auth.uid())
        )
    );

CREATE POLICY "Users can like accessible widgets" ON widget_likes
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM widgets
            WHERE widgets.id = widget_likes.widget_id
            AND (
                widgets.is_public = true
                OR widgets.user_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM widget_shares
                    WHERE widget_shares.widget_id = widgets.id
                    AND widget_shares.shared_with = auth.uid()
                )
            )
        )
    );

CREATE POLICY "Users can unlike widgets" ON widget_likes
    FOR DELETE USING (auth.uid() = user_id);

-- Widget comments policies
CREATE POLICY "Users can view comments on accessible widgets" ON widget_comments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM widgets
            WHERE widgets.id = widget_comments.widget_id
            AND (widgets.is_public = true OR widgets.user_id = auth.uid())
        )
    );

CREATE POLICY "Users can comment on accessible widgets" ON widget_comments
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM widgets
            WHERE widgets.id = widget_comments.widget_id
            AND (
                widgets.is_public = true
                OR widgets.user_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM widget_shares
                    WHERE widget_shares.widget_id = widgets.id
                    AND widget_shares.shared_with = auth.uid()
                )
            )
        )
    );

CREATE POLICY "Users can update their own comments" ON widget_comments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON widget_comments
    FOR DELETE USING (auth.uid() = user_id);

-- Widget generations policies
CREATE POLICY "Users can view generation history for their widgets" ON widget_generations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM widgets
            WHERE widgets.id = widget_generations.widget_id
            AND widgets.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can create generation records" ON widget_generations
    FOR INSERT WITH CHECK (true);

-- Tool policies
CREATE POLICY "Authenticated users can view tools" ON tools
    FOR SELECT USING (true);

CREATE POLICY "Service role can manage tools" ON tools
    FOR ALL USING (auth.role() = 'service_role');

-- Tool executions policies
CREATE POLICY "Users can view their tool executions" ON tool_executions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM tasks
            WHERE tasks.id = tool_executions.task_id
            AND tasks.user_id = auth.uid()
        )
    );

-- Audit logs policies
CREATE POLICY "Users can view their own audit logs" ON audit_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Auth system policies
CREATE POLICY "Users can view their own refresh tokens" ON refresh_tokens
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own activity" ON user_activity
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own auth events" ON auth_events
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own sessions" ON user_sessions
    FOR ALL USING (auth.uid() = user_id);

-- Security policies
CREATE POLICY "Service role only for key rotations" ON security_key_rotations
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Read audit results" ON security_audits
    FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

CREATE POLICY "Write audit results" ON security_audits
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- System health metrics (public read)
CREATE POLICY "Public read system health" ON system_health_metrics
    FOR SELECT USING (true);

CREATE POLICY "Service role write system health" ON system_health_metrics
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Widget templates (public read)
CREATE POLICY "Public read widget templates" ON widget_templates
    FOR SELECT USING (is_active = true);

CREATE POLICY "Service role manage templates" ON widget_templates
    FOR ALL USING (auth.role() = 'service_role');

-- Widget creation sessions
CREATE POLICY "Users view their sessions" ON widget_creation_sessions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM widgets
            WHERE widgets.id = widget_creation_sessions.final_widget_id
            AND widgets.user_id = auth.uid()
        )
    );

-- =====================================================
-- INDEXES
-- =====================================================

-- Create indexes for performance
CREATE INDEX idx_widgets_user_id ON widgets(user_id);
CREATE INDEX idx_widgets_is_public ON widgets(is_public);
CREATE INDEX idx_widgets_search_vector ON widgets USING gin(search_vector);
CREATE INDEX idx_widgets_created_at ON widgets(created_at DESC);
CREATE INDEX idx_widgets_type_category ON widgets(type, category);

CREATE INDEX idx_agents_user_id ON agents(user_id);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_type ON agents(type);

CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_agent_id ON tasks(agent_id);

CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_agent_id ON conversations(agent_id);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

CREATE INDEX idx_knowledge_base_user_id ON knowledge_base(user_id);
CREATE INDEX idx_knowledge_base_category ON knowledge_base(category);

CREATE INDEX idx_widget_versions_widget_id ON widget_versions(widget_id);
CREATE INDEX idx_widget_usage_widget_id ON widget_usage(widget_id);
CREATE INDEX idx_widget_usage_created_at ON widget_usage(created_at);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

CREATE INDEX idx_system_health_metrics_type ON system_health_metrics(metric_type);
CREATE INDEX idx_system_health_metrics_timestamp ON system_health_metrics(timestamp DESC);

-- =====================================================
-- VIEWS
-- =====================================================

-- Active user sessions view
CREATE OR REPLACE VIEW active_user_sessions AS
SELECT 
    us.id,
    us.user_id,
    u.email,
    us.ip_address,
    us.user_agent,
    us.created_at,
    us.expires_at
FROM user_sessions us
JOIN auth.users u ON u.id = us.user_id
WHERE us.is_active = true
    AND us.expires_at > NOW();

-- Widget statistics view
CREATE OR REPLACE VIEW widget_statistics AS
SELECT 
    w.id,
    w.name,
    w.user_id,
    COUNT(DISTINCT wu.id) as usage_count,
    COUNT(DISTINCT wl.user_id) as like_count,
    COUNT(DISTINCT wc.id) as comment_count,
    COUNT(DISTINCT ws.id) as share_count,
    COUNT(DISTINCT wf.id) as fork_count
FROM widgets w
LEFT JOIN widget_usage wu ON wu.widget_id = w.id
LEFT JOIN widget_likes wl ON wl.widget_id = w.id
LEFT JOIN widget_comments wc ON wc.widget_id = w.id
LEFT JOIN widget_shares ws ON ws.widget_id = w.id
LEFT JOIN widgets wf ON wf.parent_widget_id = w.id
GROUP BY w.id, w.name, w.user_id;

-- Security alerts view
CREATE OR REPLACE VIEW security_alerts AS
SELECT 
    'failed_login' as alert_type,
    u.id as user_id,
    u.email,
    up.failed_login_attempts as severity_score,
    up.updated_at as occurred_at
FROM auth.users u
JOIN user_profiles up ON up.id = u.id
WHERE up.failed_login_attempts > 3
UNION ALL
SELECT 
    'rate_limit' as alert_type,
    NULL as user_id,
    rlv.identifier as email,
    rlv.limit_exceeded_count as severity_score,
    rlv.attempted_at as occurred_at
FROM rate_limit_violations rlv
WHERE rlv.attempted_at > NOW() - INTERVAL '1 hour';

-- Auth statistics view
CREATE OR REPLACE VIEW auth_statistics AS
SELECT 
    COUNT(DISTINCT ae.user_id) FILTER (WHERE ae.event_type = 'login' AND ae.success = true) as successful_logins,
    COUNT(DISTINCT ae.user_id) FILTER (WHERE ae.event_type = 'login' AND ae.success = false) as failed_logins,
    COUNT(DISTINCT rt.user_id) as active_refresh_tokens,
    COUNT(DISTINCT us.user_id) as active_sessions
FROM auth_events ae
FULL OUTER JOIN refresh_tokens rt ON rt.expires_at > NOW() AND rt.is_revoked = false
FULL OUTER JOIN user_sessions us ON us.expires_at > NOW() AND us.is_active = true
WHERE ae.created_at > NOW() - INTERVAL '24 hours';

-- =====================================================
-- SCHEDULED JOBS (Using pg_cron)
-- =====================================================

-- Schedule cleanup job to run daily at 2 AM
SELECT cron.schedule(
    'cleanup-expired-data',
    '0 2 * * *',
    'SELECT cleanup_expired_data();'
);

-- Schedule security audit to run weekly
SELECT cron.schedule(
    'security-audit',
    '0 3 * * 0',
    $$
    INSERT INTO security_audits (audit_type, findings, severity)
    SELECT 
        'weekly_audit',
        jsonb_build_object(
            'failed_logins', COUNT(*) FILTER (WHERE event_type = 'login' AND success = false),
            'locked_accounts', COUNT(DISTINCT user_id) FILTER (WHERE event_type = 'account_locked'),
            'suspicious_activities', COUNT(*) FILTER (WHERE event_type LIKE '%suspicious%')
        ),
        CASE 
            WHEN COUNT(*) FILTER (WHERE event_type = 'login' AND success = false) > 100 THEN 'high'
            WHEN COUNT(*) FILTER (WHERE event_type = 'login' AND success = false) > 50 THEN 'medium'
            ELSE 'low'
        END
    FROM auth_events
    WHERE created_at > NOW() - INTERVAL '7 days';
    $$
);

-- =====================================================
-- GRANTS
-- =====================================================

-- Grant usage on schemas
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant execute on functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================

-- Add helpful comments
COMMENT ON TABLE widgets IS 'Stores all widget definitions and configurations';
COMMENT ON TABLE memories IS 'Vector-enabled memory storage for AI agents and services';
COMMENT ON TABLE agents IS 'AI agent definitions and configurations';
COMMENT ON TABLE dspy_pipelines IS 'DSPy optimization pipeline configurations';
COMMENT ON TABLE widget_templates IS 'Pre-built widget templates for common use cases';
COMMENT ON TABLE security_audits IS 'Security audit results and findings';
COMMENT ON TABLE widget_creation_sessions IS 'Tracks Athena widget creation sessions';

COMMENT ON FUNCTION search_widgets IS 'Full-text search for widgets';
COMMENT ON FUNCTION cleanup_expired_data IS 'Removes expired data from various tables';
COMMENT ON FUNCTION fork_widget IS 'Creates a fork of an existing widget';
COMMENT ON FUNCTION get_widget_stats IS 'Returns statistics for a widget';

COMMENT ON VIEW active_user_sessions IS 'Shows currently active user sessions';
COMMENT ON VIEW security_alerts IS 'High-risk security events requiring attention';
COMMENT ON VIEW auth_statistics IS 'Authentication statistics for monitoring';

-- =====================================================
-- FINAL SETUP
-- =====================================================

-- Ensure all tables have proper ownership
-- This would typically be done by the Supabase setup process

-- Create initial admin user if needed (only in development)
-- This should be removed or modified for production