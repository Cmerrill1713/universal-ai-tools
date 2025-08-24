-- Security and RLS Setup for Universal AI Tools
-- This migration ensures proper security policies are in place

-- ============================================
-- 1. ENABLE RLS ON ALL TABLES
-- ============================================

-- Core AI Service Tables
ALTER TABLE ai_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_service_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE self_improvement_logs ENABLE ROW LEVEL SECURITY;

-- MCP Context Tables
ALTER TABLE mcp_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_code_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_task_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_error_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_key_vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_agent_executions ENABLE ROW LEVEL SECURITY;

-- Knowledge & Learning Tables
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_learning_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE pattern_mining_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE reinforcement_learning_episodes ENABLE ROW LEVEL SECURITY;

-- Agent & Orchestration Tables
ALTER TABLE agent_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_swarm_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_swarm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_communication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE orchestration_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE orchestration_workflow_steps ENABLE ROW LEVEL SECURITY;

-- MLX & Fine-Tuning Tables
ALTER TABLE mlx_fine_tuning_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mlx_fine_tuning_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE mlx_model_evaluations ENABLE ROW LEVEL SECURITY;

-- Parameter & Analytics Tables
ALTER TABLE parameter_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE parameter_optimization_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_aggregations ENABLE ROW LEVEL SECURITY;

-- Vision & Processing Tables
ALTER TABLE vision_processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE vision_models ENABLE ROW LEVEL SECURITY;

-- Evolution & Architecture Tables
ALTER TABLE alpha_evolve_populations ENABLE ROW LEVEL SECURITY;
ALTER TABLE alpha_evolve_individuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE alpha_evolve_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE distributed_evolution_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE distributed_evolution_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_architecture_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_architecture_evaluations ENABLE ROW LEVEL SECURITY;

-- Security & Auth Tables (MOST CRITICAL)
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE jwt_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE encryption_keys ENABLE ROW LEVEL SECURITY;

-- Reranking Tables
ALTER TABLE reranking_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reranking_models ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. CREATE RLS POLICIES
-- ============================================

-- Helper function to check if user is service role
CREATE OR REPLACE FUNCTION auth.is_service_role()
RETURNS boolean AS $$
BEGIN
  RETURN auth.role() = 'service_role';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policy for service role (full access) on all tables
DO $$
DECLARE
    tbl RECORD;
