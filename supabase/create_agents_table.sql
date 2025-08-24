-- Create comprehensive agents table for Universal AI Tools
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DROP TABLE IF EXISTS agents;

CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    agent_type VARCHAR(100) NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'general',
    description TEXT NOT NULL,
    capabilities TEXT[] NOT NULL DEFAULT '{}',
    provider VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    version VARCHAR(100) NOT NULL,
    endpoint VARCHAR(500),
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    
    -- Performance metrics
    request_count BIGINT NOT NULL DEFAULT 0,
    success_count BIGINT NOT NULL DEFAULT 0,
    error_count BIGINT NOT NULL DEFAULT 0,
    average_response_time_ms DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    success_rate DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    tokens_processed BIGINT NOT NULL DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used TIMESTAMPTZ,
    
    -- Additional fields for compatibility
    current_load INTEGER NOT NULL DEFAULT 0,
    is_available BOOLEAN NOT NULL DEFAULT true,
    usage_count BIGINT NOT NULL DEFAULT 0,
    average_response DOUBLE PRECISION NOT NULL DEFAULT 0.0
);

-- Create indexes
CREATE INDEX idx_agents_name ON agents(name);
CREATE INDEX idx_agents_type ON agents(agent_type);
CREATE INDEX idx_agents_category ON agents(category);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_provider ON agents(provider);
CREATE INDEX idx_agents_created_at ON agents(created_at DESC);

-- Insert sample agents
INSERT INTO agents (
    name, agent_type, category, description, capabilities, provider, model, version,
    request_count, success_count, error_count, average_response_time_ms, success_rate, tokens_processed,
    created_at, updated_at, last_used, current_load, is_available, usage_count, average_response
) VALUES 
(
    'Claude Assistant', 'chat', 'general', 
    'Advanced conversational AI assistant powered by Anthropic Claude',
    ARRAY['conversation', 'analysis', 'writing', 'coding', 'reasoning'],
    'anthropic', 'claude-3-5-sonnet', '3.5',
    15420, 15380, 40, 245.5, 99.74, 2450000,
    NOW() - INTERVAL '30 days', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '5 minutes',
    0, true, 15420, 245.5
),
(
    'GPT-4 Assistant', 'chat', 'general',
    'OpenAI GPT-4 model for complex reasoning and multi-modal tasks',
    ARRAY['conversation', 'analysis', 'coding', 'math', 'vision'],
    'openai', 'gpt-4', '4.0',
    12850, 12800, 50, 312.8, 99.61, 1950000,
    NOW() - INTERVAL '25 days', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '15 minutes',
    0, true, 12850, 312.8
),
(
    'Local Llama', 'chat', 'specialized',
    'Self-hosted Llama model for privacy-focused tasks and offline inference',
    ARRAY['conversation', 'privacy', 'offline', 'local_inference'],
    'ollama', 'llama-3.2-8b', '3.2',
    8500, 8350, 150, 450.2, 98.24, 1200000,
    NOW() - INTERVAL '20 days', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '1 minute',
    0, true, 8500, 450.2
),
(
    'Vision Analyzer', 'vision', 'specialized',
    'Advanced computer vision model for image analysis and understanding',
    ARRAY['image_analysis', 'object_detection', 'scene_understanding', 'OCR'],
    'openai', 'gpt-4-vision', '4.0',
    3200, 3150, 50, 850.3, 98.44, 650000,
    NOW() - INTERVAL '15 days', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '10 minutes',
    0, true, 3200, 850.3
),
(
    'Code Generator', 'coding', 'specialized',
    'Specialized coding assistant for software development and architecture',
    ARRAY['code_generation', 'refactoring', 'debugging', 'architecture_design'],
    'anthropic', 'claude-3-haiku', '3.0',
    5600, 5520, 80, 180.5, 98.57, 1100000,
    NOW() - INTERVAL '12 days', NOW() - INTERVAL '45 minutes', NOW() - INTERVAL '3 minutes',
    0, true, 5600, 180.5
);