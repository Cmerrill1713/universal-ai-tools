-- API Secrets Management System
-- Secure storage for API keys with automatic fetching

-- Create secrets table (without using vault schema)
CREATE TABLE IF NOT EXISTS api_secrets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name TEXT NOT NULL UNIQUE,
    api_key TEXT NOT NULL, -- Will be encrypted at rest by Supabase
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    rate_limit JSONB DEFAULT '{"requests_per_minute": 60}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create service configurations table
CREATE TABLE IF NOT EXISTS service_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name TEXT NOT NULL UNIQUE,
    base_url TEXT NOT NULL,
    auth_type TEXT CHECK (auth_type IN ('api_key', 'bearer', 'basic', 'oauth2', 'none')),
    auth_header_name TEXT DEFAULT 'Authorization',
    auth_prefix TEXT, -- e.g., 'Bearer ', 'ApiKey '
    timeout_ms INTEGER DEFAULT 30000,
    retry_config JSONB DEFAULT '{"max_retries": 3, "backoff_ms": 1000}',
    health_check_endpoint TEXT,
    required_env_vars TEXT[],
    optional_env_vars TEXT[],
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create a view that combines secrets with configurations
CREATE OR REPLACE VIEW service_credentials AS
SELECT 
    sc.service_name,
    sc.base_url,
    sc.auth_type,
    sc.auth_header_name,
    sc.auth_prefix,
    sc.timeout_ms,
    sc.retry_config,
    sc.health_check_endpoint,
    sc.metadata as config_metadata,
    s.api_key,
    s.rate_limit,
    s.metadata as secret_metadata,
    s.is_active AND sc.is_active as is_active,
    s.expires_at
FROM service_configurations sc
LEFT JOIN api_secrets s ON sc.service_name = s.service_name
WHERE sc.is_active = TRUE;

-- Function to get service configuration with secret
CREATE OR REPLACE FUNCTION get_service_credentials(p_service_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'service_name', service_name,
        'base_url', base_url,
        'auth_type', auth_type,
        'auth_header_name', auth_header_name,
        'auth_prefix', auth_prefix,
        'api_key', api_key,
        'timeout_ms', timeout_ms,
        'retry_config', retry_config,
        'rate_limit', rate_limit,
        'health_check_endpoint', health_check_endpoint,
        'metadata', COALESCE(config_metadata, '{}'::jsonb) || COALESCE(secret_metadata, '{}'::jsonb),
        'is_active', is_active,
        'expires_at', expires_at
    ) INTO result
    FROM service_credentials
    WHERE service_name = p_service_name
    AND is_active = TRUE
    AND (expires_at IS NULL OR expires_at > NOW());
    
    RETURN result;
END;
$$;

-- Function to bulk get all active credentials
CREATE OR REPLACE FUNCTION get_all_service_credentials()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_object_agg(
        service_name,
        jsonb_build_object(
            'base_url', base_url,
            'auth_type', auth_type,
            'auth_header_name', auth_header_name,
            'auth_prefix', auth_prefix,
            'api_key', api_key,
            'timeout_ms', timeout_ms,
            'retry_config', retry_config,
            'rate_limit', rate_limit,
            'health_check_endpoint', health_check_endpoint,
            'metadata', COALESCE(config_metadata, '{}'::jsonb) || COALESCE(secret_metadata, '{}'::jsonb)
        )
    ) INTO result
    FROM service_credentials
    WHERE is_active = TRUE
    AND (expires_at IS NULL OR expires_at > NOW());
    
    RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

