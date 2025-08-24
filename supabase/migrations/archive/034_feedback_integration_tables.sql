-- Feedback Integration System Tables
-- Comprehensive user feedback collection and closed-loop learning

-- User Feedback Table - Detailed feedback collection
CREATE TABLE IF NOT EXISTS user_feedback (
    id TEXT PRIMARY KEY,
    user_id UUID,
    session_id TEXT NOT NULL,
    execution_id TEXT NOT NULL,
    task_type TEXT NOT NULL,
    parameters JSONB NOT NULL,
    
    -- Feedback Ratings (1-5 scale)
    quality_rating INTEGER NOT NULL CHECK (quality_rating >= 1 AND quality_rating <= 5),
    speed_rating INTEGER NOT NULL CHECK (speed_rating >= 1 AND speed_rating <= 5),
    accuracy_rating INTEGER NOT NULL CHECK (accuracy_rating >= 1 AND accuracy_rating <= 5),
    usefulness_rating INTEGER NOT NULL CHECK (usefulness_rating >= 1 AND usefulness_rating <= 5),
    overall_satisfaction INTEGER NOT NULL CHECK (overall_satisfaction >= 1 AND overall_satisfaction <= 5),
    
    -- Detailed Feedback
    textual_feedback TEXT,
    improvement_suggestions JSONB DEFAULT '[]',
    preferred_parameters JSONB,
    
    -- Context
    user_intent TEXT NOT NULL,
    response_length INTEGER NOT NULL,
    expected_outcome TEXT NOT NULL,
    met_expectations BOOLEAN NOT NULL,
    
    -- Metadata
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    response_time INTEGER NOT NULL,
    model_used TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    user_agent TEXT,
    
    -- Learning Signals
    would_use_again BOOLEAN NOT NULL,
    recommend_to_others INTEGER CHECK (recommend_to_others >= 1 AND recommend_to_others <= 10),
    flagged_as_incorrect BOOLEAN DEFAULT FALSE,
    reported_issues JSONB DEFAULT '[]',
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feedback Aggregations Table - Pre-computed analytics
CREATE TABLE IF NOT EXISTS feedback_aggregations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_type TEXT NOT NULL,
    parameter_set TEXT NOT NULL,
    aggregation_period TEXT NOT NULL, -- 'daily', 'weekly', 'monthly'
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    
    -- Counts
    total_feedbacks INTEGER NOT NULL DEFAULT 0,
    positive_count INTEGER NOT NULL DEFAULT 0,
    negative_count INTEGER NOT NULL DEFAULT 0,
    neutral_count INTEGER NOT NULL DEFAULT 0,
    
    -- Average Ratings
    avg_quality_rating REAL NOT NULL DEFAULT 0,
    avg_speed_rating REAL NOT NULL DEFAULT 0,
    avg_accuracy_rating REAL NOT NULL DEFAULT 0,
    avg_usefulness_rating REAL NOT NULL DEFAULT 0,
    avg_overall_satisfaction REAL NOT NULL DEFAULT 0,
    avg_nps REAL NOT NULL DEFAULT 0,
    
    -- Sentiment Analysis
    sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral')) NOT NULL,
    sentiment_confidence REAL DEFAULT 0,
    
    -- Common Issues and Suggestions
    common_issues JSONB DEFAULT '[]',
    improvement_suggestions JSONB DEFAULT '[]',
    
    -- Performance Correlations
    correlation_with_speed REAL DEFAULT 0,
    correlation_with_accuracy REAL DEFAULT 0,
    
    -- Confidence Metrics
    feedback_reliability REAL NOT NULL DEFAULT 0,
    sample_size INTEGER NOT NULL DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(task_type, parameter_set, aggregation_period, period_start)
);

