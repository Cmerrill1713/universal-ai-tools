-- Athena AI Assistant System Database Migration
-- Creates tables for dynamic agent spawning and tool creation system
-- Supporting infrastructure for the Athena AI assistant in Universal AI Tools

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- SPAWNED AGENTS TABLE (ATHENA AGENTS)
-- =====================================================
-- Stores dynamically spawned Athena AI agents with their specifications and performance data
CREATE TABLE IF NOT EXISTS spawned_agents (
    id TEXT PRIMARY KEY, -- UUID from Athena agent spawner
    specification JSONB NOT NULL, -- Agent spec: name, purpose, capabilities, tools, etc.
    performance JSONB NOT NULL DEFAULT '{
        "tasksCompleted": 0,
        "successRate": 1.0,
        "averageResponseTime": 0,
        "userSatisfaction": 1.0,
        "learningRate": 0.1,
        "adaptabilityScore": 0.5
    }', -- Performance metrics
    evolution_history JSONB DEFAULT '[]', -- Array of evolution events
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'learning', 'evolving', 'dormant')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexes for performance
    CONSTRAINT spawned_agents_specification_check CHECK (
        specification ? 'name' AND 
        specification ? 'purpose' AND 
        specification ? 'capabilities'
    )
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_spawned_agents_status ON spawned_agents(status);
CREATE INDEX IF NOT EXISTS idx_spawned_agents_created_at ON spawned_agents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_spawned_agents_specification_name ON spawned_agents USING GIN ((specification->>'name'));

-- =====================================================
-- DYNAMIC TOOLS TABLE (ATHENA TOOLS)
-- =====================================================
-- Stores dynamically created tools for Athena agents
CREATE TABLE IF NOT EXISTS dynamic_tools (
    id TEXT PRIMARY KEY, -- UUID from tool creation system
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'custom' CHECK (category IN ('api', 'computation', 'data', 'file', 'web', 'system', 'custom')),
    parameters JSONB NOT NULL DEFAULT '[]', -- Array of parameter definitions
    implementation TEXT NOT NULL, -- JavaScript/TypeScript implementation code
    language TEXT NOT NULL DEFAULT 'javascript' CHECK (language IN ('javascript', 'typescript', 'python')),
    security_level TEXT NOT NULL DEFAULT 'sandboxed' CHECK (security_level IN ('safe', 'restricted', 'sandboxed', 'dangerous')),
    performance JSONB NOT NULL DEFAULT '{
        "executionCount": 0,
        "averageExecutionTime": 0,
        "successRate": 1.0,
        "errorRate": 0,
        "lastExecutionTime": 0,
        "memoryUsage": 0
    }', -- Performance metrics
    usage JSONB NOT NULL DEFAULT '{
        "totalCalls": 0,
        "uniqueUsers": [],
        "popularParameters": {},
        "commonErrorPatterns": [],
        "improvementSuggestions": []
    }', -- Usage tracking
    version TEXT NOT NULL DEFAULT '1.0.0',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_modified TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT dynamic_tools_name_unique UNIQUE (name, version),
    CONSTRAINT dynamic_tools_parameters_check CHECK (jsonb_typeof(parameters) = 'array')
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_dynamic_tools_category ON dynamic_tools(category);
CREATE INDEX IF NOT EXISTS idx_dynamic_tools_security_level ON dynamic_tools(security_level);
CREATE INDEX IF NOT EXISTS idx_dynamic_tools_performance ON dynamic_tools USING GIN (performance);
CREATE INDEX IF NOT EXISTS idx_dynamic_tools_created_at ON dynamic_tools(created_at DESC);

