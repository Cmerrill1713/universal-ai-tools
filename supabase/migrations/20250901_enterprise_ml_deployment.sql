-- Enterprise ML Deployment System Tables
-- Migration for comprehensive ML model deployment, versioning, and A/B testing

-- Models table - stores registered ML models
CREATE TABLE IF NOT EXISTS ml_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    description TEXT,
    framework TEXT NOT NULL, -- 'pytorch', 'tensorflow', 'onnx', 'mlx', etc.
    runtime TEXT NOT NULL, -- 'python', 'nodejs', 'rust', 'go', etc.
    model_path TEXT NOT NULL,
    config_path TEXT,
    requirements TEXT[], -- array of dependency requirements
    resources JSONB, -- {'cpu': 2, 'memory': '4GB', 'gpu': 1}
    metadata JSONB, -- flexible metadata storage
    status TEXT NOT NULL DEFAULT 'registered', -- 'registered', 'validated', 'deprecated'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by TEXT, -- user who registered the model
    
    UNIQUE(name, version) -- prevent duplicate model versions
);

-- Deployments table - tracks model deployments
CREATE TABLE IF NOT EXISTS ml_deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES ml_models(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    environment TEXT NOT NULL, -- 'development', 'staging', 'production'
    strategy TEXT NOT NULL, -- 'blue_green', 'canary', 'rolling'
    replicas INTEGER DEFAULT 1,
    resources JSONB, -- resource allocation overrides
    config JSONB, -- deployment-specific configuration
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'deploying', 'healthy', 'unhealthy', 'failed', 'stopped'
    health_check_url TEXT,
    endpoint_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deployed_at TIMESTAMP WITH TIME ZONE,
    stopped_at TIMESTAMP WITH TIME ZONE,
    created_by TEXT,
    
    UNIQUE(name, environment) -- prevent duplicate deployment names per environment
);

-- Deployment History - tracks deployment events and changes
CREATE TABLE IF NOT EXISTS ml_deployment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id UUID NOT NULL REFERENCES ml_deployments(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'created', 'deployed', 'scaled', 'config_updated', 'stopped', 'failed', 'rolled_back'
    previous_status TEXT,
    new_status TEXT NOT NULL,
    details JSONB, -- event-specific details
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by TEXT
);

-- A/B Tests table - manages model comparison experiments
CREATE TABLE IF NOT EXISTS ml_ab_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    control_model_id UUID NOT NULL REFERENCES ml_models(id),
    experiment_model_id UUID NOT NULL REFERENCES ml_models(id),
    traffic_split DECIMAL(3,2) NOT NULL CHECK (traffic_split >= 0 AND traffic_split <= 1), -- 0.1 = 10% to experiment
    metrics TEXT[] NOT NULL, -- metrics to track: ['accuracy', 'latency', 'throughput']
    status TEXT NOT NULL DEFAULT 'created', -- 'created', 'running', 'completed', 'stopped', 'failed'
    duration_hours INTEGER, -- test duration in hours
    config JSONB, -- test-specific configuration
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by TEXT,
    
    -- Ensure different models for control vs experiment
    CHECK (control_model_id != experiment_model_id)
);

-- A/B Test Results - stores test outcomes and statistical analysis
CREATE TABLE IF NOT EXISTS ml_ab_test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES ml_ab_tests(id) ON DELETE CASCADE,
    metric_name TEXT NOT NULL,
    control_value DECIMAL,
    experiment_value DECIMAL,
    sample_size_control INTEGER,
    sample_size_experiment INTEGER,
    statistical_significance DECIMAL(5,4), -- p-value
    confidence_interval JSONB, -- {'lower': 0.1, 'upper': 0.3}
    winner TEXT, -- 'control', 'experiment', 'inconclusive'
    effect_size DECIMAL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(test_id, metric_name) -- one result per metric per test
);

-- Deployment Metrics - time-series data for monitoring
CREATE TABLE IF NOT EXISTS ml_deployment_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id UUID NOT NULL REFERENCES ml_deployments(id) ON DELETE CASCADE,
    metric_name TEXT NOT NULL, -- 'requests_per_second', 'avg_latency', 'error_rate', 'cpu_usage', 'memory_usage'
    metric_value DECIMAL NOT NULL,
    unit TEXT, -- 'rps', 'ms', 'percent', 'bytes'
    tags JSONB, -- additional metric tags
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Index for time-series queries
    INDEX idx_deployment_metrics_time (deployment_id, metric_name, timestamp DESC)
);

-- Health Checks - track deployment health over time
CREATE TABLE IF NOT EXISTS ml_deployment_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id UUID NOT NULL REFERENCES ml_deployments(id) ON DELETE CASCADE,
    status TEXT NOT NULL, -- 'healthy', 'unhealthy', 'unknown'
    response_time_ms INTEGER,
    status_code INTEGER,
    error_message TEXT,
    checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Index for latest health status queries
    INDEX idx_deployment_health_latest (deployment_id, checked_at DESC)
);

-- Model Versions - track model evolution and relationships
CREATE TABLE IF NOT EXISTS ml_model_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES ml_models(id) ON DELETE CASCADE,
    parent_version_id UUID REFERENCES ml_model_versions(id), -- for tracking version lineage
    version_number INTEGER NOT NULL,
    version_name TEXT, -- semantic version like "1.2.3" or custom name
    changes TEXT[], -- list of changes in this version
    performance_metrics JSONB, -- benchmark results
    approval_status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    approved_by TEXT,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(model_id, version_number)
);

