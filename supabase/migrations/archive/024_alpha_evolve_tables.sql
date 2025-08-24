-- Alpha Evolve Learning System Tables
-- Self-improving AI system that learns from patterns and evolves strategies

-- Learning patterns table
CREATE TABLE IF NOT EXISTS ai_learning_patterns (
    id TEXT PRIMARY KEY,
    pattern TEXT NOT NULL,
    frequency INTEGER DEFAULT 0,
    success INTEGER DEFAULT 0,
    failures INTEGER DEFAULT 0,
    confidence REAL DEFAULT 0.5,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    context JSONB DEFAULT '{}',
    adaptations JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Evolution strategies table
CREATE TABLE IF NOT EXISTS ai_evolution_strategies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    genome JSONB NOT NULL,
    performance JSONB NOT NULL,
    generation INTEGER DEFAULT 0,
    parent TEXT,
    mutations JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance metrics table
CREATE TABLE IF NOT EXISTS ai_performance_metrics (
    id SERIAL PRIMARY KEY,
    agent_id TEXT NOT NULL,
    operation_type TEXT NOT NULL,
    latency_ms INTEGER,
    memory_delta BIGINT,
    success BOOLEAN DEFAULT true,
    error TEXT,
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Evolution history table
CREATE TABLE IF NOT EXISTS ai_evolution_history (
    id SERIAL PRIMARY KEY,
    generation_id TEXT NOT NULL,
    fitness_score REAL,
    success_rate REAL,
    adaptation_rate REAL,
    learning_cycles INTEGER,
    mutation_rate REAL,
    crossover_rate REAL,
    population_snapshot JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Adaptive strategies table
CREATE TABLE IF NOT EXISTS ai_adaptive_strategies (
    id TEXT PRIMARY KEY,
    operation_type TEXT NOT NULL,
    context_key TEXT NOT NULL,
    parameters JSONB NOT NULL,
    performance_score REAL DEFAULT 0.5,
    usage_count INTEGER DEFAULT 0,
    last_used TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- File operation history table
CREATE TABLE IF NOT EXISTS ai_file_operations (
    id SERIAL PRIMARY KEY,
    operation_type TEXT NOT NULL,
    context JSONB,
    result JSONB,
    performance JSONB,
    strategy_id TEXT,
    user_id TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_learning_patterns_pattern ON ai_learning_patterns(pattern);
CREATE INDEX IF NOT EXISTS idx_learning_patterns_confidence ON ai_learning_patterns(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_evolution_strategies_generation ON ai_evolution_strategies(generation);
CREATE INDEX IF NOT EXISTS idx_evolution_strategies_fitness ON ai_evolution_strategies((genome->>'fitness')::REAL DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_agent ON ai_performance_metrics(agent_id, operation_type);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON ai_performance_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_adaptive_strategies_operation ON ai_adaptive_strategies(operation_type, context_key);
CREATE INDEX IF NOT EXISTS idx_file_operations_type ON ai_file_operations(operation_type, timestamp DESC);

-- Create update trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers
CREATE TRIGGER update_ai_learning_patterns_updated_at 
    BEFORE UPDATE ON ai_learning_patterns 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_evolution_strategies_updated_at 
    BEFORE UPDATE ON ai_evolution_strategies 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_adaptive_strategies_updated_at 
    BEFORE UPDATE ON ai_adaptive_strategies 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to get best performing strategy
CREATE OR REPLACE FUNCTION get_best_strategy(p_operation_type TEXT DEFAULT NULL)
RETURNS TABLE (
    id TEXT,
    name TEXT,
    genome JSONB,
    fitness REAL,
    generation INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.name,
        s.genome,
        (s.genome->>'fitness')::REAL as fitness,
        s.generation
    FROM ai_evolution_strategies s
    WHERE p_operation_type IS NULL 
        OR s.genome->'genes' @> jsonb_build_array(
            jsonb_build_object('trait', p_operation_type)
        )
    ORDER BY (s.genome->>'fitness')::REAL DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to analyze pattern trends
CREATE OR REPLACE FUNCTION analyze_pattern_trends(p_days INTEGER DEFAULT 7)
RETURNS TABLE (
    pattern TEXT,
    total_occurrences INTEGER,
    success_rate REAL,
    confidence_trend REAL,
    recent_adaptations INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.pattern,
        p.frequency as total_occurrences,
        CASE 
            WHEN p.success + p.failures > 0 
            THEN p.success::REAL / (p.success + p.failures)
            ELSE 0
        END as success_rate,
        p.confidence as confidence_trend,
        jsonb_array_length(
            (SELECT jsonb_agg(a) 
             FROM jsonb_array_elements(p.adaptations) a
             WHERE (a->>'timestamp')::TIMESTAMPTZ > NOW() - INTERVAL '1 day' * p_days)
        ) as recent_adaptations
    FROM ai_learning_patterns p
    WHERE p.last_seen > NOW() - INTERVAL '1 day' * p_days
    ORDER BY p.frequency DESC, p.confidence DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get evolution progress
CREATE OR REPLACE FUNCTION get_evolution_progress()
RETURNS TABLE (
    current_generation INTEGER,
    best_fitness REAL,
    average_fitness REAL,
    improvement_rate REAL,
    convergence_estimate INTEGER
) AS $$
DECLARE
    v_current_gen INTEGER;
    v_best_fitness REAL;
    v_avg_fitness REAL;
    v_improvement REAL;
    v_convergence INTEGER;
BEGIN
    -- Get current generation
    SELECT MAX(generation) INTO v_current_gen FROM ai_evolution_strategies;
    
    -- Get best fitness
    SELECT MAX((genome->>'fitness')::REAL) INTO v_best_fitness 
    FROM ai_evolution_strategies 
    WHERE generation = v_current_gen;
    
    -- Get average fitness
    SELECT AVG((genome->>'fitness')::REAL) INTO v_avg_fitness 
    FROM ai_evolution_strategies 
    WHERE generation = v_current_gen;
    
    -- Calculate improvement rate (last 10 generations)
    WITH fitness_history AS (
        SELECT 
            generation,
            AVG((genome->>'fitness')::REAL) as avg_fitness
        FROM ai_evolution_strategies
        WHERE generation >= v_current_gen - 10
        GROUP BY generation
        ORDER BY generation
    )
    SELECT 
        CASE 
            WHEN COUNT(*) > 1 
            THEN (MAX(avg_fitness) - MIN(avg_fitness)) / COUNT(*)
            ELSE 0
        END INTO v_improvement
    FROM fitness_history;
    
    -- Estimate convergence
    v_convergence := CASE 
        WHEN v_improvement > 0 AND v_best_fitness < 0.95
        THEN CEILING((0.95 - v_best_fitness) / v_improvement)::INTEGER
        ELSE 0
    END;
    
    RETURN QUERY SELECT 
        v_current_gen,
        v_best_fitness,
        v_avg_fitness,
        v_improvement,
        v_convergence;
END;
$$ LANGUAGE plpgsql;

-- RLS policies
ALTER TABLE ai_learning_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_evolution_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_evolution_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_adaptive_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_file_operations ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all data
CREATE POLICY "Allow authenticated read access" ON ai_learning_patterns
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read access" ON ai_evolution_strategies
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read access" ON ai_performance_metrics
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read access" ON ai_evolution_history
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read access" ON ai_adaptive_strategies
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read access" ON ai_file_operations
    FOR SELECT TO authenticated USING (true);

-- Allow system to write data
CREATE POLICY "Allow system write access" ON ai_learning_patterns
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow system write access" ON ai_evolution_strategies
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow system write access" ON ai_performance_metrics
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow system write access" ON ai_evolution_history
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow system write access" ON ai_adaptive_strategies
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow system write access" ON ai_file_operations
    FOR ALL TO authenticated USING (true) WITH CHECK (true);