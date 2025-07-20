-- Universal LLM System Tables
-- Supports any LLM, anywhere, with automatic routing and optimization

-- LLM Models Registry
CREATE TABLE IF NOT EXISTS llm_models (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('local', 'edge', 'cloud', 'distributed', 'ensemble')),
  engine TEXT, -- tensorflow, onnx, transformers, custom
  task TEXT[] NOT NULL, -- embedding, completion, code-fix, analysis, custom
  endpoint TEXT,
  function_name TEXT, -- for edge functions
  model_path TEXT, -- for local models
  worker_path TEXT, -- for worker thread models
  use_worker BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}',
  auth JSONB DEFAULT '{}', -- authentication config
  cost_per_token DECIMAL(10, 8),
  max_tokens INTEGER,
  supported_languages TEXT[],
  capabilities JSONB DEFAULT '{}',
  health_status TEXT DEFAULT 'unknown',
  last_health_check TIMESTAMPTZ,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensemble Model Configurations
CREATE TABLE IF NOT EXISTS llm_ensemble_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ensemble_model_id TEXT REFERENCES llm_models(id),
  member_model_id TEXT REFERENCES llm_models(id),
  weight FLOAT DEFAULT 1.0,
  voting_strategy TEXT DEFAULT 'weighted_average',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Distributed Model Nodes
CREATE TABLE IF NOT EXISTS llm_distributed_nodes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id TEXT REFERENCES llm_models(id),
  node_url TEXT NOT NULL,
  node_name TEXT,
  capacity INTEGER,
  current_load INTEGER DEFAULT 0,
  health_status TEXT DEFAULT 'unknown',
  last_heartbeat TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- LLM Inference History
CREATE TABLE IF NOT EXISTS llm_inferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id TEXT REFERENCES llm_models(id),
  task_type TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  input_size INTEGER,
  output_summary TEXT,
  output_size INTEGER,
  latency_ms INTEGER,
  tokens_used INTEGER,
  cost DECIMAL(10, 6),
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Model Performance Metrics
CREATE TABLE IF NOT EXISTS llm_performance_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id TEXT REFERENCES llm_models(id),
  metric_type TEXT NOT NULL,
  metric_value FLOAT NOT NULL,
  task_type TEXT,
  measurement_period TEXT, -- hourly, daily, weekly
  metadata JSONB DEFAULT '{}',
  measured_at TIMESTAMPTZ DEFAULT NOW()
);

-- A/B Testing Results
CREATE TABLE IF NOT EXISTS model_ab_tests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  model_a_id TEXT REFERENCES llm_models(id),
  model_b_id TEXT REFERENCES llm_models(id),
  task TEXT NOT NULL,
  input_hash TEXT,
  result_a JSONB,
  result_b JSONB,
  latency_a_ms INTEGER,
  latency_b_ms INTEGER,
  cost_a DECIMAL(10, 6),
  cost_b DECIMAL(10, 6),
  winner TEXT,
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Model Fine-tuning Jobs
CREATE TABLE IF NOT EXISTS llm_finetuning_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  base_model_id TEXT REFERENCES llm_models(id),
  new_model_id TEXT,
  status TEXT DEFAULT 'pending',
  training_data_url TEXT,
  validation_data_url TEXT,
  hyperparameters JSONB DEFAULT '{}',
  metrics JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cached Inferences
CREATE TABLE IF NOT EXISTS llm_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key TEXT UNIQUE NOT NULL,
  model_id TEXT REFERENCES llm_models(id),
  task_type TEXT,
  input_embedding vector(384), -- for semantic cache lookup
  result JSONB NOT NULL,
  hit_count INTEGER DEFAULT 0,
  last_accessed TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Model Routing Rules
CREATE TABLE IF NOT EXISTS llm_routing_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_name TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  conditions JSONB NOT NULL, -- task type, input patterns, etc.
  preferred_models TEXT[], -- ordered list of model IDs
  fallback_models TEXT[],
  constraints JSONB DEFAULT '{}', -- max latency, cost, etc.
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_llm_models_type ON llm_models(type);
CREATE INDEX idx_llm_models_task ON llm_models USING gin(task);
CREATE INDEX idx_llm_models_enabled ON llm_models(enabled);

CREATE INDEX idx_llm_inferences_model ON llm_inferences(model_id);
CREATE INDEX idx_llm_inferences_task ON llm_inferences(task_type);
CREATE INDEX idx_llm_inferences_created ON llm_inferences(created_at DESC);
CREATE INDEX idx_llm_inferences_input_hash ON llm_inferences(input_hash);