BEGIN
    FOR tbl IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    LOOP
        -- Drop existing policies first
        EXECUTE format('DROP POLICY IF EXISTS service_role_all ON %I', tbl.tablename);
        
        -- Create service role policy
        EXECUTE format('
            CREATE POLICY service_role_all ON %I
            FOR ALL
            USING (auth.is_service_role())
            WITH CHECK (auth.is_service_role())
        ', tbl.tablename);
    END LOOP;
END;
$$;

-- Specific policies for authenticated users on safe tables
-- MCP Context Tables (read/write for authenticated users)
CREATE POLICY "authenticated_users_mcp_context" ON mcp_context
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_users_mcp_code_patterns" ON mcp_code_patterns
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_users_mcp_task_progress" ON mcp_task_progress
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_users_mcp_error_analysis" ON mcp_error_analysis
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Knowledge base (read-only for authenticated users)
CREATE POLICY "authenticated_read_knowledge" ON knowledge_base
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Agent registry (read-only for authenticated users)
CREATE POLICY "authenticated_read_agents" ON agent_registry
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- NO ACCESS for authenticated users on sensitive tables
-- (api_keys, jwt_secrets, encryption_keys, mcp_key_vault - service role only)

-- ============================================
-- 3. CREATE MISSING INDEXES
-- ============================================

-- Performance indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_ai_memories_service_id ON ai_memories(service_id);
CREATE INDEX IF NOT EXISTS idx_ai_memories_created_at ON ai_memories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_memories_content_tsv ON ai_memories USING gin(to_tsvector('english', content));

CREATE INDEX IF NOT EXISTS idx_agent_performance_agent_id ON agent_performance_metrics(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_performance_created_at ON agent_performance_metrics(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_source_id ON knowledge_base(source_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_created_at ON knowledge_base(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_content_tsv ON knowledge_base USING gin(to_tsvector('english', content));

CREATE INDEX IF NOT EXISTS idx_mlx_jobs_status ON mlx_fine_tuning_jobs(status);
CREATE INDEX IF NOT EXISTS idx_mlx_jobs_created_at ON mlx_fine_tuning_jobs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_parameter_analytics_model ON parameter_analytics(model);
CREATE INDEX IF NOT EXISTS idx_parameter_analytics_created_at ON parameter_analytics(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_events_type ON feedback_events(event_type);
CREATE INDEX IF NOT EXISTS idx_feedback_events_created_at ON feedback_events(created_at DESC);

-- ============================================
-- 4. CREATE AUDIT LOG TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    user_id UUID,
    user_role TEXT,
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for audit logs
CREATE INDEX idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);

-- Enable RLS on audit logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only service role can read audit logs
CREATE POLICY "service_role_only_audit" ON audit_logs
    FOR ALL
    USING (auth.is_service_role())
    WITH CHECK (auth.is_service_role());

-- ============================================
-- 5. CREATE AUDIT TRIGGER FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
    audit_user_id UUID;
    audit_role TEXT;
BEGIN
    -- Get user info
    audit_user_id := auth.uid();
    audit_role := auth.role();
    
    -- Skip auditing for certain system tables
    IF TG_TABLE_NAME IN ('audit_logs', 'spatial_ref_sys') THEN
        RETURN NEW;
    END IF;
    
    -- Insert audit record
    INSERT INTO audit_logs (
        table_name,
        operation,
        user_id,
        user_role,
        old_data,
        new_data,
        ip_address,
        user_agent
    ) VALUES (
        TG_TABLE_NAME,
        TG_OP,
        audit_user_id,
        audit_role,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
        inet_client_addr(),
        current_setting('request.headers', true)::json->>'user-agent'
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. APPLY AUDIT TRIGGERS TO SENSITIVE TABLES
-- ============================================

-- Apply audit triggers to critical tables
CREATE TRIGGER audit_trigger_api_keys
    AFTER INSERT OR UPDATE OR DELETE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_trigger_jwt_secrets
    AFTER INSERT OR UPDATE OR DELETE ON jwt_secrets
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_trigger_encryption_keys
    AFTER INSERT OR UPDATE OR DELETE ON encryption_keys
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_trigger_mcp_key_vault
    AFTER INSERT OR UPDATE OR DELETE ON mcp_key_vault
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_trigger_ai_service_keys
    AFTER INSERT OR UPDATE OR DELETE ON ai_service_keys
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- ============================================
-- 7. CREATE SECURITY HELPER FUNCTIONS
-- ============================================

-- Function to check if a user owns a resource
CREATE OR REPLACE FUNCTION auth.owns_resource(resource_user_id UUID)
RETURNS boolean AS $$
BEGIN
    RETURN auth.uid() = resource_user_id OR auth.is_service_role();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mask sensitive data
CREATE OR REPLACE FUNCTION mask_sensitive_data(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
    IF length(input_text) <= 8 THEN
        RETURN repeat('*', length(input_text));
    ELSE
        RETURN left(input_text, 4) || repeat('*', length(input_text) - 8) || right(input_text, 4);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. CREATE MONITORING TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS system_health_checks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    service_name TEXT NOT NULL,
    check_type TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
    response_time_ms INTEGER,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_request_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    user_id UUID,
    ip_address INET,
    user_agent TEXT,
    request_body JSONB,
    response_body JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for monitoring tables
CREATE INDEX idx_health_checks_created_at ON system_health_checks(created_at DESC);
CREATE INDEX idx_health_checks_service_status ON system_health_checks(service_name, status);
CREATE INDEX idx_api_logs_created_at ON api_request_logs(created_at DESC);
CREATE INDEX idx_api_logs_path_method ON api_request_logs(path, method);
CREATE INDEX idx_api_logs_user_id ON api_request_logs(user_id);

-- Enable RLS
ALTER TABLE system_health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_request_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "service_role_health_checks" ON system_health_checks
    FOR ALL USING (auth.is_service_role());

CREATE POLICY "service_role_api_logs" ON api_request_logs
    FOR ALL USING (auth.is_service_role());

-- ============================================
-- 9. SECURITY SUMMARY VIEW
-- ============================================

CREATE OR REPLACE VIEW security_summary AS
SELECT 
    t.tablename,
    t.rowsecurity as rls_enabled,
    COUNT(p.policyname) as policy_count,
    CASE 
        WHEN t.tablename IN ('api_keys', 'jwt_secrets', 'encryption_keys', 'mcp_key_vault') 
        THEN 'CRITICAL'
        WHEN t.tablename LIKE '%_keys' OR t.tablename LIKE '%_secrets'
        THEN 'HIGH'
        ELSE 'NORMAL'
    END as security_level
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.schemaname = 'public'
GROUP BY t.tablename, t.rowsecurity
ORDER BY 
    CASE 
        WHEN t.tablename IN ('api_keys', 'jwt_secrets', 'encryption_keys', 'mcp_key_vault') THEN 1
        WHEN t.tablename LIKE '%_keys' OR t.tablename LIKE '%_secrets' THEN 2
        ELSE 3
    END,
    t.tablename;

-- Grant read access to authenticated users
GRANT SELECT ON security_summary TO authenticated;

-- ============================================
-- 10. FINAL SECURITY NOTES
-- ============================================

COMMENT ON TABLE audit_logs IS 'Audit trail for all sensitive operations. Service role access only.';
COMMENT ON TABLE system_health_checks IS 'System health monitoring data. Service role access only.';
COMMENT ON TABLE api_request_logs IS 'API request logging for security and performance monitoring.';
COMMENT ON VIEW security_summary IS 'Overview of table security settings and policies.';

-- Print summary
DO $$
BEGIN
    RAISE NOTICE 'Security setup completed:';
    RAISE NOTICE '- RLS enabled on all tables';
    RAISE NOTICE '- Service role policies created';
    RAISE NOTICE '- Authenticated user policies for safe tables';
    RAISE NOTICE '- Audit logging enabled for sensitive tables';
    RAISE NOTICE '- Performance indexes created';
    RAISE NOTICE '- Monitoring tables added';
    RAISE NOTICE '';
    RAISE NOTICE 'IMPORTANT: Remember to enable Vault in Supabase Dashboard for API key storage!';
END;
$$;