-- Enhanced Searchable Context System
-- Implements memory connections, enhanced search, knowledge graphs, and context enrichment

-- 1. CREATE MEMORY CONNECTIONS BETWEEN RELATED KNOWLEDGE DOMAINS
-- ================================================================

-- Function to create connections between Supabase and GraphQL memories
CREATE OR REPLACE FUNCTION connect_supabase_graphql_memories()
RETURNS INTEGER AS $$
DECLARE
  connections_created INTEGER := 0;
  supabase_memory RECORD;
  graphql_memory RECORD;
BEGIN
  -- Find Supabase-related memories
  FOR supabase_memory IN 
    SELECT id, content, embedding
    FROM ai_memories 
    WHERE 
      (memory_type LIKE '%supabase%' OR 
       content ILIKE '%supabase%' OR 
       keywords @> ARRAY['supabase']) 
      AND embedding IS NOT NULL
  LOOP
    -- Find related GraphQL memories
    FOR graphql_memory IN
      SELECT id, content, 1 - (embedding <=> supabase_memory.embedding) AS similarity
      FROM ai_memories
      WHERE 
        (memory_type LIKE '%graphql%' OR 
         content ILIKE '%graphql%' OR 
         keywords @> ARRAY['graphql'])
        AND embedding IS NOT NULL
        AND id != supabase_memory.id
        AND 1 - (embedding <=> supabase_memory.embedding) > 0.6
      ORDER BY embedding <=> supabase_memory.embedding
      LIMIT 5
    LOOP
      -- Create bidirectional connection
      INSERT INTO memory_connections (
        source_memory_id, target_memory_id, connection_type, strength, metadata
      ) VALUES 
        (supabase_memory.id, graphql_memory.id, 'database_api_pattern', graphql_memory.similarity,
         jsonb_build_object('domain', 'supabase-graphql', 'pattern', 'database-api-integration')),
        (graphql_memory.id, supabase_memory.id, 'database_api_pattern', graphql_memory.similarity,
         jsonb_build_object('domain', 'graphql-supabase', 'pattern', 'api-database-integration'))
      ON CONFLICT (source_memory_id, target_memory_id, connection_type) 
      DO UPDATE SET 
        strength = GREATEST(memory_connections.strength, EXCLUDED.strength),
        metadata = memory_connections.metadata || EXCLUDED.metadata;
      
      connections_created := connections_created + 2;
    END LOOP;
  END LOOP;
  
  RETURN connections_created;
END;
$$ LANGUAGE plpgsql;

-- Function to connect reranking memories to both Supabase and GraphQL
CREATE OR REPLACE FUNCTION connect_reranking_memories()
RETURNS INTEGER AS $$
DECLARE
  connections_created INTEGER := 0;
  reranking_memory RECORD;
  related_memory RECORD;
BEGIN
  -- Find reranking-related memories
  FOR reranking_memory IN 
    SELECT id, content, embedding
    FROM ai_memories 
    WHERE 
      (memory_type LIKE '%rerank%' OR 
       content ILIKE '%rerank%' OR 
       content ILIKE '%performance%' OR
       keywords @> ARRAY['reranking', 'performance', 'optimization']) 
      AND embedding IS NOT NULL
  LOOP
    -- Find related memories (Supabase, GraphQL, or general optimization)
    FOR related_memory IN
      SELECT 
        id, 
        content, 
        memory_type,
        1 - (embedding <=> reranking_memory.embedding) AS similarity
      FROM ai_memories
      WHERE 
        embedding IS NOT NULL
        AND id != reranking_memory.id
        AND 1 - (embedding <=> reranking_memory.embedding) > 0.5
        AND (
          memory_type LIKE ANY(ARRAY['%supabase%', '%graphql%', '%performance%', '%optimization%'])
          OR content ILIKE ANY(ARRAY['%query%', '%search%', '%performance%'])
        )
      ORDER BY embedding <=> reranking_memory.embedding
      LIMIT 10
    LOOP
      -- Create connection with appropriate type
      INSERT INTO memory_connections (
        source_memory_id, target_memory_id, connection_type, strength, metadata
      ) VALUES (
        reranking_memory.id, 
        related_memory.id, 
        'performance_optimization', 
        related_memory.similarity,
        jsonb_build_object(
          'optimization_type', 'reranking',
          'target_domain', CASE 
            WHEN related_memory.content ILIKE '%supabase%' THEN 'supabase'
            WHEN related_memory.content ILIKE '%graphql%' THEN 'graphql'
            ELSE 'general'
          END,
          'pattern', 'performance-enhancement'
        )
      )
      ON CONFLICT (source_memory_id, target_memory_id, connection_type) 
      DO UPDATE SET 
        strength = GREATEST(memory_connections.strength, EXCLUDED.strength),
        metadata = memory_connections.metadata || EXCLUDED.metadata;
      
      connections_created := connections_created + 1;
    END LOOP;
  END LOOP;
  
  RETURN connections_created;