-- Insert service configurations
INSERT INTO service_configurations (service_name, base_url, auth_type, auth_prefix, required_env_vars, optional_env_vars, metadata) VALUES
('openai', 'https://api.openai.com/v1', 'bearer', 'Bearer ', '{"OPENAI_API_KEY"}', '{}', '{"models": ["gpt-4", "gpt-3.5-turbo"], "supports_streaming": true}'),
('anthropic', 'https://api.anthropic.com/v1', 'api_key', 'x-api-key: ', '{"ANTHROPIC_API_KEY"}', '{}', '{"models": ["claude-3-opus", "claude-3-sonnet"], "supports_streaming": true}'),
('google_ai', 'https://generativelanguage.googleapis.com/v1', 'api_key', '?key=', '{"GOOGLE_AI_API_KEY"}', '{}', '{"models": ["gemini-pro"], "supports_streaming": true}'),
('huggingface', 'https://api-inference.huggingface.co', 'bearer', 'Bearer ', '{"HUGGINGFACE_API_KEY"}', '{}', '{"models": ["various"], "supports_streaming": false}'),
('lm_studio', 'http://localhost:1234/v1', 'none', '', '{}', '{"LM_STUDIO_URL"}', '{"models": ["local"], "supports_streaming": true}'),
('ollama', 'http://localhost:11434', 'none', '', '{}', '{"OLLAMA_URL"}', '{"models": ["local"], "supports_streaming": true}'),
('serper', 'https://google.serper.dev', 'api_key', 'X-API-KEY: ', '{"SERPER_API_KEY"}', '{}', '{"service": "search", "type": "google_search"}'),
('serpapi', 'https://serpapi.com/search', 'api_key', '&api_key=', '{"SERPAPI_API_KEY"}', '{}', '{"service": "search", "type": "google_search"}'),
('browserless', 'https://chrome.browserless.io', 'api_key', '?token=', '{"BROWSERLESS_API_KEY"}', '{}', '{"service": "browser", "type": "headless_chrome"}'),
('elevenlabs', 'https://api.elevenlabs.io/v1', 'api_key', 'xi-api-key: ', '{"ELEVENLABS_API_KEY"}', '{}', '{"service": "tts", "type": "text_to_speech"}'),
('replicate', 'https://api.replicate.com/v1', 'bearer', 'Bearer ', '{"REPLICATE_API_TOKEN"}', '{}', '{"service": "ml", "type": "model_hosting"}'),
('pinecone', 'https://api.pinecone.io', 'api_key', 'Api-Key: ', '{"PINECONE_API_KEY"}', '{"PINECONE_ENVIRONMENT"}', '{"service": "vector_db", "type": "vector_database"}'),
('redis', 'redis://localhost:6379', 'none', '', '{}', '{"REDIS_URL", "REDIS_PASSWORD"}', '{"service": "cache", "type": "key_value_store"}'),
('supabase', 'http://localhost:54321', 'bearer', 'Bearer ', '{"SUPABASE_SERVICE_KEY"}', '{"SUPABASE_URL", "SUPABASE_ANON_KEY"}', '{"service": "database", "type": "postgres"}')
ON CONFLICT (service_name) DO UPDATE SET
    base_url = EXCLUDED.base_url,
    auth_type = EXCLUDED.auth_type,
    auth_prefix = EXCLUDED.auth_prefix,
    required_env_vars = EXCLUDED.required_env_vars,
    optional_env_vars = EXCLUDED.optional_env_vars,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

-- Create indexes
CREATE INDEX idx_api_secrets_service_name ON api_secrets(service_name);
CREATE INDEX idx_api_secrets_is_active ON api_secrets(is_active);
CREATE INDEX idx_service_configurations_service_name ON service_configurations(service_name);
CREATE INDEX idx_service_configurations_is_active ON service_configurations(is_active);

-- Enable RLS
ALTER TABLE api_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_configurations ENABLE ROW LEVEL SECURITY;

-- Only service role can access secrets
CREATE POLICY "Service role full access to api_secrets" ON api_secrets
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Everyone can read service configurations (but not the secrets)
CREATE POLICY "Public read access to service_configurations" ON service_configurations
    FOR SELECT TO anon, authenticated USING (is_active = TRUE);

-- Service role can manage configurations
CREATE POLICY "Service role manage service_configurations" ON service_configurations
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Function to check if a service has valid credentials
CREATE OR REPLACE FUNCTION has_valid_credentials(p_service_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    has_creds BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 
        FROM service_credentials 
        WHERE service_name = p_service_name 
        AND is_active = TRUE 
        AND api_key IS NOT NULL
        AND (expires_at IS NULL OR expires_at > NOW())
    ) INTO has_creds;
    
    RETURN has_creds;
END;
$$;

-- Function to get missing services (configured but no API key)
CREATE OR REPLACE FUNCTION get_missing_credentials()
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    missing TEXT[];
BEGIN
    SELECT array_agg(sc.service_name)
    INTO missing
    FROM service_configurations sc
    LEFT JOIN api_secrets s ON sc.service_name = s.service_name
    WHERE sc.is_active = TRUE
    AND (s.api_key IS NULL OR s.is_active = FALSE OR (s.expires_at IS NOT NULL AND s.expires_at < NOW()));
    
    RETURN COALESCE(missing, '{}'::TEXT[]);
END;
$$;

COMMENT ON TABLE api_secrets IS 'Secure storage for API keys and secrets';
COMMENT ON TABLE service_configurations IS 'Service endpoint and authentication configurations';
COMMENT ON VIEW service_credentials IS 'Combined view of services with their credentials';
COMMENT ON FUNCTION get_service_credentials IS 'Get complete configuration for a service including API key';
COMMENT ON FUNCTION get_all_service_credentials IS 'Get all active service configurations with API keys';
COMMENT ON FUNCTION has_valid_credentials IS 'Check if a service has valid, non-expired credentials';
COMMENT ON FUNCTION get_missing_credentials IS 'Get list of services missing API keys';