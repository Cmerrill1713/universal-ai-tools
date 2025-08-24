-- Create agent executions table for tracking execution history
-- Migration: 002_create_agent_executions_table.sql

-- Create the agent_executions table
CREATE TABLE IF NOT EXISTS agent_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_id UUID NOT NULL UNIQUE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    agent_name VARCHAR(255) NOT NULL,
    success BOOLEAN NOT NULL,
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    execution_time_ms BIGINT NOT NULL,
    resource_usage JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT agent_executions_execution_time_non_negative CHECK (execution_time_ms >= 0)
);

-- Create indexes for efficient queries
CREATE INDEX idx_agent_executions_agent_id ON agent_executions(agent_id);
CREATE INDEX idx_agent_executions_execution_id ON agent_executions(execution_id);
CREATE INDEX idx_agent_executions_agent_name ON agent_executions(agent_name);
CREATE INDEX idx_agent_executions_success ON agent_executions(success);
CREATE INDEX idx_agent_executions_executed_at ON agent_executions(executed_at DESC);
CREATE INDEX idx_agent_executions_execution_time ON agent_executions(execution_time_ms DESC);

-- Create composite indexes for common queries
CREATE INDEX idx_agent_executions_agent_success ON agent_executions(agent_id, success);
CREATE INDEX idx_agent_executions_agent_time ON agent_executions(agent_id, executed_at DESC);
CREATE INDEX idx_agent_executions_success_time ON agent_executions(success, executed_at DESC);

-- Create partial indexes for failed executions
CREATE INDEX idx_agent_executions_failures ON agent_executions(agent_id, executed_at DESC) WHERE success = false;
CREATE INDEX idx_agent_executions_errors ON agent_executions(agent_id, error_message) WHERE error_message IS NOT NULL;

-- Create function to cleanup old execution records
CREATE OR REPLACE FUNCTION cleanup_old_executions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
    retention_days INTEGER := COALESCE((SELECT value FROM system_config WHERE key = 'execution_retention_days')::INTEGER, 30);
BEGIN
    DELETE FROM agent_executions 
    WHERE executed_at < NOW() - INTERVAL '1 day' * retention_days;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ language 'plpgsql';

-- Create function to get agent execution statistics
CREATE OR REPLACE FUNCTION get_agent_execution_stats(agent_uuid UUID, days_back INTEGER DEFAULT 7)
RETURNS TABLE (
    total_executions BIGINT,
    successful_executions BIGINT,
    failed_executions BIGINT,
    avg_execution_time_ms DOUBLE PRECISION,
    p95_execution_time_ms DOUBLE PRECISION,
    error_rate DOUBLE PRECISION,
    executions_per_day DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_executions,
        COUNT(*) FILTER (WHERE success = true)::BIGINT as successful_executions,
        COUNT(*) FILTER (WHERE success = false)::BIGINT as failed_executions,
        AVG(execution_time_ms) as avg_execution_time_ms,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms) as p95_execution_time_ms,
        (COUNT(*) FILTER (WHERE success = false)::DOUBLE PRECISION / GREATEST(COUNT(*), 1)) as error_rate,
        (COUNT(*)::DOUBLE PRECISION / GREATEST(days_back, 1)) as executions_per_day
    FROM agent_executions
    WHERE agent_id = agent_uuid
      AND executed_at >= NOW() - INTERVAL '1 day' * days_back;
END;
$$ language 'plpgsql';

-- Create function to get system-wide execution statistics
CREATE OR REPLACE FUNCTION get_system_execution_stats(days_back INTEGER DEFAULT 7)
RETURNS TABLE (
    total_agents BIGINT,
    active_agents BIGINT,
    total_executions BIGINT,
    successful_executions BIGINT,
    failed_executions BIGINT,
    avg_execution_time_ms DOUBLE PRECISION,
    p95_execution_time_ms DOUBLE PRECISION,
    error_rate DOUBLE PRECISION,
    executions_per_day DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*)::BIGINT FROM agents) as total_agents,
        (SELECT COUNT(*)::BIGINT FROM agents WHERE status = '"active"'::jsonb) as active_agents,
        COUNT(*)::BIGINT as total_executions,
        COUNT(*) FILTER (WHERE success = true)::BIGINT as successful_executions,
        COUNT(*) FILTER (WHERE success = false)::BIGINT as failed_executions,
        AVG(execution_time_ms) as avg_execution_time_ms,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms) as p95_execution_time_ms,
        (COUNT(*) FILTER (WHERE success = false)::DOUBLE PRECISION / GREATEST(COUNT(*), 1)) as error_rate,
        (COUNT(*)::DOUBLE PRECISION / GREATEST(days_back, 1)) as executions_per_day
    FROM agent_executions
    WHERE executed_at >= NOW() - INTERVAL '1 day' * days_back;
