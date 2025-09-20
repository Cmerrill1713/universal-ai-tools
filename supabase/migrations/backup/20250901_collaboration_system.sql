-- Real-time Collaboration System Database Schema
-- Migration for workspaces, participants, events, and real-time features

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Collaboration Workspaces table
CREATE TABLE IF NOT EXISTS collaboration_workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL CHECK (LENGTH(name) > 0 AND LENGTH(name) <= 100),
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('chat', 'code', 'document', 'agent-session')),
    owner_id TEXT NOT NULL,
    settings JSONB NOT NULL DEFAULT '{
        "maxParticipants": 50,
        "allowAnonymous": false,
        "requireApproval": false,
        "persistence": true
    }'::jsonb,
    state JSONB DEFAULT '{}'::jsonb,
    history JSONB DEFAULT '[]'::jsonb,
    participants JSONB DEFAULT '[]'::jsonb,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    is_active BOOLEAN DEFAULT true,
    is_public BOOLEAN DEFAULT false,
    invite_code TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_max_participants CHECK ((settings->>'maxParticipants')::integer BETWEEN 1 AND 500)
);

-- Workspace Participants table (for better querying and analytics)
CREATE TABLE IF NOT EXISTS workspace_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES collaboration_workspaces(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_email TEXT,
    user_avatar TEXT,
    role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('owner', 'editor', 'viewer')),
    status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'away', 'offline')),
    permissions JSONB DEFAULT '{
        "canEdit": true,
        "canInvite": false,
        "canManage": false
    }'::jsonb,
    cursor_position JSONB,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP WITH TIME ZONE,
    total_time_spent INTEGER DEFAULT 0, -- in seconds
    message_count INTEGER DEFAULT 0,
    edit_count INTEGER DEFAULT 0,
    
    -- Unique constraint for active participants
    UNIQUE(workspace_id, user_id),
    
    -- Indexes for performance
    INDEX idx_workspace_participants_workspace_status ON workspace_participants(workspace_id, status),
    INDEX idx_workspace_participants_user_active ON workspace_participants(user_id) WHERE left_at IS NULL
);

-- Collaboration Events table (detailed event tracking)
CREATE TABLE IF NOT EXISTS collaboration_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES collaboration_workspaces(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('join', 'leave', 'edit', 'cursor', 'chat', 'agent-result', 'sync', 'file-upload')),
    event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    version INTEGER NOT NULL,
    session_id TEXT,
    client_timestamp TIMESTAMP WITH TIME ZONE,
    server_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Indexes for efficient querying
    INDEX idx_collaboration_events_workspace_type_time ON collaboration_events(workspace_id, event_type, server_timestamp DESC),
    INDEX idx_collaboration_events_user_time ON collaboration_events(user_id, server_timestamp DESC),
    INDEX idx_collaboration_events_session ON collaboration_events(session_id) WHERE session_id IS NOT NULL
);

-- Chat Messages table (optimized for chat functionality)
CREATE TABLE IF NOT EXISTS collaboration_chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES collaboration_workspaces(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    content TEXT NOT NULL CHECK (LENGTH(content) > 0 AND LENGTH(content) <= 10000),
    message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'code', 'image', 'file', 'system')),
    reply_to UUID REFERENCES collaboration_chat_messages(id),
    thread_id UUID,
    attachments JSONB DEFAULT '[]'::jsonb,
    reactions JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    edited_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Full-text search support
    search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
    
    -- Indexes
    INDEX idx_chat_messages_workspace_time ON collaboration_chat_messages(workspace_id, created_at DESC),
    INDEX idx_chat_messages_user_time ON collaboration_chat_messages(user_id, created_at DESC),
    INDEX idx_chat_messages_thread ON collaboration_chat_messages(thread_id) WHERE thread_id IS NOT NULL,
    INDEX idx_chat_messages_search ON collaboration_chat_messages USING gin(search_vector)
);

-- Document Operations table (for collaborative editing)
CREATE TABLE IF NOT EXISTS collaboration_document_operations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES collaboration_workspaces(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    operation_type TEXT NOT NULL CHECK (operation_type IN ('insert', 'delete', 'replace', 'format', 'move')),
    position JSONB NOT NULL, -- Can be number or {line, column}
    content TEXT,
    length INTEGER,
    before_state_hash TEXT,
    after_state_hash TEXT,
    vector_clock JSONB, -- For operational transformation
    is_applied BOOLEAN DEFAULT false,
    conflict_resolution JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    applied_at TIMESTAMP WITH TIME ZONE,
    
    -- Indexes for operation ordering
    INDEX idx_document_operations_workspace_time ON collaboration_document_operations(workspace_id, created_at),
    INDEX idx_document_operations_user_time ON collaboration_document_operations(user_id, created_at)
);

