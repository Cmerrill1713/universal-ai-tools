-- Advanced Vector Extensions and Performance Optimizations
-- Adds pgai vectorizer, pgvectorscale, and performance monitoring extensions

-- Note: Some extensions may not be available in local Supabase
-- Enable what's available and provide fallbacks

-- Advanced Vector Extensions (if available)
-- pgvectorscale provides enhanced performance for vector operations
DO $$
BEGIN
    BEGIN
        CREATE EXTENSION IF NOT EXISTS pgvectorscale;
        RAISE NOTICE 'pgvectorscale extension enabled successfully';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'pgvectorscale not available in this Supabase environment';
    END;
END $$;

-- Performance monitoring extensions
DO $$
BEGIN
    BEGIN
        CREATE EXTENSION IF NOT EXISTS pg_stat_monitor;
        RAISE NOTICE 'pg_stat_monitor extension enabled successfully';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'pg_stat_monitor not available, using pg_stat_statements instead';
        BEGIN
            CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
            RAISE NOTICE 'pg_stat_statements extension enabled successfully';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'No query monitoring extensions available';
        END;
    END;
END $$;

-- Hypothetical index advisor (if available)
DO $$
BEGIN
    BEGIN
        CREATE EXTENSION IF NOT EXISTS hypopg;
        RAISE NOTICE 'hypopg extension enabled successfully';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'hypopg not available in this environment';
    END;
END $$;

-- Additional text processing extensions
CREATE EXTENSION IF NOT EXISTS unaccent; -- Remove accents from text
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- Already enabled but ensure it's there

-- Upgrade vector indexes to use HNSW for better performance
-- Drop old IVFFlat index and create HNSW index
DROP INDEX IF EXISTS idx_ai_memories_embedding;

-- Create HNSW index for better performance (if supported)
DO $$
BEGIN
    BEGIN
        CREATE INDEX idx_ai_memories_embedding_hnsw 
        ON ai_memories USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
        RAISE NOTICE 'HNSW index created successfully';
    EXCEPTION WHEN OTHERS THEN
        -- Fallback to IVFFlat if HNSW not available
        CREATE INDEX idx_ai_memories_embedding_ivfflat 
        ON ai_memories USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
        RAISE NOTICE 'Fallback: IVFFlat index created (HNSW not available)';
    END;
END $$;

-- Create additional indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_ai_memories_composite_performance 
ON ai_memories (importance_score DESC, last_accessed DESC NULLS LAST, memory_category)
WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_memories_service_type 
ON ai_memories (service_id, memory_type) 
WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_memories_recent_important 
ON ai_memories (created_at DESC, importance_score DESC) 
WHERE importance_score > 0.5;

-- Create materialized view for semantic clusters
CREATE MATERIALIZED VIEW IF NOT EXISTS memory_semantic_clusters AS
WITH clustered_memories AS (
  SELECT 
    id,
    content,
    embedding,
    importance_score,
    service_id,
    memory_type,
    created_at,
    -- Create clusters using modulo hash (simple clustering)
    (hashtext(content) % 50) as cluster_id
  FROM ai_memories 
  WHERE embedding IS NOT NULL 
    AND importance_score > 0.3
    AND created_at > NOW() - INTERVAL '90 days'
)
SELECT 
  cluster_id,
  COUNT(*) as member_count,
  AVG(importance_score) as avg_importance,
  ARRAY_AGG(id ORDER BY importance_score DESC) as memory_ids,
  ARRAY_AGG(DISTINCT service_id) as agent_types,
  ARRAY_AGG(DISTINCT memory_type) as memory_types,
  MIN(created_at) as oldest_memory,
  MAX(created_at) as newest_memory,
  -- Calculate approximate centroid (simplified) - ensure vector type
  (ARRAY_AGG(embedding ORDER BY importance_score DESC))[1]::vector(1536) as representative_embedding
