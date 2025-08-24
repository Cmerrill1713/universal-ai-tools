-- Multi-Domain Search Functions for Knowledge Base
-- Provides intent-based search and advanced semantic capabilities

-- Function for intent-based memory search
CREATE OR REPLACE FUNCTION search_memories_by_intent(
  query_text text,
  intent_type text DEFAULT 'general',
  agent_id text DEFAULT NULL,
  importance_threshold float DEFAULT 0.3,
  limit_count int DEFAULT 10,
  temporal_weight float DEFAULT 0.3
)
RETURNS TABLE (
  id uuid,
  content text,
  memory_type text,
  service_id text,
  importance_score float,
  similarity_score float,
  relevance_score float,
  metadata jsonb,
  keywords text[],
  created_at timestamptz,
  last_accessed timestamptz,
  access_count int
)
LANGUAGE plpgsql
AS $$
DECLARE
  query_embedding vector;
  intent_boost float := 1.0;
BEGIN
  -- Generate embedding for the query
  SELECT ai_generate_embedding(query_text) INTO query_embedding;
  
  -- Adjust importance threshold based on intent
  CASE intent_type
    WHEN 'implementation' THEN intent_boost := 1.2;
    WHEN 'troubleshooting' THEN intent_boost := 1.1;
    WHEN 'learning' THEN intent_boost := 0.9;
    ELSE intent_boost := 1.0;
  END CASE;

  RETURN QUERY
  WITH similarity_scores AS (
    SELECT 
      m.id,
      m.content,
      m.memory_type,
      m.service_id,
      m.importance_score,
      CASE 
        WHEN m.embedding IS NOT NULL AND query_embedding IS NOT NULL
          AND vector_dims(m.embedding) = vector_dims(query_embedding)
        THEN (1 - (query_embedding <=> m.embedding))::float
        ELSE 0.0
      END as similarity_score,
      m.metadata,
      COALESCE(m.keywords, ARRAY[]::text[]) as keywords,
      m.created_at,
      m.last_accessed,
      COALESCE(m.access_count, 0) as access_count,
      -- Temporal relevance factor
      CASE 
        WHEN m.last_accessed IS NOT NULL THEN
          EXP(-EXTRACT(EPOCH FROM NOW() - m.last_accessed) / (86400.0 * 30.0)) -- 30-day decay
        ELSE 0.5
      END as temporal_factor
    FROM ai_memories m
    WHERE 
      (agent_id IS NULL OR m.service_id = agent_id)
      AND m.importance_score >= importance_threshold
      AND (
        m.embedding IS NULL 
        OR query_embedding IS NULL 
        OR vector_dims(m.embedding) = vector_dims(query_embedding)
      )
  ),
  scored_results AS (
    SELECT 
      *,
      -- Combined relevance score
      (similarity_score * intent_boost * importance_score * 
       (1 + temporal_weight * temporal_factor)) as relevance_score
    FROM similarity_scores
    WHERE similarity_score >= 0.3
  )
  SELECT 
    sr.id,
    sr.content,
    sr.memory_type,
    sr.service_id,
    sr.importance_score,
    sr.similarity_score,
    sr.relevance_score,
    sr.metadata,
    sr.keywords,
    sr.created_at,
    sr.last_accessed,
    sr.access_count
  FROM scored_results sr
  ORDER BY 
    sr.relevance_score DESC,
    sr.similarity_score DESC,
    sr.importance_score DESC
  LIMIT limit_count;
END;
$$;

-- Function for cross-domain knowledge search
CREATE OR REPLACE FUNCTION search_memories_with_context(
  query_text text,
  agent_id text DEFAULT NULL,
  importance_threshold float DEFAULT 0.3,
  limit_count int DEFAULT 10,
  temporal_weight float DEFAULT 0.3,
  enable_reranking boolean DEFAULT false,
  rerank_method text DEFAULT 'hybrid'
)
RETURNS TABLE (
  id uuid,
  content text,
  memory_type text,
  service_id text,
  importance_score float,
  similarity_score float,
  context_score float,
  final_score float,
  metadata jsonb,
  related_memories uuid[],
  keywords text[]
)
LANGUAGE plpgsql
AS $$
DECLARE
  query_embedding vector;
  context_memories uuid[];
