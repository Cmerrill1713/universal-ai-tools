-- MLX Fine-tuning Job Management Tables
-- Supports the comprehensive MLX fine-tuning service

-- Main fine-tuning jobs table
CREATE TABLE IF NOT EXISTS mlx_fine_tuning_jobs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Job identification
  job_name text NOT NULL,
  user_id text NOT NULL,
  status text NOT NULL DEFAULT 'created' 
    CHECK (status IN ('created', 'preparing', 'training', 'evaluating', 'completed', 'failed', 'cancelled', 'paused')),
  
  -- Model and dataset configuration
  base_model_name text NOT NULL,
  base_model_path text NOT NULL,
  output_model_name text NOT NULL,
  output_model_path text NOT NULL,
  dataset_path text NOT NULL,
  dataset_format text NOT NULL DEFAULT 'jsonl' CHECK (dataset_format IN ('json', 'jsonl', 'csv')),
  
  -- Training configuration
  hyperparameters jsonb NOT NULL DEFAULT '{
    "learning_rate": 0.0001,
    "batch_size": 4,
    "epochs": 3,
    "max_seq_length": 2048,
    "gradient_accumulation": 1,
    "warmup_steps": 100,
    "weight_decay": 0.01,
    "dropout": 0.1
  }'::jsonb,
  
  -- Validation configuration
  validation_config jsonb DEFAULT '{
    "split_ratio": 0.1,
    "validation_metrics": ["loss", "perplexity", "accuracy"],
    "early_stopping": true,
    "patience": 3
  }'::jsonb,
  
  -- Progress tracking
  current_epoch integer DEFAULT 0,
  total_epochs integer DEFAULT 3,
  current_step integer DEFAULT 0,
  total_steps integer DEFAULT 0,
  progress_percentage decimal(5,2) DEFAULT 0.0,
  
  -- Metrics and results
  training_metrics jsonb DEFAULT '[]'::jsonb,
  validation_metrics jsonb DEFAULT '[]'::jsonb,
  final_evaluation jsonb DEFAULT '{}'::jsonb,
  
  -- Resource usage
  estimated_duration_minutes integer,
  actual_duration_minutes integer,
  memory_usage_mb integer,
  gpu_utilization_percentage decimal(5,2),
  
  -- Error handling
  error_message text,
  error_details jsonb,
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

-- Dataset management table
CREATE TABLE IF NOT EXISTS mlx_training_datasets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Dataset identification
  dataset_name text NOT NULL,
  dataset_path text NOT NULL,
  user_id text NOT NULL,
  
  -- Dataset properties
  format text NOT NULL CHECK (format IN ('json', 'jsonl', 'csv')),
  total_samples integer NOT NULL DEFAULT 0,
  training_samples integer NOT NULL DEFAULT 0,
  validation_samples integer NOT NULL DEFAULT 0,
  
  -- Data quality metrics
  validation_results jsonb DEFAULT '{
    "is_valid": false,
    "errors": [],
    "warnings": [],
    "quality_score": 0.0
  }'::jsonb,
  
  -- Preprocessing configuration
  preprocessing_config jsonb DEFAULT '{
    "max_length": 2048,
    "truncation": true,
    "padding": true,
    "remove_duplicates": true,
    "shuffle": true
  }'::jsonb,
  
  -- Dataset statistics
  statistics jsonb DEFAULT '{
    "avg_length": 0,
    "min_length": 0,
    "max_length": 0,
    "vocab_size": 0,
    "unique_tokens": 0
  }'::jsonb,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Model evaluation results table
CREATE TABLE IF NOT EXISTS mlx_model_evaluations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Evaluation identification
  job_id uuid REFERENCES mlx_fine_tuning_jobs(id) ON DELETE CASCADE,
  model_path text NOT NULL,
  evaluation_type text NOT NULL CHECK (evaluation_type IN ('training', 'validation', 'test', 'final')),
  
  -- Evaluation metrics
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Performance scores
  perplexity decimal(10,4),
  loss decimal(10,6),
  accuracy decimal(5,4),
  bleu_score decimal(5,4),
  rouge_scores jsonb,
  
  -- Sample outputs
  sample_inputs text[],
  sample_outputs text[],
  sample_references text[],
  
  -- Evaluation configuration
  test_dataset_path text,
  evaluation_config jsonb DEFAULT '{
    "num_samples": 100,
    "max_tokens": 256,
    "temperature": 0.7,
    "top_p": 0.9
  }'::jsonb,
  
  -- Timestamps
  created_at timestamptz DEFAULT now()
);

