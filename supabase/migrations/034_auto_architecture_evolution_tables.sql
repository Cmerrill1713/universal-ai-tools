-- Auto-Architecture Evolution Tables
-- This migration creates the infrastructure for automatic architecture evolution

-- Architecture Components
CREATE TABLE IF NOT EXISTS architecture_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('service', 'database', 'api', 'middleware', 'util', 'interface')),
    file_path TEXT NOT NULL,
    dependencies JSONB DEFAULT '[]'::jsonb,
    dependents JSONB DEFAULT '[]'::jsonb,
    complexity NUMERIC(8,2) NOT NULL DEFAULT 0,
    performance JSONB NOT NULL DEFAULT '{
        "executionTime": 0,
        "memoryUsage": 0,
        "cpuUsage": 0,
        "errorRate": 0,
        "throughput": 0,
        "reliability": 0.95,
        "maintainability": 0.8
    }'::jsonb,
    last_modified TIMESTAMPTZ DEFAULT NOW(),
    version VARCHAR(50) DEFAULT '1.0.0',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Architecture Patterns
CREATE TABLE IF NOT EXISTS architecture_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    type VARCHAR(50) NOT NULL CHECK (type IN ('microservice', 'monolith', 'layered', 'event-driven', 'pipeline', 'plugin')),
    benefits JSONB DEFAULT '[]'::jsonb,
    drawbacks JSONB DEFAULT '[]'::jsonb,
    applicability JSONB NOT NULL DEFAULT '{
        "componentTypes": [],
        "minComplexity": 0,
        "maxComplexity": 1000,
        "performanceThresholds": {},
        "scalabilityRequirements": []
    }'::jsonb,
    implementation JSONB NOT NULL DEFAULT '{
        "codeTemplates": {},
        "configurationChanges": [],
        "migrationSteps": [],
        "rollbackProcedure": []
    }'::jsonb,
    success_rate NUMERIC(3,2) DEFAULT 0.5,
    usage_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Architecture Evolutions
CREATE TABLE IF NOT EXISTS architecture_evolutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_pattern VARCHAR(255) NOT NULL,
    to_pattern VARCHAR(255) NOT NULL,
    affected_components JSONB DEFAULT '[]'::jsonb,
    reason TEXT NOT NULL,
    expected_improvements JSONB DEFAULT '{}'::jsonb,
    migration_plan JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(50) DEFAULT 'proposed' CHECK (status IN ('proposed', 'testing', 'implementing', 'completed', 'failed', 'rolled-back')),
    confidence NUMERIC(3,2) NOT NULL DEFAULT 0.5,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    rollback_at TIMESTAMPTZ,
    error_details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Architecture Metrics History
CREATE TABLE IF NOT EXISTS architecture_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    overall_metrics JSONB NOT NULL DEFAULT '{
        "complexity": 0,
        "maintainability": 0,
        "performance": 0,
        "scalability": 0,
        "reliability": 0
    }'::jsonb,
    component_metrics JSONB DEFAULT '{}'::jsonb,
    pattern_metrics JSONB DEFAULT '{}'::jsonb,
    evolution_metrics JSONB DEFAULT '{
        "successRate": 0,
        "averageImprovementTime": 0,
        "rollbackRate": 0
    }'::jsonb,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Component Dependencies
CREATE TABLE IF NOT EXISTS architecture_component_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_component_id UUID REFERENCES architecture_components(id) ON DELETE CASCADE,
    target_component_id UUID REFERENCES architecture_components(id) ON DELETE CASCADE,
    dependency_type VARCHAR(50) DEFAULT 'import' CHECK (dependency_type IN ('import', 'call', 'inherit', 'compose')),
    strength NUMERIC(3,2) DEFAULT 0.5,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_component_id, target_component_id, dependency_type)
);

-- Migration Steps
CREATE TABLE IF NOT EXISTS architecture_migration_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evolution_id UUID REFERENCES architecture_evolutions(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    description TEXT NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('create', 'modify', 'delete', 'configure')),
    target TEXT NOT NULL,
    changes JSONB NOT NULL,
    validation_rules JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'executing', 'completed', 'failed')),
    executed_at TIMESTAMPTZ,
    error_details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Evolution Validations