-- Agent Execution Shares table (for shared AI results)
CREATE TABLE IF NOT EXISTS collaboration_agent_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES collaboration_workspaces(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    execution_id TEXT NOT NULL,
    agent_type TEXT NOT NULL,
    task_description TEXT NOT NULL,
    result_data JSONB NOT NULL,
    confidence DECIMAL(5,4) CHECK (confidence >= 0 AND confidence <= 1),
    duration_ms INTEGER CHECK (duration_ms >= 0),
    model_used TEXT,
    model_parameters JSONB DEFAULT '{}'::jsonb,
    performance_metrics JSONB DEFAULT '{}'::jsonb,
    is_pinned BOOLEAN DEFAULT false,
    reactions JSONB DEFAULT '{}'::jsonb,
    comments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_agent_shares_workspace_time ON collaboration_agent_shares(workspace_id, created_at DESC),
    INDEX idx_agent_shares_agent_type ON collaboration_agent_shares(agent_type, created_at DESC),
    INDEX idx_agent_shares_user_time ON collaboration_agent_shares(user_id, created_at DESC)
);

-- File Attachments table
CREATE TABLE IF NOT EXISTS collaboration_file_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES collaboration_workspaces(id) ON DELETE CASCADE,
    chat_message_id UUID REFERENCES collaboration_chat_messages(id) ON DELETE CASCADE,
    uploaded_by TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_size BIGINT CHECK (file_size >= 0),
    mime_type TEXT,
    file_path TEXT, -- Path in storage
    storage_provider TEXT DEFAULT 'supabase',
    is_image BOOLEAN DEFAULT false,
    is_processed BOOLEAN DEFAULT false,
    thumbnail_path TEXT,
    download_count INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT false,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_file_attachments_workspace ON collaboration_file_attachments(workspace_id),
    INDEX idx_file_attachments_message ON collaboration_file_attachments(chat_message_id) WHERE chat_message_id IS NOT NULL
);

-- Workspace Analytics table (for usage metrics)
CREATE TABLE IF NOT EXISTS collaboration_workspace_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES collaboration_workspaces(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_participants INTEGER DEFAULT 0,
    active_participants INTEGER DEFAULT 0,
    message_count INTEGER DEFAULT 0,
    edit_count INTEGER DEFAULT 0,
    agent_share_count INTEGER DEFAULT 0,
    session_duration_seconds INTEGER DEFAULT 0,
    peak_concurrent_users INTEGER DEFAULT 0,
    unique_daily_users INTEGER DEFAULT 0,
    file_uploads INTEGER DEFAULT 0,
    metrics JSONB DEFAULT '{}'::jsonb,
    
    -- Unique constraint for daily aggregates
    UNIQUE(workspace_id, date),
    
    -- Indexes
    INDEX idx_workspace_analytics_workspace_date ON collaboration_workspace_analytics(workspace_id, date DESC),
    INDEX idx_workspace_analytics_date ON collaboration_workspace_analytics(date DESC)
);