-- Hyperparameter optimization experiments table
CREATE TABLE IF NOT EXISTS mlx_hyperparameter_experiments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Experiment identification
  experiment_name text NOT NULL,
  base_job_id uuid REFERENCES mlx_fine_tuning_jobs(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  
  -- Optimization configuration
  optimization_method text NOT NULL DEFAULT 'grid_search' 
    CHECK (optimization_method IN ('grid_search', 'random_search', 'bayesian', 'genetic')),
  parameter_space jsonb NOT NULL,
  
  -- Experiment status
  status text NOT NULL DEFAULT 'created' 
    CHECK (status IN ('created', 'running', 'completed', 'failed', 'cancelled')),
  
  -- Results tracking
  total_trials integer DEFAULT 0,
  completed_trials integer DEFAULT 0,
  best_trial_id uuid,
  best_metrics jsonb DEFAULT '{}'::jsonb,
  
  -- Trial results
  trials jsonb DEFAULT '[]'::jsonb,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

-- Fine-tuning job queue for scheduling
CREATE TABLE IF NOT EXISTS mlx_job_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Queue management
  job_id uuid REFERENCES mlx_fine_tuning_jobs(id) ON DELETE CASCADE,
  priority integer DEFAULT 5, -- 1 (highest) to 10 (lowest)
  queue_position integer,
  
  -- Resource requirements
  estimated_memory_mb integer DEFAULT 8192,
  estimated_gpu_memory_mb integer DEFAULT 4096,
  estimated_duration_minutes integer DEFAULT 60,
  
  -- Dependencies
  depends_on_job_ids uuid[],
  
  -- Scheduling
  scheduled_at timestamptz,
  started_at timestamptz,
  
  -- Status
  status text NOT NULL DEFAULT 'queued' 
    CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_mlx_jobs_status ON mlx_fine_tuning_jobs(status);
CREATE INDEX IF NOT EXISTS idx_mlx_jobs_user_id ON mlx_fine_tuning_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_mlx_jobs_created_at ON mlx_fine_tuning_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_mlx_datasets_user_id ON mlx_training_datasets(user_id);
CREATE INDEX IF NOT EXISTS idx_mlx_evaluations_job_id ON mlx_model_evaluations(job_id);
CREATE INDEX IF NOT EXISTS idx_mlx_queue_status ON mlx_job_queue(status);
CREATE INDEX IF NOT EXISTS idx_mlx_queue_priority ON mlx_job_queue(priority);

-- Create function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_mlx_jobs_updated_at 
    BEFORE UPDATE ON mlx_fine_tuning_jobs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mlx_datasets_updated_at 
    BEFORE UPDATE ON mlx_training_datasets 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mlx_experiments_updated_at 
    BEFORE UPDATE ON mlx_hyperparameter_experiments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mlx_queue_updated_at 
    BEFORE UPDATE ON mlx_job_queue 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON mlx_fine_tuning_jobs TO authenticated;
GRANT ALL ON mlx_training_datasets TO authenticated;
GRANT ALL ON mlx_model_evaluations TO authenticated;
GRANT ALL ON mlx_hyperparameter_experiments TO authenticated;
GRANT ALL ON mlx_job_queue TO authenticated;

-- Create RLS policies
ALTER TABLE mlx_fine_tuning_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mlx_training_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE mlx_model_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE mlx_hyperparameter_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mlx_job_queue ENABLE ROW LEVEL SECURITY;

-- Users can only access their own jobs and datasets
CREATE POLICY "Users can access own fine-tuning jobs" ON mlx_fine_tuning_jobs
    FOR ALL USING (auth.jwt() ->> 'sub' = user_id);

CREATE POLICY "Users can access own datasets" ON mlx_training_datasets
    FOR ALL USING (auth.jwt() ->> 'sub' = user_id);

CREATE POLICY "Users can access evaluations for their jobs" ON mlx_model_evaluations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM mlx_fine_tuning_jobs 
            WHERE id = job_id AND user_id = auth.jwt() ->> 'sub'
        )
    );

CREATE POLICY "Users can access own experiments" ON mlx_hyperparameter_experiments
    FOR ALL USING (auth.jwt() ->> 'sub' = user_id);

CREATE POLICY "Users can access queue entries for their jobs" ON mlx_job_queue
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM mlx_fine_tuning_jobs 
            WHERE id = job_id AND user_id = auth.jwt() ->> 'sub'
        )
    );