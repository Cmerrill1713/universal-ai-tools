-- Create autonomous actions tables for the Autonomous Action Loop Service

-- Table for storing autonomous actions and their metadata
CREATE TABLE IF NOT EXISTS autonomous_actions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('parameter_adjustment', 'model_switch', 'prompt_optimization', 'feature_toggle', 'configuration_update')),
  priority TEXT NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low')),

  -- Target information
  target JSONB NOT NULL,

  -- Change information
  change JSONB NOT NULL,

  -- Risk assessment
  assessment JSONB NOT NULL,

  -- Supporting evidence
  evidence JSONB NOT NULL,

  -- Execution plan
  execution JSONB NOT NULL,

  -- Status and timestamps
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'implementing', 'active', 'rolled_back', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  implemented_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Implementation results
  implementation_result JSONB
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_autonomous_actions_status ON autonomous_actions(status);
CREATE INDEX IF NOT EXISTS idx_autonomous_actions_type ON autonomous_actions(type);
CREATE INDEX IF NOT EXISTS idx_autonomous_actions_priority ON autonomous_actions(priority);
CREATE INDEX IF NOT EXISTS idx_autonomous_actions_created_at ON autonomous_actions(created_at);
-- Use btree index on text expression instead of GIN (which lacks default opclass for text)
CREATE INDEX IF NOT EXISTS idx_autonomous_actions_target_service ON autonomous_actions ((target->>'service'));

-- Table for storing learning data from autonomous action implementations
CREATE TABLE IF NOT EXISTS autonomous_learning (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id TEXT NOT NULL REFERENCES autonomous_actions(id) ON DELETE CASCADE,
  learning_data JSONB NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for efficient learning data retrieval
CREATE INDEX IF NOT EXISTS idx_autonomous_learning_action_id ON autonomous_learning(action_id);
CREATE INDEX IF NOT EXISTS idx_autonomous_learning_timestamp ON autonomous_learning(timestamp);

-- Table for tracking autonomous action metrics and performance
CREATE TABLE IF NOT EXISTS autonomous_action_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id TEXT NOT NULL REFERENCES autonomous_actions(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  metric_value DECIMAL NOT NULL,
  measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  measurement_type TEXT NOT NULL CHECK (measurement_type IN ('before', 'after', 'monitoring')),

  UNIQUE(action_id, metric_name, measurement_type)
);

-- Create indexes for metrics table
CREATE INDEX IF NOT EXISTS idx_autonomous_action_metrics_action_id ON autonomous_action_metrics(action_id);
CREATE INDEX IF NOT EXISTS idx_autonomous_action_metrics_name ON autonomous_action_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_autonomous_action_metrics_measured_at ON autonomous_action_metrics(measured_at);

-- Create a view for action performance analysis
CREATE OR REPLACE VIEW autonomous_action_performance AS
SELECT
  aa.id,
  aa.type,
  aa.priority,
  aa.status,
  aa.created_at,
  aa.implemented_at,
  aa.completed_at,
  (aa.assessment->>'riskLevel') as risk_level,
  (aa.assessment->>'confidenceScore')::DECIMAL as confidence_score,
  (aa.assessment->>'expectedImpact')::DECIMAL as expected_impact,
  CASE
    WHEN aa.implementation_result IS NOT NULL THEN
      (aa.implementation_result->>'success')::BOOLEAN
    ELSE NULL
  END as actual_success,
  CASE
    WHEN aa.implementation_result IS NOT NULL AND (aa.implementation_result->>'success')::BOOLEAN THEN
      COALESCE(
        (SELECT AVG(metric_value)
         FROM autonomous_action_metrics
         WHERE action_id = aa.id AND measurement_type = 'after'),
        0
      ) - COALESCE(
        (SELECT AVG(metric_value)
         FROM autonomous_action_metrics
         WHERE action_id = aa.id AND measurement_type = 'before'),
        0
      )
    ELSE NULL
  END as actual_improvement,
  aa.target->>'service' as target_service,
  aa.target->>'component' as target_component,
  aa.target->>'property' as target_property
FROM autonomous_actions aa;

-- Create RLS policies for security
ALTER TABLE autonomous_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE autonomous_learning ENABLE ROW LEVEL SECURITY;
ALTER TABLE autonomous_action_metrics ENABLE ROW LEVEL SECURITY;

-- Policy for autonomous actions (system access only)
CREATE POLICY "System access for autonomous actions" ON autonomous_actions
  FOR ALL USING (auth.role() = 'service_role' OR auth.uid() IS NOT NULL);

-- Policy for learning data (system access only)
CREATE POLICY "System access for autonomous learning" ON autonomous_learning
  FOR ALL USING (auth.role() = 'service_role' OR auth.uid() IS NOT NULL);

-- Policy for metrics (system access only)
CREATE POLICY "System access for autonomous metrics" ON autonomous_action_metrics
  FOR ALL USING (auth.role() = 'service_role' OR auth.uid() IS NOT NULL);

-- Grant permissions for service role
GRANT ALL ON autonomous_actions TO service_role;
GRANT ALL ON autonomous_learning TO service_role;
GRANT ALL ON autonomous_action_metrics TO service_role;
GRANT SELECT ON autonomous_action_performance TO service_role;

-- Grant read permissions for authenticated users (for monitoring)
GRANT SELECT ON autonomous_actions TO authenticated;
GRANT SELECT ON autonomous_learning TO authenticated;
GRANT SELECT ON autonomous_action_metrics TO authenticated;
GRANT SELECT ON autonomous_action_performance TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE autonomous_actions IS 'Stores autonomous actions generated by the learning systems';
COMMENT ON TABLE autonomous_learning IS 'Stores learning data from autonomous action implementations to improve future decisions';
COMMENT ON TABLE autonomous_action_metrics IS 'Stores performance metrics before/after autonomous action implementation';
COMMENT ON VIEW autonomous_action_performance IS 'Aggregated view of autonomous action performance for analysis';

-- Create function to clean up old autonomous actions (keep last 1000 records)
CREATE OR REPLACE FUNCTION cleanup_autonomous_actions() RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH old_actions AS (
    SELECT id FROM autonomous_actions
    WHERE status IN ('completed', 'rolled_back')
    ORDER BY created_at DESC
    OFFSET 1000
  )
  DELETE FROM autonomous_actions
  WHERE id IN (SELECT id FROM old_actions);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment on cleanup function
COMMENT ON FUNCTION cleanup_autonomous_actions() IS 'Cleans up old autonomous actions to prevent table bloat, keeping the 1000 most recent records';
