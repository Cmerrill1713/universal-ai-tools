-- Supabase Vault - Comprehensive Secrets Management System
-- Securely stores all API keys, tokens, and sensitive configuration

-- Enable pgsodium extension for encryption
CREATE EXTENSION IF NOT EXISTS pgsodium;

-- Enable Vault functionality
CREATE SCHEMA IF NOT EXISTS vault;

-- Create encrypted secrets table
CREATE TABLE IF NOT EXISTS vault.secrets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    secret TEXT NOT NULL, -- This will be automatically encrypted by Vault
    category TEXT CHECK (category IN ('api_key', 'token', 'password', 'certificate', 'config')),
    service_name TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create API configuration table for service discovery
CREATE TABLE IF NOT EXISTS api_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name TEXT NOT NULL UNIQUE,
    base_url TEXT NOT NULL,
    auth_type TEXT CHECK (auth_type IN ('api_key', 'bearer', 'basic', 'oauth2', 'custom')),
    auth_header_name TEXT DEFAULT 'Authorization',
    auth_prefix TEXT, -- e.g., 'Bearer ', 'ApiKey '
    rate_limit JSONB DEFAULT '{"requests_per_minute": 60}',
    timeout_ms INTEGER DEFAULT 30000,
    retry_config JSONB DEFAULT '{"max_retries": 3, "backoff_ms": 1000}',
    health_check_endpoint TEXT,
    required_scopes TEXT[],
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create environment-specific configuration
CREATE TABLE IF NOT EXISTS environment_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    environment TEXT NOT NULL DEFAULT 'development',
    service_name TEXT NOT NULL,
    config_overrides JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(environment, service_name)
);

