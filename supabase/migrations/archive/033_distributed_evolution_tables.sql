-- Distributed Evolution Coordinator Tables
-- This migration creates the infrastructure for distributed evolution processing

-- Evolution Nodes
CREATE TABLE IF NOT EXISTS evolution_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL CHECK (type IN ('coordinator', 'worker', 'evaluator')),
    endpoint TEXT NOT NULL,
    capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
    workload INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'online' CHECK (status IN ('online', 'offline', 'busy', 'maintenance')),
    performance JSONB NOT NULL DEFAULT '{
        "tasksCompleted": 0,
        "averageTaskTime": 0,
        "successRate": 1.0,
        "cpuUsage": 0,
        "memoryUsage": 0,
        "queueSize": 0
    }'::jsonb,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Evolution Clusters
CREATE TABLE IF NOT EXISTS evolution_clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    node_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    strategy VARCHAR(50) NOT NULL CHECK (strategy IN ('round-robin', 'load-balanced', 'capability-based', 'performance-weighted')),
    configuration JSONB NOT NULL DEFAULT '{
        "maxNodes": 10,
        "taskRetries": 3,
        "timeoutMs": 300000,
        "loadBalancing": {
            "algorithm": "weighted",
            "weights": {},
            "healthCheckInterval": 30000
        },
        "faultTolerance": {
            "maxFailures": 3,
            "retryDelayMs": 5000,
            "circuitBreakerThreshold": 0.5,
            "recoveryTimeMs": 60000
        }
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Evolution Tasks
CREATE TABLE IF NOT EXISTS evolution_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL CHECK (type IN ('evolution', 'evaluation', 'optimization', 'pattern-mining')),
    priority INTEGER DEFAULT 5,
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    dependencies JSONB DEFAULT '[]'::jsonb,
    assigned_node UUID REFERENCES evolution_nodes(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'running', 'completed', 'failed')),
    result JSONB,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    timeout_at TIMESTAMPTZ
);

-- Evolution Pipelines
CREATE TABLE IF NOT EXISTS evolution_pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    stages JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(50) DEFAULT 'running' CHECK (status IN ('running', 'paused', 'completed', 'failed')),
    metrics JSONB NOT NULL DEFAULT '{
        "totalTasks": 0,
        "completedTasks": 0,
        "failedTasks": 0,
        "averageLatency": 0,
        "throughput": 0,
        "resourceUtilization": 0
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task Dependencies
CREATE TABLE IF NOT EXISTS evolution_task_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES evolution_tasks(id) ON DELETE CASCADE,
    dependency_id UUID REFERENCES evolution_tasks(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(task_id, dependency_id)
);

-- Node Health Metrics
CREATE TABLE IF NOT EXISTS evolution_node_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID REFERENCES evolution_nodes(id) ON DELETE CASCADE,
    cpu_usage NUMERIC(5,2) NOT NULL,
    memory_usage NUMERIC(5,2) NOT NULL,
    disk_usage NUMERIC(5,2),
    network_latency INTEGER,
    queue_size INTEGER DEFAULT 0,
    active_tasks INTEGER DEFAULT 0,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task Execution History
CREATE TABLE IF NOT EXISTS evolution_task_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES evolution_tasks(id) ON DELETE CASCADE,
    node_id UUID REFERENCES evolution_nodes(id) ON DELETE SET NULL,
    execution_time INTEGER, -- milliseconds
    memory_peak INTEGER, -- bytes
    cpu_usage NUMERIC(5,2),
    success BOOLEAN NOT NULL,
    error_message TEXT,
    executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cluster Performance Metrics
CREATE TABLE IF NOT EXISTS evolution_cluster_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id UUID REFERENCES evolution_clusters(id) ON DELETE CASCADE,
    total_nodes INTEGER NOT NULL,
    active_nodes INTEGER NOT NULL,
    total_tasks INTEGER NOT NULL,
    completed_tasks INTEGER NOT NULL,
    failed_tasks INTEGER NOT NULL,
    average_workload NUMERIC(5,2),
    throughput NUMERIC(8,2),
    resource_utilization NUMERIC(3,2),
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Load Balancing History
CREATE TABLE IF NOT EXISTS evolution_load_balancing_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES evolution_tasks(id) ON DELETE CASCADE,
    cluster_id UUID REFERENCES evolution_clusters(id) ON DELETE CASCADE,
    selected_node UUID REFERENCES evolution_nodes(id) ON DELETE SET NULL,
    algorithm VARCHAR(50) NOT NULL,
    selection_factors JSONB,
    node_scores JSONB,
    decision_time INTEGER, -- milliseconds
    decided_at TIMESTAMPTZ DEFAULT NOW()
);

