-- Backup and Recovery System
-- Automated backup management with encryption and multi-storage support

-- Create backup metadata table
CREATE TABLE IF NOT EXISTS backup_metadata (
    id VARCHAR(255) PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    type VARCHAR(20) NOT NULL CHECK (type IN ('full', 'incremental', 'differential')),
    size BIGINT NOT NULL DEFAULT 0,
    duration INTEGER NOT NULL DEFAULT 0, -- milliseconds
    tables TEXT[] NOT NULL DEFAULT '{}',
    row_count INTEGER NOT NULL DEFAULT 0,
    compressed BOOLEAN NOT NULL DEFAULT true,
    encrypted BOOLEAN NOT NULL DEFAULT true,
    checksum VARCHAR(64) NOT NULL,
    storage TEXT[] NOT NULL DEFAULT '{}', -- ['local', 'supabase', 's3']
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    error TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create backup schedule table
CREATE TABLE IF NOT EXISTS backup_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    schedule VARCHAR(100) NOT NULL, -- cron expression
    backup_type VARCHAR(20) NOT NULL DEFAULT 'full',
    tables TEXT[] NOT NULL DEFAULT '{}',
    retention_policy JSONB NOT NULL DEFAULT '{"daily": 7, "weekly": 4, "monthly": 12}',
    storage_config JSONB NOT NULL DEFAULT '{"local": true, "supabase": true, "s3": false}',
    last_run TIMESTAMP,
    next_run TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create backup storage configuration
CREATE TABLE IF NOT EXISTS backup_storage_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storage_type VARCHAR(50) NOT NULL UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    config JSONB NOT NULL DEFAULT '{}',
    priority INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create restore history table
CREATE TABLE IF NOT EXISTS restore_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_id VARCHAR(255) NOT NULL REFERENCES backup_metadata(id),
    restored_at TIMESTAMP NOT NULL DEFAULT NOW(),
    restored_by UUID REFERENCES auth.users(id),
    tables_restored TEXT[] NOT NULL,
    rows_restored INTEGER NOT NULL DEFAULT 0,
    duration INTEGER NOT NULL DEFAULT 0, -- milliseconds
    target_schema VARCHAR(100),
    dry_run BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(20) NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'partial', 'failed')),
    error TEXT,
    metadata JSONB DEFAULT '{}'
);

-- Create backup statistics view
CREATE OR REPLACE VIEW backup_statistics AS
WITH backup_counts AS (
    SELECT 
        COUNT(*) as total_backups,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_backups,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_backups,
        SUM(size) as total_size,
        SUM(row_count) as total_rows_backed_up,
        AVG(duration)::INTEGER as avg_duration_ms,
        MAX(timestamp) as last_backup,
        MIN(timestamp) as first_backup,
        COUNT(DISTINCT DATE(timestamp)) as unique_backup_days
    FROM backup_metadata
),
type_counts AS (
    SELECT jsonb_object_agg(type, cnt) as backups_by_type
    FROM (
        SELECT type, COUNT(*) as cnt
        FROM backup_metadata
        WHERE status = 'completed'
        GROUP BY type
    ) t
),
storage_counts AS (
    SELECT jsonb_object_agg(storage_type, cnt) as backups_by_storage
    FROM (
        SELECT unnest(storage) as storage_type, COUNT(*) as cnt
        FROM backup_metadata
        WHERE status = 'completed'
        GROUP BY storage_type
    ) s
)
SELECT 
    bc.*,
    tc.backups_by_type,
    sc.backups_by_storage
FROM backup_counts bc
CROSS JOIN type_counts tc
CROSS JOIN storage_counts sc;

-- Create function to schedule backup
CREATE OR REPLACE FUNCTION schedule_backup(
    p_name VARCHAR(255),
    p_schedule VARCHAR(100),
    p_tables TEXT[] DEFAULT NULL,
    p_type VARCHAR(20) DEFAULT 'full'
) RETURNS UUID AS $$
DECLARE
    v_schedule_id UUID;
    v_all_tables TEXT[] := ARRAY[
        'ai_memories',
        'ai_agents',
        'ai_knowledge_base',
        'ai_custom_tools',
        'ai_tool_executions',
        'ai_agent_executions',
        'ai_code_snippets',
        'ai_code_examples',
        'supabase_features',
        'supabase_integration_patterns'
    ];
