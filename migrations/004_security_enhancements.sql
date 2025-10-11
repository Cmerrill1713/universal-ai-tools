-- Security Enhancements Migration
-- Add tables and indexes for enhanced security features

-- Create refresh tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_id UUID NOT NULL UNIQUE,
    encrypted_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMPTZ,
    user_agent TEXT,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);

-- Create indexes for refresh tokens
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_id ON refresh_tokens(token_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX idx_refresh_tokens_is_revoked ON refresh_tokens(is_revoked);

-- Create rate limits table for distributed rate limiting
CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 1,
    reset_time TIMESTAMPTZ NOT NULL,
    first_request TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    blocked BOOLEAN DEFAULT FALSE,
    tier TEXT DEFAULT 'anonymous',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for cleanup
CREATE INDEX idx_rate_limits_reset_time ON rate_limits(reset_time);

-- Create API key usage tracking table
CREATE TABLE IF NOT EXISTS api_key_usage (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    api_key TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    response_status INTEGER,
    response_time_ms INTEGER,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for API key usage
CREATE INDEX idx_api_key_usage_api_key ON api_key_usage(api_key);
CREATE INDEX idx_api_key_usage_timestamp ON api_key_usage(timestamp);
CREATE INDEX idx_api_key_usage_endpoint ON api_key_usage(endpoint);

-- Create user sessions table for tracking
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT,
    method TEXT,
    ip_address TEXT,
    user_agent TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for user sessions
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_timestamp ON user_sessions(timestamp);

-- Create security events table
CREATE TABLE IF NOT EXISTS security_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ip_address TEXT,
    user_agent TEXT,
    details JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for security events
CREATE INDEX idx_security_events_event_type ON security_events(event_type);
CREATE INDEX idx_security_events_severity ON security_events(severity);
CREATE INDEX idx_security_events_user_id ON security_events(user_id);
CREATE INDEX idx_security_events_timestamp ON security_events(timestamp);

-- Add is_active column to users table if not exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Add last_login column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

-- Add failed_login_attempts column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;

-- Add locked_until column to users table for account lockout
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

-- Create function to increment rate limit counter
CREATE OR REPLACE FUNCTION increment_rate_limit(p_key TEXT)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    INSERT INTO rate_limits (key, count, reset_time, first_request)
    VALUES (p_key, 1, NOW() + INTERVAL '15 minutes', NOW())
    ON CONFLICT (key) DO UPDATE
    SET count = rate_limits.count + 1,
        updated_at = NOW()
    RETURNING count INTO v_count;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
    p_event_type TEXT,
    p_severity TEXT,
    p_user_id UUID,
    p_ip_address TEXT,
    p_user_agent TEXT,
    p_details JSONB
)
RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO security_events (event_type, severity, user_id, ip_address, user_agent, details)
    VALUES (p_event_type, p_severity, p_user_id, p_ip_address, p_user_agent, p_details)
    RETURNING id INTO v_event_id;
    
    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to handle failed login attempts
CREATE OR REPLACE FUNCTION handle_failed_login(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE users
    SET failed_login_attempts = failed_login_attempts + 1
    WHERE id = p_user_id;
    
    -- Lock account after 5 failed attempts
    UPDATE users
    SET locked_until = NOW() + INTERVAL '30 minutes'
    WHERE id = p_user_id
    AND failed_login_attempts >= 5;
END;
$$ LANGUAGE plpgsql;

-- Create function to reset failed login attempts
CREATE OR REPLACE FUNCTION reset_failed_login_attempts(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE users
    SET failed_login_attempts = 0,
        locked_until = NULL,
        last_login = NOW()
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Create view for active sessions
CREATE OR REPLACE VIEW active_sessions AS
SELECT 
    rt.user_id,
    u.email,
    COUNT(rt.token_id) as active_tokens,
    MIN(rt.created_at) as oldest_session,
    MAX(rt.created_at) as newest_session
FROM refresh_tokens rt
JOIN users u ON rt.user_id = u.id
WHERE rt.is_revoked = FALSE
AND rt.expires_at > NOW()
GROUP BY rt.user_id, u.email;

-- Create view for security metrics
CREATE OR REPLACE VIEW security_metrics AS
SELECT 
    (SELECT COUNT(*) FROM security_events WHERE timestamp > NOW() - INTERVAL '24 hours') as events_24h,
    (SELECT COUNT(*) FROM security_events WHERE severity = 'high' AND timestamp > NOW() - INTERVAL '24 hours') as high_severity_24h,
    (SELECT COUNT(*) FROM security_events WHERE severity = 'critical' AND timestamp > NOW() - INTERVAL '24 hours') as critical_severity_24h,
    (SELECT COUNT(*) FROM users WHERE failed_login_attempts > 0) as users_with_failed_logins,
    (SELECT COUNT(*) FROM users WHERE locked_until > NOW()) as locked_accounts,
    (SELECT COUNT(*) FROM refresh_tokens WHERE is_revoked = FALSE AND expires_at > NOW()) as active_sessions;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON refresh_tokens TO authenticated;
GRANT SELECT, INSERT, UPDATE ON rate_limits TO authenticated;
GRANT SELECT, INSERT ON api_key_usage TO authenticated;
GRANT SELECT, INSERT ON user_sessions TO authenticated;
GRANT SELECT, INSERT ON security_events TO authenticated;
GRANT SELECT ON active_sessions TO authenticated;
GRANT SELECT ON security_metrics TO authenticated;

-- Add RLS policies
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- RLS policy for refresh tokens - users can only see their own
CREATE POLICY "Users can view own refresh tokens" ON refresh_tokens
    FOR SELECT USING (auth.uid() = user_id);

-- RLS policy for user sessions - users can only see their own
CREATE POLICY "Users can view own sessions" ON user_sessions
    FOR SELECT USING (auth.uid() = user_id);

-- RLS policy for security events - admins only
CREATE POLICY "Admins can view security events" ON security_events
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_ai_service_keys_service_id ON ai_service_keys(service_id);