END;
$$ language 'plpgsql';

-- Create materialized view for agent performance metrics
CREATE MATERIALIZED VIEW agent_performance_metrics AS
SELECT 
    a.id as agent_id,
    a.name as agent_name,
    a.agent_type,
    a.status,
    COUNT(ae.id) as total_executions,
    COUNT(ae.id) FILTER (WHERE ae.success = true) as successful_executions,
    COUNT(ae.id) FILTER (WHERE ae.success = false) as failed_executions,
    COALESCE(AVG(ae.execution_time_ms), 0) as avg_execution_time_ms,
    COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ae.execution_time_ms), 0) as p95_execution_time_ms,
    CASE 
        WHEN COUNT(ae.id) = 0 THEN 0
        ELSE COUNT(ae.id) FILTER (WHERE ae.success = false)::DOUBLE PRECISION / COUNT(ae.id)
    END as error_rate,
    MAX(ae.executed_at) as last_execution,
    a.health_score,
    a.updated_at
FROM agents a
LEFT JOIN agent_executions ae ON a.id = ae.agent_id 
    AND ae.executed_at >= NOW() - INTERVAL '7 days'
GROUP BY a.id, a.name, a.agent_type, a.status, a.health_score, a.updated_at;

-- Create unique index on materialized view
CREATE UNIQUE INDEX idx_agent_performance_metrics_agent_id ON agent_performance_metrics(agent_id);
CREATE INDEX idx_agent_performance_metrics_error_rate ON agent_performance_metrics(error_rate DESC);
CREATE INDEX idx_agent_performance_metrics_avg_time ON agent_performance_metrics(avg_execution_time_ms DESC);
CREATE INDEX idx_agent_performance_metrics_health_score ON agent_performance_metrics(health_score DESC);

-- Create function to refresh performance metrics
CREATE OR REPLACE FUNCTION refresh_agent_performance_metrics()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY agent_performance_metrics;
END;
$$ language 'plpgsql';

-- Create system configuration table
CREATE TABLE IF NOT EXISTS system_config (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default configuration values
INSERT INTO system_config (key, value, description) VALUES
    ('execution_retention_days', '30', 'Number of days to retain execution history'),
    ('max_executions_per_agent', '10000', 'Maximum executions to track per agent'),
    ('performance_metrics_refresh_interval', '300', 'Interval in seconds to refresh performance metrics'),
    ('cleanup_interval_hours', '24', 'Interval in hours to run cleanup tasks')
ON CONFLICT (key) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE agent_executions IS 'Historical record of all agent executions with performance metrics';
COMMENT ON COLUMN agent_executions.execution_id IS 'Unique identifier for the execution instance';
COMMENT ON COLUMN agent_executions.agent_id IS 'Reference to the agent that was executed';
COMMENT ON COLUMN agent_executions.agent_name IS 'Snapshot of agent name at execution time';
COMMENT ON COLUMN agent_executions.success IS 'Whether the execution completed successfully';
COMMENT ON COLUMN agent_executions.input_data IS 'Input data provided to the agent (JSON)';
COMMENT ON COLUMN agent_executions.output_data IS 'Output data returned by the agent (JSON)';
COMMENT ON COLUMN agent_executions.error_message IS 'Error message if execution failed';
COMMENT ON COLUMN agent_executions.execution_time_ms IS 'Total execution time in milliseconds';
COMMENT ON COLUMN agent_executions.resource_usage IS 'Resource usage metrics during execution (JSON)';
COMMENT ON COLUMN agent_executions.metadata IS 'Additional execution metadata (JSON)';
COMMENT ON COLUMN agent_executions.executed_at IS 'Timestamp when the execution occurred';

COMMENT ON MATERIALIZED VIEW agent_performance_metrics IS 'Pre-computed performance metrics for all agents';
COMMENT ON TABLE system_config IS 'System-wide configuration parameters';