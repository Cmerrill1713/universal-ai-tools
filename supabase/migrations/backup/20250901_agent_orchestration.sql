-- Advanced Agent Orchestration Database Schema
-- Migration for workflow templates, agent performance, and execution tracking

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Workflow Templates table
CREATE TABLE IF NOT EXISTS workflow_templates (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name TEXT NOT NULL,
    description TEXT,
    steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    parallelism TEXT NOT NULL DEFAULT 'hybrid' CHECK (parallelism IN ('sequential', 'parallel', 'hybrid')),
    failure_strategy TEXT NOT NULL DEFAULT 'retry' CHECK (failure_strategy IN ('abort', 'continue', 'retry', 'fallback')),
    success_criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
    category TEXT DEFAULT 'general',
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    version INTEGER DEFAULT 1,
    
    -- Indexes for performance
    CONSTRAINT workflow_templates_name_check CHECK (LENGTH(name) > 0)
);

-- Agent Performance Profiles table
CREATE TABLE IF NOT EXISTS agent_performance_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id TEXT UNIQUE NOT NULL,
    agent_type TEXT NOT NULL,
    capabilities TEXT[] DEFAULT ARRAY[]::TEXT[],
    specializations TEXT[] DEFAULT ARRAY[]::TEXT[],
    average_latency DECIMAL(10,2) DEFAULT 0,
    accuracy DECIMAL(5,4) DEFAULT 0 CHECK (accuracy >= 0 AND accuracy <= 1),
    success_rate DECIMAL(5,4) DEFAULT 0 CHECK (success_rate >= 0 AND success_rate <= 1),
    total_executions INTEGER DEFAULT 0,
    failed_executions INTEGER DEFAULT 0,
    performance_history JSONB DEFAULT '[]'::jsonb,
    model_preferences JSONB DEFAULT '{}'::jsonb,
    resource_usage JSONB DEFAULT '{}'::jsonb,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    
    -- Constraints
    CONSTRAINT positive_executions CHECK (total_executions >= 0),
    CONSTRAINT valid_failed_executions CHECK (failed_executions >= 0 AND failed_executions <= total_executions)
);

-- Workflow Executions table
CREATE TABLE IF NOT EXISTS workflow_executions (
    id TEXT PRIMARY KEY,
    workflow_template_id TEXT REFERENCES workflow_templates(id),
    session_id TEXT,
    user_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    parallelism_used TEXT CHECK (parallelism_used IN ('sequential', 'parallel', 'hybrid')),
    context_data JSONB DEFAULT '{}'::jsonb,
    execution_plan JSONB DEFAULT '[]'::jsonb,
    results JSONB DEFAULT '{}'::jsonb,
    performance_metrics JSONB DEFAULT '{}'::jsonb,
    error_details JSONB,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    failed_tasks INTEGER DEFAULT 0,
    confidence_score DECIMAL(5,4) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    resource_usage JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Task Executions table
CREATE TABLE IF NOT EXISTS task_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_execution_id TEXT REFERENCES workflow_executions(id) ON DELETE CASCADE,
    task_id TEXT NOT NULL,
    agent_id TEXT,
    agent_type TEXT,
    task_type TEXT NOT NULL CHECK (task_type IN ('analysis', 'synthesis', 'execution', 'validation', 'planning')),
    complexity TEXT NOT NULL CHECK (complexity IN ('low', 'medium', 'high', 'expert')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    priority INTEGER DEFAULT 1,
    dependencies TEXT[] DEFAULT ARRAY[]::TEXT[],
    required_capabilities TEXT[] DEFAULT ARRAY[]::TEXT[],
    context_data JSONB DEFAULT '{}'::jsonb,
    result_data JSONB,
    error_details TEXT,
    confidence_score DECIMAL(5,4) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    model_used TEXT,
    model_parameters JSONB DEFAULT '{}'::jsonb,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    estimated_duration_ms INTEGER,
    actual_vs_estimated_ratio DECIMAL(8,4),
    resource_metrics JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Composite index for workflow + task lookups
    UNIQUE(workflow_execution_id, task_id)
);

-- Agent Learning Events table
CREATE TABLE IF NOT EXISTS agent_learning_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('performance_update', 'capability_learned', 'specialization_gained', 'model_optimized')),
    task_execution_id UUID REFERENCES task_executions(id),
    workflow_execution_id TEXT REFERENCES workflow_executions(id),
    previous_performance JSONB,
    new_performance JSONB,
    learning_trigger TEXT,
    confidence_change DECIMAL(5,4),
    accuracy_change DECIMAL(5,4),
    latency_change INTEGER,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Index for agent performance tracking
    INDEX idx_agent_learning_agent_id_created_at ON agent_learning_events(agent_id, created_at DESC)
);