FROM clustered_memories
GROUP BY cluster_id
HAVING COUNT(*) >= 2  -- Only clusters with multiple memories
ORDER BY avg_importance DESC, member_count DESC;

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_memory_clusters_representative_embedding
ON memory_semantic_clusters USING hnsw (representative_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Create fallback index if HNSW fails
DO $$
BEGIN
    -- Check if HNSW index was created successfully
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'memory_semantic_clusters' 
        AND indexname = 'idx_memory_clusters_representative_embedding'
    ) THEN
        CREATE INDEX idx_memory_clusters_representative_embedding_ivf
        ON memory_semantic_clusters USING ivfflat (representative_embedding vector_cosine_ops)
        WITH (lists = 20);
        RAISE NOTICE 'Created IVFFlat index for clusters (HNSW fallback)';
    END IF;
END $$;

-- Function to refresh semantic clusters
CREATE OR REPLACE FUNCTION refresh_semantic_clusters()
RETURNS INTEGER AS $$
DECLARE
  cluster_count INTEGER;
BEGIN
  REFRESH MATERIALIZED VIEW memory_semantic_clusters;
  
  SELECT COUNT(*) INTO cluster_count FROM memory_semantic_clusters;
  
  RAISE NOTICE 'Refreshed semantic clusters: % clusters found', cluster_count;
  RETURN cluster_count;
END;
$$ LANGUAGE plpgsql;

-- Multi-stage vector search function using clusters
CREATE OR REPLACE FUNCTION optimized_memory_search(
  query_embedding vector(1536),
  similarity_threshold FLOAT DEFAULT 0.7,
  max_results INTEGER DEFAULT 20,
  use_clusters BOOLEAN DEFAULT true
)
RETURNS TABLE (
  memory_id UUID,
  service_id TEXT,
  content TEXT,
  similarity FLOAT,
  importance_score FLOAT,
  search_method TEXT
) AS $$
BEGIN
  IF use_clusters AND EXISTS (SELECT 1 FROM memory_semantic_clusters LIMIT 1) THEN
    -- Stage 1: Find relevant clusters
    RETURN QUERY
    WITH relevant_clusters AS (
      SELECT 
        c.cluster_id,
        c.memory_ids,
        1 - (c.representative_embedding <=> query_embedding) as cluster_similarity
      FROM memory_semantic_clusters c
      WHERE 1 - (c.representative_embedding <=> query_embedding) > similarity_threshold * 0.6
      ORDER BY c.representative_embedding <=> query_embedding
      LIMIT 10
    ),
    candidate_memories AS (
      SELECT UNNEST(rc.memory_ids) as mid
      FROM relevant_clusters rc
    )
    -- Stage 2: Detailed search within relevant clusters
    SELECT 
      m.id,
      m.service_id,
      m.content,
      1 - (m.embedding <=> query_embedding) as similarity,
      calculate_importance_decay(m.importance_score, m.last_accessed, m.access_count) as importance_score,
      'clustered' as search_method
    FROM ai_memories m
    JOIN candidate_memories cm ON m.id = cm.mid
    WHERE m.embedding IS NOT NULL
      AND 1 - (m.embedding <=> query_embedding) > similarity_threshold
    ORDER BY 
      (1 - (m.embedding <=> query_embedding)) * 
      calculate_importance_decay(m.importance_score, m.last_accessed, m.access_count) DESC
    LIMIT max_results;
  ELSE
    -- Fallback to direct search
    RETURN QUERY
    SELECT 
      m.id,
      m.service_id,
      m.content,
      1 - (m.embedding <=> query_embedding) as similarity,
      calculate_importance_decay(m.importance_score, m.last_accessed, m.access_count) as importance_score,
      'direct' as search_method
    FROM ai_memories m
    WHERE m.embedding IS NOT NULL
      AND 1 - (m.embedding <=> query_embedding) > similarity_threshold
    ORDER BY 
      (1 - (m.embedding <=> query_embedding)) * 
      calculate_importance_decay(m.importance_score, m.last_accessed, m.access_count) DESC
    LIMIT max_results;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to analyze vector search performance
