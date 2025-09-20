-- Voice Sessions and Interactions Schema
-- Migration for real-time voice conversation persistence

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Voice Sessions Table
-- Stores metadata about voice conversation sessions
CREATE TABLE IF NOT EXISTS voice_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) UNIQUE NOT NULL,
    user_id VARCHAR(255) NOT NULL DEFAULT 'anonymous',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    total_interactions INTEGER DEFAULT 0,
    total_speech_time_ms BIGINT DEFAULT 0,
    total_processing_time_ms BIGINT DEFAULT 0,
    preferences JSONB DEFAULT '{
        "language": "en",
        "voice": "nari_natural",
        "wakeword_enabled": true,
        "auto_speak_responses": true
    }'::jsonb,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'abandoned')),
    client_info JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Voice Interactions Table
-- Stores individual voice interactions within sessions
CREATE TABLE IF NOT EXISTS voice_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) NOT NULL,
    interaction_sequence INTEGER NOT NULL,
    transcript TEXT,
    transcript_confidence DECIMAL(4,3), -- 0.000 to 1.000
    user_intent VARCHAR(255),
    intent_confidence DECIMAL(4,3), -- 0.000 to 1.000
    agent_used VARCHAR(255),
    agent_response TEXT NOT NULL,
    speech_recognition_time_ms INTEGER,
    agent_processing_time_ms INTEGER NOT NULL,
    tts_generation_time_ms INTEGER,
    total_response_time_ms INTEGER NOT NULL,
    audio_duration_ms INTEGER,
    audio_file_path TEXT,
    response_audio_path TEXT,
    interaction_type VARCHAR(50) NOT NULL DEFAULT 'voice' CHECK (interaction_type IN ('voice', 'text', 'mixed')),
    user_satisfaction INTEGER CHECK (user_satisfaction BETWEEN 1 AND 5),
    error_occurred BOOLEAN DEFAULT FALSE,
    error_details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure uniqueness of sequence within session
    UNIQUE(session_id, interaction_sequence)
);

-- Add foreign key relationship
ALTER TABLE voice_interactions 
ADD CONSTRAINT fk_voice_interactions_session_id 
FOREIGN KEY (session_id) REFERENCES voice_sessions(session_id) 
ON DELETE CASCADE;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_voice_sessions_user_id ON voice_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_started_at ON voice_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_status ON voice_sessions(status);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_session_id ON voice_sessions(session_id);

CREATE INDEX IF NOT EXISTS idx_voice_interactions_session_id ON voice_interactions(session_id);
CREATE INDEX IF NOT EXISTS idx_voice_interactions_created_at ON voice_interactions(created_at);
CREATE INDEX IF NOT EXISTS idx_voice_interactions_user_intent ON voice_interactions(user_intent);
CREATE INDEX IF NOT EXISTS idx_voice_interactions_agent_used ON voice_interactions(agent_used);
CREATE INDEX IF NOT EXISTS idx_voice_interactions_interaction_type ON voice_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_voice_interactions_error_occurred ON voice_interactions(error_occurred);

-- Create updated_at trigger for voice_sessions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_voice_sessions_updated_at 
    BEFORE UPDATE ON voice_sessions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Voice Analytics Views for faster queries

-- Session Analytics View
CREATE OR REPLACE VIEW voice_session_analytics AS
SELECT 
    user_id,
    COUNT(*) as total_sessions,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_sessions,
    COUNT(CASE WHEN status = 'abandoned' THEN 1 END) as abandoned_sessions,
    AVG(total_interactions) as avg_interactions_per_session,
    AVG(total_speech_time_ms) as avg_speech_time_ms,
    AVG(total_processing_time_ms) as avg_processing_time_ms,
    AVG(CASE 
        WHEN ended_at IS NOT NULL AND started_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (ended_at - started_at)) * 1000 
    END) as avg_session_duration_ms,
    MIN(started_at) as first_session,
    MAX(started_at) as last_session
FROM voice_sessions
GROUP BY user_id;

