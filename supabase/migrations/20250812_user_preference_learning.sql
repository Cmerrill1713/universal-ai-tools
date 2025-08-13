-- User Preference Learning System Tables
-- Supports personalized model selection and adaptive learning
-- Generated: 2025-08-12

-- User preferences table - stores learned preferences for each user
CREATE TABLE IF NOT EXISTS user_preferences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- User identification
  user_id text NOT NULL UNIQUE,
  
  -- Learned preferences (JSONB for flexibility)
  model_preferences jsonb DEFAULT '{}'::jsonb,
  task_preferences jsonb DEFAULT '{}'::jsonb,
  general_preferences jsonb DEFAULT '{
    "responseSpeed": "balanced",
    "creativityLevel": 0.5,
    "technicalDetail": 0.5,
    "explainationDepth": 0.5,
    "preferredTone": "neutral",
    "languageComplexity": "moderate"
  }'::jsonb,
  
  -- Adaptive learning weights
  adaptive_weights jsonb DEFAULT '{
    "recencyWeight": 0.2,
    "frequencyWeight": 0.2,
    "ratingWeight": 0.3,
    "contextWeight": 0.2,
    "performanceWeight": 0.1
  }'::jsonb,
  
  -- Version control for preferences
  version integer DEFAULT 1,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- User interactions table - stores all user interactions for learning
CREATE TABLE IF NOT EXISTS user_interactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- User and session identification
  user_id text NOT NULL,
  session_id text NOT NULL,
  
  -- Interaction details
  interaction_type text NOT NULL CHECK (interaction_type IN (
    'model_selection', 
    'prompt_submission', 
    'response_rating', 
    'correction', 
    'regeneration'
  )),
  
  -- Model information
  model_id text NOT NULL,
  provider_id text NOT NULL,
  
  -- Content
  prompt text,
  response text,
  
  -- Feedback
  rating integer CHECK (rating BETWEEN 1 AND 5),
  feedback text,
  
  -- Context and metadata
  context jsonb DEFAULT '{}'::jsonb,
  task_type text,
  response_time integer, -- in milliseconds
  token_count integer,
  was_regenerated boolean DEFAULT false,
  corrections text[],
  
  -- Timestamp
  timestamp timestamptz DEFAULT now()
);

-- Model performance analytics - aggregated performance metrics
CREATE TABLE IF NOT EXISTS model_performance_analytics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Model identification
  model_id text NOT NULL,
  provider_id text NOT NULL,
  
  -- Time period for analytics
  date_period date NOT NULL, -- Daily aggregation
  
  -- Usage statistics
  total_uses integer DEFAULT 0,
  unique_users integer DEFAULT 0,
  
  -- Performance metrics
  avg_rating decimal(3,2),
  avg_response_time integer, -- milliseconds
  success_rate decimal(3,2), -- 0.00 to 1.00
  regeneration_rate decimal(3,2), -- frequency of regenerations
  
  -- Task-specific metrics
  task_performance jsonb DEFAULT '{}'::jsonb,
  
  -- Context analysis
  context_patterns jsonb DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Unique constraint for model/provider/date combination
  UNIQUE(model_id, provider_id, date_period)
);

-- User similarity matrix for collaborative filtering
CREATE TABLE IF NOT EXISTS user_similarity_matrix (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- User pair
  user_id_1 text NOT NULL,
  user_id_2 text NOT NULL,
  
  -- Similarity score (0.0 to 1.0)
  similarity_score decimal(5,4) NOT NULL,
  
  -- Similarity components
  model_similarity decimal(5,4),
  task_similarity decimal(5,4),
  preference_similarity decimal(5,4),
  
  -- Last calculation timestamp
  calculated_at timestamptz DEFAULT now(),
  
  -- Ensure unique pairs and no self-similarity
  CHECK (user_id_1 != user_id_2),
  UNIQUE(user_id_1, user_id_2)
);