-- Circuit Breaker Status
CREATE TABLE IF NOT EXISTS evolution_circuit_breakers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID REFERENCES evolution_nodes(id) ON DELETE CASCADE,
    cluster_id UUID REFERENCES evolution_clusters(id) ON DELETE CASCADE,
    state VARCHAR(20) NOT NULL CHECK (state IN ('closed', 'open', 'half-open')),
    failure_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    last_failure_at TIMESTAMPTZ,
    next_attempt_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(node_id, cluster_id)
);

-- Communication Logs
CREATE TABLE IF NOT EXISTS evolution_communication_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_node UUID REFERENCES evolution_nodes(id) ON DELETE SET NULL,
    target_node UUID REFERENCES evolution_nodes(id) ON DELETE SET NULL,
    message_type VARCHAR(100) NOT NULL,
    payload_size INTEGER,
    success BOOLEAN NOT NULL,
    latency INTEGER, -- milliseconds
    error_details TEXT,
    logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_nodes_status ON evolution_nodes(status, last_seen DESC);
CREATE INDEX idx_nodes_type ON evolution_nodes(type);
CREATE INDEX idx_nodes_capabilities ON evolution_nodes USING GIN (capabilities);

CREATE INDEX idx_clusters_name ON evolution_clusters(name);
CREATE INDEX idx_clusters_strategy ON evolution_clusters(strategy);

CREATE INDEX idx_tasks_status ON evolution_tasks(status, priority DESC);
CREATE INDEX idx_tasks_type ON evolution_tasks(type);
CREATE INDEX idx_tasks_assigned_node ON evolution_tasks(assigned_node);
CREATE INDEX idx_tasks_created ON evolution_tasks(created_at DESC);
CREATE INDEX idx_tasks_timeout ON evolution_tasks(timeout_at) WHERE status IN ('assigned', 'running');

CREATE INDEX idx_pipelines_status ON evolution_pipelines(status);
CREATE INDEX idx_pipelines_created ON evolution_pipelines(created_at DESC);

CREATE INDEX idx_task_deps_task ON evolution_task_dependencies(task_id);
CREATE INDEX idx_task_deps_dependency ON evolution_task_dependencies(dependency_id);

CREATE INDEX idx_node_health_node_time ON evolution_node_health(node_id, recorded_at DESC);
CREATE INDEX idx_node_health_cpu ON evolution_node_health(cpu_usage DESC);
CREATE INDEX idx_node_health_memory ON evolution_node_health(memory_usage DESC);

CREATE INDEX idx_task_executions_task ON evolution_task_executions(task_id);
CREATE INDEX idx_task_executions_node ON evolution_task_executions(node_id, executed_at DESC);
CREATE INDEX idx_task_executions_success ON evolution_task_executions(success);

CREATE INDEX idx_cluster_metrics_cluster_time ON evolution_cluster_metrics(cluster_id, recorded_at DESC);
CREATE INDEX idx_cluster_metrics_throughput ON evolution_cluster_metrics(throughput DESC);

CREATE INDEX idx_load_balancing_task ON evolution_load_balancing_decisions(task_id);
CREATE INDEX idx_load_balancing_cluster ON evolution_load_balancing_decisions(cluster_id);
CREATE INDEX idx_load_balancing_algorithm ON evolution_load_balancing_decisions(algorithm);

CREATE INDEX idx_circuit_breakers_node ON evolution_circuit_breakers(node_id);
CREATE INDEX idx_circuit_breakers_state ON evolution_circuit_breakers(state);

CREATE INDEX idx_comm_logs_source ON evolution_communication_logs(source_node, logged_at DESC);
CREATE INDEX idx_comm_logs_target ON evolution_communication_logs(target_node, logged_at DESC);
CREATE INDEX idx_comm_logs_type ON evolution_communication_logs(message_type);

