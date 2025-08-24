-- Pattern Mining System Tables
-- This migration creates the infrastructure for advanced pattern discovery

-- Discovered Patterns
CREATE TABLE IF NOT EXISTS ai_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL CHECK (type IN ('behavioral', 'performance', 'code', 'sequence', 'anomaly', 'association', 'temporal', 'causal', 'clustering', 'hierarchical')),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    structure JSONB NOT NULL DEFAULT '{
        "rules": [],
        "conditions": [],
        "outcomes": [],
        "relationships": [],
        "features": []
    }'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{
        "domain": "",
        "context": {},
        "tags": [],
        "relatedPatterns": [],
        "applicability": [],
        "constraints": []
    }'::jsonb,
    confidence NUMERIC(3,2) NOT NULL DEFAULT 0.5,
    support NUMERIC(3,2) NOT NULL DEFAULT 0.1,
    quality JSONB NOT NULL DEFAULT '{
        "precision": 0.8,
        "recall": 0.7,
        "f1Score": 0.74,
        "interestingness": 0.6,
        "novelty": 0.5,
        "actionability": 0.7
    }'::jsonb,
    discovered TIMESTAMPTZ DEFAULT NOW(),
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    usage_count INTEGER DEFAULT 0,
    validation_status VARCHAR(50) DEFAULT 'pending' CHECK (validation_status IN ('pending', 'validated', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mining Tasks
CREATE TABLE IF NOT EXISTS ai_mining_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL,
    data_source JSONB NOT NULL,
    algorithm JSONB NOT NULL,
    parameters JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    patterns_found INTEGER DEFAULT 0,
    start_time TIMESTAMPTZ DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    duration_ms INTEGER,
    error_details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task-Pattern Relationships
CREATE TABLE IF NOT EXISTS ai_task_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES ai_mining_tasks(id) ON DELETE CASCADE,
    pattern_id UUID REFERENCES ai_patterns(id) ON DELETE CASCADE,
    ranking INTEGER, -- Order of discovery within task
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(task_id, pattern_id)
);

-- Association Rules
CREATE TABLE IF NOT EXISTS ai_association_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_id UUID REFERENCES ai_patterns(id) ON DELETE CASCADE,
    antecedent JSONB NOT NULL, -- Array of items
    consequent JSONB NOT NULL, -- Array of items
    confidence NUMERIC(3,2) NOT NULL,
    lift NUMERIC(5,2) NOT NULL,
    support NUMERIC(3,2) NOT NULL,
    conviction NUMERIC(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sequence Patterns
CREATE TABLE IF NOT EXISTS ai_sequence_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_id UUID REFERENCES ai_patterns(id) ON DELETE CASCADE,
    events JSONB NOT NULL, -- Array of sequence events
    support NUMERIC(3,2) NOT NULL,
    confidence NUMERIC(3,2) NOT NULL,
    gaps JSONB DEFAULT '[]'::jsonb, -- Array of time gaps
    duration_ms INTEGER,
    frequency INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cluster Patterns
CREATE TABLE IF NOT EXISTS ai_cluster_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_id UUID REFERENCES ai_patterns(id) ON DELETE CASCADE,
    centroid JSONB NOT NULL, -- Array of centroid coordinates
    members_count INTEGER NOT NULL,
    radius NUMERIC(8,4),
    density NUMERIC(3,2),
    characteristics JSONB,
    inertia NUMERIC(8,4), -- Within-cluster sum of squared distances
    silhouette_score NUMERIC(3,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Anomaly Patterns
CREATE TABLE IF NOT EXISTS ai_anomaly_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_id UUID REFERENCES ai_patterns(id) ON DELETE CASCADE,
    anomaly_type VARCHAR(50) CHECK (anomaly_type IN ('point', 'contextual', 'collective')),
    features JSONB NOT NULL, -- Array of feature values
    score NUMERIC(5,4) NOT NULL,
    threshold NUMERIC(5,4) NOT NULL,
    explanation TEXT,
    severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pattern Applications
CREATE TABLE IF NOT EXISTS ai_pattern_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_id UUID REFERENCES ai_patterns(id) ON DELETE CASCADE,
    application_type VARCHAR(100) NOT NULL,
    context JSONB NOT NULL,
    success BOOLEAN,
    performance_impact JSONB,
    feedback_score NUMERIC(3,2),
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT
);

-- Pattern Relationships
CREATE TABLE IF NOT EXISTS ai_pattern_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_pattern_id UUID REFERENCES ai_patterns(id) ON DELETE CASCADE,
    target_pattern_id UUID REFERENCES ai_patterns(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) NOT NULL CHECK (relationship_type IN ('causal', 'correlation', 'dependency', 'temporal', 'similarity', 'containment')),
    strength NUMERIC(3,2) NOT NULL DEFAULT 0.5,
    confidence NUMERIC(3,2) NOT NULL DEFAULT 0.5,
    evidence JSONB,
    discovered_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_pattern_id, target_pattern_id, relationship_type)
);

