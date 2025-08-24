-- Migration: Continuous Learning and Knowledge Update System
-- This migration creates tables and functions for the knowledge update pipeline

-- Table for scraped knowledge from external sources
CREATE TABLE IF NOT EXISTS scraped_knowledge (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    source_id TEXT NOT NULL,
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    categories TEXT[] DEFAULT '{}',
    scraped_at TIMESTAMPTZ DEFAULT NOW(),
    quality_score FLOAT DEFAULT 0.0,
    validation_status TEXT DEFAULT 'pending', -- pending, validated, rejected
    validation_details JSONB DEFAULT '{}',
    processed BOOLEAN DEFAULT FALSE,
    UNIQUE(content_hash)
);

-- Table for knowledge validation results
CREATE TABLE IF NOT EXISTS knowledge_validation (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    scraped_knowledge_id UUID REFERENCES scraped_knowledge(id),
    validation_type TEXT NOT NULL, -- source_credibility, fact_check, quality, deprecation
    score FLOAT NOT NULL CHECK (score >= 0 AND score <= 1),
    issues TEXT[] DEFAULT '{}',
    suggestions TEXT[] DEFAULT '{}',
    validator_id TEXT NOT NULL,
    validated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Table for knowledge usage analytics
CREATE TABLE IF NOT EXISTS knowledge_usage_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    knowledge_id UUID NOT NULL, -- Can reference multiple tables
    knowledge_type TEXT NOT NULL, -- scraped, memory, entity, etc.
    agent_id TEXT NOT NULL,
    action_type TEXT NOT NULL, -- accessed, used, failed, helpful, not_helpful
    context JSONB DEFAULT '{}',
    performance_score FLOAT,
    user_feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for knowledge update queue
CREATE TABLE IF NOT EXISTS knowledge_update_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    source_id TEXT NOT NULL,
    url TEXT NOT NULL,
    update_type TEXT NOT NULL, -- new, update, deprecate, delete
    priority INTEGER DEFAULT 5,
    scheduled_for TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
    attempts INTEGER DEFAULT 0,
    last_attempt TIMESTAMPTZ,
    error_details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for knowledge performance metrics
CREATE TABLE IF NOT EXISTS knowledge_performance_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    metric_type TEXT NOT NULL, -- retrieval_accuracy, usage_effectiveness, update_frequency
    metric_value FLOAT NOT NULL,
    dimensions JSONB DEFAULT '{}', -- category, source, agent, etc.
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for knowledge reranking history
CREATE TABLE IF NOT EXISTS knowledge_reranking_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    knowledge_id UUID NOT NULL,
    knowledge_type TEXT NOT NULL,
    old_rank FLOAT,
    new_rank FLOAT,
    reranking_reason TEXT NOT NULL, -- usage_pattern, performance, validation, age
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for knowledge relationships learned from usage
CREATE TABLE IF NOT EXISTS learned_knowledge_relationships (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    source_knowledge_id UUID NOT NULL,
    target_knowledge_id UUID NOT NULL,
    relationship_type TEXT NOT NULL, -- co_accessed, prerequisite, alternative, contradiction
    strength FLOAT DEFAULT 0.5 CHECK (strength >= 0 AND strength <= 1),
    confidence FLOAT DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
    evidence_count INTEGER DEFAULT 1,
    last_observed TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_knowledge_id, target_knowledge_id, relationship_type)
);

-- Table for monitoring alerts
CREATE TABLE IF NOT EXISTS knowledge_monitoring_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    alert_type TEXT NOT NULL, -- deprecation, quality_drop, source_offline, update_needed
    severity TEXT NOT NULL, -- low, medium, high, critical
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    affected_items JSONB DEFAULT '[]',
    status TEXT DEFAULT 'active', -- active, acknowledged, resolved
    created_at TIMESTAMPTZ DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT
);

