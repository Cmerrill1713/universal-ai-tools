-- Fix MCP tables that are missing
-- This migration ensures the MCP tables are properly created

-- Drop existing tables if they exist (to avoid conflicts)
DROP TABLE IF EXISTS mcp_sessions CASCADE;
DROP TABLE IF EXISTS mcp_messages CASCADE;
DROP TABLE IF EXISTS mcp_tools CASCADE;

-- Create MCP sessions table
CREATE TABLE IF NOT EXISTS mcp_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT UNIQUE NOT NULL,
    user_id TEXT,
    agent_id TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create MCP messages table
CREATE TABLE IF NOT EXISTS mcp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL REFERENCES mcp_sessions(session_id) ON DELETE CASCADE,
    message_type TEXT NOT NULL CHECK (message_type IN ('request', 'response', 'error')),
    content JSONB NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create MCP tools table
CREATE TABLE IF NOT EXISTS mcp_tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_name TEXT UNIQUE NOT NULL,
    tool_description TEXT,
    tool_schema JSONB NOT NULL,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_mcp_sessions_user_id ON mcp_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_sessions_agent_id ON mcp_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_mcp_sessions_status ON mcp_sessions(status);
CREATE INDEX IF NOT EXISTS idx_mcp_messages_session_id ON mcp_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_mcp_messages_timestamp ON mcp_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_mcp_tools_enabled ON mcp_tools(enabled);

-- Add RLS policies for security
ALTER TABLE mcp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_tools ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Users can view their own sessions" ON mcp_sessions
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own sessions" ON mcp_sessions
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own sessions" ON mcp_sessions
    FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can view their own messages" ON mcp_messages
    FOR SELECT USING (
        session_id IN (
            SELECT session_id FROM mcp_sessions WHERE user_id = auth.uid()::text
        )
    );

CREATE POLICY "Users can insert their own messages" ON mcp_messages
    FOR INSERT WITH CHECK (
        session_id IN (
            SELECT session_id FROM mcp_sessions WHERE user_id = auth.uid()::text
        )
    );

CREATE POLICY "Users can view enabled tools" ON mcp_tools
    FOR SELECT USING (enabled = true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_mcp_sessions_updated_at
    BEFORE UPDATE ON mcp_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mcp_tools_updated_at
    BEFORE UPDATE ON mcp_tools
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