-- Preference learning experiments - A/B testing for learning algorithms
CREATE TABLE IF NOT EXISTS preference_learning_experiments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Experiment details
  experiment_name text NOT NULL,
  experiment_type text NOT NULL CHECK (experiment_type IN (
    'learning_rate', 
    'weight_optimization', 
    'collaborative_filtering', 
    'context_importance'
  )),
  
  -- Parameters
  parameters jsonb NOT NULL,
  
  -- User assignment
  assigned_users text[],
  
  -- Status
  status text NOT NULL DEFAULT 'created' CHECK (status IN (
    'created', 'running', 'completed', 'cancelled'
  )),
  
  -- Results
  results jsonb DEFAULT '{}'::jsonb,
  
  -- Performance metrics
  improvement_score decimal(5,4), -- compared to baseline
  statistical_significance decimal(5,4),
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_user_id ON user_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_session ON user_interactions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_timestamp ON user_interactions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_user_interactions_model ON user_interactions(model_id, provider_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_type ON user_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_user_interactions_rating ON user_interactions(rating) WHERE rating IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_model_performance_model ON model_performance_analytics(model_id, provider_id);
CREATE INDEX IF NOT EXISTS idx_model_performance_date ON model_performance_analytics(date_period DESC);
CREATE INDEX IF NOT EXISTS idx_model_performance_rating ON model_performance_analytics(avg_rating DESC) WHERE avg_rating IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_similarity_user1 ON user_similarity_matrix(user_id_1);
CREATE INDEX IF NOT EXISTS idx_user_similarity_user2 ON user_similarity_matrix(user_id_2);
CREATE INDEX IF NOT EXISTS idx_user_similarity_score ON user_similarity_matrix(similarity_score DESC);

CREATE INDEX IF NOT EXISTS idx_experiments_status ON preference_learning_experiments(status);
CREATE INDEX IF NOT EXISTS idx_experiments_type ON preference_learning_experiments(experiment_type);

-- Create function to update updated_at timestamps (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_user_preferences_updated_at 
    BEFORE UPDATE ON user_preferences 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_model_performance_updated_at 
    BEFORE UPDATE ON model_performance_analytics 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_performance_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_similarity_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE preference_learning_experiments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for secure access
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
        -- Users can access their own preferences
        EXECUTE 'CREATE POLICY "Users can access own preferences" ON user_preferences
            FOR ALL USING (auth.uid()::text = user_id)';

        -- Users can access their own interactions
        EXECUTE 'CREATE POLICY "Users can access own interactions" ON user_interactions
            FOR ALL USING (auth.uid()::text = user_id)';

        -- Model performance analytics are readable by authenticated users
        EXECUTE 'CREATE POLICY "Authenticated users can read model analytics" ON model_performance_analytics
            FOR SELECT USING (auth.role() = ''authenticated'')';

        -- Only service role can write model analytics
        EXECUTE 'CREATE POLICY "Service role can write model analytics" ON model_performance_analytics
            FOR INSERT WITH CHECK (auth.role() = ''service_role'')';

        EXECUTE 'CREATE POLICY "Service role can update model analytics" ON model_performance_analytics
            FOR UPDATE USING (auth.role() = ''service_role'')';

        -- User similarity matrix policies
        EXECUTE 'CREATE POLICY "Users can read similarities involving them" ON user_similarity_matrix
            FOR SELECT USING (
                auth.uid()::text = user_id_1 OR 
                auth.uid()::text = user_id_2
            )';

        -- Only service role can manage similarity matrix
        EXECUTE 'CREATE POLICY "Service role can manage similarity matrix" ON user_similarity_matrix
            FOR ALL USING (auth.role() = ''service_role'')';

        -- Experiment policies - admins only
        EXECUTE 'CREATE POLICY "Admins can manage experiments" ON preference_learning_experiments
            FOR ALL USING (auth.jwt() ->> ''role'' = ''admin'')';

        -- Users can see experiments they are part of
        EXECUTE 'CREATE POLICY "Users can see their experiments" ON preference_learning_experiments
            FOR SELECT USING (auth.uid()::text = ANY(assigned_users))';
    END IF;
END $$;

-- Create functions for preference analytics

-- Function to calculate model popularity
CREATE OR REPLACE FUNCTION get_model_popularity(
    days_back integer DEFAULT 30
) RETURNS TABLE (
    model_id text,
    provider_id text,
    usage_count bigint,
    unique_users bigint,
    avg_rating numeric,
    trend text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ui.model_id,
        ui.provider_id,
        COUNT(*) as usage_count,
        COUNT(DISTINCT ui.user_id) as unique_users,
        AVG(ui.rating) as avg_rating,
        CASE 
            WHEN COUNT(*) > (
                SELECT AVG(daily_count) 
                FROM (
                    SELECT COUNT(*) as daily_count 
                    FROM user_interactions ui2 
                    WHERE ui2.model_id = ui.model_id 
                      AND ui2.provider_id = ui.provider_id
                      AND ui2.timestamp >= now() - interval '60 days'
                    GROUP BY DATE(ui2.timestamp)
                ) daily_stats
            ) THEN 'increasing'
            ELSE 'stable'
        END as trend
    FROM user_interactions ui
    WHERE ui.timestamp >= now() - interval '1 day' * days_back
    GROUP BY ui.model_id, ui.provider_id
    ORDER BY usage_count DESC, avg_rating DESC;
END;
$$;

-- Function to get user preference insights
CREATE OR REPLACE FUNCTION get_user_preference_insights(
    target_user_id text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
    user_prefs record;
BEGIN
    -- Get user preferences
    SELECT * INTO user_prefs 
    FROM user_preferences 
    WHERE user_id = target_user_id;
    
    IF NOT FOUND THEN
        RETURN '{"error": "User not found"}'::jsonb;
    END IF;
    
    -- Build insights
    SELECT jsonb_build_object(
        'userId', target_user_id,
        'profileVersion', user_prefs.version,
        'lastUpdated', user_prefs.updated_at,
        'modelCount', jsonb_object_keys(user_prefs.model_preferences),
        'taskCount', jsonb_object_keys(user_prefs.task_preferences),
        'generalPreferences', user_prefs.general_preferences,
        'adaptiveWeights', user_prefs.adaptive_weights,
        'recentActivity', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'timestamp', ui.timestamp,
                    'model', ui.model_id || ':' || ui.provider_id,
                    'rating', ui.rating,
                    'taskType', ui.task_type
                )
            )
            FROM user_interactions ui 
            WHERE ui.user_id = target_user_id 
              AND ui.timestamp >= now() - interval '7 days'
            ORDER BY ui.timestamp DESC 
            LIMIT 10
        )
    ) INTO result;
    
    RETURN result;
END;
$$;

-- Function to calculate user similarity (for collaborative filtering)
CREATE OR REPLACE FUNCTION calculate_user_similarity(
    user1_id text,
    user2_id text
) RETURNS decimal(5,4)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    similarity decimal(5,4) := 0.0;
    prefs1 record;
    prefs2 record;
    common_models integer := 0;
    total_dimensions integer := 0;
BEGIN
    -- Get both user preferences
    SELECT * INTO prefs1 FROM user_preferences WHERE user_id = user1_id;
    SELECT * INTO prefs2 FROM user_preferences WHERE user_id = user2_id;
    
    IF NOT FOUND THEN
        RETURN 0.0;
    END IF;
    
    -- Calculate model preference similarity
    -- This is simplified - in production would use more sophisticated similarity measures
    SELECT COUNT(*) INTO common_models
    FROM (
        SELECT jsonb_object_keys(prefs1.model_preferences) as model_key
        INTERSECT
        SELECT jsonb_object_keys(prefs2.model_preferences) as model_key
    ) common;
    
    IF common_models > 0 THEN
        similarity := common_models::decimal / 
            (jsonb_object_keys(prefs1.model_preferences) ||
             jsonb_object_keys(prefs2.model_preferences))::decimal;
    END IF;
    
    RETURN LEAST(1.0, similarity);
END;
$$;

-- Create materialized view for model performance summary
CREATE MATERIALIZED VIEW IF NOT EXISTS model_performance_summary AS
SELECT 
    model_id,
    provider_id,
    COUNT(*) as total_interactions,
    COUNT(DISTINCT user_id) as unique_users,
    AVG(rating) FILTER (WHERE rating IS NOT NULL) as avg_rating,
    COUNT(*) FILTER (WHERE rating >= 4) * 100.0 / COUNT(*) as satisfaction_rate,
    AVG(response_time) FILTER (WHERE response_time IS NOT NULL) as avg_response_time,
    COUNT(*) FILTER (WHERE was_regenerated = true) * 100.0 / COUNT(*) as regeneration_rate,
    MAX(timestamp) as last_used,
    COUNT(DISTINCT task_type) as supported_tasks
FROM user_interactions
WHERE timestamp >= now() - interval '30 days'
GROUP BY model_id, provider_id;

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_model_perf_summary_unique 
ON model_performance_summary(model_id, provider_id);

-- Grant permissions for authenticated users
GRANT SELECT ON model_performance_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_model_popularity(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_preference_insights(text) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_user_similarity(text, text) TO service_role;

-- Refresh materialized view daily (would be set up as a cron job)
-- This is just documentation of the refresh strategy
COMMENT ON MATERIALIZED VIEW model_performance_summary IS 
'Refreshed daily via cron job: REFRESH MATERIALIZED VIEW CONCURRENTLY model_performance_summary;';