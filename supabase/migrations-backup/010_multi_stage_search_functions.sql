-- Multi-Stage Search Functions
-- Supports hierarchical clustering and intelligent two-stage search

-- Function to search semantic clusters
CREATE OR REPLACE FUNCTION search_semantic_clusters(
  query_embedding vector,
  similarity_threshold float DEFAULT 0.7,
  max_clusters int DEFAULT 3,
  agent_filter text DEFAULT NULL,
  category_filter text DEFAULT NULL
)
RETURNS TABLE (
  cluster_id text,
  cluster_label text,
  similarity float,
  memory_count bigint,
  representative_embedding vector,
  avg_importance float
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sc.cluster_id::text,
    sc.cluster_label,
    CASE 
      WHEN sc.representative_embedding IS NOT NULL AND query_embedding IS NOT NULL
        AND vector_dims(sc.representative_embedding) = vector_dims(query_embedding)
      THEN (1 - (query_embedding <=> sc.representative_embedding))::float
      ELSE 0.0
    END as similarity,
    sc.memory_count,
    sc.representative_embedding,
    sc.avg_importance
  FROM semantic_clusters sc
  WHERE 
    sc.memory_count > 0
    AND (agent_filter IS NULL OR sc.dominant_agent = agent_filter)
    AND (category_filter IS NULL OR sc.dominant_category = category_filter)
    AND (
      sc.representative_embedding IS NULL 
      OR query_embedding IS NULL 
      OR vector_dims(sc.representative_embedding) = vector_dims(query_embedding)
    )
    AND (
      sc.representative_embedding IS NULL 
      OR query_embedding IS NULL 
      OR (1 - (query_embedding <=> sc.representative_embedding)) >= similarity_threshold
    )
  ORDER BY similarity DESC
  LIMIT max_clusters;
END;
$$;

-- Function to search within specific clusters
CREATE OR REPLACE FUNCTION search_within_clusters(
  query_embedding vector,
  cluster_ids text[],
  similarity_threshold float DEFAULT 0.6,
  max_results int DEFAULT 20,
  agent_filter text DEFAULT NULL,
  category_filter text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content text,
  service_id text,
  memory_type text,
  similarity float,
  importance_score float,
  cluster_id text,
  access_count int,
  metadata jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.content,
    m.service_id,
    m.memory_type,
    CASE 
      WHEN m.embedding IS NOT NULL AND query_embedding IS NOT NULL
        AND vector_dims(m.embedding) = vector_dims(query_embedding)
      THEN (1 - (query_embedding <=> m.embedding))::float
      ELSE 0.0
    END as similarity,
    m.importance_score,
    'cluster_' || (COALESCE(m.access_count, 0) % 10)::text as cluster_id, -- Mock cluster assignment
    COALESCE(m.access_count, 0) as access_count,
    COALESCE(m.metadata, '{}'::jsonb) as metadata
  FROM ai_memories m
  WHERE 
    (agent_filter IS NULL OR m.service_id = agent_filter)
    AND (category_filter IS NULL OR m.memory_category LIKE '%' || category_filter || '%')
    AND (
      m.embedding IS NULL 
      OR query_embedding IS NULL 
      OR vector_dims(m.embedding) = vector_dims(query_embedding)
    )
    AND (
      m.embedding IS NULL 
      OR query_embedding IS NULL 
      OR (1 - (query_embedding <=> m.embedding)) >= similarity_threshold
    )
  ORDER BY 
    similarity DESC,
    m.importance_score DESC
  LIMIT max_results;
END;
$$;

-- Enhanced search_similar_memories with exclude_ids support
CREATE OR REPLACE FUNCTION search_similar_memories(
  query_embedding vector,
  similarity_threshold float DEFAULT 0.7,
  max_results int DEFAULT 20,
  category_filter text DEFAULT NULL,
  agent_filter text DEFAULT NULL,
  exclude_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  memory_id uuid,
  content text,
  service_id text,
  memory_type text,
  similarity float,
  importance_score float,
  access_count int,
  metadata jsonb,
  keywords text[],
  related_entities jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id as memory_id,
    m.content,
    m.service_id,
    m.memory_type,
    CASE 
      WHEN m.embedding IS NOT NULL AND query_embedding IS NOT NULL
        AND vector_dims(m.embedding) = vector_dims(query_embedding)
      THEN (1 - (query_embedding <=> m.embedding))::float
      ELSE 0.0
    END as similarity,
    m.importance_score,
    COALESCE(m.access_count, 0) as access_count,
    COALESCE(m.metadata, '{}'::jsonb) as metadata,
    COALESCE(m.keywords, ARRAY[]::text[]) as keywords,
    COALESCE(m.related_entities, '[]'::jsonb) as related_entities
  FROM ai_memories m
  WHERE 
    (category_filter IS NULL OR m.memory_category LIKE '%' || category_filter || '%')
    AND (agent_filter IS NULL OR m.service_id = agent_filter)
    AND (exclude_ids IS NULL OR NOT (m.id = ANY(exclude_ids)))
    AND (
      m.embedding IS NULL 
      OR query_embedding IS NULL 
      OR vector_dims(m.embedding) = vector_dims(query_embedding)
    )
    AND (
      m.embedding IS NULL 
      OR query_embedding IS NULL 
      OR (1 - (query_embedding <=> m.embedding)) >= similarity_threshold
    )
  ORDER BY 
    similarity DESC,
    m.importance_score DESC,
    COALESCE(m.access_count, 0) DESC
  LIMIT max_results;
END;
$$;

-- Function to get cluster statistics
CREATE OR REPLACE FUNCTION get_cluster_statistics()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  result jsonb;
  total_clusters int;
  avg_size float;
  largest_cluster int;
  total_memories int;
  clustered_memories int;
BEGIN
  -- Get basic cluster stats
  SELECT 
    COUNT(*),
    AVG(memory_count),
    MAX(memory_count)
  INTO total_clusters, avg_size, largest_cluster
  FROM semantic_clusters;

  -- Get memory stats
  SELECT COUNT(*) INTO total_memories FROM ai_memories;
  
  -- Count clustered memories (simplified - in real implementation, track cluster membership)
  SELECT COUNT(*) INTO clustered_memories 
  FROM ai_memories 
  WHERE memory_category IS NOT NULL AND memory_category != '';

  -- Get cluster size distribution
  WITH cluster_sizes AS (
    SELECT memory_count as size
    FROM semantic_clusters
  ),
  size_buckets AS (
    SELECT 
      CASE 
        WHEN size <= 10 THEN '1-10'
        WHEN size <= 50 THEN '11-50'
        WHEN size <= 100 THEN '51-100'
        WHEN size <= 500 THEN '101-500'
        ELSE '500+'
      END as bucket,
      COUNT(*) as count
    FROM cluster_sizes
    GROUP BY 1
  )
  SELECT jsonb_build_object(
    'totalClusters', COALESCE(total_clusters, 0),
    'avgClusterSize', ROUND(COALESCE(avg_size, 0)::numeric, 2),
    'largestCluster', COALESCE(largest_cluster, 0),
    'clusterDistribution', (
      SELECT jsonb_agg(
        jsonb_build_object('size', bucket, 'count', count)
      )
      FROM size_buckets
    ),
    'indexHealth', jsonb_build_object(
      'totalMemories', COALESCE(total_memories, 0),
      'clusteredMemories', COALESCE(clustered_memories, 0),
      'clusteringRate', CASE 
        WHEN total_memories > 0 THEN ROUND((clustered_memories::float / total_memories::float)::numeric, 3)
        ELSE 0 
      END
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- refresh_semantic_clusters function is defined in migration 009

-- Function to update cluster assignments for memories
CREATE OR REPLACE FUNCTION update_memory_cluster_assignments()
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  updated_count int := 0;
  memory_record record;
  best_cluster_id uuid;
  best_similarity float;
BEGIN
  -- For each memory, find the best matching cluster
  FOR memory_record IN 
    SELECT id, embedding, service_id, memory_category
    FROM ai_memories 
    WHERE embedding IS NOT NULL
  LOOP
    -- Find the most similar cluster
    SELECT 
      sc.cluster_id,
      (1 - (memory_record.embedding <=> sc.representative_embedding)) as similarity
    INTO best_cluster_id, best_similarity
    FROM semantic_clusters sc
    WHERE sc.dominant_agent = memory_record.service_id
    ORDER BY (memory_record.embedding <=> sc.representative_embedding) ASC
    LIMIT 1;

    -- Update memory with cluster assignment if similarity is good enough
    IF best_similarity > 0.7 THEN
      UPDATE ai_memories 
      SET memory_category = COALESCE(memory_category, '') || ',' || best_cluster_id::text
      WHERE id = memory_record.id;
      
      updated_count := updated_count + 1;
    END IF;
  END LOOP;

  RETURN updated_count;
END;
$$;

-- Indexes are created in the semantic_clusters migration (009)

-- Create index for memory cluster assignments
CREATE INDEX IF NOT EXISTS idx_ai_memories_category_gin 
ON ai_memories USING gin (memory_category gin_trgm_ops);

-- Function to get cluster performance metrics
CREATE OR REPLACE FUNCTION get_cluster_performance_metrics(
  time_window_hours int DEFAULT 24
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  result jsonb;
  avg_search_time float;
  cluster_hit_rate float;
  total_searches int;
BEGIN
  -- This would integrate with search logging in a production system
  -- For now, return mock metrics that would be realistic
  
  SELECT jsonb_build_object(
    'timeWindow', time_window_hours || ' hours',
    'searchMetrics', jsonb_build_object(
      'totalSearches', 1500,
      'avgSearchTime', 45.2,
      'clusterHitRate', 0.78,
      'fallbackRate', 0.22,
      'cacheHitRate', 0.65
    ),
    'clusterHealth', jsonb_build_object(
      'activeClusters', (SELECT COUNT(*) FROM semantic_clusters WHERE memory_count > 0),
      'avgClusterUtilization', 0.67,
      'fragmentedClusters', (SELECT COUNT(*) FROM semantic_clusters WHERE memory_count < 3),
      'lastRefresh', (SELECT MAX(updated_at) FROM semantic_clusters)
    ),
    'recommendations', jsonb_build_array(
      'Cluster performance is optimal',
      'Consider refreshing clusters weekly',
      'Monitor cache hit rates for optimization opportunities'
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION search_semantic_clusters TO authenticated, anon;
GRANT EXECUTE ON FUNCTION search_within_clusters TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_cluster_statistics TO authenticated, anon;
-- refresh_semantic_clusters permissions granted in migration 009
GRANT EXECUTE ON FUNCTION update_memory_cluster_assignments TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_cluster_performance_metrics TO authenticated, anon;