-- Deployment Environments - manage environment configurations
CREATE TABLE IF NOT EXISTS ml_environments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE, -- 'development', 'staging', 'production'
    description TEXT,
    config JSONB, -- environment-specific settings
    resource_limits JSONB, -- default resource limits
    approval_required BOOLEAN DEFAULT false, -- require approval for deployments
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default environments
INSERT INTO ml_environments (name, description, config, resource_limits, approval_required)
VALUES 
    ('development', 'Development environment for testing', '{"auto_scale": false}', '{"cpu": 1, "memory": "2GB"}', false),
    ('staging', 'Pre-production environment', '{"auto_scale": true, "max_replicas": 3}', '{"cpu": 2, "memory": "4GB"}', true),
    ('production', 'Production environment', '{"auto_scale": true, "max_replicas": 10, "monitoring": true}', '{"cpu": 4, "memory": "8GB"}', true)
ON CONFLICT (name) DO NOTHING;

-- Alerts and Notifications
CREATE TABLE IF NOT EXISTS ml_deployment_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id UUID NOT NULL REFERENCES ml_deployments(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL, -- 'health_check_failed', 'high_error_rate', 'resource_limit_exceeded', 'deployment_failed'
    severity TEXT NOT NULL, -- 'low', 'medium', 'high', 'critical'
    message TEXT NOT NULL,
    details JSONB,
    status TEXT DEFAULT 'active', -- 'active', 'acknowledged', 'resolved'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    acknowledged_by TEXT,
    resolved_by TEXT,
    
    INDEX idx_deployment_alerts_status (deployment_id, status, created_at DESC)
);

-- Functions for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_ml_models_updated_at BEFORE UPDATE ON ml_models
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_ml_deployments_updated_at BEFORE UPDATE ON ml_deployments
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_ml_ab_tests_updated_at BEFORE UPDATE ON ml_ab_tests
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_ml_environments_updated_at BEFORE UPDATE ON ml_environments
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE ml_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_deployment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_ab_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_deployment_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_deployment_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_model_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_deployment_alerts ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (can be customized based on authentication needs)
-- Allow authenticated users to read all models and deployments
CREATE POLICY "Allow authenticated read access" ON ml_models FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON ml_deployments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON ml_deployment_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON ml_ab_tests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON ml_ab_test_results FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON ml_deployment_metrics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON ml_deployment_health FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON ml_model_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON ml_deployment_alerts FOR SELECT TO authenticated USING (true);

-- Allow service role full access for API operations
CREATE POLICY "Allow service role full access" ON ml_models FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role full access" ON ml_deployments FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role full access" ON ml_deployment_history FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role full access" ON ml_ab_tests FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role full access" ON ml_ab_test_results FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role full access" ON ml_deployment_metrics FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role full access" ON ml_deployment_health FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role full access" ON ml_model_versions FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role full access" ON ml_deployment_alerts FOR ALL TO service_role USING (true);

-- Comments for documentation
COMMENT ON TABLE ml_models IS 'Registry of ML models available for deployment';
COMMENT ON TABLE ml_deployments IS 'Active and historical model deployments';
COMMENT ON TABLE ml_deployment_history IS 'Audit log of deployment events and changes';
COMMENT ON TABLE ml_ab_tests IS 'A/B testing experiments between different models';
COMMENT ON TABLE ml_ab_test_results IS 'Statistical results and analysis from A/B tests';
COMMENT ON TABLE ml_deployment_metrics IS 'Time-series performance metrics for deployments';
COMMENT ON TABLE ml_deployment_health IS 'Health check results and status history';
COMMENT ON TABLE ml_model_versions IS 'Version control and lineage tracking for models';
COMMENT ON TABLE ml_environments IS 'Deployment environment configurations and policies';
COMMENT ON TABLE ml_deployment_alerts IS 'Alerts and notifications for deployment issues';

-- Create indexes for common query patterns
CREATE INDEX idx_ml_models_status ON ml_models(status, created_at DESC);
CREATE INDEX idx_ml_models_framework ON ml_models(framework);
CREATE INDEX idx_ml_deployments_status ON ml_deployments(status, updated_at DESC);
CREATE INDEX idx_ml_deployments_environment ON ml_deployments(environment, status);
CREATE INDEX idx_ml_ab_tests_status ON ml_ab_tests(status, created_at DESC);
CREATE INDEX idx_deployment_history_type ON ml_deployment_history(deployment_id, event_type, created_at DESC);

-- Create a view for deployment overview with model information
CREATE VIEW ml_deployment_overview AS
SELECT 
    d.id as deployment_id,
    d.name as deployment_name,
    d.environment,
    d.status as deployment_status,
    d.replicas,
    d.endpoint_url,
    d.created_at as deployed_at,
    m.id as model_id,
    m.name as model_name,
    m.version as model_version,
    m.framework,
    m.runtime,
    CASE 
        WHEN h.status IS NULL THEN 'unknown'
        ELSE h.status
    END as health_status,
    h.checked_at as last_health_check
FROM ml_deployments d
JOIN ml_models m ON d.model_id = m.id
LEFT JOIN LATERAL (
    SELECT status, checked_at
    FROM ml_deployment_health
    WHERE deployment_id = d.id
    ORDER BY checked_at DESC
    LIMIT 1
) h ON true
WHERE d.status != 'stopped';

COMMENT ON VIEW ml_deployment_overview IS 'Comprehensive view of active deployments with model and health information';