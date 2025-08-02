-- Create tables for storing debugging context and preventing repeated bugs

-- Debugging sessions table to track all debugging activities
CREATE TABLE IF NOT EXISTS debugging_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_pattern TEXT NOT NULL,
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  solution TEXT NOT NULL,
  files_affected TEXT[] NOT NULL,
  prevention_strategy TEXT,
  root_cause TEXT,
  time_to_fix_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id TEXT,
  severity VARCHAR(20) CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  category VARCHAR(50) CHECK (category IN ('syntax', 'runtime', 'logic', 'performance', 'security', 'other')),
  tags TEXT[],
  related_sessions UUID[],
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Code quality patterns to prevent bugs
CREATE TABLE IF NOT EXISTS code_quality_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  pattern_type VARCHAR(50) CHECK (pattern_type IN ('preventive', 'detective', 'corrective')),
  examples JSONB NOT NULL DEFAULT '[]'::jsonb,
  prevents_errors TEXT[] NOT NULL,
  implementation_guide TEXT,
  typescript_config JSONB,
  eslint_rules JSONB,
  effectiveness_score DECIMAL(3,2) CHECK (effectiveness_score >= 0 AND effectiveness_score <= 1),
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Error patterns recognition table
CREATE TABLE IF NOT EXISTS error_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_signature TEXT NOT NULL UNIQUE,
  error_type VARCHAR(100) NOT NULL,
  common_causes TEXT[],
  quick_fixes TEXT[],
  long_term_solutions TEXT[],
  occurrence_count INTEGER DEFAULT 1,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  auto_fixable BOOLEAN DEFAULT FALSE,
  fix_script TEXT,
  related_patterns UUID[],
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Development context storage
CREATE TABLE IF NOT EXISTS development_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context_type VARCHAR(50) NOT NULL CHECK (context_type IN ('bug_fix', 'feature', 'refactor', 'optimization', 'research')),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  context_data JSONB NOT NULL,
  files_modified TEXT[],
  commands_run TEXT[],
  decisions_made JSONB DEFAULT '[]'::jsonb,
  lessons_learned TEXT[],
  duration_minutes INTEGER,
  success BOOLEAN DEFAULT TRUE,
  session_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fix history for tracking what actually worked
