-- Self-Modifying Agent Framework Tables
-- This migration creates the infrastructure for agents that can modify their own code

-- Self-Modifying Agents Registry
CREATE TABLE IF NOT EXISTS ai_self_modifying_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    version VARCHAR(50) NOT NULL,
    capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
    code_location TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{
        "author": "system",
        "created": null,
        "lastModified": null,
        "dependencies": [],
        "interfaces": [],
        "testCoverage": 0,
        "complexity": 0
    }'::jsonb,
    performance JSONB NOT NULL DEFAULT '{
        "overallSuccess": 0,
        "adaptationRate": 0,
        "selfImprovementScore": 0,
        "stabilityScore": 1,
        "resourceEfficiency": 0.5
    }'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Capabilities
CREATE TABLE IF NOT EXISTS ai_agent_capabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES ai_self_modifying_agents(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    implementation VARCHAR(255) NOT NULL,
    parameters JSONB DEFAULT '{}'::jsonb,
    performance JSONB NOT NULL DEFAULT '{
        "executionCount": 0,
        "successRate": 0,
        "averageTime": 0,
        "resourceUsage": {},
        "lastUsed": null
    }'::jsonb,
    can_modify BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Modifications
CREATE TABLE IF NOT EXISTS ai_agent_modifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES ai_self_modifying_agents(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('capability', 'optimization', 'bugfix', 'feature', 'refactor')),
    description TEXT NOT NULL,
    changes JSONB NOT NULL, -- Array of code changes
    performance JSONB NOT NULL DEFAULT '{
        "before": {},
        "after": {},
        "improvement": 0,
        "validated": false
    }'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'testing', 'applied', 'reverted')),
    confidence NUMERIC(3,2) DEFAULT 0.5,
    applied_at TIMESTAMPTZ,
    reverted_at TIMESTAMPTZ,
    revert_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Code Changes History
