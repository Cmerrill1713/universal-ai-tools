-- API Versioning Support
-- Tracks API version usage and deprecations

-- Create API versions table
CREATE TABLE IF NOT EXISTS api_versions (
    version VARCHAR(10) PRIMARY KEY,
    active BOOLEAN DEFAULT true,
    deprecated BOOLEAN DEFAULT false,
    deprecation_date TIMESTAMP,
    sunset_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    changes TEXT[],
    minimum_client_version VARCHAR(20),
    maximum_client_version VARCHAR(20)
);

-- Create API version usage tracking
CREATE TABLE IF NOT EXISTS api_version_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version VARCHAR(10) NOT NULL REFERENCES api_versions(version),
    service_id UUID, -- Removed reference to non-existent ai_services table
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    request_count INTEGER DEFAULT 1,
    last_used TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(version, service_id, endpoint, method)
);

-- Create version migration guide
CREATE TABLE IF NOT EXISTS api_version_migrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_version VARCHAR(10) NOT NULL REFERENCES api_versions(version),
    to_version VARCHAR(10) NOT NULL REFERENCES api_versions(version),
    migration_type VARCHAR(50) NOT NULL, -- breaking, backward_compatible, deprecated
    endpoint VARCHAR(255),
    old_format JSONB,
    new_format JSONB,
    migration_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert initial version
INSERT INTO api_versions (version, active, deprecated, changes) VALUES
    ('v1', true, false, ARRAY[
        'Initial API version',
        'All endpoints available under /api/v1/',
        'Full feature set including tools, memory, context, knowledge, orchestration, and speech'
    ])
ON CONFLICT (version) DO NOTHING;

-- Create function to track API version usage
CREATE OR REPLACE FUNCTION track_api_version_usage(
    p_version VARCHAR(10),
    p_service_id UUID,
    p_endpoint VARCHAR(255),
    p_method VARCHAR(10)
) RETURNS void AS $$
BEGIN
    INSERT INTO api_version_usage (version, service_id, endpoint, method)
    VALUES (p_version, p_service_id, p_endpoint, p_method)
    ON CONFLICT (version, service_id, endpoint, method)
    DO UPDATE SET 
        request_count = api_version_usage.request_count + 1,
        last_used = NOW();
END;
$$ LANGUAGE plpgsql;

-- Create function to check version deprecation
CREATE OR REPLACE FUNCTION check_api_version_status(p_version VARCHAR(10))
RETURNS TABLE(
    is_active BOOLEAN,
    is_deprecated BOOLEAN,
    deprecation_warning TEXT,
    sunset_date TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.active,
        v.deprecated,
        CASE 
            WHEN v.deprecated THEN 
                format('API version %s is deprecated and will be sunset on %s', 
                       v.version, v.sunset_date::TEXT)
            ELSE NULL
        END,
        v.sunset_date
    FROM api_versions v
    WHERE v.version = p_version;
END;
$$ LANGUAGE plpgsql;

-- Create view for version usage analytics
CREATE OR REPLACE VIEW api_version_analytics AS
SELECT 
    v.version,
    v.active,
    v.deprecated,
    v.sunset_date,
    COUNT(DISTINCT u.service_id) as unique_services,
    SUM(u.request_count) as total_requests,
    MAX(u.last_used) as last_activity,
    COUNT(DISTINCT u.endpoint) as unique_endpoints
FROM api_versions v
LEFT JOIN api_version_usage u ON v.version = u.version
GROUP BY v.version, v.active, v.deprecated, v.sunset_date
ORDER BY v.version DESC;

-- Create view for migration paths
CREATE OR REPLACE VIEW api_migration_paths AS
SELECT 
    m.from_version,
    m.to_version,
    m.migration_type,
    COUNT(*) as endpoint_changes,
    array_agg(DISTINCT m.endpoint) as affected_endpoints
FROM api_version_migrations m
GROUP BY m.from_version, m.to_version, m.migration_type;

-- RLS policies for API version tables
ALTER TABLE api_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_version_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_version_migrations ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "api_versions_read" ON api_versions
    FOR SELECT TO authenticated
    USING (true);

-- Allow services to track their own usage
CREATE POLICY "api_version_usage_insert" ON api_version_usage
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "api_version_usage_read_own" ON api_version_usage
    FOR SELECT TO authenticated
    USING (service_id = auth.uid()::uuid OR service_id IS NULL);

-- Allow read access to migration guides
CREATE POLICY "api_version_migrations_read" ON api_version_migrations
    FOR SELECT TO authenticated
    USING (true);

-- Create indexes for performance
CREATE INDEX idx_api_version_usage_version ON api_version_usage(version);
CREATE INDEX idx_api_version_usage_service ON api_version_usage(service_id);
CREATE INDEX idx_api_version_usage_endpoint ON api_version_usage(endpoint);
CREATE INDEX idx_api_version_usage_last_used ON api_version_usage(last_used);
CREATE INDEX idx_api_version_migrations_versions ON api_version_migrations(from_version, to_version);

-- Create function to deprecate a version
CREATE OR REPLACE FUNCTION deprecate_api_version(
    p_version VARCHAR(10),
    p_sunset_date TIMESTAMP,
    p_migration_notes TEXT DEFAULT NULL
) RETURNS void AS $$
DECLARE
    v_latest_version VARCHAR(10);
BEGIN
    -- Get the latest active version
    SELECT version INTO v_latest_version
    FROM api_versions
    WHERE active = true AND deprecated = false
    ORDER BY version DESC
    LIMIT 1;

    -- Update the version
    UPDATE api_versions
    SET 
        deprecated = true,
        deprecation_date = NOW(),
        sunset_date = p_sunset_date
    WHERE version = p_version;

    -- Log deprecation event
    INSERT INTO ai_tool_executions (
        tool_name,
        service_id,
        input_params,
        output_result,
        status,
        execution_time_ms
    ) VALUES (
        'api_version_deprecation',
        NULL,
        jsonb_build_object(
            'version', p_version,
            'sunset_date', p_sunset_date,
            'migration_notes', p_migration_notes
        ),
        jsonb_build_object(
            'success', true,
            'latest_version', v_latest_version
        ),
        'completed',
        0
    );
END;
$$ LANGUAGE plpgsql;

-- Create function to sunset a version
CREATE OR REPLACE FUNCTION sunset_api_version(p_version VARCHAR(10))
RETURNS void AS $$
BEGIN
    -- Deactivate the version
    UPDATE api_versions
    SET active = false
    WHERE version = p_version;

    -- Log sunset event
    INSERT INTO ai_tool_executions (
        tool_name,
        service_id,
        input_params,
        output_result,
        status,
        execution_time_ms
    ) VALUES (
        'api_version_sunset',
        NULL,
        jsonb_build_object('version', p_version),
        jsonb_build_object('success', true),
        'completed',
        0
    );
END;
$$ LANGUAGE plpgsql;

-- Create scheduled job to sunset deprecated versions (if pg_cron is available)
-- This will run daily at 2 AM to check for versions past their sunset date
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.schedule(
            'sunset-deprecated-api-versions',
            '0 2 * * *',
            $CRON$
            UPDATE api_versions
            SET active = false
            WHERE deprecated = true 
            AND sunset_date < NOW() 
            AND active = true;
            $CRON$
        );
    END IF;
END $$;

-- Grant permissions
GRANT SELECT ON api_versions TO authenticated;
GRANT SELECT, INSERT ON api_version_usage TO authenticated;
GRANT SELECT ON api_version_migrations TO authenticated;
GRANT SELECT ON api_version_analytics TO authenticated;
GRANT SELECT ON api_migration_paths TO authenticated;