CREATE TABLE IF NOT EXISTS architecture_evolution_validations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evolution_id UUID REFERENCES architecture_evolutions(id) ON DELETE CASCADE,
    validation_type VARCHAR(50) NOT NULL CHECK (validation_type IN ('syntax', 'performance', 'compatibility', 'security')),
    criteria JSONB NOT NULL,
    threshold NUMERIC(8,4),
    result BOOLEAN,
    details JSONB,
    validated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Architecture Bottlenecks
CREATE TABLE IF NOT EXISTS architecture_bottlenecks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bottleneck_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    affected_components JSONB DEFAULT '[]'::jsonb,
    description TEXT,
    suggested_solutions JSONB DEFAULT '[]'::jsonb,
    metrics_snapshot JSONB,
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    evolution_id UUID REFERENCES architecture_evolutions(id) ON DELETE SET NULL
);

-- Pattern Usage History
CREATE TABLE IF NOT EXISTS architecture_pattern_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_id UUID REFERENCES architecture_patterns(id) ON DELETE CASCADE,
    evolution_id UUID REFERENCES architecture_evolutions(id) ON DELETE SET NULL,
    usage_context VARCHAR(255),
    success BOOLEAN,
    performance_impact JSONB,
    lessons_learned TEXT,
    used_at TIMESTAMPTZ DEFAULT NOW()
);

-- Component Performance History
CREATE TABLE IF NOT EXISTS architecture_component_performance_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_id UUID REFERENCES architecture_components(id) ON DELETE CASCADE,
    execution_time NUMERIC(8,2),
    memory_usage NUMERIC(8,2),
    cpu_usage NUMERIC(5,2),
    error_rate NUMERIC(3,2),
    throughput NUMERIC(8,2),
    reliability NUMERIC(3,2),
    maintainability NUMERIC(3,2),
    measured_at TIMESTAMPTZ DEFAULT NOW()
);

-- Architecture Backups
CREATE TABLE IF NOT EXISTS architecture_backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evolution_id UUID REFERENCES architecture_evolutions(id) ON DELETE CASCADE,
    backup_path TEXT NOT NULL,
    affected_files JSONB DEFAULT '[]'::jsonb,
    backup_size BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    restored_at TIMESTAMPTZ
);

