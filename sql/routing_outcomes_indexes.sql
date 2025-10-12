-- Composite indexes for routing_outcomes table
-- Run after creating the routing_outcomes table

-- Fast time-window scans & model pivots
CREATE INDEX IF NOT EXISTS idx_routing_outcomes_created_model
ON routing_outcomes (created_at DESC, selected_model);

-- Speed up "recent success rate" queries
CREATE INDEX IF NOT EXISTS idx_routing_outcomes_success_time
ON routing_outcomes (success, created_at DESC);

-- Fast filtering by model + success
CREATE INDEX IF NOT EXISTS idx_routing_outcomes_model_success
ON routing_outcomes (selected_model, success);

-- Latency percentile queries
CREATE INDEX IF NOT EXISTS idx_routing_outcomes_latency
ON routing_outcomes (latency_ms);

-- Policy analysis (JSONB GIN index)
CREATE INDEX IF NOT EXISTS idx_routing_outcomes_policy_gin
ON routing_outcomes USING GIN (policy);

-- Comment with usage examples
COMMENT ON INDEX idx_routing_outcomes_created_model IS 
'Optimizes queries like: SELECT * FROM routing_outcomes WHERE created_at > NOW() - INTERVAL ''7 days'' ORDER BY created_at DESC';

COMMENT ON INDEX idx_routing_outcomes_success_time IS
'Optimizes: SELECT COUNT(*) FROM routing_outcomes WHERE success = true AND created_at > NOW() - INTERVAL ''1 hour''';