-- Data Source Metadata
CREATE TABLE IF NOT EXISTS ai_data_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    description TEXT,
    schema_info JSONB,
    connection_config JSONB,
    last_accessed TIMESTAMPTZ,
    record_count BIGINT,
    quality_score NUMERIC(3,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pattern Validation
CREATE TABLE IF NOT EXISTS ai_pattern_validations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_id UUID REFERENCES ai_patterns(id) ON DELETE CASCADE,
    validator_type VARCHAR(50) NOT NULL, -- 'human', 'automated', 'cross_validation'
    validation_method VARCHAR(100),
    result VARCHAR(20) CHECK (result IN ('valid', 'invalid', 'uncertain')),
    confidence NUMERIC(3,2),
    metrics JSONB,
    feedback TEXT,
    validated_by VARCHAR(255),
    validated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feature Importance
CREATE TABLE IF NOT EXISTS ai_feature_importance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_id UUID REFERENCES ai_patterns(id) ON DELETE CASCADE,
    feature_name VARCHAR(255) NOT NULL,
    importance_score NUMERIC(5,4) NOT NULL,
    feature_type VARCHAR(50) CHECK (feature_type IN ('numeric', 'categorical', 'boolean', 'text')),
    statistics JSONB,
    correlation_matrix JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pattern Usage Analytics
CREATE TABLE IF NOT EXISTS ai_pattern_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_id UUID REFERENCES ai_patterns(id) ON DELETE CASCADE,
    usage_type VARCHAR(100) NOT NULL,
    user_context JSONB,
    success_rate NUMERIC(3,2),
    performance_metrics JSONB,
    usage_date DATE DEFAULT CURRENT_DATE,
    usage_count INTEGER DEFAULT 1,
    UNIQUE(pattern_id, usage_type, usage_date)
);

-- Indexes for performance
CREATE INDEX idx_patterns_type ON ai_patterns(type);
CREATE INDEX idx_patterns_confidence ON ai_patterns(confidence DESC);
CREATE INDEX idx_patterns_support ON ai_patterns(support DESC);
CREATE INDEX idx_patterns_discovered ON ai_patterns(discovered DESC);
CREATE INDEX idx_patterns_domain ON ai_patterns((metadata->>'domain'));
CREATE INDEX idx_patterns_tags ON ai_patterns USING GIN ((metadata->'tags'));

CREATE INDEX idx_mining_tasks_status ON ai_mining_tasks(status);
CREATE INDEX idx_mining_tasks_type ON ai_mining_tasks(type);
CREATE INDEX idx_mining_tasks_duration ON ai_mining_tasks(start_time DESC);

CREATE INDEX idx_task_patterns_task ON ai_task_patterns(task_id);
CREATE INDEX idx_task_patterns_pattern ON ai_task_patterns(pattern_id);

CREATE INDEX idx_association_confidence ON ai_association_rules(confidence DESC);
CREATE INDEX idx_association_lift ON ai_association_rules(lift DESC);
CREATE INDEX idx_association_pattern ON ai_association_rules(pattern_id);

CREATE INDEX idx_sequence_support ON ai_sequence_patterns(support DESC);
CREATE INDEX idx_sequence_pattern ON ai_sequence_patterns(pattern_id);

CREATE INDEX idx_cluster_members ON ai_cluster_patterns(members_count DESC);
CREATE INDEX idx_cluster_pattern ON ai_cluster_patterns(pattern_id);

CREATE INDEX idx_anomaly_score ON ai_anomaly_patterns(score DESC);
CREATE INDEX idx_anomaly_severity ON ai_anomaly_patterns(severity);
CREATE INDEX idx_anomaly_pattern ON ai_anomaly_patterns(pattern_id);

CREATE INDEX idx_applications_pattern ON ai_pattern_applications(pattern_id);
CREATE INDEX idx_applications_success ON ai_pattern_applications(success);

CREATE INDEX idx_relationships_source ON ai_pattern_relationships(source_pattern_id);
CREATE INDEX idx_relationships_target ON ai_pattern_relationships(target_pattern_id);
CREATE INDEX idx_relationships_type ON ai_pattern_relationships(relationship_type);