-- Feedback Insights Table - Generated actionable insights
CREATE TABLE IF NOT EXISTS feedback_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT CHECK (type IN ('parameter_adjustment', 'feature_request', 'bug_report', 'improvement_opportunity')) NOT NULL,
    priority TEXT CHECK (priority IN ('critical', 'high', 'medium', 'low')) NOT NULL,
    task_type TEXT,
    
    -- Insight Content
    insight TEXT NOT NULL,
    recommendation TEXT NOT NULL,
    impact TEXT NOT NULL,
    confidence REAL NOT NULL,
    
    -- Supporting Data
    supporting_feedbacks JSONB DEFAULT '[]',
    affected_users INTEGER NOT NULL DEFAULT 0,
    estimated_improvement REAL NOT NULL DEFAULT 0,
    
    -- Action Items
    action_items JSONB DEFAULT '[]',
    
    -- Metrics
    feedback_volume INTEGER NOT NULL DEFAULT 0,
    severity_score REAL NOT NULL DEFAULT 0,
    urgency_score REAL NOT NULL DEFAULT 0,
    
    -- Status Tracking
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'in_progress', 'completed', 'archived')),
    assigned_to TEXT,
    due_date TIMESTAMPTZ,
    resolution_notes TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Learning Signals Table - Extracted learning signals for parameter optimization
CREATE TABLE IF NOT EXISTS learning_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT CHECK (source IN ('user_feedback', 'performance_metrics', 'error_analysis', 'usage_patterns')) NOT NULL,
    signal TEXT NOT NULL,
    strength REAL NOT NULL CHECK (strength >= 0 AND strength <= 1),
    task_type TEXT NOT NULL,
    parameter_affected TEXT NOT NULL,
    recommended_action TEXT CHECK (recommended_action IN ('increase', 'decrease', 'maintain', 'experiment')) NOT NULL,
    
    -- Evidence
    evidence JSONB NOT NULL DEFAULT '[]',
    
    -- Processing Status
    processed BOOLEAN DEFAULT FALSE,
    applied BOOLEAN DEFAULT FALSE,
    applied_at TIMESTAMPTZ,
    
    -- Results
    improvement_observed REAL,
    confidence_after_application REAL,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feedback Sessions Table - Track feedback collection sessions
CREATE TABLE IF NOT EXISTS feedback_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    session_start TIMESTAMPTZ DEFAULT NOW(),
    session_end TIMESTAMPTZ,
    
    -- Session Metrics
    total_interactions INTEGER DEFAULT 0,
    feedbacks_provided INTEGER DEFAULT 0,
    avg_satisfaction REAL DEFAULT 0,
    
    -- User Context
    user_agent TEXT,
    ip_address INET,
    referrer TEXT,
    
    -- Session Quality
    completion_rate REAL DEFAULT 0,
    response_quality REAL DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- A/B Testing for Feedback Collection
