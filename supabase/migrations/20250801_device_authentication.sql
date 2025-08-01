-- Device Authentication Tables for Swift Companion App
-- Production-ready schema with proper indexes and security

-- Drop existing tables if they exist
DROP TABLE IF EXISTS proximity_sessions CASCADE;
DROP TABLE IF EXISTS device_challenges CASCADE;
DROP TABLE IF EXISTS registered_devices CASCADE;

-- Create registered_devices table
CREATE TABLE registered_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    device_id TEXT NOT NULL UNIQUE, -- Unique identifier from iOS/watchOS
    device_name TEXT NOT NULL,
    device_type TEXT NOT NULL CHECK (device_type IN ('iPhone', 'iPad', 'AppleWatch', 'Mac')),
    public_key TEXT NOT NULL, -- For secure communication
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    trusted BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    
    -- Indexes for performance
    CONSTRAINT unique_user_device UNIQUE (user_id, device_id)
);

-- Create indexes for device lookups
CREATE INDEX idx_registered_devices_user_id ON registered_devices (user_id);
CREATE INDEX idx_registered_devices_device_id ON registered_devices (device_id);
CREATE INDEX idx_registered_devices_last_seen ON registered_devices (last_seen);
CREATE INDEX idx_registered_devices_trusted ON registered_devices (trusted) WHERE trusted = true;

-- Create device_challenges table for authentication
CREATE TABLE device_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES registered_devices(id) ON DELETE CASCADE,
    challenge TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure challenges expire
    CONSTRAINT challenge_expiry CHECK (expires_at > created_at)
);

-- Create indexes for challenge lookups
CREATE INDEX idx_device_challenges_device_id ON device_challenges (device_id);
CREATE INDEX idx_device_challenges_expires_at ON device_challenges (expires_at);
CREATE INDEX idx_device_challenges_completed ON device_challenges (completed) WHERE completed = false;

-- Create proximity_sessions table
CREATE TABLE proximity_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    device_id UUID NOT NULL REFERENCES registered_devices(id) ON DELETE CASCADE,
    rssi INTEGER NOT NULL CHECK (rssi >= -100 AND rssi <= 0),
    proximity TEXT NOT NULL CHECK (proximity IN ('immediate', 'near', 'far', 'unknown')),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    active BOOLEAN DEFAULT true,
    
    -- Only one active session per device
    CONSTRAINT unique_active_session UNIQUE (device_id, active) WHERE active = true
);

-- Create indexes for proximity lookups
CREATE INDEX idx_proximity_sessions_user_id ON proximity_sessions (user_id);
CREATE INDEX idx_proximity_sessions_device_id ON proximity_sessions (device_id);
CREATE INDEX idx_proximity_sessions_active ON proximity_sessions (active) WHERE active = true;
CREATE INDEX idx_proximity_sessions_last_updated ON proximity_sessions (last_updated);

-- Create audit log table for security
CREATE TABLE device_auth_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    user_id TEXT,
    device_id UUID REFERENCES registered_devices(id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for audit log
CREATE INDEX idx_device_auth_audit_log_created_at ON device_auth_audit_log (created_at);
CREATE INDEX idx_device_auth_audit_log_user_id ON device_auth_audit_log (user_id);
CREATE INDEX idx_device_auth_audit_log_device_id ON device_auth_audit_log (device_id);
CREATE INDEX idx_device_auth_audit_log_event_type ON device_auth_audit_log (event_type);

-- Create function to clean up expired challenges
CREATE OR REPLACE FUNCTION cleanup_expired_challenges()
RETURNS void AS $$
BEGIN
    DELETE FROM device_challenges
    WHERE expires_at < NOW() AND completed = false;
END;
$$ LANGUAGE plpgsql;

-- Create function to update last_seen timestamp
CREATE OR REPLACE FUNCTION update_device_last_seen()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE registered_devices
    SET last_seen = NOW()
    WHERE id = NEW.device_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update last_seen on proximity update
CREATE TRIGGER trigger_update_device_last_seen
AFTER INSERT OR UPDATE ON proximity_sessions
FOR EACH ROW
EXECUTE FUNCTION update_device_last_seen();

-- Create function to deactivate old proximity sessions
CREATE OR REPLACE FUNCTION deactivate_old_proximity_sessions()
RETURNS void AS $$
BEGIN
    UPDATE proximity_sessions
    SET active = false
    WHERE active = true
    AND last_updated < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security
ALTER TABLE registered_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE proximity_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_auth_audit_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own devices
CREATE POLICY "Users can view own devices" ON registered_devices
    FOR SELECT USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can insert own devices" ON registered_devices
    FOR INSERT WITH CHECK (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can update own devices" ON registered_devices
    FOR UPDATE USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can delete own devices" ON registered_devices
    FOR DELETE USING (auth.uid()::TEXT = user_id);

-- Similar policies for proximity_sessions
CREATE POLICY "Users can view own sessions" ON proximity_sessions
    FOR SELECT USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can manage own sessions" ON proximity_sessions
    FOR ALL USING (auth.uid()::TEXT = user_id);

-- Audit log is write-only for users
CREATE POLICY "Audit log is append-only" ON device_auth_audit_log
    FOR INSERT WITH CHECK (true);

-- Add comments for documentation
COMMENT ON TABLE registered_devices IS 'Stores registered iOS/watchOS devices for proximity authentication';
COMMENT ON TABLE device_challenges IS 'Temporary authentication challenges for device verification';
COMMENT ON TABLE proximity_sessions IS 'Active proximity sessions for auto-lock/unlock functionality';
COMMENT ON TABLE device_auth_audit_log IS 'Security audit trail for device authentication events';

-- Pre-seed Christian's devices for testing (optional - comment out for production)
-- INSERT INTO registered_devices (user_id, device_id, device_name, device_type, public_key, trusted, metadata)
-- VALUES 
--     ('christian', 'iPhone-CM-15Pro-2024', 'Christian''s iPhone 15 Pro', 'iPhone', 'iphone-public-key-2024', true, 
--      '{"osVersion": "17.0", "appVersion": "1.0.0", "capabilities": ["bluetooth", "biometric", "proximity", "face_id"]}'::jsonb),
--     ('christian', 'AppleWatch-CM-Ultra-2024', 'Christian''s Apple Watch Ultra', 'AppleWatch', 'applewatch-public-key-2024', true,
--      '{"osVersion": "10.0", "appVersion": "1.0.0", "capabilities": ["bluetooth", "biometric", "proximity", "health", "ultra_wideband"]}'::jsonb);