-- Vector Search Function for Memory Similarity Search
-- This migration adds the RPC function for efficient vector similarity search

-- Create the search function for memories
CREATE OR REPLACE FUNCTION search_memories_by_embedding(
  query_embedding vector(384),  -- Adjust dimension based on your embedding model
  similarity_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
) 
RETURNS TABLE (
  id uuid,
  content text,
  embedding vector(384),
  metadata jsonb,
  agent_id text,
  user_id text,
  created_at timestamptz,
  updated_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.content,
    m.embedding,
    m.metadata,
    m.agent_id,
    m.user_id,
    m.created_at,
    m.updated_at,
    1 - (m.embedding <=> query_embedding) as similarity
  FROM memories m
  WHERE m.embedding IS NOT NULL
    AND 1 - (m.embedding <=> query_embedding) > similarity_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Alternative function that works with different embedding dimensions
CREATE OR REPLACE FUNCTION search_memories_by_embedding_flexible(
  query_embedding vector,
  similarity_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
) 
RETURNS TABLE (
  id uuid,
  content text,
  embedding vector,
  metadata jsonb,
  agent_id text,
  user_id text,
  created_at timestamptz,
  updated_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.content,
    m.embedding,
    m.metadata,
    m.agent_id,
    m.user_id,
    m.created_at,
    m.updated_at,
    1 - (m.embedding <=> query_embedding) as similarity
  FROM memories m
  WHERE m.embedding IS NOT NULL
    AND 1 - (m.embedding <=> query_embedding) > similarity_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Create function for knowledge similarity search
CREATE OR REPLACE FUNCTION search_knowledge_by_embedding(
  query_embedding vector,
  similarity_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
) 
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  embedding vector,
  metadata jsonb,
  tags text[],
  user_id text,
  created_at timestamptz,
  updated_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    k.id,
    k.title,
    k.content,
    k.embedding,
    k.metadata,
    k.tags,
    k.user_id,
    k.created_at,
    k.updated_at,
    1 - (k.embedding <=> query_embedding) as similarity
  FROM knowledge k
  WHERE k.embedding IS NOT NULL
    AND 1 - (k.embedding <=> query_embedding) > similarity_threshold
  ORDER BY k.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Create hybrid search function (combines full-text and vector search)
CREATE OR REPLACE FUNCTION hybrid_search_memories(
  query_text text,
  query_embedding vector,
  similarity_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
) 
RETURNS TABLE (
  id uuid,
  content text,
  embedding vector,
  metadata jsonb,
  agent_id text,
  user_id text,
  created_at timestamptz,
  updated_at timestamptz,
  similarity float,
  text_rank float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH vector_search AS (
    SELECT 
      m.id,
      m.content,
      m.embedding,
      m.metadata,
      m.agent_id,
      m.user_id,
      m.created_at,
      m.updated_at,
      1 - (m.embedding <=> query_embedding) as similarity,
      0.0 as text_rank
    FROM memories m
    WHERE m.embedding IS NOT NULL
      AND 1 - (m.embedding <=> query_embedding) > similarity_threshold
  ),
  text_search AS (
    SELECT 
      m.id,
      m.content,
      m.embedding,
      m.metadata,
      m.agent_id,
      m.user_id,
      m.created_at,
      m.updated_at,
      0.0 as similarity,
      ts_rank(to_tsvector('english', m.content), plainto_tsquery('english', query_text)) as text_rank
    FROM memories m
    WHERE to_tsvector('english', m.content) @@ plainto_tsquery('english', query_text)
  ),
  combined AS (
    SELECT * FROM vector_search
    UNION
    SELECT * FROM text_search
  )
  SELECT 
    c.id,
    c.content,
    c.embedding,
    c.metadata,
    c.agent_id,
    c.user_id,
    c.created_at,
    c.updated_at,
    MAX(c.similarity) as similarity,
    MAX(c.text_rank) as text_rank
  FROM combined c
  GROUP BY c.id, c.content, c.embedding, c.metadata, c.agent_id, c.user_id, c.created_at, c.updated_at
  ORDER BY (MAX(c.similarity) * 0.7 + MAX(c.text_rank) * 0.3) DESC
  LIMIT match_count;
END;
$$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_memories_embedding_cosine 
  ON memories USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_knowledge_embedding_cosine 
  ON knowledge USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100);

-- Add full-text search indexes
CREATE INDEX IF NOT EXISTS idx_memories_content_gin 
  ON memories USING gin(to_tsvector('english', content));

CREATE INDEX IF NOT EXISTS idx_knowledge_content_gin 
  ON knowledge USING gin(to_tsvector('english', content));

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION search_memories_by_embedding TO authenticated;
GRANT EXECUTE ON FUNCTION search_memories_by_embedding_flexible TO authenticated;
GRANT EXECUTE ON FUNCTION search_knowledge_by_embedding TO authenticated;
GRANT EXECUTE ON FUNCTION hybrid_search_memories TO authenticated;