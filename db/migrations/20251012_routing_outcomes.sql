-- Autonomous Evolution: Routing Outcomes Tracking
-- Captures every routing decision for TRM retraining

CREATE TABLE IF NOT EXISTS routing_outcomes (
  id BIGSERIAL PRIMARY KEY,
  prompt TEXT NOT NULL,
  policy JSONB NOT NULL,
  selected_model TEXT NOT NULL,
  latency_ms INTEGER NOT NULL,
  success BOOLEAN,
  user_feedback SMALLINT CHECK (user_feedback BETWEEN 1 AND 5),
  error TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_routing_outcomes_created_at ON routing_outcomes (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_routing_outcomes_success ON routing_outcomes (success);
CREATE INDEX IF NOT EXISTS idx_routing_outcomes_model ON routing_outcomes (selected_model);
CREATE INDEX IF NOT EXISTS idx_routing_outcomes_feedback ON routing_outcomes (user_feedback) WHERE user_feedback IS NOT NULL;

-- TRM training runs tracking
CREATE TABLE IF NOT EXISTS trm_training_runs (
  id BIGSERIAL PRIMARY KEY,
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  samples_used INTEGER NOT NULL,
  baseline_accuracy REAL,
  new_accuracy REAL,
  improvement REAL,
  safety_regressions INTEGER DEFAULT 0,
  adapter_path TEXT,
  metrics JSONB,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'promoted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trm_training_runs_status ON trm_training_runs (status);
CREATE INDEX IF NOT EXISTS idx_trm_training_runs_created_at ON trm_training_runs (created_at DESC);

-- Learned patterns (for auto-heal integration)
CREATE TABLE IF NOT EXISTS learned_patterns (
  id BIGSERIAL PRIMARY KEY,
  pattern_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  success_rate REAL NOT NULL DEFAULT 0.0,
  usage_count INTEGER NOT NULL DEFAULT 0,
  tags TEXT[],
  pattern_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learned_patterns_type ON learned_patterns (pattern_type);
CREATE INDEX IF NOT EXISTS idx_learned_patterns_success_rate ON learned_patterns (success_rate DESC);
CREATE INDEX IF NOT EXISTS idx_learned_patterns_tags ON learned_patterns USING GIN (tags);

-- Comments
COMMENT ON TABLE routing_outcomes IS 'Captures every routing decision for TRM learning';
COMMENT ON TABLE trm_training_runs IS 'Tracks TRM model retraining sessions';
COMMENT ON TABLE learned_patterns IS 'Auto-discovered patterns from autonomous healing';