END;
$$ LANGUAGE plpgsql;

-- Function to connect agent orchestration memories to all domains
CREATE OR REPLACE FUNCTION connect_agent_orchestration_memories()
RETURNS INTEGER AS $$
DECLARE
  connections_created INTEGER := 0;
  agent_memory RECORD;
  tech_memory RECORD;
BEGIN
  -- Find agent orchestration memories
  FOR agent_memory IN 
    SELECT id, content, embedding, memory_type
    FROM ai_memories 
    WHERE 
      service_id = 'agent-orchestration-system'
      AND embedding IS NOT NULL
  LOOP
    -- Find related technology memories
    FOR tech_memory IN
      SELECT 
        id, 
        content, 
        service_id,
        memory_type,
        1 - (embedding <=> agent_memory.embedding) AS similarity
      FROM ai_memories
      WHERE 
        embedding IS NOT NULL
        AND id != agent_memory.id
        AND service_id != 'agent-orchestration-system'
        AND 1 - (embedding <=> agent_memory.embedding) > 0.5
      ORDER BY embedding <=> agent_memory.embedding
      LIMIT 8
    LOOP
      -- Create connection showing how agents use these technologies
      INSERT INTO memory_connections (
        source_memory_id, target_memory_id, connection_type, strength, metadata
      ) VALUES (
        agent_memory.id, 
        tech_memory.id, 
        'agent_uses_technology', 
        tech_memory.similarity,
        jsonb_build_object(
          'agent_pattern', agent_memory.memory_type,
          'technology', tech_memory.service_id,
          'integration_level', CASE 
            WHEN tech_memory.similarity > 0.8 THEN 'core'
            WHEN tech_memory.similarity > 0.65 THEN 'supporting'
            ELSE 'peripheral'
          END
        )
      )
      ON CONFLICT (source_memory_id, target_memory_id, connection_type) 
      DO UPDATE SET 
        strength = GREATEST(memory_connections.strength, EXCLUDED.strength),
        metadata = memory_connections.metadata || EXCLUDED.metadata;
      
      connections_created := connections_created + 1;
    END LOOP;
  END LOOP;
  
  RETURN connections_created;
END;
$$ LANGUAGE plpgsql;

-- 2. ENHANCED SEARCH FUNCTIONS
-- ============================

-- Multi-domain semantic search with intelligent ranking
CREATE OR REPLACE FUNCTION search_across_domains(
  query_text TEXT,
  query_embedding vector DEFAULT NULL,
  domains TEXT[] DEFAULT NULL,
  intent TEXT DEFAULT NULL, -- 'learning', 'debugging', 'implementation', 'optimization'
  max_results INTEGER DEFAULT 30
)
RETURNS TABLE (
  memory_id UUID,
  content TEXT,
  domain TEXT,
  relevance_score FLOAT,
  context_score FLOAT,
  final_score FLOAT,
  related_memories UUID[],
  metadata JSONB
) AS $$
DECLARE
  intent_keywords TEXT[];
  intent_boost FLOAT;
