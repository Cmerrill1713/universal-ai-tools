-- Reinforcement Learning System Tables
-- This migration creates the infrastructure for RL-based agent improvement

-- RL Environments
CREATE TABLE IF NOT EXISTS rl_environments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    state_space JSONB NOT NULL,
    action_space JSONB NOT NULL,
    reward_function_type VARCHAR(50) CHECK (reward_function_type IN ('sparse', 'dense', 'shaped')),
    termination_conditions JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RL Agents
CREATE TABLE IF NOT EXISTS rl_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL CHECK (type IN ('q-learning', 'dqn', 'policy-gradient', 'actor-critic', 'ppo')),
    environment_id UUID REFERENCES rl_environments(id) ON DELETE CASCADE,
    hyperparameters JSONB NOT NULL DEFAULT '{
        "learningRate": 0.001,
        "discountFactor": 0.99,
        "epsilon": 1.0,
        "epsilonDecay": 0.995,
        "batchSize": 32,
        "updateFrequency": 4,
        "targetUpdateFrequency": 1000,
        "entropy": 0.01,
        "clipRange": 0.2
    }'::jsonb,
    performance JSONB NOT NULL DEFAULT '{
        "episodesCompleted": 0,
        "totalReward": 0,
        "averageReward": 0,
        "bestReward": -999999,
        "convergenceRate": 0,
        "explorationRate": 1.0
    }'::jsonb,
    model_path TEXT,
    training BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Training Sessions
CREATE TABLE IF NOT EXISTS rl_training_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES rl_agents(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    episodes_count INTEGER NOT NULL DEFAULT 0,
    metrics JSONB NOT NULL DEFAULT '{
        "episodeRewards": [],
        "lossHistory": [],
        "explorationHistory": [],
        "valueEstimates": [],
        "policyEntropy": []
    }'::jsonb,
    status VARCHAR(50) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Episodes
CREATE TABLE IF NOT EXISTS rl_episodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES rl_training_sessions(id) ON DELETE CASCADE,
    episode_number INTEGER NOT NULL,
    steps INTEGER NOT NULL,
    total_reward NUMERIC NOT NULL,
    start_state JSONB NOT NULL,
    final_state JSONB NOT NULL,
    trajectory_summary JSONB, -- Compressed trajectory data
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Experience Replay Buffer (for offline storage)
CREATE TABLE IF NOT EXISTS rl_experiences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES rl_agents(id) ON DELETE CASCADE,
    state JSONB NOT NULL,
    action JSONB NOT NULL,
    reward NUMERIC NOT NULL,
    next_state JSONB NOT NULL,
    done BOOLEAN NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Q-Tables (for tabular methods)
CREATE TABLE IF NOT EXISTS rl_q_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES rl_agents(id) ON DELETE CASCADE,
    state_key VARCHAR(255) NOT NULL,
    action_key VARCHAR(255) NOT NULL,
    q_value NUMERIC NOT NULL DEFAULT 0,
    visit_count INTEGER DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agent_id, state_key, action_key)
);

-- Policy Parameters (for policy gradient methods)
CREATE TABLE IF NOT EXISTS rl_policy_parameters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES rl_agents(id) ON DELETE CASCADE,
    parameter_name VARCHAR(255) NOT NULL,
    parameter_value JSONB NOT NULL,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Evaluation Results
CREATE TABLE IF NOT EXISTS rl_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES rl_agents(id) ON DELETE CASCADE,
    episodes_evaluated INTEGER NOT NULL,
    average_reward NUMERIC NOT NULL,
    success_rate NUMERIC,
    evaluation_metrics JSONB,
    environment_config JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Curriculum Learning
CREATE TABLE IF NOT EXISTS rl_curriculum (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    difficulty_levels JSONB NOT NULL, -- Array of environment configurations
    progression_criteria JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Curriculum Progress
CREATE TABLE IF NOT EXISTS rl_curriculum_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES rl_agents(id) ON DELETE CASCADE,
    curriculum_id UUID REFERENCES rl_curriculum(id) ON DELETE CASCADE,
    current_level INTEGER DEFAULT 0,
    level_performances JSONB DEFAULT '[]'::jsonb,
    completed BOOLEAN DEFAULT false,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    UNIQUE(agent_id, curriculum_id)
);

