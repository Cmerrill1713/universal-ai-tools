-- Create agents table for the Agent Registry Service
-- Migration: 001_create_agents_table.sql

-- Create UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the agents table
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    agent_type JSONB NOT NULL,
    description TEXT NOT NULL,
    capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    version VARCHAR(100) NOT NULL,
    endpoint VARCHAR(500),
    status JSONB NOT NULL DEFAULT '"active"'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Performance metrics columns
    execution_count BIGINT NOT NULL DEFAULT 0,
    error_count BIGINT NOT NULL DEFAULT 0,
    avg_execution_time_ms DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    health_score DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    
    -- Constraints
    CONSTRAINT agents_name_not_empty CHECK (name != ''),
    CONSTRAINT agents_description_not_empty CHECK (description != ''),
    CONSTRAINT agents_version_not_empty CHECK (version != ''),
    CONSTRAINT agents_execution_count_non_negative CHECK (execution_count >= 0),
    CONSTRAINT agents_error_count_non_negative CHECK (error_count >= 0),
    CONSTRAINT agents_avg_execution_time_non_negative CHECK (avg_execution_time_ms >= 0.0),
    CONSTRAINT agents_health_score_range CHECK (health_score >= 0.0 AND health_score <= 1.0)
);

-- Create indexes for efficient queries
CREATE INDEX idx_agents_name ON agents(name);
CREATE INDEX idx_agents_agent_type ON agents USING GIN(agent_type);
CREATE INDEX idx_agents_status ON agents USING GIN(status);
CREATE INDEX idx_agents_capabilities ON agents USING GIN(capabilities);
CREATE INDEX idx_agents_created_at ON agents(created_at DESC);
CREATE INDEX idx_agents_updated_at ON agents(updated_at DESC);
CREATE INDEX idx_agents_last_seen ON agents(last_seen DESC) WHERE last_seen IS NOT NULL;
CREATE INDEX idx_agents_health_score ON agents(health_score DESC);
CREATE INDEX idx_agents_execution_count ON agents(execution_count DESC);

-- Create partial indexes for specific statuses
CREATE INDEX idx_agents_active ON agents(id) WHERE status = '"active"'::jsonb;
CREATE INDEX idx_agents_inactive ON agents(id) WHERE status = '"inactive"'::jsonb;
CREATE INDEX idx_agents_busy ON agents(id) WHERE status = '"busy"'::jsonb;
CREATE INDEX idx_agents_error ON agents(id) WHERE status = '"error"'::jsonb;

-- Create composite indexes for common queries
CREATE INDEX idx_agents_type_status ON agents USING GIN(agent_type, status);
CREATE INDEX idx_agents_capabilities_status ON agents USING GIN(capabilities, status);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_agents_updated_at 
    BEFORE UPDATE ON agents 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to validate agent configuration
CREATE OR REPLACE FUNCTION validate_agent_config()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate that config contains required fields
    IF NOT (NEW.config ? 'max_concurrent_executions') THEN
        RAISE EXCEPTION 'Agent config must contain max_concurrent_executions field';
    END IF;
    
    IF NOT (NEW.config ? 'default_timeout_seconds') THEN
        RAISE EXCEPTION 'Agent config must contain default_timeout_seconds field';
    END IF;
    
    -- Validate max_concurrent_executions is positive
    IF (NEW.config->>'max_concurrent_executions')::integer <= 0 THEN
        RAISE EXCEPTION 'max_concurrent_executions must be greater than 0';
    END IF;
    
    -- Validate default_timeout_seconds is positive
    IF (NEW.config->>'default_timeout_seconds')::integer <= 0 THEN
        RAISE EXCEPTION 'default_timeout_seconds must be greater than 0';
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to validate agent configuration
CREATE TRIGGER validate_agent_config_trigger
    BEFORE INSERT OR UPDATE ON agents
    FOR EACH ROW
    EXECUTE FUNCTION validate_agent_config();

-- Add comments for documentation
COMMENT ON TABLE agents IS 'Agent registry table storing all registered AI agents and their configurations';
COMMENT ON COLUMN agents.id IS 'Unique identifier for the agent';
COMMENT ON COLUMN agents.name IS 'Human-readable name for the agent';
COMMENT ON COLUMN agents.agent_type IS 'Type classification of the agent (JSON enum)';
COMMENT ON COLUMN agents.description IS 'Detailed description of the agent capabilities';
COMMENT ON COLUMN agents.capabilities IS 'List of agent capabilities (JSON array)';
COMMENT ON COLUMN agents.config IS 'Agent configuration parameters (JSON object)';
COMMENT ON COLUMN agents.version IS 'Agent version string';
COMMENT ON COLUMN agents.endpoint IS 'HTTP endpoint for remote agent communication';
COMMENT ON COLUMN agents.status IS 'Current agent status (JSON enum)';
COMMENT ON COLUMN agents.created_at IS 'Timestamp when the agent was registered';
COMMENT ON COLUMN agents.updated_at IS 'Timestamp when the agent was last updated';
COMMENT ON COLUMN agents.last_seen IS 'Timestamp when the agent was last seen/contacted';
COMMENT ON COLUMN agents.metadata IS 'Additional agent metadata (JSON object)';
COMMENT ON COLUMN agents.execution_count IS 'Total number of executions for this agent';
COMMENT ON COLUMN agents.error_count IS 'Total number of execution errors for this agent';
COMMENT ON COLUMN agents.avg_execution_time_ms IS 'Average execution time in milliseconds';
COMMENT ON COLUMN agents.health_score IS 'Agent health score between 0.0 and 1.0';