CREATE TABLE IF NOT EXISTS feedback_ab_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    
    -- Test Configuration
    control_method JSONB NOT NULL,
    test_method JSONB NOT NULL,
    traffic_split REAL NOT NULL DEFAULT 0.5,
    
    -- Status
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'completed', 'paused')),
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    
    -- Results
    control_feedback_count INTEGER DEFAULT 0,
    test_feedback_count INTEGER DEFAULT 0,
    control_avg_satisfaction REAL DEFAULT 0,
    test_avg_satisfaction REAL DEFAULT 0,
    statistical_significance REAL DEFAULT 0,
    winner TEXT CHECK (winner IN ('control', 'test', 'inconclusive')),
    
    -- Metadata
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON user_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_session_id ON user_feedback(session_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_execution_id ON user_feedback(execution_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_task_type ON user_feedback(task_type);
CREATE INDEX IF NOT EXISTS idx_user_feedback_timestamp ON user_feedback(timestamp);
CREATE INDEX IF NOT EXISTS idx_user_feedback_satisfaction ON user_feedback(overall_satisfaction);
CREATE INDEX IF NOT EXISTS idx_user_feedback_flagged ON user_feedback(flagged_as_incorrect);

CREATE INDEX IF NOT EXISTS idx_feedback_aggregations_task_type ON feedback_aggregations(task_type);
CREATE INDEX IF NOT EXISTS idx_feedback_aggregations_period ON feedback_aggregations(aggregation_period, period_start);

CREATE INDEX IF NOT EXISTS idx_feedback_insights_type ON feedback_insights(type);
CREATE INDEX IF NOT EXISTS idx_feedback_insights_priority ON feedback_insights(priority);
CREATE INDEX IF NOT EXISTS idx_feedback_insights_status ON feedback_insights(status);
CREATE INDEX IF NOT EXISTS idx_feedback_insights_task_type ON feedback_insights(task_type);

CREATE INDEX IF NOT EXISTS idx_learning_signals_task_type ON learning_signals(task_type);
CREATE INDEX IF NOT EXISTS idx_learning_signals_strength ON learning_signals(strength);
CREATE INDEX IF NOT EXISTS idx_learning_signals_processed ON learning_signals(processed);
CREATE INDEX IF NOT EXISTS idx_learning_signals_source ON learning_signals(source);

CREATE INDEX IF NOT EXISTS idx_feedback_sessions_user_id ON feedback_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_sessions_start ON feedback_sessions(session_start);

-- Views for Common Queries

-- Real-time Feedback Performance View
CREATE OR REPLACE VIEW feedback_performance_realtime AS
SELECT 
    uf.task_type,
    COUNT(*) as total_feedbacks,
    AVG(uf.overall_satisfaction) as avg_satisfaction,
    AVG(uf.quality_rating) as avg_quality,
    AVG(uf.speed_rating) as avg_speed,
    AVG(uf.accuracy_rating) as avg_accuracy,
    COUNT(CASE WHEN uf.overall_satisfaction >= 4 THEN 1 END) as positive_count,
    COUNT(CASE WHEN uf.overall_satisfaction <= 2 THEN 1 END) as negative_count,
    COUNT(CASE WHEN uf.flagged_as_incorrect THEN 1 END) as flagged_count,
    MAX(uf.timestamp) as last_feedback
FROM user_feedback uf
WHERE uf.timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY uf.task_type
ORDER BY avg_satisfaction DESC;

-- Feedback Trends View
CREATE OR REPLACE VIEW feedback_trends AS
SELECT 
    DATE(uf.timestamp) as feedback_date,
    uf.task_type,
    COUNT(*) as daily_count,
    AVG(uf.overall_satisfaction) as daily_avg_satisfaction,
    COUNT(CASE WHEN uf.overall_satisfaction >= 4 THEN 1 END)::REAL / COUNT(*) as positive_rate,
    COUNT(CASE WHEN uf.flagged_as_incorrect THEN 1 END)::REAL / COUNT(*) as flag_rate
FROM user_feedback uf
WHERE uf.timestamp >= NOW() - INTERVAL '30 days'
GROUP BY DATE(uf.timestamp), uf.task_type
ORDER BY feedback_date DESC, task_type;

-- Learning Signals Priority View
CREATE OR REPLACE VIEW learning_signals_priority AS
SELECT 
    ls.id,
    ls.task_type,
    ls.signal,
    ls.strength,
    ls.parameter_affected,
    ls.recommended_action,
    ls.source,
    COUNT(CASE WHEN uf.overall_satisfaction <= 2 THEN 1 END) as supporting_negative_feedback,
    AVG(uf.overall_satisfaction) as avg_satisfaction_for_signal,
    ls.created_at
FROM learning_signals ls
LEFT JOIN user_feedback uf ON uf.task_type = ls.task_type 
    AND uf.timestamp >= ls.created_at - INTERVAL '1 day'
WHERE ls.processed = FALSE
GROUP BY ls.id, ls.task_type, ls.signal, ls.strength, ls.parameter_affected, ls.recommended_action, ls.source, ls.created_at
ORDER BY ls.strength DESC, supporting_negative_feedback DESC;

-- Functions for Analytics

-- Function to calculate feedback sentiment
CREATE OR REPLACE FUNCTION calculate_feedback_sentiment(
    avg_satisfaction REAL,
    positive_count INTEGER,
    negative_count INTEGER,
    total_count INTEGER
) RETURNS TEXT AS $$
BEGIN
    IF avg_satisfaction >= 4.0 AND positive_count::REAL / total_count > 0.6 THEN
        RETURN 'positive';
    ELSIF avg_satisfaction <= 2.0 AND negative_count::REAL / total_count > 0.4 THEN
        RETURN 'negative';
    ELSE
        RETURN 'neutral';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update feedback aggregations
CREATE OR REPLACE FUNCTION update_feedback_aggregations() RETURNS TRIGGER AS $$
BEGIN
    -- Update daily aggregation
    INSERT INTO feedback_aggregations (
        task_type,
        parameter_set,
        aggregation_period,
        period_start,
        period_end,
        total_feedbacks,
        positive_count,
        negative_count,
        neutral_count,
        avg_quality_rating,
        avg_speed_rating,
        avg_accuracy_rating,
        avg_usefulness_rating,
        avg_overall_satisfaction,
        avg_nps,
        sentiment,
        sample_size
    )
    SELECT 
        NEW.task_type,
        'daily_aggregate',
        'daily',
        DATE_TRUNC('day', NEW.timestamp),
        DATE_TRUNC('day', NEW.timestamp) + INTERVAL '1 day',
        COUNT(*),
        COUNT(CASE WHEN overall_satisfaction >= 4 THEN 1 END),
        COUNT(CASE WHEN overall_satisfaction <= 2 THEN 1 END),
        COUNT(CASE WHEN overall_satisfaction = 3 THEN 1 END),
        AVG(quality_rating),
        AVG(speed_rating),
        AVG(accuracy_rating),
        AVG(usefulness_rating),
        AVG(overall_satisfaction),
        AVG(recommend_to_others),
        calculate_feedback_sentiment(
            AVG(overall_satisfaction),
            COUNT(CASE WHEN overall_satisfaction >= 4 THEN 1 END),
            COUNT(CASE WHEN overall_satisfaction <= 2 THEN 1 END),
            COUNT(*)
        ),
        COUNT(*)
    FROM user_feedback
    WHERE task_type = NEW.task_type 
      AND DATE_TRUNC('day', timestamp) = DATE_TRUNC('day', NEW.timestamp)
    GROUP BY task_type
    ON CONFLICT (task_type, parameter_set, aggregation_period, period_start) DO UPDATE SET
        total_feedbacks = EXCLUDED.total_feedbacks,
        positive_count = EXCLUDED.positive_count,
        negative_count = EXCLUDED.negative_count,
        neutral_count = EXCLUDED.neutral_count,
        avg_quality_rating = EXCLUDED.avg_quality_rating,
        avg_speed_rating = EXCLUDED.avg_speed_rating,
        avg_accuracy_rating = EXCLUDED.avg_accuracy_rating,
        avg_usefulness_rating = EXCLUDED.avg_usefulness_rating,
        avg_overall_satisfaction = EXCLUDED.avg_overall_satisfaction,
        avg_nps = EXCLUDED.avg_nps,
        sentiment = EXCLUDED.sentiment,
        sample_size = EXCLUDED.sample_size,
        updated_at = NOW();
        
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update aggregations
CREATE TRIGGER trigger_update_feedback_aggregations
    AFTER INSERT OR UPDATE ON user_feedback
    FOR EACH ROW
    EXECUTE FUNCTION update_feedback_aggregations();

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_aggregations ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_ab_tests ENABLE ROW LEVEL SECURITY;

-- Service role can access all data
CREATE POLICY "Service role full access on user_feedback" ON user_feedback
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on feedback_aggregations" ON feedback_aggregations
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on feedback_insights" ON feedback_insights
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on learning_signals" ON learning_signals
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on feedback_sessions" ON feedback_sessions
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on feedback_ab_tests" ON feedback_ab_tests
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Users can access their own feedback
CREATE POLICY "Users can view own feedback" ON user_feedback
    FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own feedback" ON user_feedback
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own sessions" ON feedback_sessions
    FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Anonymous users can view aggregated data (no personal info)
CREATE POLICY "Anonymous can view feedback aggregations" ON feedback_aggregations
    FOR SELECT TO anon USING (true);

CREATE POLICY "Anonymous can view feedback insights" ON feedback_insights
    FOR SELECT TO anon USING (true);

-- Comments for Documentation
COMMENT ON TABLE user_feedback IS 'Detailed user feedback collection for closed-loop learning';
COMMENT ON TABLE feedback_aggregations IS 'Pre-computed feedback analytics by task type and time period';
COMMENT ON TABLE feedback_insights IS 'Generated actionable insights from feedback analysis';
COMMENT ON TABLE learning_signals IS 'Extracted learning signals for parameter optimization';
COMMENT ON TABLE feedback_sessions IS 'User feedback collection session tracking';
COMMENT ON TABLE feedback_ab_tests IS 'A/B testing experiments for feedback collection methods';

COMMENT ON VIEW feedback_performance_realtime IS 'Real-time feedback performance metrics for the last 24 hours';
COMMENT ON VIEW feedback_trends IS 'Daily feedback trends over the last 30 days';
COMMENT ON VIEW learning_signals_priority IS 'Prioritized learning signals for parameter optimization';

COMMENT ON FUNCTION calculate_feedback_sentiment IS 'Calculates overall sentiment from feedback metrics';
COMMENT ON FUNCTION update_feedback_aggregations IS 'Auto-updates feedback aggregations when new feedback is inserted';