-- Real-time Presence table (for active connections)
CREATE TABLE IF NOT EXISTS collaboration_presence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES collaboration_workspaces(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    connection_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'away', 'idle')),
    cursor_position JSONB,
    current_selection JSONB,
    client_info JSONB DEFAULT '{}'::jsonb,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint for connection tracking
    UNIQUE(connection_id),
    
    -- Indexes for real-time queries
    INDEX idx_collaboration_presence_workspace_active ON collaboration_presence(workspace_id, last_activity) WHERE status = 'online',
    INDEX idx_collaboration_presence_user ON collaboration_presence(user_id, workspace_id)
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_collaboration_workspaces_owner_active ON collaboration_workspaces(owner_id, is_active);
CREATE INDEX IF NOT EXISTS idx_collaboration_workspaces_type_public ON collaboration_workspaces(type, is_public) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_collaboration_workspaces_created_at ON collaboration_workspaces(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collaboration_workspaces_name_trgm ON collaboration_workspaces USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_collaboration_workspaces_tags ON collaboration_workspaces USING gin (tags);

-- Functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_collaboration_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_collaboration_workspaces_updated_at 
    BEFORE UPDATE ON collaboration_workspaces 
    FOR EACH ROW EXECUTE FUNCTION update_collaboration_updated_at();

-- Function to update workspace participant status
CREATE OR REPLACE FUNCTION update_participant_last_seen()
RETURNS TRIGGER AS $$
BEGIN
    -- Update participant's last seen when they perform any action
    UPDATE workspace_participants 
    SET 
        last_seen = CURRENT_TIMESTAMP,
        status = 'online',
        edit_count = CASE 
            WHEN NEW.event_type = 'edit' THEN edit_count + 1 
            ELSE edit_count 
        END,
        message_count = CASE 
            WHEN NEW.event_type = 'chat' THEN message_count + 1 
            ELSE message_count 
        END
    WHERE workspace_id = NEW.workspace_id AND user_id = NEW.user_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for participant activity tracking
CREATE TRIGGER track_participant_activity
    AFTER INSERT ON collaboration_events
    FOR EACH ROW
    EXECUTE FUNCTION update_participant_last_seen();

-- Function to calculate workspace statistics
CREATE OR REPLACE FUNCTION get_workspace_stats(p_workspace_id UUID, p_days INTEGER DEFAULT 7)
RETURNS TABLE (
    total_events INTEGER,
    unique_participants INTEGER,
    message_count INTEGER,
    edit_count INTEGER,
    agent_shares INTEGER,
    avg_events_per_day DECIMAL(10,2),
    most_active_user TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH recent_events AS (
        SELECT *
        FROM collaboration_events ce
        WHERE ce.workspace_id = p_workspace_id
        AND ce.server_timestamp >= CURRENT_TIMESTAMP - (p_days || ' days')::INTERVAL
    ),
    user_activity AS (
        SELECT user_id, COUNT(*) as event_count
        FROM recent_events
        GROUP BY user_id
        ORDER BY event_count DESC
        LIMIT 1
    )
    SELECT 
        COUNT(*)::INTEGER as total_events,
        COUNT(DISTINCT re.user_id)::INTEGER as unique_participants,
        COUNT(*) FILTER (WHERE re.event_type = 'chat')::INTEGER as message_count,
        COUNT(*) FILTER (WHERE re.event_type = 'edit')::INTEGER as edit_count,
        COUNT(*) FILTER (WHERE re.event_type = 'agent-result')::INTEGER as agent_shares,
        (COUNT(*)::DECIMAL / p_days)::DECIMAL(10,2) as avg_events_per_day,
        (SELECT user_id FROM user_activity LIMIT 1) as most_active_user
    FROM recent_events re;
END;
$$ LANGUAGE plpgsql;

-- Function to get active workspace participants
CREATE OR REPLACE FUNCTION get_active_workspace_participants(p_workspace_id UUID)
RETURNS TABLE (
    user_id TEXT,
    user_name TEXT,
    status TEXT,
    last_activity TIMESTAMP WITH TIME ZONE,
    cursor_position JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cp.user_id,
        wp.user_name,
        cp.status,
        cp.last_activity,
        cp.cursor_position
    FROM collaboration_presence cp
    JOIN workspace_participants wp ON wp.workspace_id = cp.workspace_id AND wp.user_id = cp.user_id
    WHERE cp.workspace_id = p_workspace_id
    AND cp.last_activity >= CURRENT_TIMESTAMP - INTERVAL '5 minutes'
    ORDER BY cp.last_activity DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup stale presence records
CREATE OR REPLACE FUNCTION cleanup_stale_presence()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Remove presence records older than 5 minutes
    DELETE FROM collaboration_presence 
    WHERE last_activity < CURRENT_TIMESTAMP - INTERVAL '5 minutes';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Update participant status to offline for users without active presence
    UPDATE workspace_participants 
    SET status = 'offline'
    WHERE user_id NOT IN (
        SELECT DISTINCT user_id 
        FROM collaboration_presence 
        WHERE workspace_id = workspace_participants.workspace_id
    )
    AND status != 'offline';
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to aggregate daily workspace analytics
CREATE OR REPLACE FUNCTION aggregate_workspace_analytics(p_date DATE DEFAULT CURRENT_DATE - INTERVAL '1 day')
RETURNS INTEGER AS $$
DECLARE
    processed_count INTEGER := 0;
BEGIN
    -- Aggregate analytics for each workspace
    INSERT INTO collaboration_workspace_analytics (
        workspace_id,
        date,
        total_participants,
        active_participants,
        message_count,
        edit_count,
        agent_share_count,
        unique_daily_users
    )
    SELECT 
        w.id,
        p_date,
        (SELECT COUNT(*) FROM workspace_participants wp WHERE wp.workspace_id = w.id AND wp.left_at IS NULL),
        COUNT(DISTINCT CASE WHEN ce.server_timestamp::date = p_date THEN ce.user_id END),
        COUNT(*) FILTER (WHERE ce.event_type = 'chat' AND ce.server_timestamp::date = p_date),
        COUNT(*) FILTER (WHERE ce.event_type = 'edit' AND ce.server_timestamp::date = p_date),
        COUNT(*) FILTER (WHERE ce.event_type = 'agent-result' AND ce.server_timestamp::date = p_date),
        COUNT(DISTINCT CASE WHEN ce.server_timestamp::date = p_date THEN ce.user_id END)
    FROM collaboration_workspaces w
    LEFT JOIN collaboration_events ce ON ce.workspace_id = w.id 
        AND ce.server_timestamp >= p_date::timestamp 
        AND ce.server_timestamp < (p_date + INTERVAL '1 day')::timestamp
    WHERE w.is_active = true
    GROUP BY w.id
    ON CONFLICT (workspace_id, date) DO UPDATE SET
        total_participants = EXCLUDED.total_participants,
        active_participants = EXCLUDED.active_participants,
        message_count = EXCLUDED.message_count,
        edit_count = EXCLUDED.edit_count,
        agent_share_count = EXCLUDED.agent_share_count,
        unique_daily_users = EXCLUDED.unique_daily_users;
        
    GET DIAGNOSTICS processed_count = ROW_COUNT;
    
    RETURN processed_count;
END;
$$ LANGUAGE plpgsql;

-- Create views for common queries
CREATE OR REPLACE VIEW workspace_activity_summary AS
SELECT 
    w.id,
    w.name,
    w.type,
    w.owner_id,
    w.is_active,
    COUNT(wp.user_id) as total_participants,
    COUNT(wp.user_id) FILTER (WHERE wp.status = 'online') as online_participants,
    MAX(wp.last_seen) as last_activity,
    w.created_at,
    w.updated_at
FROM collaboration_workspaces w
LEFT JOIN workspace_participants wp ON w.id = wp.workspace_id AND wp.left_at IS NULL
GROUP BY w.id, w.name, w.type, w.owner_id, w.is_active, w.created_at, w.updated_at;

CREATE OR REPLACE VIEW user_collaboration_summary AS
SELECT 
    wp.user_id,
    wp.user_name,
    wp.user_email,
    COUNT(DISTINCT wp.workspace_id) as total_workspaces,
    COUNT(DISTINCT wp.workspace_id) FILTER (WHERE wp.status = 'online') as active_workspaces,
    SUM(wp.message_count) as total_messages,
    SUM(wp.edit_count) as total_edits,
    MAX(wp.last_seen) as last_activity
FROM workspace_participants wp
WHERE wp.left_at IS NULL
GROUP BY wp.user_id, wp.user_name, wp.user_email;

-- Insert default workspace templates or examples
INSERT INTO collaboration_workspaces (id, name, description, type, owner_id, is_public, settings) VALUES 
(
    uuid_generate_v4(),
    'General Discussion',
    'Open workspace for general team discussions and announcements',
    'chat',
    'system',
    true,
    '{
        "maxParticipants": 100,
        "allowAnonymous": true,
        "requireApproval": false,
        "persistence": true
    }'::jsonb
),
(
    uuid_generate_v4(),
    'Code Review Sessions',
    'Collaborative workspace for code review and development discussions',
    'code',
    'system',
    false,
    '{
        "maxParticipants": 20,
        "allowAnonymous": false,
        "requireApproval": true,
        "persistence": true
    }'::jsonb
)
ON CONFLICT DO NOTHING;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Create RLS policies if needed (uncomment if using Row Level Security)
-- ALTER TABLE collaboration_workspaces ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE workspace_participants ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE collaboration_events ENABLE ROW LEVEL SECURITY;

-- Create scheduled job for cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-collaboration-presence', '*/5 * * * *', 'SELECT cleanup_stale_presence();');
-- SELECT cron.schedule('aggregate-workspace-analytics', '0 1 * * *', 'SELECT aggregate_workspace_analytics();');

-- Add comments for migration tracking
COMMENT ON TABLE collaboration_workspaces IS 'Real-time collaboration workspaces - v1.0';
COMMENT ON TABLE workspace_participants IS 'Workspace participant management and tracking - v1.0';
COMMENT ON TABLE collaboration_events IS 'Detailed collaboration event tracking - v1.0';
COMMENT ON TABLE collaboration_chat_messages IS 'Optimized chat message storage - v1.0';
COMMENT ON TABLE collaboration_presence IS 'Real-time user presence tracking - v1.0';