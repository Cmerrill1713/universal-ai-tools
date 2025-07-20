-- Continuous Learning Infrastructure Tables
-- Supports automated knowledge source tracking and updates

-- Table for tracking knowledge sources
CREATE TABLE IF NOT EXISTS knowledge_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('documentation', 'code_repository', 'api_reference', 'blog', 'research_paper', 'manual', 'video', 'conversation')),
  source_url TEXT,
  source_description TEXT,
  crawl_frequency TEXT DEFAULT 'weekly' CHECK (crawl_frequency IN ('hourly', 'daily', 'weekly', 'monthly', 'manual')),
  last_crawled TIMESTAMPTZ,
  next_scheduled_crawl TIMESTAMPTZ,
  crawl_status TEXT DEFAULT 'pending' CHECK (crawl_status IN ('pending', 'running', 'completed', 'failed', 'disabled')),
  content_hash TEXT, -- For change detection
  metadata JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT DEFAULT 'system',
  -- Indexing for efficient queries
  UNIQUE(source_name, source_type)
);

-- Table for tracking knowledge updates and changes
CREATE TABLE IF NOT EXISTS knowledge_updates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  update_type TEXT NOT NULL CHECK (update_type IN ('new_content', 'content_modified', 'content_deleted', 'metadata_updated', 'structure_changed')),
  change_summary TEXT,
  content_diff JSONB, -- Structured diff of changes
  affected_memories UUID[], -- Array of memory IDs that were updated
  new_memories_created INTEGER DEFAULT 0,
  memories_updated INTEGER DEFAULT 0,
  memories_deleted INTEGER DEFAULT 0,
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  processing_details JSONB DEFAULT '{}',
  confidence_score FLOAT DEFAULT 0.5 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processing_time_ms INTEGER,
  created_by TEXT DEFAULT 'system'
);

-- Table for learning patterns and improvement tracking
CREATE TABLE IF NOT EXISTS learning_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('search_frequency', 'topic_clustering', 'knowledge_gap', 'user_preference', 'temporal_access')),
  pattern_data JSONB NOT NULL,
  confidence FLOAT DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  impact_score FLOAT DEFAULT 0.5 CHECK (impact_score >= 0 AND impact_score <= 1),
  observations_count INTEGER DEFAULT 1,
  first_observed TIMESTAMPTZ DEFAULT NOW(),
  last_observed TIMESTAMPTZ DEFAULT NOW(),
  agent_context TEXT,
  metadata JSONB DEFAULT '{}',
  is_actionable BOOLEAN DEFAULT false,
  action_taken TEXT,
  action_result JSONB
);

-- Table for knowledge quality metrics
CREATE TABLE IF NOT EXISTS knowledge_quality_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  memory_id UUID REFERENCES ai_memories(id) ON DELETE CASCADE,
  source_id UUID REFERENCES knowledge_sources(id) ON DELETE SET NULL,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('accuracy', 'completeness', 'relevance', 'freshness', 'clarity', 'usefulness')),
  metric_value FLOAT NOT NULL CHECK (metric_value >= 0 AND metric_value <= 1),
  measurement_method TEXT NOT NULL, -- How the metric was calculated
  measured_at TIMESTAMPTZ DEFAULT NOW(),
  measured_by TEXT DEFAULT 'system',
  context JSONB DEFAULT '{}',
  -- Composite index for efficient time-series queries
  UNIQUE(memory_id, metric_type, measured_at)
);

-- Table for automated improvement suggestions
CREATE TABLE IF NOT EXISTS improvement_suggestions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  suggestion_type TEXT NOT NULL CHECK (suggestion_type IN ('content_enhancement', 'knowledge_gap', 'connection_creation', 'metadata_improvement', 'reorganization', 'deprecation')),
  target_type TEXT NOT NULL CHECK (target_type IN ('memory', 'source', 'cluster', 'connection', 'metadata')),
  target_id UUID, -- Can reference various tables
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  suggestion_text TEXT NOT NULL,
  rationale TEXT,
  proposed_changes JSONB,
  confidence FLOAT DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  estimated_impact FLOAT DEFAULT 0.5 CHECK (estimated_impact >= 0 AND estimated_impact <= 1),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'implemented', 'rejected', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  implemented_at TIMESTAMPTZ,
  implementation_result JSONB
);

-- Create indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_active ON knowledge_sources(is_active, next_scheduled_crawl);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_type ON knowledge_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_tags ON knowledge_sources USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_metadata ON knowledge_sources USING gin(metadata);

