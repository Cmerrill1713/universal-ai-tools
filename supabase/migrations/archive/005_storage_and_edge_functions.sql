-- =====================================================
-- Storage Buckets and Edge Function Support
-- Version: 3.0.0
-- Date: 2025-07-30
-- =====================================================

-- =====================================================
-- 1. STORAGE BUCKETS
-- =====================================================

-- Create storage buckets (will be created via Supabase CLI)
-- These are the buckets we need:
-- - models: Store model files, configs, and weights
-- - documents: Store uploaded documents and files
-- - embeddings: Store cached embeddings and vector data
-- - conversations: Store conversation exports and backups
-- - training-data: Store training datasets and fine-tuning data

-- =====================================================
-- 2. OLLAMA INTEGRATION TABLES
-- =====================================================

-- Ollama model registry
CREATE TABLE IF NOT EXISTS ollama_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    display_name TEXT,
    model_type TEXT CHECK (model_type IN ('chat', 'embedding', 'vision', 'code')),
    size_gb REAL,
    parameters TEXT,
    capabilities TEXT[] DEFAULT '{}',
    is_available BOOLEAN DEFAULT false,
    last_health_check TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ollama inference requests
CREATE TABLE IF NOT EXISTS ollama_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    model_name TEXT NOT NULL,
    request_type TEXT CHECK (request_type IN ('chat', 'completion', 'embedding', 'vision')),
    input_text TEXT,
    system_prompt TEXT,
    output_text TEXT,
    embedding vector(384), -- all-minilm dimension
    tokens_input INTEGER,
    tokens_output INTEGER,
    latency_ms INTEGER,
    temperature REAL,
    max_tokens INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- LLM Agent configurations
CREATE TABLE IF NOT EXISTS llm_agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_name TEXT UNIQUE NOT NULL,
    model_name TEXT NOT NULL,
    system_prompt TEXT,
    default_temperature REAL DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 2048,
    capabilities TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    performance_metrics JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. EMBEDDING MANAGEMENT
-- =====================================================

-- Embedding jobs queue
CREATE TABLE IF NOT EXISTS embedding_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_type TEXT NOT NULL, -- 'document', 'message', 'knowledge'
    content_id UUID NOT NULL,
    content_text TEXT NOT NULL,
    model_name TEXT DEFAULT 'all-minilm:latest',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    embedding vector(384),
    error_message TEXT,
    processing_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- 4. FUNCTIONS FOR OLLAMA INTEGRATION
-- =====================================================

-- Function to call Ollama API
CREATE OR REPLACE FUNCTION call_ollama_chat(
    model_name TEXT,
    user_message TEXT,
    system_message TEXT DEFAULT NULL,
    temperature REAL DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 2048
)
RETURNS JSONB AS $$
DECLARE
    response JSONB;
    request_payload JSONB;
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    request_id UUID;
BEGIN
    -- Record request start
    start_time := NOW();
    request_id := uuid_generate_v4();
    
    -- Build request payload
    request_payload := jsonb_build_object(
        'model', model_name,
        'messages', jsonb_build_array(
            CASE 
                WHEN system_message IS NOT NULL THEN 
                    jsonb_build_object('role', 'system', 'content', system_message)
                ELSE NULL
            END,
            jsonb_build_object('role', 'user', 'content', user_message)
        ) - NULL::jsonb,
        'options', jsonb_build_object(
            'temperature', temperature,
            'num_predict', max_tokens
        ),
        'stream', false
    );
    
    -- Make HTTP request to Ollama
    SELECT net.http_post(
        url := 'http://localhost:11434/api/chat',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := request_payload
    ) INTO response;
    
    end_time := NOW();
    
    -- Log the request
    INSERT INTO ollama_requests (
        id,
        model_name,
        request_type,
        input_text,
        system_prompt,
        output_text,
        latency_ms,
        temperature,
        max_tokens,
        success
    ) VALUES (
        request_id,
        model_name,
        'chat',
        user_message,
        system_message,
        COALESCE(response->'message'->>'content', ''),
        EXTRACT(EPOCH FROM (end_time - start_time)) * 1000,
        temperature,
        max_tokens,
        response->>'status' = '200'
    );
    
    RETURN response;
END;
$$ LANGUAGE plpgsql;

-- Function to generate embeddings
CREATE OR REPLACE FUNCTION generate_embedding(
    text_content TEXT,
    model_name TEXT DEFAULT 'all-minilm:latest'
)
RETURNS vector AS $$
DECLARE
    response JSONB;
    embedding_array JSONB;
    embedding_vector vector;