BEGIN
    -- Use all tables if none specified
    IF p_tables IS NULL THEN
        p_tables := v_all_tables;
    END IF;

    INSERT INTO backup_schedules (
        name,
        schedule,
        backup_type,
        tables,
        next_run
    ) VALUES (
        p_name,
        p_schedule,
        p_type,
        p_tables,
        NOW() -- Will be updated by scheduler
    )
    RETURNING id INTO v_schedule_id;

    -- Schedule with pg_cron
    PERFORM cron.schedule(
        'backup_' || p_name,
        p_schedule,
        format(
            'SELECT create_scheduled_backup(%L, %L, %L)',
            v_schedule_id::TEXT,
            p_type,
            p_tables
        )
    );

    RETURN v_schedule_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to create scheduled backup
CREATE OR REPLACE FUNCTION create_scheduled_backup(
    p_schedule_id TEXT,
    p_type VARCHAR(20),
    p_tables TEXT[]
) RETURNS VARCHAR(255) AS $$
DECLARE
    v_backup_id VARCHAR(255);
BEGIN
    -- Generate backup ID
    v_backup_id := 'backup-' || 
        to_char(NOW(), 'YYYY-MM-DD-HH24-MI-SS') || '-' || 
        substring(gen_random_uuid()::TEXT, 1, 8);

    -- Insert backup metadata
    INSERT INTO backup_metadata (
        id,
        type,
        tables,
        status
    ) VALUES (
        v_backup_id,
        p_type,
        p_tables,
        'pending'
    );

    -- Update schedule last/next run
    UPDATE backup_schedules
    SET 
        last_run = NOW(),
        next_run = NOW() + INTERVAL '1 day' -- Simplified, should parse cron
    WHERE id = p_schedule_id::UUID;

    -- Trigger backup via webhook or edge function
    PERFORM net.http_post(
        url := current_setting('app.settings.backup_webhook_url', true),
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.backup_webhook_token', true)
        ),
        body := jsonb_build_object(
            'backup_id', v_backup_id,
            'type', p_type,
            'tables', p_tables
        )
    );

    RETURN v_backup_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to get backup size estimate
CREATE OR REPLACE FUNCTION estimate_backup_size(
    p_tables TEXT[] DEFAULT NULL
) RETURNS TABLE(
    table_name TEXT,
    row_count BIGINT,
    estimated_size BIGINT,
    total_size BIGINT
) AS $$
DECLARE
    v_table TEXT;
    v_total_size BIGINT := 0;
    v_all_tables TEXT[] := ARRAY[
        'ai_memories',
        'ai_agents',
        'ai_knowledge_base',
        'ai_custom_tools',
        'ai_tool_executions',
        'ai_agent_executions',
        'ai_code_snippets',
        'ai_code_examples',
        'supabase_features',
        'supabase_integration_patterns'
    ];
BEGIN
    -- Use all tables if none specified
    IF p_tables IS NULL THEN
        p_tables := v_all_tables;
    END IF;

    -- Get size estimates for each table
    FOREACH v_table IN ARRAY p_tables
    LOOP
        RETURN QUERY
        SELECT 
            v_table::TEXT,
            COUNT(*)::BIGINT,
            pg_total_relation_size(v_table::regclass)::BIGINT,
            v_total_size + pg_total_relation_size(v_table::regclass)::BIGINT
        FROM information_schema.tables
        WHERE table_name = v_table
        AND table_schema = 'public';
        
        v_total_size := v_total_size + pg_total_relation_size(v_table::regclass);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create function to validate backup
CREATE OR REPLACE FUNCTION validate_backup(
    p_backup_id VARCHAR(255)
) RETURNS TABLE(
    is_valid BOOLEAN,
    validation_errors TEXT[]
) AS $$
DECLARE
    v_metadata RECORD;
    v_errors TEXT[] := '{}';
BEGIN
    -- Get backup metadata
    SELECT * INTO v_metadata
    FROM backup_metadata
    WHERE id = p_backup_id;

    IF NOT FOUND THEN
        v_errors := array_append(v_errors, 'Backup not found');
        RETURN QUERY SELECT false, v_errors;
        RETURN;
    END IF;

    -- Check status
    IF v_metadata.status != 'completed' THEN
        v_errors := array_append(v_errors, 'Backup status is ' || v_metadata.status);
    END IF;

    -- Check size
    IF v_metadata.size = 0 THEN
        v_errors := array_append(v_errors, 'Backup size is 0');
    END IF;

    -- Check storage locations
    IF array_length(v_metadata.storage, 1) = 0 THEN
        v_errors := array_append(v_errors, 'No storage locations recorded');
    END IF;

    -- Check checksum
    IF v_metadata.checksum IS NULL OR length(v_metadata.checksum) != 64 THEN
        v_errors := array_append(v_errors, 'Invalid checksum');
    END IF;

    RETURN QUERY SELECT 
        array_length(v_errors, 1) = 0,
        v_errors;
END;
$$ LANGUAGE plpgsql;

