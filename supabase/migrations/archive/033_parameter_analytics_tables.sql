-- Parameter Analytics Tables
-- Comprehensive tracking of parameter effectiveness and optimization

-- Parameter Executions Table - Detailed execution tracking
CREATE TABLE IF NOT EXISTS parameter_executions (
    id TEXT PRIMARY KEY,
    task_type TEXT NOT NULL,
    user_input TEXT NOT NULL,
    parameters JSONB NOT NULL,
    model TEXT NOT NULL,
    provider TEXT NOT NULL,
    user_id UUID,
    request_id TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    
    -- Execution Metrics
    execution_time INTEGER NOT NULL, -- milliseconds
    token_usage JSONB NOT NULL, -- {prompt_tokens, completion_tokens, total_tokens}
    
    -- Quality Metrics  
    response_length INTEGER NOT NULL,
    response_quality REAL, -- 0-1 score
    user_satisfaction INTEGER, -- 0-5 rating
    user_feedback TEXT,
    
    -- Outcome Metrics
    success BOOLEAN NOT NULL DEFAULT FALSE,
    error_type TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Context
    complexity TEXT CHECK (complexity IN ('simple', 'medium', 'complex')),
    domain TEXT,
    endpoint TEXT NOT NULL,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Parameter Effectiveness Aggregates - Pre-computed analytics
CREATE TABLE IF NOT EXISTS parameter_effectiveness (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_type TEXT NOT NULL,
    parameter_set TEXT NOT NULL, -- Hash of parameter combination
    parameters JSONB NOT NULL,
    
    -- Aggregate Metrics
    total_executions INTEGER NOT NULL DEFAULT 0,
    success_rate REAL NOT NULL DEFAULT 0,
    avg_execution_time REAL NOT NULL DEFAULT 0,
    avg_token_usage REAL NOT NULL DEFAULT 0,
    avg_response_quality REAL NOT NULL DEFAULT 0,
    avg_user_satisfaction REAL NOT NULL DEFAULT 0,
    
    -- Performance Trends
    quality_trend REAL DEFAULT 0, -- Positive = improving
    speed_trend REAL DEFAULT 0,
    cost_efficiency_trend REAL DEFAULT 0,
    
    -- Statistical Confidence
    confidence_score REAL NOT NULL DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(task_type, parameter_set)
);

-- Parameter Optimization Insights - Generated recommendations
CREATE TABLE IF NOT EXISTS parameter_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_type TEXT NOT NULL,
    insight TEXT NOT NULL,
    recommendation TEXT NOT NULL,
    impact TEXT CHECK (impact IN ('high', 'medium', 'low')) NOT NULL,
    confidence REAL NOT NULL,
    
    -- Supporting Data
    sample_size INTEGER NOT NULL,  
    improvement_percent REAL NOT NULL,
    current_metric REAL NOT NULL,
    optimized_metric REAL NOT NULL,
    
    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'implemented')),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Parameter Preferences - Personalized settings
CREATE TABLE IF NOT EXISTS user_parameter_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    task_type TEXT NOT NULL,
    
    -- Preference Settings
    preferred_temperature REAL,
    preferred_max_tokens INTEGER,
    preferred_length TEXT CHECK (preferred_length IN ('concise', 'detailed', 'comprehensive')),
    writing_style TEXT CHECK (writing_style IN ('formal', 'casual', 'technical')),
    creativity TEXT CHECK (creativity IN ('conservative', 'balanced', 'creative')),
    
    -- Learning Data
    satisfaction_history JSONB DEFAULT '[]', -- Array of satisfaction scores
    usage_frequency INTEGER DEFAULT 0,
    last_used TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, task_type)
);