BEGIN
    -- Call Ollama embeddings API
    SELECT net.http_post(
        url := 'http://localhost:11434/api/embeddings',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object(
            'model', model_name,
            'prompt', text_content
        )
    ) INTO response;
    
    -- Extract embedding array
    embedding_array := response->'embedding';
    
    -- Convert to vector type
    embedding_vector := embedding_array::text::vector;
    
    RETURN embedding_vector;
END;
$$ LANGUAGE plpgsql;

-- Function to process embedding jobs
CREATE OR REPLACE FUNCTION process_embedding_jobs()
RETURNS INTEGER AS $$
DECLARE
    job_record RECORD;
    embedding_result vector;
    processed_count INTEGER := 0;
BEGIN
    FOR job_record IN 
        SELECT * FROM embedding_jobs 
        WHERE status = 'pending' 
        ORDER BY created_at 
        LIMIT 10
    LOOP
        BEGIN
            -- Update status to processing
            UPDATE embedding_jobs 
            SET status = 'processing' 
            WHERE id = job_record.id;
            
            -- Generate embedding
            embedding_result := generate_embedding(job_record.content_text, job_record.model_name);
            
            -- Update job with result
            UPDATE embedding_jobs 
            SET 
                status = 'completed',
                embedding = embedding_result,
                completed_at = NOW()
            WHERE id = job_record.id;
            
            -- Update the source table with embedding
            CASE job_record.content_type
                WHEN 'document' THEN
                    UPDATE documents 
                    SET content_embedding = embedding_result 
                    WHERE id = job_record.content_id;
                
                WHEN 'message' THEN
                    UPDATE conversation_messages 
                    SET embedding = embedding_result 
                    WHERE id = job_record.content_id;
                
                WHEN 'knowledge' THEN
                    UPDATE knowledge_sources 
                    SET content_embedding = embedding_result 
                    WHERE id = job_record.content_id;
            END CASE;
            
            processed_count := processed_count + 1;
            
        EXCEPTION WHEN OTHERS THEN
            -- Mark job as failed
            UPDATE embedding_jobs 
            SET 
                status = 'failed',
                error_message = SQLERRM,
                completed_at = NOW()
            WHERE id = job_record.id;
        END;
    END LOOP;
    
    RETURN processed_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. AUTOMATIC EMBEDDING TRIGGERS
-- =====================================================

