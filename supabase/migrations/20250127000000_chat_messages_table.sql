-- Chat Messages Table Migration
-- Stores chat messages with UAT-Prompt and Neuroforge metadata

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_role ON chat_messages(role);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created ON chat_messages(session_id, created_at DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_chat_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_chat_messages_updated_at ON chat_messages;
CREATE TRIGGER trigger_chat_messages_updated_at
    BEFORE UPDATE ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_chat_messages_updated_at();

-- Create chat_sessions table for session management
CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    project_path TEXT,
    context JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for chat_sessions
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_project_path ON chat_sessions(project_path);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_last_activity ON chat_sessions(last_activity DESC);

-- Create function to update chat_sessions updated_at and last_activity
CREATE OR REPLACE FUNCTION update_chat_sessions_activity()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.last_activity = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for chat_sessions
DROP TRIGGER IF EXISTS trigger_chat_sessions_activity ON chat_sessions;
CREATE TRIGGER trigger_chat_sessions_activity
    BEFORE UPDATE ON chat_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_chat_sessions_activity();

-- Create function to get chat session with message count
CREATE OR REPLACE FUNCTION get_chat_session_with_stats(session_id_param TEXT)
RETURNS TABLE (
    id TEXT,
    user_id TEXT,
    project_path TEXT,
    context JSONB,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    last_activity TIMESTAMP WITH TIME ZONE,
    message_count BIGINT,
    last_message_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.user_id,
        s.project_path,
        s.context,
        s.created_at,
        s.updated_at,
        s.last_activity,
        COUNT(m.id) as message_count,
        MAX(m.created_at) as last_message_at
    FROM chat_sessions s
    LEFT JOIN chat_messages m ON s.id = m.session_id
    WHERE s.id = session_id_param
    GROUP BY s.id, s.user_id, s.project_path, s.context, s.created_at, s.updated_at, s.last_activity;
END;
$$ LANGUAGE plpgsql;

-- Create function to clean up old sessions (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_chat_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM chat_sessions 
    WHERE last_activity < NOW() - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get user's recent sessions
CREATE OR REPLACE FUNCTION get_user_recent_sessions(user_id_param TEXT, limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
    id TEXT,
    project_path TEXT,
    last_message_at TIMESTAMP WITH TIME ZONE,
    message_count BIGINT,
    last_message_preview TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.project_path,
        MAX(m.created_at) as last_message_at,
        COUNT(m.id) as message_count,
        (SELECT content FROM chat_messages 
         WHERE session_id = s.id 
         ORDER BY created_at DESC 
         LIMIT 1) as last_message_preview
    FROM chat_sessions s
    LEFT JOIN chat_messages m ON s.id = m.session_id
    WHERE s.user_id = user_id_param
    GROUP BY s.id, s.project_path
    ORDER BY MAX(m.created_at) DESC NULLS LAST
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON TABLE chat_messages IS 'Stores individual chat messages with UAT-Prompt and Neuroforge metadata';
COMMENT ON TABLE chat_sessions IS 'Manages chat sessions with context and user information';
COMMENT ON COLUMN chat_messages.metadata IS 'Contains UAT-Prompt and Neuroforge processing metadata';
COMMENT ON COLUMN chat_sessions.context IS 'Session context including neural state and project information';

-- Insert initial data
INSERT INTO chat_sessions (id, user_id, project_path, context) 
VALUES (
    'demo-session-001',
    'demo-user-001',
    '/workspace',
    '{"categories": ["conversation", "project_info"], "neuralState": null}'
) ON CONFLICT (id) DO NOTHING;

-- Insert demo message
INSERT INTO chat_messages (id, session_id, role, content, metadata) 
VALUES (
    'demo-msg-001',
    'demo-session-001',
    'user',
    'Hello! I need help with integrating neuroforge and UAT-prompt with chat features.',
    '{"uatPrompt": {"confidence": 0.8}, "neuroforge": {"sentiment": 0.2}}'
) ON CONFLICT (id) DO NOTHING;