CREATE OR REPLACE FUNCTION analyze_vector_performance()
RETURNS TABLE (
  total_memories INTEGER,
  memories_with_embeddings INTEGER,
  avg_embedding_dimension FLOAT,
  cluster_count INTEGER,
  index_efficiency TEXT
) AS $$
DECLARE
  mem_count INTEGER;
  emb_count INTEGER;
  avg_dim FLOAT;
  clust_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO mem_count FROM ai_memories;
  SELECT COUNT(*) INTO emb_count FROM ai_memories WHERE embedding IS NOT NULL;
  
  -- Calculate average dimension (should be 1536)
  SELECT AVG(array_length(embedding, 1)) INTO avg_dim 
  FROM ai_memories WHERE embedding IS NOT NULL;
  
  -- Count clusters
  SELECT COUNT(*) INTO clust_count FROM memory_semantic_clusters;
  
  RETURN QUERY SELECT 
    mem_count,
    emb_count,
    avg_dim,
    clust_count,
    CASE 
      WHEN clust_count > 0 THEN 'Clustered search available'
      WHEN emb_count > 1000 THEN 'Consider clustering for performance'
      ELSE 'Direct search optimal'
    END as index_efficiency;
END;
$$ LANGUAGE plpgsql;

-- Schedule automatic cluster refresh (if pg_cron is available)
DO $schedule$
BEGIN
  BEGIN
    -- Refresh clusters daily at 2 AM
    SELECT cron.schedule(
      'refresh-semantic-clusters',
      '0 2 * * *',
      'SELECT refresh_semantic_clusters();'
    );
    RAISE NOTICE 'Scheduled automatic cluster refresh';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron not available - clusters will need manual refresh';
  END;
END $schedule$;

-- Create monitoring view for vector search performance
CREATE OR REPLACE VIEW vector_search_stats AS
SELECT 
  'total_memories' as metric,
  COUNT(*)::TEXT as value
FROM ai_memories
UNION ALL
SELECT 
  'memories_with_embeddings' as metric,
  COUNT(*)::TEXT as value
FROM ai_memories WHERE embedding IS NOT NULL
UNION ALL
SELECT 
  'semantic_clusters' as metric,
  COUNT(*)::TEXT as value
FROM memory_semantic_clusters
UNION ALL
SELECT 
  'avg_importance_score' as metric,
  ROUND(AVG(importance_score)::numeric, 3)::TEXT as value
FROM ai_memories WHERE embedding IS NOT NULL
UNION ALL
SELECT 
  'memories_last_24h' as metric,
  COUNT(*)::TEXT as value
FROM ai_memories 
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND embedding IS NOT NULL;

-- Grant permissions for the monitoring view
GRANT SELECT ON vector_search_stats TO authenticated;
GRANT SELECT ON memory_semantic_clusters TO authenticated;

-- Final verification and status report
DO $$
DECLARE
  extension_status TEXT;
  index_status TEXT;
  cluster_status TEXT;
BEGIN
  -- Check extensions
  SELECT string_agg(extname, ', ' ORDER BY extname) INTO extension_status
  FROM pg_extension 
  WHERE extname IN ('vector', 'pgvectorscale', 'pg_stat_monitor', 'hypopg');
  
  -- Check indexes
  SELECT COUNT(*)::TEXT INTO index_status
  FROM pg_indexes 
  WHERE tablename = 'ai_memories' 
    AND indexdef LIKE '%embedding%';
  
  -- Check clusters
  SELECT COUNT(*)::TEXT INTO cluster_status
  FROM memory_semantic_clusters;
  
  RAISE NOTICE 'Advanced Vector Extensions Installation Complete';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Enabled extensions: %', COALESCE(extension_status, 'none');
  RAISE NOTICE 'Vector indexes created: %', index_status;
  RAISE NOTICE 'Semantic clusters: %', cluster_status;
  RAISE NOTICE 'Performance optimization functions: available';
  RAISE NOTICE 'Multi-stage search: enabled';
END $$;