-- Functions for analytics
CREATE OR REPLACE FUNCTION calculate_cluster_efficiency(p_cluster_id UUID, p_hours INTEGER DEFAULT 24)
RETURNS TABLE(
    efficiency_score NUMERIC,
    task_completion_rate NUMERIC,
    average_task_time NUMERIC,
    resource_utilization NUMERIC,
    node_reliability NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH cluster_tasks AS (
        SELECT 
            et.id,
            et.status,
            EXTRACT(EPOCH FROM (et.completed_at - et.started_at)) * 1000 as execution_time,
            et.assigned_node
        FROM evolution_tasks et
        JOIN evolution_nodes en ON en.id = et.assigned_node
        JOIN evolution_clusters ec ON ec.id = p_cluster_id
        WHERE et.created_at > NOW() - (p_hours || ' hours')::INTERVAL
        AND en.id = ANY(SELECT jsonb_array_elements_text(ec.node_ids))
    ),
    task_stats AS (
        SELECT 
            COUNT(*) as total_tasks,
            COUNT(*) FILTER (WHERE status = 'completed') as completed_tasks,
            COUNT(*) FILTER (WHERE status = 'failed') as failed_tasks,
            AVG(execution_time) FILTER (WHERE status = 'completed') as avg_execution_time
        FROM cluster_tasks
    ),
    resource_stats AS (
        SELECT 
            AVG((performance->>'cpuUsage')::NUMERIC) as avg_cpu,
            AVG((performance->>'memoryUsage')::NUMERIC) as avg_memory
        FROM evolution_nodes en
        JOIN evolution_clusters ec ON ec.id = p_cluster_id
        WHERE en.id = ANY(SELECT jsonb_array_elements_text(ec.node_ids))
        AND en.last_seen > NOW() - (p_hours || ' hours')::INTERVAL
    ),
    reliability_stats AS (
        SELECT 
            AVG((performance->>'successRate')::NUMERIC) as avg_success_rate
        FROM evolution_nodes en
        JOIN evolution_clusters ec ON ec.id = p_cluster_id
        WHERE en.id = ANY(SELECT jsonb_array_elements_text(ec.node_ids))
    )
    SELECT 
        CASE 
            WHEN ts.total_tasks > 0 THEN 
                (ts.completed_tasks::NUMERIC / ts.total_tasks) * 
                (1 - COALESCE(rs.avg_cpu, 0) / 100) * 
                COALESCE(rel.avg_success_rate, 0)
            ELSE 0 
        END as efficiency_score,
        CASE 
            WHEN ts.total_tasks > 0 THEN ts.completed_tasks::NUMERIC / ts.total_tasks
            ELSE 0 
        END as task_completion_rate,
        COALESCE(ts.avg_execution_time, 0) as average_task_time,
        (COALESCE(rs.avg_cpu, 0) + COALESCE(rs.avg_memory, 0)) / 2 as resource_utilization,
        COALESCE(rel.avg_success_rate, 0) as node_reliability
    FROM task_stats ts
    CROSS JOIN resource_stats rs
    CROSS JOIN reliability_stats rel;
END;
$$ LANGUAGE plpgsql;

-- Function to get optimal node for task
CREATE OR REPLACE FUNCTION get_optimal_node_for_task(
    p_task_type VARCHAR,
    p_cluster_id UUID DEFAULT NULL
)
RETURNS TABLE(
    node_id UUID,
    suitability_score NUMERIC,
    current_workload INTEGER,
    success_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH candidate_nodes AS (
        SELECT 
            en.id,
            en.workload,
            (en.performance->>'successRate')::NUMERIC as success_rate,
            (en.performance->>'averageTaskTime')::NUMERIC as avg_task_time,
            (en.performance->>'queueSize')::INTEGER as queue_size
        FROM evolution_nodes en
        WHERE en.status = 'online'
        AND (p_cluster_id IS NULL OR 
             en.id = ANY(SELECT jsonb_array_elements_text(ec.node_ids) 
                        FROM evolution_clusters ec WHERE ec.id = p_cluster_id))
        AND (en.capabilities ? p_task_type OR en.capabilities ? '*')
    ),
    scored_nodes AS (
        SELECT 
            cn.id,
            cn.workload,
            cn.success_rate,
            -- Scoring: lower workload + higher success rate + faster execution
            (
                (1 - cn.workload::NUMERIC / 100) * 0.4 +
                cn.success_rate * 0.4 +
                CASE 
                    WHEN cn.avg_task_time > 0 THEN (1 / LOG(cn.avg_task_time + 1)) * 0.2
                    ELSE 0.2
                END
            ) as suitability_score
        FROM candidate_nodes cn
    )
    SELECT 
        sn.id,
        sn.suitability_score,
        sn.workload,
        sn.success_rate
    FROM scored_nodes sn
    ORDER BY sn.suitability_score DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to detect task bottlenecks
CREATE OR REPLACE FUNCTION detect_task_bottlenecks(p_hours INTEGER DEFAULT 6)
RETURNS TABLE(
    bottleneck_type VARCHAR,
    affected_tasks INTEGER,
    average_delay INTEGER,
    recommended_action TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH task_analysis AS (
        SELECT 
            et.type,
            et.status,
            CASE 
                WHEN et.status = 'pending' AND et.created_at < NOW() - INTERVAL '5 minutes'
                THEN 'scheduling_delay'
                WHEN et.status = 'assigned' AND et.started_at < NOW() - INTERVAL '2 minutes'
                THEN 'execution_delay'
                WHEN et.status = 'running' AND et.started_at < NOW() - INTERVAL '10 minutes'
                THEN 'processing_delay'
                ELSE 'normal'
            END as bottleneck_type,
            EXTRACT(EPOCH FROM (NOW() - et.created_at)) as total_delay
        FROM evolution_tasks et
        WHERE et.created_at > NOW() - (p_hours || ' hours')::INTERVAL
    )
    SELECT 
        ta.bottleneck_type::VARCHAR,
        COUNT(*)::INTEGER as affected_tasks,
        AVG(ta.total_delay)::INTEGER as average_delay,
        CASE ta.bottleneck_type
            WHEN 'scheduling_delay' THEN 'Add more worker nodes or increase cluster capacity'
            WHEN 'execution_delay' THEN 'Check node connectivity and resource availability'
            WHEN 'processing_delay' THEN 'Optimize task processing or increase task timeout'
            ELSE 'No action needed'
        END as recommended_action
    FROM task_analysis ta
    WHERE ta.bottleneck_type != 'normal'
    GROUP BY ta.bottleneck_type
    HAVING COUNT(*) > 0;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update node last_seen on heartbeat
CREATE OR REPLACE FUNCTION update_node_last_seen()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_seen = NOW();
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_node_last_seen
BEFORE UPDATE ON evolution_nodes
FOR EACH ROW
EXECUTE FUNCTION update_node_last_seen();

-- Trigger to log task execution
CREATE OR REPLACE FUNCTION log_task_execution()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' OR NEW.status = 'failed' THEN
        INSERT INTO evolution_task_executions (
            task_id,
            node_id,
            execution_time,
            success,
            error_message,
            executed_at
        ) VALUES (
            NEW.id,
            NEW.assigned_node,
            CASE 
                WHEN NEW.started_at IS NOT NULL AND NEW.completed_at IS NOT NULL 
                THEN EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at)) * 1000
                ELSE NULL
            END,
            NEW.status = 'completed',
            NEW.error,
            NEW.completed_at
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_task_execution
AFTER UPDATE ON evolution_tasks
FOR EACH ROW
WHEN (NEW.status != OLD.status AND NEW.status IN ('completed', 'failed'))
EXECUTE FUNCTION log_task_execution();

-- Trigger to update cluster metrics
CREATE OR REPLACE FUNCTION update_cluster_metrics()
RETURNS TRIGGER AS $$
DECLARE
    v_cluster_id UUID;
BEGIN
    -- Find clusters containing this node
    FOR v_cluster_id IN 
        SELECT ec.id 
        FROM evolution_clusters ec 
        WHERE NEW.assigned_node = ANY(SELECT jsonb_array_elements_text(ec.node_ids))
    LOOP
        INSERT INTO evolution_cluster_metrics (
            cluster_id,
            total_nodes,
            active_nodes,
            total_tasks,
            completed_tasks,
            failed_tasks,
            average_workload,
            throughput
        )
        SELECT 
            v_cluster_id,
            jsonb_array_length(ec.node_ids),
            COUNT(DISTINCT en.id) FILTER (WHERE en.status = 'online'),
            COUNT(et.id),
            COUNT(et.id) FILTER (WHERE et.status = 'completed'),
            COUNT(et.id) FILTER (WHERE et.status = 'failed'),
            AVG(en.workload),
            COUNT(et.id) FILTER (WHERE et.status = 'completed' AND et.completed_at > NOW() - INTERVAL '1 hour')
        FROM evolution_clusters ec
        LEFT JOIN evolution_nodes en ON en.id = ANY(SELECT jsonb_array_elements_text(ec.node_ids))
        LEFT JOIN evolution_tasks et ON et.assigned_node = en.id
        WHERE ec.id = v_cluster_id
        GROUP BY ec.id, ec.node_ids
        ON CONFLICT (cluster_id) WHERE recorded_at::date = CURRENT_DATE
        DO UPDATE SET
            total_nodes = EXCLUDED.total_nodes,
            active_nodes = EXCLUDED.active_nodes,
            total_tasks = EXCLUDED.total_tasks,
            completed_tasks = EXCLUDED.completed_tasks,
            failed_tasks = EXCLUDED.failed_tasks,
            average_workload = EXCLUDED.average_workload,
            throughput = EXCLUDED.throughput,
            recorded_at = NOW();
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_cluster_metrics
AFTER UPDATE ON evolution_tasks
FOR EACH ROW
WHEN (NEW.status != OLD.status)
EXECUTE FUNCTION update_cluster_metrics();

-- Row Level Security
ALTER TABLE evolution_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE evolution_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE evolution_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE evolution_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE evolution_task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE evolution_node_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE evolution_task_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE evolution_cluster_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE evolution_load_balancing_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE evolution_circuit_breakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE evolution_communication_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read for authenticated users" ON evolution_nodes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for service role" ON evolution_nodes FOR ALL USING (auth.role() = 'service_role');

-- Views for easy querying
CREATE VIEW cluster_status_summary AS
SELECT 
    ec.id,
    ec.name,
    ec.strategy,
    jsonb_array_length(ec.node_ids) as total_nodes,
    COUNT(en.id) FILTER (WHERE en.status = 'online') as active_nodes,
    AVG(en.workload) as average_workload,
    SUM((en.performance->>'queueSize')::INTEGER) as total_queue_size,
    ec.created_at
FROM evolution_clusters ec
LEFT JOIN evolution_nodes en ON en.id = ANY(SELECT jsonb_array_elements_text(ec.node_ids))
GROUP BY ec.id, ec.name, ec.strategy, ec.node_ids, ec.created_at;

CREATE VIEW task_processing_summary AS
SELECT 
    et.type,
    et.status,
    COUNT(*) as task_count,
    AVG(EXTRACT(EPOCH FROM (et.completed_at - et.started_at))) as avg_processing_time,
    MIN(et.created_at) as oldest_task,
    MAX(et.created_at) as newest_task
FROM evolution_tasks et
WHERE et.created_at > NOW() - INTERVAL '24 hours'
GROUP BY et.type, et.status;

CREATE VIEW node_performance_summary AS
SELECT 
    en.id,
    en.type,
    en.status,
    en.workload,
    (en.performance->>'tasksCompleted')::INTEGER as tasks_completed,
    (en.performance->>'successRate')::NUMERIC as success_rate,
    (en.performance->>'averageTaskTime')::NUMERIC as avg_task_time,
    (en.performance->>'queueSize')::INTEGER as queue_size,
    en.last_seen
FROM evolution_nodes en
ORDER BY en.last_seen DESC;

-- Comments
COMMENT ON TABLE evolution_nodes IS 'Registry of nodes participating in distributed evolution';
COMMENT ON TABLE evolution_clusters IS 'Clusters of nodes for organized task distribution';
COMMENT ON TABLE evolution_tasks IS 'Distributed tasks for evolution processing';
COMMENT ON TABLE evolution_pipelines IS 'Evolution pipelines with multiple stages';
COMMENT ON TABLE evolution_task_dependencies IS 'Dependencies between tasks';
COMMENT ON TABLE evolution_node_health IS 'Health metrics for nodes over time';
COMMENT ON TABLE evolution_task_executions IS 'Execution history and performance metrics';
COMMENT ON TABLE evolution_cluster_metrics IS 'Performance metrics for clusters';
COMMENT ON TABLE evolution_load_balancing_decisions IS 'Load balancing decision history';
COMMENT ON TABLE evolution_circuit_breakers IS 'Circuit breaker status for fault tolerance';
COMMENT ON TABLE evolution_communication_logs IS 'Communication logs between nodes';