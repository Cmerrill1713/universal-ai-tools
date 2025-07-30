-- Swarm Orchestration Tables

-- Swarm Agents table
CREATE TABLE IF NOT EXISTS swarm_agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  capabilities JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'busy', 'error', 'offline')),
  current_task TEXT,
  tasks_completed INTEGER DEFAULT 0,
  tasks_failed INTEGER DEFAULT 0,
  reliability INTEGER DEFAULT 100 CHECK (reliability >= 0 AND reliability <= 100),
  average_completion_time INTEGER DEFAULT 0, -- milliseconds
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Swarm Tasks table
CREATE TABLE IF NOT EXISTS swarm_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'failed', 'validated')),
  assigned_agent TEXT REFERENCES swarm_agents(id),
  dependencies JSONB DEFAULT '[]'::jsonb,
  result JSONB,
  error TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  validated_at TIMESTAMP WITH TIME ZONE,
  attempts INTEGER DEFAULT 0,
  estimated_duration INTEGER, -- milliseconds
  actual_duration INTEGER, -- milliseconds
  validation_score INTEGER CHECK (validation_score >= 0 AND validation_score <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Swarm Metrics table
CREATE TABLE IF NOT EXISTS swarm_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  metrics JSONB NOT NULL,
  collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- File Operations table
CREATE TABLE IF NOT EXISTS file_operations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('read', 'write', 'delete', 'move', 'copy', 'mkdir', 'chmod')),
  source_path TEXT NOT NULL,
  target_path TEXT,
  content TEXT,
  metadata JSONB,
  agent_id TEXT,
  user_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  error TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- A2A Messages table
CREATE TABLE IF NOT EXISTS a2a_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_agent TEXT NOT NULL,
  to_agent TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('request', 'response', 'event')),
  action TEXT NOT NULL,
  payload JSONB,
  correlation_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Task Execution Logs table
CREATE TABLE IF NOT EXISTS task_execution_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES swarm_tasks(id),
  agent_id TEXT REFERENCES swarm_agents(id),
  log_level TEXT CHECK (log_level IN ('info', 'warn', 'error', 'debug')),
  message TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_swarm_agents_status ON swarm_agents(status);
CREATE INDEX idx_swarm_agents_type ON swarm_agents(type);
CREATE INDEX idx_swarm_tasks_status ON swarm_tasks(status);
CREATE INDEX idx_swarm_tasks_priority ON swarm_tasks(priority);
CREATE INDEX idx_swarm_tasks_assigned_agent ON swarm_tasks(assigned_agent);
CREATE INDEX idx_file_operations_status ON file_operations(status);
CREATE INDEX idx_file_operations_agent_id ON file_operations(agent_id);
CREATE INDEX idx_a2a_messages_from_agent ON a2a_messages(from_agent);
CREATE INDEX idx_a2a_messages_to_agent ON a2a_messages(to_agent);
CREATE INDEX idx_a2a_messages_action ON a2a_messages(action);
CREATE INDEX idx_task_execution_logs_task_id ON task_execution_logs(task_id);
CREATE INDEX idx_task_execution_logs_agent_id ON task_execution_logs(agent_id);

-- Row Level Security
ALTER TABLE swarm_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE swarm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE swarm_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE a2a_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_execution_logs ENABLE ROW LEVEL SECURITY;

-- Policies for swarm_agents (read for authenticated, write for service role)
CREATE POLICY "Authenticated users can read swarm agents" ON swarm_agents
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage swarm agents" ON swarm_agents
  FOR ALL
  USING (auth.role() = 'service_role');

-- Policies for swarm_tasks
CREATE POLICY "Authenticated users can read swarm tasks" ON swarm_tasks
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage swarm tasks" ON swarm_tasks
  FOR ALL
  USING (auth.role() = 'service_role');

-- Policies for file_operations
CREATE POLICY "Users can read their own file operations" ON file_operations
  FOR SELECT
  USING (auth.role() = 'authenticated' AND (user_id = auth.uid()::text OR auth.role() = 'service_role'));

CREATE POLICY "Service role can manage file operations" ON file_operations
  FOR ALL
  USING (auth.role() = 'service_role');

-- Functions
CREATE OR REPLACE FUNCTION update_swarm_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_swarm_agents_updated_at
  BEFORE UPDATE ON swarm_agents
  FOR EACH ROW
  EXECUTE FUNCTION update_swarm_updated_at();

CREATE TRIGGER update_swarm_tasks_updated_at
  BEFORE UPDATE ON swarm_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_swarm_updated_at();

-- Function to calculate swarm metrics
CREATE OR REPLACE FUNCTION calculate_swarm_metrics()
RETURNS JSONB AS $$
DECLARE
  metrics JSONB;
BEGIN
  WITH task_stats AS (
    SELECT 
      COUNT(*) as total_tasks,
      COUNT(*) FILTER (WHERE status = 'completed') as completed_tasks,
      COUNT(*) FILTER (WHERE status = 'failed') as failed_tasks,
      COUNT(*) FILTER (WHERE status = 'validated') as validated_tasks,
      COUNT(*) FILTER (WHERE status = 'pending') as pending_tasks,
      COUNT(*) FILTER (WHERE status IN ('assigned', 'in_progress')) as in_progress_tasks,
      AVG(actual_duration) FILTER (WHERE actual_duration IS NOT NULL) as avg_duration
    FROM swarm_tasks
  ),
  agent_stats AS (
    SELECT 
      COUNT(*) as total_agents,
      COUNT(*) FILTER (WHERE status = 'busy') as busy_agents,
      AVG(reliability) as avg_reliability
    FROM swarm_agents
  )
  SELECT jsonb_build_object(
    'totalTasks', ts.total_tasks,
    'completedTasks', ts.completed_tasks,
    'failedTasks', ts.failed_tasks,
    'validatedTasks', ts.validated_tasks,
    'pendingTasks', ts.pending_tasks,
    'inProgressTasks', ts.in_progress_tasks,
    'completionPercentage', CASE 
      WHEN ts.total_tasks > 0 THEN ROUND((ts.validated_tasks::numeric / ts.total_tasks) * 100)
      ELSE 0 
    END,
    'validationPercentage', CASE 
      WHEN ts.completed_tasks > 0 THEN ROUND((ts.validated_tasks::numeric / ts.completed_tasks) * 100)
      ELSE 0 
    END,
    'averageTaskDuration', COALESCE(ROUND(ts.avg_duration), 0),
    'agentUtilization', CASE 
      WHEN ag.total_agents > 0 THEN ROUND((ag.busy_agents::numeric / ag.total_agents) * 100)
      ELSE 0 
    END,
    'swarmEfficiency', COALESCE(ROUND(ag.avg_reliability), 100)
  ) INTO metrics
  FROM task_stats ts, agent_stats ag;
  
  RETURN metrics;
END;
$$ LANGUAGE plpgsql;