-- Agent Performance Metrics Tables

-- Performance metrics table for raw data
CREATE TABLE IF NOT EXISTS agent_performance_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  task_id TEXT,
  task_name TEXT,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('execution_time', 'resource_usage', 'success_rate', 'task_complexity')),
  value NUMERIC NOT NULL,
  unit TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Aggregated metrics table for trend analysis
CREATE TABLE IF NOT EXISTS agent_performance_aggregated (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('minute', 'hour', 'day', 'week', 'month')),
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  total_tasks INTEGER DEFAULT 0,
  successful_tasks INTEGER DEFAULT 0,
  failed_tasks INTEGER DEFAULT 0,
  avg_execution_time NUMERIC,
  min_execution_time NUMERIC,
  max_execution_time NUMERIC,
  avg_cpu_usage NUMERIC,
  avg_memory_usage NUMERIC,
  complexity_handled JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(agent_id, period, start_time)
);

-- Performance benchmarks table
CREATE TABLE IF NOT EXISTS agent_performance_benchmarks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_type TEXT NOT NULL,
  task_type TEXT NOT NULL,
  complexity_level INTEGER DEFAULT 1,
  expected_execution_time NUMERIC NOT NULL, -- milliseconds
  max_cpu_usage NUMERIC DEFAULT 80, -- percentage
  max_memory_usage NUMERIC DEFAULT 1024, -- MB
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(agent_type, task_type, complexity_level)
);

-- Performance alerts table
CREATE TABLE IF NOT EXISTS agent_performance_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('slow_execution', 'high_failure_rate', 'resource_overuse', 'degraded_performance')),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  threshold_value NUMERIC NOT NULL,
  actual_value NUMERIC NOT NULL,
  message TEXT NOT NULL,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_performance_metrics_agent_id ON agent_performance_metrics(agent_id);
CREATE INDEX idx_performance_metrics_timestamp ON agent_performance_metrics(timestamp);
CREATE INDEX idx_performance_metrics_metric_type ON agent_performance_metrics(metric_type);
CREATE INDEX idx_performance_metrics_task_id ON agent_performance_metrics(task_id);

CREATE INDEX idx_performance_aggregated_agent_id ON agent_performance_aggregated(agent_id);
CREATE INDEX idx_performance_aggregated_period ON agent_performance_aggregated(period);
CREATE INDEX idx_performance_aggregated_start_time ON agent_performance_aggregated(start_time);

CREATE INDEX idx_performance_alerts_agent_id ON agent_performance_alerts(agent_id);
CREATE INDEX idx_performance_alerts_resolved ON agent_performance_alerts(resolved);
CREATE INDEX idx_performance_alerts_severity ON agent_performance_alerts(severity);

-- Row Level Security
ALTER TABLE agent_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_performance_aggregated ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_performance_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_performance_alerts ENABLE ROW LEVEL SECURITY;

-- Policies for metrics (read for authenticated, write for service role)
CREATE POLICY "Authenticated users can read performance metrics" ON agent_performance_metrics
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage performance metrics" ON agent_performance_metrics
  FOR ALL
  USING (auth.role() = 'service_role');

-- Policies for aggregated metrics
CREATE POLICY "Authenticated users can read aggregated metrics" ON agent_performance_aggregated
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage aggregated metrics" ON agent_performance_aggregated
  FOR ALL
  USING (auth.role() = 'service_role');

-- Policies for benchmarks
CREATE POLICY "Authenticated users can read benchmarks" ON agent_performance_benchmarks
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage benchmarks" ON agent_performance_benchmarks
  FOR ALL
  USING (auth.role() = 'service_role');

-- Policies for alerts
CREATE POLICY "Authenticated users can read alerts" ON agent_performance_alerts
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage alerts" ON agent_performance_alerts
  FOR ALL
  USING (auth.role() = 'service_role');

