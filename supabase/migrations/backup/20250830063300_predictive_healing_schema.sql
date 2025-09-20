-- Predictive Healing System Database Schema
-- Creates tables for MLX training data and healing learning patterns

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create healing_learning table for pattern storage
CREATE TABLE IF NOT EXISTS public.healing_learning (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pattern_id VARCHAR(255) UNIQUE NOT NULL,
    error_type VARCHAR(100) NOT NULL,
    error_message TEXT NOT NULL,
    error_context JSONB NOT NULL DEFAULT '{}',
    severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
    healing_approach VARCHAR(255) NOT NULL,
    healing_module VARCHAR(255) NOT NULL,
    healing_parameters JSONB NOT NULL DEFAULT '{}',
    healing_duration INTEGER NOT NULL DEFAULT 0,
    success_rate FLOAT NOT NULL DEFAULT 0.0,
    confidence FLOAT NOT NULL DEFAULT 0.0,
    validation_passed BOOLEAN NOT NULL DEFAULT false,
    occurrences INTEGER NOT NULL DEFAULT 1,
    best_approach VARCHAR(255),
    typical_message TEXT,
    average_healing_time INTEGER DEFAULT 0,
    average_discovery_time INTEGER DEFAULT 3600000,
    best_prevention_strategy TEXT,
    code_context TEXT,
    environment VARCHAR(100) DEFAULT 'production',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}'
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_healing_learning_pattern_id ON public.healing_learning(pattern_id);
CREATE INDEX IF NOT EXISTS idx_healing_learning_error_type ON public.healing_learning(error_type);
CREATE INDEX IF NOT EXISTS idx_healing_learning_success_rate ON public.healing_learning(success_rate);
CREATE INDEX IF NOT EXISTS idx_healing_learning_created_at ON public.healing_learning(created_at);
CREATE INDEX IF NOT EXISTS idx_healing_learning_severity ON public.healing_learning(severity);

-- Create MLX healing training jobs table
CREATE TABLE IF NOT EXISTS public.mlx_healing_training_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(50) CHECK (status IN ('pending', 'preparing', 'training', 'evaluating', 'completed', 'failed')) DEFAULT 'pending',
    progress JSONB NOT NULL DEFAULT '{"stage": "initializing", "percentage": 0}',
    datasets JSONB NOT NULL DEFAULT '{"training": "", "validation": "", "test": ""}',
    results JSONB NOT NULL DEFAULT '{"finalLoss": 0, "finalAccuracy": 0}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'
);

-- Create indexes for training jobs
CREATE INDEX IF NOT EXISTS idx_mlx_training_jobs_status ON public.mlx_healing_training_jobs(status);
CREATE INDEX IF NOT EXISTS idx_mlx_training_jobs_created_at ON public.mlx_healing_training_jobs(created_at);

-- Create error predictions table
CREATE TABLE IF NOT EXISTS public.error_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code_context JSONB NOT NULL DEFAULT '{}',
    prediction JSONB NOT NULL DEFAULT '{}',
    prevention JSONB NOT NULL DEFAULT '{}',
    reasoning JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'
);

-- Create indexes for predictions
CREATE INDEX IF NOT EXISTS idx_error_predictions_status ON public.error_predictions(status);
CREATE INDEX IF NOT EXISTS idx_error_predictions_created_at ON public.error_predictions(created_at);

-- Update context_storage table to allow new categories
ALTER TABLE public.context_storage DROP CONSTRAINT IF EXISTS context_storage_category_check;
ALTER TABLE public.context_storage ADD CONSTRAINT context_storage_category_check 
    CHECK (category IN (
        'project_info', 
        'architecture_patterns', 
        'test_results', 
        'user_interactions', 
        'system_logs', 
        'performance_metrics',
        'test_predictions',
        'healing_patterns',
        'mlx_training_data',
        'error_predictions'
    ));

-- Insert sample healing learning data
INSERT INTO public.healing_learning (
    pattern_id, 
    error_type, 
    error_message, 
    error_context,
    severity,
    healing_approach,
    healing_module,
    healing_parameters,
    healing_duration,
    success_rate,
    confidence,
    validation_passed,
    occurrences,
    best_approach,
    typical_message,
    average_healing_time,
    best_prevention_strategy,
    code_context
) VALUES 
(
    'typescript-property-error-001',
    'TypeError',
    'Property does not exist on type',
    '{"language": "typescript", "complexity": "medium"}',
    'high',
    'enhanced-typescript-healer',
    'typescript-healer',
    '{"addTypeAnnotations": true, "strictMode": true}',
    1500,
    0.96,
    0.94,
    true,
    25,
    'enhanced-typescript-healer',
    'Property ''x'' does not exist on type ''User''',
    1400,
    'Add proper interface definitions and type guards',
    'interface User { name: string; age: number; }'
),
(
    'syntax-error-unexpected-token-001',
    'SyntaxError',
    'Unexpected token',
    '{"language": "javascript", "context": "parsing"}',
    'critical',
    'syntax-guardian',
    'syntax-validator',
    '{"validateSyntax": true, "autoFix": true}',
    800,
    0.98,
    0.97,
    true,
    18,
    'syntax-guardian',
    'Unexpected token ''}'' in JSON at position 45',
    750,
    'Validate JSON structure before parsing',
    'const data = JSON.parse(invalidJson);'
),
(
    'reference-error-undefined-001',
    'ReferenceError',
    'Variable is not defined',
    '{"language": "javascript", "scope": "global"}',
    'high',
    'advanced-healing-system',
    'reference-resolver',
    '{"checkScope": true, "initializeVariables": true}',
    1200,
    0.94,
    0.92,
    true,
    12,
    'advanced-healing-system',
    'myVariable is not defined',
    1100,
    'Initialize variables before use and check scope',
    'console.log(myVariable); // myVariable not defined'
),
(
    'network-error-fetch-failed-001',
    'NetworkError',
    'Failed to fetch resource',
    '{"protocol": "https", "timeout": true}',
    'medium',
    'network-healing-service',
    'network-resolver',
    '{"retryCount": 3, "timeout": 5000}',
    2000,
    0.92,
    0.89,
    true,
    8,
    'network-healing-service',
    'Failed to fetch https://api.example.com/data',
    1800,
    'Implement retry logic and proper error handling',
    'fetch(url).then(response => response.json())'
),
(
    'import-error-module-not-found-001',
    'ImportError',
    'Cannot resolve module',
    '{"language": "typescript", "moduleSystem": "es6"}',
    'high',
    'predictive-healing-agent',
    'import-resolver',
    '{"checkPaths": true, "installMissing": true}',
    900,
    0.97,
    0.95,
    true,
    15,
    'predictive-healing-agent',
    'Cannot resolve module ''@/utils/helper''',
    850,
    'Verify import paths and install missing dependencies',
    'import { helper } from "@/utils/helper";'
)
ON CONFLICT (pattern_id) DO NOTHING;

