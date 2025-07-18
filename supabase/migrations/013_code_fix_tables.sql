-- Tables for intelligent code fixing system

-- Store code fix attempts and their results
CREATE TABLE IF NOT EXISTS code_fix_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  error_code TEXT NOT NULL,
  error_message TEXT NOT NULL,
  file_path TEXT NOT NULL,
  line_number INTEGER NOT NULL,
  column_number INTEGER,
  original_code TEXT,
  fixed_code TEXT,
  explanation TEXT,
  confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),
  additional_imports TEXT[],
  status TEXT DEFAULT 'proposed' CHECK (status IN ('proposed', 'applied', 'successful', 'failed', 'reverted')),
  applied_at TIMESTAMPTZ,
  reverted_at TIMESTAMPTZ,
  test_results JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Store successful fix patterns for learning
CREATE TABLE IF NOT EXISTS code_fix_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  error_pattern TEXT NOT NULL,
  fix_pattern TEXT NOT NULL,
  error_code TEXT,
  explanation TEXT,
  code_before TEXT,
  code_after TEXT,
  embedding vector(1536), -- For semantic search
  context_embedding vector(1536),
  success_rate FLOAT DEFAULT 0.0,
  usage_count INTEGER DEFAULT 0,
  last_used TIMESTAMPTZ,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track fix success metrics
CREATE TABLE IF NOT EXISTS fix_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fix_attempt_id UUID REFERENCES code_fix_attempts(id),
  build_success BOOLEAN,
  tests_passed BOOLEAN,
  type_check_passed BOOLEAN,
  lint_passed BOOLEAN,
  performance_impact FLOAT,
  user_satisfaction INTEGER CHECK (user_satisfaction >= 1 AND user_satisfaction <= 5),
  notes TEXT,
  measured_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_code_fix_attempts_error_code ON code_fix_attempts(error_code);
CREATE INDEX idx_code_fix_attempts_file_path ON code_fix_attempts(file_path);
CREATE INDEX idx_code_fix_attempts_status ON code_fix_attempts(status);
CREATE INDEX idx_code_fix_patterns_error_code ON code_fix_patterns(error_code);
CREATE INDEX idx_code_fix_patterns_tags ON code_fix_patterns USING gin(tags);

-- Vector similarity index for semantic search
CREATE INDEX idx_code_fix_patterns_embedding ON code_fix_patterns 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Function to find similar code fixes
CREATE OR REPLACE FUNCTION find_similar_code_fixes(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  error_pattern TEXT,
  fix_pattern TEXT,
  code_after TEXT,
  explanation TEXT,
  success_rate FLOAT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cf.id,
    cf.error_pattern,
    cf.fix_pattern,
    cf.code_after,
    cf.explanation,
    cf.success_rate,
    1 - (cf.embedding <=> query_embedding) AS similarity
  FROM code_fix_patterns cf
  WHERE 1 - (cf.embedding <=> query_embedding) > match_threshold
  ORDER BY cf.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to update fix pattern success rate
CREATE OR REPLACE FUNCTION update_fix_success_rate(
  pattern_id UUID,
  was_successful BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  current_rate FLOAT;
  current_count INTEGER;
  new_rate FLOAT;
BEGIN
  SELECT success_rate, usage_count 
  INTO current_rate, current_count
  FROM code_fix_patterns
  WHERE id = pattern_id;

  -- Calculate new success rate using moving average
  new_rate := ((current_rate * current_count) + (CASE WHEN was_successful THEN 1.0 ELSE 0.0 END)) / (current_count + 1);

  UPDATE code_fix_patterns
  SET 
    success_rate = new_rate,
    usage_count = usage_count + 1,
    last_used = NOW()
  WHERE id = pattern_id;
END;
$$;

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_code_fix_attempts_updated_at BEFORE UPDATE ON code_fix_attempts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_code_fix_patterns_updated_at BEFORE UPDATE ON code_fix_patterns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS policies (if using Row Level Security)
ALTER TABLE code_fix_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_fix_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE fix_metrics ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to read all fixes
CREATE POLICY "Authenticated users can read fixes" ON code_fix_attempts
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read patterns" ON code_fix_patterns
  FOR SELECT USING (auth.role() = 'authenticated');

-- Policy for service role to manage fixes
CREATE POLICY "Service role can manage fixes" ON code_fix_attempts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage patterns" ON code_fix_patterns
  FOR ALL USING (auth.role() = 'service_role');