-- Function to aggregate performance metrics
CREATE OR REPLACE FUNCTION aggregate_performance_metrics(p_period TEXT)
RETURNS VOID AS $$
DECLARE
  v_interval INTERVAL;
  v_start_time TIMESTAMP WITH TIME ZONE;
  v_end_time TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Determine interval based on period
  CASE p_period
    WHEN 'minute' THEN v_interval := INTERVAL '1 minute';
    WHEN 'hour' THEN v_interval := INTERVAL '1 hour';
    WHEN 'day' THEN v_interval := INTERVAL '1 day';
    WHEN 'week' THEN v_interval := INTERVAL '1 week';
    WHEN 'month' THEN v_interval := INTERVAL '1 month';
    ELSE RAISE EXCEPTION 'Invalid period: %', p_period;
  END CASE;

  -- Calculate time window
  v_end_time := date_trunc(p_period, NOW());
  v_start_time := v_end_time - v_interval;

  -- Insert aggregated data
  INSERT INTO agent_performance_aggregated (
    agent_id,
    period,
    start_time,
    end_time,
    total_tasks,
    successful_tasks,
    failed_tasks,
    avg_execution_time,
    min_execution_time,
    max_execution_time,
    avg_cpu_usage,
    avg_memory_usage,
    complexity_handled
  )
  SELECT 
    m.agent_id,
    p_period,
    v_start_time,
    v_end_time,
    COUNT(DISTINCT m.task_id) as total_tasks,
    COUNT(DISTINCT CASE WHEN m.metadata->>'success' = 'true' THEN m.task_id END) as successful_tasks,
    COUNT(DISTINCT CASE WHEN m.metadata->>'success' = 'false' THEN m.task_id END) as failed_tasks,
    AVG(CASE WHEN m.metric_type = 'execution_time' THEN m.value END) as avg_execution_time,
    MIN(CASE WHEN m.metric_type = 'execution_time' THEN m.value END) as min_execution_time,
    MAX(CASE WHEN m.metric_type = 'execution_time' THEN m.value END) as max_execution_time,
    AVG(CASE WHEN m.metric_type = 'resource_usage' THEN m.value END) as avg_cpu_usage,
    AVG(CASE WHEN m.metric_type = 'resource_usage' THEN (m.metadata->>'memory_mb')::numeric END) as avg_memory_usage,
    jsonb_object_agg(
      COALESCE((m.metadata->>'complexity')::text, '0'),
      COUNT(DISTINCT m.task_id)
    ) FILTER (WHERE m.metadata->>'complexity' IS NOT NULL) as complexity_handled
  FROM agent_performance_metrics m
  WHERE m.timestamp >= v_start_time 
    AND m.timestamp < v_end_time
  GROUP BY m.agent_id
  ON CONFLICT (agent_id, period, start_time) 
  DO UPDATE SET
    total_tasks = EXCLUDED.total_tasks,
    successful_tasks = EXCLUDED.successful_tasks,
    failed_tasks = EXCLUDED.failed_tasks,
    avg_execution_time = EXCLUDED.avg_execution_time,
    min_execution_time = EXCLUDED.min_execution_time,
    max_execution_time = EXCLUDED.max_execution_time,
    avg_cpu_usage = EXCLUDED.avg_cpu_usage,
    avg_memory_usage = EXCLUDED.avg_memory_usage,
    complexity_handled = EXCLUDED.complexity_handled;
END;
$$ LANGUAGE plpgsql;

-- Function to check performance against benchmarks
CREATE OR REPLACE FUNCTION check_performance_benchmarks()
RETURNS TRIGGER AS $$
DECLARE
  v_benchmark RECORD;
  v_alert_message TEXT;