CREATE TABLE IF NOT EXISTS ai_code_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    modification_id UUID REFERENCES ai_agent_modifications(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    start_line INTEGER NOT NULL,
    end_line INTEGER NOT NULL,
    original_code TEXT NOT NULL,
    modified_code TEXT NOT NULL,
    reason TEXT,
    applied BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Performance History
CREATE TABLE IF NOT EXISTS ai_agent_performance_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES ai_self_modifying_agents(id) ON DELETE CASCADE,
    overall_success NUMERIC(3,2),
    adaptation_rate NUMERIC(3,2),
    self_improvement_score NUMERIC(3,2),
    stability_score NUMERIC(3,2),
    resource_efficiency NUMERIC(3,2),
    capability_metrics JSONB,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Modification Strategies
CREATE TABLE IF NOT EXISTS ai_modification_strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    applicability_criteria JSONB NOT NULL,
    parameters JSONB DEFAULT '{}'::jsonb,
    success_rate NUMERIC(3,2) DEFAULT 0.5,
    usage_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safety Check Results
CREATE TABLE IF NOT EXISTS ai_safety_check_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    modification_id UUID REFERENCES ai_agent_modifications(id) ON DELETE CASCADE,
    check_name VARCHAR(255) NOT NULL,
    passed BOOLEAN NOT NULL,
    details JSONB,
    checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Backups
CREATE TABLE IF NOT EXISTS ai_agent_backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES ai_self_modifying_agents(id) ON DELETE CASCADE,
    version VARCHAR(50) NOT NULL,
    code_backup TEXT NOT NULL,
    metadata JSONB,
    reason VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Modification Queue
CREATE TABLE IF NOT EXISTS ai_modification_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    modification_id UUID REFERENCES ai_agent_modifications(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES ai_self_modifying_agents(id) ON DELETE CASCADE,
    priority INTEGER DEFAULT 5,
    scheduled_for TIMESTAMPTZ,
    status VARCHAR(50) DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    error_details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_agents_active ON ai_self_modifying_agents(is_active, created_at DESC);
CREATE INDEX idx_capabilities_agent ON ai_agent_capabilities(agent_id);
CREATE INDEX idx_modifications_agent_status ON ai_agent_modifications(agent_id, status);
CREATE INDEX idx_modifications_type ON ai_agent_modifications(type, confidence DESC);
CREATE INDEX idx_changes_modification ON ai_code_changes(modification_id);
CREATE INDEX idx_performance_agent_time ON ai_agent_performance_snapshots(agent_id, recorded_at DESC);
CREATE INDEX idx_safety_checks_modification ON ai_safety_check_results(modification_id);
CREATE INDEX idx_backups_agent ON ai_agent_backups(agent_id, created_at DESC);
CREATE INDEX idx_queue_status ON ai_modification_queue(status, priority DESC, scheduled_for);

-- Functions for analytics
CREATE OR REPLACE FUNCTION calculate_agent_improvement_trend(
    p_agent_id UUID,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE(
    improvement_rate NUMERIC,
    modification_success_rate NUMERIC,
    stability_trend NUMERIC,
    adaptation_velocity NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH recent_snapshots AS (
        SELECT 
            self_improvement_score,
            stability_score,
            adaptation_rate,
            recorded_at
        FROM ai_agent_performance_snapshots
        WHERE agent_id = p_agent_id
        AND recorded_at > NOW() - (p_days || ' days')::INTERVAL
        ORDER BY recorded_at
    ),
    modification_stats AS (
        SELECT 
            COUNT(*) FILTER (WHERE status = 'applied') as applied_count,
            COUNT(*) FILTER (WHERE status = 'reverted') as reverted_count,
            COUNT(*) as total_count,
            AVG(confidence) FILTER (WHERE status = 'applied') as avg_confidence
        FROM ai_agent_modifications
        WHERE agent_id = p_agent_id
        AND created_at > NOW() - (p_days || ' days')::INTERVAL
    )
    SELECT 
        COALESCE(
            (SELECT self_improvement_score FROM recent_snapshots ORDER BY recorded_at DESC LIMIT 1) -
            (SELECT self_improvement_score FROM recent_snapshots ORDER BY recorded_at ASC LIMIT 1),
            0
        ) as improvement_rate,
        CASE 
            WHEN total_count > 0 THEN applied_count::NUMERIC / total_count
            ELSE 0
        END as modification_success_rate,
        COALESCE(
            (SELECT stability_score FROM recent_snapshots ORDER BY recorded_at DESC LIMIT 1) -
            (SELECT stability_score FROM recent_snapshots ORDER BY recorded_at ASC LIMIT 1),
            0
        ) as stability_trend,
        COALESCE(
            (SELECT adaptation_rate FROM recent_snapshots ORDER BY recorded_at DESC LIMIT 1),
            0
        ) as adaptation_velocity
    FROM modification_stats;
END;
$$ LANGUAGE plpgsql;

-- Function to get agent modification impact
CREATE OR REPLACE FUNCTION get_modification_impact(p_agent_id UUID)
RETURNS TABLE(
    total_modifications INTEGER,
    successful_modifications INTEGER,
    average_improvement NUMERIC,
    capability_improvements JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH mod_stats AS (
        SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'applied') as successful,
            AVG((performance->>'improvement')::NUMERIC) FILTER (WHERE status = 'applied') as avg_improvement
        FROM ai_agent_modifications
        WHERE agent_id = p_agent_id
    ),
    capability_stats AS (
        SELECT 
            jsonb_object_agg(
                c.name,
                jsonb_build_object(
                    'modifications', COUNT(DISTINCT m.id),
                    'avg_improvement', AVG((m.performance->>'improvement')::NUMERIC)
                )
            ) as cap_improvements
        FROM ai_agent_capabilities c
        LEFT JOIN ai_agent_modifications m ON m.agent_id = c.agent_id
        WHERE c.agent_id = p_agent_id
        AND m.status = 'applied'
        GROUP BY c.agent_id
    )
    SELECT 
        mod_stats.total,
        mod_stats.successful,
        COALESCE(mod_stats.avg_improvement, 0),
        COALESCE(capability_stats.cap_improvements, '{}'::jsonb)
    FROM mod_stats
    CROSS JOIN capability_stats;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update agent version on modification
CREATE OR REPLACE FUNCTION update_agent_version()
RETURNS TRIGGER AS $$
DECLARE
    v_current_version VARCHAR(50);
    v_parts TEXT[];
    v_patch INTEGER;
BEGIN
    IF NEW.status = 'applied' AND OLD.status != 'applied' THEN
        SELECT version INTO v_current_version
        FROM ai_self_modifying_agents
        WHERE id = NEW.agent_id;
        
        v_parts := string_to_array(v_current_version, '.');
        v_patch := (v_parts[3])::INTEGER + 1;
        
        UPDATE ai_self_modifying_agents
        SET version = v_parts[1] || '.' || v_parts[2] || '.' || v_patch,
            updated_at = NOW()
        WHERE id = NEW.agent_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_agent_version
AFTER UPDATE ON ai_agent_modifications
FOR EACH ROW
WHEN (NEW.status != OLD.status)
EXECUTE FUNCTION update_agent_version();

-- Trigger to record performance snapshots
CREATE OR REPLACE FUNCTION record_performance_snapshot()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'applied' THEN
        INSERT INTO ai_agent_performance_snapshots (
            agent_id,
            overall_success,
            adaptation_rate,
            self_improvement_score,
            stability_score,
            resource_efficiency,
            capability_metrics
        )
        SELECT 
            NEW.agent_id,
            (performance->>'overallSuccess')::NUMERIC,
            (performance->>'adaptationRate')::NUMERIC,
            (performance->>'selfImprovementScore')::NUMERIC,
            (performance->>'stabilityScore')::NUMERIC,
            (performance->>'resourceEfficiency')::NUMERIC,
            (SELECT jsonb_object_agg(name, performance) FROM ai_agent_capabilities WHERE agent_id = NEW.agent_id)
        FROM ai_self_modifying_agents
        WHERE id = NEW.agent_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_record_performance_snapshot
AFTER UPDATE ON ai_agent_modifications
FOR EACH ROW
WHEN (NEW.status = 'applied' AND OLD.status != 'applied')
EXECUTE FUNCTION record_performance_snapshot();

-- Row Level Security
ALTER TABLE ai_self_modifying_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_modifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_code_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_performance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_modification_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_safety_check_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_modification_queue ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read for authenticated users" ON ai_self_modifying_agents FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for service role" ON ai_self_modifying_agents FOR ALL USING (auth.role() = 'service_role');

-- Initial strategies
INSERT INTO ai_modification_strategies (name, description, applicability_criteria) VALUES
    ('capability-enhancement', 'Enhance underperforming capabilities', '{"minSuccessRate": 0.8, "maxLatency": 1000}'),
    ('performance-optimization', 'Optimize for speed and efficiency', '{"minEfficiency": 0.7, "minSuccess": 0.9}'),
    ('adaptive-learning', 'Add learning capabilities', '{"minAdaptationRate": 0.5}'),
    ('code-refactoring', 'Improve code maintainability', '{"maxComplexity": 20, "minCoverage": 0.8}')
ON CONFLICT (name) DO NOTHING;

-- Comments
COMMENT ON TABLE ai_self_modifying_agents IS 'Registry of agents capable of modifying their own code';
COMMENT ON TABLE ai_agent_capabilities IS 'Individual capabilities of self-modifying agents';
COMMENT ON TABLE ai_agent_modifications IS 'History of code modifications made by agents';
COMMENT ON TABLE ai_code_changes IS 'Detailed code changes for each modification';
COMMENT ON TABLE ai_agent_performance_snapshots IS 'Performance metrics over time';
COMMENT ON TABLE ai_modification_strategies IS 'Available strategies for code modification';
COMMENT ON TABLE ai_safety_check_results IS 'Results of safety checks on modifications';
COMMENT ON TABLE ai_agent_backups IS 'Code backups before modifications';
COMMENT ON TABLE ai_modification_queue IS 'Queue of pending modifications';