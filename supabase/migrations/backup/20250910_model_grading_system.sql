-- Model Iteration Grading System Tables
-- Supports 3-stage reward system and continuous model evolution

-- Model grading results table
CREATE TABLE IF NOT EXISTS model_grading_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    overall_score NUMERIC(5,2) NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
    reward_score INTEGER NOT NULL CHECK (reward_score IN (-1, 0, 1)),
    metrics JSONB NOT NULL,
    improvement_areas TEXT[] DEFAULT '{}',
    fine_tuning_suggestions JSONB DEFAULT '[]',
    model_version TEXT DEFAULT 'current',
    response_text TEXT,
    expected_answer TEXT,
    user_feedback JSONB,
    context JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Model iterations tracking
CREATE TABLE IF NOT EXISTS model_iterations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    iteration_id TEXT UNIQUE NOT NULL,
    model_version TEXT NOT NULL,
    baseline_score NUMERIC(5,2),
    current_score NUMERIC(5,2),
    improvement_trend TEXT CHECK (improvement_trend IN ('improving', 'degrading', 'stable')),
    training_data_size INTEGER DEFAULT 0,
    retrain_threshold NUMERIC(5,2) DEFAULT 75.0,
    next_training_cycle TIMESTAMPTZ,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'training', 'deprecated')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fine-tuning training data
CREATE TABLE IF NOT EXISTS fine_tuning_training_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    iteration_id TEXT REFERENCES model_iterations(iteration_id),
    input_text TEXT NOT NULL,
    expected_output TEXT,
    reward_score INTEGER CHECK (reward_score IN (-1, 0, 1)),
    data_type TEXT CHECK (data_type IN ('positive_example', 'uncertainty_example', 'hallucination_example')),
    difficulty_level TEXT CHECK (difficulty_level IN ('simple', 'medium', 'complex', 'expert')),
    validation_status TEXT DEFAULT 'pending' CHECK (validation_status IN ('pending', 'validated', 'rejected')),
    human_validated BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance trend tracking
CREATE TABLE IF NOT EXISTS model_performance_trends (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    model_version TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value NUMERIC(10,6) NOT NULL,
    trend_direction TEXT CHECK (trend_direction IN ('up', 'down', 'stable')),
    measurement_window INTERVAL DEFAULT '7 days',
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(model_version, metric_name, calculated_at::date)
);

