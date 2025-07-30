-- Meta-Learning Layer Tables
-- This migration creates the infrastructure for meta-learning coordination

-- Learning Domains
CREATE TABLE IF NOT EXISTS ai_learning_domains (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    performance JSONB NOT NULL DEFAULT '{
        "tasksCompleted": 0,
        "successRate": 0,
        "averageTime": 0,
        "improvementRate": 0,
        "lastUpdated": null
    }'::jsonb,
    knowledge JSONB NOT NULL DEFAULT '{
        "patterns": [],
        "rules": [],
        "experienceCount": 0,
        "transferableInsights": []
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Learning Strategies
CREATE TABLE IF NOT EXISTS ai_learning_strategies (
    id VARCHAR(255) PRIMARY KEY,
    domain_id VARCHAR(255) REFERENCES ai_learning_domains(id),
    type VARCHAR(50) NOT NULL CHECK (type IN ('evolution', 'reinforcement', 'supervised', 'unsupervised')),
    parameters JSONB NOT NULL,
    effectiveness NUMERIC(3,2) DEFAULT 0.5,
    success_rate NUMERIC(3,2) DEFAULT 0.5,
    last_used TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Learning Tasks
CREATE TABLE IF NOT EXISTS ai_learning_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    input JSONB NOT NULL,
    expected_output JSONB,
    constraints JSONB,
    priority NUMERIC(3,2) DEFAULT 0.5,
    deadline TIMESTAMPTZ,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Learning Outcomes
CREATE TABLE IF NOT EXISTS ai_learning_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES ai_learning_tasks(id),
    success BOOLEAN NOT NULL,
    actual_output JSONB,
    performance JSONB,
    lessons_learned JSONB,
    strategies_used TEXT[],
    time_elapsed INTEGER, -- milliseconds
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meta Insights
CREATE TABLE IF NOT EXISTS ai_meta_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL CHECK (type IN ('pattern', 'strategy', 'optimization', 'architecture')),
    source TEXT[] NOT NULL,
    insight JSONB NOT NULL,
    applicability TEXT[],
    confidence NUMERIC(3,2) DEFAULT 0.5,
    validated BOOLEAN DEFAULT false,
    impact NUMERIC(3,2) DEFAULT 0.5,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    validated_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Meta Parameters
CREATE TABLE IF NOT EXISTS ai_meta_parameters (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'current',
    strategy_weights JSONB NOT NULL DEFAULT '{}'::jsonb,
    domain_transfer_matrix JSONB NOT NULL DEFAULT '{}'::jsonb,
    adaptation_rates JSONB NOT NULL DEFAULT '{}'::jsonb,
    exploration_bonuses JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Domain Transfer History
CREATE TABLE IF NOT EXISTS ai_domain_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_domain VARCHAR(255) NOT NULL,
    target_domain VARCHAR(255) NOT NULL,
    insight_type VARCHAR(50) NOT NULL,
    insight_data JSONB NOT NULL,
    transfer_score NUMERIC(3,2),
    adaptation_method VARCHAR(100),
    success BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Consolidation History
CREATE TABLE IF NOT EXISTS ai_consolidation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patterns_analyzed INTEGER,
    insights_generated INTEGER,
    knowledge_pruned INTEGER,
    parameters_updated JSONB,
    duration_ms INTEGER,
    status VARCHAR(50) DEFAULT 'completed',
    error_details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cross-System Patterns
CREATE TABLE IF NOT EXISTS ai_cross_system_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source VARCHAR(100) NOT NULL,
    pattern_type VARCHAR(100) NOT NULL,
    pattern_data JSONB NOT NULL,
    frequency INTEGER DEFAULT 1,
    confidence NUMERIC(3,2) DEFAULT 0.5,
    systems_involved TEXT[],
    discovered_at TIMESTAMPTZ DEFAULT NOW(),
    last_observed TIMESTAMPTZ DEFAULT NOW()
);

-- Learning Progress Metrics
CREATE TABLE IF NOT EXISTS ai_learning_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id VARCHAR(255) REFERENCES ai_learning_domains(id),
    metric_type VARCHAR(50) NOT NULL,
    metric_value NUMERIC,
    comparison_period VARCHAR(50), -- 'daily', 'weekly', 'monthly'
    improvement_percentage NUMERIC(5,2),
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_strategies_domain ON ai_learning_strategies(domain_id);
CREATE INDEX idx_strategies_effectiveness ON ai_learning_strategies(effectiveness DESC);
CREATE INDEX idx_tasks_domain_status ON ai_learning_tasks(domain, status);
CREATE INDEX idx_tasks_priority ON ai_learning_tasks(priority DESC, created_at);
CREATE INDEX idx_outcomes_task ON ai_learning_outcomes(task_id);
CREATE INDEX idx_outcomes_success ON ai_learning_outcomes(success, created_at DESC);
CREATE INDEX idx_insights_type ON ai_meta_insights(type, confidence DESC);
CREATE INDEX idx_insights_validated ON ai_meta_insights(validated, impact DESC);
CREATE INDEX idx_transfers_domains ON ai_domain_transfers(source_domain, target_domain);
CREATE INDEX idx_progress_domain_time ON ai_learning_progress(domain_id, recorded_at DESC);

-- Functions for analytics
CREATE OR REPLACE FUNCTION calculate_domain_performance(p_domain_id VARCHAR)
RETURNS TABLE(
    success_rate NUMERIC,
    avg_task_time NUMERIC,
    improvement_trend NUMERIC,
    strategy_effectiveness JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH recent_outcomes AS (
        SELECT 
            o.success,
            o.time_elapsed,
            o.strategies_used,
            o.created_at
        FROM ai_learning_outcomes o
        JOIN ai_learning_tasks t ON t.id = o.task_id
        WHERE t.domain = p_domain_id
        AND o.created_at > NOW() - INTERVAL '30 days'
    ),
    strategy_stats AS (
        SELECT 
            s.id as strategy_id,
            s.effectiveness,
            COUNT(DISTINCT o.task_id) as usage_count
        FROM ai_learning_strategies s
        LEFT JOIN ai_learning_outcomes o ON s.id = ANY(o.strategies_used)
        WHERE s.domain_id = p_domain_id
        GROUP BY s.id, s.effectiveness
    )
    SELECT 
        COALESCE(AVG(CASE WHEN success THEN 1 ELSE 0 END) * 100, 0) as success_rate,
        COALESCE(AVG(time_elapsed), 0) as avg_task_time,
        COALESCE(
            (SELECT improvement_percentage 
             FROM ai_learning_progress 
             WHERE domain_id = p_domain_id 
             ORDER BY recorded_at DESC 
             LIMIT 1), 0
        ) as improvement_trend,
        COALESCE(
            jsonb_object_agg(
                strategy_id, 
                jsonb_build_object(
                    'effectiveness', effectiveness,
                    'usage_count', usage_count
                )
            ), '{}'::jsonb
        ) as strategy_effectiveness
    FROM recent_outcomes
    CROSS JOIN strategy_stats
    GROUP BY strategy_effectiveness;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate knowledge transfer success
CREATE OR REPLACE FUNCTION calculate_transfer_success(
    p_source_domain VARCHAR,
    p_target_domain VARCHAR,
    p_days INTEGER DEFAULT 30
)
RETURNS NUMERIC AS $$
DECLARE
    v_success_rate NUMERIC;
BEGIN
    SELECT 
        CASE 
            WHEN COUNT(*) = 0 THEN 0.5
            ELSE AVG(CASE WHEN success THEN 1 ELSE 0 END)
        END INTO v_success_rate
    FROM ai_domain_transfers
    WHERE source_domain = p_source_domain
    AND target_domain = p_target_domain
    AND created_at > NOW() - (p_days || ' days')::INTERVAL;
    
    RETURN COALESCE(v_success_rate, 0.5);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update domain performance
CREATE OR REPLACE FUNCTION update_domain_performance()
RETURNS TRIGGER AS $$
BEGIN
    -- Update domain performance when outcome is recorded
    UPDATE ai_learning_domains
    SET performance = jsonb_build_object(
        'tasksCompleted', (performance->>'tasksCompleted')::int + 1,
        'successRate', (
            SELECT AVG(CASE WHEN o.success THEN 1 ELSE 0 END)
            FROM ai_learning_outcomes o
            JOIN ai_learning_tasks t ON t.id = o.task_id
            WHERE t.domain = (
                SELECT domain FROM ai_learning_tasks WHERE id = NEW.task_id
            )
        ),
        'averageTime', (
            SELECT AVG(o.time_elapsed)
            FROM ai_learning_outcomes o
            JOIN ai_learning_tasks t ON t.id = o.task_id
            WHERE t.domain = (
                SELECT domain FROM ai_learning_tasks WHERE id = NEW.task_id
            )
        ),
        'improvementRate', COALESCE((performance->>'improvementRate')::numeric, 0),
        'lastUpdated', NOW()
    ),
    updated_at = NOW()
    WHERE id = (SELECT domain FROM ai_learning_tasks WHERE id = NEW.task_id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_domain_performance
AFTER INSERT ON ai_learning_outcomes
FOR EACH ROW
EXECUTE FUNCTION update_domain_performance();

-- Row Level Security
ALTER TABLE ai_learning_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_learning_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_learning_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_learning_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_meta_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_meta_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_domain_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_consolidation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cross_system_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_learning_progress ENABLE ROW LEVEL SECURITY;

-- Policies (adjust based on your auth strategy)
CREATE POLICY "Enable read for authenticated users" ON ai_meta_insights FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for service role" ON ai_meta_insights FOR ALL USING (auth.role() = 'service_role');

-- Initial domain data
INSERT INTO ai_learning_domains (id, name, description) VALUES
    ('code-optimization', 'Code Optimization', 'Optimizing code performance, readability, and maintainability'),
    ('agent-behavior', 'Agent Behavior Optimization', 'Improving agent decision-making and performance'),
    ('architecture-evolution', 'System Architecture Evolution', 'Evolving system architecture for better scalability and performance')
ON CONFLICT (id) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE ai_learning_domains IS 'Domains of learning for the meta-learning system';
COMMENT ON TABLE ai_learning_strategies IS 'Strategies available for each learning domain';
COMMENT ON TABLE ai_learning_tasks IS 'Tasks submitted to the meta-learning system';
COMMENT ON TABLE ai_learning_outcomes IS 'Results of learning task execution';
COMMENT ON TABLE ai_meta_insights IS 'High-level insights discovered by meta-learning';
COMMENT ON TABLE ai_meta_parameters IS 'Global parameters for meta-learning optimization';
COMMENT ON TABLE ai_domain_transfers IS 'History of knowledge transfer between domains';
COMMENT ON TABLE ai_consolidation_history IS 'History of knowledge consolidation cycles';
COMMENT ON TABLE ai_cross_system_patterns IS 'Patterns discovered across multiple systems';
COMMENT ON TABLE ai_learning_progress IS 'Progress metrics for each learning domain';