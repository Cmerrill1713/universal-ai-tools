-- JWT Authentication System Database Schema
-- Created: 2025-01-20
-- Purpose: Comprehensive JWT authentication with refresh tokens, session management, and security features

BEGIN;

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table (enhanced)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'user' NOT NULL,
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    email_verification_token UUID,
    password_reset_token UUID,
    password_reset_expires TIMESTAMPTZ,
    failed_login_attempts INTEGER DEFAULT 0,
    account_locked_until TIMESTAMPTZ,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Refresh tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_id UUID NOT NULL UNIQUE,
    encrypted_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_revoked BOOLEAN DEFAULT false,
    revoked_at TIMESTAMPTZ,
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User activity tracking
CREATE TABLE IF NOT EXISTS user_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    session_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Authentication events logging
CREATE TABLE IF NOT EXISTS auth_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL, -- login, logout, token_generated, token_refreshed, etc.
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    additional_data JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- API key usage tracking (from existing auth system)
CREATE TABLE IF NOT EXISTS api_key_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    api_key VARCHAR(255) NOT NULL,
    endpoint TEXT NOT NULL,
    method VARCHAR(10) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    response_status INTEGER,
    response_time_ms INTEGER,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- User sessions tracking (from existing auth system)
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_token UUID UNIQUE,
    endpoint TEXT,
    method VARCHAR(10),
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Security audit log
CREATE TABLE IF NOT EXISTS security_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_category VARCHAR(50) NOT NULL, -- auth, authorization, security_violation, etc.
    event_type VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,
    endpoint TEXT,
    method VARCHAR(10),
    request_data JSONB,
    response_status INTEGER,
    risk_level VARCHAR(20) DEFAULT 'low', -- low, medium, high, critical
    description TEXT,
    additional_data JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_id ON refresh_tokens(token_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_is_revoked ON refresh_tokens(is_revoked);

CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_last_activity ON user_activity(last_activity);

CREATE INDEX IF NOT EXISTS idx_auth_events_user_id ON auth_events(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_events_event_type ON auth_events(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_events_timestamp ON auth_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_auth_events_success ON auth_events(success);

CREATE INDEX IF NOT EXISTS idx_api_key_usage_api_key ON api_key_usage(api_key);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_timestamp ON api_key_usage(timestamp);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_is_active ON user_sessions(is_active);

CREATE INDEX IF NOT EXISTS idx_security_audit_log_user_id ON security_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_timestamp ON security_audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_risk_level ON security_audit_log(risk_level);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_event_category ON security_audit_log(event_category);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_refresh_tokens_updated_at 
    BEFORE UPDATE ON refresh_tokens 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_activity_updated_at 
    BEFORE UPDATE ON user_activity 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY user_own_data ON users
    FOR ALL USING (auth.uid()::text = id::text);

-- Users can only see their own refresh tokens
CREATE POLICY user_own_refresh_tokens ON refresh_tokens
    FOR ALL USING (auth.uid()::text = user_id::text);

-- Users can only see their own activity
CREATE POLICY user_own_activity ON user_activity
    FOR ALL USING (auth.uid()::text = user_id::text);

-- Users can only see their own auth events
CREATE POLICY user_own_auth_events ON auth_events
    FOR SELECT USING (auth.uid()::text = user_id::text);

-- Users can only see their own sessions
CREATE POLICY user_own_sessions ON user_sessions
    FOR ALL USING (auth.uid()::text = user_id::text);

-- Functions for token management

-- Function to cleanup expired refresh tokens
CREATE OR REPLACE FUNCTION cleanup_expired_refresh_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM refresh_tokens 
    WHERE expires_at < NOW() 
       OR (is_revoked = true AND revoked_at < NOW() - INTERVAL '7 days');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    INSERT INTO security_audit_log (
        event_category,
        event_type,
        description,
        additional_data
    ) VALUES (
        'maintenance',
        'cleanup_expired_tokens',
        'Cleaned up expired refresh tokens',
        jsonb_build_object('deleted_count', deleted_count)
    );
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup old auth events
CREATE OR REPLACE FUNCTION cleanup_old_auth_events()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM auth_events 
    WHERE timestamp < NOW() - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    INSERT INTO security_audit_log (
        event_category,
        event_type,
        description,
        additional_data
    ) VALUES (
        'maintenance',
        'cleanup_old_auth_events',
        'Cleaned up old authentication events',
        jsonb_build_object('deleted_count', deleted_count)
    );
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user security summary
CREATE OR REPLACE FUNCTION get_user_security_summary(target_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'active_sessions', (
            SELECT COUNT(*) 
            FROM refresh_tokens 
            WHERE user_id = target_user_id 
              AND is_revoked = false 
              AND expires_at > NOW()
        ),
        'failed_attempts_24h', (
            SELECT COUNT(*) 
            FROM auth_events 
            WHERE user_id = target_user_id 
              AND success = false 
              AND timestamp > NOW() - INTERVAL '24 hours'
        ),
        'last_login', (
            SELECT timestamp 
            FROM auth_events 
            WHERE user_id = target_user_id 
              AND event_type = 'login' 
              AND success = true 
            ORDER BY timestamp DESC 
            LIMIT 1
        ),
        'account_status', (
            SELECT CASE 
                WHEN is_active = false THEN 'disabled'
                WHEN account_locked_until > NOW() THEN 'locked'
                ELSE 'active'
            END
            FROM users 
            WHERE id = target_user_id
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to revoke all user sessions
CREATE OR REPLACE FUNCTION revoke_all_user_sessions(target_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    revoked_count INTEGER;
BEGIN
    UPDATE refresh_tokens 
    SET is_revoked = true, revoked_at = NOW()
    WHERE user_id = target_user_id 
      AND is_revoked = false;
    
    GET DIAGNOSTICS revoked_count = ROW_COUNT;
    
    UPDATE user_sessions 
    SET is_active = false
    WHERE user_id = target_user_id 
      AND is_active = true;
    
    INSERT INTO auth_events (
        user_id,
        event_type,
        success,
        additional_data
    ) VALUES (
        target_user_id,
        'sessions_revoked_all',
        true,
        jsonb_build_object('revoked_count', revoked_count)
    );
    
    RETURN revoked_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create scheduled jobs for cleanup (requires pg_cron extension)
-- Note: Uncomment if pg_cron is available
-- SELECT cron.schedule('cleanup-expired-tokens', '0 2 * * *', 'SELECT cleanup_expired_refresh_tokens();');
-- SELECT cron.schedule('cleanup-old-auth-events', '0 3 * * 0', 'SELECT cleanup_old_auth_events();');

-- Create views for monitoring

-- Active sessions view
CREATE OR REPLACE VIEW active_user_sessions AS
SELECT 
    u.id as user_id,
    u.email,
    rt.token_id,
    rt.created_at as session_started,
    rt.expires_at,
    rt.ip_address,
    rt.user_agent,
    ua.last_activity
FROM users u
JOIN refresh_tokens rt ON u.id = rt.user_id
LEFT JOIN user_activity ua ON u.id = ua.user_id
WHERE rt.is_revoked = false 
  AND rt.expires_at > NOW()
  AND u.is_active = true;

-- Security alerts view
CREATE OR REPLACE VIEW security_alerts AS
SELECT 
    sal.id,
    sal.event_category,
    sal.event_type,
    sal.user_id,
    u.email,
    sal.ip_address,
    sal.risk_level,
    sal.description,
    sal.timestamp
FROM security_audit_log sal
LEFT JOIN users u ON sal.user_id = u.id
WHERE sal.risk_level IN ('high', 'critical')
  AND sal.timestamp > NOW() - INTERVAL '7 days'
ORDER BY sal.timestamp DESC;

-- Authentication statistics view
CREATE OR REPLACE VIEW auth_statistics AS
SELECT 
    DATE_TRUNC('hour', timestamp) as hour,
    event_type,
    COUNT(*) as event_count,
    COUNT(*) FILTER (WHERE success = true) as success_count,
    COUNT(*) FILTER (WHERE success = false) as failure_count,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT ip_address) as unique_ips
FROM auth_events
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', timestamp), event_type
ORDER BY hour DESC, event_type;

-- Grant necessary permissions
GRANT SELECT ON active_user_sessions TO authenticated;
GRANT SELECT ON auth_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_security_summary(UUID) TO authenticated;

-- Insert initial admin user (password: Admin123!)
-- Note: In production, change this password immediately
INSERT INTO users (
    email, 
    password_hash, 
    first_name, 
    last_name, 
    role, 
    is_active, 
    email_verified
) VALUES (
    'admin@universal-ai-tools.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeWhoDeRyGJKL4D3a', -- Admin123!
    'System',
    'Administrator',
    'admin',
    true,
    true
) ON CONFLICT (email) DO NOTHING;

COMMIT;

-- Add helpful comments
COMMENT ON TABLE users IS 'Core user accounts with enhanced security features';
COMMENT ON TABLE refresh_tokens IS 'JWT refresh tokens for secure session management';
COMMENT ON TABLE user_activity IS 'User activity tracking for security monitoring';
COMMENT ON TABLE auth_events IS 'Comprehensive authentication event logging';
COMMENT ON TABLE security_audit_log IS 'Security events and audit trail';

COMMENT ON FUNCTION cleanup_expired_refresh_tokens() IS 'Removes expired and old revoked refresh tokens';
COMMENT ON FUNCTION cleanup_old_auth_events() IS 'Removes old authentication events for storage management';
COMMENT ON FUNCTION get_user_security_summary(UUID) IS 'Returns security summary for a specific user';
COMMENT ON FUNCTION revoke_all_user_sessions(UUID) IS 'Revokes all active sessions for a user';

COMMENT ON VIEW active_user_sessions IS 'Shows currently active user sessions';
COMMENT ON VIEW security_alerts IS 'High-risk security events requiring attention';
COMMENT ON VIEW auth_statistics IS 'Authentication statistics for monitoring';