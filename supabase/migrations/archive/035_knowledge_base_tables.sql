-- Create knowledge base tables for storing scraped data
-- This enhances agent capabilities with external knowledge

-- Enable vector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create knowledge_base table
CREATE TABLE IF NOT EXISTS knowledge_base (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding vector(1536),
  timestamp TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Add unique constraint to prevent duplicates
  UNIQUE(source, title)
);

-- Create indexes for performance
CREATE INDEX idx_knowledge_base_source ON knowledge_base(source);
CREATE INDEX idx_knowledge_base_category ON knowledge_base(category);
CREATE INDEX idx_knowledge_base_timestamp ON knowledge_base(timestamp);
CREATE INDEX idx_knowledge_base_embedding ON knowledge_base USING ivfflat (embedding vector_cosine_ops);

-- Create function for semantic search
CREATE OR REPLACE FUNCTION search_knowledge(
  query_embedding vector(1536),
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  source TEXT,
  category TEXT,
  title TEXT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.id,
    kb.source,
    kb.category,
    kb.title,
    kb.content,
    kb.metadata,
    1 - (kb.embedding <=> query_embedding) AS similarity
  FROM knowledge_base kb
  WHERE kb.embedding IS NOT NULL
  ORDER BY kb.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Create knowledge sources configuration table
CREATE TABLE IF NOT EXISTS knowledge_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('api', 'web', 'dump', 'feed')),
  url TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  rate_limit INTEGER DEFAULT 60, -- requests per minute
  last_scraped TIMESTAMPTZ,
  next_scrape TIMESTAMPTZ,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default knowledge sources
INSERT INTO knowledge_sources (name, type, url, rate_limit, config) VALUES
  ('MDN Web Docs', 'web', 'https://developer.mozilla.org/en-US/docs/Web', 30, '{"categories": ["javascript", "css", "html", "web-api"]}'),
  ('Stack Overflow', 'api', 'https://api.stackexchange.com/2.3/questions', 300, '{"site": "stackoverflow", "filter": "withbody"}'),
  ('Papers with Code', 'api', 'https://paperswithcode.com/api/v1/papers', 60, '{"categories": ["nlp", "computer-vision", "reinforcement-learning"]}'),
  ('Hugging Face', 'api', 'https://huggingface.co/api/models', 100, '{"tasks": ["text-generation", "text-classification", "question-answering"]}'),
  ('DevDocs', 'api', 'https://devdocs.io/docs.json', 60, '{"languages": ["javascript", "python", "typescript", "rust"]}'),
  ('arXiv', 'api', 'http://export.arxiv.org/api/query', 180, '{"categories": ["cs.AI", "cs.LG", "cs.CL"]}'),
  ('GitHub Trending', 'api', 'https://api.github.com/search/repositories', 60, '{"languages": ["typescript", "python", "javascript"]}'),
  ('npm Registry', 'api', 'https://registry.npmjs.org/-/v1/search', 250, '{"keywords": ["ai", "ml", "llm", "agent"]}')
ON CONFLICT (name) DO NOTHING;

-- Create knowledge scraping jobs table
CREATE TABLE IF NOT EXISTS knowledge_scraping_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID REFERENCES knowledge_sources(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  entries_scraped INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create knowledge categories table
CREATE TABLE IF NOT EXISTS knowledge_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  parent_id UUID REFERENCES knowledge_categories(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default categories
INSERT INTO knowledge_categories (name, description) VALUES
  ('web-development', 'Web development technologies and APIs'),
  ('ai-ml', 'Artificial Intelligence and Machine Learning'),
  ('programming-languages', 'Programming language references'),
  ('frameworks', 'Software frameworks and libraries'),
  ('databases', 'Database technologies and queries'),
  ('devops', 'DevOps tools and practices'),
  ('security', 'Security best practices and vulnerabilities'),
  ('algorithms', 'Algorithms and data structures'),
  ('system-design', 'System design and architecture'),
  ('api-reference', 'API documentation and references')
ON CONFLICT (name) DO NOTHING;

-- Create RLS policies
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_scraping_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_categories ENABLE ROW LEVEL SECURITY;

-- Public read access for knowledge base
CREATE POLICY "Public read access for knowledge_base" ON knowledge_base
  FOR SELECT USING (true);

-- Authenticated users can insert/update
CREATE POLICY "Authenticated users can manage knowledge_base" ON knowledge_base
  FOR ALL USING (auth.role() = 'authenticated');

-- Service role has full access
CREATE POLICY "Service role has full access to knowledge tables" ON knowledge_base
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to knowledge_sources" ON knowledge_sources
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to knowledge_scraping_jobs" ON knowledge_scraping_jobs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Public read access for knowledge_categories" ON knowledge_categories
  FOR SELECT USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_knowledge_base_updated_at BEFORE UPDATE ON knowledge_base
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_sources_updated_at BEFORE UPDATE ON knowledge_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create view for knowledge statistics
CREATE OR REPLACE VIEW knowledge_stats AS
SELECT
  source,
  category,
  COUNT(*) as entry_count,
  MAX(timestamp) as last_updated,
  AVG(LENGTH(content)) as avg_content_length
FROM knowledge_base
GROUP BY source, category;

-- Grant permissions
GRANT SELECT ON knowledge_stats TO anon, authenticated;
GRANT ALL ON knowledge_base TO service_role;
GRANT ALL ON knowledge_sources TO service_role;
GRANT ALL ON knowledge_scraping_jobs TO service_role;
GRANT SELECT ON knowledge_categories TO anon, authenticated;
GRANT ALL ON knowledge_categories TO service_role;