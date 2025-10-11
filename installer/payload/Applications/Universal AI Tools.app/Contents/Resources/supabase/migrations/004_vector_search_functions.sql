-- Vector similarity search functions for enhanced memory retrieval

-- Function to find similar memories using cosine similarity
CREATE OR REPLACE FUNCTION search_similar_memories(
  query_embedding vector(1536),
  similarity_threshold FLOAT DEFAULT 0.7,
  max_results INTEGER DEFAULT 20,
  memory_category TEXT DEFAULT NULL,
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
    1 - (m.embedding <=> query_embedding) AS similarity,
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
    AND 1 - (m.embedding <=> query_embedding) > similarity_threshold
    AND (memory_category IS NULL OR m.memory_category = search_similar_memories.memory_category)
    AND (agent_filter IS NULL OR m.service_id = search_similar_memories.agent_filter)
  ORDER BY adjusted_score DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Function to find memories across multiple agents
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
      m.id AS memory_id,
      m.service_id,
      m.content,
      1 - (m.embedding <=> query_embedding) AS similarity,
      ROW_NUMBER() OVER (PARTITION BY m.service_id ORDER BY m.embedding <=> query_embedding) AS rn
    FROM ai_memories m
    WHERE 
      m.embedding IS NOT NULL
      AND m.service_id = ANY(agent_list)
      AND 1 - (m.embedding <=> query_embedding) > similarity_threshold
  )
  SELECT 
    rm.memory_id,
    rm.service_id,
    rm.content,
    rm.similarity,
    rm.rn as agent_rank
  FROM ranked_memories rm
  WHERE rm.rn <= max_per_agent
  ORDER BY rm.similarity DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to find connected memories (graph-like traversal)
