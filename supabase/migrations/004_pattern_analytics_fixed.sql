-- Architecture Pattern Analytics and Usage Tracking (Fixed)

-- Table to track pattern usage
CREATE TABLE IF NOT EXISTS pattern_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_id UUID REFERENCES architecture_patterns(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL,
    task_type TEXT NOT NULL,
    context JSONB DEFAULT '{}',
    success BOOLEAN DEFAULT true,
    performance_metrics JSONB DEFAULT '{}',
    error_details TEXT,
    feedback_score FLOAT CHECK (feedback_score >= 0 AND feedback_score <= 1),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_pattern_usage_pattern_id ON pattern_usage_logs (pattern_id);
CREATE INDEX IF NOT EXISTS idx_pattern_usage_created_at ON pattern_usage_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_pattern_usage_success ON pattern_usage_logs (success);
CREATE INDEX IF NOT EXISTS idx_pattern_usage_agent ON pattern_usage_logs (agent_id);

-- Table for pattern effectiveness metrics
CREATE TABLE IF NOT EXISTS pattern_effectiveness (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_id UUID REFERENCES architecture_patterns(id) ON DELETE CASCADE,
    time_period TEXT NOT NULL, -- 'daily', 'weekly', 'monthly'
    period_start TIMESTAMPTZ NOT NULL,
    total_uses INTEGER DEFAULT 0,
    successful_uses INTEGER DEFAULT 0,
    average_performance JSONB DEFAULT '{}',
    common_errors JSONB[] DEFAULT '{}',
    agent_distribution JSONB DEFAULT '{}',
    task_distribution JSONB DEFAULT '{}',
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(pattern_id, time_period, period_start)
);

-- Function to log pattern usage
CREATE OR REPLACE FUNCTION log_pattern_usage(
    p_pattern_id UUID,
    p_agent_id TEXT,
    p_task_type TEXT,
    p_context JSONB DEFAULT '{}',
    p_success BOOLEAN DEFAULT TRUE,
    p_metrics JSONB DEFAULT '{}',
    p_error TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    log_id UUID;
    current_usage INTEGER;
    current_success_rate FLOAT;
BEGIN
    -- Insert usage log
    INSERT INTO pattern_usage_logs (
        pattern_id, agent_id, task_type, context,
        success, performance_metrics, error_details
    ) VALUES (
        p_pattern_id, p_agent_id, p_task_type, p_context,
        p_success, p_metrics, p_error
    ) RETURNING id INTO log_id;
    
    -- Update pattern usage count and success rate
    SELECT usage_count, success_rate INTO current_usage, current_success_rate
    FROM architecture_patterns 
    WHERE id = p_pattern_id;
    
    -- Handle null values
    current_usage := COALESCE(current_usage, 0);
    current_success_rate := COALESCE(current_success_rate, 0.5);
    
    UPDATE architecture_patterns
    SET usage_count = current_usage + 1,
        success_rate = CASE 
            WHEN p_success THEN 
                (current_success_rate * current_usage + 1.0) / (current_usage + 1)
            ELSE 
                (current_success_rate * current_usage) / (current_usage + 1)
        END,
        updated_at = NOW()
    WHERE id = p_pattern_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate pattern effectiveness
CREATE OR REPLACE FUNCTION calculate_pattern_effectiveness(
    p_time_period TEXT DEFAULT 'daily'
) RETURNS void AS $$
DECLARE
    period_interval INTERVAL;
    period_start_time TIMESTAMPTZ;
BEGIN
    -- Determine interval based on period
    CASE p_time_period
        WHEN 'daily' THEN 
            period_interval := INTERVAL '1 day';
            period_start_time := date_trunc('day', NOW());
        WHEN 'weekly' THEN 
            period_interval := INTERVAL '1 week';
            period_start_time := date_trunc('week', NOW());
        WHEN 'monthly' THEN 
            period_interval := INTERVAL '1 month';
            period_start_time := date_trunc('month', NOW());
    END CASE;
    
    -- Calculate effectiveness for each pattern
    INSERT INTO pattern_effectiveness (
        pattern_id, time_period, period_start,
        total_uses, successful_uses, average_performance,
        common_errors, agent_distribution, task_distribution
    )
    SELECT 
        p.pattern_id,
        p_time_period,
        period_start_time,
        COUNT(*) as total_uses,
        COUNT(*) FILTER (WHERE p.success) as successful_uses,
        jsonb_build_object(
            'avg_execution_time', AVG((p.performance_metrics->>'execution_time')::float),
            'avg_tokens_used', AVG((p.performance_metrics->>'tokens_used')::int),
            'avg_memory_used', AVG((p.performance_metrics->>'memory_used')::float)
        ) as average_performance,
        ARRAY_AGG(DISTINCT jsonb_build_object(
            'error', p.error_details,
            'count', COUNT(*) FILTER (WHERE p.error_details IS NOT NULL)
        )) FILTER (WHERE p.error_details IS NOT NULL) as common_errors,
        jsonb_object_agg(p.agent_id, COUNT(*)) as agent_distribution,
        jsonb_object_agg(p.task_type, COUNT(*)) as task_distribution
    FROM pattern_usage_logs p
    WHERE p.created_at >= period_start_time - period_interval
        AND p.created_at < period_start_time
    GROUP BY p.pattern_id
    ON CONFLICT (pattern_id, time_period, period_start) 
    DO UPDATE SET
        total_uses = EXCLUDED.total_uses,
        successful_uses = EXCLUDED.successful_uses,
        average_performance = EXCLUDED.average_performance,
        common_errors = EXCLUDED.common_errors,
        agent_distribution = EXCLUDED.agent_distribution,
        task_distribution = EXCLUDED.task_distribution,
        calculated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- View for pattern performance dashboard
CREATE OR REPLACE VIEW pattern_performance_dashboard AS
SELECT 
    ap.name,
    ap.framework,
    ap.pattern_type,
    ap.usage_count,
    ap.success_rate,
    pe.total_uses as recent_uses,
    pe.successful_uses as recent_successes,
    CASE 
        WHEN pe.total_uses > 0 
        THEN pe.successful_uses::float / pe.total_uses::float 
        ELSE 0 
    END as recent_success_rate,
    pe.average_performance,
    pe.agent_distribution,
    pe.task_distribution,
    ap.created_at,
    ap.updated_at
FROM architecture_patterns ap
LEFT JOIN LATERAL (
    SELECT * FROM pattern_effectiveness
    WHERE pattern_id = ap.id
        AND time_period = 'daily'
    ORDER BY period_start DESC
    LIMIT 1
) pe ON true
ORDER BY ap.usage_count DESC;

-- Create simple table for reranking metrics (if not exists)
CREATE TABLE IF NOT EXISTS reranking_metrics (
    id SERIAL PRIMARY KEY,
    query TEXT,
    model_name TEXT,
    input_count INTEGER,
    output_count INTEGER,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (simplified)
ALTER TABLE pattern_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pattern_effectiveness ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for development
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pattern_usage_logs' AND policyname = 'pattern_usage_all_access') THEN
        CREATE POLICY "pattern_usage_all_access" ON pattern_usage_logs FOR ALL USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pattern_effectiveness' AND policyname = 'pattern_effectiveness_all_access') THEN
        CREATE POLICY "pattern_effectiveness_all_access" ON pattern_effectiveness FOR ALL USING (true);
    END IF;
END $$;

-- Grant permissions
GRANT SELECT ON pattern_performance_dashboard TO PUBLIC;
GRANT INSERT ON pattern_usage_logs TO PUBLIC;
GRANT SELECT ON pattern_effectiveness TO PUBLIC;
GRANT INSERT ON reranking_metrics TO PUBLIC;