-- Evolution Impact Analysis
CREATE TABLE IF NOT EXISTS architecture_evolution_impact (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evolution_id UUID REFERENCES architecture_evolutions(id) ON DELETE CASCADE,
    metric_name VARCHAR(100) NOT NULL,
    before_value NUMERIC(8,4),
    after_value NUMERIC(8,4),
    improvement_percentage NUMERIC(5,2),
    significance VARCHAR(20) CHECK (significance IN ('negligible', 'minor', 'moderate', 'major', 'critical')),
    measured_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_components_type ON architecture_components(type);
CREATE INDEX idx_components_complexity ON architecture_components(complexity DESC);
CREATE INDEX idx_components_modified ON architecture_components(last_modified DESC);
CREATE INDEX idx_components_path ON architecture_components(file_path);

CREATE INDEX idx_patterns_type ON architecture_patterns(type);
CREATE INDEX idx_patterns_name ON architecture_patterns(name);
CREATE INDEX idx_patterns_success_rate ON architecture_patterns(success_rate DESC);
CREATE INDEX idx_patterns_active ON architecture_patterns(is_active);

CREATE INDEX idx_evolutions_status ON architecture_evolutions(status);
CREATE INDEX idx_evolutions_confidence ON architecture_evolutions(confidence DESC);
CREATE INDEX idx_evolutions_patterns ON architecture_evolutions(from_pattern, to_pattern);
CREATE INDEX idx_evolutions_created ON architecture_evolutions(created_at DESC);

CREATE INDEX idx_metrics_recorded ON architecture_metrics(recorded_at DESC);

CREATE INDEX idx_dependencies_source ON architecture_component_dependencies(source_component_id);
CREATE INDEX idx_dependencies_target ON architecture_component_dependencies(target_component_id);
CREATE INDEX idx_dependencies_type ON architecture_component_dependencies(dependency_type);

CREATE INDEX idx_migration_steps_evolution ON architecture_migration_steps(evolution_id, step_number);
CREATE INDEX idx_migration_steps_status ON architecture_migration_steps(status);

CREATE INDEX idx_validations_evolution ON architecture_evolution_validations(evolution_id);
CREATE INDEX idx_validations_type ON architecture_evolution_validations(validation_type);

CREATE INDEX idx_bottlenecks_type ON architecture_bottlenecks(bottleneck_type);
CREATE INDEX idx_bottlenecks_severity ON architecture_bottlenecks(severity);
CREATE INDEX idx_bottlenecks_detected ON architecture_bottlenecks(detected_at DESC);

CREATE INDEX idx_pattern_usage_pattern ON architecture_pattern_usage(pattern_id);
CREATE INDEX idx_pattern_usage_success ON architecture_pattern_usage(success);

CREATE INDEX idx_perf_history_component ON architecture_component_performance_history(component_id, measured_at DESC);
CREATE INDEX idx_perf_history_execution ON architecture_component_performance_history(execution_time DESC);

CREATE INDEX idx_backups_evolution ON architecture_backups(evolution_id);
CREATE INDEX idx_backups_created ON architecture_backups(created_at DESC);

CREATE INDEX idx_impact_evolution ON architecture_evolution_impact(evolution_id);
CREATE INDEX idx_impact_metric ON architecture_evolution_impact(metric_name);
CREATE INDEX idx_impact_improvement ON architecture_evolution_impact(improvement_percentage DESC);

-- Functions for analytics
CREATE OR REPLACE FUNCTION calculate_architecture_health_score()
RETURNS TABLE(
    health_score NUMERIC,
    complexity_score NUMERIC,
    performance_score NUMERIC,
    maintainability_score NUMERIC,
    reliability_score NUMERIC,
    trend VARCHAR
) AS $$
DECLARE
    v_current_metrics JSONB;
    v_previous_metrics JSONB;
BEGIN
    -- Get latest metrics
    SELECT overall_metrics INTO v_current_metrics
    FROM architecture_metrics
    ORDER BY recorded_at DESC
    LIMIT 1;
    
    -- Get previous metrics for trend
    SELECT overall_metrics INTO v_previous_metrics
    FROM architecture_metrics
    ORDER BY recorded_at DESC
    OFFSET 1
    LIMIT 1;
    
    RETURN QUERY
    SELECT 
        -- Overall health score (weighted average)
        (
            (v_current_metrics->>'complexity')::NUMERIC * 0.2 +
            (v_current_metrics->>'performance')::NUMERIC * 0.25 +
            (v_current_metrics->>'maintainability')::NUMERIC * 0.25 +
            (v_current_metrics->>'reliability')::NUMERIC * 0.3
        ) as health_score,
        (1 - (v_current_metrics->>'complexity')::NUMERIC / 100) as complexity_score,
        (v_current_metrics->>'performance')::NUMERIC as performance_score,
        (v_current_metrics->>'maintainability')::NUMERIC as maintainability_score,
        (v_current_metrics->>'reliability')::NUMERIC as reliability_score,
        CASE 
            WHEN v_previous_metrics IS NULL THEN 'unknown'
            WHEN (v_current_metrics->>'performance')::NUMERIC > (v_previous_metrics->>'performance')::NUMERIC THEN 'improving'
            WHEN (v_current_metrics->>'performance')::NUMERIC < (v_previous_metrics->>'performance')::NUMERIC THEN 'declining'
            ELSE 'stable'
        END as trend;
END;
$$ LANGUAGE plpgsql;

-- Function to identify evolution candidates
CREATE OR REPLACE FUNCTION identify_evolution_candidates(p_threshold NUMERIC DEFAULT 0.7)
RETURNS TABLE(
    component_id UUID,
    component_name VARCHAR,
    bottleneck_type VARCHAR,
    severity_score NUMERIC,
    suggested_pattern VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    WITH component_analysis AS (
        SELECT 
            ac.id,
            ac.name,
            ac.type,
            ac.complexity,
            (ac.performance->>'reliability')::NUMERIC as reliability,
            (ac.performance->>'maintainability')::NUMERIC as maintainability,
            (ac.performance->>'executionTime')::NUMERIC as execution_time,
            array_length(ac.dependencies::text[], 1) as dependency_count
        FROM architecture_components ac
    ),
    bottleneck_analysis AS (
        SELECT 
            ca.id,
            ca.name,
            CASE 
                WHEN ca.complexity > 50 THEN 'high-complexity'
                WHEN ca.reliability < 0.9 THEN 'low-reliability'
                WHEN ca.maintainability < 0.8 THEN 'poor-maintainability'
                WHEN ca.execution_time > 1000 THEN 'performance-issues'
                WHEN ca.dependency_count > 10 THEN 'high-coupling'
                ELSE 'none'
            END as bottleneck_type,
            CASE 
                WHEN ca.complexity > 50 THEN (ca.complexity - 50) / 50
                WHEN ca.reliability < 0.9 THEN (0.9 - ca.reliability) / 0.9
                WHEN ca.maintainability < 0.8 THEN (0.8 - ca.maintainability) / 0.8
                WHEN ca.execution_time > 1000 THEN LEAST(1, (ca.execution_time - 1000) / 10000)
                WHEN ca.dependency_count > 10 THEN LEAST(1, (ca.dependency_count - 10) / 20.0)
                ELSE 0
            END as severity_score,
            CASE 
                WHEN ca.complexity > 50 OR ca.dependency_count > 10 THEN 'microservice'
                WHEN ca.execution_time > 1000 THEN 'event-driven'
                WHEN ca.maintainability < 0.8 THEN 'layered'
                ELSE 'monolith'
            END as suggested_pattern
        FROM component_analysis ca
    )
    SELECT 
        ba.id,
        ba.name,
        ba.bottleneck_type,
        ba.severity_score,
        ba.suggested_pattern
    FROM bottleneck_analysis ba
    WHERE ba.bottleneck_type != 'none'
    AND ba.severity_score >= p_threshold
    ORDER BY ba.severity_score DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to analyze evolution success patterns
CREATE OR REPLACE FUNCTION analyze_evolution_success_patterns()
RETURNS TABLE(
    pattern_transition VARCHAR,
    success_rate NUMERIC,
    average_improvement NUMERIC,
    common_failures TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    WITH evolution_stats AS (
        SELECT 
            ae.from_pattern || ' -> ' || ae.to_pattern as transition,
            ae.status,
            CASE 
                WHEN ae.status = 'completed' THEN 1
                ELSE 0
            END as success,
            ae.expected_improvements,
            ae.error_details
        FROM architecture_evolutions ae
        WHERE ae.status IN ('completed', 'failed', 'rolled-back')
    ),
    success_analysis AS (
        SELECT 
            es.transition,
            AVG(es.success) as success_rate,
            AVG(
                CASE 
                    WHEN es.success = 1 AND jsonb_typeof(es.expected_improvements) = 'object'
                    THEN (
                        SELECT AVG(value::numeric) 
                        FROM jsonb_each_text(es.expected_improvements) 
                        WHERE value ~ '^-?[0-9]*\.?[0-9]+$'
                    )
                    ELSE 0
                END
            ) as avg_improvement,
            array_agg(DISTINCT es.error_details) FILTER (WHERE es.error_details IS NOT NULL) as failures
        FROM evolution_stats es
        GROUP BY es.transition
    )
    SELECT 
        sa.transition,
        sa.success_rate,
        COALESCE(sa.avg_improvement, 0),
        COALESCE(sa.failures, ARRAY[]::TEXT[])
    FROM success_analysis sa
    ORDER BY sa.success_rate DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to recommend optimal evolution path
CREATE OR REPLACE FUNCTION recommend_evolution_path(
    p_component_id UUID,
    p_target_improvements JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(
    recommended_pattern VARCHAR,
    confidence_score NUMERIC,
    expected_benefits JSONB,
    migration_complexity VARCHAR,
    estimated_duration INTEGER
) AS $$
DECLARE
    v_component architecture_components%ROWTYPE;
    v_current_pattern VARCHAR;
BEGIN
    -- Get component details
    SELECT * INTO v_component
    FROM architecture_components
    WHERE id = p_component_id;
    
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    -- Determine current pattern (simplified)
    SELECT CASE 
        WHEN v_component.type = 'service' AND array_length(v_component.dependencies::text[], 1) < 5 THEN 'microservice'
        WHEN v_component.complexity > 50 THEN 'monolith'
        ELSE 'layered'
    END INTO v_current_pattern;
    
    RETURN QUERY
    WITH pattern_scores AS (
        SELECT 
            ap.name,
            ap.type,
            -- Score based on applicability
            CASE 
                WHEN v_component.complexity BETWEEN 
                    (ap.applicability->>'minComplexity')::INTEGER AND 
                    (ap.applicability->>'maxComplexity')::INTEGER
                THEN 0.8
                ELSE 0.3
            END +
            -- Score based on component type compatibility
            CASE 
                WHEN ap.applicability->'componentTypes' ? v_component.type THEN 0.2
                ELSE 0
            END as confidence,
            ap.benefits,
            CASE 
                WHEN ap.type = 'microservice' THEN 'high'
                WHEN ap.type = 'event-driven' THEN 'medium'
                ELSE 'low'
            END as complexity,
            CASE 
                WHEN ap.type = 'microservice' THEN 14
                WHEN ap.type = 'event-driven' THEN 7
                ELSE 3
            END as duration_days
        FROM architecture_patterns ap
        WHERE ap.is_active = true
        AND ap.name != v_current_pattern
    )
    SELECT 
        ps.name,
        ps.confidence,
        ps.benefits,
        ps.complexity,
        ps.duration_days
    FROM pattern_scores ps
    WHERE ps.confidence > 0.5
    ORDER BY ps.confidence DESC
    LIMIT 3;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update component performance
CREATE OR REPLACE FUNCTION update_component_performance()
RETURNS TRIGGER AS $$
BEGIN
    -- Record performance history
    INSERT INTO architecture_component_performance_history (
        component_id,
        execution_time,
        memory_usage,
        cpu_usage,
        error_rate,
        throughput,
        reliability,
        maintainability
    )
    VALUES (
        NEW.id,
        (NEW.performance->>'executionTime')::NUMERIC,
        (NEW.performance->>'memoryUsage')::NUMERIC,
        (NEW.performance->>'cpuUsage')::NUMERIC,
        (NEW.performance->>'errorRate')::NUMERIC,
        (NEW.performance->>'throughput')::NUMERIC,
        (NEW.performance->>'reliability')::NUMERIC,
        (NEW.performance->>'maintainability')::NUMERIC
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_component_performance
AFTER UPDATE ON architecture_components
FOR EACH ROW
WHEN (OLD.performance IS DISTINCT FROM NEW.performance)
EXECUTE FUNCTION update_component_performance();

-- Trigger to track pattern usage
CREATE OR REPLACE FUNCTION track_pattern_usage()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' THEN
        UPDATE architecture_patterns
        SET usage_count = usage_count + 1,
            success_rate = (success_rate * usage_count + 1.0) / (usage_count + 1),
            updated_at = NOW()
        WHERE name = NEW.to_pattern;
        
        INSERT INTO architecture_pattern_usage (
            pattern_id,
            evolution_id,
            usage_context,
            success,
            performance_impact
        )
        SELECT 
            ap.id,
            NEW.id,
            'evolution',
            true,
            NEW.expected_improvements
        FROM architecture_patterns ap
        WHERE ap.name = NEW.to_pattern;
        
    ELSIF NEW.status = 'failed' OR NEW.status = 'rolled-back' THEN
        UPDATE architecture_patterns
        SET usage_count = usage_count + 1,
            success_rate = (success_rate * usage_count) / (usage_count + 1),
            updated_at = NOW()
        WHERE name = NEW.to_pattern;
        
        INSERT INTO architecture_pattern_usage (
            pattern_id,
            evolution_id,
            usage_context,
            success,
            lessons_learned
        )
        SELECT 
            ap.id,
            NEW.id,
            'evolution',
            false,
            NEW.error_details
        FROM architecture_patterns ap
        WHERE ap.name = NEW.to_pattern;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_track_pattern_usage
AFTER UPDATE ON architecture_evolutions
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION track_pattern_usage();

-- Trigger to detect bottlenecks
CREATE OR REPLACE FUNCTION detect_bottlenecks()
RETURNS TRIGGER AS $$
DECLARE
    v_bottleneck_type VARCHAR;
    v_severity VARCHAR;
BEGIN
    -- Detect various bottleneck types
    IF NEW.complexity > 80 THEN
        v_bottleneck_type := 'excessive-complexity';
        v_severity := 'high';
    ELSIF (NEW.performance->>'reliability')::NUMERIC < 0.8 THEN
        v_bottleneck_type := 'reliability-issues';
        v_severity := 'critical';
    ELSIF (NEW.performance->>'maintainability')::NUMERIC < 0.6 THEN
        v_bottleneck_type := 'maintainability-issues';
        v_severity := 'medium';
    ELSIF (NEW.performance->>'executionTime')::NUMERIC > 5000 THEN
        v_bottleneck_type := 'performance-degradation';
        v_severity := 'high';
    END IF;
    
    IF v_bottleneck_type IS NOT NULL THEN
        INSERT INTO architecture_bottlenecks (
            bottleneck_type,
            severity,
            affected_components,
            description,
            suggested_solutions,
            metrics_snapshot
        )
        VALUES (
            v_bottleneck_type,
            v_severity,
            jsonb_build_array(NEW.id),
            format('Component %s showing %s', NEW.name, v_bottleneck_type),
            CASE v_bottleneck_type
                WHEN 'excessive-complexity' THEN '["Refactor into smaller components", "Apply microservice pattern"]'::jsonb
                WHEN 'reliability-issues' THEN '["Add error handling", "Implement circuit breaker"]'::jsonb
                WHEN 'maintainability-issues' THEN '["Apply clean code principles", "Add documentation"]'::jsonb
                WHEN 'performance-degradation' THEN '["Optimize algorithms", "Add caching", "Use event-driven pattern"]'::jsonb
                ELSE '[]'::jsonb
            END,
            jsonb_build_object(
                'complexity', NEW.complexity,
                'performance', NEW.performance
            )
        )
        ON CONFLICT (bottleneck_type, affected_components) 
        WHERE resolved_at IS NULL
        DO UPDATE SET
            severity = EXCLUDED.severity,
            metrics_snapshot = EXCLUDED.metrics_snapshot,
            detected_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_detect_bottlenecks
AFTER INSERT OR UPDATE ON architecture_components
FOR EACH ROW
EXECUTE FUNCTION detect_bottlenecks();

-- Row Level Security
ALTER TABLE architecture_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE architecture_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE architecture_evolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE architecture_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE architecture_component_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE architecture_migration_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE architecture_evolution_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE architecture_bottlenecks ENABLE ROW LEVEL SECURITY;
ALTER TABLE architecture_pattern_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE architecture_component_performance_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE architecture_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE architecture_evolution_impact ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read for authenticated users" ON architecture_components FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for service role" ON architecture_components FOR ALL USING (auth.role() = 'service_role');

-- Views for easy querying
CREATE VIEW architecture_health_dashboard AS
SELECT 
    (SELECT COUNT(*) FROM architecture_components) as total_components,
    (SELECT COUNT(*) FROM architecture_components WHERE complexity > 50) as complex_components,
    (SELECT COUNT(*) FROM architecture_bottlenecks WHERE resolved_at IS NULL) as active_bottlenecks,
    (SELECT COUNT(*) FROM architecture_evolutions WHERE status = 'completed') as successful_evolutions,
    (SELECT COUNT(*) FROM architecture_evolutions WHERE status IN ('failed', 'rolled-back')) as failed_evolutions,
    (SELECT AVG((performance->>'reliability')::NUMERIC) FROM architecture_components) as avg_reliability,
    (SELECT AVG((performance->>'maintainability')::NUMERIC) FROM architecture_components) as avg_maintainability;

CREATE VIEW evolution_pipeline_status AS
SELECT 
    ae.id,
    ae.from_pattern,
    ae.to_pattern,
    ae.status,
    ae.confidence,
    array_length(ae.affected_components::text[], 1) as affected_count,
    ae.started_at,
    ae.completed_at,
    CASE 
        WHEN ae.status = 'completed' THEN EXTRACT(EPOCH FROM (ae.completed_at - ae.started_at)) / 3600
        WHEN ae.status IN ('implementing', 'testing') THEN EXTRACT(EPOCH FROM (NOW() - ae.started_at)) / 3600
        ELSE NULL
    END as duration_hours
FROM architecture_evolutions ae
ORDER BY ae.created_at DESC;

CREATE VIEW component_dependency_graph AS
SELECT 
    source.name as source_component,
    source.type as source_type,
    target.name as target_component,
    target.type as target_type,
    dep.dependency_type,
    dep.strength
FROM architecture_component_dependencies dep
JOIN architecture_components source ON source.id = dep.source_component_id
JOIN architecture_components target ON target.id = dep.target_component_id;

-- Initial architecture patterns
INSERT INTO architecture_patterns (name, description, type, benefits, drawbacks, applicability) VALUES
    ('microservice', 'Decompose application into small, independent services', 'microservice', 
     '["Scalability", "Technology diversity", "Team autonomy", "Fault isolation"]',
     '["Complexity", "Network overhead", "Data consistency", "Testing complexity"]',
     '{"componentTypes": ["service", "api"], "minComplexity": 30, "maxComplexity": 1000, "performanceThresholds": {"reliability": 0.95}, "scalabilityRequirements": ["horizontal-scaling"]}'),
    
    ('event-driven', 'Use events to communicate between components', 'event-driven',
     '["Loose coupling", "Scalability", "Responsiveness", "Flexibility"]',
     '["Complexity", "Debugging difficulty", "Event ordering", "Message consistency"]',
     '{"componentTypes": ["service", "api", "middleware"], "minComplexity": 20, "maxComplexity": 500, "performanceThresholds": {"throughput": 1000}, "scalabilityRequirements": ["async-processing"]}'),
     
    ('layered', 'Organize components into hierarchical layers', 'layered',
     '["Separation of concerns", "Maintainability", "Testability", "Clear structure"]',
     '["Performance overhead", "Tight coupling between layers", "Limited flexibility"]',
     '{"componentTypes": ["service", "api", "util"], "minComplexity": 10, "maxComplexity": 200, "performanceThresholds": {"maintainability": 0.8}, "scalabilityRequirements": ["modular-design"]}'),
     
    ('plugin', 'Extensible architecture with plugin components', 'plugin',
     '["Extensibility", "Modularity", "Third-party integration", "Customization"]',
     '["Complexity", "Plugin management", "Version compatibility", "Security risks"]',
     '{"componentTypes": ["service", "middleware", "util"], "minComplexity": 15, "maxComplexity": 300, "performanceThresholds": {"reliability": 0.9}, "scalabilityRequirements": ["extensibility"]}')
ON CONFLICT (name) DO NOTHING;

-- Comments
COMMENT ON TABLE architecture_components IS 'System components with performance and dependency tracking';
COMMENT ON TABLE architecture_patterns IS 'Available architectural patterns and their characteristics';
COMMENT ON TABLE architecture_evolutions IS 'History of architectural changes and migrations';
COMMENT ON TABLE architecture_metrics IS 'Historical architecture health metrics';
COMMENT ON TABLE architecture_component_dependencies IS 'Component dependency relationships';
COMMENT ON TABLE architecture_migration_steps IS 'Detailed steps for architecture migrations';
COMMENT ON TABLE architecture_evolution_validations IS 'Validation results for architecture changes';
COMMENT ON TABLE architecture_bottlenecks IS 'Detected architecture bottlenecks and issues';
COMMENT ON TABLE architecture_pattern_usage IS 'Pattern usage history and outcomes';
COMMENT ON TABLE architecture_component_performance_history IS 'Historical performance data for components';
COMMENT ON TABLE architecture_backups IS 'Backup information for architecture changes';
COMMENT ON TABLE architecture_evolution_impact IS 'Impact analysis of architecture changes';