-- Knowledge base evolution tracking
CREATE TABLE IF NOT EXISTS knowledge_evolution_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    query TEXT NOT NULL,
    initial_response TEXT,
    improved_response TEXT,
    knowledge_sources TEXT[],
    improvement_type TEXT CHECK (improvement_type IN ('accuracy', 'honesty', 'knowledge_seeking')),
    confidence_before NUMERIC(3,2),
    confidence_after NUMERIC(3,2),
    user_satisfaction_before INTEGER CHECK (user_satisfaction_before BETWEEN 1 AND 5),
    user_satisfaction_after INTEGER CHECK (user_satisfaction_after BETWEEN 1 AND 5),
    evolution_trigger TEXT CHECK (evolution_trigger IN ('user_feedback', 'automated_detection', 'knowledge_update')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_grading_results_timestamp ON model_grading_results(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_grading_results_reward_score ON model_grading_results(reward_score);
CREATE INDEX IF NOT EXISTS idx_grading_results_overall_score ON model_grading_results(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_grading_results_model_version ON model_grading_results(model_version);

CREATE INDEX IF NOT EXISTS idx_iterations_version ON model_iterations(model_version);
CREATE INDEX IF NOT EXISTS idx_iterations_status ON model_iterations(status);
CREATE INDEX IF NOT EXISTS idx_iterations_next_training ON model_iterations(next_training_cycle);

CREATE INDEX IF NOT EXISTS idx_training_data_iteration ON fine_tuning_training_data(iteration_id);
CREATE INDEX IF NOT EXISTS idx_training_data_reward ON fine_tuning_training_data(reward_score);
CREATE INDEX IF NOT EXISTS idx_training_data_type ON fine_tuning_training_data(data_type);

CREATE INDEX IF NOT EXISTS idx_performance_trends_model ON model_performance_trends(model_version, metric_name);
CREATE INDEX IF NOT EXISTS idx_performance_trends_date ON model_performance_trends(calculated_at DESC);

-- Views for analytics
CREATE OR REPLACE VIEW model_performance_summary AS
SELECT 
    model_version,
    COUNT(*) as total_responses,
    AVG(overall_score) as avg_score,
    AVG(CASE WHEN reward_score = 1 THEN 1.0 ELSE 0.0 END) as correct_rate,
    AVG(CASE WHEN reward_score = 0 THEN 1.0 ELSE 0.0 END) as honest_uncertainty_rate,
    AVG(CASE WHEN reward_score = -1 THEN 1.0 ELSE 0.0 END) as hallucination_rate,
    AVG((metrics->>'accuracy')::numeric) as avg_accuracy,
    AVG((metrics->>'intellectualHonesty')::numeric) as avg_intellectual_honesty,
    AVG((metrics->>'hallucination_rate')::numeric) as avg_hallucination_metric,
    DATE_TRUNC('day', timestamp) as day
FROM model_grading_results
GROUP BY model_version, DATE_TRUNC('day', timestamp)
ORDER BY day DESC;

-- View for improvement tracking
CREATE OR REPLACE VIEW improvement_opportunities AS
SELECT 
    UNNEST(improvement_areas) as improvement_area,
    COUNT(*) as frequency,
    AVG(overall_score) as avg_score_when_needed,
    model_version
FROM model_grading_results
WHERE array_length(improvement_areas, 1) > 0
GROUP BY UNNEST(improvement_areas), model_version
ORDER BY frequency DESC;

-- Function to automatically trigger retraining
CREATE OR REPLACE FUNCTION check_retraining_trigger()
RETURNS TRIGGER AS $$
DECLARE
    recent_avg_score NUMERIC;
    baseline_score NUMERIC;
    iteration_record RECORD;
BEGIN
    -- Calculate recent average score (last 100 responses)
    SELECT AVG(overall_score) INTO recent_avg_score
    FROM model_grading_results 
    WHERE model_version = NEW.model_version
    ORDER BY timestamp DESC 
    LIMIT 100;
    
    -- Get current iteration info
    SELECT * INTO iteration_record
    FROM model_iterations 
    WHERE model_version = NEW.model_version 
    AND status = 'active'
    LIMIT 1;
    
    -- Check if retraining is needed
    IF iteration_record IS NOT NULL AND recent_avg_score < iteration_record.retrain_threshold THEN
        -- Update iteration status
        UPDATE model_iterations 
        SET status = 'training',
            next_training_cycle = NOW() + INTERVAL '1 hour',
            updated_at = NOW()
        WHERE id = iteration_record.id;
        
        -- Log the trigger
        INSERT INTO knowledge_evolution_log (
            query, 
            improvement_type, 
            evolution_trigger
        ) VALUES (
            'Automatic retraining triggered', 
            'accuracy', 
            'automated_detection'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for automatic retraining detection
CREATE TRIGGER trigger_retraining_check
    AFTER INSERT ON model_grading_results
    FOR EACH ROW
    EXECUTE FUNCTION check_retraining_trigger();

-- RLS Policies (if using Row Level Security)
ALTER TABLE model_grading_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_iterations ENABLE ROW LEVEL SECURITY;
ALTER TABLE fine_tuning_training_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_performance_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_evolution_log ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read and write their data
CREATE POLICY "Users can manage grading results" ON model_grading_results
    FOR ALL USING (true); -- Adjust based on your auth needs

CREATE POLICY "Users can manage iterations" ON model_iterations
    FOR ALL USING (true);

CREATE POLICY "Users can manage training data" ON fine_tuning_training_data
    FOR ALL USING (true);

CREATE POLICY "Users can view performance trends" ON model_performance_trends
    FOR SELECT USING (true);

CREATE POLICY "Users can manage evolution log" ON knowledge_evolution_log
    FOR ALL USING (true);

-- Grant permissions
GRANT ALL ON model_grading_results TO authenticated;
GRANT ALL ON model_iterations TO authenticated;
GRANT ALL ON fine_tuning_training_data TO authenticated;
GRANT ALL ON model_performance_trends TO authenticated;
GRANT ALL ON knowledge_evolution_log TO authenticated;

-- Insert initial model iteration
INSERT INTO model_iterations (
    iteration_id,
    model_version,
    baseline_score,
    current_score,
    improvement_trend,
    retrain_threshold,
    next_training_cycle
) VALUES (
    'initial-v1.0',
    'v1.0',
    50.0,
    50.0,
    'stable',
    75.0,
    NOW() + INTERVAL '7 days'
) ON CONFLICT (iteration_id) DO NOTHING;