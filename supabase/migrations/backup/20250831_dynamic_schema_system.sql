-- =====================================================
-- Dynamic Schema System Migration
-- Enables runtime schema management with JSONB validation
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =====================================================
-- 1. DYNAMIC SCHEMAS TABLE
-- =====================================================

-- Store schema definitions
CREATE TABLE IF NOT EXISTS dynamic_schemas (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '1.0.0',
    fields JSONB NOT NULL, -- Array of field definitions
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_version CHECK (version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
    CONSTRAINT valid_fields CHECK (jsonb_typeof(fields) = 'array')
);

-- =====================================================
-- 2. DYNAMIC DATA TABLE (Generic storage)
-- =====================================================

-- Store dynamic data instances
CREATE TABLE IF NOT EXISTS dynamic_data (
    id TEXT PRIMARY KEY DEFAULT 'instance_' || extract(epoch from now()) || '_' || substr(md5(random()::text), 1, 9),
    schema_id TEXT NOT NULL,
    data JSONB NOT NULL,
    validated BOOLEAN DEFAULT false,
    validation_errors TEXT[],
    user_id UUID, -- References auth.users when available
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key to schemas
    CONSTRAINT fk_dynamic_data_schema FOREIGN KEY (schema_id) REFERENCES dynamic_schemas(id) ON DELETE CASCADE
);

-- =====================================================
-- 3. SPECIALIZED DYNAMIC TABLES
-- =====================================================

-- Agent configurations with dynamic schemas
CREATE TABLE IF NOT EXISTS agent_dynamic_configs (
    id TEXT PRIMARY KEY DEFAULT 'config_' || extract(epoch from now()) || '_' || substr(md5(random()::text), 1, 9),
    agent_name TEXT NOT NULL,
    schema_id TEXT NOT NULL,
    config_data JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    validated BOOLEAN DEFAULT false,
    validation_errors TEXT[],
    user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_agent_config_schema FOREIGN KEY (schema_id) REFERENCES dynamic_schemas(id) ON DELETE CASCADE
);

-- User preferences with dynamic schemas
CREATE TABLE IF NOT EXISTS user_dynamic_preferences (
    id TEXT PRIMARY KEY DEFAULT 'pref_' || extract(epoch from now()) || '_' || substr(md5(random()::text), 1, 9),
    user_id UUID NOT NULL,
    schema_id TEXT NOT NULL,
    preference_data JSONB NOT NULL,
    validated BOOLEAN DEFAULT false,
    validation_errors TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_user_pref_schema FOREIGN KEY (schema_id) REFERENCES dynamic_schemas(id) ON DELETE CASCADE,
    CONSTRAINT unique_user_schema UNIQUE (user_id, schema_id)
);

-- API schemas for dynamic endpoint validation
CREATE TABLE IF NOT EXISTS api_dynamic_schemas (
    id TEXT PRIMARY KEY DEFAULT 'api_' || extract(epoch from now()) || '_' || substr(md5(random()::text), 1, 9),
    endpoint_name TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'POST',
    schema_id TEXT NOT NULL,
    request_schema JSONB,
    response_schema JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_api_schema FOREIGN KEY (schema_id) REFERENCES dynamic_schemas(id) ON DELETE CASCADE,
    CONSTRAINT valid_method CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH'))
);

-- =====================================================
-- 4. INDEXES FOR PERFORMANCE
-- =====================================================

-- Dynamic schemas indexes
CREATE INDEX IF NOT EXISTS idx_dynamic_schemas_name ON dynamic_schemas (name);
CREATE INDEX IF NOT EXISTS idx_dynamic_schemas_created ON dynamic_schemas (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dynamic_schemas_metadata ON dynamic_schemas USING gin(metadata);

-- Dynamic data indexes
CREATE INDEX IF NOT EXISTS idx_dynamic_data_schema ON dynamic_data (schema_id);
CREATE INDEX IF NOT EXISTS idx_dynamic_data_validated ON dynamic_data (validated);
CREATE INDEX IF NOT EXISTS idx_dynamic_data_user ON dynamic_data (user_id);
CREATE INDEX IF NOT EXISTS idx_dynamic_data_created ON dynamic_data (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dynamic_data_data ON dynamic_data USING gin(data);

-- Agent configs indexes
CREATE INDEX IF NOT EXISTS idx_agent_configs_name ON agent_dynamic_configs (agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_configs_active ON agent_dynamic_configs (is_active);
CREATE INDEX IF NOT EXISTS idx_agent_configs_user ON agent_dynamic_configs (user_id);
CREATE INDEX IF NOT EXISTS idx_agent_configs_data ON agent_dynamic_configs USING gin(config_data);

-- User preferences indexes
CREATE INDEX IF NOT EXISTS idx_user_prefs_user ON user_dynamic_preferences (user_id);
CREATE INDEX IF NOT EXISTS idx_user_prefs_schema ON user_dynamic_preferences (schema_id);
CREATE INDEX IF NOT EXISTS idx_user_prefs_data ON user_dynamic_preferences USING gin(preference_data);

-- API schemas indexes
CREATE INDEX IF NOT EXISTS idx_api_schemas_endpoint ON api_dynamic_schemas (endpoint_name);
CREATE INDEX IF NOT EXISTS idx_api_schemas_active ON api_dynamic_schemas (is_active);
CREATE INDEX IF NOT EXISTS idx_api_schemas_method ON api_dynamic_schemas (method);

-- =====================================================
-- 5. FUNCTIONS
-- =====================================================

-- Validate JSON data against a schema
CREATE OR REPLACE FUNCTION validate_dynamic_data(
    schema_fields JSONB,
    data_to_validate JSONB
)
RETURNS TABLE (
    is_valid BOOLEAN,
    errors TEXT[]
)
LANGUAGE plpgsql
AS $$
DECLARE
    field_def JSONB;
    field_name TEXT;
    field_type TEXT;
    field_required BOOLEAN;
    data_value JSONB;
    validation_errors TEXT[] := '{}';
BEGIN
    -- Iterate through schema fields
    FOR field_def IN SELECT jsonb_array_elements(schema_fields)
    LOOP
        field_name := field_def->>'name';
        field_type := field_def->>'type';
        field_required := COALESCE((field_def->>'required')::boolean, false);
        data_value := data_to_validate->field_name;
        
        -- Check if required field is missing
        IF field_required AND data_value IS NULL THEN
            validation_errors := array_append(validation_errors, 
                format('Field "%s" is required but missing', field_name));
            CONTINUE;
        END IF;
        
        -- Skip validation if field is not present and not required
        IF data_value IS NULL THEN
            CONTINUE;
        END IF;
        
        -- Type validation
        CASE field_type
            WHEN 'string' THEN
                IF jsonb_typeof(data_value) != 'string' THEN
                    validation_errors := array_append(validation_errors,
                        format('Field "%s" must be a string', field_name));
                END IF;
            WHEN 'number' THEN
                IF jsonb_typeof(data_value) NOT IN ('number') THEN
                    validation_errors := array_append(validation_errors,
                        format('Field "%s" must be a number', field_name));
                END IF;
            WHEN 'boolean' THEN
                IF jsonb_typeof(data_value) != 'boolean' THEN
                    validation_errors := array_append(validation_errors,
                        format('Field "%s" must be a boolean', field_name));
                END IF;
            WHEN 'array' THEN
                IF jsonb_typeof(data_value) != 'array' THEN
                    validation_errors := array_append(validation_errors,
                        format('Field "%s" must be an array', field_name));
                END IF;
            WHEN 'object' THEN
                IF jsonb_typeof(data_value) != 'object' THEN
                    validation_errors := array_append(validation_errors,
                        format('Field "%s" must be an object', field_name));
                END IF;
        END CASE;
    END LOOP;
    
    -- Return validation result
    RETURN QUERY SELECT 
        array_length(validation_errors, 1) IS NULL OR array_length(validation_errors, 1) = 0,
        validation_errors;
END;
$$;

-- Get schema statistics
CREATE OR REPLACE FUNCTION get_schema_stats(schema_id_param TEXT)
RETURNS TABLE (
    total_instances BIGINT,
    validated_instances BIGINT,
    validation_rate NUMERIC,
    last_updated TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_instances,
        COUNT(*) FILTER (WHERE validated = true) as validated_instances,
        ROUND(
            (COUNT(*) FILTER (WHERE validated = true)::NUMERIC / 
            NULLIF(COUNT(*), 0)::NUMERIC) * 100, 2
        ) as validation_rate,
        MAX(updated_at) as last_updated
    FROM dynamic_data
    WHERE schema_id = schema_id_param;
END;
$$;

-- Search dynamic data with JSONB queries
CREATE OR REPLACE FUNCTION search_dynamic_data(
    schema_id_param TEXT DEFAULT NULL,
    search_query JSONB DEFAULT NULL,
    limit_count INTEGER DEFAULT 50,
    offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
    id TEXT,
    schema_id TEXT,
    data JSONB,
    validated BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dd.id,
        dd.schema_id,
        dd.data,
        dd.validated,
        dd.created_at
    FROM dynamic_data dd
    WHERE 
        (schema_id_param IS NULL OR dd.schema_id = schema_id_param)
        AND (search_query IS NULL OR dd.data @> search_query)
    ORDER BY dd.created_at DESC
    LIMIT limit_count
    OFFSET offset_count;
END;
$$;

-- =====================================================
-- 6. TRIGGERS
-- =====================================================

-- Update timestamp trigger (reuse existing function)
DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOR table_name IN 
        SELECT unnest(ARRAY[
            'dynamic_schemas',
            'dynamic_data', 
            'agent_dynamic_configs',
            'user_dynamic_preferences',
            'api_dynamic_schemas'
        ])
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS update_%I_updated_at ON %I;
            CREATE TRIGGER update_%I_updated_at 
                BEFORE UPDATE ON %I 
                FOR EACH ROW 
                EXECUTE FUNCTION update_updated_at_column();',
            table_name, table_name, table_name, table_name
        );
    END LOOP;
END $$;

-- Auto-validation trigger for dynamic_data
CREATE OR REPLACE FUNCTION auto_validate_dynamic_data()
RETURNS TRIGGER AS $$
DECLARE
    schema_fields JSONB;
    validation_result RECORD;
BEGIN
    -- Get schema fields
    SELECT fields INTO schema_fields
    FROM dynamic_schemas 
    WHERE id = NEW.schema_id;
    
    IF schema_fields IS NOT NULL THEN
        -- Validate the data
        SELECT * INTO validation_result
        FROM validate_dynamic_data(schema_fields, NEW.data);
        
        -- Update validation status
        NEW.validated := validation_result.is_valid;
        NEW.validation_errors := validation_result.errors;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply auto-validation trigger
DROP TRIGGER IF EXISTS trigger_auto_validate_dynamic_data ON dynamic_data;
CREATE TRIGGER trigger_auto_validate_dynamic_data
    BEFORE INSERT OR UPDATE ON dynamic_data
    FOR EACH ROW
    EXECUTE FUNCTION auto_validate_dynamic_data();

-- =====================================================
-- 7. ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on user-specific tables
ALTER TABLE dynamic_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_dynamic_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_dynamic_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies (only when auth schema exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
        -- Dynamic data policies
        CREATE POLICY "Users can view their own dynamic data" ON dynamic_data
            FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

        CREATE POLICY "Users can create their own dynamic data" ON dynamic_data
            FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

        CREATE POLICY "Users can update their own dynamic data" ON dynamic_data
            FOR UPDATE USING (auth.uid() = user_id);

        -- Agent config policies
        CREATE POLICY "Users can view their agent configs" ON agent_dynamic_configs
            FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

        CREATE POLICY "Users can create agent configs" ON agent_dynamic_configs
            FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

        CREATE POLICY "Users can update their agent configs" ON agent_dynamic_configs
            FOR UPDATE USING (auth.uid() = user_id);

        -- User preferences policies
        CREATE POLICY "Users can view their own preferences" ON user_dynamic_preferences
            FOR SELECT USING (auth.uid() = user_id);

        CREATE POLICY "Users can create their own preferences" ON user_dynamic_preferences
            FOR INSERT WITH CHECK (auth.uid() = user_id);

        CREATE POLICY "Users can update their own preferences" ON user_dynamic_preferences
            FOR UPDATE USING (auth.uid() = user_id);
    END IF;
END $$;

-- =====================================================
-- 8. INITIAL DATA
-- =====================================================

-- Create default schemas
INSERT INTO dynamic_schemas (id, name, version, fields, metadata) VALUES
(
    'default_agent_config',
    'Default Agent Configuration',
    '1.0.0',
    '[
        {"name": "model", "type": "string", "required": true, "description": "LLM model to use"},
        {"name": "temperature", "type": "number", "default": 0.7, "description": "Model temperature"},
        {"name": "maxTokens", "type": "number", "default": 2048, "description": "Maximum tokens"},
        {"name": "capabilities", "type": "array", "default": [], "description": "Agent capabilities"},
        {"name": "memory", "type": "boolean", "default": true, "description": "Enable memory"}
    ]'::jsonb,
    '{"category": "agent_config", "default": true}'::jsonb
),
(
    'default_user_preferences',
    'Default User Preferences',
    '1.0.0',
    '[
        {"name": "theme", "type": "string", "default": "dark", "description": "UI theme preference"},
        {"name": "notifications", "type": "object", "default": {"email": true, "push": false}, "description": "Notification settings"},
        {"name": "defaultModel", "type": "string", "default": "ollama:llama3.2:3b", "description": "Default LLM model"},
        {"name": "maxConcurrentTasks", "type": "number", "default": 3, "description": "Maximum concurrent tasks"}
    ]'::jsonb,
    '{"category": "user_preferences", "default": true}'::jsonb
),
(
    'api_request_schema',
    'Generic API Request Schema',
    '1.0.0',
    '[
        {"name": "endpoint", "type": "string", "required": true, "description": "API endpoint"},
        {"name": "method", "type": "string", "default": "POST", "description": "HTTP method"},
        {"name": "headers", "type": "object", "default": {}, "description": "Request headers"},
        {"name": "payload", "type": "object", "description": "Request payload"},
        {"name": "timeout", "type": "number", "default": 30000, "description": "Request timeout in ms"}
    ]'::jsonb,
    '{"category": "api_schema", "default": true}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

COMMENT ON TABLE dynamic_schemas IS 'Stores schema definitions for runtime validation';
COMMENT ON TABLE dynamic_data IS 'Generic storage for dynamic data instances';
COMMENT ON TABLE agent_dynamic_configs IS 'Agent configurations with dynamic schemas';
COMMENT ON TABLE user_dynamic_preferences IS 'User preferences with dynamic schemas';
COMMENT ON TABLE api_dynamic_schemas IS 'API endpoint schemas for dynamic validation';

-- Create performance monitoring view
CREATE VIEW IF NOT EXISTS dynamic_schema_performance AS
SELECT 
    ds.id,
    ds.name,
    ds.version,
    COUNT(dd.id) as total_instances,
    COUNT(dd.id) FILTER (WHERE dd.validated = true) as validated_instances,
    ROUND(
        (COUNT(dd.id) FILTER (WHERE dd.validated = true)::NUMERIC / 
        NULLIF(COUNT(dd.id), 0)::NUMERIC) * 100, 2
    ) as validation_rate,
    MAX(dd.updated_at) as last_instance_update,
    ds.created_at as schema_created
FROM dynamic_schemas ds
LEFT JOIN dynamic_data dd ON ds.id = dd.schema_id
GROUP BY ds.id, ds.name, ds.version, ds.created_at
ORDER BY total_instances DESC, validation_rate DESC;