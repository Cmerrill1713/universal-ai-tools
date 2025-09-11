-- Create reranking metrics table for performance tracking
CREATE TABLE IF NOT EXISTS reranking_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  query TEXT NOT NULL,
  model_name TEXT NOT NULL,
  input_count INTEGER NOT NULL,
  output_count INTEGER NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_reranking_metrics_timestamp ON reranking_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_reranking_metrics_model ON reranking_metrics(model_name);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_reranking_metrics_updated_at 
  BEFORE UPDATE ON reranking_metrics 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
ALTER TABLE reranking_metrics ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role has full access to reranking_metrics" ON reranking_metrics
  USING (auth.role() = 'service_role');

-- Authenticated users can read
CREATE POLICY "Authenticated users can read reranking_metrics" ON reranking_metrics
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Grant permissions
GRANT SELECT ON reranking_metrics TO anon;
GRANT ALL ON reranking_metrics TO authenticated;
GRANT ALL ON reranking_metrics TO service_role;