-- Indexes for performance
CREATE INDEX idx_scraped_knowledge_source ON scraped_knowledge(source_id);
CREATE INDEX idx_scraped_knowledge_categories ON scraped_knowledge USING GIN(categories);
CREATE INDEX idx_scraped_knowledge_scraped_at ON scraped_knowledge(scraped_at DESC);
CREATE INDEX idx_scraped_knowledge_quality ON scraped_knowledge(quality_score DESC);
CREATE INDEX idx_scraped_knowledge_validation ON scraped_knowledge(validation_status);

CREATE INDEX idx_knowledge_validation_scraped ON knowledge_validation(scraped_knowledge_id);
CREATE INDEX idx_knowledge_validation_type ON knowledge_validation(validation_type);
CREATE INDEX idx_knowledge_validation_score ON knowledge_validation(score DESC);

CREATE INDEX idx_knowledge_usage_knowledge ON knowledge_usage_analytics(knowledge_id, knowledge_type);
CREATE INDEX idx_knowledge_usage_agent ON knowledge_usage_analytics(agent_id);
CREATE INDEX idx_knowledge_usage_action ON knowledge_usage_analytics(action_type);
CREATE INDEX idx_knowledge_usage_created ON knowledge_usage_analytics(created_at DESC);

CREATE INDEX idx_update_queue_status ON knowledge_update_queue(status, scheduled_for);
CREATE INDEX idx_update_queue_source ON knowledge_update_queue(source_id);

CREATE INDEX idx_performance_metrics_type ON knowledge_performance_metrics(metric_type);
CREATE INDEX idx_performance_metrics_period ON knowledge_performance_metrics(period_start, period_end);

CREATE INDEX idx_reranking_history_knowledge ON knowledge_reranking_history(knowledge_id, knowledge_type);
CREATE INDEX idx_reranking_history_created ON knowledge_reranking_history(created_at DESC);

CREATE INDEX idx_learned_relationships_source ON learned_knowledge_relationships(source_knowledge_id);
CREATE INDEX idx_learned_relationships_target ON learned_knowledge_relationships(target_knowledge_id);
CREATE INDEX idx_learned_relationships_strength ON learned_knowledge_relationships(strength DESC);

CREATE INDEX idx_monitoring_alerts_status ON knowledge_monitoring_alerts(status, severity);
CREATE INDEX idx_monitoring_alerts_type ON knowledge_monitoring_alerts(alert_type);

-- Function to calculate knowledge quality score
CREATE OR REPLACE FUNCTION calculate_knowledge_quality_score(
    p_scraped_id UUID
) RETURNS FLOAT AS $$
DECLARE
    v_quality_score FLOAT;
    v_validation_scores FLOAT[];
    v_usage_performance FLOAT;
BEGIN
    -- Get validation scores
    SELECT ARRAY_AGG(score) INTO v_validation_scores
    FROM knowledge_validation
    WHERE scraped_knowledge_id = p_scraped_id;
    
    -- Get usage performance
    SELECT AVG(performance_score) INTO v_usage_performance
    FROM knowledge_usage_analytics
    WHERE knowledge_id = p_scraped_id
    AND knowledge_type = 'scraped';
    
    -- Calculate composite score
    v_quality_score := 0.0;
    
    -- Add validation score component (40%)
    IF v_validation_scores IS NOT NULL THEN
        v_quality_score := v_quality_score + (0.4 * (SELECT AVG(score) FROM UNNEST(v_validation_scores) AS score));
    END IF;
    
    -- Add usage performance component (30%)
    IF v_usage_performance IS NOT NULL THEN
        v_quality_score := v_quality_score + (0.3 * v_usage_performance);
    END IF;
    
    -- Add source credibility component (30%)
    -- This would be enhanced with actual source credibility lookup
    v_quality_score := v_quality_score + 0.3 * 0.8; -- Default credibility
    
    RETURN v_quality_score;
END;
$$ LANGUAGE plpgsql;