-- Create function to update healing patterns
CREATE OR REPLACE FUNCTION update_healing_pattern_stats(
    p_pattern_id VARCHAR(255),
    p_success BOOLEAN,
    p_healing_time INTEGER,
    p_confidence FLOAT
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.healing_learning 
    SET 
        occurrences = occurrences + 1,
        success_rate = (success_rate * (occurrences - 1) + CASE WHEN p_success THEN 1.0 ELSE 0.0 END) / occurrences,
        average_healing_time = (average_healing_time * (occurrences - 1) + p_healing_time) / occurrences,
        confidence = (confidence + p_confidence) / 2,
        updated_at = NOW()
    WHERE pattern_id = p_pattern_id;
    
    -- If pattern doesn't exist, this function should be called after inserting the base pattern
END;
$$ LANGUAGE plpgsql;

-- Create function to get successful patterns
CREATE OR REPLACE FUNCTION get_successful_patterns(
    p_min_success_rate FLOAT DEFAULT 0.8,
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE(
    pattern_id VARCHAR(255),
    error_type VARCHAR(100),
    healing_approach VARCHAR(255),
    success_rate FLOAT,
    confidence FLOAT,
    average_healing_time INTEGER,
    occurrences INTEGER,
    typical_message TEXT,
    best_prevention_strategy TEXT,
    code_context TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        hl.pattern_id,
        hl.error_type,
        hl.healing_approach,
        hl.success_rate,
        hl.confidence,
        hl.average_healing_time,
        hl.occurrences,
        hl.typical_message,
        hl.best_prevention_strategy,
        hl.code_context
    FROM public.healing_learning hl
    WHERE hl.success_rate >= p_min_success_rate
    ORDER BY hl.success_rate DESC, hl.confidence DESC, hl.occurrences DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Create function to query patterns by criteria
CREATE OR REPLACE FUNCTION query_healing_patterns(
    p_min_success_rate FLOAT DEFAULT 0.0,
    p_min_confidence FLOAT DEFAULT 0.0,
    p_error_types TEXT[] DEFAULT NULL,
    p_time_range_hours INTEGER DEFAULT 168,
    p_limit INTEGER DEFAULT 1000
)
RETURNS TABLE(
    id UUID,
    pattern_id VARCHAR(255),
    error_type VARCHAR(100),
    error_message TEXT,
    error_context JSONB,
    severity VARCHAR(20),
    healing_approach VARCHAR(255),
    healing_module VARCHAR(255),
    healing_parameters JSONB,
    healing_duration INTEGER,
    success_rate FLOAT,
    confidence FLOAT,
    validation_passed BOOLEAN,
    occurrences INTEGER,
    created_at TIMESTAMPTZ,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        hl.id,
        hl.pattern_id,
        hl.error_type,
        hl.error_message,
        hl.error_context,
        hl.severity,
        hl.healing_approach,
        hl.healing_module,
        hl.healing_parameters,
        hl.healing_duration,
        hl.success_rate,
        hl.confidence,
        hl.validation_passed,
        hl.occurrences,
        hl.created_at,
        hl.metadata
    FROM public.healing_learning hl
    WHERE 
        hl.success_rate >= p_min_success_rate
        AND hl.confidence >= p_min_confidence
        AND (p_error_types IS NULL OR hl.error_type = ANY(p_error_types))
        AND hl.created_at >= NOW() - (p_time_range_hours || ' hours')::INTERVAL
    ORDER BY hl.success_rate DESC, hl.confidence DESC, hl.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL ON public.healing_learning TO service_role;
GRANT ALL ON public.mlx_healing_training_jobs TO service_role;
GRANT ALL ON public.error_predictions TO service_role;

-- Add RLS policies if needed
ALTER TABLE public.healing_learning ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mlx_healing_training_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_predictions ENABLE ROW LEVEL SECURITY;

-- Allow service_role to access all data
CREATE POLICY "Allow service_role full access to healing_learning" ON public.healing_learning
    FOR ALL TO service_role USING (true);

CREATE POLICY "Allow service_role full access to mlx_healing_training_jobs" ON public.mlx_healing_training_jobs
    FOR ALL TO service_role USING (true);

CREATE POLICY "Allow service_role full access to error_predictions" ON public.error_predictions
    FOR ALL TO service_role USING (true);