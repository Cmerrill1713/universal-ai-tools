-- =====================================================
-- Universal AI Tools - Consolidated Database Schema
-- Version: 1.0.0
-- Date: 2025-07-30
-- =====================================================
-- This consolidated migration combines all previous migrations
-- into a single, well-organized schema with proper dependencies

-- =====================================================
-- 1. EXTENSIONS (Must be first)
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_net";
-- pg_cron must be enabled in the main postgres database
-- CREATE EXTENSION IF NOT EXISTS "pg_cron";
-- pgjwt extension
-- CREATE EXTENSION IF NOT EXISTS "pgjwt";

-- =====================================================
-- 2. CUSTOM TYPES & ENUMS
-- =====================================================

-- Core enums
DO $$ BEGIN
    CREATE TYPE agent_status AS ENUM ('active', 'inactive', 'deprecated', 'testing');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE task_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE model_status AS ENUM ('pending', 'training', 'ready', 'failed', 'archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- 3. CORE TABLES
-- =====================================================

-- AI Service Keys (API key management)
CREATE TABLE IF NOT EXISTS ai_service_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_name TEXT NOT NULL,
    api_key TEXT, -- Will be moved to vault
    is_active BOOLEAN DEFAULT true,
    rate_limit INTEGER DEFAULT 1000,
    rate_window INTEGER DEFAULT 3600,
    last_used TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(service_name)
);

-- Unified Memories table with vector support
CREATE TABLE IF NOT EXISTS memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,  -- References auth.users(id) when auth schema exists
    agent_id UUID, -- References agents(id) when available
    source_type TEXT DEFAULT 'ai' CHECK (source_type IN ('ai', 'agent', 'athena', 'manual', 'system')),
    source_id TEXT, -- Flexible reference to source (can be UUID or string)
    content TEXT NOT NULL,
    embedding vector(1536), -- OpenAI embedding dimension
    context JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    importance REAL DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
    access_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT check_importance CHECK (importance >= 0 AND importance <= 1)
);

-- Backward compatibility: Create ai_memories as a view
CREATE OR REPLACE VIEW ai_memories AS
SELECT
    id,
    user_id,
    agent_id::text as agent_id,
    content,
    embedding,
    context,
    metadata,
    importance,
    access_count,
    last_accessed,
    expires_at,
    created_at,
    updated_at
FROM memories
WHERE source_type = 'ai';

-- Indexes will be created after all tables

-- Knowledge Sources
CREATE TABLE IF NOT EXISTS knowledge_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,  -- References auth.users(id) when auth schema exists
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    content_embedding vector(1536),
    source TEXT NOT NULL,
    source_type TEXT CHECK (source_type IN ('manual', 'web', 'file', 'api', 'generated')),
    url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    tags TEXT[] DEFAULT '{}',
    is_verified BOOLEAN DEFAULT false,
    quality_score REAL DEFAULT 0.5 CHECK (quality_score >= 0 AND quality_score <= 1),
    access_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT check_quality_score CHECK (quality_score >= 0 AND quality_score <= 1)
);

-- Indexes will be created after all tables

-- =====================================================
-- 4. AGENT SYSTEM TABLES
-- =====================================================

-- Agent Registry
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    status agent_status DEFAULT 'active',
    capabilities TEXT[] DEFAULT '{}',
    dependencies TEXT[] DEFAULT '{}',
    configuration JSONB DEFAULT '{}'::jsonb,
    memory_enabled BOOLEAN DEFAULT true,
    max_latency_ms INTEGER DEFAULT 5000,
    retry_attempts INTEGER DEFAULT 3,
    version TEXT DEFAULT '1.0.0',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_agent_name UNIQUE(name)
);

-- Agent Performance Metrics
CREATE TABLE IF NOT EXISTS agent_performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id TEXT NOT NULL,
    metric_type TEXT NOT NULL,
    value NUMERIC NOT NULL,
    unit TEXT,
    context JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT check_metric_value CHECK (value IS NOT NULL)
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,  -- References auth.users(id) when auth schema exists
    agent_name TEXT NOT NULL,
    supporting_agents TEXT[] DEFAULT '{}',
    status task_status DEFAULT 'pending',
    priority task_priority DEFAULT 'medium',
    user_request TEXT NOT NULL,
    context JSONB DEFAULT '{}'::jsonb,
    result JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT check_task_dates CHECK (started_at IS NULL OR created_at <= started_at)
);

-- =====================================================
-- 5. MLX & FINE-TUNING TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS mlx_fine_tuning_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,  -- References auth.users(id) when auth schema exists
    job_name TEXT NOT NULL,
    base_model TEXT NOT NULL,
    status model_status DEFAULT 'pending',
    training_data JSONB NOT NULL,
    hyperparameters JSONB DEFAULT '{}'::jsonb,
    optimization_type TEXT DEFAULT 'lora',
    progress REAL DEFAULT 0 CHECK (progress >= 0 AND progress <= 1),
    metrics JSONB DEFAULT '{}'::jsonb,
    model_path TEXT,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT check_progress CHECK (progress >= 0 AND progress <= 1)
);