CREATE INDEX idx_llm_cache_key ON llm_cache(cache_key);
CREATE INDEX idx_llm_cache_expires ON llm_cache(expires_at);
CREATE INDEX idx_llm_cache_embedding ON llm_cache 
USING ivfflat (input_embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX idx_model_ab_tests_models ON model_ab_tests(model_a_id, model_b_id);
CREATE INDEX idx_model_ab_tests_timestamp ON model_ab_tests(timestamp DESC);

-- Functions for model management

-- Get best model for task
CREATE OR REPLACE FUNCTION get_best_model_for_task(
  p_task TEXT,
  p_constraints JSONB DEFAULT '{}'
)
RETURNS TABLE (
  model_id TEXT,
  model_name TEXT,
  model_type TEXT,
  score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH model_scores AS (
    SELECT 
      m.id,
      m.name,
      m.type,
      -- Calculate score based on performance metrics
      COALESCE(
        (SELECT AVG(metric_value) 
         FROM llm_performance_metrics pm 
         WHERE pm.model_id = m.id 
           AND pm.task_type = p_task
           AND pm.metric_type = 'success_rate'
           AND pm.measured_at > NOW() - INTERVAL '7 days'),
        0.5
      ) * 100 AS base_score,
      -- Apply constraint penalties
      CASE 
        WHEN p_constraints->>'requireLocal' = 'true' AND m.type != 'local' THEN 0
        ELSE 1
      END AS constraint_multiplier
    FROM llm_models m
    WHERE p_task = ANY(m.task)
      AND m.enabled = true
      AND m.health_status != 'offline'
  )
  SELECT 
    id AS model_id,
    name AS model_name,
    type AS model_type,
    base_score * constraint_multiplier AS score
  FROM model_scores
  WHERE base_score * constraint_multiplier > 0
  ORDER BY score DESC
  LIMIT 10;
END;
$$;

-- Update model health status
CREATE OR REPLACE FUNCTION update_model_health(
  p_model_id TEXT,
  p_status TEXT,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE llm_models
  SET 
    health_status = p_status,
    last_health_check = NOW(),
    updated_at = NOW()
  WHERE id = p_model_id;
  
  -- Log the health check
  INSERT INTO llm_performance_metrics (
    model_id,
    metric_type,
    metric_value,
    metadata
  ) VALUES (
    p_model_id,
    'health_check',
    CASE p_status 
      WHEN 'healthy' THEN 1.0
      WHEN 'degraded' THEN 0.5
      ELSE 0.0
    END,
    p_metadata
  );
END;
$$;

-- Semantic cache lookup
CREATE OR REPLACE FUNCTION lookup_semantic_cache(
  p_task TEXT,
  p_input_embedding vector(384),
  p_similarity_threshold FLOAT DEFAULT 0.95
)
RETURNS TABLE (
  cache_id UUID,
  result JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.result,
    1 - (c.input_embedding <=> p_input_embedding) AS similarity
  FROM llm_cache c
  WHERE c.task_type = p_task
    AND (c.expires_at IS NULL OR c.expires_at > NOW())
    AND 1 - (c.input_embedding <=> p_input_embedding) > p_similarity_threshold
  ORDER BY c.input_embedding <=> p_input_embedding
  LIMIT 1;
  
  -- Update hit count if found
  UPDATE llm_cache
  SET 
    hit_count = hit_count + 1,
    last_accessed = NOW()
  WHERE id IN (
    SELECT cache_id FROM lookup_semantic_cache
  );
END;
$$;

-- Calculate model costs
CREATE OR REPLACE FUNCTION calculate_inference_cost(
  p_model_id TEXT,
  p_tokens INTEGER
)
RETURNS DECIMAL(10, 6)
LANGUAGE plpgsql
AS $$
DECLARE
  v_cost_per_token DECIMAL(10, 8);
BEGIN
  SELECT cost_per_token INTO v_cost_per_token
  FROM llm_models
  WHERE id = p_model_id;
  
  RETURN COALESCE(v_cost_per_token * p_tokens, 0);
END;
$$;

-- Get model recommendations
CREATE OR REPLACE FUNCTION get_model_recommendations(
  p_task TEXT,
  p_budget DECIMAL DEFAULT NULL,
  p_max_latency INTEGER DEFAULT NULL
)
RETURNS TABLE (
  model_id TEXT,
  model_name TEXT,
  avg_latency_ms INTEGER,
  avg_cost DECIMAL,
  success_rate FLOAT,
  recommendation_score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH model_stats AS (
    SELECT 
      m.id,
      m.name,
      AVG(i.latency_ms) AS avg_latency,
      AVG(i.cost) AS avg_cost,
      AVG(CASE WHEN i.success THEN 1.0 ELSE 0.0 END) AS success_rate
    FROM llm_models m
    LEFT JOIN llm_inferences i ON m.id = i.model_id
    WHERE p_task = ANY(m.task)
      AND m.enabled = true
      AND i.created_at > NOW() - INTERVAL '30 days'
    GROUP BY m.id, m.name
  )
  SELECT 
    id AS model_id,
    name AS model_name,
    avg_latency::INTEGER AS avg_latency_ms,
    avg_cost,
    success_rate,
    -- Calculate recommendation score
    (
      success_rate * 0.4 +
      CASE 
        WHEN p_max_latency IS NULL THEN 0.3
        ELSE (1 - LEAST(avg_latency / p_max_latency, 1)) * 0.3
      END +
      CASE 
        WHEN p_budget IS NULL THEN 0.3
        ELSE (1 - LEAST(avg_cost / p_budget, 1)) * 0.3
      END
    ) AS recommendation_score
  FROM model_stats
  WHERE (p_budget IS NULL OR avg_cost <= p_budget)
    AND (p_max_latency IS NULL OR avg_latency <= p_max_latency)
  ORDER BY recommendation_score DESC;
END;
$$;

-- Insert default models
INSERT INTO llm_models (id, name, type, engine, task, config) VALUES
('local-miniLM', 'MiniLM Local', 'local', 'transformers', ARRAY['embedding'], '{"model": "all-MiniLM-L6-v2"}'),
('edge-gte-small', 'GTE Small Edge', 'edge', 'supabase', ARRAY['embedding'], '{"function": "generate-embedding"}'),
('ollama-codellama', 'CodeLlama Local', 'cloud', 'ollama', ARRAY['code-fix', 'completion'], '{"model": "codellama:7b"}'),
('openai-gpt4', 'GPT-4 Turbo', 'cloud', 'openai', ARRAY['code-fix', 'completion', 'analysis'], '{"model": "gpt-4-turbo-preview"}')
ON CONFLICT (id) DO NOTHING;

-- Trigger to update timestamps
CREATE TRIGGER update_llm_models_updated_at BEFORE UPDATE ON llm_models
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_llm_routing_rules_updated_at BEFORE UPDATE ON llm_routing_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();