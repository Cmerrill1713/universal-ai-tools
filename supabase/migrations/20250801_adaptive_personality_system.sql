-- Migration: Adaptive AI Personality System
-- Implements comprehensive personality-based AI adaptation with mobile optimization
-- Integration with Universal AI Tools service architecture

BEGIN;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Helper function for getting current user ID
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    auth.jwt() ->> 'sub',
    current_setting('app.current_user_id', true)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- USER PERSONALITY PROFILES
-- Core personality data with vector embeddings for similarity matching
-- =============================================================================

CREATE TABLE user_personality_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL UNIQUE,
    
    -- Core personality attributes
    communication_style TEXT CHECK (communication_style IN ('concise', 'detailed', 'conversational', 'technical', 'adaptive')) DEFAULT 'conversational',
    expertise_areas TEXT[] DEFAULT '{}',
    response_patterns JSONB DEFAULT '{}',
    
    -- Interaction and learning data
    interaction_history JSONB DEFAULT '{}',
    learning_preferences JSONB DEFAULT '{}',
    contextual_patterns JSONB DEFAULT '{}',
    
    -- Biometric and device correlations
    biometric_patterns JSONB DEFAULT '{}',
    device_preferences JSONB DEFAULT '{}',
    temporal_patterns JSONB DEFAULT '{}',
    
    -- Vector representation for similarity matching
    personality_vector vector(1536),
    
    -- Model management
    current_model_path TEXT,
    model_version TEXT DEFAULT '1.0',
    training_status TEXT CHECK (training_status IN ('none', 'scheduled', 'training', 'ready', 'updating', 'failed')) DEFAULT 'none',
    
    -- Performance tracking
    satisfaction_score REAL DEFAULT 0.0 CHECK (satisfaction_score >= 0.0 AND satisfaction_score <= 5.0),
    consistency_score REAL DEFAULT 0.0 CHECK (consistency_score >= 0.0 AND consistency_score <= 1.0),
    adaptation_rate REAL DEFAULT 0.0,
    
    -- Metadata
    last_interaction TIMESTAMPTZ,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Security and access control
    privacy_settings JSONB DEFAULT '{"biometric_learning": true, "pattern_analysis": true, "model_training": true}',
    security_level TEXT CHECK (security_level IN ('basic', 'enhanced', 'maximum')) DEFAULT 'enhanced'
);

-- Indexes for performance
CREATE INDEX idx_personality_profiles_user_id ON user_personality_profiles(user_id);
CREATE INDEX idx_personality_profiles_training_status ON user_personality_profiles(training_status);
CREATE INDEX idx_personality_profiles_last_interaction ON user_personality_profiles(last_interaction DESC);
CREATE INDEX idx_personality_profiles_vector ON user_personality_profiles USING ivfflat (personality_vector vector_cosine_ops);

-- Enable RLS
ALTER TABLE user_personality_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own personality profile" 
ON user_personality_profiles FOR SELECT 
USING (user_id = get_current_user_id());

CREATE POLICY "Users can insert own personality profile" 
ON user_personality_profiles FOR INSERT 
WITH CHECK (user_id = get_current_user_id());

CREATE POLICY "Users can update own personality profile" 
ON user_personality_profiles FOR UPDATE 
USING (user_id = get_current_user_id());

CREATE POLICY "Service role can manage all personality profiles" 
ON user_personality_profiles FOR ALL 
USING (auth.jwt() ->> 'role' = 'service_role');

-- =============================================================================
-- PERSONALITY MODELS REGISTRY
-- Registry of trained personality models with mobile optimization metadata
-- =============================================================================