-- A/B Testing Experiments - Parameter optimization experiments
CREATE TABLE IF NOT EXISTS parameter_experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    task_type TEXT NOT NULL,
    
    -- Experiment Configuration
    control_parameters JSONB NOT NULL,
    test_parameters JSONB NOT NULL,
    traffic_split REAL NOT NULL DEFAULT 0.5, -- 0.0 to 1.0
    
    -- Status
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'completed', 'paused')),
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    
    -- Results
    control_executions INTEGER DEFAULT 0,
    test_executions INTEGER DEFAULT 0,
    control_success_rate REAL DEFAULT 0,
    test_success_rate REAL DEFAULT 0,
    statistical_significance REAL DEFAULT 0,
    winner TEXT CHECK (winner IN ('control', 'test', 'inconclusive')),
    
    -- Metadata
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance Dashboards - Pre-computed dashboard metrics
CREATE TABLE IF NOT EXISTS parameter_dashboard_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_date DATE NOT NULL,
    
    -- Overall Metrics
    total_executions INTEGER NOT NULL DEFAULT 0,
    success_rate REAL NOT NULL DEFAULT 0,
    avg_response_time REAL NOT NULL DEFAULT 0,
    total_tokens_used BIGINT NOT NULL DEFAULT 0,
    
    -- Task Performance
    task_performance JSONB NOT NULL DEFAULT '{}', -- {task_type: {success_rate, avg_time, etc}}
    
    -- Top Performers
    top_performing_tasks JSONB NOT NULL DEFAULT '[]',
    worst_performing_tasks JSONB NOT NULL DEFAULT '[]',
    
    -- Trends
    quality_trend REAL DEFAULT 0,
    speed_trend REAL DEFAULT 0,
    usage_trend REAL DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(metric_date)
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_parameter_executions_task_type ON parameter_executions(task_type);
CREATE INDEX IF NOT EXISTS idx_parameter_executions_timestamp ON parameter_executions(timestamp);
CREATE INDEX IF NOT EXISTS idx_parameter_executions_user_id ON parameter_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_parameter_executions_success ON parameter_executions(success);
CREATE INDEX IF NOT EXISTS idx_parameter_executions_model ON parameter_executions(model);

CREATE INDEX IF NOT EXISTS idx_parameter_effectiveness_task_type ON parameter_effectiveness(task_type);
CREATE INDEX IF NOT EXISTS idx_parameter_effectiveness_confidence ON parameter_effectiveness(confidence_score);
CREATE INDEX IF NOT EXISTS idx_parameter_effectiveness_updated ON parameter_effectiveness(last_updated);

CREATE INDEX IF NOT EXISTS idx_parameter_insights_task_type ON parameter_insights(task_type);
CREATE INDEX IF NOT EXISTS idx_parameter_insights_impact ON parameter_insights(impact);
CREATE INDEX IF NOT EXISTS idx_parameter_insights_status ON parameter_insights(status);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_parameter_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_task_type ON user_parameter_preferences(task_type);

CREATE INDEX IF NOT EXISTS idx_experiments_status ON parameter_experiments(status);
CREATE INDEX IF NOT EXISTS idx_experiments_task_type ON parameter_experiments(task_type);

-- Views for Common Queries

-- Real-time Parameter Performance View
CREATE OR REPLACE VIEW parameter_performance_realtime AS
SELECT 
    pe.task_type,
    pe.model,
    COUNT(*) as total_executions,
    AVG(CASE WHEN pe.success THEN 1.0 ELSE 0.0 END) as success_rate,
    AVG(pe.execution_time) as avg_execution_time,
    AVG((pe.token_usage->>'total_tokens')::integer) as avg_token_usage,
    AVG(pe.response_quality) as avg_response_quality,
    AVG(pe.user_satisfaction) as avg_user_satisfaction,
    MAX(pe.timestamp) as last_execution
FROM parameter_executions pe
WHERE pe.timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY pe.task_type, pe.model
ORDER BY success_rate DESC, avg_execution_time ASC;

-- Parameter Optimization Opportunities View  
CREATE OR REPLACE VIEW parameter_optimization_opportunities AS
SELECT 
    pf.task_type,
    pf.parameters,
    pf.success_rate,
    pf.avg_execution_time,
    pf.confidence_score,
    CASE 
        WHEN pf.success_rate < 0.8 THEN 'success_rate'
        WHEN pf.avg_execution_time > 5000 THEN 'response_time'
        WHEN pf.avg_user_satisfaction < 3.0 THEN 'user_satisfaction'
        ELSE 'optimization_complete'
    END as optimization_priority
FROM parameter_effectiveness pf
WHERE pf.total_executions >= 10
  AND pf.confidence_score >= 0.5
ORDER BY 
    CASE 
        WHEN pf.success_rate < 0.8 THEN 3
        WHEN pf.avg_execution_time > 5000 THEN 2
        WHEN pf.avg_user_satisfaction < 3.0 THEN 1
        ELSE 0
    END DESC;

-- Functions for Analytics