-- Create secret usage audit log
CREATE TABLE IF NOT EXISTS secret_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    secret_name TEXT NOT NULL,
    accessed_by TEXT,
    access_type TEXT CHECK (access_type IN ('read', 'write', 'delete')),
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    accessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to safely get a secret
CREATE OR REPLACE FUNCTION vault.get_secret(secret_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    secret_value TEXT;
BEGIN
    -- Log access attempt
    INSERT INTO secret_access_logs (secret_name, access_type, accessed_by)
    VALUES (secret_name, 'read', current_user);
    
    -- Get the secret
    SELECT decrypted_secret INTO secret_value
    FROM vault.decrypted_secrets
    WHERE name = secret_name;
    
    IF secret_value IS NULL THEN
        -- Log failure
        UPDATE secret_access_logs 
        SET success = FALSE, error_message = 'Secret not found'
        WHERE id = (SELECT id FROM secret_access_logs ORDER BY accessed_at DESC LIMIT 1);
        
        RAISE EXCEPTION 'Secret % not found', secret_name;
    END IF;
    
    RETURN secret_value;
END;
$$;

-- Function to set a secret
CREATE OR REPLACE FUNCTION vault.set_secret(
    p_name TEXT,
    p_secret TEXT,
    p_description TEXT DEFAULT NULL,
    p_category TEXT DEFAULT 'api_key',
    p_service_name TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO vault.secrets (name, secret, description, category, service_name, metadata)
    VALUES (p_name, p_secret, p_description, p_category, p_service_name, p_metadata)
    ON CONFLICT (name) DO UPDATE
    SET secret = EXCLUDED.secret,
        description = EXCLUDED.description,
        category = EXCLUDED.category,
        service_name = EXCLUDED.service_name,
        metadata = EXCLUDED.metadata,
        updated_at = NOW();
    
    -- Log the action
    INSERT INTO secret_access_logs (secret_name, access_type, accessed_by)
    VALUES (p_name, 'write', current_user);
END;
$$;

-- Function to get all configuration for a service
CREATE OR REPLACE FUNCTION get_service_config(
    p_service_name TEXT,
    p_environment TEXT DEFAULT 'development'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    base_config JSONB;
    env_overrides JSONB;
    secret_value TEXT;
    final_config JSONB;
BEGIN
    -- Get base configuration
    SELECT row_to_json(ac.*)::jsonb INTO base_config
    FROM api_configurations ac
    WHERE ac.service_name = p_service_name AND ac.is_active = TRUE;
    
    IF base_config IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Get environment-specific overrides
    SELECT config_overrides INTO env_overrides
    FROM environment_configs
    WHERE service_name = p_service_name 
    AND environment = p_environment
    AND is_active = TRUE;
    
    -- Merge configurations
    final_config := base_config || COALESCE(env_overrides, '{}'::jsonb);
    
    -- Get the secret for this service
    BEGIN
        secret_value := vault.get_secret(p_service_name || '_key');
        final_config := final_config || jsonb_build_object('api_key', secret_value);
    EXCEPTION WHEN OTHERS THEN
        -- No secret found, that's okay
        NULL;
    END;
    
    RETURN final_config;
END;
$$;

-- Indexes for performance
CREATE INDEX idx_api_configurations_service_name ON api_configurations(service_name);
CREATE INDEX idx_api_configurations_is_active ON api_configurations(is_active);
CREATE INDEX idx_environment_configs_env_service ON environment_configs(environment, service_name);
CREATE INDEX idx_secret_access_logs_secret_name ON secret_access_logs(secret_name);
CREATE INDEX idx_secret_access_logs_accessed_at ON secret_access_logs(accessed_at);

-- RLS Policies
ALTER TABLE vault.secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE environment_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE secret_access_logs ENABLE ROW LEVEL SECURITY;

-- Only service role can access secrets directly
CREATE POLICY "Service role full access to secrets" ON vault.secrets
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Everyone can read API configurations
CREATE POLICY "Public read access to API configurations" ON api_configurations
    FOR SELECT TO anon, authenticated USING (is_active = TRUE);

-- Service role can manage configurations
CREATE POLICY "Service role manage API configurations" ON api_configurations
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role manage environment configs" ON environment_configs
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role access to logs" ON secret_access_logs
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Insert default API configurations
INSERT INTO api_configurations (service_name, base_url, auth_type, auth_prefix, rate_limit, metadata) VALUES
('openai', 'https://api.openai.com/v1', 'bearer', 'Bearer ', '{"requests_per_minute": 3000}', '{"models": ["gpt-4", "gpt-3.5-turbo"]}'),
('anthropic', 'https://api.anthropic.com/v1', 'api_key', 'x-api-key: ', '{"requests_per_minute": 1000}', '{"models": ["claude-3-opus", "claude-3-sonnet"]}'),
('google_ai', 'https://generativelanguage.googleapis.com/v1', 'api_key', 'key=', '{"requests_per_minute": 60}', '{"models": ["gemini-pro"]}'),
('huggingface', 'https://api-inference.huggingface.co', 'bearer', 'Bearer ', '{"requests_per_minute": 300}', '{"models": ["various"]}'),
('lm_studio', 'http://localhost:1234/v1', 'none', '', '{"requests_per_minute": 10000}', '{"models": ["local"]}'),
('ollama', 'http://localhost:11434', 'none', '', '{"requests_per_minute": 10000}', '{"models": ["local"]}'),
('serper', 'https://google.serper.dev', 'api_key', 'X-API-KEY: ', '{"requests_per_minute": 100}', '{"service": "search"}'),
('serpapi', 'https://serpapi.com/search', 'api_key', 'api_key=', '{"requests_per_minute": 100}', '{"service": "search"}'),
('browserless', 'https://chrome.browserless.io', 'api_key', 'token=', '{"requests_per_minute": 50}', '{"service": "browser"}'),
('redis', 'redis://localhost:6379', 'password', '', '{"requests_per_minute": 100000}', '{"service": "cache"}')
ON CONFLICT (service_name) DO NOTHING;

-- Comments
COMMENT ON SCHEMA vault IS 'Supabase Vault for secrets management';
COMMENT ON TABLE vault.secrets IS 'Encrypted storage for API keys and secrets';
COMMENT ON TABLE api_configurations IS 'Service configurations and endpoints';
COMMENT ON TABLE environment_configs IS 'Environment-specific configuration overrides';
COMMENT ON TABLE secret_access_logs IS 'Audit log for secret access';
COMMENT ON FUNCTION vault.get_secret IS 'Safely retrieve a secret with audit logging';
COMMENT ON FUNCTION vault.set_secret IS 'Store or update a secret with audit logging';
COMMENT ON FUNCTION get_service_config IS 'Get complete configuration for a service including secrets';