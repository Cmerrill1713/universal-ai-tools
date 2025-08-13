-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create autonomous_actions table
CREATE TABLE IF NOT EXISTS public.autonomous_actions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  type text NOT NULL CHECK (type IN ('parameter_adjustment', 'model_switch', 'prompt_optimization', 'feature_toggle', 'configuration_update')),
  priority text NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  target jsonb NOT NULL,
  change jsonb NOT NULL,
  assessment jsonb NOT NULL,
  evidence jsonb NOT NULL,
  execution jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'implementing', 'active', 'rolled_back', 'completed')),
  implementation_result jsonb,
  created_at timestamptz DEFAULT now(),
  implemented_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

-- Create autonomous_learning table for learning from implementations
CREATE TABLE IF NOT EXISTS public.autonomous_learning (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_id uuid REFERENCES public.autonomous_actions(id) ON DELETE CASCADE,
  learning_data jsonb NOT NULL,
  timestamp timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_autonomous_actions_status ON public.autonomous_actions(status);
CREATE INDEX IF NOT EXISTS idx_autonomous_actions_type ON public.autonomous_actions(type);
CREATE INDEX IF NOT EXISTS idx_autonomous_actions_created_at ON public.autonomous_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_autonomous_learning_action_id ON public.autonomous_learning(action_id);
CREATE INDEX IF NOT EXISTS idx_autonomous_learning_timestamp ON public.autonomous_learning(timestamp DESC);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_autonomous_actions_updated_at
  BEFORE UPDATE ON public.autonomous_actions
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE public.autonomous_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autonomous_learning ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role full access
CREATE POLICY autonomous_actions_service_policy ON public.autonomous_actions
  FOR ALL USING (current_setting('role') = 'service_role');

CREATE POLICY autonomous_learning_service_policy ON public.autonomous_learning  
  FOR ALL USING (current_setting('role') = 'service_role');

-- Policy: Allow authenticated users to view their own actions (if user_id added later)
CREATE POLICY autonomous_actions_user_policy ON public.autonomous_actions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY autonomous_learning_user_policy ON public.autonomous_learning
  FOR SELECT USING (auth.role() = 'authenticated');

-- Add helpful comments
COMMENT ON TABLE public.autonomous_actions IS 'Stores autonomous actions taken by the AI system';
COMMENT ON TABLE public.autonomous_learning IS 'Stores learning data from autonomous action implementations';