CREATE INDEX IF NOT EXISTS idx_knowledge_updates_source ON knowledge_updates(source_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_updates_status ON knowledge_updates(processing_status, created_at);
CREATE INDEX IF NOT EXISTS idx_knowledge_updates_type ON knowledge_updates(update_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_updates_memories ON knowledge_updates USING gin(affected_memories);

CREATE INDEX IF NOT EXISTS idx_learning_patterns_type ON learning_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_learning_patterns_actionable ON learning_patterns(is_actionable, impact_score DESC);
CREATE INDEX IF NOT EXISTS idx_learning_patterns_agent ON learning_patterns(agent_context);
CREATE INDEX IF NOT EXISTS idx_learning_patterns_time ON learning_patterns(last_observed DESC);

CREATE INDEX IF NOT EXISTS idx_quality_metrics_memory ON knowledge_quality_metrics(memory_id);
CREATE INDEX IF NOT EXISTS idx_quality_metrics_type_time ON knowledge_quality_metrics(metric_type, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_quality_metrics_source ON knowledge_quality_metrics(source_id);

CREATE INDEX IF NOT EXISTS idx_improvement_suggestions_target ON improvement_suggestions(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_improvement_suggestions_priority ON improvement_suggestions(status, priority DESC);
CREATE INDEX IF NOT EXISTS idx_improvement_suggestions_type ON improvement_suggestions(suggestion_type);

-- Update triggers for timestamp management
CREATE TRIGGER update_knowledge_sources_updated_at 
  BEFORE UPDATE ON knowledge_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to schedule next crawl based on frequency
CREATE OR REPLACE FUNCTION schedule_next_crawl()
RETURNS TRIGGER AS $$
BEGIN
  NEW.next_scheduled_crawl := CASE NEW.crawl_frequency
    WHEN 'hourly' THEN NOW() + INTERVAL '1 hour'
    WHEN 'daily' THEN NOW() + INTERVAL '1 day'
    WHEN 'weekly' THEN NOW() + INTERVAL '1 week'
    WHEN 'monthly' THEN NOW() + INTERVAL '1 month'
    ELSE NULL -- manual scheduling
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_schedule_next_crawl
  BEFORE INSERT OR UPDATE ON knowledge_sources
  FOR EACH ROW
  WHEN (NEW.crawl_frequency != 'manual')
  EXECUTE FUNCTION schedule_next_crawl();

-- Function to calculate knowledge freshness
CREATE OR REPLACE FUNCTION calculate_knowledge_freshness(memory_id UUID)
RETURNS FLOAT AS $$
DECLARE
  memory_created TIMESTAMPTZ;
  last_source_update TIMESTAMPTZ;
  days_since_creation FLOAT;
  days_since_update FLOAT;
  freshness_score FLOAT;
BEGIN
  -- Get memory creation time
  SELECT created_at INTO memory_created
  FROM ai_memories WHERE id = memory_id;
  
  -- Get last source update (if available)
  SELECT MAX(ku.created_at) INTO last_source_update
  FROM knowledge_updates ku
  WHERE memory_id = ANY(ku.affected_memories);
  
  -- Calculate freshness based on time decay
  days_since_creation := EXTRACT(EPOCH FROM NOW() - memory_created) / 86400.0;
  
  IF last_source_update IS NOT NULL THEN
    days_since_update := EXTRACT(EPOCH FROM NOW() - last_source_update) / 86400.0;
    -- Use the more recent timestamp for freshness calculation
    freshness_score := EXP(-LEAST(days_since_creation, days_since_update) / 30.0);
  ELSE
    freshness_score := EXP(-days_since_creation / 30.0);
  END IF;
  
  RETURN LEAST(GREATEST(freshness_score, 0.0), 1.0);
END;
$$ LANGUAGE plpgsql;

-- Function to detect knowledge gaps
CREATE OR REPLACE FUNCTION detect_knowledge_gaps()
RETURNS TABLE (
  topic TEXT,
  gap_type TEXT,
  gap_description TEXT,
  suggested_sources TEXT[],
  priority INTEGER,
  evidence JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH topic_analysis AS (
    -- Analyze search patterns vs available knowledge
    SELECT 
      COALESCE(m.memory_type, 'unknown') as topic_area,
      COUNT(m.id) as available_memories,
      AVG(m.importance_score) as avg_importance,
      -- Mock search frequency data (would come from search logs in production)
      CASE 
        WHEN COALESCE(m.memory_type, 'unknown') LIKE '%supabase%' THEN 25
        WHEN COALESCE(m.memory_type, 'unknown') LIKE '%graphql%' THEN 18
        WHEN COALESCE(m.memory_type, 'unknown') LIKE '%agent%' THEN 15
        ELSE 5
      END as search_frequency
    FROM ai_memories m
    GROUP BY m.memory_type
  ),
  gap_analysis AS (
    SELECT 
      ta.topic_area,
      CASE 
        WHEN ta.available_memories < 3 AND ta.search_frequency > 10 THEN 'insufficient_coverage'
        WHEN ta.avg_importance < 0.6 THEN 'low_quality_content'
        WHEN ta.available_memories = 0 THEN 'missing_topic'
        ELSE 'adequate'
      END as gap_type,
      ta.available_memories,
      ta.search_frequency,
      ta.avg_importance
    FROM topic_analysis ta
  )
  SELECT 
    ga.topic_area as topic,
    ga.gap_type,
    CASE ga.gap_type
      WHEN 'insufficient_coverage' THEN 'High search demand but limited knowledge available'
      WHEN 'low_quality_content' THEN 'Available content has low importance scores'
      WHEN 'missing_topic' THEN 'No knowledge available for searched topic'
      ELSE 'Knowledge coverage appears adequate'
    END as gap_description,
    CASE ga.topic_area
      WHEN 'supabase_rls_best_practices' THEN ARRAY['https://supabase.com/docs/guides/auth/row-level-security']
      WHEN 'graphql_apollo_server' THEN ARRAY['https://www.apollographql.com/docs/apollo-server/']
      ELSE ARRAY['https://docs.example.com/' || ga.topic_area]
    END as suggested_sources,
    CASE ga.gap_type
      WHEN 'missing_topic' THEN 10
      WHEN 'insufficient_coverage' THEN 8
      WHEN 'low_quality_content' THEN 6
      ELSE 3
    END as priority,
    jsonb_build_object(
      'availableMemories', ga.available_memories,
      'searchFrequency', ga.search_frequency,
      'avgImportance', ROUND(ga.avg_importance::numeric, 3)
    ) as evidence
  FROM gap_analysis ga
  WHERE ga.gap_type != 'adequate'
  ORDER BY priority DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get learning system health
CREATE OR REPLACE FUNCTION get_learning_system_health()
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  active_sources INT;
  pending_updates INT;
  recent_learning_events INT;
  avg_quality FLOAT;
BEGIN
  -- Count active sources
  SELECT COUNT(*) INTO active_sources
  FROM knowledge_sources WHERE is_active = true;
  
  -- Count pending updates
  SELECT COUNT(*) INTO pending_updates
  FROM knowledge_updates WHERE processing_status = 'pending';
  
  -- Count recent learning events (last 24 hours)
  SELECT COUNT(*) INTO recent_learning_events
  FROM learning_patterns WHERE last_observed > NOW() - INTERVAL '24 hours';
  
  -- Calculate average quality metrics
  SELECT AVG(metric_value) INTO avg_quality
  FROM knowledge_quality_metrics 
  WHERE measured_at > NOW() - INTERVAL '7 days';
  
  SELECT jsonb_build_object(
    'systemStatus', CASE 
      WHEN active_sources > 0 AND pending_updates < 10 THEN 'healthy'
      WHEN active_sources > 0 THEN 'degraded'
      ELSE 'critical'
    END,
    'activeSources', COALESCE(active_sources, 0),
    'pendingUpdates', COALESCE(pending_updates, 0),
    'recentLearningEvents', COALESCE(recent_learning_events, 0),
    'avgQualityScore', ROUND(COALESCE(avg_quality, 0.0)::numeric, 3),
    'recommendations', CASE 
      WHEN active_sources = 0 THEN jsonb_build_array('Add knowledge sources to enable continuous learning')
      WHEN pending_updates > 20 THEN jsonb_build_array('Review pending updates - processing may be stalled')
      WHEN avg_quality < 0.5 THEN jsonb_build_array('Quality scores are low - review content sources')
      ELSE jsonb_build_array('System operating normally')
    END,
    'lastUpdated', NOW()
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT ALL ON knowledge_sources TO authenticated, anon;
GRANT ALL ON knowledge_updates TO authenticated, anon;
GRANT ALL ON learning_patterns TO authenticated, anon;
GRANT ALL ON knowledge_quality_metrics TO authenticated, anon;
GRANT ALL ON improvement_suggestions TO authenticated, anon;

GRANT EXECUTE ON FUNCTION calculate_knowledge_freshness TO authenticated, anon;
GRANT EXECUTE ON FUNCTION detect_knowledge_gaps TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_learning_system_health TO authenticated, anon;