BEGIN
  -- Determine intent-based keywords and boost
  CASE intent
    WHEN 'learning' THEN
      intent_keywords := ARRAY['tutorial', 'example', 'guide', 'introduction', 'basics'];
      intent_boost := 1.2;
    WHEN 'debugging' THEN
      intent_keywords := ARRAY['error', 'fix', 'issue', 'problem', 'solution', 'troubleshoot'];
      intent_boost := 1.3;
    WHEN 'implementation' THEN
      intent_keywords := ARRAY['implement', 'create', 'build', 'setup', 'configure'];
      intent_boost := 1.25;
    WHEN 'optimization' THEN
      intent_keywords := ARRAY['optimize', 'performance', 'improve', 'enhance', 'scale'];
      intent_boost := 1.3;
    ELSE
      intent_keywords := ARRAY[]::TEXT[];
      intent_boost := 1.0;
  END CASE;

  RETURN QUERY
  WITH semantic_matches AS (
    SELECT 
      m.id,
      m.content,
      m.service_id,
      m.memory_type,
      m.metadata,
      m.keywords,
      m.importance_score,
      CASE 
        WHEN query_embedding IS NOT NULL AND m.embedding IS NOT NULL 
        THEN 1 - (m.embedding <=> query_embedding)
        ELSE 0
      END AS vector_similarity,
      -- Text similarity
      CASE 
        WHEN query_text IS NOT NULL 
        THEN similarity(m.content, query_text)
        ELSE 0
      END AS text_similarity,
      -- Intent matching
      CASE 
        WHEN intent_keywords != ARRAY[]::TEXT[] AND m.keywords && intent_keywords
        THEN 0.2
        ELSE 0
      END AS intent_match
    FROM ai_memories m
    WHERE 
      (domains IS NULL OR m.service_id = ANY(domains))
      AND (
        (query_embedding IS NOT NULL AND m.embedding IS NOT NULL AND 
         1 - (m.embedding <=> query_embedding) > 0.4)
        OR 
        (query_text IS NOT NULL AND 
         (m.content ILIKE '%' || query_text || '%' OR 
          similarity(m.content, query_text) > 0.3))
      )
  ),
  connected_memories AS (
    SELECT 
      sm.id,
      array_agg(DISTINCT mc.target_memory_id) FILTER (WHERE mc.target_memory_id IS NOT NULL) AS related_ids
    FROM semantic_matches sm
    LEFT JOIN memory_connections mc ON sm.id = mc.source_memory_id
    WHERE mc.strength > 0.5
    GROUP BY sm.id
  )
  SELECT 
    sm.id AS memory_id,
    sm.content,
    sm.service_id AS domain,
    (sm.vector_similarity * 0.5 + sm.text_similarity * 0.3 + sm.importance_score * 0.2) AS relevance_score,
    (sm.intent_match * intent_boost + 
     CASE WHEN cm.related_ids IS NOT NULL THEN 0.1 ELSE 0 END) AS context_score,
    (sm.vector_similarity * 0.5 + sm.text_similarity * 0.3 + sm.importance_score * 0.2) * 
    (1 + sm.intent_match * intent_boost + 
     CASE WHEN cm.related_ids IS NOT NULL THEN 0.1 ELSE 0 END) AS final_score,
    COALESCE(cm.related_ids, ARRAY[]::UUID[]) AS related_memories,
    sm.metadata
  FROM semantic_matches sm
  LEFT JOIN connected_memories cm ON sm.id = cm.id
  ORDER BY final_score DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Knowledge graph traversal search