-- Function to queue embedding jobs
CREATE OR REPLACE FUNCTION queue_embedding_job()
RETURNS TRIGGER AS $$
BEGIN
    -- Queue embedding job for new/updated content
    INSERT INTO embedding_jobs (content_type, content_id, content_text, model_name)
    VALUES (
        TG_ARGV[0], -- content_type passed as trigger argument
        NEW.id,
        CASE 
            WHEN TG_TABLE_NAME = 'documents' THEN NEW.content
            WHEN TG_TABLE_NAME = 'conversation_messages' THEN NEW.content
            WHEN TG_TABLE_NAME = 'knowledge_sources' THEN NEW.content
        END,
        'all-minilm:latest'
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic embedding
CREATE TRIGGER queue_document_embedding
    AFTER INSERT OR UPDATE ON documents
    FOR EACH ROW 
    WHEN (NEW.content IS NOT NULL)
    EXECUTE FUNCTION queue_embedding_job('document');

CREATE TRIGGER queue_message_embedding
    AFTER INSERT ON conversation_messages
    FOR EACH ROW 
    WHEN (NEW.content IS NOT NULL)
    EXECUTE FUNCTION queue_embedding_job('message');

CREATE TRIGGER queue_knowledge_embedding
    AFTER INSERT OR UPDATE ON knowledge_sources
    FOR EACH ROW 
    WHEN (NEW.content IS NOT NULL)
    EXECUTE FUNCTION queue_embedding_job('knowledge');

-- =====================================================
-- 6. SCHEDULED JOBS
-- =====================================================

-- Process embedding jobs every minute
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.schedule(
            'process-embeddings',
            '* * * * *', -- Every minute
            $$SELECT process_embedding_jobs()$$
        );
    END IF;
END $$;

-- Health check for Ollama models every 5 minutes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.schedule(
            'ollama-health-check',
            '*/5 * * * *', -- Every 5 minutes
            $$
            UPDATE ollama_models 
            SET 
                is_available = CASE 
                    WHEN net.http_get('http://localhost:11434/api/tags')->>'status' = '200' 
                    THEN true 
                    ELSE false 
                END,
                last_health_check = NOW()
            $$
        );
    END IF;
END $$;

-- =====================================================
-- 7. INDEXES FOR PERFORMANCE
-- =====================================================

-- Ollama models indexes
CREATE INDEX IF NOT EXISTS idx_ollama_models_type ON ollama_models (model_type);
CREATE INDEX IF NOT EXISTS idx_ollama_models_available ON ollama_models (is_available);

-- Ollama requests indexes
CREATE INDEX IF NOT EXISTS idx_ollama_requests_model ON ollama_requests (model_name);
CREATE INDEX IF NOT EXISTS idx_ollama_requests_user ON ollama_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_ollama_requests_created ON ollama_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ollama_requests_success ON ollama_requests (success);

-- LLM agents indexes
CREATE INDEX IF NOT EXISTS idx_llm_agents_active ON llm_agents (is_active);
CREATE INDEX IF NOT EXISTS idx_llm_agents_model ON llm_agents (model_name);

-- Embedding jobs indexes
CREATE INDEX IF NOT EXISTS idx_embedding_jobs_status ON embedding_jobs (status);
CREATE INDEX IF NOT EXISTS idx_embedding_jobs_created ON embedding_jobs (created_at);

-- =====================================================
-- 8. INITIAL DATA
-- =====================================================

-- Register available Ollama models
INSERT INTO ollama_models (name, display_name, model_type, capabilities, metadata) VALUES
('llama3.2:3b', 'Llama 3.2 3B', 'chat', ARRAY['reasoning', 'code', 'general'], '{"params": "3B", "context": 4096}'::jsonb),
('gemma:2b', 'Gemma 2B', 'chat', ARRAY['fast', 'general'], '{"params": "2B", "context": 2048}'::jsonb),
('qwen2.5:7b', 'Qwen 2.5 7B', 'chat', ARRAY['reasoning', 'multilingual'], '{"params": "7B", "context": 8192}'::jsonb),
('deepseek-r1:14b', 'DeepSeek R1 14B', 'chat', ARRAY['reasoning', 'math', 'code'], '{"params": "14B", "context": 16384}'::jsonb),
('devstral:24b', 'Devstral 24B', 'code', ARRAY['code', 'development'], '{"params": "24B", "context": 32768}'::jsonb),
('all-minilm:latest', 'All-MiniLM L6 v2', 'embedding', ARRAY['embedding', 'similarity'], '{"dimension": 384}'::jsonb),
('nomic-embed-text:latest', 'Nomic Embed Text', 'embedding', ARRAY['embedding', 'search'], '{"dimension": 768}'::jsonb),
('mxbai-embed-large:latest', 'MXBAI Embed Large', 'embedding', ARRAY['embedding', 'large'], '{"dimension": 1024}'::jsonb),
('llava:7b-v1.6-mistral-q4_0', 'LLaVA 7B Vision', 'vision', ARRAY['vision', 'multimodal'], '{"params": "7B", "modality": "vision+text"}'::jsonb)
ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    model_type = EXCLUDED.model_type,
    capabilities = EXCLUDED.capabilities,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

-- Create default LLM agents using your models
INSERT INTO llm_agents (agent_name, model_name, system_prompt, capabilities) VALUES
('planner', 'llama3.2:3b', 'You are a strategic planning assistant. Break down complex tasks into actionable steps with clear priorities and dependencies.', ARRAY['planning', 'strategy', 'organization']),
('code_assistant', 'devstral:24b', 'You are an expert software engineer. Provide high-quality code solutions, best practices, and technical guidance.', ARRAY['coding', 'debugging', 'architecture']),
('reasoning_agent', 'deepseek-r1:14b', 'You are a logical reasoning specialist. Analyze problems systematically and provide well-reasoned solutions.', ARRAY['reasoning', 'analysis', 'problem_solving']),
('general_assistant', 'qwen2.5:7b', 'You are a helpful general-purpose AI assistant. Provide accurate, helpful, and contextual responses.', ARRAY['general', 'conversation', 'assistance']),
('fast_responder', 'gemma:2b', 'You are a quick response assistant for simple queries and rapid interactions.', ARRAY['fast', 'simple', 'quick'])
ON CONFLICT (agent_name) DO UPDATE SET
    model_name = EXCLUDED.model_name,
    system_prompt = EXCLUDED.system_prompt,
    capabilities = EXCLUDED.capabilities,
    updated_at = NOW();

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================