-- =====================================================
-- AGENT TOOL ASSOCIATIONS
-- =====================================================
-- Links spawned agents to their tools
CREATE TABLE IF NOT EXISTS agent_tool_associations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id TEXT NOT NULL REFERENCES spawned_agents(id) ON DELETE CASCADE,
    tool_id TEXT NOT NULL REFERENCES dynamic_tools(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    usage_count INTEGER DEFAULT 0,
    
    -- Prevent duplicate associations
    CONSTRAINT agent_tool_unique UNIQUE (agent_id, tool_id)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_agent_tool_agent_id ON agent_tool_associations(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_tool_tool_id ON agent_tool_associations(tool_id);

-- =====================================================
-- AGENT EVOLUTION EVENTS TABLE
-- =====================================================
-- Detailed tracking of agent evolution events
CREATE TABLE IF NOT EXISTS agent_evolution_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id TEXT NOT NULL REFERENCES spawned_agents(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('capability_added', 'tool_created', 'prompt_optimized', 'performance_improved')),
    description TEXT NOT NULL,
    impact_score DECIMAL(3,2) DEFAULT 0.0 CHECK (impact_score >= 0.0 AND impact_score <= 1.0),
    metrics JSONB DEFAULT '{}', -- Event-specific metrics
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure valid references
    CONSTRAINT evolution_events_agent_exists CHECK (agent_id IS NOT NULL)
);

-- Index for evolution tracking
CREATE INDEX IF NOT EXISTS idx_evolution_events_agent_id ON agent_evolution_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_evolution_events_timestamp ON agent_evolution_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_evolution_events_type ON agent_evolution_events(event_type);

-- =====================================================
-- TOOL EXECUTION LOGS
-- =====================================================
-- Track tool execution for analytics and debugging
CREATE TABLE IF NOT EXISTS tool_execution_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tool_id TEXT NOT NULL REFERENCES dynamic_tools(id) ON DELETE CASCADE,
    agent_id TEXT REFERENCES spawned_agents(id) ON DELETE SET NULL, -- Can be null for direct tool execution
    user_id TEXT, -- Optional user identification
    parameters JSONB NOT NULL DEFAULT '{}',
    result JSONB, -- Execution result
    success BOOLEAN NOT NULL,
    execution_time_ms INTEGER NOT NULL,
    memory_used_kb INTEGER DEFAULT 0,
    error_message TEXT, -- If execution failed
    warnings TEXT[], -- Execution warnings
    executed_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT tool_execution_valid_time CHECK (execution_time_ms >= 0),
    CONSTRAINT tool_execution_valid_memory CHECK (memory_used_kb >= 0)
);