-- Orchestration Metrics table
CREATE TABLE IF NOT EXISTS orchestration_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_type TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value DECIMAL(15,6),
    dimensions JSONB DEFAULT '{}'::jsonb,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    workflow_execution_id TEXT REFERENCES workflow_executions(id),
    task_execution_id UUID REFERENCES task_executions(id),
    agent_id TEXT,
    
    -- Time-series optimization
    INDEX idx_orchestration_metrics_timestamp ON orchestration_metrics(timestamp DESC),
    INDEX idx_orchestration_metrics_type_name ON orchestration_metrics(metric_type, metric_name, timestamp DESC)
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_workflow_templates_category_active ON workflow_templates(category, is_active);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_created_at ON workflow_templates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_name_trgm ON workflow_templates USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_agent_performance_agent_id ON agent_performance_profiles(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_performance_type_active ON agent_performance_profiles(agent_type, is_active);
CREATE INDEX IF NOT EXISTS idx_agent_performance_capabilities ON agent_performance_profiles USING gin (capabilities);
CREATE INDEX IF NOT EXISTS idx_agent_performance_success_rate ON agent_performance_profiles(success_rate DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_status_created ON workflow_executions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_user_session ON workflow_executions(user_id, session_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_template_id ON workflow_executions(workflow_template_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_duration ON workflow_executions(duration_ms) WHERE duration_ms IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_task_executions_workflow_status ON task_executions(workflow_execution_id, status);
CREATE INDEX IF NOT EXISTS idx_task_executions_agent_type ON task_executions(agent_id, task_type);
CREATE INDEX IF NOT EXISTS idx_task_executions_complexity_duration ON task_executions(complexity, duration_ms) WHERE duration_ms IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_task_executions_started_at ON task_executions(started_at DESC) WHERE started_at IS NOT NULL;

-- Create functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_workflow_templates_updated_at BEFORE UPDATE ON workflow_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_workflow_executions_updated_at BEFORE UPDATE ON workflow_executions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_task_executions_updated_at BEFORE UPDATE ON task_executions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate agent performance metrics
CREATE OR REPLACE FUNCTION calculate_agent_performance(p_agent_id TEXT)
RETURNS TABLE (
    avg_latency DECIMAL(10,2),
    success_rate DECIMAL(5,4),
    accuracy DECIMAL(5,4),
    total_executions INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(AVG(te.duration_ms)::DECIMAL(10,2), 0) as avg_latency,
        COALESCE(
            (COUNT(*) FILTER (WHERE te.status = 'completed')::DECIMAL / NULLIF(COUNT(*)::DECIMAL, 0))::DECIMAL(5,4), 
            0
        ) as success_rate,
        COALESCE(AVG(te.confidence_score)::DECIMAL(5,4), 0) as accuracy,
        COUNT(*)::INTEGER as total_executions
    FROM task_executions te
    WHERE te.agent_id = p_agent_id
    AND te.started_at >= CURRENT_TIMESTAMP - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Function to update agent performance profiles automatically
CREATE OR REPLACE FUNCTION update_agent_performance_profile()
RETURNS TRIGGER AS $$
DECLARE
    performance_data RECORD;
BEGIN
    -- Only update if task is completed
    IF NEW.status = 'completed' AND NEW.agent_id IS NOT NULL THEN
        -- Calculate current performance metrics
        SELECT * INTO performance_data FROM calculate_agent_performance(NEW.agent_id);
        
        -- Update the agent performance profile
        INSERT INTO agent_performance_profiles (
            agent_id, 
            agent_type, 
            average_latency, 
            success_rate, 
            accuracy, 
            total_executions,
            last_updated
        )
        VALUES (
            NEW.agent_id, 
            NEW.agent_type, 
            performance_data.avg_latency, 
            performance_data.success_rate, 
            performance_data.accuracy, 
            performance_data.total_executions,
            CURRENT_TIMESTAMP
        )
        ON CONFLICT (agent_id) DO UPDATE SET
            average_latency = EXCLUDED.average_latency,
            success_rate = EXCLUDED.success_rate,
            accuracy = EXCLUDED.accuracy,
            total_executions = EXCLUDED.total_executions,
            last_updated = CURRENT_TIMESTAMP;
            
        -- Add performance history entry
        UPDATE agent_performance_profiles 
        SET performance_history = performance_history || jsonb_build_object(
            'timestamp', CURRENT_TIMESTAMP,
            'task_type', NEW.task_type,
            'latency', NEW.duration_ms,
            'accuracy', NEW.confidence_score,
            'complexity', NEW.complexity
        )::jsonb
        WHERE agent_id = NEW.agent_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic performance profile updates
CREATE TRIGGER update_agent_performance_on_task_completion
    AFTER UPDATE ON task_executions
    FOR EACH ROW
    WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
    EXECUTE FUNCTION update_agent_performance_profile();

-- Function to get workflow execution statistics
CREATE OR REPLACE FUNCTION get_workflow_execution_stats(p_days INTEGER DEFAULT 30)
RETURNS TABLE (
    total_executions INTEGER,
    successful_executions INTEGER,
    failed_executions INTEGER,
    avg_duration_ms DECIMAL(10,2),
    success_rate DECIMAL(5,4),
    avg_confidence DECIMAL(5,4)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_executions,
        COUNT(*) FILTER (WHERE we.status = 'completed')::INTEGER as successful_executions,
        COUNT(*) FILTER (WHERE we.status = 'failed')::INTEGER as failed_executions,
        COALESCE(AVG(we.duration_ms)::DECIMAL(10,2), 0) as avg_duration_ms,
        COALESCE(
            (COUNT(*) FILTER (WHERE we.status = 'completed')::DECIMAL / NULLIF(COUNT(*)::DECIMAL, 0))::DECIMAL(5,4),
            0
        ) as success_rate,
        COALESCE(AVG(we.confidence_score)::DECIMAL(5,4), 0) as avg_confidence
    FROM workflow_executions we
    WHERE we.created_at >= CURRENT_TIMESTAMP - INTERVAL p_days || ' days';
END;
$$ LANGUAGE plpgsql;

-- Function to get top performing agents
CREATE OR REPLACE FUNCTION get_top_performing_agents(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
    agent_id TEXT,
    agent_type TEXT,
    success_rate DECIMAL(5,4),
    average_latency DECIMAL(10,2),
    total_executions INTEGER,
    specializations TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        app.agent_id,
        app.agent_type,
        app.success_rate,
        app.average_latency,
        app.total_executions,
        app.specializations
    FROM agent_performance_profiles app
    WHERE app.is_active = true
    AND app.total_executions > 5
    ORDER BY 
        app.success_rate DESC,
        app.total_executions DESC,
        app.average_latency ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Insert default workflow templates
INSERT INTO workflow_templates (id, name, description, steps, category, tags) VALUES 
(
    'complex-analysis',
    'Complex Analysis',
    'Multi-step analysis with validation and synthesis for complex problems',
    '[
        {
            "id": "initial-analysis",
            "type": "analysis",
            "complexity": "high",
            "priority": 1,
            "estimatedDuration": 15000,
            "maxRetries": 3,
            "requiredCapabilities": ["deep_reasoning", "complex_analysis"],
            "context": {},
            "dependencies": []
        },
        {
            "id": "validation",
            "type": "validation", 
            "complexity": "medium",
            "priority": 2,
            "estimatedDuration": 10000,
            "maxRetries": 2,
            "requiredCapabilities": ["validation", "quality_assessment"],
            "context": {},
            "dependencies": ["initial-analysis"]
        },
        {
            "id": "synthesis",
            "type": "synthesis",
            "complexity": "expert",
            "priority": 3,
            "estimatedDuration": 20000,
            "maxRetries": 3,
            "requiredCapabilities": ["synthesis", "insight_extraction"],
            "context": {},
            "dependencies": ["initial-analysis", "validation"]
        }
    ]'::jsonb,
    'analysis',
    ARRAY['analysis', 'expert', 'multi-step']
),
(
    'code-development',
    'Code Development',
    'Complete code development workflow with planning, implementation, and review',
    '[
        {
            "id": "planning",
            "type": "planning",
            "complexity": "medium",
            "priority": 1,
            "estimatedDuration": 12000,
            "maxRetries": 2,
            "requiredCapabilities": ["planning", "architecture"],
            "context": {},
            "dependencies": []
        },
        {
            "id": "implementation",
            "type": "execution",
            "complexity": "high",
            "priority": 2,
            "estimatedDuration": 25000,
            "maxRetries": 3,
            "requiredCapabilities": ["code_generation", "implementation"],
            "context": {},
            "dependencies": ["planning"]
        },
        {
            "id": "review",
            "type": "validation",
            "complexity": "medium", 
            "priority": 3,
            "estimatedDuration": 8000,
            "maxRetries": 2,
            "requiredCapabilities": ["code_review", "quality_assessment"],
            "context": {},
            "dependencies": ["implementation"]
        }
    ]'::jsonb,
    'development',
    ARRAY['code', 'development', 'workflow']
)
ON CONFLICT (id) DO NOTHING;

-- Create views for common queries
CREATE OR REPLACE VIEW workflow_execution_summary AS
SELECT 
    we.id,
    we.workflow_template_id,
    wt.name as template_name,
    we.status,
    we.duration_ms,
    we.total_tasks,
    we.completed_tasks,
    we.failed_tasks,
    we.confidence_score,
    we.created_at,
    we.completed_at,
    CASE 
        WHEN we.completed_tasks > 0 THEN (we.completed_tasks::DECIMAL / we.total_tasks::DECIMAL)
        ELSE 0 
    END as completion_rate
FROM workflow_executions we
LEFT JOIN workflow_templates wt ON we.workflow_template_id = wt.id;

CREATE OR REPLACE VIEW agent_performance_summary AS
SELECT 
    app.agent_id,
    app.agent_type,
    app.success_rate,
    app.average_latency,
    app.accuracy,
    app.total_executions,
    app.specializations,
    app.last_updated,
    CASE 
        WHEN app.success_rate >= 0.9 AND app.accuracy >= 0.85 THEN 'excellent'
        WHEN app.success_rate >= 0.8 AND app.accuracy >= 0.75 THEN 'good'
        WHEN app.success_rate >= 0.7 AND app.accuracy >= 0.65 THEN 'fair'
        ELSE 'needs_improvement'
    END as performance_grade
FROM agent_performance_profiles app
WHERE app.is_active = true;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Create RLS policies if needed (uncomment if using Row Level Security)
-- ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE task_executions ENABLE ROW LEVEL SECURITY;

-- Add comment for migration tracking
COMMENT ON TABLE workflow_templates IS 'Advanced agent orchestration workflow templates - v1.0';
COMMENT ON TABLE agent_performance_profiles IS 'Agent performance tracking and optimization - v1.0';
COMMENT ON TABLE workflow_executions IS 'Workflow execution history and metrics - v1.0';
COMMENT ON TABLE task_executions IS 'Individual task execution tracking - v1.0';