CREATE TABLE personality_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    
    -- Model identification
    model_name TEXT NOT NULL,
    model_path TEXT NOT NULL,
    model_hash TEXT, -- For integrity verification
    
    -- Model specifications
    base_model TEXT NOT NULL DEFAULT 'llama3.2:3b',
    model_size_mb REAL NOT NULL,
    quantization_level INTEGER DEFAULT 8 CHECK (quantization_level IN (4, 8, 16)),
    
    -- Mobile optimization metadata
    mobile_optimizations JSONB DEFAULT '{}',
    device_targets JSONB DEFAULT '[]', -- Array of supported device types
    performance_profile JSONB DEFAULT '{}',
    
    -- Training metadata
    training_job_id UUID,
    training_dataset_hash TEXT,
    training_parameters JSONB DEFAULT '{}',
    training_metrics JSONB DEFAULT '{}',
    
    -- Deployment and status
    status TEXT CHECK (status IN ('training', 'ready', 'deployed', 'updating', 'deprecated', 'failed')) DEFAULT 'training',
    deployment_config JSONB DEFAULT '{}',
    
    -- Performance tracking
    usage_count INTEGER DEFAULT 0,
    average_latency_ms REAL DEFAULT 0.0,
    memory_usage_mb REAL DEFAULT 0.0,
    battery_impact_score REAL DEFAULT 0.0,
    user_feedback_score REAL DEFAULT 0.0,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deployed_at TIMESTAMPTZ,
    deprecated_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT unique_user_model_name UNIQUE (user_id, model_name)
);

-- Indexes for performance
CREATE INDEX idx_personality_models_user_id ON personality_models(user_id);
CREATE INDEX idx_personality_models_status ON personality_models(status);
CREATE INDEX idx_personality_models_updated_at ON personality_models(updated_at DESC);
CREATE INDEX idx_personality_models_performance ON personality_models(average_latency_ms, memory_usage_mb);

-- Enable RLS
ALTER TABLE personality_models ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own personality models" 
ON personality_models FOR SELECT 
USING (user_id = get_current_user_id());

CREATE POLICY "Users can insert own personality models" 
ON personality_models FOR INSERT 
WITH CHECK (user_id = get_current_user_id());

CREATE POLICY "Users can update own personality models" 
ON personality_models FOR UPDATE 
USING (user_id = get_current_user_id());

CREATE POLICY "Service role can manage all personality models" 
ON personality_models FOR ALL 
USING (auth.jwt() ->> 'role' = 'service_role');

-- =============================================================================
-- BIOMETRIC PERSONALITY DATA
-- Correlations between biometric authentication patterns and personality responses
-- =============================================================================

CREATE TABLE biometric_personality_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    device_id TEXT,
    
    -- Authentication context
    auth_timestamp TIMESTAMPTZ NOT NULL,
    auth_method TEXT NOT NULL CHECK (auth_method IN ('touchid', 'faceid', 'voiceid', 'passcode', 'proximity')),
    biometric_confidence REAL NOT NULL CHECK (biometric_confidence >= 0.0 AND biometric_confidence <= 1.0),
    
    -- Interaction quality metrics
    interaction_quality_score REAL,
    response_satisfaction REAL CHECK (response_satisfaction >= 0.0 AND response_satisfaction <= 5.0),
    engagement_duration INTEGER, -- seconds
    task_completion_rate REAL CHECK (task_completion_rate >= 0.0 AND task_completion_rate <= 1.0),
    
    -- Contextual factors (encrypted for privacy)
    stress_indicators JSONB DEFAULT '{}',
    temporal_context JSONB DEFAULT '{}', -- time of day, day of week, etc.
    environmental_context JSONB DEFAULT '{}',
    device_context JSONB DEFAULT '{}',
    
    -- Personality adaptations applied
    personality_adjustments JSONB DEFAULT '{}',
    model_parameters_used JSONB DEFAULT '{}',
    
    -- Privacy and security
    data_classification TEXT DEFAULT 'aggregated' CHECK (data_classification IN ('raw', 'processed', 'aggregated')),
    retention_until TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '90 days'), -- Auto-cleanup
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexes on creation for partitioning
    CONSTRAINT valid_timestamps CHECK (auth_timestamp <= created_at)
);

-- Partitioning for performance (by month)
-- Note: In production, implement proper partitioning by created_at
CREATE INDEX idx_biometric_personality_user_time 
ON biometric_personality_data(user_id, auth_timestamp DESC);