-- Function to detect deprecated knowledge
CREATE OR REPLACE FUNCTION detect_deprecated_knowledge() RETURNS TABLE(
    knowledge_id UUID,
    knowledge_type TEXT,
    deprecation_reason TEXT,
    confidence FLOAT
) AS $$
BEGIN
    RETURN QUERY
    -- Find knowledge that hasn't been accessed in 90 days
    SELECT DISTINCT
        k.id,
        'scraped'::TEXT,
        'unused_for_90_days'::TEXT,
        0.8::FLOAT
    FROM scraped_knowledge k
    LEFT JOIN knowledge_usage_analytics u ON u.knowledge_id = k.id AND u.knowledge_type = 'scraped'
    WHERE k.scraped_at < NOW() - INTERVAL '90 days'
    GROUP BY k.id
    HAVING MAX(u.created_at) < NOW() - INTERVAL '90 days' OR MAX(u.created_at) IS NULL
    
    UNION ALL
    
    -- Find knowledge with consistently low performance
    SELECT DISTINCT
        u.knowledge_id,
        u.knowledge_type,
        'low_performance'::TEXT,
        0.9::FLOAT
    FROM knowledge_usage_analytics u
    WHERE u.performance_score < 0.3
    GROUP BY u.knowledge_id, u.knowledge_type
    HAVING COUNT(*) > 10 AND AVG(performance_score) < 0.3
    
    UNION ALL
    
    -- Find knowledge marked as incorrect through validation
    SELECT DISTINCT
        v.scraped_knowledge_id,
        'scraped'::TEXT,
        'validation_failed'::TEXT,
        1.0::FLOAT
    FROM knowledge_validation v
    WHERE v.validation_type = 'fact_check' AND v.score < 0.3;
END;
$$ LANGUAGE plpgsql;