BEGIN
  -- Generate embedding for the query
  SELECT ai_generate_embedding(query_text) INTO query_embedding;
  
  -- Find contextually related memories first
  SELECT ARRAY_AGG(DISTINCT m.id) INTO context_memories
  FROM ai_memories m
  WHERE 
    m.keywords && string_to_array(lower(query_text), ' ')
    OR m.content ILIKE '%' || split_part(query_text, ' ', 1) || '%'
  LIMIT 20;

  RETURN QUERY
  WITH base_search AS (
    SELECT 
      m.id,
      m.content,
      m.memory_type,
      m.service_id,
      m.importance_score,
      CASE 
        WHEN m.embedding IS NOT NULL AND query_embedding IS NOT NULL
          AND vector_dims(m.embedding) = vector_dims(query_embedding)
        THEN (1 - (query_embedding <=> m.embedding))::float
        ELSE 0.0
      END as similarity_score,
      m.metadata,
      COALESCE(m.keywords, ARRAY[]::text[]) as keywords,
      -- Context relevance boost
      CASE 
        WHEN context_memories IS NOT NULL AND m.id = ANY(context_memories) THEN 0.2
        ELSE 0.0
      END as context_boost
    FROM ai_memories m
    WHERE 
      (agent_id IS NULL OR m.service_id = agent_id)
      AND m.importance_score >= importance_threshold
      AND (
        m.embedding IS NULL 
        OR query_embedding IS NULL 
        OR vector_dims(m.embedding) = vector_dims(query_embedding)
      )
  ),
  enhanced_results AS (
    SELECT 
      bs.*,
      bs.context_boost as context_score,
      -- Final scoring with context and temporal factors
      (bs.similarity_score * bs.importance_score * (1 + bs.context_boost)) as final_score,
      -- Find related memories through connections
      COALESCE(
        (SELECT ARRAY_AGG(DISTINCT mc.target_memory_id)
         FROM memory_connections mc 
         WHERE mc.source_memory_id = bs.id),
        ARRAY[]::uuid[]
      ) as related_memories
    FROM base_search bs
    WHERE bs.similarity_score >= 0.25
  )
  SELECT 
    er.id,
    er.content,
    er.memory_type,
    er.service_id,
    er.importance_score,
    er.similarity_score,
    er.context_score,
    er.final_score,
    er.metadata,
    er.related_memories,
    er.keywords
  FROM enhanced_results er
  ORDER BY 
    er.final_score DESC,
    er.similarity_score DESC
  LIMIT limit_count;
END;
$$;

-- Function to update search analytics
CREATE OR REPLACE FUNCTION log_search_analytics(
  query_text text,
  search_type text,
  results_count int,
  processing_time_ms int DEFAULT NULL,
  agent_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- In a production system, this would log to a search_analytics table
  -- For now, we'll just update memory access patterns
  
  -- Log search pattern for analytics
  INSERT INTO memory_access_patterns (
    memory_id, 
    agent_name, 
    access_type, 
    similarity_score, 
    access_context,
    accessed_at
  )
  SELECT 
    (SELECT id FROM ai_memories LIMIT 1), -- Placeholder
    COALESCE(agent_id, 'system'),
    'search_query',
    0.0,
    jsonb_build_object(
      'query', query_text,
      'search_type', search_type,
      'results_count', results_count,
      'processing_time_ms', processing_time_ms
    ),
    NOW()
  WHERE EXISTS (SELECT 1 FROM ai_memories LIMIT 1);
  
EXCEPTION
  WHEN OTHERS THEN
    -- Silently fail if tables don't exist yet
    NULL;
END;
$$;

-- Function for semantic clustering and knowledge organization
CREATE OR REPLACE FUNCTION organize_knowledge_by_domain()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  result jsonb;
  domain_stats jsonb;
BEGIN
  -- Analyze knowledge domains and their relationships
  WITH domain_analysis AS (
    SELECT 
      COALESCE(m.memory_type, 'uncategorized') as domain,
      COUNT(*) as memory_count,
      AVG(m.importance_score) as avg_importance,
      COUNT(DISTINCT m.service_id) as agent_coverage,
      ARRAY_AGG(DISTINCT unnest(COALESCE(m.keywords, ARRAY[]::text[]))) as all_keywords
    FROM ai_memories m
    GROUP BY m.memory_type
  ),
  connection_analysis AS (
    SELECT 
      m1.memory_type as source_domain,
      m2.memory_type as target_domain,
      COUNT(*) as connection_count
    FROM memory_connections mc
    JOIN ai_memories m1 ON mc.source_memory_id = m1.id
    JOIN ai_memories m2 ON mc.target_memory_id = m2.id
    GROUP BY m1.memory_type, m2.memory_type
  )
  SELECT jsonb_build_object(
    'domains', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'domain', domain,
          'memoryCount', memory_count,
          'avgImportance', ROUND(avg_importance::numeric, 3),
          'agentCoverage', agent_coverage,
          'topKeywords', (
            SELECT ARRAY_AGG(keyword ORDER BY frequency DESC)
            FROM (
              SELECT unnest(all_keywords) as keyword, COUNT(*) as frequency
              FROM (SELECT all_keywords) t
              GROUP BY unnest(all_keywords)
              LIMIT 10
            ) top_kw
          )
        )
      )
      FROM domain_analysis
    ),
    'connections', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'from', source_domain,
          'to', target_domain,
          'strength', connection_count
        )
      )
      FROM connection_analysis
      WHERE connection_count > 0
    ),
    'metrics', jsonb_build_object(
      'totalDomains', (SELECT COUNT(DISTINCT memory_type) FROM ai_memories),
      'totalConnections', (SELECT COUNT(*) FROM memory_connections),
      'orphanedMemories', (
        SELECT COUNT(*) FROM ai_memories m
        WHERE NOT EXISTS (
          SELECT 1 FROM memory_connections mc 
          WHERE mc.source_memory_id = m.id OR mc.target_memory_id = m.id
        )
      )
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION search_memories_by_intent TO authenticated, anon;
GRANT EXECUTE ON FUNCTION search_memories_with_context TO authenticated, anon;
GRANT EXECUTE ON FUNCTION log_search_analytics TO authenticated, anon;
GRANT EXECUTE ON FUNCTION organize_knowledge_by_domain TO authenticated, anon;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_memories_content_trgm 
ON ai_memories USING gin (content gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_ai_memories_keywords_trgm 
ON ai_memories USING gin (keywords gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_memory_access_patterns_context 
ON memory_access_patterns USING gin (access_context);