CREATE INDEX idx_biometric_personality_device 
ON biometric_personality_data(device_id, auth_timestamp DESC);

CREATE INDEX idx_biometric_personality_method 
ON biometric_personality_data(auth_method, biometric_confidence);

CREATE INDEX idx_biometric_personality_retention 
ON biometric_personality_data(retention_until) WHERE retention_until < NOW();

-- Enable RLS
ALTER TABLE biometric_personality_data ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own biometric personality data" 
ON biometric_personality_data FOR SELECT 
USING (user_id = get_current_user_id());

CREATE POLICY "Users can insert own biometric personality data" 
ON biometric_personality_data FOR INSERT 
WITH CHECK (user_id = get_current_user_id());

CREATE POLICY "Service role can manage all biometric personality data" 
ON biometric_personality_data FOR ALL 
USING (auth.jwt() ->> 'role' = 'service_role');

-- =============================================================================
-- PERSONALITY INTERACTION SESSIONS
-- Track personality-aware interaction sessions for learning and optimization
-- =============================================================================

CREATE TABLE personality_interaction_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    personality_model_id UUID REFERENCES personality_models(id),
    
    -- Session identification 
    session_id TEXT NOT NULL,
    interaction_sequence INTEGER NOT NULL,
    
    -- Context and input
    user_request TEXT NOT NULL,
    context_data JSONB DEFAULT '{}',
    device_context JSONB DEFAULT '{}',
    
    -- Personality processing
    personality_context JSONB DEFAULT '{}',
    model_parameters JSONB DEFAULT '{}',
    processing_time_ms INTEGER,
    
    -- Response and quality
    ai_response TEXT,
    response_quality_score REAL,
    personality_consistency_score REAL,
    user_feedback_score REAL,
    
    -- Learning data
    adaptation_applied JSONB DEFAULT '{}',
    learning_signals JSONB DEFAULT '{}',
    improvement_suggestions JSONB DEFAULT '{}',
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_session_sequence UNIQUE (session_id, interaction_sequence)
);

-- Indexes for performance and analytics
CREATE INDEX idx_personality_sessions_user_id ON personality_interaction_sessions(user_id);
CREATE INDEX idx_personality_sessions_model_id ON personality_interaction_sessions(personality_model_id);
CREATE INDEX idx_personality_sessions_session_id ON personality_interaction_sessions(session_id, interaction_sequence);
CREATE INDEX idx_personality_sessions_created_at ON personality_interaction_sessions(created_at DESC);
CREATE INDEX idx_personality_sessions_quality ON personality_interaction_sessions(response_quality_score DESC, personality_consistency_score DESC);

-- Enable RLS
ALTER TABLE personality_interaction_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own personality sessions" 
ON personality_interaction_sessions FOR SELECT 
USING (user_id = get_current_user_id());

CREATE POLICY "Users can insert own personality sessions" 
ON personality_interaction_sessions FOR INSERT 
WITH CHECK (user_id = get_current_user_id());

CREATE POLICY "Service role can manage all personality sessions" 
ON personality_interaction_sessions FOR ALL 
USING (auth.jwt() ->> 'role' = 'service_role');

-- =============================================================================
-- UTILITY FUNCTIONS
-- Helper functions for personality system operations
-- =============================================================================

-- Function to calculate personality similarity
CREATE OR REPLACE FUNCTION calculate_personality_similarity(
    user_vector vector(1536),
    comparison_vector vector(1536)
)
RETURNS REAL AS $$
BEGIN
    -- Calculate cosine similarity
    RETURN 1 - (user_vector <=> comparison_vector);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get personality insights
