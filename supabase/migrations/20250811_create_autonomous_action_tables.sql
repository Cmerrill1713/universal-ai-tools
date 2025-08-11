-- Create tables for autonomous action rollback service
CREATE TABLE IF NOT EXISTS public.autonomous_action_baselines (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    action_id TEXT NOT NULL,
    metrics JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ NOT NULL,
    UNIQUE(action_id, created_at)
);

CREATE TABLE IF NOT EXISTS public.autonomous_action_triggers (
    id TEXT PRIMARY KEY,
    action_id TEXT NOT NULL,
    metric TEXT NOT NULL,
    threshold NUMERIC NOT NULL,
    operator TEXT NOT NULL CHECK (operator IN ('lt', 'gt', 'eq')),
    triggered BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.autonomous_action_rollbacks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    action_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    metrics_before JSONB NOT NULL,
    metrics_after JSONB NOT NULL,
    duration INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_autonomous_action_baselines_action_id ON public.autonomous_action_baselines(action_id);
CREATE INDEX IF NOT EXISTS idx_autonomous_action_baselines_created_at ON public.autonomous_action_baselines(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_autonomous_action_triggers_action_id ON public.autonomous_action_triggers(action_id);
CREATE INDEX IF NOT EXISTS idx_autonomous_action_rollbacks_action_id ON public.autonomous_action_rollbacks(action_id);
CREATE INDEX IF NOT EXISTS idx_autonomous_action_rollbacks_created_at ON public.autonomous_action_rollbacks(created_at DESC);

-- Enable RLS
ALTER TABLE public.autonomous_action_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autonomous_action_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autonomous_action_rollbacks ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own baselines" ON public.autonomous_action_baselines
    FOR ALL USING (auth.uid()::text = (action_id));

CREATE POLICY "Users can manage their own triggers" ON public.autonomous_action_triggers
    FOR ALL USING (auth.uid()::text = (action_id));

CREATE POLICY "Users can manage their own rollbacks" ON public.autonomous_action_rollbacks
    FOR ALL USING (auth.uid()::text = (action_id));
