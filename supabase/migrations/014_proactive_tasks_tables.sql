-- Create proactive_tasks table
CREATE TABLE IF NOT EXISTS public.proactive_tasks (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text,
  category text NOT NULL CHECK (category IN ('reminder', 'follow_up', 'research', 'action', 'goal', 'routine')),
  priority text NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status text NOT NULL CHECK (status IN ('created', 'scheduled', 'in_progress', 'completed', 'cancelled', 'deferred')),
  
  scheduled_for timestamptz,
  due_date timestamptz,
  estimated_duration integer, -- in minutes
  recurring_pattern jsonb,
  
  trigger_context jsonb NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('notification', 'api_call', 'file_operation', 'reminder', 'research', 'multi_step')),
  action_details jsonb NOT NULL DEFAULT '{}',
  dependencies text[], -- Array of task IDs
  
  user_feedback text CHECK (user_feedback IN ('helpful', 'not_helpful', 'irrelevant')),
  completion_rate float CHECK (completion_rate >= 0 AND completion_rate <= 1),
  adaptation_history jsonb DEFAULT '[]',
  
  created_by text NOT NULL CHECK (created_by IN ('user', 'system', 'conversation_analysis', 'pattern_detection')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  user_id text
);

-- Create goals table
CREATE TABLE IF NOT EXISTS public.goals (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  target_date timestamptz NOT NULL,
  progress float DEFAULT 0 CHECK (progress >= 0 AND progress <= 1),
  milestones jsonb DEFAULT '[]',
  related_tasks text[], -- Array of task IDs
  metrics jsonb DEFAULT '[]',
  status text NOT NULL CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id text
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_proactive_tasks_status ON public.proactive_tasks(status);
CREATE INDEX IF NOT EXISTS idx_proactive_tasks_category ON public.proactive_tasks(category);
CREATE INDEX IF NOT EXISTS idx_proactive_tasks_priority ON public.proactive_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_proactive_tasks_scheduled_for ON public.proactive_tasks(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_proactive_tasks_user_id ON public.proactive_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_proactive_tasks_created_at ON public.proactive_tasks(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_goals_status ON public.goals(status);
CREATE INDEX IF NOT EXISTS idx_goals_target_date ON public.goals(target_date);
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON public.goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_progress ON public.goals(progress);

-- Update timestamp triggers
CREATE TRIGGER update_proactive_tasks_updated_at
  BEFORE UPDATE ON public.proactive_tasks
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE public.proactive_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role full access
CREATE POLICY proactive_tasks_service_policy ON public.proactive_tasks
  FOR ALL USING (current_setting('role') = 'service_role');

CREATE POLICY goals_service_policy ON public.goals
  FOR ALL USING (current_setting('role') = 'service_role');

-- Policy: Allow authenticated users to view/manage their own tasks and goals
CREATE POLICY proactive_tasks_user_policy ON public.proactive_tasks
  FOR ALL USING (auth.role() = 'authenticated' AND (user_id IS NULL OR user_id = auth.uid()::text));

CREATE POLICY goals_user_policy ON public.goals
  FOR ALL USING (auth.role() = 'authenticated' AND (user_id IS NULL OR user_id = auth.uid()::text));

-- Add helpful comments
COMMENT ON TABLE public.proactive_tasks IS 'Proactively created and managed tasks based on user context and patterns';
COMMENT ON TABLE public.goals IS 'User goals with progress tracking and related tasks';
COMMENT ON COLUMN public.proactive_tasks.trigger_context IS 'Context that triggered the creation of this task';
COMMENT ON COLUMN public.proactive_tasks.action_details IS 'Details specific to the action type';
COMMENT ON COLUMN public.proactive_tasks.adaptation_history IS 'History of adaptations made to this task based on feedback';
COMMENT ON COLUMN public.goals.milestones IS 'Array of milestone objects with id, title, targetDate, completed, completedAt';
COMMENT ON COLUMN public.goals.metrics IS 'Array of metric objects for tracking goal progress';