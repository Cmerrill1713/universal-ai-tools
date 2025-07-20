-- Fix vector search functions - correct column ambiguity and return types

-- Drop and recreate the search_similar_memories function with proper column qualification
DROP FUNCTION IF EXISTS search_similar_memories(vector, float, integer, text, text);

CREATE OR REPLACE FUNCTION search_similar_memories(
  query_embedding vector(1536),
  similarity_threshold FLOAT DEFAULT 0.7,
  max_results INTEGER DEFAULT 20,
  category_filter TEXT DEFAULT NULL,
  agent_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  memory_id UUID,
  service_id TEXT,
  memory_type TEXT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT,
  importance_score FLOAT,
  adjusted_score FLOAT,
  keywords TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id AS memory_id,
    m.service_id,
    m.memory_type,
    m.content,
    m.metadata,
    (1 - (m.embedding <=> query_embedding)) AS similarity,
    m.importance_score,
    (1 - (m.embedding <=> query_embedding)) * calculate_importance_decay(
      m.importance_score, 
      m.last_accessed, 
      m.access_count
    ) AS adjusted_score,
    m.keywords
  FROM ai_memories m
  WHERE 
    m.embedding IS NOT NULL
    AND (1 - (m.embedding <=> query_embedding)) > similarity_threshold
    AND (category_filter IS NULL OR m.memory_category = category_filter)
    AND (agent_filter IS NULL OR m.service_id = agent_filter)
  ORDER BY (1 - (m.embedding <=> query_embedding)) * calculate_importance_decay(
      m.importance_score, 
      m.last_accessed, 
      m.access_count
    ) DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate cross_agent_memory_search with proper return type
DROP FUNCTION IF EXISTS cross_agent_memory_search(vector, text[], float, integer);

CREATE OR REPLACE FUNCTION cross_agent_memory_search(
  query_embedding vector(1536),
  agent_list TEXT[],
  similarity_threshold FLOAT DEFAULT 0.6,
  max_per_agent INTEGER DEFAULT 5
)
RETURNS TABLE (
  memory_id UUID,
  service_id TEXT,
  content TEXT,
  similarity FLOAT,
  agent_rank INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH ranked_memories AS (
    SELECT 
      m.id AS mid,
      m.service_id AS sid,
      m.content AS mcontent,
      (1 - (m.embedding <=> query_embedding)) AS sim,
      ROW_NUMBER() OVER (PARTITION BY m.service_id ORDER BY m.embedding <=> query_embedding) AS rn
    FROM ai_memories m
    WHERE 
      m.embedding IS NOT NULL
      AND m.service_id = ANY(agent_list)
      AND (1 - (m.embedding <=> query_embedding)) > similarity_threshold
  )
  SELECT 
    rm.mid,
    rm.sid,
    rm.mcontent,
    rm.sim,
    rm.rn::INTEGER
  FROM ranked_memories rm
  WHERE rm.rn <= max_per_agent
  ORDER BY rm.sim DESC;
END;
$$ LANGUAGE plpgsql;

-- Test both functions to ensure they work
DO $$
DECLARE
  test_embedding vector(1536);
  test_result RECORD;
BEGIN
  -- Create a test embedding
  test_embedding := (SELECT ARRAY(SELECT random() FROM generate_series(1, 1536)))::vector(1536);
  
  -- Test search_similar_memories
  SELECT COUNT(*) INTO test_result FROM search_similar_memories(test_embedding, 0.1, 10);
  RAISE NOTICE 'search_similar_memories function working: found % potential matches', test_result;
  
  -- Test cross_agent_memory_search
  SELECT COUNT(*) INTO test_result FROM cross_agent_memory_search(test_embedding, ARRAY['test_agent'], 0.1, 5);
  RAISE NOTICE 'cross_agent_memory_search function working: found % potential matches', test_result;
  
EXCEPTION 
  WHEN OTHERS THEN
    RAISE NOTICE 'Function test failed: %', SQLERRM;
END;
$$;