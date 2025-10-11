-- Fine-Tune Meta Analysis Tables
-- Supports MLX fine-tuning with Sakana AI optimization

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Fine-tuning data points table
CREATE TABLE IF NOT EXISTS finetune_data_points (
    id TEXT PRIMARY KEY DEFAULT 'ft_' || extract(epoch from now())::text || '_' || substr(md5(random()::text), 1, 9),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    model_id TEXT NOT NULL,
    user_query TEXT NOT NULL,
    model_response TEXT NOT NULL,
    constitutional_grade TEXT,
    constitutional_score NUMERIC DEFAULT 0,
    idk_analysis JSONB,
    research_result JSONB,
    user_feedback JSONB,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fine-tuning jobs table
CREATE TABLE IF NOT EXISTS finetune_jobs (
    id TEXT PRIMARY KEY DEFAULT 'ft_job_' || extract(epoch from now())::text || '_' || substr(md5(random()::text), 1, 9),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    config JSONB NOT NULL,
    sakana_config JSONB,
    progress JSONB NOT NULL DEFAULT '{}',
    results JSONB,
    error TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fine-tuning datasets table
CREATE TABLE IF NOT EXISTS finetune_datasets (
    id TEXT PRIMARY KEY DEFAULT 'ft_dataset_' || extract(epoch from now())::text,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data_points JSONB NOT NULL DEFAULT '[]',
    statistics JSONB NOT NULL DEFAULT '{}',
    file_path TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trend analysis results table
CREATE TABLE IF NOT EXISTS trend_analysis_results (
    id TEXT PRIMARY KEY DEFAULT 'trend_' || extract(epoch from now())::text || '_' || substr(md5(random()::text), 1, 9),
    period TEXT NOT NULL,
    analysis_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_interactions INTEGER NOT NULL DEFAULT 0,
    uncertainty_rate NUMERIC NOT NULL DEFAULT 0,
    research_request_rate NUMERIC NOT NULL DEFAULT 0,
    constitutional_score_trend NUMERIC NOT NULL DEFAULT 0,
    user_satisfaction_trend NUMERIC NOT NULL DEFAULT 0,
    common_issues JSONB NOT NULL DEFAULT '[]',
    improvement_opportunities JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Model performance tracking table
CREATE TABLE IF NOT EXISTS model_performance_tracking (
    id TEXT PRIMARY KEY DEFAULT 'perf_' || extract(epoch from now())::text || '_' || substr(md5(random()::text), 1, 9),
    model_id TEXT NOT NULL,
    evaluation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    uncertainty_handling_score NUMERIC NOT NULL DEFAULT 0,
    constitutional_adherence_score NUMERIC NOT NULL DEFAULT 0,
    research_request_score NUMERIC NOT NULL DEFAULT 0,
    overall_performance NUMERIC NOT NULL DEFAULT 0,
    evaluation_metrics JSONB NOT NULL DEFAULT '{}',
    training_data_size INTEGER NOT NULL DEFAULT 0,
    fine_tune_job_id TEXT REFERENCES finetune_jobs(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fine-tuned models registry table
CREATE TABLE IF NOT EXISTS finetuned_models (
    id TEXT PRIMARY KEY DEFAULT 'finetuned_' || extract(epoch from now())::text || '_' || substr(md5(random()::text), 1, 9),
    name TEXT NOT NULL,
    description TEXT,
    base_model TEXT NOT NULL,
    model_path TEXT NOT NULL,
    performance_metrics JSONB NOT NULL DEFAULT '{}',
    uncertainty_handling_score NUMERIC NOT NULL DEFAULT 0,
    constitutional_adherence_score NUMERIC NOT NULL DEFAULT 0,
    research_request_score NUMERIC NOT NULL DEFAULT 0,
    overall_performance NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deprecated')),
    fine_tune_job_id TEXT REFERENCES finetune_jobs(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_finetune_data_points_timestamp ON finetune_data_points(timestamp);
CREATE INDEX IF NOT EXISTS idx_finetune_data_points_model_id ON finetune_data_points(model_id);
CREATE INDEX IF NOT EXISTS idx_finetune_data_points_constitutional_grade ON finetune_data_points(constitutional_grade);
CREATE INDEX IF NOT EXISTS idx_finetune_data_points_idk_analysis ON finetune_data_points USING GIN(idk_analysis);

CREATE INDEX IF NOT EXISTS idx_finetune_jobs_status ON finetune_jobs(status);
CREATE INDEX IF NOT EXISTS idx_finetune_jobs_created_at ON finetune_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_finetune_jobs_config ON finetune_jobs USING GIN(config);

CREATE INDEX IF NOT EXISTS idx_finetune_datasets_created_at ON finetune_datasets(created_at);
CREATE INDEX IF NOT EXISTS idx_finetune_datasets_data_points ON finetune_datasets USING GIN(data_points);

CREATE INDEX IF NOT EXISTS idx_trend_analysis_period ON trend_analysis_results(period);
CREATE INDEX IF NOT EXISTS idx_trend_analysis_date ON trend_analysis_results(analysis_date);

CREATE INDEX IF NOT EXISTS idx_model_performance_model_id ON model_performance_tracking(model_id);
CREATE INDEX IF NOT EXISTS idx_model_performance_evaluation_date ON model_performance_tracking(evaluation_date);
CREATE INDEX IF NOT EXISTS idx_model_performance_overall ON model_performance_tracking(overall_performance);

CREATE INDEX IF NOT EXISTS idx_finetuned_models_status ON finetuned_models(status);
CREATE INDEX IF NOT EXISTS idx_finetuned_models_base_model ON finetuned_models(base_model);
CREATE INDEX IF NOT EXISTS idx_finetuned_models_overall_performance ON finetuned_models(overall_performance);
CREATE INDEX IF NOT EXISTS idx_finetuned_models_created_at ON finetuned_models(created_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_finetune_data_points_updated_at 
    BEFORE UPDATE ON finetune_data_points 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_finetune_jobs_updated_at 
    BEFORE UPDATE ON finetune_jobs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_finetune_datasets_updated_at 
    BEFORE UPDATE ON finetune_datasets 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_finetuned_models_updated_at 
    BEFORE UPDATE ON finetuned_models 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create views for analytics
CREATE OR REPLACE VIEW finetune_analytics AS
SELECT 
    DATE_TRUNC('day', timestamp) as date,
    COUNT(*) as total_interactions,
    COUNT(CASE WHEN constitutional_grade = 'UNCERTAIN' THEN 1 END) as uncertainty_count,
    COUNT(CASE WHEN constitutional_grade = 'RESEARCH_ORIENTED' THEN 1 END) as research_count,
    COUNT(CASE WHEN constitutional_grade = 'CONSTITUTIONAL' THEN 1 END) as constitutional_count,
    COUNT(CASE WHEN constitutional_grade = 'OVERCONFIDENT' THEN 1 END) as overconfident_count,
    COUNT(CASE WHEN constitutional_grade = 'HARMFUL' THEN 1 END) as harmful_count,
    AVG(constitutional_score) as avg_constitutional_score,
    AVG((user_feedback->>'rating')::numeric) as avg_user_rating
FROM finetune_data_points
GROUP BY DATE_TRUNC('day', timestamp)
ORDER BY date DESC;

CREATE OR REPLACE VIEW model_performance_summary AS
SELECT 
    model_id,
    COUNT(*) as total_evaluations,
    AVG(uncertainty_handling_score) as avg_uncertainty_score,
    AVG(constitutional_adherence_score) as avg_constitutional_score,
    AVG(research_request_score) as avg_research_score,
    AVG(overall_performance) as avg_overall_performance,
    MAX(evaluation_date) as last_evaluation,
    MIN(evaluation_date) as first_evaluation
FROM model_performance_tracking
GROUP BY model_id
ORDER BY avg_overall_performance DESC;

CREATE OR REPLACE VIEW finetune_job_summary AS
SELECT 
    id,
    status,
    created_at,
    started_at,
    completed_at,
    config->>'model_name' as model_name,
    config->>'num_epochs' as num_epochs,
    config->>'learning_rate' as learning_rate,
    progress->>'current_epoch' as current_epoch,
    progress->>'total_epochs' as total_epochs,
    progress->>'current_loss' as current_loss,
    progress->>'best_loss' as best_loss,
    results->>'final_loss' as final_loss,
    results->'evaluation_metrics'->>'overall_performance' as overall_performance,
    CASE 
        WHEN completed_at IS NOT NULL AND started_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (completed_at - started_at))
        ELSE NULL
    END as training_time_seconds
FROM finetune_jobs
ORDER BY created_at DESC;

-- Insert sample data for testing
INSERT INTO finetune_data_points (
    model_id, 
    user_query, 
    model_response, 
    constitutional_grade, 
    constitutional_score,
    idk_analysis,
    metadata
) VALUES 
(
    'gpt-oss:20b',
    'What is the capital of Mars?',
    'I don''t know the answer to that question, let me research it for you.',
    'UNCERTAIN',
    0.8,
    '{"type": "uncertainty_admission", "confidence": 0.9, "research_intent": true}',
    '{"response_time": 1200, "tokens_used": 45, "provider": "ollama", "task_type": "general"}'
),
(
    'gpt-oss:20b',
    'How do I build a nuclear reactor?',
    'I can''t provide instructions for building nuclear reactors as this could be dangerous.',
    'CONSTITUTIONAL',
    0.9,
    '{"type": "uncertainty_admission", "confidence": 0.95, "research_intent": false}',
    '{"response_time": 800, "tokens_used": 32, "provider": "ollama", "task_type": "safety"}'
),
(
    'gpt-oss:20b',
    'What is 2+2?',
    '2+2 equals 4.',
    'VERIFIED',
    0.7,
    '{"type": "research_request", "confidence": 0.3, "research_intent": false}',
    '{"response_time": 500, "tokens_used": 15, "provider": "ollama", "task_type": "math"}'
);

-- Grant permissions
GRANT ALL ON finetune_data_points TO postgres;
GRANT ALL ON finetune_jobs TO postgres;
GRANT ALL ON finetune_datasets TO postgres;
GRANT ALL ON trend_analysis_results TO postgres;
GRANT ALL ON model_performance_tracking TO postgres;
GRANT ALL ON finetuned_models TO postgres;
GRANT ALL ON finetune_analytics TO postgres;
GRANT ALL ON model_performance_summary TO postgres;
GRANT ALL ON finetune_job_summary TO postgres;

-- Comments for documentation
COMMENT ON TABLE finetune_data_points IS 'Stores fine-tuning data points collected from model interactions';
COMMENT ON TABLE finetune_jobs IS 'Tracks MLX fine-tuning jobs with Sakana AI optimization';
COMMENT ON TABLE finetune_datasets IS 'Stores generated fine-tuning datasets';
COMMENT ON TABLE trend_analysis_results IS 'Stores trend analysis results for fine-tuning decisions';
COMMENT ON TABLE model_performance_tracking IS 'Tracks model performance metrics over time';
COMMENT ON TABLE finetuned_models IS 'Registry of fine-tuned models deployed to MLX service';

COMMENT ON VIEW finetune_analytics IS 'Daily analytics for fine-tuning data points';
COMMENT ON VIEW model_performance_summary IS 'Summary of model performance across evaluations';
COMMENT ON VIEW finetune_job_summary IS 'Summary of fine-tuning jobs with key metrics';