-- Function to calculate parameter effectiveness score
CREATE OR REPLACE FUNCTION calculate_parameter_score(
    success_rate REAL,
    avg_execution_time REAL,
    avg_response_quality REAL,
    avg_user_satisfaction REAL
) RETURNS REAL AS $$
BEGIN
    RETURN (
        success_rate * 0.4 +
        GREATEST(0, (1 - avg_execution_time / 10000.0)) * 0.2 +
        COALESCE(avg_response_quality, 0) * 0.2 +
        COALESCE(avg_user_satisfaction / 5.0, 0) * 0.2
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update parameter effectiveness aggregates
CREATE OR REPLACE FUNCTION update_parameter_effectiveness() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO parameter_effectiveness (
        task_type,
        parameter_set,
        parameters,
        total_executions,
        success_rate,
        avg_execution_time,
        avg_token_usage,
        avg_response_quality,
        avg_user_satisfaction,
        confidence_score
    ) VALUES (
        NEW.task_type,
        encode(sha256(NEW.parameters::text::bytea), 'hex'),
        NEW.parameters,
        1,
        CASE WHEN NEW.success THEN 1.0 ELSE 0.0 END,
        NEW.execution_time,
        (NEW.token_usage->>'total_tokens')::integer,
        COALESCE(NEW.response_quality, 0),
        COALESCE(NEW.user_satisfaction, 0),
        0.1
    )
    ON CONFLICT (task_type, parameter_set) DO UPDATE SET
        total_executions = parameter_effectiveness.total_executions + 1,
        success_rate = (
            parameter_effectiveness.success_rate * parameter_effectiveness.total_executions + 
            CASE WHEN NEW.success THEN 1.0 ELSE 0.0 END
        ) / (parameter_effectiveness.total_executions + 1),
        avg_execution_time = (
            parameter_effectiveness.avg_execution_time * parameter_effectiveness.total_executions + 
            NEW.execution_time
        ) / (parameter_effectiveness.total_executions + 1),
        avg_token_usage = (
            parameter_effectiveness.avg_token_usage * parameter_effectiveness.total_executions + 
            (NEW.token_usage->>'total_tokens')::integer
        ) / (parameter_effectiveness.total_executions + 1),
        avg_response_quality = (
            parameter_effectiveness.avg_response_quality * parameter_effectiveness.total_executions + 
            COALESCE(NEW.response_quality, 0)
        ) / (parameter_effectiveness.total_executions + 1),
        avg_user_satisfaction = (
            parameter_effectiveness.avg_user_satisfaction * parameter_effectiveness.total_executions + 
            COALESCE(NEW.user_satisfaction, 0)
        ) / (parameter_effectiveness.total_executions + 1),
        confidence_score = LEAST(0.95, (parameter_effectiveness.total_executions + 1) / 100.0),
        last_updated = NOW(),
        updated_at = NOW();
        
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update effectiveness aggregates
CREATE TRIGGER trigger_update_parameter_effectiveness
    AFTER INSERT OR UPDATE ON parameter_executions
    FOR EACH ROW
    EXECUTE FUNCTION update_parameter_effectiveness();

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE parameter_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE parameter_effectiveness ENABLE ROW LEVEL SECURITY;
ALTER TABLE parameter_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_parameter_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE parameter_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE parameter_dashboard_metrics ENABLE ROW LEVEL SECURITY;

-- Service role can access all data
CREATE POLICY "Service role full access on parameter_executions" ON parameter_executions
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on parameter_effectiveness" ON parameter_effectiveness
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on parameter_insights" ON parameter_insights
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on user_parameter_preferences" ON user_parameter_preferences
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on parameter_experiments" ON parameter_experiments
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on parameter_dashboard_metrics" ON parameter_dashboard_metrics
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Users can only see their own parameter data (when authenticated)
CREATE POLICY "Users can view own parameter executions" ON parameter_executions
    FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can view own parameter preferences" ON user_parameter_preferences
    FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Anonymous users can view aggregated effectiveness data (no personal info)
CREATE POLICY "Anonymous can view parameter effectiveness" ON parameter_effectiveness
    FOR SELECT TO anon USING (true);

CREATE POLICY "Anonymous can view parameter insights" ON parameter_insights
    FOR SELECT TO anon USING (true);

-- Comments for Documentation
COMMENT ON TABLE parameter_executions IS 'Detailed tracking of every parameter execution with outcomes';
COMMENT ON TABLE parameter_effectiveness IS 'Pre-computed aggregates of parameter performance by task type';
COMMENT ON TABLE parameter_insights IS 'Generated optimization insights and recommendations';
COMMENT ON TABLE user_parameter_preferences IS 'Personalized parameter preferences per user and task type';
COMMENT ON TABLE parameter_experiments IS 'A/B testing experiments for parameter optimization';
COMMENT ON TABLE parameter_dashboard_metrics IS 'Daily aggregated metrics for dashboard performance';

COMMENT ON VIEW parameter_performance_realtime IS 'Real-time parameter performance metrics for the last 24 hours';
COMMENT ON VIEW parameter_optimization_opportunities IS 'Identifies parameters that need optimization';

COMMENT ON FUNCTION calculate_parameter_score IS 'Calculates weighted performance score for parameter sets';
COMMENT ON FUNCTION update_parameter_effectiveness IS 'Auto-updates effectiveness aggregates when new executions are recorded';