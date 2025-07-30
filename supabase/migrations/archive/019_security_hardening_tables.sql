-- Security hardening tables for API key rotation and audit logging

-- Table for tracking API key rotations
CREATE TABLE IF NOT EXISTS security_key_rotations (
    id BIGSERIAL PRIMARY KEY,
    key_name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(64) NOT NULL, -- SHA256 hash of the key
    rotated_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Index for quick lookup by key name
    INDEX idx_key_name (key_name),
    INDEX idx_created_at (created_at)
);

-- Table for storing security audit results
CREATE TABLE IF NOT EXISTS security_audits (
    id BIGSERIAL PRIMARY KEY,
    audit_type VARCHAR(50) NOT NULL,
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    vulnerabilities_count INTEGER NOT NULL DEFAULT 0,
    findings JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Index for querying recent audits
    INDEX idx_audit_created_at (created_at DESC),
    INDEX idx_audit_type (audit_type)
);

-- Grant appropriate permissions
GRANT SELECT, INSERT ON security_key_rotations TO authenticated;
GRANT SELECT, INSERT ON security_audits TO authenticated;
GRANT SELECT, INSERT ON security_key_rotations TO service_role;
GRANT SELECT, INSERT ON security_audits TO service_role;

-- RLS policies
ALTER TABLE security_key_rotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_audits ENABLE ROW LEVEL SECURITY;

-- Only service role can access key rotation history
CREATE POLICY "Service role only for key rotations" ON security_key_rotations
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Authenticated users can read audit results, service role can write
CREATE POLICY "Read audit results" ON security_audits
    FOR SELECT USING (auth.jwt() ->> 'role' IN ('authenticated', 'service_role'));

CREATE POLICY "Write audit results" ON security_audits
    FOR INSERT USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to clean up old audit logs (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM security_audits 
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '90 days';
    
    DELETE FROM security_key_rotations 
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '180 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-audit-logs', '0 2 * * *', 'SELECT cleanup_old_audit_logs();');