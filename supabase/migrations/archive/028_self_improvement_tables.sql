-- Self-Improvement System Tables
-- This migration creates the infrastructure for agent self-improvement, learning, and evolution

-- Agent Performance History
CREATE TABLE IF NOT EXISTS ai_agent_performance_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(255) NOT NULL,
    task_id UUID,
    task_type VARCHAR(100),
    input_context JSONB,
    output_result JSONB,
    success BOOLEAN NOT NULL,
    execution_time_ms INTEGER,
    resource_usage JSONB, -- {cpu: %, memory: bytes, tokens: count}
    error_details TEXT,
    confidence_score NUMERIC(3,2),
    user_satisfaction NUMERIC(3,2), -- 0-1 scale, null if not measured
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Improvement Suggestions
CREATE TABLE IF NOT EXISTS ai_improvement_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(255) NOT NULL,
    suggestion_type VARCHAR(50) NOT NULL, -- 'strategy', 'parameter', 'code', 'behavior'
    current_approach JSONB,
    suggested_approach JSONB,
    expected_improvement NUMERIC(5,2), -- Percentage improvement expected
    confidence NUMERIC(3,2),
    based_on_patterns JSONB, -- Array of pattern IDs that led to this suggestion
    status VARCHAR(50) DEFAULT 'proposed', -- 'proposed', 'testing', 'applied', 'rejected'
    test_results JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    applied_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT
);

-- Code Evolution History
CREATE TABLE IF NOT EXISTS ai_code_evolutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(255) NOT NULL,
    evolution_type VARCHAR(50) NOT NULL, -- 'optimization', 'refactor', 'feature', 'fix'
    original_code TEXT,
    evolved_code TEXT,
    diff_summary JSONB,
    performance_before JSONB,
    performance_after JSONB,
    improvement_metrics JSONB, -- {speed: %, accuracy: %, resource_efficiency: %}
    generation_method VARCHAR(100), -- 'llm', 'genetic', 'rule-based', 'hybrid'
    parent_evolution_id UUID REFERENCES ai_code_evolutions(id),
    status VARCHAR(50) DEFAULT 'proposed', -- 'proposed', 'testing', 'deployed', 'reverted'
    deployed_at TIMESTAMPTZ,
    reverted_at TIMESTAMPTZ,
    revert_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Learning Patterns
CREATE TABLE IF NOT EXISTS ai_learning_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_name VARCHAR(255) NOT NULL,
    pattern_type VARCHAR(50) NOT NULL, -- 'success', 'failure', 'optimization'
    agent_ids TEXT[], -- Agents that exhibit this pattern
    context_conditions JSONB, -- Conditions when pattern appears
    outcome_metrics JSONB,
    frequency INTEGER DEFAULT 1,
    confidence NUMERIC(3,2),
    discovered_at TIMESTAMPTZ DEFAULT NOW(),
    last_observed_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Feedback Data
CREATE TABLE IF NOT EXISTS ai_feedback_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(255) NOT NULL,
    task_id UUID,
    feedback_type VARCHAR(50) NOT NULL, -- 'explicit', 'implicit', 'automated'
    feedback_value JSONB, -- Can be rating, text, or structured data
    context JSONB,
    source VARCHAR(100), -- 'user', 'system', 'agent', 'external'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Learning Milestones
CREATE TABLE IF NOT EXISTS ai_learning_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(255),
    milestone_type VARCHAR(100) NOT NULL,
    milestone_name VARCHAR(255) NOT NULL,
    achievement_criteria JSONB,
    achieved_at TIMESTAMPTZ DEFAULT NOW(),
    metrics_at_achievement JSONB,
    reward_applied JSONB, -- Any rewards/adjustments made
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Strategy Evolution
CREATE TABLE IF NOT EXISTS ai_strategy_evolution (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(255) NOT NULL,
    strategy_name VARCHAR(255) NOT NULL,
    strategy_version INTEGER NOT NULL DEFAULT 1,
    parameters JSONB NOT NULL,
    parent_strategy_id UUID REFERENCES ai_strategy_evolution(id),
    mutation_type VARCHAR(50), -- 'crossover', 'mutation', 'optimization'
    fitness_score NUMERIC(5,2),
    evaluation_metrics JSONB,
    active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    activated_at TIMESTAMPTZ,
    deactivated_at TIMESTAMPTZ
);

-- Experience Repository
CREATE TABLE IF NOT EXISTS ai_experience_repository (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(255) NOT NULL,
    experience_type VARCHAR(50) NOT NULL, -- 'success', 'failure', 'edge_case'
    task_context JSONB NOT NULL,
    actions_taken JSONB NOT NULL,
    outcome JSONB NOT NULL,
    lessons_learned JSONB,
    reusability_score NUMERIC(3,2),
    times_referenced INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ,
    embedding vector(1536) -- For similarity search
);