BEGIN
  -- Only check execution time metrics
  IF NEW.metric_type != 'execution_time' THEN
    RETURN NEW;
  END IF;

  -- Find relevant benchmark
  SELECT * INTO v_benchmark
  FROM agent_performance_benchmarks
  WHERE agent_type = NEW.agent_type
    AND task_type = COALESCE(NEW.metadata->>'task_type', 'default')
    AND complexity_level = COALESCE((NEW.metadata->>'complexity')::integer, 1);

  IF v_benchmark IS NOT NULL THEN
    -- Check if execution time exceeds benchmark
    IF NEW.value > v_benchmark.expected_execution_time * 1.5 THEN
      v_alert_message := format(
        'Agent %s exceeded execution time benchmark: %sms (expected: %sms)',
        NEW.agent_name,
        NEW.value::text,
        v_benchmark.expected_execution_time::text
      );
      
      INSERT INTO agent_performance_alerts (
        agent_id,
        alert_type,
        severity,
        threshold_value,
        actual_value,
        message
      ) VALUES (
        NEW.agent_id,
        'slow_execution',
        CASE 
          WHEN NEW.value > v_benchmark.expected_execution_time * 2 THEN 'critical'
          ELSE 'warning'
        END,
        v_benchmark.expected_execution_time,
        NEW.value,
        v_alert_message
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to check benchmarks
CREATE TRIGGER check_performance_benchmarks_trigger
  AFTER INSERT ON agent_performance_metrics
  FOR EACH ROW
  EXECUTE FUNCTION check_performance_benchmarks();

-- Function to calculate agent reliability score
CREATE OR REPLACE FUNCTION calculate_agent_reliability(p_agent_id TEXT, p_days INTEGER DEFAULT 7)
RETURNS NUMERIC AS $$
DECLARE
  v_success_rate NUMERIC;
  v_consistency NUMERIC;
  v_performance_score NUMERIC;
BEGIN
  WITH recent_metrics AS (
    SELECT 
      COUNT(DISTINCT task_id) as total_tasks,
      COUNT(DISTINCT CASE WHEN metadata->>'success' = 'true' THEN task_id END) as successful_tasks,
      STDDEV(value) FILTER (WHERE metric_type = 'execution_time') as execution_time_stddev,
      AVG(value) FILTER (WHERE metric_type = 'execution_time') as avg_execution_time
    FROM agent_performance_metrics
    WHERE agent_id = p_agent_id
      AND timestamp >= NOW() - INTERVAL '1 day' * p_days
  )
  SELECT 
    CASE 
      WHEN total_tasks = 0 THEN 100
      ELSE (successful_tasks::numeric / total_tasks) * 100
    END as success_rate,
    CASE
      WHEN avg_execution_time IS NULL OR avg_execution_time = 0 THEN 100
      ELSE GREATEST(0, 100 - (COALESCE(execution_time_stddev, 0) / avg_execution_time * 100))
    END as consistency
  INTO v_success_rate, v_consistency
  FROM recent_metrics;

  -- Calculate overall reliability score (70% success rate, 30% consistency)
  v_performance_score := (v_success_rate * 0.7) + (v_consistency * 0.3);

  RETURN ROUND(v_performance_score, 2);
END;
$$ LANGUAGE plpgsql;

-- View for agent performance dashboard
CREATE OR REPLACE VIEW agent_performance_summary AS
SELECT 
  a.id as agent_id,
  a.name as agent_name,
  a.type as agent_type,
  a.status as current_status,
  calculate_agent_reliability(a.id, 7) as reliability_score,
  (
    SELECT COUNT(DISTINCT task_id)
    FROM agent_performance_metrics m
    WHERE m.agent_id = a.id
      AND m.timestamp >= NOW() - INTERVAL '24 hours'
  ) as tasks_last_24h,
  (
    SELECT AVG(value)
    FROM agent_performance_metrics m
    WHERE m.agent_id = a.id
      AND m.metric_type = 'execution_time'
      AND m.timestamp >= NOW() - INTERVAL '24 hours'
  ) as avg_execution_time_24h,
  (
    SELECT COUNT(*)
    FROM agent_performance_alerts al
    WHERE al.agent_id = a.id
      AND al.resolved = false
  ) as active_alerts
FROM swarm_agents a;

-- Insert default benchmarks
INSERT INTO agent_performance_benchmarks (agent_type, task_type, complexity_level, expected_execution_time, max_cpu_usage, max_memory_usage)
VALUES 
  ('cognitive', 'default', 1, 1000, 50, 512),
  ('cognitive', 'default', 2, 2000, 60, 768),
  ('cognitive', 'default', 3, 5000, 70, 1024),
  ('tool_maker', 'default', 1, 3000, 60, 1024),
  ('tool_maker', 'default', 2, 5000, 70, 1536),
  ('tool_maker', 'default', 3, 10000, 80, 2048),
  ('orchestrator', 'default', 1, 500, 40, 256),
  ('orchestrator', 'default', 2, 1000, 50, 512),
  ('orchestrator', 'default', 3, 2000, 60, 768)
ON CONFLICT (agent_type, task_type, complexity_level) DO NOTHING;