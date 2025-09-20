-- Simple schema for Universal AI Tools
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Basic tables
CREATE TABLE IF NOT EXISTS memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    content TEXT NOT NULL,
    embedding vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert sample data
INSERT INTO agents (name, display_name, description) VALUES 
('chat_agent', 'Chat Agent', 'Handles chat interactions'),
('memory_agent', 'Memory Agent', 'Manages user memories'),
('rag_agent', 'RAG Agent', 'Retrieval Augmented Generation')
ON CONFLICT (name) DO NOTHING;

-- Enable RLS
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all access" ON memories FOR ALL USING (true);
CREATE POLICY "Allow all access" ON agents FOR ALL USING (true);