CREATE OR REPLACE FUNCTION search_knowledge_graph(
  start_query TEXT,
  start_embedding vector DEFAULT NULL,
  traversal_depth INTEGER DEFAULT 2,
  max_paths INTEGER DEFAULT 5,
  connection_types TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  path_id INTEGER,
  memory_sequence UUID[],
  content_sequence TEXT[],
  domain_sequence TEXT[],
  total_strength FLOAT,
  path_description TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE initial_memories AS (
    -- Find starting memories
    SELECT 
      m.id,
      m.content,
      m.service_id,
      CASE 
        WHEN start_embedding IS NOT NULL AND m.embedding IS NOT NULL 
        THEN 1 - (m.embedding <=> start_embedding)
        ELSE similarity(m.content, start_query)
      END AS initial_score
    FROM ai_memories m
    WHERE 
      (start_embedding IS NOT NULL AND m.embedding IS NOT NULL AND 
       1 - (m.embedding <=> start_embedding) > 0.6)
      OR 
      (start_query IS NOT NULL AND similarity(m.content, start_query) > 0.4)
    ORDER BY initial_score DESC
    LIMIT 3
  ),
  knowledge_paths AS (
    -- Base case
    SELECT 
      1 AS depth,
      ARRAY[im.id] AS path,
      ARRAY[im.content] AS contents,
      ARRAY[im.service_id] AS domains,
      im.initial_score AS path_strength,
      im.id AS current_id
    FROM initial_memories im
    
    UNION ALL
    
    -- Recursive case
    SELECT 
      kp.depth + 1,
      kp.path || m.id,
      kp.contents || m.content,
      kp.domains || m.service_id,
      kp.path_strength * mc.strength,
      m.id
    FROM knowledge_paths kp
    JOIN memory_connections mc ON kp.current_id = mc.source_memory_id
    JOIN ai_memories m ON mc.target_memory_id = m.id
    WHERE 
      kp.depth < traversal_depth
      AND NOT m.id = ANY(kp.path)
      AND mc.strength > 0.5
      AND (connection_types IS NULL OR mc.connection_type = ANY(connection_types))
  )
  SELECT 
    ROW_NUMBER() OVER (ORDER BY path_strength DESC) AS path_id,
    path AS memory_sequence,
    contents AS content_sequence,
    domains AS domain_sequence,
    path_strength AS total_strength,
    'Path: ' || array_to_string(domains, ' → ') AS path_description
  FROM knowledge_paths
  WHERE depth = traversal_depth
  ORDER BY path_strength DESC
  LIMIT max_paths;
END;
$$ LANGUAGE plpgsql;

-- 3. KNOWLEDGE GRAPH VIEWS
-- ========================

-- View for memory relationships and dependencies
CREATE OR REPLACE VIEW memory_relationship_graph AS
SELECT 
  mc.source_memory_id,
  mc.target_memory_id,
  mc.connection_type,
  mc.strength,
  sm.content AS source_content,
  sm.service_id AS source_domain,
  sm.memory_type AS source_type,
  tm.content AS target_content,
  tm.service_id AS target_domain,
  tm.memory_type AS target_type,
  mc.metadata
FROM memory_connections mc
JOIN ai_memories sm ON mc.source_memory_id = sm.id
JOIN ai_memories tm ON mc.target_memory_id = tm.id
WHERE mc.strength > 0.3;

-- View for knowledge clustering by topic
CREATE OR REPLACE VIEW knowledge_clusters AS
WITH cluster_assignment AS (
  SELECT 
    m.id,
    m.content,
    m.service_id,
    m.memory_type,
    m.memory_category,
    m.importance_score,
    m.keywords,
    -- Assign to cluster based on primary domain
    CASE 
      WHEN m.service_id LIKE '%supabase%' OR m.content ILIKE '%supabase%' THEN 'database-technologies'
      WHEN m.service_id LIKE '%graphql%' OR m.content ILIKE '%graphql%' THEN 'api-technologies'
      WHEN m.content ILIKE '%rerank%' OR m.content ILIKE '%performance%' THEN 'optimization-techniques'
      WHEN m.service_id = 'agent-orchestration-system' THEN 'agent-systems'
      WHEN m.memory_type LIKE '%dspy%' THEN 'ai-frameworks'
      ELSE 'general-knowledge'
    END AS primary_cluster,
    -- Complexity level
    CASE 
      WHEN m.content ILIKE ANY(ARRAY['%basic%', '%introduction%', '%simple%', '%getting started%']) THEN 'beginner'
      WHEN m.content ILIKE ANY(ARRAY['%advanced%', '%complex%', '%optimization%', '%production%']) THEN 'advanced'
      ELSE 'intermediate'
    END AS complexity_level
  FROM ai_memories m
)
SELECT 
  primary_cluster,
  complexity_level,
  COUNT(*) AS memory_count,
  AVG(importance_score) AS avg_importance,
  array_agg(DISTINCT service_id) AS domains,
  array_agg(DISTINCT unnest(keywords)) AS cluster_keywords
FROM cluster_assignment
GROUP BY primary_cluster, complexity_level;

-- View for cross-reference matrix
CREATE OR REPLACE VIEW technology_cross_references AS
WITH domain_pairs AS (
  SELECT DISTINCT
    LEAST(sm.service_id, tm.service_id) AS domain1,
    GREATEST(sm.service_id, tm.service_id) AS domain2,
    COUNT(*) AS connection_count,
    AVG(mc.strength) AS avg_strength,
    array_agg(DISTINCT mc.connection_type) AS connection_types
  FROM memory_connections mc
  JOIN ai_memories sm ON mc.source_memory_id = sm.id
  JOIN ai_memories tm ON mc.target_memory_id = tm.id
  WHERE sm.service_id != tm.service_id
  GROUP BY LEAST(sm.service_id, tm.service_id), GREATEST(sm.service_id, tm.service_id)
)
SELECT * FROM domain_pairs
ORDER BY connection_count DESC, avg_strength DESC;

-- View for knowledge access patterns
CREATE OR REPLACE VIEW knowledge_usage_patterns AS
SELECT 
  m.id,
  m.service_id,
  m.memory_type,
  m.content,
  m.access_count,
  m.last_accessed,
  m.importance_score,
  calculate_importance_decay(m.importance_score, m.last_accessed, m.access_count) AS current_relevance,
  COUNT(DISTINCT map.agent_name) AS unique_agent_accesses,
  AVG(map.similarity_score) AS avg_access_similarity,
  COUNT(CASE WHEN map.response_useful THEN 1 END)::FLOAT / NULLIF(COUNT(*), 0) AS usefulness_rate
FROM ai_memories m
LEFT JOIN memory_access_patterns map ON m.id = map.memory_id
GROUP BY m.id, m.service_id, m.memory_type, m.content, m.access_count, m.last_accessed, m.importance_score;

-- 4. CONTEXT ENRICHMENT FUNCTIONS
-- ================================

-- Function to enrich memories with technology stack mappings
CREATE OR REPLACE FUNCTION enrich_technology_mappings()
RETURNS INTEGER AS $$
DECLARE
  enriched_count INTEGER := 0;
  memory_record RECORD;
  tech_stack JSONB;
BEGIN
  FOR memory_record IN 
    SELECT id, content, metadata, service_id
    FROM ai_memories 
    WHERE metadata IS NULL OR NOT metadata ? 'technology_stack'
  LOOP
    -- Determine technology stack based on content
    tech_stack := jsonb_build_object(
      'primary', CASE 
        WHEN memory_record.service_id LIKE '%supabase%' THEN 'supabase'
        WHEN memory_record.service_id LIKE '%graphql%' THEN 'graphql'
        WHEN memory_record.service_id = 'agent-orchestration-system' THEN 'agent-systems'
        ELSE 'general'
      END,
      'related', ARRAY(
        SELECT DISTINCT unnest(ARRAY[
          CASE WHEN memory_record.content ILIKE '%postgres%' THEN 'postgresql' END,
          CASE WHEN memory_record.content ILIKE '%react%' THEN 'react' END,
          CASE WHEN memory_record.content ILIKE '%typescript%' THEN 'typescript' END,
          CASE WHEN memory_record.content ILIKE '%node%' THEN 'nodejs' END,
          CASE WHEN memory_record.content ILIKE '%docker%' THEN 'docker' END,
          CASE WHEN memory_record.content ILIKE '%kubernetes%' THEN 'kubernetes' END
        ]::TEXT[]) 
        WHERE unnest IS NOT NULL
      ),
      'patterns', ARRAY(
        SELECT DISTINCT unnest(ARRAY[
          CASE WHEN memory_record.content ILIKE '%api%' THEN 'api-design' END,
          CASE WHEN memory_record.content ILIKE '%database%' THEN 'database-design' END,
          CASE WHEN memory_record.content ILIKE '%cache%' THEN 'caching' END,
          CASE WHEN memory_record.content ILIKE '%auth%' THEN 'authentication' END,
          CASE WHEN memory_record.content ILIKE '%real%time%' THEN 'realtime' END
        ]::TEXT[])
        WHERE unnest IS NOT NULL
      )
    );
    
    -- Update metadata
    UPDATE ai_memories 
    SET metadata = COALESCE(metadata, '{}'::JSONB) || jsonb_build_object('technology_stack', tech_stack)
    WHERE id = memory_record.id;
    
    enriched_count := enriched_count + 1;
  END LOOP;
  
  RETURN enriched_count;
END;
$$ LANGUAGE plpgsql;

-- Function to add use case scenarios
CREATE OR REPLACE FUNCTION enrich_use_case_scenarios()
RETURNS INTEGER AS $$
DECLARE
  enriched_count INTEGER := 0;
  memory_record RECORD;
  use_cases JSONB;
BEGIN
  FOR memory_record IN 
    SELECT id, content, metadata, memory_type
    FROM ai_memories 
    WHERE metadata IS NULL OR NOT metadata ? 'use_cases'
  LOOP
    -- Generate use cases based on content patterns
    use_cases := jsonb_build_array();
    
    -- Supabase + GraphQL use case
    IF memory_record.content ILIKE '%supabase%' AND memory_record.content ILIKE '%graphql%' THEN
      use_cases := use_cases || jsonb_build_object(
        'scenario', 'Building a modern full-stack application',
        'technologies', ARRAY['supabase', 'graphql', 'typescript'],
        'complexity', 'intermediate'
      );
    END IF;
    
    -- Performance optimization use case
    IF memory_record.content ILIKE ANY(ARRAY['%performance%', '%optimize%', '%rerank%']) THEN
      use_cases := use_cases || jsonb_build_object(
        'scenario', 'Optimizing application performance',
        'technologies', ARRAY['caching', 'indexing', 'reranking'],
        'complexity', 'advanced'
      );
    END IF;
    
    -- Agent orchestration use case
    IF memory_record.memory_type LIKE '%agent%' THEN
      use_cases := use_cases || jsonb_build_object(
        'scenario', 'Building intelligent multi-agent systems',
        'technologies', ARRAY['ai-agents', 'orchestration', 'dspy'],
        'complexity', 'advanced'
      );
    END IF;
    
    IF jsonb_array_length(use_cases) > 0 THEN
      UPDATE ai_memories 
      SET metadata = COALESCE(metadata, '{}'::JSONB) || jsonb_build_object('use_cases', use_cases)
      WHERE id = memory_record.id;
      
      enriched_count := enriched_count + 1;
    END IF;
  END LOOP;
  
  RETURN enriched_count;
END;
$$ LANGUAGE plpgsql;

-- Function to assess performance impact
CREATE OR REPLACE FUNCTION enrich_performance_impact()
RETURNS INTEGER AS $$
DECLARE
  enriched_count INTEGER := 0;
  memory_record RECORD;
  performance_data JSONB;
BEGIN
  FOR memory_record IN 
    SELECT id, content, metadata
    FROM ai_memories 
    WHERE 
      (content ILIKE ANY(ARRAY['%performance%', '%optimize%', '%speed%', '%scale%', '%cache%']))
      AND (metadata IS NULL OR NOT metadata ? 'performance_impact')
  LOOP
    performance_data := jsonb_build_object(
      'impact_areas', ARRAY(
        SELECT DISTINCT unnest(ARRAY[
          CASE WHEN memory_record.content ILIKE '%query%' THEN 'query-performance' END,
          CASE WHEN memory_record.content ILIKE '%cache%' THEN 'caching-efficiency' END,
          CASE WHEN memory_record.content ILIKE '%index%' THEN 'indexing-strategy' END,
          CASE WHEN memory_record.content ILIKE '%load%' THEN 'load-management' END,
          CASE WHEN memory_record.content ILIKE '%scale%' THEN 'scalability' END
        ]::TEXT[])
        WHERE unnest IS NOT NULL
      ),
      'optimization_level', CASE 
        WHEN memory_record.content ILIKE '%micro%' THEN 'micro-optimization'
        WHEN memory_record.content ILIKE '%architect%' THEN 'architectural'
        ELSE 'tactical'
      END,
      'expected_improvement', CASE 
        WHEN memory_record.content ILIKE '%10x%' OR memory_record.content ILIKE '%order of magnitude%' THEN 'high'
        WHEN memory_record.content ILIKE '%significant%' OR memory_record.content ILIKE '%substantial%' THEN 'medium'
        ELSE 'incremental'
      END
    );
    
    UPDATE ai_memories 
    SET metadata = COALESCE(metadata, '{}'::JSONB) || jsonb_build_object('performance_impact', performance_data)
    WHERE id = memory_record.id;
    
    enriched_count := enriched_count + 1;
  END LOOP;
  
  RETURN enriched_count;
END;
$$ LANGUAGE plpgsql;

-- 5. INTELLIGENT DISCOVERY FUNCTIONS
-- ==================================

-- Function to discover learning paths
CREATE OR REPLACE FUNCTION discover_learning_paths(
  start_topic TEXT,
  target_skill_level TEXT DEFAULT 'advanced' -- 'beginner', 'intermediate', 'advanced'
)
RETURNS TABLE (
  path_id INTEGER,
  learning_sequence TEXT[],
  topics_covered TEXT[],
  estimated_complexity FLOAT,
  prerequisite_check JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH topic_memories AS (
    SELECT 
      m.id,
      m.content,
      m.service_id,
      CASE 
        WHEN m.content ILIKE ANY(ARRAY['%basic%', '%introduction%', '%getting started%']) THEN 1
        WHEN m.content ILIKE ANY(ARRAY['%intermediate%', '%implement%', '%build%']) THEN 2
        WHEN m.content ILIKE ANY(ARRAY['%advanced%', '%optimize%', '%scale%']) THEN 3
        ELSE 2
      END AS complexity_score,
      m.keywords
    FROM ai_memories m
    WHERE 
      m.content ILIKE '%' || start_topic || '%'
      OR start_topic = ANY(m.keywords)
  ),
  learning_paths AS (
    SELECT 
      ROW_NUMBER() OVER (ORDER BY AVG(complexity_score)) AS path_id,
      array_agg(content ORDER BY complexity_score) AS learning_sequence,
      array_agg(DISTINCT service_id) AS topics_covered,
      AVG(complexity_score) AS estimated_complexity,
      jsonb_build_object(
        'has_basics', bool_or(complexity_score = 1),
        'has_intermediate', bool_or(complexity_score = 2),
        'has_advanced', bool_or(complexity_score = 3)
      ) AS prerequisite_check
    FROM topic_memories
    GROUP BY CASE complexity_score 
      WHEN 1 THEN 'beginner'
      WHEN 2 THEN 'intermediate'
      WHEN 3 THEN 'advanced'
    END
  )
  SELECT * FROM learning_paths
  WHERE 
    CASE target_skill_level
      WHEN 'beginner' THEN estimated_complexity <= 1.5
      WHEN 'intermediate' THEN estimated_complexity BETWEEN 1.5 AND 2.5
      WHEN 'advanced' THEN estimated_complexity >= 2.5
    END
  ORDER BY path_id
  LIMIT 5;
END;
$$ LANGUAGE plpgsql;

-- 6. INITIALIZATION AND MAINTENANCE
-- =================================

-- Function to initialize all connections and enrichments
CREATE OR REPLACE FUNCTION initialize_enhanced_context_system()
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  supabase_graphql_connections INTEGER;
  reranking_connections INTEGER;
  agent_connections INTEGER;
  tech_mappings INTEGER;
  use_cases INTEGER;
  performance_impacts INTEGER;
BEGIN
  -- Create connections
  supabase_graphql_connections := connect_supabase_graphql_memories();
  reranking_connections := connect_reranking_memories();
  agent_connections := connect_agent_orchestration_memories();
  
  -- Enrich metadata
  tech_mappings := enrich_technology_mappings();
  use_cases := enrich_use_case_scenarios();
  performance_impacts := enrich_performance_impact();
  
  -- Auto-connect similar memories
  PERFORM auto_connect_similar_memories(0.75, 3);
  
  result := jsonb_build_object(
    'connections_created', jsonb_build_object(
      'supabase_graphql', supabase_graphql_connections,
      'reranking', reranking_connections,
      'agent_orchestration', agent_connections
    ),
    'enrichments_completed', jsonb_build_object(
      'technology_mappings', tech_mappings,
      'use_case_scenarios', use_cases,
      'performance_impacts', performance_impacts
    ),
    'status', 'success',
    'timestamp', NOW()
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for enhanced search performance
CREATE INDEX IF NOT EXISTS idx_memory_connections_strength ON memory_connections(strength DESC);
CREATE INDEX IF NOT EXISTS idx_memory_connections_type_strength ON memory_connections(connection_type, strength DESC);
CREATE INDEX IF NOT EXISTS idx_ai_memories_content_trgm ON ai_memories USING gin (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ai_memories_metadata_tech_stack ON ai_memories USING gin ((metadata->'technology_stack'));
CREATE INDEX IF NOT EXISTS idx_ai_memories_metadata_use_cases ON ai_memories USING gin ((metadata->'use_cases'));
CREATE INDEX IF NOT EXISTS idx_ai_memories_metadata_performance ON ai_memories USING gin ((metadata->'performance_impact'));

-- Grant permissions
GRANT EXECUTE ON FUNCTION search_across_domains TO authenticated, anon;
GRANT EXECUTE ON FUNCTION search_knowledge_graph TO authenticated, anon;
GRANT EXECUTE ON FUNCTION discover_learning_paths TO authenticated, anon;
GRANT EXECUTE ON FUNCTION initialize_enhanced_context_system TO authenticated;

GRANT SELECT ON memory_relationship_graph TO authenticated, anon;
GRANT SELECT ON knowledge_clusters TO authenticated, anon;
GRANT SELECT ON technology_cross_references TO authenticated, anon;
GRANT SELECT ON knowledge_usage_patterns TO authenticated, anon;

-- Initialize the system
SELECT initialize_enhanced_context_system();