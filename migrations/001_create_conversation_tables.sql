-- Migration: Create conversation persistence tables
-- Date: 2025-10-11
-- Purpose: Enable persistent conversation storage in knowledge_base

-- Create conversation threads table
CREATE TABLE IF NOT EXISTS conversation_threads (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    thread_id VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb,
    message_count INTEGER DEFAULT 0
);

-- Create indexes for threads
CREATE INDEX IF NOT EXISTS idx_threads_user_id ON conversation_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_threads_thread_id ON conversation_threads(thread_id);
CREATE INDEX IF NOT EXISTS idx_threads_created_at ON conversation_threads(created_at);
CREATE INDEX IF NOT EXISTS idx_threads_updated_at ON conversation_threads(updated_at);

-- Create conversation messages table
CREATE TABLE IF NOT EXISTS conversation_messages (
    id SERIAL PRIMARY KEY,
    thread_id VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb,
    model_used VARCHAR(100),
    processing_time FLOAT,
    token_count INTEGER
);

-- Create indexes for messages
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON conversation_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON conversation_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_role ON conversation_messages(role);

-- Add foreign key constraint (commented out for now, can be added later)
-- ALTER TABLE conversation_messages 
-- ADD CONSTRAINT fk_thread_id 
-- FOREIGN KEY (thread_id) REFERENCES conversation_threads(thread_id) ON DELETE CASCADE;

-- Verify creation
SELECT 
    'conversation_threads' as table_name, 
    COUNT(*) as row_count,
    'Created: ' || NOW() as status
FROM conversation_threads
UNION ALL
SELECT 
    'conversation_messages', 
    COUNT(*),
    'Created: ' || NOW()
FROM conversation_messages;