-- Interaction Analytics View
CREATE OR REPLACE VIEW voice_interaction_analytics AS
SELECT 
    vs.user_id,
    vi.user_intent,
    vi.agent_used,
    vi.interaction_type,
    COUNT(*) as interaction_count,
    AVG(vi.transcript_confidence) as avg_transcript_confidence,
    AVG(vi.intent_confidence) as avg_intent_confidence,
    AVG(vi.speech_recognition_time_ms) as avg_speech_recognition_time_ms,
    AVG(vi.agent_processing_time_ms) as avg_agent_processing_time_ms,
    AVG(vi.tts_generation_time_ms) as avg_tts_generation_time_ms,
    AVG(vi.total_response_time_ms) as avg_total_response_time_ms,
    AVG(vi.user_satisfaction) as avg_user_satisfaction,
    COUNT(CASE WHEN vi.error_occurred THEN 1 END) as error_count,
    COUNT(CASE WHEN vi.error_occurred THEN 1 END)::DECIMAL / COUNT(*) as error_rate
FROM voice_interactions vi
JOIN voice_sessions vs ON vi.session_id = vs.session_id
GROUP BY vs.user_id, vi.user_intent, vi.agent_used, vi.interaction_type;

-- Daily Usage Statistics View
CREATE OR REPLACE VIEW voice_daily_stats AS
SELECT 
    DATE(started_at) as date,
    COUNT(*) as sessions_created,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as sessions_completed,
    SUM(total_interactions) as total_interactions,
    AVG(total_interactions) as avg_interactions_per_session,
    COUNT(DISTINCT user_id) as unique_users
FROM voice_sessions
GROUP BY DATE(started_at)
ORDER BY date DESC;

-- Functions for common voice operations

