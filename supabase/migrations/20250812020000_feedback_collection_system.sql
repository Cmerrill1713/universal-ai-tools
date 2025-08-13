-- Feedback Collection System Database Schema
-- Creates tables and functions for comprehensive feedback collection

-- Create user_feedback table
CREATE TABLE IF NOT EXISTS user_feedback (
    id text PRIMARY KEY,
    user_id text NOT NULL,
    session_id text NOT NULL,
    feedback_type text NOT NULL CHECK (feedback_type IN ('rating', 'suggestion', 'bug_report', 'feature_request', 'general')),
    category text CHECK (category IN ('model_performance', 'user_interface', 'speed', 'accuracy', 'usability', 'other')),
    rating integer CHECK (rating >= 1 AND rating <= 5),
    title text,
    description text NOT NULL,
    context jsonb DEFAULT '{}'::jsonb,
    sentiment text CHECK (sentiment IN ('positive', 'negative', 'neutral')),
    priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status text DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'in_progress', 'resolved', 'dismissed')),
    tags text[] DEFAULT ARRAY[]::text[],
    model_id text,
    provider_id text,
    response_time integer,
    attachments jsonb DEFAULT '[]'::jsonb,
    timestamp timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create feedback_analytics table for aggregated data
CREATE TABLE IF NOT EXISTS feedback_analytics (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    period_type text NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly')),
    period_start timestamptz NOT NULL,
    period_end timestamptz NOT NULL,
    total_feedback integer DEFAULT 0,
    average_rating numeric(3,2) DEFAULT 0,
    sentiment_distribution jsonb DEFAULT '{}'::jsonb,
    category_breakdown jsonb DEFAULT '{}'::jsonb,
    priority_distribution jsonb DEFAULT '{}'::jsonb,
    status_distribution jsonb DEFAULT '{}'::jsonb,
    top_issues jsonb DEFAULT '[]'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create feedback_issues table for tracking common issues
CREATE TABLE IF NOT EXISTS feedback_issues (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    issue_key text NOT NULL UNIQUE,
    description text NOT NULL,
    category text NOT NULL,
    frequency integer DEFAULT 1,
    severity text DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    affected_users integer DEFAULT 1,
    first_reported timestamptz DEFAULT now(),
    last_reported timestamptz DEFAULT now(),
    status text DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'wont_fix')),
    suggested_actions text[] DEFAULT ARRAY[]::text[],
    related_feedback_ids text[] DEFAULT ARRAY[]::text[],
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create improvement_suggestions table
CREATE TABLE IF NOT EXISTS improvement_suggestions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    type text NOT NULL CHECK (type IN ('performance', 'feature', 'ui', 'documentation')),
    description text NOT NULL,
    impact text DEFAULT 'medium' CHECK (impact IN ('low', 'medium', 'high')),
    effort text DEFAULT 'medium' CHECK (effort IN ('low', 'medium', 'high')),
    priority integer DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
    status text DEFAULT 'proposed' CHECK (status IN ('proposed', 'approved', 'in_progress', 'implemented', 'rejected')),
    related_feedback_ids text[] DEFAULT ARRAY[]::text[],
    votes integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON user_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_timestamp ON user_feedback(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_user_feedback_feedback_type ON user_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_user_feedback_category ON user_feedback(category);
CREATE INDEX IF NOT EXISTS idx_user_feedback_priority ON user_feedback(priority);
CREATE INDEX IF NOT EXISTS idx_user_feedback_status ON user_feedback(status);
CREATE INDEX IF NOT EXISTS idx_user_feedback_sentiment ON user_feedback(sentiment);
CREATE INDEX IF NOT EXISTS idx_user_feedback_rating ON user_feedback(rating);
CREATE INDEX IF NOT EXISTS idx_user_feedback_model_id ON user_feedback(model_id);

-- GIN indexes for JSONB columns
CREATE INDEX IF NOT EXISTS idx_user_feedback_context_gin ON user_feedback USING gin(context);
CREATE INDEX IF NOT EXISTS idx_user_feedback_attachments_gin ON user_feedback USING gin(attachments);
CREATE INDEX IF NOT EXISTS idx_user_feedback_tags_gin ON user_feedback USING gin(tags);

-- Analytics table indexes
CREATE INDEX IF NOT EXISTS idx_feedback_analytics_period ON feedback_analytics(period_type, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_feedback_analytics_created_at ON feedback_analytics(created_at DESC);

-- Issues table indexes
CREATE INDEX IF NOT EXISTS idx_feedback_issues_issue_key ON feedback_issues(issue_key);
CREATE INDEX IF NOT EXISTS idx_feedback_issues_category ON feedback_issues(category);
CREATE INDEX IF NOT EXISTS idx_feedback_issues_severity ON feedback_issues(severity);
CREATE INDEX IF NOT EXISTS idx_feedback_issues_frequency ON feedback_issues(frequency DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_issues_status ON feedback_issues(status);

-- Improvement suggestions indexes
CREATE INDEX IF NOT EXISTS idx_improvement_suggestions_type ON improvement_suggestions(type);
CREATE INDEX IF NOT EXISTS idx_improvement_suggestions_priority ON improvement_suggestions(priority DESC);
CREATE INDEX IF NOT EXISTS idx_improvement_suggestions_status ON improvement_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_improvement_suggestions_votes ON improvement_suggestions(votes DESC);

-- Create trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_user_feedback_updated_at ON user_feedback;
CREATE TRIGGER update_user_feedback_updated_at
    BEFORE UPDATE ON user_feedback
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_feedback_analytics_updated_at ON feedback_analytics;
CREATE TRIGGER update_feedback_analytics_updated_at
    BEFORE UPDATE ON feedback_analytics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_feedback_issues_updated_at ON feedback_issues;
CREATE TRIGGER update_feedback_issues_updated_at
    BEFORE UPDATE ON feedback_issues
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_improvement_suggestions_updated_at ON improvement_suggestions;
CREATE TRIGGER update_improvement_suggestions_updated_at
    BEFORE UPDATE ON improvement_suggestions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE improvement_suggestions ENABLE ROW LEVEL SECURITY;

-- Users can access their own feedback
DROP POLICY IF EXISTS "Users can access own feedback" ON user_feedback;
CREATE POLICY "Users can access own feedback" ON user_feedback
    FOR ALL USING (auth.uid()::text = user_id);

-- Users can insert their own feedback
DROP POLICY IF EXISTS "Users can insert own feedback" ON user_feedback;
CREATE POLICY "Users can insert own feedback" ON user_feedback
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- Analytics are viewable by authenticated users (could be restricted further)
DROP POLICY IF EXISTS "Authenticated users can view analytics" ON feedback_analytics;
CREATE POLICY "Authenticated users can view analytics" ON feedback_analytics
    FOR SELECT USING (auth.role() = 'authenticated');

-- Issues are viewable by authenticated users
DROP POLICY IF EXISTS "Authenticated users can view issues" ON feedback_issues;
CREATE POLICY "Authenticated users can view issues" ON feedback_issues
    FOR SELECT USING (auth.role() = 'authenticated');

-- Improvement suggestions are viewable by authenticated users
DROP POLICY IF EXISTS "Authenticated users can view suggestions" ON improvement_suggestions;
CREATE POLICY "Authenticated users can view suggestions" ON improvement_suggestions
    FOR SELECT USING (auth.role() = 'authenticated');

-- Create function to get feedback analytics
CREATE OR REPLACE FUNCTION get_feedback_analytics(
    p_user_id text DEFAULT NULL,
    p_start_date timestamptz DEFAULT NULL,
    p_end_date timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
    total_feedback integer;
    avg_rating numeric;
    sentiment_dist jsonb;
    category_dist jsonb;
    priority_dist jsonb;
    status_dist jsonb;
BEGIN
    -- Base query with optional filters
    WITH filtered_feedback AS (
        SELECT *
        FROM user_feedback
        WHERE 
            (p_user_id IS NULL OR user_id = p_user_id)
            AND (p_start_date IS NULL OR timestamp >= p_start_date)
            AND (p_end_date IS NULL OR timestamp <= p_end_date)
    ),
    
    -- Calculate distributions
    sentiment_agg AS (
        SELECT 
            coalesce(sentiment, 'neutral') as sentiment,
            count(*) as count
        FROM filtered_feedback
        GROUP BY sentiment
    ),
    
    category_agg AS (
        SELECT 
            coalesce(category, 'other') as category,
            count(*) as count
        FROM filtered_feedback
        GROUP BY category
    ),
    
    priority_agg AS (
        SELECT 
            coalesce(priority, 'medium') as priority,
            count(*) as count
        FROM filtered_feedback
        GROUP BY priority
    ),
    
    status_agg AS (
        SELECT 
            coalesce(status, 'new') as status,
            count(*) as count
        FROM filtered_feedback
        GROUP BY status
    )
    
    SELECT 
        count(*)::integer,
        coalesce(avg(rating), 0)::numeric(3,2),
        coalesce(jsonb_object_agg(sentiment, count), '{}'::jsonb),
        coalesce(jsonb_object_agg(category, count), '{}'::jsonb),
        coalesce(jsonb_object_agg(priority, count), '{}'::jsonb),
        coalesce(jsonb_object_agg(status, count), '{}'::jsonb)
    INTO 
        total_feedback,
        avg_rating,
        sentiment_dist,
        category_dist,
        priority_dist,
        status_dist
    FROM filtered_feedback
    CROSS JOIN sentiment_agg
    CROSS JOIN category_agg
    CROSS JOIN priority_agg
    CROSS JOIN status_agg;
    
    result := jsonb_build_object(
        'totalFeedback', total_feedback,
        'averageRating', avg_rating,
        'sentimentDistribution', sentiment_dist,
        'categoryBreakdown', category_dist,
        'priorityDistribution', priority_dist,
        'statusDistribution', status_dist
    );
    
    RETURN result;
END;
$$;

-- Create function to get top issues
CREATE OR REPLACE FUNCTION get_top_issues(p_limit integer DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
BEGIN
    WITH top_issues AS (
        SELECT 
            issue_key,
            description,
            category,
            frequency,
            severity,
            affected_users,
            suggested_actions,
            status
        FROM feedback_issues
        WHERE status != 'resolved'
        ORDER BY frequency DESC, severity DESC
        LIMIT p_limit
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'issueKey', issue_key,
            'description', description,
            'category', category,
            'frequency', frequency,
            'severity', severity,
            'affectedUsers', affected_users,
            'suggestedActions', suggested_actions,
            'status', status
        )
    )
    INTO result
    FROM top_issues;
    
    RETURN coalesce(result, '[]'::jsonb);
END;
$$;

-- Create function to update or insert feedback issue
CREATE OR REPLACE FUNCTION upsert_feedback_issue(
    p_issue_key text,
    p_description text,
    p_category text,
    p_severity text DEFAULT 'medium',
    p_feedback_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO feedback_issues (
        issue_key,
        description,
        category,
        severity,
        frequency,
        affected_users,
        related_feedback_ids
    )
    VALUES (
        p_issue_key,
        p_description,
        p_category,
        p_severity,
        1,
        1,
        CASE WHEN p_feedback_id IS NOT NULL THEN ARRAY[p_feedback_id] ELSE ARRAY[]::text[] END
    )
    ON CONFLICT (issue_key) DO UPDATE SET
        frequency = feedback_issues.frequency + 1,
        last_reported = now(),
        related_feedback_ids = array_append(feedback_issues.related_feedback_ids, p_feedback_id)
    WHERE feedback_issues.issue_key = p_issue_key;
END;
$$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON user_feedback TO authenticated;
GRANT ALL ON feedback_analytics TO authenticated;
GRANT ALL ON feedback_issues TO authenticated;
GRANT ALL ON improvement_suggestions TO authenticated;
GRANT EXECUTE ON FUNCTION get_feedback_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION get_top_issues TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_feedback_issue TO authenticated;

-- Insert some initial improvement suggestion categories
INSERT INTO improvement_suggestions (type, description, impact, effort, priority, status)
VALUES 
    ('performance', 'Optimize database queries for faster response times', 'high', 'medium', 8, 'proposed'),
    ('ui', 'Improve mobile responsiveness across all pages', 'medium', 'low', 6, 'proposed'),
    ('feature', 'Add batch processing capabilities for large datasets', 'high', 'high', 7, 'proposed'),
    ('documentation', 'Create comprehensive API documentation with examples', 'medium', 'low', 5, 'proposed')
ON CONFLICT DO NOTHING;