CREATE OR REPLACE FUNCTION get_personality_insights(
    input_user_id TEXT
)
RETURNS TABLE (
    communication_style TEXT,
    top_expertise_areas TEXT[],
    interaction_patterns JSONB,
    model_performance JSONB,
    recommendations JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.communication_style,
        p.expertise_areas[1:5] as top_expertise_areas,
        p.interaction_history as interaction_patterns,
        jsonb_build_object(
            'satisfaction_score', p.satisfaction_score,
            'consistency_score', p.consistency_score,
            'model_version', p.model_version,
            'training_status', p.training_status
        ) as model_performance,
        jsonb_build_object(
            'needs_retraining', (p.satisfaction_score < 3.5 OR p.consistency_score < 0.7),
            'adaptation_opportunity', (p.adaptation_rate < 0.1),
            'engagement_improvement', (p.last_interaction < NOW() - INTERVAL '7 days')
        ) as recommendations
    FROM user_personality_profiles p
    WHERE p.user_id = input_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for automatic data cleanup (GDPR compliance)
CREATE OR REPLACE FUNCTION cleanup_expired_biometric_data()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM biometric_personality_data 
    WHERE retention_until < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log cleanup activity
    INSERT INTO ai_service_logs (service_name, log_level, message, metadata)
    VALUES (
        'personality-system',
        'INFO',
        'Biometric data cleanup completed',
        jsonb_build_object('deleted_records', deleted_count, 'cleanup_time', NOW())
    );
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- TRIGGERS AND AUTOMATION
-- Automated maintenance and data management
-- =============================================================================

-- Trigger to update personality profile timestamps
CREATE OR REPLACE FUNCTION update_personality_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = NOW();
    
    -- Update last interaction if interaction data changed
    IF OLD.interaction_history IS DISTINCT FROM NEW.interaction_history THEN
        NEW.last_interaction = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_personality_profile_timestamp
    BEFORE UPDATE ON user_personality_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_personality_profile_timestamp();

-- Trigger to update model timestamps
CREATE OR REPLACE FUNCTION update_personality_model_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    
    -- Set deployed_at when status changes to deployed
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'deployed' THEN
        NEW.deployed_at = NOW();
    END IF;
    
    -- Set deprecated_at when status changes to deprecated
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'deprecated' THEN
        NEW.deprecated_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_personality_model_timestamp
    BEFORE UPDATE ON personality_models
    FOR EACH ROW
    EXECUTE FUNCTION update_personality_model_timestamp();

-- =============================================================================
-- INITIAL DATA SETUP
-- Create default personality profiles for existing users
-- =============================================================================

-- Insert default personality profiles for existing users
INSERT INTO user_personality_profiles (
    user_id, 
    communication_style, 
    expertise_areas,
    privacy_settings
)
SELECT 
    id as user_id,
    'conversational' as communication_style,
    ARRAY[]::TEXT[] as expertise_areas,
    jsonb_build_object(
        'biometric_learning', true,
        'pattern_analysis', true,
        'model_training', true,
        'data_retention_days', 90
    ) as privacy_settings
FROM auth.users
WHERE NOT EXISTS (
    SELECT 1 FROM user_personality_profiles p 
    WHERE p.user_id = auth.users.id
)
ON CONFLICT (user_id) DO NOTHING;

-- =============================================================================
-- SCHEDULED JOBS
-- Set up automated maintenance tasks
-- =============================================================================

-- Note: In production, these would be implemented as pg_cron jobs or external schedulers

-- Example scheduled job setup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-biometric-data', '0 2 * * *', 'SELECT cleanup_expired_biometric_data();');

COMMIT;

-- =============================================================================
-- MIGRATION COMPLETION LOG
-- =============================================================================

INSERT INTO ai_service_logs (service_name, log_level, message, metadata)
VALUES (
    'personality-system',
    'INFO',
    'Adaptive AI Personality System migration completed successfully',
    jsonb_build_object(
        'migration_file', '20250801_adaptive_personality_system.sql',
        'tables_created', ARRAY['user_personality_profiles', 'personality_models', 'biometric_personality_data', 'personality_interaction_sessions'],
        'functions_created', ARRAY['calculate_personality_similarity', 'get_personality_insights', 'cleanup_expired_biometric_data'],
        'migration_time', NOW()
    )
);