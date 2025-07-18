-- Create healing knowledge table for self-healing agent
CREATE TABLE IF NOT EXISTS healing_knowledge (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  error_pattern TEXT NOT NULL,
  context TEXT,
  technology TEXT,
  solution TEXT NOT NULL,
  sources JSONB DEFAULT '[]',
  confidence INTEGER DEFAULT 0,
  severity TEXT DEFAULT 'medium',
  success_rate INTEGER DEFAULT 0,
  attempt_count INTEGER DEFAULT 0,
  last_used TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_healing_knowledge_error_pattern ON healing_knowledge(error_pattern);
CREATE INDEX idx_healing_knowledge_technology ON healing_knowledge(technology);
CREATE INDEX idx_healing_knowledge_confidence ON healing_knowledge(confidence DESC);
CREATE INDEX idx_healing_knowledge_success_rate ON healing_knowledge(success_rate DESC);
CREATE INDEX idx_healing_knowledge_severity ON healing_knowledge(severity);

-- Create full-text search index
CREATE INDEX idx_healing_knowledge_search ON healing_knowledge USING gin(to_tsvector('english', error_pattern || ' ' || coalesce(solution, '')));

-- Create updated_at trigger
CREATE TRIGGER update_healing_knowledge_updated_at 
  BEFORE UPDATE ON healing_knowledge
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Insert some example healing knowledge
INSERT INTO healing_knowledge (error_pattern, context, technology, solution, sources, confidence, severity) VALUES
  ('net::ERR_CONNECTION_REFUSED', 'Browser cannot connect to localhost', 'vite', 'Start the development server with npm run dev. Check if the port is already in use with lsof -i :5173', '["https://stackoverflow.com/questions/connection-refused"]', 95, 'high'),
  ('EADDRINUSE', 'Port already in use error', 'node', 'Kill the process using the port with kill -9 $(lsof -t -i:PORT) or use a different port', '["https://stackoverflow.com/questions/eaddrinuse"]', 90, 'high'),
  ('Module not found', 'TypeScript/Node module resolution', 'typescript', 'Install the missing module with npm install or check the import path', '["https://nodejs.org/en/docs/"]', 85, 'medium'),
  ('fetch failed', 'Network request failed', 'javascript', 'Check if the target server is running and the URL is correct. Verify CORS settings if cross-origin', '["https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API"]', 80, 'medium')
ON CONFLICT DO NOTHING;