-- Indexes for performance
CREATE INDEX idx_performance_agent_created ON ai_agent_performance_history(agent_id, created_at DESC);
CREATE INDEX idx_performance_success ON ai_agent_performance_history(success, created_at DESC);
CREATE INDEX idx_suggestions_agent_status ON ai_improvement_suggestions(agent_id, status);
CREATE INDEX idx_evolutions_agent_status ON ai_code_evolutions(agent_id, status);
CREATE INDEX idx_patterns_type_confidence ON ai_learning_patterns(pattern_type, confidence DESC);
CREATE INDEX idx_feedback_agent_created ON ai_feedback_data(agent_id, created_at DESC);
CREATE INDEX idx_milestones_agent ON ai_learning_milestones(agent_id, achieved_at DESC);
CREATE INDEX idx_strategy_agent_active ON ai_strategy_evolution(agent_id, active);
CREATE INDEX idx_experience_agent ON ai_experience_repository(agent_id, created_at DESC);
CREATE INDEX idx_experience_embedding ON ai_experience_repository USING ivfflat (embedding vector_cosine_ops);

-- Functions for analytics
CREATE OR REPLACE FUNCTION calculate_agent_improvement_rate(p_agent_id VARCHAR, p_days INTEGER DEFAULT 30)
RETURNS TABLE(
    improvement_rate NUMERIC,
    success_rate_change NUMERIC,
    avg_execution_time_change NUMERIC,
    total_improvements_applied INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH recent_performance AS (
        SELECT 
            AVG(CASE WHEN success THEN 1 ELSE 0 END) as success_rate,
            AVG(execution_time_ms) as avg_execution_time,
            COUNT(*) as total_tasks
        FROM ai_agent_performance_history
        WHERE agent_id = p_agent_id
        AND created_at > NOW() - INTERVAL '7 days'
    ),
    past_performance AS (
        SELECT 
            AVG(CASE WHEN success THEN 1 ELSE 0 END) as success_rate,
            AVG(execution_time_ms) as avg_execution_time,
            COUNT(*) as total_tasks
        FROM ai_agent_performance_history
        WHERE agent_id = p_agent_id
        AND created_at BETWEEN NOW() - (p_days || ' days')::INTERVAL AND NOW() - INTERVAL '7 days'
    ),
    improvements AS (
        SELECT COUNT(*) as applied_count
        FROM ai_improvement_suggestions
        WHERE agent_id = p_agent_id
        AND status = 'applied'
        AND applied_at > NOW() - (p_days || ' days')::INTERVAL
    )
    SELECT 
        COALESCE(((r.success_rate - p.success_rate) / NULLIF(p.success_rate, 0)) * 100, 0) as improvement_rate,
        COALESCE(r.success_rate - p.success_rate, 0) as success_rate_change,
        COALESCE(p.avg_execution_time - r.avg_execution_time, 0) as avg_execution_time_change,
        COALESCE(i.applied_count, 0) as total_improvements_applied
    FROM recent_performance r
    CROSS JOIN past_performance p
    CROSS JOIN improvements i;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update pattern frequencies
CREATE OR REPLACE FUNCTION update_pattern_frequency()
RETURNS TRIGGER AS $$
BEGIN
    -- Update frequency count for patterns when new performance data matches
    UPDATE ai_learning_patterns
    SET frequency = frequency + 1,
        last_observed_at = NOW()
    WHERE id IN (
        SELECT pattern_id 
        FROM jsonb_array_elements_text(NEW.metadata->'matching_patterns') AS pattern_id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_pattern_frequency
AFTER INSERT ON ai_agent_performance_history
FOR EACH ROW
WHEN (NEW.metadata ? 'matching_patterns')
EXECUTE FUNCTION update_pattern_frequency();

-- Row Level Security
ALTER TABLE ai_agent_performance_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_improvement_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_code_evolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_learning_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_feedback_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_learning_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_strategy_evolution ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_experience_repository ENABLE ROW LEVEL SECURITY;

-- Policies (adjust based on your auth strategy)
CREATE POLICY "Enable read for authenticated users" ON ai_agent_performance_history FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable insert for service role" ON ai_agent_performance_history FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Enable update for service role" ON ai_agent_performance_history FOR UPDATE USING (auth.role() = 'service_role');

-- Comments for documentation
COMMENT ON TABLE ai_agent_performance_history IS 'Tracks detailed performance metrics for each agent execution';
COMMENT ON TABLE ai_improvement_suggestions IS 'Stores AI-generated suggestions for agent improvements';
COMMENT ON TABLE ai_code_evolutions IS 'History of code changes generated by the self-improvement system';
COMMENT ON TABLE ai_learning_patterns IS 'Discovered patterns in agent behavior and performance';
COMMENT ON TABLE ai_feedback_data IS 'User and system feedback for agent actions';
COMMENT ON TABLE ai_learning_milestones IS 'Significant achievements in agent learning and evolution';
COMMENT ON TABLE ai_strategy_evolution IS 'Evolution history of agent strategies using genetic algorithms';
COMMENT ON TABLE ai_experience_repository IS 'Stored experiences for cross-agent learning';