-- =====================================================
-- 6. INTELLIGENT PARAMETERS
-- =====================================================

CREATE TABLE IF NOT EXISTS intelligent_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_name TEXT NOT NULL,
    task_type TEXT NOT NULL,
    parameter_set JSONB NOT NULL,
    performance_score REAL DEFAULT 0.5,
    usage_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    average_latency_ms INTEGER,
    context_hash TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(model_name, task_type, context_hash)
);

-- =====================================================
-- 7. SELF-IMPROVEMENT & LEARNING
-- =====================================================

CREATE TABLE IF NOT EXISTS self_improvement_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    improvement_type TEXT NOT NULL,
    agent_id TEXT,
    before_state JSONB NOT NULL,
    after_state JSONB NOT NULL,
    improvement_metrics JSONB DEFAULT '{}'::jsonb,
    success BOOLEAN DEFAULT false,
    confidence_score REAL DEFAULT 0.5,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT check_confidence CHECK (confidence_score >= 0 AND confidence_score <= 1)
);

CREATE TABLE IF NOT EXISTS alpha_evolve_experiments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    experiment_name TEXT NOT NULL,
    hypothesis TEXT NOT NULL,
    configuration JSONB NOT NULL,
    results JSONB DEFAULT '{}'::jsonb,
    success_criteria JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'running',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT check_experiment_dates CHECK (completed_at IS NULL OR started_at <= completed_at)
);

-- =====================================================
-- 8. SECURITY TABLES
-- =====================================================

-- API Secrets (moved from environment variables)
CREATE TABLE IF NOT EXISTS api_secrets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_name TEXT UNIQUE NOT NULL,
    encrypted_value TEXT NOT NULL,
    service_name TEXT NOT NULL,
    description TEXT,
    rotation_period_days INTEGER DEFAULT 90,
    last_rotated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_key_name UNIQUE(key_name)
);

-- Webhook Events
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    webhook_url TEXT NOT NULL,
    headers JSONB DEFAULT '{}'::jsonb,
    method TEXT DEFAULT 'POST',
    sent_at TIMESTAMP WITH TIME ZONE,
    response_status INTEGER,
    response_body TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT check_retry_count CHECK (retry_count >= 0)
);

-- =====================================================
-- 9. INDEXES
-- =====================================================

