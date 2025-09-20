-- Universal AI Tools - Authentication System Migration
-- Production-ready authentication with multi-tenant support

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tenants table for multi-tenant support
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE,
    settings JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create default tenant
INSERT INTO tenants (id, name, domain) VALUES
    ('00000000-0000-0000-0000-000000000000', 'Default Tenant', 'default.local')
ON CONFLICT (id) DO NOTHING;

-- Users table with tenant isolation
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user', 'agent')),
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_email_per_tenant UNIQUE (tenant_id, email)
);

-- User sessions table for JWT session management
CREATE TABLE IF NOT EXISTS user_sessions (
    id VARCHAR(255) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    device_info JSONB,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_session_duration CHECK (expires_at > created_at)
);

-- API keys table for programmatic access
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    key_hash VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    permissions TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User permissions table for fine-grained access control
CREATE TABLE IF NOT EXISTS user_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    permission VARCHAR(255) NOT NULL,
    granted_by UUID REFERENCES users(id),
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_user_permission UNIQUE (user_id, permission, tenant_id)
);

-- Role permissions mapping
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role VARCHAR(50) NOT NULL,
    permission VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_role_permission UNIQUE (role, permission)
);

-- Insert default role permissions
INSERT INTO role_permissions (role, permission, description) VALUES
    ('admin', 'users:read', 'Read user information'),
    ('admin', 'users:write', 'Create and update users'),
    ('admin', 'users:delete', 'Delete users'),
    ('admin', 'tenants:read', 'Read tenant information'),
    ('admin', 'tenants:write', 'Create and update tenants'),
    ('admin', 'agents:read', 'Read agent information'),
    ('admin', 'agents:write', 'Create and update agents'),
    ('admin', 'agents:delete', 'Delete agents'),
    ('admin', 'system:read', 'Read system information'),
    ('admin', 'system:write', 'Modify system settings'),
    ('user', 'agents:read', 'Read agent information'),
    ('user', 'agents:write', 'Create and update agents'),
    ('user', 'conversations:read', 'Read conversations'),
    ('user', 'conversations:write', 'Create and update conversations'),
    ('user', 'files:read', 'Read files'),
    ('user', 'files:write', 'Upload and manage files'),
    ('agent', 'conversations:read', 'Read conversations'),
    ('conversations:write', 'Create and update conversations'),
    ('knowledge:read', 'Read knowledge base')
ON CONFLICT (role, permission) DO NOTHING;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_tenant_email ON users (tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users (is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions (user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions (expires_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys (user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys (key_hash) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions (user_id, tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission ON user_permissions (permission, tenant_id);

-- Row Level Security (RLS) policies for multi-tenant isolation

-- Users table RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own tenant" ON users
    FOR ALL USING (tenant_id::text = current_setting('app.tenant_id', true));

-- User sessions RLS
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own sessions" ON user_sessions
    FOR ALL USING (tenant_id::text = current_setting('app.tenant_id', true));

-- API keys RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own API keys" ON api_keys
    FOR ALL USING (tenant_id::text = current_setting('app.tenant_id', true));

-- User permissions RLS
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own permissions" ON user_permissions
    FOR ALL USING (tenant_id::text = current_setting('app.tenant_id', true));

-- Role permissions (global, no RLS needed)
-- Tenants table (admin only, will be handled by application logic)

-- Functions for authentication

-- Function to get user permissions
CREATE OR REPLACE FUNCTION get_user_permissions(user_uuid UUID)
RETURNS TABLE (permission VARCHAR(255))
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT rp.permission
    FROM users u
    JOIN role_permissions rp ON u.role = rp.role
    LEFT JOIN user_permissions up ON u.id = up.user_id AND up.is_active = true AND (up.expires_at IS NULL OR up.expires_at > NOW())
    WHERE u.id = user_uuid AND u.is_active = true;
END;
$$;

-- Function to validate session
CREATE OR REPLACE FUNCTION validate_user_session(session_id VARCHAR(255))
RETURNS TABLE (user_id UUID, tenant_id UUID, is_valid BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        us.user_id,
        us.tenant_id,
        (us.is_active = true AND us.expires_at > NOW()) as is_valid
    FROM user_sessions us
    WHERE us.id = session_id;
END;
$$;

-- Function to cleanup expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_sessions
    WHERE expires_at < NOW() OR is_active = false;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- Triggers for updated_at timestamps
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

CREATE TRIGGER update_api_keys_updated_at
    BEFORE UPDATE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create default admin user for development (will be removed in production)
-- This should be handled by the application setup process
INSERT INTO users (id, tenant_id, email, name, password_hash, role, is_active, email_verified)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'admin@universalaicompany.com',
    'System Administrator',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPjYLC3zJzQW', -- password: 'admin123!@#'
    'admin',
    true,
    true
)
ON CONFLICT (id) DO NOTHING;

-- Grant necessary permissions to the function
GRANT EXECUTE ON FUNCTION get_user_permissions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_user_session(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_sessions() TO authenticated;

-- Create index for session cleanup
CREATE INDEX IF NOT EXISTS idx_user_sessions_cleanup ON user_sessions (is_active, expires_at) WHERE is_active = true;

-- Comments for documentation
COMMENT ON TABLE tenants IS 'Multi-tenant support for Universal AI Tools';
COMMENT ON TABLE users IS 'User accounts with tenant isolation';
COMMENT ON TABLE user_sessions IS 'JWT session management and tracking';
COMMENT ON TABLE api_keys IS 'Programmatic access keys for API authentication';
COMMENT ON TABLE user_permissions IS 'Fine-grained permission system';
COMMENT ON TABLE role_permissions IS 'Default permissions for each role';

COMMENT ON FUNCTION get_user_permissions(UUID) IS 'Get all permissions for a user including role and custom permissions';
COMMENT ON FUNCTION validate_user_session(VARCHAR) IS 'Validate if a session is active and not expired';
COMMENT ON FUNCTION cleanup_expired_sessions() IS 'Remove expired sessions to maintain performance';