-- Create indexes
CREATE INDEX idx_backup_metadata_timestamp ON backup_metadata(timestamp DESC);
CREATE INDEX idx_backup_metadata_status ON backup_metadata(status);
CREATE INDEX idx_backup_metadata_type ON backup_metadata(type);
CREATE INDEX idx_backup_schedules_enabled ON backup_schedules(enabled);
CREATE INDEX idx_backup_schedules_next_run ON backup_schedules(next_run);
CREATE INDEX idx_restore_history_backup_id ON restore_history(backup_id);
CREATE INDEX idx_restore_history_restored_at ON restore_history(restored_at DESC);

-- Create storage bucket for backups
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
    'backups',
    'backups',
    false,
    false,
    5368709120, -- 5GB
    ARRAY['application/octet-stream', 'application/gzip']
)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies
ALTER TABLE backup_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE restore_history ENABLE ROW LEVEL SECURITY;

-- Only service role can manage backups
CREATE POLICY "Service role can manage backup metadata" ON backup_metadata
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role can manage backup schedules" ON backup_schedules
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role can manage restore history" ON restore_history
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Authenticated users can view backup status
CREATE POLICY "Authenticated users can view backups" ON backup_metadata
    FOR SELECT TO authenticated
    USING (status = 'completed');

CREATE POLICY "Authenticated users can view schedules" ON backup_schedules
    FOR SELECT TO authenticated
    USING (enabled = true);

-- Set up default backup schedules
INSERT INTO backup_schedules (name, schedule, backup_type, enabled) VALUES
    ('daily-full', '0 2 * * *', 'full', true), -- 2 AM daily
    ('weekly-incremental', '0 3 * * 0', 'incremental', false), -- 3 AM Sunday
    ('monthly-archive', '0 4 1 * *', 'full', false) -- 4 AM first of month
ON CONFLICT (name) DO NOTHING;

-- Set up default storage configuration
INSERT INTO backup_storage_config (storage_type, enabled, config, priority) VALUES
    ('local', true, '{"path": "./backups", "compress": true}', 1),
    ('supabase', true, '{"bucket": "backups", "compress": true}', 2),
    ('s3', false, '{"bucket": null, "region": null}', 3)
ON CONFLICT (storage_type) DO NOTHING;

-- Create backup health check function
CREATE OR REPLACE FUNCTION check_backup_health()
RETURNS TABLE(
    health_status VARCHAR(20),
    last_successful_backup TIMESTAMP,
    failed_backups_24h INTEGER,
    storage_availability JSONB,
    recommendations TEXT[]
) AS $$
DECLARE
    v_recommendations TEXT[] := '{}';
    v_storage_status JSONB := '{}';
    v_last_backup TIMESTAMP;
    v_failed_count INTEGER;
BEGIN
    -- Get last successful backup
    SELECT MAX(timestamp) INTO v_last_backup
    FROM backup_metadata
    WHERE status = 'completed';

    -- Count recent failures
    SELECT COUNT(*) INTO v_failed_count
    FROM backup_metadata
    WHERE status = 'failed'
    AND timestamp > NOW() - INTERVAL '24 hours';

    -- Check storage availability
    SELECT jsonb_object_agg(storage_type, enabled)
    INTO v_storage_status
    FROM backup_storage_config;

    -- Generate recommendations
    IF v_last_backup IS NULL OR v_last_backup < NOW() - INTERVAL '48 hours' THEN
        v_recommendations := array_append(v_recommendations, 'No recent backups found - check backup schedules');
    END IF;

    IF v_failed_count > 0 THEN
        v_recommendations := array_append(v_recommendations, format('%s backups failed in last 24 hours', v_failed_count));
    END IF;

    IF NOT (v_storage_status->>'supabase')::BOOLEAN AND NOT (v_storage_status->>'s3')::BOOLEAN THEN
        v_recommendations := array_append(v_recommendations, 'Only local storage enabled - consider enabling remote storage');
    END IF;

    RETURN QUERY SELECT
        CASE 
            WHEN v_last_backup > NOW() - INTERVAL '24 hours' AND v_failed_count = 0 THEN 'healthy'
            WHEN v_last_backup > NOW() - INTERVAL '48 hours' OR v_failed_count < 3 THEN 'warning'
            ELSE 'critical'
        END::VARCHAR(20),
        v_last_backup,
        v_failed_count,
        v_storage_status,
        v_recommendations;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT ON backup_metadata TO authenticated;
GRANT SELECT ON backup_schedules TO authenticated;
GRANT SELECT ON backup_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION check_backup_health() TO authenticated;
GRANT EXECUTE ON FUNCTION estimate_backup_size(TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_backup(VARCHAR) TO authenticated;