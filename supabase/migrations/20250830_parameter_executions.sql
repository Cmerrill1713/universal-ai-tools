-- Migration: Create parameter_executions table for intelligent parameter analytics
-- Date: 2025-08-30
-- Description: Tracks parameter execution performance for ML-based optimization

-- Create parameter_executions table
CREATE TABLE IF NOT EXISTS public.parameter_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model TEXT NOT NULL,
  task_type TEXT NOT NULL,
  parameters JSONB NOT NULL,
  response_time INTEGER NOT NULL, -- in milliseconds
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  token_count INTEGER,
  quality_score DECIMAL(3,2) CHECK (quality_score >= 0 AND quality_score <= 1),
  user_id UUID,
  session_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_parameter_executions_model ON public.parameter_executions(model);
CREATE INDEX IF NOT EXISTS idx_parameter_executions_task_type ON public.parameter_executions(task_type);
CREATE INDEX IF NOT EXISTS idx_parameter_executions_success ON public.parameter_executions(success);
CREATE INDEX IF NOT EXISTS idx_parameter_executions_created_at ON public.parameter_executions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_parameter_executions_quality ON public.parameter_executions(quality_score) WHERE quality_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_parameter_executions_response_time ON public.parameter_executions(response_time);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_parameter_executions_model_task ON public.parameter_executions(model, task_type);

-- Create table for aggregated parameter performance
CREATE TABLE IF NOT EXISTS public.parameter_performance_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model TEXT NOT NULL,
  task_type TEXT NOT NULL,
  parameter_set JSONB NOT NULL,
  avg_response_time DECIMAL(10,2),
  success_rate DECIMAL(3,2),
  avg_quality_score DECIMAL(3,2),
  execution_count INTEGER DEFAULT 1,
  last_execution TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(model, task_type, parameter_set)
);

-- Create indexes for performance stats
CREATE INDEX IF NOT EXISTS idx_parameter_performance_model ON public.parameter_performance_stats(model);
CREATE INDEX IF NOT EXISTS idx_parameter_performance_task ON public.parameter_performance_stats(task_type);
CREATE INDEX IF NOT EXISTS idx_parameter_performance_success_rate ON public.parameter_performance_stats(success_rate DESC);
CREATE INDEX IF NOT EXISTS idx_parameter_performance_quality ON public.parameter_performance_stats(avg_quality_score DESC);

-- Create function to update performance stats
CREATE OR REPLACE FUNCTION update_parameter_performance_stats()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.parameter_performance_stats (
    model,
    task_type,
    parameter_set,
    avg_response_time,
    success_rate,
    avg_quality_score,
    execution_count,
    last_execution
  )
  VALUES (
    NEW.model,
    NEW.task_type,
    NEW.parameters,
    NEW.response_time,
    CASE WHEN NEW.success THEN 1.0 ELSE 0.0 END,
    NEW.quality_score,
    1,
    NEW.created_at
  )
  ON CONFLICT (model, task_type, parameter_set)
  DO UPDATE SET
    avg_response_time = (
      parameter_performance_stats.avg_response_time * parameter_performance_stats.execution_count + EXCLUDED.avg_response_time
    ) / (parameter_performance_stats.execution_count + 1),
    success_rate = (
      parameter_performance_stats.success_rate * parameter_performance_stats.execution_count + EXCLUDED.success_rate
    ) / (parameter_performance_stats.execution_count + 1),
    avg_quality_score = CASE 
      WHEN EXCLUDED.avg_quality_score IS NOT NULL AND parameter_performance_stats.avg_quality_score IS NOT NULL THEN
        (parameter_performance_stats.avg_quality_score * parameter_performance_stats.execution_count + EXCLUDED.avg_quality_score) / (parameter_performance_stats.execution_count + 1)
      WHEN EXCLUDED.avg_quality_score IS NOT NULL THEN
        EXCLUDED.avg_quality_score
      ELSE
        parameter_performance_stats.avg_quality_score
    END,
    execution_count = parameter_performance_stats.execution_count + 1,
    last_execution = EXCLUDED.last_execution,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update stats on new executions
CREATE TRIGGER update_performance_stats_trigger
  AFTER INSERT ON public.parameter_executions
  FOR EACH ROW
  EXECUTE FUNCTION update_parameter_performance_stats();

-- Add RLS policies
ALTER TABLE public.parameter_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parameter_performance_stats ENABLE ROW LEVEL SECURITY;

-- Policy for reading parameter executions (authenticated users can read all)
CREATE POLICY "parameter_executions_read_policy" ON public.parameter_executions
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Policy for inserting parameter executions (authenticated users can insert)
CREATE POLICY "parameter_executions_insert_policy" ON public.parameter_executions
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Policy for reading performance stats (everyone can read)
CREATE POLICY "parameter_performance_stats_read_policy" ON public.parameter_performance_stats
  FOR SELECT
  USING (true);

-- Grant necessary permissions
GRANT ALL ON public.parameter_executions TO authenticated;
GRANT ALL ON public.parameter_performance_stats TO authenticated;
GRANT SELECT ON public.parameter_performance_stats TO anon;

-- Add comments for documentation
COMMENT ON TABLE public.parameter_executions IS 'Tracks individual parameter execution performance for ML optimization';
COMMENT ON TABLE public.parameter_performance_stats IS 'Aggregated statistics for parameter performance by model and task type';
COMMENT ON COLUMN public.parameter_executions.quality_score IS 'Quality score from 0 to 1, where 1 is best';
COMMENT ON COLUMN public.parameter_performance_stats.success_rate IS 'Success rate from 0 to 1, where 1 is 100% success';