-- Function to get session summary
CREATE OR REPLACE FUNCTION get_voice_session_summary(p_session_id VARCHAR)
RETURNS TABLE (
    session_info JSONB,
    interaction_count INTEGER,
    total_duration_ms BIGINT,
    avg_response_time_ms DECIMAL,
    error_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        to_jsonb(vs.*) as session_info,
        COUNT(vi.*)::INTEGER as interaction_count,
        COALESCE(EXTRACT(EPOCH FROM (vs.ended_at - vs.started_at)) * 1000, 0)::BIGINT as total_duration_ms,
        AVG(vi.total_response_time_ms) as avg_response_time_ms,
        COUNT(CASE WHEN vi.error_occurred THEN 1 END)::INTEGER as error_count
    FROM voice_sessions vs
    LEFT JOIN voice_interactions vi ON vs.session_id = vi.session_id
    WHERE vs.session_id = p_session_id
    GROUP BY vs.id, vs.session_id, vs.user_id, vs.started_at, vs.ended_at, 
             vs.total_interactions, vs.total_speech_time_ms, vs.total_processing_time_ms,
             vs.preferences, vs.status, vs.client_info, vs.created_at, vs.updated_at;
END;
$$ LANGUAGE plpgsql;

-- Function to get user voice statistics
CREATE OR REPLACE FUNCTION get_user_voice_stats(p_user_id VARCHAR, p_days INTEGER DEFAULT 30)
RETURNS TABLE (
    total_sessions INTEGER,
    total_interactions INTEGER,
    avg_session_duration_ms DECIMAL,
    most_common_intent VARCHAR,
    preferred_voice VARCHAR,
    avg_satisfaction DECIMAL,
    error_rate DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    WITH user_sessions AS (
        SELECT * FROM voice_sessions 
        WHERE user_id = p_user_id 
        AND started_at >= NOW() - INTERVAL '1 day' * p_days
    ),
    user_interactions AS (
        SELECT vi.* FROM voice_interactions vi
        JOIN user_sessions us ON vi.session_id = us.session_id
    ),
    intent_counts AS (
        SELECT user_intent, COUNT(*) as count
        FROM user_interactions
        WHERE user_intent IS NOT NULL
        GROUP BY user_intent
        ORDER BY count DESC
        LIMIT 1
    ),
    voice_prefs AS (
        SELECT preferences->>'voice' as voice, COUNT(*) as count
        FROM user_sessions
        GROUP BY preferences->>'voice'
        ORDER BY count DESC
        LIMIT 1
    )
    SELECT 
        COUNT(DISTINCT us.session_id)::INTEGER as total_sessions,
        COUNT(ui.*)::INTEGER as total_interactions,
        AVG(CASE 
            WHEN us.ended_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (us.ended_at - us.started_at)) * 1000 
        END) as avg_session_duration_ms,
        COALESCE((SELECT user_intent FROM intent_counts), 'unknown') as most_common_intent,
        COALESCE((SELECT voice FROM voice_prefs), 'unknown') as preferred_voice,
        AVG(ui.user_satisfaction) as avg_satisfaction,
        COUNT(CASE WHEN ui.error_occurred THEN 1 END)::DECIMAL / NULLIF(COUNT(ui.*), 0) as error_rate
    FROM user_sessions us
    LEFT JOIN user_interactions ui ON us.session_id = ui.session_id;
END;
$$ LANGUAGE plpgsql;

-- RLS (Row Level Security) policies for voice sessions
ALTER TABLE voice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_interactions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own voice sessions
CREATE POLICY voice_sessions_user_policy ON voice_sessions
    FOR ALL USING (user_id = current_setting('app.current_user_id', true));

-- Policy: Users can only access interactions from their own sessions
CREATE POLICY voice_interactions_user_policy ON voice_interactions
    FOR ALL USING (
        session_id IN (
            SELECT session_id FROM voice_sessions 
            WHERE user_id = current_setting('app.current_user_id', true)
        )
    );

-- Service role can access all data (for admin operations)
CREATE POLICY voice_sessions_service_policy ON voice_sessions
    FOR ALL USING (current_setting('role') = 'service_role');

CREATE POLICY voice_interactions_service_policy ON voice_interactions
    FOR ALL USING (current_setting('role') = 'service_role');

-- Grant permissions
GRANT ALL ON voice_sessions TO service_role;
GRANT ALL ON voice_interactions TO service_role;
GRANT SELECT ON voice_session_analytics TO service_role;
GRANT SELECT ON voice_interaction_analytics TO service_role;
GRANT SELECT ON voice_daily_stats TO service_role;
GRANT EXECUTE ON FUNCTION get_voice_session_summary(VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION get_user_voice_stats(VARCHAR, INTEGER) TO service_role;

-- Comment the tables
COMMENT ON TABLE voice_sessions IS 'Stores metadata about voice conversation sessions with AI assistants';
COMMENT ON TABLE voice_interactions IS 'Stores individual voice interactions within sessions including transcripts and responses';
COMMENT ON VIEW voice_session_analytics IS 'Aggregated analytics for voice sessions by user';
COMMENT ON VIEW voice_interaction_analytics IS 'Aggregated analytics for voice interactions by user, intent, and agent';
COMMENT ON VIEW voice_daily_stats IS 'Daily usage statistics for voice sessions';

-- Insert sample data for testing (optional, remove in production)
-- INSERT INTO voice_sessions (session_id, user_id, preferences) VALUES 
-- ('test_session_1', 'test_user', '{"language": "en", "voice": "nari_natural", "wakeword_enabled": true, "auto_speak_responses": true}');

-- INSERT INTO voice_interactions (session_id, interaction_sequence, transcript, agent_response, agent_processing_time_ms, total_response_time_ms) VALUES
-- ('test_session_1', 1, 'Hello, can you help me?', 'Hello! I would be happy to help you. What can I assist you with today?', 500, 750);

-- Create a function to clean up old voice sessions (for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_voice_sessions(days_old INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete interactions first (foreign key constraint)
    DELETE FROM voice_interactions 
    WHERE session_id IN (
        SELECT session_id FROM voice_sessions 
        WHERE started_at < NOW() - INTERVAL '1 day' * days_old
    );
    
    -- Delete old sessions
    DELETE FROM voice_sessions 
    WHERE started_at < NOW() - INTERVAL '1 day' * days_old;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant execution permission
GRANT EXECUTE ON FUNCTION cleanup_old_voice_sessions(INTEGER) TO service_role;

-- Create scheduled cleanup job (requires pg_cron extension - uncomment if available)
-- SELECT cron.schedule('voice-cleanup', '0 2 * * *', 'SELECT cleanup_old_voice_sessions(30);');