-- Indexes for analytics and debugging
CREATE INDEX IF NOT EXISTS idx_tool_execution_tool_id ON tool_execution_logs(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_execution_agent_id ON tool_execution_logs(agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tool_execution_success ON tool_execution_logs(success);
CREATE INDEX IF NOT EXISTS idx_tool_execution_timestamp ON tool_execution_logs(executed_at DESC);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE spawned_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE dynamic_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tool_associations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_evolution_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_execution_logs ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (for backend operations)
CREATE POLICY "Service role full access" ON spawned_agents FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON dynamic_tools FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON agent_tool_associations FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON agent_evolution_events FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON tool_execution_logs FOR ALL TO service_role USING (true);

-- Allow authenticated users to read agent data (for dashboard/monitoring)
CREATE POLICY "Authenticated users can read agents" ON spawned_agents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read tools" ON dynamic_tools FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read associations" ON agent_tool_associations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read evolution" ON agent_evolution_events FOR SELECT TO authenticated USING (true);

-- Restrict tool execution logs to prevent data leakage
CREATE POLICY "Limited access to execution logs" ON tool_execution_logs FOR SELECT TO authenticated 
USING (
    -- Only show basic execution stats, not sensitive parameters/results
    user_id = auth.jwt() ->> 'sub' OR 
    (parameters IS NULL AND result IS NULL)
);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to update agent performance metrics
CREATE OR REPLACE FUNCTION update_agent_performance(
    p_agent_id TEXT,
    p_execution_time INTEGER,
    p_success BOOLEAN
) RETURNS void AS $$
DECLARE
    current_performance JSONB;
    updated_performance JSONB;
BEGIN
    -- Get current performance metrics
    SELECT performance INTO current_performance 
    FROM spawned_agents 
    WHERE id = p_agent_id;
    
    IF current_performance IS NULL THEN
        RAISE EXCEPTION 'Agent not found: %', p_agent_id;
    END IF;
    
    -- Update metrics
    updated_performance := jsonb_set(
        jsonb_set(
            jsonb_set(
                current_performance,
                '{tasksCompleted}',
                ((current_performance->>'tasksCompleted')::int + 1)::text::jsonb
            ),
            '{averageResponseTime}',
            (
                (
                    (current_performance->>'averageResponseTime')::float * 
                    (current_performance->>'tasksCompleted')::int + 
                    p_execution_time
                ) / 
                ((current_performance->>'tasksCompleted')::int + 1)
            )::text::jsonb
        ),
        '{successRate}',
        CASE 
            WHEN p_success THEN current_performance->'successRate'
            ELSE (
                (
                    (current_performance->>'successRate')::float * 
                    (current_performance->>'tasksCompleted')::int 
                ) / 
                ((current_performance->>'tasksCompleted')::int + 1)
            )::text::jsonb
        END
    );
    
    -- Update the agent
    UPDATE spawned_agents 
    SET performance = updated_performance, updated_at = NOW()
    WHERE id = p_agent_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update tool performance metrics  
CREATE OR REPLACE FUNCTION update_tool_performance(
    p_tool_id TEXT,
    p_execution_time INTEGER,
    p_memory_used INTEGER,
    p_success BOOLEAN
) RETURNS void AS $$
DECLARE
    current_performance JSONB;
    updated_performance JSONB;
BEGIN
    -- Get current performance metrics
    SELECT performance INTO current_performance 
    FROM dynamic_tools 
    WHERE id = p_tool_id;
    
    IF current_performance IS NULL THEN
        RAISE EXCEPTION 'Tool not found: %', p_tool_id;
    END IF;
    
    -- Update metrics
    updated_performance := jsonb_set(
        jsonb_set(
            jsonb_set(
                jsonb_set(
                    jsonb_set(
                        current_performance,
                        '{executionCount}',
                        ((current_performance->>'executionCount')::int + 1)::text::jsonb
                    ),
                    '{lastExecutionTime}',
                    p_execution_time::text::jsonb
                ),
                '{averageExecutionTime}',
                (
                    (
                        (current_performance->>'averageExecutionTime')::float * 
                        (current_performance->>'executionCount')::int + 
                        p_execution_time
                    ) / 
                    ((current_performance->>'executionCount')::int + 1)
                )::text::jsonb
            ),
            '{memoryUsage}',
            GREATEST(
                (current_performance->>'memoryUsage')::int,
                p_memory_used
            )::text::jsonb
        ),
        '{successRate}',
        CASE 
            WHEN p_success THEN current_performance->'successRate'
            ELSE (
                (
                    (current_performance->>'successRate')::float * 
                    (current_performance->>'executionCount')::int 
                ) / 
                ((current_performance->>'executionCount')::int + 1)
            )::text::jsonb
        END
    );
    
    -- Update the tool
    UPDATE dynamic_tools 
    SET performance = updated_performance, last_modified = NOW()
    WHERE id = p_tool_id;
END;
$$ LANGUAGE plpgsql;

-- Function to log tool execution
CREATE OR REPLACE FUNCTION log_tool_execution(
    p_tool_id TEXT,
    p_agent_id TEXT DEFAULT NULL,
    p_user_id TEXT DEFAULT NULL,
    p_parameters JSONB DEFAULT '{}',
    p_result JSONB DEFAULT NULL,
    p_success BOOLEAN DEFAULT true,
    p_execution_time_ms INTEGER DEFAULT 0,
    p_memory_used_kb INTEGER DEFAULT 0,
    p_error_message TEXT DEFAULT NULL,
    p_warnings TEXT[] DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO tool_execution_logs (
        tool_id, agent_id, user_id, parameters, result, 
        success, execution_time_ms, memory_used_kb, 
        error_message, warnings
    ) VALUES (
        p_tool_id, p_agent_id, p_user_id, p_parameters, p_result,
        p_success, p_execution_time_ms, p_memory_used_kb,
        p_error_message, p_warnings
    ) RETURNING id INTO log_id;
    
    -- Update tool performance metrics
    PERFORM update_tool_performance(p_tool_id, p_execution_time_ms, p_memory_used_kb, p_success);
    
    -- Update agent performance if agent_id provided
    IF p_agent_id IS NOT NULL THEN
        PERFORM update_agent_performance(p_agent_id, p_execution_time_ms, p_success);
    END IF;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ANALYTICS VIEWS
-- =====================================================

-- Agent performance summary view
CREATE OR REPLACE VIEW agent_performance_summary AS
SELECT 
    a.id,
    a.specification->>'name' as agent_name,
    a.status,
    (a.performance->>'tasksCompleted')::int as tasks_completed,
    (a.performance->>'successRate')::float as success_rate,
    (a.performance->>'averageResponseTime')::float as avg_response_time,
    jsonb_array_length(a.evolution_history) as evolution_events,
    COUNT(ata.tool_id) as tools_available,
    a.created_at,
    a.updated_at
FROM spawned_agents a
LEFT JOIN agent_tool_associations ata ON a.id = ata.agent_id
GROUP BY a.id, a.specification, a.status, a.performance, a.evolution_history, a.created_at, a.updated_at;

-- Tool usage analytics view
CREATE OR REPLACE VIEW tool_usage_analytics AS
SELECT 
    t.id,
    t.name,
    t.category,
    t.security_level,
    (t.performance->>'executionCount')::int as execution_count,
    (t.performance->>'successRate')::float as success_rate,
    (t.performance->>'averageExecutionTime')::float as avg_execution_time,
    COUNT(DISTINCT ata.agent_id) as agents_using,
    COUNT(tel.id) as logged_executions,
    t.created_at,
    t.last_modified
FROM dynamic_tools t
LEFT JOIN agent_tool_associations ata ON t.id = ata.tool_id
LEFT JOIN tool_execution_logs tel ON t.id = tel.tool_id
GROUP BY t.id, t.name, t.category, t.security_level, t.performance, t.created_at, t.last_modified;

-- System health overview
CREATE OR REPLACE VIEW athena_system_health AS
SELECT 
    'system_overview' as metric_type,
    jsonb_build_object(
        'total_agents', (SELECT COUNT(*) FROM spawned_agents),
        'active_agents', (SELECT COUNT(*) FROM spawned_agents WHERE status = 'active'),
        'total_tools', (SELECT COUNT(*) FROM dynamic_tools),
        'tool_executions_today', (SELECT COUNT(*) FROM tool_execution_logs WHERE executed_at >= CURRENT_DATE),
        'avg_success_rate', (SELECT AVG((performance->>'successRate')::float) FROM spawned_agents),
        'evolution_events_today', (SELECT COUNT(*) FROM agent_evolution_events WHERE timestamp >= CURRENT_DATE)
    ) as metrics,
    NOW() as generated_at;

-- =====================================================
-- INITIAL DATA AND SETUP
-- =====================================================

-- Insert sample data for testing (optional)
/*
INSERT INTO spawned_agents (id, specification, status) VALUES 
('test-agent-001', '{"name": "Test Agent", "purpose": "Testing system", "capabilities": ["analysis"], "tools": [], "systemPrompt": "You are a test agent", "personality": "helpful", "expertise": ["testing"], "autonomyLevel": "basic"}', 'active');

INSERT INTO dynamic_tools (id, name, description, implementation) VALUES 
('test-tool-001', 'sample_calculator', 'Simple calculator tool', 'function sample_calculator(params) { return params.a + params.b; }');
*/

-- Final success confirmation
DO $$
BEGIN
    RAISE NOTICE '✅ Athena AI Assistant System migration completed successfully';
    RAISE NOTICE '📊 Created tables: spawned_agents, dynamic_tools, agent_tool_associations, agent_evolution_events, tool_execution_logs';
    RAISE NOTICE '🔧 Created helper functions: update_agent_performance, update_tool_performance, log_tool_execution';
    RAISE NOTICE '📈 Created analytics views: agent_performance_summary, tool_usage_analytics, athena_system_health';
END $$;