CREATE TABLE IF NOT EXISTS fix_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_pattern_id UUID REFERENCES error_patterns(id),
  debugging_session_id UUID REFERENCES debugging_sessions(id),
  fix_applied TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  time_to_implement_minutes INTEGER,
  files_changed TEXT[],
  lines_added INTEGER,
  lines_removed INTEGER,
  performance_impact VARCHAR(20) CHECK (performance_impact IN ('improved', 'neutral', 'degraded')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX idx_debugging_sessions_error_pattern ON debugging_sessions USING gin(to_tsvector('english', error_pattern));
CREATE INDEX idx_debugging_sessions_solution ON debugging_sessions USING gin(to_tsvector('english', solution));
CREATE INDEX idx_debugging_sessions_category ON debugging_sessions(category);
CREATE INDEX idx_debugging_sessions_severity ON debugging_sessions(severity);
CREATE INDEX idx_debugging_sessions_created_at ON debugging_sessions(created_at DESC);

CREATE INDEX idx_error_patterns_signature ON error_patterns(pattern_signature);
CREATE INDEX idx_error_patterns_type ON error_patterns(error_type);
CREATE INDEX idx_error_patterns_occurrence ON error_patterns(occurrence_count DESC);

CREATE INDEX idx_development_context_type ON development_context(context_type);
CREATE INDEX idx_development_context_created_at ON development_context(created_at DESC);

-- Enable Row Level Security
ALTER TABLE debugging_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_quality_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE development_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE fix_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (adjust based on your auth strategy)
CREATE POLICY "Public read for debugging context" ON debugging_sessions FOR SELECT USING (true);
CREATE POLICY "Public read for quality patterns" ON code_quality_patterns FOR SELECT USING (true);
CREATE POLICY "Public read for error patterns" ON error_patterns FOR SELECT USING (true);
CREATE POLICY "Public read for development context" ON development_context FOR SELECT USING (true);
CREATE POLICY "Public read for fix history" ON fix_history FOR SELECT USING (true);

-- Insert for authenticated users
CREATE POLICY "Authenticated insert debugging sessions" ON debugging_sessions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert development context" ON development_context FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Create functions for intelligent error matching
CREATE OR REPLACE FUNCTION find_similar_errors(error_text TEXT, threshold DECIMAL DEFAULT 0.7)
RETURNS TABLE (
  session_id UUID,
  similarity_score DECIMAL,
  solution TEXT,
  prevention_strategy TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ds.id,
    similarity(ds.error_pattern, error_text) as similarity_score,
    ds.solution,
    ds.prevention_strategy
  FROM debugging_sessions ds
  WHERE similarity(ds.error_pattern, error_text) > threshold
  ORDER BY similarity_score DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-increment pattern occurrence
CREATE OR REPLACE FUNCTION increment_error_pattern()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE error_patterns 
  SET occurrence_count = occurrence_count + 1,
      last_seen = NOW()
  WHERE pattern_signature = NEW.error_pattern;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_error_pattern_count
AFTER INSERT ON debugging_sessions
FOR EACH ROW
EXECUTE FUNCTION increment_error_pattern();

-- Insert initial code quality patterns
INSERT INTO code_quality_patterns (pattern_name, description, pattern_type, examples, prevents_errors, implementation_guide, effectiveness_score) VALUES
('Strict TypeScript Configuration', 'Use strict TypeScript flags to catch errors at compile time', 'preventive', 
 '{"flags": ["noImplicitAny", "strictNullChecks", "noImplicitReturns", "noUncheckedSideEffectImports"]}'::jsonb,
 ARRAY['undefined errors', 'null reference errors', 'missing return statements', 'import errors'],
 'Enable all strict flags in tsconfig.json and fix resulting errors incrementally',
 0.85),
 
('Zod API Validation', 'Validate all API inputs and outputs with Zod schemas', 'preventive',
 '{"example": "const userSchema = z.object({ name: z.string(), age: z.number().positive() })"}'::jsonb,
 ARRAY['runtime type errors', 'data corruption', 'security vulnerabilities'],
 'Create Zod schemas for all API endpoints and use them in middleware',
 0.90),

('Discriminated Unions', 'Use discriminated unions for type-safe state management', 'preventive',
 '{"example": "type Result<T> = { type: \"success\", data: T } | { type: \"error\", error: Error }"}'::jsonb,
 ARRAY['invalid state errors', 'switch statement bugs', 'undefined access'],
 'Replace complex conditionals with discriminated union types',
 0.80),

('Error Boundaries', 'Implement error boundaries to contain failures', 'detective',
 '{"patterns": ["try-catch blocks", "error middleware", "circuit breakers"]}'::jsonb,
 ARRAY['cascade failures', 'unhandled exceptions', 'service crashes'],
 'Wrap all async operations in try-catch and implement global error handlers',
 0.75);

-- Create views for common queries
CREATE VIEW recent_debugging_sessions AS
SELECT 
  ds.*,
  array_agg(DISTINCT fh.fix_applied) as fixes_tried,
  COUNT(fh.id) as fix_attempts,
  bool_or(fh.success) as has_successful_fix
FROM debugging_sessions ds
LEFT JOIN fix_history fh ON ds.id = fh.debugging_session_id
WHERE ds.created_at > NOW() - INTERVAL '7 days'
GROUP BY ds.id
ORDER BY ds.created_at DESC;

CREATE VIEW error_pattern_analytics AS
SELECT 
  ep.*,
  COUNT(DISTINCT ds.id) as total_occurrences,
  AVG(ds.time_to_fix_minutes) as avg_fix_time,
  array_agg(DISTINCT ds.solution ORDER BY ds.created_at DESC) as solutions_applied
FROM error_patterns ep
LEFT JOIN debugging_sessions ds ON ds.error_pattern = ep.pattern_signature
GROUP BY ep.id
ORDER BY ep.occurrence_count DESC;

-- Add helpful comments
COMMENT ON TABLE debugging_sessions IS 'Stores all debugging sessions to prevent repeated debugging of the same issues';
COMMENT ON TABLE code_quality_patterns IS 'Best practices and patterns that prevent common bugs';
COMMENT ON TABLE error_patterns IS 'Recognized error patterns with their solutions and fixes';
COMMENT ON TABLE development_context IS 'Stores development context to maintain knowledge across sessions';
COMMENT ON FUNCTION find_similar_errors IS 'Finds similar errors based on pattern matching to suggest solutions';