-- Function to generate knowledge update recommendations
CREATE OR REPLACE FUNCTION generate_knowledge_update_recommendations(
    p_limit INTEGER DEFAULT 50
) RETURNS TABLE(
    source_id TEXT,
    url TEXT,
    update_type TEXT,
    priority INTEGER,
    reason TEXT
) AS $$
BEGIN
    RETURN QUERY
    -- High-priority: Frequently accessed knowledge that needs refresh
    SELECT DISTINCT
        s.source_id,
        s.url,
        'update'::TEXT,
        9::INTEGER,
        'high_usage_needs_refresh'::TEXT
    FROM scraped_knowledge s
    JOIN knowledge_usage_analytics u ON u.knowledge_id = s.id
    WHERE s.scraped_at < NOW() - INTERVAL '30 days'
    AND u.created_at > NOW() - INTERVAL '7 days'
    GROUP BY s.source_id, s.url, s.scraped_at
    HAVING COUNT(u.id) > 10
    
    UNION ALL
    
    -- Medium-priority: Knowledge with declining performance
    SELECT DISTINCT
        s.source_id,
        s.url,
        'update'::TEXT,
        6::INTEGER,
        'declining_performance'::TEXT
    FROM scraped_knowledge s
    JOIN knowledge_usage_analytics u ON u.knowledge_id = s.id
    WHERE u.created_at > NOW() - INTERVAL '30 days'
    GROUP BY s.source_id, s.url
    HAVING 
        AVG(CASE WHEN u.created_at > NOW() - INTERVAL '7 days' THEN u.performance_score END) <
        AVG(CASE WHEN u.created_at <= NOW() - INTERVAL '7 days' THEN u.performance_score END)
    
    UNION ALL
    
    -- Low-priority: Old knowledge with moderate usage
    SELECT DISTINCT
        s.source_id,
        s.url,
        'update'::TEXT,
        3::INTEGER,
        'routine_update'::TEXT
    FROM scraped_knowledge s
    WHERE s.scraped_at < NOW() - INTERVAL '60 days'
    AND EXISTS (
        SELECT 1 FROM knowledge_usage_analytics u 
        WHERE u.knowledge_id = s.id 
        AND u.created_at > NOW() - INTERVAL '30 days'
    )
    
    ORDER BY priority DESC, reason
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to track knowledge access patterns
CREATE OR REPLACE FUNCTION track_knowledge_access(
    p_knowledge_id UUID,
    p_knowledge_type TEXT,
    p_agent_id TEXT,
    p_action_type TEXT,
    p_context JSONB DEFAULT '{}',
    p_performance_score FLOAT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_analytics_id UUID;
BEGIN
    -- Insert usage analytics
    INSERT INTO knowledge_usage_analytics (
        knowledge_id,
        knowledge_type,
        agent_id,
        action_type,
        context,
        performance_score
    ) VALUES (
        p_knowledge_id,
        p_knowledge_type,
        p_agent_id,
        p_action_type,
        p_context,
        p_performance_score
    ) RETURNING id INTO v_analytics_id;
    
    -- Update access patterns for learned relationships
    PERFORM update_learned_relationships(p_knowledge_id, p_context);
    
    RETURN v_analytics_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update learned relationships based on access patterns
CREATE OR REPLACE FUNCTION update_learned_relationships(
    p_knowledge_id UUID,
    p_context JSONB
) RETURNS VOID AS $$
DECLARE
    v_related_ids UUID[];
    v_related_id UUID;
BEGIN
    -- Extract related knowledge IDs from context
    v_related_ids := ARRAY(
        SELECT jsonb_array_elements_text(p_context->'related_knowledge_ids')::UUID
    );
    
    -- Update or create relationships
    FOREACH v_related_id IN ARRAY v_related_ids LOOP
        INSERT INTO learned_knowledge_relationships (
            source_knowledge_id,
            target_knowledge_id,
            relationship_type,
            strength,
            confidence,
            evidence_count
        ) VALUES (
            p_knowledge_id,
            v_related_id,
            'co_accessed',
            0.5,
            0.5,
            1
        )
        ON CONFLICT (source_knowledge_id, target_knowledge_id, relationship_type)
        DO UPDATE SET
            strength = LEAST(1.0, learned_knowledge_relationships.strength + 0.05),
            confidence = LEAST(1.0, learned_knowledge_relationships.confidence + 0.02),
            evidence_count = learned_knowledge_relationships.evidence_count + 1,
            last_observed = NOW(),
            updated_at = NOW();
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to create monitoring alert
CREATE OR REPLACE FUNCTION create_monitoring_alert(
    p_alert_type TEXT,
    p_severity TEXT,
    p_title TEXT,
    p_description TEXT,
    p_affected_items JSONB DEFAULT '[]'
) RETURNS UUID AS $$
DECLARE
    v_alert_id UUID;
BEGIN
    INSERT INTO knowledge_monitoring_alerts (
        alert_type,
        severity,
        title,
        description,
        affected_items
    ) VALUES (
        p_alert_type,
        p_severity,
        p_title,
        p_description,
        p_affected_items
    ) RETURNING id INTO v_alert_id;
    
    RETURN v_alert_id;
END;
$$ LANGUAGE plpgsql;

-- Scheduled job to process knowledge updates
SELECT cron.schedule(
    'process-knowledge-updates',
    '*/15 * * * *', -- Every 15 minutes
    $$
    UPDATE knowledge_update_queue
    SET status = 'processing',
        last_attempt = NOW(),
        attempts = attempts + 1
    WHERE status = 'pending'
    AND scheduled_for <= NOW()
    AND attempts < 3
    LIMIT 10;
    $$
);

-- Scheduled job to calculate performance metrics
SELECT cron.schedule(
    'calculate-knowledge-metrics',
    '0 * * * *', -- Every hour
    $$
    INSERT INTO knowledge_performance_metrics (metric_type, metric_value, dimensions, period_start, period_end)
    SELECT 
        'retrieval_accuracy',
        AVG(performance_score),
        jsonb_build_object('period', 'hourly'),
        NOW() - INTERVAL '1 hour',
        NOW()
    FROM knowledge_usage_analytics
    WHERE created_at >= NOW() - INTERVAL '1 hour'
    AND performance_score IS NOT NULL;
    $$
);

-- Scheduled job to detect deprecated knowledge
SELECT cron.schedule(
    'detect-deprecated-knowledge',
    '0 2 * * *', -- Daily at 2 AM
    $$
    INSERT INTO knowledge_monitoring_alerts (alert_type, severity, title, description, affected_items)
    SELECT 
        'deprecation',
        CASE 
            WHEN COUNT(*) > 100 THEN 'high'
            WHEN COUNT(*) > 50 THEN 'medium'
            ELSE 'low'
        END,
        'Deprecated Knowledge Detected',
        format('%s items identified as potentially deprecated', COUNT(*)),
        jsonb_agg(jsonb_build_object('id', knowledge_id, 'type', knowledge_type, 'reason', deprecation_reason))
    FROM detect_deprecated_knowledge()
    HAVING COUNT(*) > 0;
    $$
);

-- Table for tracking learning cycles
CREATE TABLE IF NOT EXISTS learning_cycles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cycle_id TEXT UNIQUE NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    items_processed INTEGER DEFAULT 0,
    items_validated INTEGER DEFAULT 0,
    items_integrated INTEGER DEFAULT 0,
    insights TEXT[] DEFAULT '{}',
    errors TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for knowledge archive
CREATE TABLE IF NOT EXISTS knowledge_archive (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    original_id UUID NOT NULL,
    content JSONB NOT NULL,
    archived_at TIMESTAMPTZ DEFAULT NOW(),
    archive_reason TEXT NOT NULL
);

-- Table for knowledge versions
CREATE TABLE IF NOT EXISTS knowledge_versions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    knowledge_id UUID NOT NULL,
    version_id TEXT NOT NULL,
    previous_version_id TEXT,
    change_type TEXT NOT NULL, -- major, minor, patch
    changes TEXT[] DEFAULT '{}',
    content_snapshot TEXT,
    metadata_snapshot JSONB,
    archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(knowledge_id, version_id)
);

