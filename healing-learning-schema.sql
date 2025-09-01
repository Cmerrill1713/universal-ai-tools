-- Healing Learning Database Schema
-- Table for storing AI healing attempt patterns and outcomes

CREATE TABLE IF NOT EXISTS healing_learning (
    id VARCHAR(255) PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    error_pattern TEXT NOT NULL,
    healing_attempt TEXT NOT NULL,
    outcome VARCHAR(50) NOT NULL,
    metadata JSONB DEFAULT '{}'
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_healing_learning_timestamp ON healing_learning(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_healing_learning_outcome ON healing_learning(outcome);
CREATE INDEX IF NOT EXISTS idx_healing_learning_error_pattern ON healing_learning USING gin(to_tsvector('english', error_pattern));

-- Row Level Security
ALTER TABLE healing_learning ENABLE ROW LEVEL SECURITY;

-- Allow all operations for service role
CREATE POLICY "Allow all for service role" ON healing_learning
    FOR ALL USING (auth.role() = 'service_role');

-- Grant permissions
GRANT ALL ON healing_learning TO authenticated;

-- Comment for documentation
COMMENT ON TABLE healing_learning IS 'Stores AI healing attempt patterns and outcomes for learning and improvement';