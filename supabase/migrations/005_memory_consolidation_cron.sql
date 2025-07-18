-- Memory consolidation and maintenance using pg_cron

-- Function to consolidate similar memories
CREATE OR REPLACE FUNCTION consolidate_similar_memories()
RETURNS INTEGER AS $$
DECLARE
  consolidated_count INTEGER := 0;
  memory_group RECORD;
  consolidated_content TEXT;
  consolidated_metadata JSONB;
  new_memory_id UUID;
BEGIN
  -- Find groups of highly similar memories
  FOR memory_group IN
    WITH memory_pairs AS (
      SELECT 
        m1.id AS id1,
        m2.id AS id2,
        m1.content AS content1,
        m2.content AS content2,
        m1.metadata AS metadata1,
        m2.metadata AS metadata2,
        1 - (m1.embedding <=> m2.embedding) AS similarity,
        m1.created_at AS created1,
        m2.created_at AS created2
      FROM ai_memories m1
      JOIN ai_memories m2 ON m1.id < m2.id
      WHERE 
        m1.embedding IS NOT NULL 
        AND m2.embedding IS NOT NULL
        AND m1.service_id = m2.service_id
        AND 1 - (m1.embedding <=> m2.embedding) > 0.95
        AND m1.created_at > NOW() - INTERVAL '7 days'
    )
    SELECT 
      ARRAY_AGG(DISTINCT id1) || ARRAY_AGG(DISTINCT id2) AS memory_ids,
      STRING_AGG(DISTINCT content1 || E'\n' || content2, E'\n---\n') AS combined_content,
      jsonb_build_object(
        'consolidated_from', ARRAY_AGG(DISTINCT id1) || ARRAY_AGG(DISTINCT id2),
        'consolidation_date', NOW(),
        'original_count', COUNT(*)
      ) AS consolidation_metadata
    FROM memory_pairs
    GROUP BY similarity
    HAVING COUNT(*) >= 2
  LOOP
    -- Create consolidated memory
    consolidated_content := 'CONSOLIDATED MEMORY: ' || memory_group.combined_content;
    consolidated_metadata := memory_group.consolidation_metadata;
    
    -- Insert new consolidated memory
    INSERT INTO ai_memories (
      service_id,
      memory_type,
      content,
      metadata,
      importance_score,
      memory_category
    )
    SELECT 
      service_id,
      'consolidated',
      consolidated_content,
      metadata || consolidated_metadata,
      AVG(importance_score) * 1.2, -- Boost importance for consolidated memories
      'consolidated'
    FROM ai_memories
    WHERE id = ANY(memory_group.memory_ids)
    GROUP BY service_id, metadata
    RETURNING id INTO new_memory_id;
    
    -- Create connections to original memories
    INSERT INTO memory_connections (source_memory_id, target_memory_id, connection_type, strength)
    SELECT new_memory_id, unnest(memory_group.memory_ids), 'consolidation', 1.0;
    
    -- Mark original memories as consolidated
    UPDATE ai_memories
    SET 
      metadata = metadata || jsonb_build_object('consolidated_into', new_memory_id),
      importance_score = importance_score * 0.5
    WHERE id = ANY(memory_group.memory_ids);
    
    consolidated_count := consolidated_count + 1;
  END LOOP;
  
  RETURN consolidated_count;
END;
$$ LANGUAGE plpgsql;

-- Function to decay memory importance over time
CREATE OR REPLACE FUNCTION decay_memory_importance()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE ai_memories
  SET importance_score = calculate_importance_decay(
    importance_score,
    last_accessed,
    access_count
  )
  WHERE 
    last_accessed < NOW() - INTERVAL '7 days'
    OR last_accessed IS NULL;
    
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Function to prune low-value memories
CREATE OR REPLACE FUNCTION prune_low_value_memories()
RETURNS INTEGER AS $$
DECLARE
  pruned_count INTEGER;