CREATE OR REPLACE FUNCTION find_connected_memories(
  start_memory_id UUID,
  connection_types TEXT[] DEFAULT NULL,
  max_depth INTEGER DEFAULT 3,
  min_strength FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  memory_id UUID,
  content TEXT,
  depth INTEGER,
  path UUID[],
  total_strength FLOAT
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE memory_graph AS (
    -- Base case: start memory
    SELECT 
      m.id AS memory_id,
      m.content,
      0 AS depth,
      ARRAY[m.id] AS path,
      1.0::FLOAT AS total_strength
    FROM ai_memories m
    WHERE m.id = start_memory_id
    
    UNION ALL
    
    -- Recursive case: follow connections
    SELECT 
      m.id,
      m.content,
      mg.depth + 1,
      mg.path || m.id,
      mg.total_strength * mc.strength
    FROM memory_graph mg
    JOIN memory_connections mc ON mg.memory_id = mc.source_memory_id
    JOIN ai_memories m ON mc.target_memory_id = m.id
    WHERE 
      mg.depth < max_depth
      AND mc.strength >= min_strength
      AND NOT m.id = ANY(mg.path) -- Prevent cycles
      AND (connection_types IS NULL OR mc.connection_type = ANY(connection_types))
  )
  SELECT 
    mg.memory_id,
    mg.content,
    mg.depth,
    mg.path,
    mg.total_strength
  FROM memory_graph mg
  WHERE mg.depth > 0
  ORDER BY mg.depth, mg.total_strength DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to cluster similar memories
CREATE OR REPLACE FUNCTION cluster_memories_by_similarity(
  cluster_count INTEGER DEFAULT 10,
  min_cluster_size INTEGER DEFAULT 3
)
RETURNS TABLE (
  cluster_id INTEGER,
  memory_ids UUID[],
  centroid vector(1536),
  avg_similarity FLOAT
) AS $$
DECLARE
  -- This is a simplified clustering function
  -- In production, you might want to use more sophisticated algorithms
BEGIN
  -- Implementation would use k-means or similar clustering
  -- For now, returning a placeholder
  RETURN QUERY
  SELECT 
    1::INTEGER AS cluster_id,
    ARRAY[id] AS memory_ids,
    embedding AS centroid,
    1.0::FLOAT AS avg_similarity
  FROM ai_memories
  WHERE embedding IS NOT NULL
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to find memories by temporal + semantic similarity
CREATE OR REPLACE FUNCTION search_temporal_semantic_memories(
  query_embedding vector(1536),
  time_start TIMESTAMPTZ,
  time_end TIMESTAMPTZ,
  similarity_threshold FLOAT DEFAULT 0.6,
  temporal_weight FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  memory_id UUID,
  content TEXT,
  created_at TIMESTAMPTZ,
  semantic_similarity FLOAT,
  temporal_score FLOAT,
  combined_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  WITH temporal_memories AS (
    SELECT 
      m.id,
      m.content,
      m.created_at,
      1 - (m.embedding <=> query_embedding) AS semantic_similarity,
      CASE 
        WHEN m.created_at BETWEEN time_start AND time_end THEN 1.0
        ELSE EXP(-ABS(EXTRACT(EPOCH FROM (m.created_at - time_start)) / 86400.0) * 0.1)
      END AS temporal_score
    FROM ai_memories m
    WHERE 
      m.embedding IS NOT NULL
      AND m.created_at BETWEEN (time_start - INTERVAL '7 days') AND (time_end + INTERVAL '7 days')
  )
  SELECT 
    id AS memory_id,
    content,
    created_at,
    semantic_similarity,
    temporal_score,
    (semantic_similarity * (1 - temporal_weight)) + (temporal_score * temporal_weight) AS combined_score
  FROM temporal_memories
  WHERE semantic_similarity > similarity_threshold
  ORDER BY combined_score DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql;

-- Function to get memory recommendations based on access patterns
CREATE OR REPLACE FUNCTION recommend_related_memories(
  user_id TEXT,
  agent_name TEXT,
  current_context vector(1536) DEFAULT NULL,
  limit_results INTEGER DEFAULT 10
)
RETURNS TABLE (
  memory_id UUID,
  content TEXT,
  recommendation_score FLOAT,
  reason TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH user_patterns AS (
    -- Get user's frequently accessed memories
    SELECT 
      map.memory_id,
      COUNT(*) AS access_frequency,
      AVG(map.similarity_score) AS avg_similarity
    FROM memory_access_patterns map
    JOIN ai_memories m ON map.memory_id = m.id
    WHERE 
      map.agent_name = recommend_related_memories.agent_name
      AND m.metadata->>'user_id' = recommend_related_memories.user_id
      AND map.response_useful = true
    GROUP BY map.memory_id
  ),
  scored_memories AS (
    SELECT 
      m.id,
      m.content,
      CASE 
        WHEN current_context IS NOT NULL 
        THEN 1 - (m.embedding <=> current_context)
        ELSE 0
      END AS context_similarity,
      COALESCE(up.access_frequency, 0) AS frequency,
      m.importance_score
    FROM ai_memories m
    LEFT JOIN user_patterns up ON m.id = up.memory_id
    WHERE m.embedding IS NOT NULL
  )
  SELECT 
    id AS memory_id,
    content,
    (context_similarity * 0.4 + 
     (frequency::FLOAT / NULLIF((SELECT MAX(frequency) FROM scored_memories), 0)) * 0.3 +
     importance_score * 0.3) AS recommendation_score,
    CASE 
      WHEN context_similarity > 0.7 THEN 'Highly relevant to current context'
      WHEN frequency > 5 THEN 'Frequently accessed memory'
      ELSE 'Important memory'
    END AS reason
  FROM scored_memories
  WHERE (context_similarity > 0.5 OR frequency > 0 OR importance_score > 0.7)
  ORDER BY recommendation_score DESC
  LIMIT limit_results;
END;
$$ LANGUAGE plpgsql;

-- Function to create memory connections based on similarity
CREATE OR REPLACE FUNCTION auto_connect_similar_memories(
  similarity_threshold FLOAT DEFAULT 0.8,
  max_connections_per_memory INTEGER DEFAULT 5
)
RETURNS INTEGER AS $$
DECLARE
  connections_created INTEGER := 0;
  memory_record RECORD;
  similar_record RECORD;
BEGIN
  -- For each memory with an embedding
  FOR memory_record IN 
    SELECT id, embedding 
    FROM ai_memories 
    WHERE embedding IS NOT NULL
  LOOP
    -- Find similar memories
    FOR similar_record IN
      SELECT 
        id,
        1 - (embedding <=> memory_record.embedding) AS similarity
      FROM ai_memories
      WHERE 
        id != memory_record.id
        AND embedding IS NOT NULL
        AND 1 - (embedding <=> memory_record.embedding) > similarity_threshold
      ORDER BY embedding <=> memory_record.embedding
      LIMIT max_connections_per_memory
    LOOP
      -- Create connection if it doesn't exist
      INSERT INTO memory_connections (
        source_memory_id,
        target_memory_id,
        connection_type,
        strength
      ) VALUES (
        memory_record.id,
        similar_record.id,
        'semantic_similarity',
        similar_record.similarity
      )
      ON CONFLICT (source_memory_id, target_memory_id, connection_type) 
      DO UPDATE SET strength = EXCLUDED.strength
      WHERE memory_connections.strength < EXCLUDED.strength;
      
      connections_created := connections_created + 1;
    END LOOP;
  END LOOP;
  
  RETURN connections_created;
END;
$$ LANGUAGE plpgsql;

-- Create indexes to support these functions
CREATE INDEX IF NOT EXISTS idx_memory_access_patterns_useful 
ON memory_access_patterns(agent_name, response_useful) 
WHERE response_useful = true;