CREATE INDEX idx_validations_pattern ON ai_pattern_validations(pattern_id);
CREATE INDEX idx_validations_result ON ai_pattern_validations(result);

CREATE INDEX idx_usage_pattern_date ON ai_pattern_usage(pattern_id, usage_date);
CREATE INDEX idx_usage_success_rate ON ai_pattern_usage(success_rate DESC);

-- Analytics Functions
CREATE OR REPLACE FUNCTION calculate_pattern_quality_metrics(p_pattern_id UUID)
RETURNS TABLE(
    precision NUMERIC,
    recall NUMERIC,
    f1_score NUMERIC,
    usage_success_rate NUMERIC,
    validation_confidence NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH usage_stats AS (
        SELECT 
            AVG(success_rate) as avg_success_rate,
            COUNT(*) as usage_count
        FROM ai_pattern_usage
        WHERE pattern_id = p_pattern_id
    ),
    validation_stats AS (
        SELECT 
            AVG(confidence) as avg_confidence,
            COUNT(*) FILTER (WHERE result = 'valid') as valid_count,
            COUNT(*) as total_validations
        FROM ai_pattern_validations
        WHERE pattern_id = p_pattern_id
    ),
    pattern_quality AS (
        SELECT 
            (quality->>'precision')::NUMERIC as precision,
            (quality->>'recall')::NUMERIC as recall,
            (quality->>'f1Score')::NUMERIC as f1_score
        FROM ai_patterns
        WHERE id = p_pattern_id
    )
    SELECT 
        pq.precision,
        pq.recall,
        pq.f1_score,
        COALESCE(us.avg_success_rate, 0) as usage_success_rate,
        COALESCE(vs.avg_confidence, 0) as validation_confidence
    FROM pattern_quality pq
    CROSS JOIN usage_stats us
    CROSS JOIN validation_stats vs;
END;
$$ LANGUAGE plpgsql;

-- Function to find similar patterns
CREATE OR REPLACE FUNCTION find_similar_patterns(
    p_pattern_id UUID,
    p_similarity_threshold NUMERIC DEFAULT 0.7,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
    pattern_id UUID,
    similarity_score NUMERIC,
    pattern_name VARCHAR,
    pattern_type VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    WITH target_pattern AS (
        SELECT structure, metadata, confidence, support
        FROM ai_patterns
        WHERE id = p_pattern_id
    ),
    pattern_similarities AS (
        SELECT 
            p.id,
            p.name,
            p.type,
            -- Simple similarity based on confidence and support
            (1 - ABS(p.confidence - tp.confidence) - ABS(p.support - tp.support)) as similarity
        FROM ai_patterns p
        CROSS JOIN target_pattern tp
        WHERE p.id != p_pattern_id
        AND p.type = (SELECT type FROM ai_patterns WHERE id = p_pattern_id)
    )
    SELECT 
        ps.id,
        ps.similarity,
        ps.name,
        ps.type
    FROM pattern_similarities ps
    WHERE ps.similarity >= p_similarity_threshold
    ORDER BY ps.similarity DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get pattern evolution metrics
CREATE OR REPLACE FUNCTION get_pattern_evolution_metrics(
    p_pattern_type VARCHAR,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE(
    discovery_trend JSONB,
    quality_trend JSONB,
    usage_trend JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH daily_discoveries AS (
        SELECT 
            DATE(discovered) as discovery_date,
            COUNT(*) as patterns_discovered,
            AVG(confidence) as avg_confidence,
            AVG((quality->>'f1Score')::NUMERIC) as avg_f1_score
        FROM ai_patterns
        WHERE type = p_pattern_type
        AND discovered > NOW() - (p_days || ' days')::INTERVAL
        GROUP BY DATE(discovered)
        ORDER BY discovery_date
    ),
    daily_usage AS (
        SELECT 
            pu.usage_date,
            COUNT(DISTINCT pu.pattern_id) as patterns_used,
            AVG(pu.success_rate) as avg_success_rate
        FROM ai_pattern_usage pu
        JOIN ai_patterns p ON p.id = pu.pattern_id
        WHERE p.type = p_pattern_type
        AND pu.usage_date > CURRENT_DATE - p_days
        GROUP BY pu.usage_date
        ORDER BY pu.usage_date
    )
    SELECT 
        jsonb_agg(jsonb_build_object(
            'date', dd.discovery_date,
            'count', dd.patterns_discovered
        ) ORDER BY dd.discovery_date) as discovery_trend,
        jsonb_agg(jsonb_build_object(
            'date', dd.discovery_date,
            'confidence', dd.avg_confidence,
            'f1_score', dd.avg_f1_score
        ) ORDER BY dd.discovery_date) as quality_trend,
        jsonb_agg(jsonb_build_object(
            'date', du.usage_date,
            'patterns_used', du.patterns_used,
            'success_rate', du.avg_success_rate
        ) ORDER BY du.usage_date) as usage_trend
    FROM daily_discoveries dd
    FULL OUTER JOIN daily_usage du ON dd.discovery_date = du.usage_date;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update pattern usage count
CREATE OR REPLACE FUNCTION update_pattern_usage_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE ai_patterns
    SET usage_count = usage_count + 1,
        last_seen = NOW()
    WHERE id = NEW.pattern_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_pattern_usage
AFTER INSERT ON ai_pattern_applications
FOR EACH ROW
EXECUTE FUNCTION update_pattern_usage_count();

-- Trigger to validate pattern quality
CREATE OR REPLACE FUNCTION validate_pattern_quality()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-validate patterns with high confidence and support
    IF NEW.confidence >= 0.9 AND NEW.support >= 0.3 THEN
        NEW.validation_status = 'validated';
    -- Auto-reject patterns with very low quality
    ELSIF NEW.confidence < 0.3 OR NEW.support < 0.05 THEN
        NEW.validation_status = 'rejected';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_pattern_quality
BEFORE INSERT OR UPDATE ON ai_patterns
FOR EACH ROW
EXECUTE FUNCTION validate_pattern_quality();

-- Row Level Security
ALTER TABLE ai_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_mining_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_task_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_association_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_sequence_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cluster_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_anomaly_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_pattern_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_pattern_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_pattern_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_feature_importance ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_pattern_usage ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read for authenticated users" ON ai_patterns FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for service role" ON ai_patterns FOR ALL USING (auth.role() = 'service_role');

-- Views for easy querying
CREATE VIEW pattern_summary AS
SELECT 
    p.id,
    p.type,
    p.name,
    p.confidence,
    p.support,
    p.validation_status,
    p.usage_count,
    (p.quality->>'f1Score')::NUMERIC as f1_score,
    p.discovered,
    p.last_seen,
    COUNT(pa.id) as applications_count,
    AVG(pa.feedback_score) as avg_feedback
FROM ai_patterns p
LEFT JOIN ai_pattern_applications pa ON pa.pattern_id = p.id
GROUP BY p.id, p.type, p.name, p.confidence, p.support, p.validation_status, 
         p.usage_count, p.quality, p.discovered, p.last_seen;

CREATE VIEW mining_task_summary AS
SELECT 
    mt.id,
    mt.type,
    mt.status,
    mt.patterns_found,
    mt.duration_ms,
    mt.start_time,
    mt.end_time,
    COUNT(tp.pattern_id) as actual_patterns,
    AVG(p.confidence) as avg_pattern_confidence
FROM ai_mining_tasks mt
LEFT JOIN ai_task_patterns tp ON tp.task_id = mt.id
LEFT JOIN ai_patterns p ON p.id = tp.pattern_id
GROUP BY mt.id, mt.type, mt.status, mt.patterns_found, mt.duration_ms, 
         mt.start_time, mt.end_time;

-- Comments
COMMENT ON TABLE ai_patterns IS 'Discovered patterns from various mining algorithms';
COMMENT ON TABLE ai_mining_tasks IS 'Pattern mining task execution history';
COMMENT ON TABLE ai_task_patterns IS 'Links mining tasks to discovered patterns';
COMMENT ON TABLE ai_association_rules IS 'Association rule patterns with lift and confidence';
COMMENT ON TABLE ai_sequence_patterns IS 'Sequential patterns with temporal information';
COMMENT ON TABLE ai_cluster_patterns IS 'Clustering patterns with centroids and characteristics';
COMMENT ON TABLE ai_anomaly_patterns IS 'Anomaly patterns with scores and explanations';
COMMENT ON TABLE ai_pattern_applications IS 'Real-world applications of discovered patterns';
COMMENT ON TABLE ai_pattern_relationships IS 'Relationships between different patterns';
COMMENT ON TABLE ai_data_sources IS 'Metadata about data sources used for mining';
COMMENT ON TABLE ai_pattern_validations IS 'Validation results for discovered patterns';
COMMENT ON TABLE ai_feature_importance IS 'Feature importance scores for patterns';
COMMENT ON TABLE ai_pattern_usage IS 'Usage analytics for patterns over time';