-- Hyperparameter Optimization History
CREATE TABLE IF NOT EXISTS rl_hyperparameter_trials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES rl_agents(id) ON DELETE CASCADE,
    hyperparameters JSONB NOT NULL,
    performance_score NUMERIC,
    training_time_seconds INTEGER,
    final_metrics JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_agents_environment ON rl_agents(environment_id);
CREATE INDEX idx_agents_type ON rl_agents(type);
CREATE INDEX idx_agents_training ON rl_agents(training);
CREATE INDEX idx_sessions_agent ON rl_training_sessions(agent_id);
CREATE INDEX idx_sessions_status ON rl_training_sessions(status);
CREATE INDEX idx_episodes_session ON rl_episodes(session_id);
CREATE INDEX idx_episodes_reward ON rl_episodes(total_reward DESC);
CREATE INDEX idx_experiences_agent ON rl_experiences(agent_id, created_at DESC);
CREATE INDEX idx_q_table_lookup ON rl_q_tables(agent_id, state_key, action_key);
CREATE INDEX idx_evaluations_agent ON rl_evaluations(agent_id, created_at DESC);
CREATE INDEX idx_curriculum_progress ON rl_curriculum_progress(agent_id, curriculum_id);

-- Functions for analytics
CREATE OR REPLACE FUNCTION calculate_agent_learning_curve(
    p_agent_id UUID,
    p_window_size INTEGER DEFAULT 100
)
RETURNS TABLE(
    episode_batch INTEGER,
    average_reward NUMERIC,
    std_deviation NUMERIC,
    improvement_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH episode_batches AS (
        SELECT 
            (e.episode_number / p_window_size) as batch,
            e.total_reward
        FROM rl_episodes e
        JOIN rl_training_sessions s ON s.id = e.session_id
        WHERE s.agent_id = p_agent_id
        ORDER BY e.episode_number
    ),
    batch_stats AS (
        SELECT 
            batch,
            AVG(total_reward) as avg_reward,
            STDDEV(total_reward) as std_dev
        FROM episode_batches
        GROUP BY batch
        ORDER BY batch
    )
    SELECT 
        batch::INTEGER as episode_batch,
        avg_reward,
        COALESCE(std_dev, 0) as std_deviation,
        CASE 
            WHEN LAG(avg_reward) OVER (ORDER BY batch) IS NULL THEN 0
            ELSE (avg_reward - LAG(avg_reward) OVER (ORDER BY batch)) / 
                 NULLIF(LAG(avg_reward) OVER (ORDER BY batch), 0)
        END as improvement_rate
    FROM batch_stats;
END;
$$ LANGUAGE plpgsql;

-- Function to get best hyperparameters
CREATE OR REPLACE FUNCTION get_best_hyperparameters(
    p_agent_type VARCHAR,
    p_environment_id UUID,
    p_top_n INTEGER DEFAULT 5
)
RETURNS TABLE(
    hyperparameters JSONB,
    average_performance NUMERIC,
    trial_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        h.hyperparameters,
        AVG(h.performance_score) as average_performance,
        COUNT(*)::INTEGER as trial_count
    FROM rl_hyperparameter_trials h
    JOIN rl_agents a ON a.id = h.agent_id
    WHERE a.type = p_agent_type
    AND a.environment_id = p_environment_id
    GROUP BY h.hyperparameters
    ORDER BY AVG(h.performance_score) DESC
    LIMIT p_top_n;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate convergence metrics
CREATE OR REPLACE FUNCTION calculate_convergence_metrics(p_agent_id UUID)
RETURNS TABLE(
    convergence_episode INTEGER,
    final_performance NUMERIC,
    stability_score NUMERIC,
    time_to_convergence INTERVAL
) AS $$
DECLARE
    v_threshold NUMERIC := 0.95; -- 95% of best performance
BEGIN
    RETURN QUERY
    WITH performance_data AS (
        SELECT 
            e.episode_number,
            e.total_reward,
            MAX(e.total_reward) OVER (ORDER BY e.episode_number) as running_max,
            s.start_time
        FROM rl_episodes e
        JOIN rl_training_sessions s ON s.id = e.session_id
        WHERE s.agent_id = p_agent_id
        ORDER BY e.episode_number
    ),
    convergence_point AS (
        SELECT 
            MIN(episode_number) as conv_episode
        FROM performance_data
        WHERE total_reward >= running_max * v_threshold
    ),
    post_convergence AS (
        SELECT 
            AVG(total_reward) as avg_performance,
            STDDEV(total_reward) / NULLIF(AVG(total_reward), 0) as cv
        FROM performance_data
        WHERE episode_number >= (SELECT conv_episode FROM convergence_point)
    )
    SELECT 
        (SELECT conv_episode FROM convergence_point)::INTEGER,
        (SELECT avg_performance FROM post_convergence)::NUMERIC,
        CASE 
            WHEN (SELECT cv FROM post_convergence) IS NULL THEN 0
            ELSE 1 - (SELECT cv FROM post_convergence)
        END::NUMERIC as stability_score,
        (SELECT MAX(start_time) - MIN(start_time) 
         FROM performance_data 
         WHERE episode_number <= (SELECT conv_episode FROM convergence_point)) as time_to_convergence;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update agent performance
CREATE OR REPLACE FUNCTION update_agent_performance()
RETURNS TRIGGER AS $$
DECLARE
    v_total_episodes INTEGER;
    v_total_reward NUMERIC;
    v_best_reward NUMERIC;
BEGIN
    -- Calculate updated performance metrics
    SELECT 
        COUNT(e.id),
        SUM(e.total_reward),
        MAX(e.total_reward)
    INTO v_total_episodes, v_total_reward, v_best_reward
    FROM rl_episodes e
    JOIN rl_training_sessions s ON s.id = e.session_id
    WHERE s.agent_id = NEW.agent_id;
    
    -- Update agent performance
    UPDATE rl_agents
    SET performance = jsonb_build_object(
        'episodesCompleted', v_total_episodes,
        'totalReward', v_total_reward,
        'averageReward', v_total_reward / NULLIF(v_total_episodes, 0),
        'bestReward', v_best_reward,
        'convergenceRate', (performance->>'convergenceRate')::numeric,
        'explorationRate', (hyperparameters->>'epsilon')::numeric
    ),
    updated_at = NOW()
    WHERE id = NEW.agent_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_agent_performance
AFTER INSERT ON rl_episodes
FOR EACH ROW
EXECUTE FUNCTION update_agent_performance();

-- Row Level Security
ALTER TABLE rl_environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rl_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE rl_training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rl_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE rl_experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE rl_q_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE rl_policy_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE rl_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rl_curriculum ENABLE ROW LEVEL SECURITY;
ALTER TABLE rl_curriculum_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE rl_hyperparameter_trials ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read for authenticated users" ON rl_agents FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for service role" ON rl_agents FOR ALL USING (auth.role() = 'service_role');

-- Comments
COMMENT ON TABLE rl_environments IS 'RL environment definitions with state/action spaces';
COMMENT ON TABLE rl_agents IS 'RL agents with different learning algorithms';
COMMENT ON TABLE rl_training_sessions IS 'Training session history and metrics';
COMMENT ON TABLE rl_episodes IS 'Individual episode data from training';
COMMENT ON TABLE rl_experiences IS 'Experience replay buffer for off-policy learning';
COMMENT ON TABLE rl_q_tables IS 'Q-values for tabular RL methods';
COMMENT ON TABLE rl_policy_parameters IS 'Stored policy parameters for policy gradient methods';
COMMENT ON TABLE rl_evaluations IS 'Agent evaluation results';
COMMENT ON TABLE rl_curriculum IS 'Curriculum learning configurations';
COMMENT ON TABLE rl_curriculum_progress IS 'Agent progress through curriculum';
COMMENT ON TABLE rl_hyperparameter_trials IS 'Hyperparameter optimization history';