BEGIN
  -- Archive memories before deletion
  INSERT INTO ai_memories_archive (
    original_id,
    service_id,
    memory_type,
    content,
    metadata,
    archived_at
  )
  SELECT 
    id,
    service_id,
    memory_type,
    content,
    metadata || jsonb_build_object('final_importance', importance_score, 'final_access_count', access_count),
    NOW()
  FROM ai_memories
  WHERE 
    importance_score < 0.1
    AND access_count < 3
    AND created_at < NOW() - INTERVAL '30 days'
    AND memory_type != 'consolidated';
  
  -- Delete low-value memories
  DELETE FROM ai_memories
  WHERE 
    importance_score < 0.1
    AND access_count < 3
    AND created_at < NOW() - INTERVAL '30 days'
    AND memory_type != 'consolidated';
    
  GET DIAGNOSTICS pruned_count = ROW_COUNT;
  RETURN pruned_count;
END;
$$ LANGUAGE plpgsql;

-- Create archive table for pruned memories
CREATE TABLE IF NOT EXISTS ai_memories_archive (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  original_id UUID NOT NULL,
  service_id TEXT NOT NULL,
  memory_type TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  archived_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to update memory clusters
CREATE OR REPLACE FUNCTION update_memory_clusters()
RETURNS INTEGER AS $$
DECLARE
  cluster_count INTEGER := 0;
  memory_record RECORD;
  nearest_cluster RECORD;
  new_cluster_id UUID;
BEGIN
  -- For each unclustered memory
  FOR memory_record IN
    SELECT m.id, m.embedding
    FROM ai_memories m
    LEFT JOIN memory_cluster_members mcm ON m.id = mcm.memory_id
    WHERE m.embedding IS NOT NULL AND mcm.id IS NULL
    LIMIT 100 -- Process in batches
  LOOP
    -- Find nearest cluster
    SELECT 
      c.id,
      c.centroid_embedding,
      1 - (c.centroid_embedding <=> memory_record.embedding) AS similarity
    INTO nearest_cluster
    FROM memory_clusters c
    WHERE c.centroid_embedding IS NOT NULL
    ORDER BY c.centroid_embedding <=> memory_record.embedding
    LIMIT 1;
    
    IF nearest_cluster.similarity > 0.8 THEN
      -- Add to existing cluster
      INSERT INTO memory_cluster_members (cluster_id, memory_id, distance_from_centroid)
      VALUES (nearest_cluster.id, memory_record.id, 1 - nearest_cluster.similarity);
      
      -- Update cluster stats
      UPDATE memory_clusters
      SET member_count = member_count + 1
      WHERE id = nearest_cluster.id;
    ELSE
      -- Create new cluster
      INSERT INTO memory_clusters (cluster_name, centroid_embedding, member_count)
      VALUES (
        'auto_cluster_' || to_char(NOW(), 'YYYYMMDD_HH24MISS'),
        memory_record.embedding,
        1
      )
      RETURNING id INTO new_cluster_id;
      
      -- Add memory to new cluster
      INSERT INTO memory_cluster_members (cluster_id, memory_id, distance_from_centroid)
      VALUES (new_cluster_id, memory_record.id, 0);
      
      cluster_count := cluster_count + 1;
    END IF;
  END LOOP;
  
  RETURN cluster_count;
END;
$$ LANGUAGE plpgsql;

-- Function to generate memory summaries
CREATE OR REPLACE FUNCTION generate_memory_summaries()
RETURNS INTEGER AS $$
DECLARE
  summary_count INTEGER := 0;
  cluster_record RECORD;
  summary_content TEXT;
BEGIN
  -- For each cluster with enough members
  FOR cluster_record IN
    SELECT 
      c.id,
      c.cluster_name,
      ARRAY_AGG(m.content ORDER BY m.importance_score DESC) AS contents,
      COUNT(*) AS member_count
    FROM memory_clusters c
    JOIN memory_cluster_members mcm ON c.id = mcm.cluster_id
    JOIN ai_memories m ON mcm.memory_id = m.id
    WHERE c.metadata->>'has_summary' IS NULL
    GROUP BY c.id, c.cluster_name
    HAVING COUNT(*) >= 5
  LOOP
    -- Create summary (in production, this would call an LLM)
    summary_content := format(
      'CLUSTER SUMMARY: %s (contains %s memories)',
      cluster_record.cluster_name,
      cluster_record.member_count
    );
    
    -- Store summary as a special memory
    INSERT INTO ai_memories (
      service_id,
      memory_type,
      content,
      metadata,
      importance_score,
      memory_category
    ) VALUES (
      'memory_system',
      'cluster_summary',
      summary_content,
      jsonb_build_object(
        'cluster_id', cluster_record.id,
        'member_count', cluster_record.member_count,
        'generated_at', NOW()
      ),
      0.8,
      'summary'
    );
    
    -- Mark cluster as summarized
    UPDATE memory_clusters
    SET metadata = metadata || jsonb_build_object('has_summary', true)
    WHERE id = cluster_record.id;
    
    summary_count := summary_count + 1;
  END LOOP;
  
  RETURN summary_count;
END;
$$ LANGUAGE plpgsql;

-- Master maintenance function
CREATE OR REPLACE FUNCTION perform_memory_maintenance()
RETURNS JSONB AS $$
DECLARE
  decay_count INTEGER;
  consolidation_count INTEGER;
  prune_count INTEGER;
  cluster_count INTEGER;
  summary_count INTEGER;
  connection_count INTEGER;
BEGIN
  -- Run all maintenance tasks
  decay_count := decay_memory_importance();
  consolidation_count := consolidate_similar_memories();
  prune_count := prune_low_value_memories();
  cluster_count := update_memory_clusters();
  summary_count := generate_memory_summaries();
  connection_count := auto_connect_similar_memories(0.85, 3);
  
  -- Log maintenance results
  INSERT INTO ai_agent_logs (
    agent_name,
    action,
    request,
    response,
    success
  ) VALUES (
    'memory_maintenance',
    'scheduled_maintenance',
    'Automated memory maintenance',
    jsonb_build_object(
      'decay_count', decay_count,
      'consolidation_count', consolidation_count,
      'prune_count', prune_count,
      'cluster_count', cluster_count,
      'summary_count', summary_count,
      'connection_count', connection_count
    ),
    true
  );
  
  RETURN jsonb_build_object(
    'timestamp', NOW(),
    'decay_count', decay_count,
    'consolidation_count', consolidation_count,
    'prune_count', prune_count,
    'cluster_count', cluster_count,
    'summary_count', summary_count,
    'connection_count', connection_count
  );
END;
$$ LANGUAGE plpgsql;

-- Schedule cron jobs for memory maintenance
-- Note: These need to be run by a superuser or through Supabase dashboard

-- Daily memory importance decay (run at 2 AM)
SELECT cron.schedule(
  'decay-memory-importance',
  '0 2 * * *',
  $$SELECT decay_memory_importance();$$
);

-- Weekly memory consolidation (run on Sundays at 3 AM)
SELECT cron.schedule(
  'consolidate-memories',
  '0 3 * * 0',
  $$SELECT consolidate_similar_memories();$$
);

-- Monthly memory pruning (run on 1st of each month at 4 AM)
SELECT cron.schedule(
  'prune-memories',
  '0 4 1 * *',
  $$SELECT prune_low_value_memories();$$
);

-- Daily cluster updates (run at 1 AM)
SELECT cron.schedule(
  'update-clusters',
  '0 1 * * *',
  $$SELECT update_memory_clusters();$$
);

-- Weekly full maintenance (run on Sundays at 5 AM)
SELECT cron.schedule(
  'full-memory-maintenance',
  '0 5 * * 0',
  $$SELECT perform_memory_maintenance();$$
);