-- Unified Memories indexes
CREATE INDEX IF NOT EXISTS idx_memories_user_agent ON memories (user_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_memories_source ON memories (source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories (importance DESC);
CREATE INDEX IF NOT EXISTS idx_memories_created ON memories (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_embedding ON memories USING ivfflat (embedding vector_cosine_ops) WHERE embedding IS NOT NULL;

-- Knowledge Sources indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_source_type ON knowledge_sources (source_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_tags ON knowledge_sources USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_knowledge_quality ON knowledge_sources (quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_embedding ON knowledge_sources USING ivfflat (content_embedding vector_cosine_ops) WHERE content_embedding IS NOT NULL;

-- Agents indexes
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents (status);
CREATE INDEX IF NOT EXISTS idx_agents_category ON agents (category);

-- Agent Performance Metrics indexes
CREATE INDEX IF NOT EXISTS idx_metrics_agent_type ON agent_performance_metrics (agent_id, metric_type);
CREATE INDEX IF NOT EXISTS idx_metrics_recorded ON agent_performance_metrics (recorded_at DESC);

-- Tasks indexes
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks (user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks (agent_name);
CREATE INDEX IF NOT EXISTS idx_tasks_priority_status ON tasks (priority, status);

-- MLX Fine-tuning indexes
CREATE INDEX IF NOT EXISTS idx_mlx_jobs_user_status ON mlx_fine_tuning_jobs (user_id, status);
CREATE INDEX IF NOT EXISTS idx_mlx_jobs_created ON mlx_fine_tuning_jobs (created_at DESC);

-- Intelligent Parameters indexes
CREATE INDEX IF NOT EXISTS idx_params_model_task ON intelligent_parameters (model_name, task_type);
CREATE INDEX IF NOT EXISTS idx_params_performance ON intelligent_parameters (performance_score DESC);
CREATE INDEX IF NOT EXISTS idx_params_usage ON intelligent_parameters (usage_count DESC);

-- Self Improvement indexes
CREATE INDEX IF NOT EXISTS idx_improvement_type ON self_improvement_logs (improvement_type);
CREATE INDEX IF NOT EXISTS idx_improvement_agent ON self_improvement_logs (agent_id);
CREATE INDEX IF NOT EXISTS idx_improvement_success ON self_improvement_logs (success);

-- Alpha Evolve indexes
CREATE INDEX IF NOT EXISTS idx_experiments_status ON alpha_evolve_experiments (status);
CREATE INDEX IF NOT EXISTS idx_experiments_started ON alpha_evolve_experiments (started_at DESC);

-- API Secrets indexes
CREATE INDEX IF NOT EXISTS idx_secrets_service ON api_secrets (service_name);

-- Webhook Events indexes
CREATE INDEX IF NOT EXISTS idx_webhook_events_pending ON webhook_events (created_at) WHERE sent_at IS NULL AND retry_count < max_retries;
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON webhook_events (event_type);

-- =====================================================
-- 10. FUNCTIONS
-- =====================================================

-- Vector similarity search for memories
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

-- Update timestamps trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =====================================================
-- 10. TRIGGERS
-- =====================================================

-- Add update triggers to all tables with updated_at
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN
        SELECT table_name
        FROM information_schema.columns
        WHERE column_name = 'updated_at'
        AND table_schema = 'public'
    LOOP
        -- Drop trigger if exists, then create
        EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON %I', t, t);
        EXECUTE format('
            CREATE TRIGGER update_%I_updated_at
            BEFORE UPDATE ON %I
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column()',
            t, t
        );
    END LOOP;
END $$;

-- =====================================================
-- 11. ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on all user-specific tables
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE mlx_fine_tuning_jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies will be created only if auth schema exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
        -- Unified Memories policies
        EXECUTE 'CREATE POLICY "Users can view their own memories" ON memories
            FOR SELECT USING (auth.uid() = user_id)';

        EXECUTE 'CREATE POLICY "Users can create their own memories" ON memories
            FOR INSERT WITH CHECK (auth.uid() = user_id)';

        EXECUTE 'CREATE POLICY "Users can update their own memories" ON memories
            FOR UPDATE USING (auth.uid() = user_id)';

        EXECUTE 'CREATE POLICY "Users can delete their own memories" ON memories
            FOR DELETE USING (auth.uid() = user_id)';

        -- Knowledge Sources policies
        EXECUTE 'CREATE POLICY "Users can view their own knowledge" ON knowledge_sources
            FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL)';

        EXECUTE 'CREATE POLICY "Users can create knowledge" ON knowledge_sources
            FOR INSERT WITH CHECK (auth.uid() = user_id)';

        EXECUTE 'CREATE POLICY "Users can update their own knowledge" ON knowledge_sources
            FOR UPDATE USING (auth.uid() = user_id)';

        EXECUTE 'CREATE POLICY "Users can delete their own knowledge" ON knowledge_sources
            FOR DELETE USING (auth.uid() = user_id)';

        -- Tasks policies
        EXECUTE 'CREATE POLICY "Users can view their own tasks" ON tasks
            FOR SELECT USING (auth.uid() = user_id)';

        EXECUTE 'CREATE POLICY "Users can create their own tasks" ON tasks
            FOR INSERT WITH CHECK (auth.uid() = user_id)';

        EXECUTE 'CREATE POLICY "Users can update their own tasks" ON tasks
            FOR UPDATE USING (auth.uid() = user_id)';

        -- MLX Fine-tuning policies
        EXECUTE 'CREATE POLICY "Users can view their own fine-tuning jobs" ON mlx_fine_tuning_jobs
            FOR SELECT USING (auth.uid() = user_id)';

        EXECUTE 'CREATE POLICY "Users can create their own fine-tuning jobs" ON mlx_fine_tuning_jobs
            FOR INSERT WITH CHECK (auth.uid() = user_id)';
    END IF;
END $$;

-- =====================================================
-- 12. SCHEDULED JOBS (pg_cron)
-- =====================================================
-- Note: pg_cron must be configured in the main postgres database
-- These jobs should be created separately after migration

-- =====================================================
-- 13. INITIAL DATA
-- =====================================================

-- Insert default AI service configurations
INSERT INTO ai_service_keys (service_name, is_active, rate_limit, metadata)
VALUES
    ('openai', true, 1000, '{"requires_key": true}'::jsonb),
    ('anthropic', true, 1000, '{"requires_key": true}'::jsonb),
    ('ollama', true, 10000, '{"requires_key": false, "local": true}'::jsonb),
    ('lm_studio', true, 10000, '{"requires_key": false, "local": true}'::jsonb)
ON CONFLICT (service_name) DO NOTHING;

-- =====================================================
-- 14. ADD FOREIGN KEY CONSTRAINTS (if auth schema exists)
-- =====================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
        -- Add foreign key constraints to auth.users
        ALTER TABLE memories
            ADD CONSTRAINT fk_memories_user
            FOREIGN KEY (user_id)
            REFERENCES auth.users(id)
            ON DELETE CASCADE;

        ALTER TABLE knowledge_sources
            ADD CONSTRAINT fk_knowledge_sources_user
            FOREIGN KEY (user_id)
            REFERENCES auth.users(id)
            ON DELETE SET NULL;

        ALTER TABLE tasks
            ADD CONSTRAINT fk_tasks_user
            FOREIGN KEY (user_id)
            REFERENCES auth.users(id)
            ON DELETE CASCADE;

        ALTER TABLE mlx_fine_tuning_jobs
            ADD CONSTRAINT fk_mlx_jobs_user
            FOREIGN KEY (user_id)
            REFERENCES auth.users(id)
            ON DELETE CASCADE;
    END IF;
END $$;

-- =====================================================
-- 15. GRANTS
-- =====================================================
-- Grants are handled by Supabase automatically

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
