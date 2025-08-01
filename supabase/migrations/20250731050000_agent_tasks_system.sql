-- Agent Tasks System
-- Required by Agent Registry for orchestration and task tracking

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- AGENT TASKS TABLE
-- ==========================================

-- Main tasks table for agent orchestration
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY, -- Custom task ID format: task_{timestamp}_{random}
  agent_name TEXT NOT NULL, -- Primary agent handling the task
  supporting_agents TEXT[] DEFAULT '{}', -- Array of supporting agent names
  user_request TEXT NOT NULL, -- Original user request
  context JSONB DEFAULT '{}', -- Task context and parameters
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  result JSONB, -- Task execution results
  error_details TEXT, -- Error information if task failed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_agent_name ON tasks(agent_name);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_supporting_agents ON tasks USING GIN(supporting_agents);

-- ==========================================
-- AGENT PERFORMANCE TRACKING
-- ==========================================

-- Track agent performance metrics
CREATE TABLE IF NOT EXISTS agent_performance_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_name TEXT NOT NULL,
  task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  execution_time_ms INTEGER NOT NULL,
  success BOOLEAN NOT NULL,
  error_count INTEGER DEFAULT 0,
  memory_usage_mb FLOAT,
  tokens_used INTEGER,
  confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1),
  capability_used TEXT, -- Which capability was primarily used
  context_tokens INTEGER, -- Context tokens consumed
  response_tokens INTEGER, -- Response tokens generated
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance analysis
CREATE INDEX IF NOT EXISTS idx_agent_performance_agent_name ON agent_performance_metrics(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_performance_success ON agent_performance_metrics(success);
CREATE INDEX IF NOT EXISTS idx_agent_performance_created_at ON agent_performance_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_performance_capability ON agent_performance_metrics(capability_used);

-- ==========================================
-- AGENT COLLABORATION SESSIONS
-- ==========================================

-- Track A2A mesh collaboration sessions
CREATE TABLE IF NOT EXISTS collaboration_sessions (
  id TEXT PRIMARY KEY, -- Session ID from A2A mesh
  initiator TEXT NOT NULL,
  participants TEXT[] NOT NULL, -- Array of participating agent names
  task TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  expected_duration_ms INTEGER,
  actual_duration_ms INTEGER,
  results JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for collaboration tracking
CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_status ON collaboration_sessions(status);
CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_initiator ON collaboration_sessions(initiator);
CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_participants ON collaboration_sessions USING GIN(participants);
CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_created_at ON collaboration_sessions(created_at);

-- ==========================================
-- KNOWLEDGE SHARING TRACKING
-- ==========================================

-- Track knowledge sharing between agents
CREATE TABLE IF NOT EXISTS agent_knowledge_sharing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_agent TEXT NOT NULL,
  knowledge_type TEXT NOT NULL,
  data JSONB NOT NULL,
  relevant_capabilities TEXT[] DEFAULT '{}',
  confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  recipients TEXT[] DEFAULT '{}', -- Agents that received the knowledge
  usage_count INTEGER DEFAULT 0, -- How many times this knowledge was used
  effectiveness_score FLOAT CHECK (effectiveness_score >= 0 AND effectiveness_score <= 1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for knowledge sharing analysis
CREATE INDEX IF NOT EXISTS idx_knowledge_sharing_from_agent ON agent_knowledge_sharing(from_agent);
CREATE INDEX IF NOT EXISTS idx_knowledge_sharing_type ON agent_knowledge_sharing(knowledge_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_sharing_capabilities ON agent_knowledge_sharing USING GIN(relevant_capabilities);
CREATE INDEX IF NOT EXISTS idx_knowledge_sharing_recipients ON agent_knowledge_sharing USING GIN(recipients);
CREATE INDEX IF NOT EXISTS idx_knowledge_sharing_created_at ON agent_knowledge_sharing(created_at);

-- ==========================================
-- HELPER FUNCTIONS
-- ==========================================

-- Function to update task status with automatic timestamps
CREATE OR REPLACE FUNCTION update_task_status(
  p_task_id TEXT,
  p_status TEXT,
  p_result JSONB DEFAULT NULL,
  p_error_details TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
  UPDATE tasks 
  SET 
    status = p_status,
    result = COALESCE(p_result, result),
    error_details = p_error_details,
    updated_at = NOW(),
    started_at = CASE 
      WHEN p_status = 'running' AND started_at IS NULL THEN NOW()
      ELSE started_at 
    END,
    completed_at = CASE 
      WHEN p_status IN ('completed', 'failed', 'cancelled') THEN NOW()
      ELSE completed_at
    END
  WHERE id = p_task_id;
END;
$$ LANGUAGE plpgsql;

-- Function to log agent performance
CREATE OR REPLACE FUNCTION log_agent_performance(
  p_agent_name TEXT,
  p_task_id TEXT,
  p_execution_time_ms INTEGER,
  p_success BOOLEAN,
  p_capability_used TEXT DEFAULT NULL,
  p_tokens_used INTEGER DEFAULT NULL,
  p_confidence_score FLOAT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  performance_id UUID;
BEGIN
  INSERT INTO agent_performance_metrics (
    agent_name, task_id, execution_time_ms, success, 
    capability_used, tokens_used, confidence_score
  ) VALUES (
    p_agent_name, p_task_id, p_execution_time_ms, p_success,
    p_capability_used, p_tokens_used, p_confidence_score
  ) RETURNING id INTO performance_id;
  
  RETURN performance_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get agent performance summary
CREATE OR REPLACE FUNCTION get_agent_performance_summary(
  p_agent_name TEXT DEFAULT NULL,
  p_days_back INTEGER DEFAULT 7
) RETURNS TABLE (
  agent_name TEXT,
  total_tasks INTEGER,
  successful_tasks INTEGER,
  success_rate FLOAT,
  avg_execution_time_ms FLOAT,
  avg_confidence_score FLOAT,
  total_tokens_used BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    apm.agent_name,
    COUNT(*)::INTEGER as total_tasks,
    COUNT(*) FILTER (WHERE apm.success)::INTEGER as successful_tasks,
    (COUNT(*) FILTER (WHERE apm.success)::FLOAT / COUNT(*)::FLOAT) as success_rate,
    AVG(apm.execution_time_ms) as avg_execution_time_ms,
    AVG(apm.confidence_score) as avg_confidence_score,
    SUM(apm.tokens_used)::BIGINT as total_tokens_used
  FROM agent_performance_metrics apm
  WHERE (p_agent_name IS NULL OR apm.agent_name = p_agent_name)
    AND apm.created_at >= NOW() - (p_days_back || ' days')::INTERVAL
  GROUP BY apm.agent_name
  ORDER BY success_rate DESC, total_tasks DESC;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- VIEWS FOR MONITORING
-- ==========================================

-- Active tasks view
CREATE OR REPLACE VIEW active_tasks AS
SELECT 
  t.id,
  t.agent_name,
  t.supporting_agents,
  t.user_request,
  t.status,
  t.priority,
  t.created_at,
  t.started_at,
  EXTRACT(EPOCH FROM (NOW() - t.created_at))::INTEGER as age_seconds,
  CASE 
    WHEN t.started_at IS NOT NULL THEN EXTRACT(EPOCH FROM (NOW() - t.started_at))::INTEGER
    ELSE NULL
  END as running_seconds
FROM tasks t
WHERE t.status IN ('pending', 'running')
ORDER BY t.priority DESC, t.created_at ASC;

-- Agent workload view
CREATE OR REPLACE VIEW agent_workload AS
SELECT 
  t.agent_name,
  COUNT(*) FILTER (WHERE t.status = 'running') as running_tasks,
  COUNT(*) FILTER (WHERE t.status = 'pending') as pending_tasks,
  COUNT(*) FILTER (WHERE t.status IN ('running', 'pending')) as total_active_tasks,
  MAX(t.created_at) as last_task_created
FROM tasks t
WHERE t.created_at >= NOW() - INTERVAL '1 hour'
GROUP BY t.agent_name
ORDER BY total_active_tasks DESC;

-- ==========================================
-- ROW LEVEL SECURITY
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaboration_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_knowledge_sharing ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for development (restrict in production)
CREATE POLICY "tasks_all_access" ON tasks FOR ALL USING (true);
CREATE POLICY "agent_performance_all_access" ON agent_performance_metrics FOR ALL USING (true);
CREATE POLICY "collaboration_sessions_all_access" ON collaboration_sessions FOR ALL USING (true);
CREATE POLICY "agent_knowledge_sharing_all_access" ON agent_knowledge_sharing FOR ALL USING (true);

-- Grant permissions
GRANT SELECT ON active_tasks TO PUBLIC;
GRANT SELECT ON agent_workload TO PUBLIC;
GRANT ALL ON tasks TO authenticated;
GRANT ALL ON agent_performance_metrics TO authenticated;
GRANT ALL ON collaboration_sessions TO authenticated;
GRANT ALL ON agent_knowledge_sharing TO authenticated;

-- ==========================================
-- INITIAL DATA
-- ==========================================

-- Insert sample task for testing (will be removed in production)
INSERT INTO tasks (
  id, agent_name, user_request, context, status, priority
) VALUES (
  'task_init_test', 'planner', 'Initialize agent registry system', 
  '{"source": "system", "test": true}', 'completed', 'low'
) ON CONFLICT (id) DO NOTHING;