-- Table for knowledge migrations
CREATE TABLE IF NOT EXISTS knowledge_migrations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    old_knowledge_id UUID NOT NULL,
    new_knowledge_id UUID,
    migration_plan JSONB NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, in_progress, completed, failed
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for new tables
CREATE INDEX idx_learning_cycles_start ON learning_cycles(start_time DESC);
CREATE INDEX idx_learning_cycles_cycle_id ON learning_cycles(cycle_id);

CREATE INDEX idx_knowledge_archive_original ON knowledge_archive(original_id);
CREATE INDEX idx_knowledge_archive_reason ON knowledge_archive(archive_reason);

CREATE INDEX idx_knowledge_versions_knowledge ON knowledge_versions(knowledge_id);
CREATE INDEX idx_knowledge_versions_version ON knowledge_versions(version_id);
CREATE INDEX idx_knowledge_versions_archived ON knowledge_versions(archived) WHERE NOT archived;

CREATE INDEX idx_knowledge_migrations_old ON knowledge_migrations(old_knowledge_id);
CREATE INDEX idx_knowledge_migrations_status ON knowledge_migrations(status);

-- Function to update learned relationship with increment
CREATE OR REPLACE FUNCTION update_learned_relationship(
    p_source_id UUID,
    p_target_id UUID,
    p_relationship_type TEXT,
    p_strength_increment FLOAT
) RETURNS VOID AS $$
BEGIN
    INSERT INTO learned_knowledge_relationships (
        source_knowledge_id,
        target_knowledge_id,
        relationship_type,
        strength,
        confidence,
        evidence_count,
        last_observed
    ) VALUES (
        p_source_id,
        p_target_id,
        p_relationship_type,
        p_strength_increment,
        0.5,
        1,
        NOW()
    )
    ON CONFLICT (source_knowledge_id, target_knowledge_id, relationship_type)
    DO UPDATE SET
        strength = LEAST(1.0, learned_knowledge_relationships.strength + p_strength_increment),
        confidence = LEAST(1.0, learned_knowledge_relationships.confidence + 0.02),
        evidence_count = learned_knowledge_relationships.evidence_count + 1,
        last_observed = NOW(),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;