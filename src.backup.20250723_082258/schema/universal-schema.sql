-- Universal AI Tools Schema for Supabase
-- This schema supports any LLM/AI service connection

-- AI Services Registry
CREATE TABLE IF NOT EXISTS ai_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name TEXT UNIQUE NOT NULL,
    service_type TEXT NOT NULL, -- 'claude', 'openai', 'gemini', 'cohere', 'custom'
    api_endpoint TEXT,
    capabilities JSONB DEFAULT '[]'::jsonb,
    config JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- API Keys Management (encrypted)
CREATE TABLE IF NOT EXISTS ai_service_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID REFERENCES ai_services(id) ON DELETE CASCADE,
    key_name TEXT NOT NULL,
    encrypted_key TEXT NOT NULL, -- Store encrypted
    permissions JSONB DEFAULT '[]'::jsonb,
    rate_limit INTEGER DEFAULT 1000,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    UNIQUE(service_id, key_name)
);

-- Universal Context Store
CREATE TABLE IF NOT EXISTS ai_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID REFERENCES ai_services(id),
    context_type TEXT NOT NULL, -- 'project', 'conversation', 'memory', 'knowledge'
    context_key TEXT NOT NULL,
    content JSONB NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    embeddings vector, -- For semantic search (variable dimensions)
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(service_id, context_type, context_key)
);

-- Shared Memory System
CREATE TABLE IF NOT EXISTS ai_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    memory_type TEXT NOT NULL, -- 'episodic', 'semantic', 'procedural', 'working'
    content TEXT NOT NULL,
    importance FLOAT DEFAULT 0.5,
    access_count INTEGER DEFAULT 0,
    services_accessed JSONB DEFAULT '[]'::jsonb, -- Track which AIs accessed
    tags TEXT[] DEFAULT '{}',
    embeddings vector, -- Variable dimensions
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tool Executions Log
CREATE TABLE IF NOT EXISTS ai_tool_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID REFERENCES ai_services(id),
    tool_name TEXT NOT NULL,
    input_params JSONB NOT NULL,
    output_result JSONB,
    execution_time_ms INTEGER,
    status TEXT NOT NULL, -- 'success', 'error', 'timeout'
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cross-AI Communications
CREATE TABLE IF NOT EXISTS ai_communications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_service_id UUID REFERENCES ai_services(id),
    to_service_id UUID REFERENCES ai_services(id),
    message_type TEXT NOT NULL, -- 'query', 'response', 'broadcast'
    content JSONB NOT NULL,
    thread_id UUID,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- Knowledge Base (Shared across all AIs)
CREATE TABLE IF NOT EXISTS ai_knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    knowledge_type TEXT NOT NULL, -- 'fact', 'concept', 'procedure', 'reference'
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    source TEXT,
    confidence_score FLOAT DEFAULT 1.0,
    verification_status TEXT DEFAULT 'unverified',
    tags TEXT[] DEFAULT '{}',
    embeddings vector, -- Variable dimensions
    metadata JSONB DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES ai_services(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project Context (For project-specific information)
CREATE TABLE IF NOT EXISTS ai_project_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_path TEXT UNIQUE NOT NULL,
    project_name TEXT NOT NULL,
    description TEXT,
    tech_stack JSONB DEFAULT '[]'::jsonb,
    dependencies JSONB DEFAULT '{}'::jsonb,
    configurations JSONB DEFAULT '{}'::jsonb,
    active_services UUID[] DEFAULT '{}', -- Which AIs are working on this
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Custom Tools Registry
CREATE TABLE IF NOT EXISTS ai_custom_tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_name TEXT UNIQUE NOT NULL,
    description TEXT,
    input_schema JSONB NOT NULL,
    output_schema JSONB,
    implementation_type TEXT NOT NULL, -- 'sql', 'function', 'api', 'script'
    implementation TEXT NOT NULL, -- The actual implementation
    permissions JSONB DEFAULT '{}'::jsonb,
    rate_limit INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES ai_services(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_contexts_service_type ON ai_contexts(service_id, context_type);
CREATE INDEX idx_memories_type ON ai_memories(memory_type);
CREATE INDEX idx_memories_tags ON ai_memories USING GIN(tags);
CREATE INDEX idx_knowledge_tags ON ai_knowledge_base USING GIN(tags);
CREATE INDEX idx_tool_executions_service ON ai_tool_executions(service_id, created_at DESC);
CREATE INDEX idx_communications_thread ON ai_communications(thread_id);

-- Vector similarity search indexes (if pgvector is installed)
-- CREATE INDEX idx_contexts_embeddings ON ai_contexts USING ivfflat (embeddings vector_cosine_ops);
-- CREATE INDEX idx_memories_embeddings ON ai_memories USING ivfflat (embeddings vector_cosine_ops);
-- CREATE INDEX idx_knowledge_embeddings ON ai_knowledge_base USING ivfflat (embeddings vector_cosine_ops);

-- Row Level Security
ALTER TABLE ai_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_service_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tool_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_project_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_custom_tools ENABLE ROW LEVEL SECURITY;

-- Policies (adjust based on your auth setup)
-- Example: All authenticated AI services can read shared knowledge
CREATE POLICY "AI services can read knowledge" ON ai_knowledge_base
    FOR SELECT USING (true);

-- Example: AI services can only modify their own contexts
CREATE POLICY "AI services manage own contexts" ON ai_contexts
    FOR ALL USING (auth.uid()::uuid = service_id);