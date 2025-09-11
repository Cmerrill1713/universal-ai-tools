-- Enhanced GraphQL Schema with Temporal Knowledge Graph Support
-- This migration creates a comprehensive GraphQL schema for AI agent coordination

-- Enable pg_graphql extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_graphql;

-- GraphQL views will be created in public schema for now
-- (graphql_public schema requires additional setup in Supabase)

-- ============================================================================
-- TEMPORAL KNOWLEDGE GRAPH CORE TABLES
-- ============================================================================

-- Knowledge entities (nodes in the knowledge graph)
CREATE TABLE IF NOT EXISTS knowledge_entities (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    entity_type TEXT NOT NULL, -- 'agent', 'memory', 'task', 'concept', 'relationship'
    name TEXT NOT NULL,
    description TEXT,
    properties JSONB DEFAULT '{}',
    embedding VECTOR(1536),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_to TIMESTAMPTZ DEFAULT NULL, -- NULL means currently valid
    version_id UUID DEFAULT uuid_generate_v4(),
    previous_version_id UUID
);

-- Knowledge relationships (edges in the knowledge graph)
CREATE TABLE IF NOT EXISTS knowledge_relationships (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    source_entity_id UUID NOT NULL,
    target_entity_id UUID NOT NULL,
    relationship_type TEXT NOT NULL, -- 'depends_on', 'related_to', 'conflicts_with', 'enables', 'requires'
    strength FLOAT DEFAULT 0.5 CHECK (strength >= 0 AND strength <= 1),
    confidence FLOAT DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
    properties JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_to TIMESTAMPTZ DEFAULT NULL,
    version_id UUID DEFAULT uuid_generate_v4(),
    previous_version_id UUID
);

-- Knowledge events for temporal tracking
CREATE TABLE IF NOT EXISTS knowledge_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    event_type TEXT NOT NULL, -- 'entity_created', 'entity_updated', 'entity_deleted', 'relationship_created', etc.
    entity_id UUID,
    relationship_id UUID,
    agent_id TEXT,
    event_data JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    causal_event_id UUID REFERENCES knowledge_events(id) -- What caused this event
);

-- Indexes for performance
CREATE INDEX idx_knowledge_entities_type ON knowledge_entities(entity_type);
CREATE INDEX idx_knowledge_entities_valid_time ON knowledge_entities(valid_from, valid_to);
CREATE INDEX idx_knowledge_entities_embedding ON knowledge_entities USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_knowledge_relationships_source ON knowledge_relationships(source_entity_id);
CREATE INDEX idx_knowledge_relationships_target ON knowledge_relationships(target_entity_id);
CREATE INDEX idx_knowledge_relationships_type ON knowledge_relationships(relationship_type);
CREATE INDEX idx_knowledge_relationships_valid_time ON knowledge_relationships(valid_from, valid_to);
CREATE INDEX idx_knowledge_events_timestamp ON knowledge_events(timestamp);
CREATE INDEX idx_knowledge_events_entity ON knowledge_events(entity_id);

-- ============================================================================
-- ENSURE AGENTS TABLE EXISTS (compatibility with existing codebase)
-- ============================================================================

-- Create a minimal agents table if it doesn't exist (references ai_agents from other migrations)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ai_agents') THEN
        CREATE TABLE ai_agents (
            id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            capabilities TEXT[] DEFAULT '{}',
            instructions TEXT,
            model TEXT DEFAULT 'llama3.2:3b',
            status TEXT DEFAULT 'active',
            priority INTEGER DEFAULT 1,
            last_active TIMESTAMPTZ DEFAULT NOW(),
            is_active BOOLEAN DEFAULT true,
            created_by TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        CREATE INDEX idx_ai_agents_name ON ai_agents(name);
        CREATE INDEX idx_ai_agents_active ON ai_agents(is_active);
        CREATE INDEX idx_ai_agents_created_by ON ai_agents(created_by);
        
        RAISE NOTICE 'Created ai_agents table for GraphQL compatibility';
    ELSE
        RAISE NOTICE 'ai_agents table already exists';
    END IF;
END $$;

-- ============================================================================
-- GRAPHQL VIEWS FOR OPTIMIZED QUERIES
-- ============================================================================

-- Agent summary view optimized for GraphQL
CREATE OR REPLACE VIEW public.agent_summary AS
SELECT 
    a.id,
    a.name,
    a.status,
    a.priority,
    a.last_active,
    a.created_at,
    COUNT(DISTINCT m.id) as memory_count,
    AVG(m.importance_score) as avg_memory_importance,
    COUNT(DISTINCT ke.id) as knowledge_entity_count,
    MAX(m.created_at) as last_memory_created
FROM ai_agents a
LEFT JOIN ai_memories m ON a.id::text = m.service_id
LEFT JOIN knowledge_entities ke ON ke.entity_type = 'agent' AND ke.name = a.name
WHERE a.is_active = true
GROUP BY a.id, a.name, a.status, a.priority, a.last_active, a.created_at;

-- Memory connections view for graph traversal
CREATE OR REPLACE VIEW public.memory_graph AS
SELECT 
    m.id,
    m.content,
    m.importance_score as importance,
    m.service_id as agent_id,
    m.created_at,
    m.embedding,
    COALESCE(
        (SELECT json_agg(
            json_build_object(
                'target_id', mc.target_memory_id,
                'type', mc.connection_type,
                'strength', mc.strength,
                'target_content', tm.content
            )
        )
        FROM memory_connections mc
        JOIN ai_memories tm ON mc.target_memory_id = tm.id
        WHERE mc.source_memory_id = m.id),
        '[]'::json
    ) as connections
FROM ai_memories m;

-- Temporal knowledge snapshot view
CREATE OR REPLACE VIEW public.current_knowledge_snapshot AS
SELECT 
    'entity' as item_type,
    ke.id,
    ke.entity_type as type,
    ke.name,
    ke.description,
    ke.properties,
    ke.created_at,
    ke.updated_at,
    NULL as source_id,
    NULL as target_id,
    NULL as strength
FROM knowledge_entities ke
WHERE ke.valid_to IS NULL -- Currently valid
UNION ALL
SELECT 
    'relationship' as item_type,
    kr.id,
    kr.relationship_type as type,
    kr.relationship_type as name,
    NULL as description,
    kr.properties,
    kr.created_at,
    kr.updated_at,
    kr.source_entity_id as source_id,
    kr.target_entity_id as target_id,
    kr.strength
FROM knowledge_relationships kr
WHERE kr.valid_to IS NULL; -- Currently valid

-- Agent performance metrics view
CREATE OR REPLACE VIEW public.agent_performance AS
SELECT 
    a.id as agent_id,
    a.name as agent_name,
    COUNT(CASE WHEN m.importance_score > 0.7 THEN 1 END) as high_importance_memories,
    COUNT(m.id) as total_memories,
    AVG(m.importance_score) as avg_memory_importance,
    COUNT(DISTINCT DATE(m.created_at)) as active_days,
    EXTRACT(EPOCH FROM (MAX(m.created_at) - MIN(m.created_at))) / 86400 as lifespan_days,
    COUNT(m.id)::float / NULLIF(EXTRACT(EPOCH FROM (MAX(m.created_at) - MIN(m.created_at))) / 86400, 0) as memories_per_day
FROM ai_agents a
LEFT JOIN ai_memories m ON a.id::text = m.service_id
GROUP BY a.id, a.name;

-- ============================================================================
-- TEMPORAL KNOWLEDGE GRAPH FUNCTIONS
-- ============================================================================

-- Get knowledge snapshot at specific time
CREATE OR REPLACE FUNCTION public.knowledge_snapshot_at_time(
    target_time TIMESTAMPTZ
)
RETURNS TABLE (
    item_type TEXT,
    id UUID,
    type TEXT,
    name TEXT,
    description TEXT,
    properties JSONB,
    source_id UUID,
    target_id UUID,
    strength FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'entity'::TEXT as item_type,
        ke.id,
        ke.entity_type as type,
        ke.name,
        ke.description,
        ke.properties,
        NULL::UUID as source_id,
        NULL::UUID as target_id,
        NULL::FLOAT as strength
    FROM knowledge_entities ke
    WHERE ke.valid_from <= target_time 
      AND (ke.valid_to IS NULL OR ke.valid_to > target_time)
    UNION ALL
    SELECT 
        'relationship'::TEXT as item_type,
        kr.id,
        kr.relationship_type as type,
        kr.relationship_type as name,
        NULL::TEXT as description,
        kr.properties,
        kr.source_entity_id as source_id,
        kr.target_entity_id as target_id,
        kr.strength
    FROM knowledge_relationships kr
    WHERE kr.valid_from <= target_time 
      AND (kr.valid_to IS NULL OR kr.valid_to > target_time);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get knowledge evolution over time period
CREATE OR REPLACE FUNCTION public.knowledge_evolution(
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ
)
RETURNS TABLE (
    event_id UUID,
    event_type TEXT,
    event_timestamp TIMESTAMPTZ,
    entity_id UUID,
    relationship_id UUID,
    agent_id TEXT,
    event_data JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ke.id as event_id,
        ke.event_type,
        ke.timestamp as event_timestamp,
        ke.entity_id,
        ke.relationship_id,
        ke.agent_id,
        ke.event_data
    FROM knowledge_events ke
    WHERE ke.timestamp >= start_time 
      AND ke.timestamp <= end_time
    ORDER BY ke.timestamp ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Search knowledge entities by embedding similarity with reranking
CREATE OR REPLACE FUNCTION public.search_knowledge_entities(
    query_embedding VECTOR(1536),
    similarity_threshold FLOAT DEFAULT 0.7,
    limit_count INT DEFAULT 10,
    query_text TEXT DEFAULT NULL,
    enable_reranking BOOLEAN DEFAULT FALSE,
    rerank_method TEXT DEFAULT 'hybrid'
)
RETURNS TABLE (
    id UUID,
    entity_type TEXT,
    name TEXT,
    description TEXT,
    properties JSONB,
    similarity FLOAT,
    rerank_score FLOAT,
    rerank_method TEXT
) AS $$
BEGIN
    IF enable_reranking AND query_text IS NOT NULL THEN
        -- Reranked search with text query
        RETURN QUERY
        WITH base_search AS (
            SELECT 
                ke.id,
                ke.entity_type,
                ke.name,
                ke.description,
                ke.properties,
                ke.created_at,
                1 - (ke.embedding <=> query_embedding) as base_similarity
            FROM knowledge_entities ke
            WHERE ke.valid_to IS NULL
              AND ke.embedding IS NOT NULL
              AND 1 - (ke.embedding <=> query_embedding) > (similarity_threshold * 0.8) -- Lower threshold for reranking pool
            ORDER BY ke.embedding <=> query_embedding
            LIMIT (limit_count * 2)
        ),
        reranked AS (
            SELECT 
                b.*,
                CASE rerank_method
                    WHEN 'cross_encoder' THEN 
                        b.base_similarity * 0.4 + (
                            -- Text-based cross-encoder simulation
                            GREATEST(
                                COALESCE(similarity(query_text, b.name), 0),
                                COALESCE(similarity(query_text, COALESCE(b.description, '')), 0)
                            ) * 0.6
                        )
                    WHEN 'feature_based' THEN
                        b.base_similarity * 0.5 + (
                            -- Feature-based scoring for entities
                            (CASE WHEN position(lower(query_text) in lower(b.name)) > 0 THEN 0.4 ELSE 0.0 END) +
                            (CASE WHEN position(lower(query_text) in lower(COALESCE(b.description, ''))) > 0 THEN 0.3 ELSE 0.0 END) +
                            (EXP(-EXTRACT(EPOCH FROM (NOW() - b.created_at)) / 86400.0 / 30.0) * 0.2) +
                            (CASE WHEN b.entity_type IN ('agent', 'memory', 'task') THEN 0.1 ELSE 0.0 END)
                        ) * 0.5
                    WHEN 'hybrid' THEN
                        b.base_similarity * 0.3 + (
                            -- Hybrid approach for knowledge entities
                            GREATEST(
                                COALESCE(similarity(query_text, b.name), 0),
                                COALESCE(similarity(query_text, COALESCE(b.description, '')), 0)
                            ) * 0.4 +
                            (CASE WHEN position(lower(query_text) in lower(b.name)) > 0 THEN 0.2 ELSE 0.0 END) +
                            (CASE WHEN position(lower(query_text) in lower(COALESCE(b.description, ''))) > 0 THEN 0.15 ELSE 0.0 END) +
                            (EXP(-EXTRACT(EPOCH FROM (NOW() - b.created_at)) / 86400.0 / 30.0) * 0.15) +
                            (CASE WHEN b.entity_type IN ('agent', 'memory', 'task') THEN 0.1 ELSE 0.0 END)
                        ) * 0.7
                    ELSE b.base_similarity
                END as rerank_score
            FROM base_search b
        )
        SELECT 
            r.id,
            r.entity_type,
            r.name,
            r.description,
            r.properties,
            r.rerank_score as similarity,
            r.rerank_score,
            rerank_method::TEXT as rerank_method
        FROM reranked r
        WHERE r.rerank_score > similarity_threshold
        ORDER BY r.rerank_score DESC
        LIMIT limit_count;
    ELSE
        -- Standard embedding-only search
        RETURN QUERY
        SELECT 
            ke.id,
            ke.entity_type,
            ke.name,
            ke.description,
            ke.properties,
            1 - (ke.embedding <=> query_embedding) as similarity,
            0.0 as rerank_score,
            'none'::TEXT as rerank_method
        FROM knowledge_entities ke
        WHERE ke.valid_to IS NULL
          AND ke.embedding IS NOT NULL
          AND 1 - (ke.embedding <=> query_embedding) > similarity_threshold
        ORDER BY ke.embedding <=> query_embedding
        LIMIT limit_count;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Find connected entities (graph traversal)
CREATE OR REPLACE FUNCTION public.find_connected_entities(
    start_entity_id UUID,
    max_depth INT DEFAULT 3,
    relationship_types TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    entity_id UUID,
    entity_name TEXT,
    entity_type TEXT,
    path_length INT,
    relationship_path TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE entity_paths AS (
        -- Base case: start entity
        SELECT 
            start_entity_id as entity_id,
            ke.name as entity_name,
            ke.entity_type,
            0 as path_length,
            ARRAY[]::TEXT[] as relationship_path
        FROM knowledge_entities ke
        WHERE ke.id = start_entity_id
          AND ke.valid_to IS NULL
        
        UNION
        
        -- Recursive case: follow relationships
        SELECT 
            CASE 
                WHEN kr.source_entity_id = ep.entity_id THEN kr.target_entity_id
                ELSE kr.source_entity_id
            END as entity_id,
            ke.name as entity_name,
            ke.entity_type,
            ep.path_length + 1,
            ep.relationship_path || kr.relationship_type
        FROM entity_paths ep
        JOIN knowledge_relationships kr ON (
            kr.source_entity_id = ep.entity_id OR kr.target_entity_id = ep.entity_id
        )
        JOIN knowledge_entities ke ON ke.id = CASE 
            WHEN kr.source_entity_id = ep.entity_id THEN kr.target_entity_id
            ELSE kr.source_entity_id
        END
        WHERE kr.valid_to IS NULL
          AND ke.valid_to IS NULL
          AND ep.path_length < max_depth
          AND (relationship_types IS NULL OR kr.relationship_type = ANY(relationship_types))
          AND ke.id != ALL(
              SELECT unnest(string_to_array(array_to_string(ep.relationship_path || ke.id::TEXT, ','), ','))::UUID
          ) -- Prevent cycles
    )
    SELECT DISTINCT
        ep.entity_id,
        ep.entity_name,
        ep.entity_type,
        ep.path_length,
        ep.relationship_path
    FROM entity_paths ep
    ORDER BY ep.path_length, ep.entity_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced memory search with temporal context and reranking support
CREATE OR REPLACE FUNCTION public.search_memories_with_context(
    query_text TEXT,
    agent_id TEXT DEFAULT NULL,
    importance_threshold FLOAT DEFAULT 0.3,
    limit_count INT DEFAULT 10,
    temporal_weight FLOAT DEFAULT 0.3,
    enable_reranking BOOLEAN DEFAULT FALSE,
    rerank_method TEXT DEFAULT 'hybrid'
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    importance FLOAT,
    agent_id TEXT,
    created_at TIMESTAMPTZ,
    relevance_score FLOAT,
    temporal_score FLOAT,
    final_score FLOAT,
    rerank_score FLOAT,
    rerank_method TEXT
) AS $$
DECLARE
    base_results RECORD;
    reranked_results RECORD;
BEGIN
    -- First get base search results
    IF enable_reranking THEN
        -- Get more results for reranking (2x limit for better reranking pool)
        RETURN QUERY
        WITH base_search AS (
            SELECT 
                m.id,
                m.content,
                m.importance_score as importance,
                m.service_id as agent_id,
                m.created_at,
                m.access_count,
                m.metadata,
                ts_rank_cd(to_tsvector('english', m.content), plainto_tsquery('english', query_text)) as relevance_score,
                EXP(-EXTRACT(EPOCH FROM (NOW() - m.created_at)) / 86400.0 / 30.0) as temporal_score,
                (
                    ts_rank_cd(to_tsvector('english', m.content), plainto_tsquery('english', query_text)) * (1 - temporal_weight) +
                    EXP(-EXTRACT(EPOCH FROM (NOW() - m.created_at)) / 86400.0 / 30.0) * temporal_weight
                ) * m.importance_score as base_score
            FROM ai_memories m
            WHERE (search_memories_with_context.agent_id IS NULL OR m.service_id = search_memories_with_context.agent_id)
              AND m.importance_score >= importance_threshold
              AND to_tsvector('english', m.content) @@ plainto_tsquery('english', query_text)
            ORDER BY base_score DESC
            LIMIT (limit_count * 2)
        ),
        reranked AS (
            SELECT 
                b.*,
                CASE rerank_method
                    WHEN 'cross_encoder' THEN 
                        b.base_score * 0.3 + (
                            -- Cross-encoder simulation with enhanced text similarity
                            GREATEST(
                                similarity(query_text, b.content),
                                ts_rank_cd(to_tsvector('english', b.content), plainto_tsquery('english', query_text))
                            ) * 0.7
                        )
                    WHEN 'feature_based' THEN
                        b.base_score * 0.4 + (
                            -- Feature-based scoring
                            (CASE WHEN position(lower(query_text) in lower(b.content)) > 0 THEN 0.3 ELSE 0.0 END) +
                            (b.importance * 0.2) +
                            (COALESCE(b.access_count, 0)::FLOAT / 100.0 * 0.2) +
                            (EXP(-EXTRACT(EPOCH FROM (NOW() - b.created_at)) / 86400.0 / 7.0) * 0.3)
                        ) * 0.6
                    WHEN 'hybrid' THEN
                        b.base_score * 0.25 + (
                            -- Hybrid approach combining multiple signals
                            GREATEST(
                                similarity(query_text, b.content),
                                ts_rank_cd(to_tsvector('english', b.content), plainto_tsquery('english', query_text))
                            ) * 0.3 +
                            (CASE WHEN position(lower(query_text) in lower(b.content)) > 0 THEN 0.2 ELSE 0.0 END) +
                            (b.importance * 0.15) +
                            (COALESCE(b.access_count, 0)::FLOAT / 100.0 * 0.1) +
                            (EXP(-EXTRACT(EPOCH FROM (NOW() - b.created_at)) / 86400.0 / 14.0) * 0.2)
                        ) * 0.75
                    ELSE b.base_score
                END as rerank_score
            FROM base_search b
        )
        SELECT 
            r.id,
            r.content,
            r.importance,
            r.agent_id,
            r.created_at,
            r.relevance_score,
            r.temporal_score,
            r.rerank_score as final_score,
            r.rerank_score,
            rerank_method::TEXT as rerank_method
        FROM reranked r
        ORDER BY r.rerank_score DESC
        LIMIT limit_count;
    ELSE
        -- Standard search without reranking
        RETURN QUERY
        SELECT 
            m.id,
            m.content,
            m.importance_score as importance,
            m.service_id as agent_id,
            m.created_at,
            ts_rank_cd(to_tsvector('english', m.content), plainto_tsquery('english', query_text)) as relevance_score,
            EXP(-EXTRACT(EPOCH FROM (NOW() - m.created_at)) / 86400.0 / 30.0) as temporal_score,
            (
                ts_rank_cd(to_tsvector('english', m.content), plainto_tsquery('english', query_text)) * (1 - temporal_weight) +
                EXP(-EXTRACT(EPOCH FROM (NOW() - m.created_at)) / 86400.0 / 30.0) * temporal_weight
            ) * m.importance_score as final_score,
            0.0 as rerank_score,
            'none'::TEXT as rerank_method
        FROM ai_memories m
        WHERE (search_memories_with_context.agent_id IS NULL OR m.service_id = search_memories_with_context.agent_id)
          AND m.importance_score >= importance_threshold
          AND to_tsvector('english', m.content) @@ plainto_tsquery('english', query_text)
        ORDER BY final_score DESC
        LIMIT limit_count;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Agent coordination function
CREATE OR REPLACE FUNCTION public.get_agent_coordination_data(
    agent_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
    agent_id UUID,
    agent_name TEXT,
    status TEXT,
    workload_score FLOAT,
    memory_count BIGINT,
    avg_memory_importance FLOAT,
    last_active TIMESTAMPTZ,
    coordination_weight FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id as agent_id,
        a.name as agent_name,
        a.status,
        COALESCE(
            CASE a.status
                WHEN 'active' THEN 0.8
                WHEN 'busy' THEN 1.0
                WHEN 'idle' THEN 0.2
                ELSE 0.5
            END, 0.5
        ) as workload_score,
        COUNT(m.id) as memory_count,
        COALESCE(AVG(m.importance_score), 0) as avg_memory_importance,
        a.last_active,
        (
            COALESCE(AVG(m.importance_score), 0) * 0.4 +
            (COUNT(m.id)::FLOAT / 100.0) * 0.3 +
            EXP(-EXTRACT(EPOCH FROM (NOW() - COALESCE(a.last_active, NOW() - INTERVAL '1 day'))) / 3600.0) * 0.3
        ) as coordination_weight
    FROM ai_agents a
    LEFT JOIN ai_memories m ON a.id::text = m.service_id
    WHERE (agent_ids IS NULL OR a.id = ANY(agent_ids))
    GROUP BY a.id, a.name, a.status, a.last_active
    ORDER BY coordination_weight DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on knowledge tables
ALTER TABLE knowledge_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_events ENABLE ROW LEVEL SECURITY;

-- Knowledge entities policies
CREATE POLICY "Users can read all knowledge entities" ON knowledge_entities
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Users can create knowledge entities" ON knowledge_entities
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their knowledge entities" ON knowledge_entities
    FOR UPDATE TO authenticated
    USING (auth.uid() = created_by);

-- Knowledge relationships policies
CREATE POLICY "Users can read all knowledge relationships" ON knowledge_relationships
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Users can create knowledge relationships" ON knowledge_relationships
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their knowledge relationships" ON knowledge_relationships
    FOR UPDATE TO authenticated
    USING (auth.uid() = created_by);

-- Knowledge events policies (read-only for most users)
CREATE POLICY "Users can read knowledge events" ON knowledge_events
    FOR SELECT TO authenticated
    USING (true);

-- Grant permissions on functions and views
GRANT EXECUTE ON FUNCTION public.knowledge_snapshot_at_time TO authenticated;
GRANT EXECUTE ON FUNCTION public.knowledge_evolution TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_knowledge_entities TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_connected_entities TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_memories_with_context TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_agent_coordination_data TO authenticated;

-- Grant permissions on views
GRANT SELECT ON public.agent_summary TO authenticated, anon;
GRANT SELECT ON public.memory_graph TO authenticated, anon;
GRANT SELECT ON public.current_knowledge_snapshot TO authenticated, anon;
GRANT SELECT ON public.agent_performance TO authenticated, anon;

-- Create triggers for knowledge events
CREATE OR REPLACE FUNCTION log_knowledge_event()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO knowledge_events (event_type, entity_id, relationship_id, event_data)
        VALUES (
            CASE 
                WHEN TG_TABLE_NAME = 'knowledge_entities' THEN 'entity_created'
                WHEN TG_TABLE_NAME = 'knowledge_relationships' THEN 'relationship_created'
            END,
            CASE WHEN TG_TABLE_NAME = 'knowledge_entities' THEN NEW.id ELSE NULL END,
            CASE WHEN TG_TABLE_NAME = 'knowledge_relationships' THEN NEW.id ELSE NULL END,
            row_to_json(NEW)
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO knowledge_events (event_type, entity_id, relationship_id, event_data)
        VALUES (
            CASE 
                WHEN TG_TABLE_NAME = 'knowledge_entities' THEN 'entity_updated'
                WHEN TG_TABLE_NAME = 'knowledge_relationships' THEN 'relationship_updated'
            END,
            CASE WHEN TG_TABLE_NAME = 'knowledge_entities' THEN NEW.id ELSE NULL END,
            CASE WHEN TG_TABLE_NAME = 'knowledge_relationships' THEN NEW.id ELSE NULL END,
            jsonb_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW))
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO knowledge_events (event_type, entity_id, relationship_id, event_data)
        VALUES (
            CASE 
                WHEN TG_TABLE_NAME = 'knowledge_entities' THEN 'entity_deleted'
                WHEN TG_TABLE_NAME = 'knowledge_relationships' THEN 'relationship_deleted'
            END,
            CASE WHEN TG_TABLE_NAME = 'knowledge_entities' THEN OLD.id ELSE NULL END,
            CASE WHEN TG_TABLE_NAME = 'knowledge_relationships' THEN OLD.id ELSE NULL END,
            row_to_json(OLD)
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER knowledge_entities_event_trigger
    AFTER INSERT OR UPDATE OR DELETE ON knowledge_entities
    FOR EACH ROW EXECUTE FUNCTION log_knowledge_event();

CREATE TRIGGER knowledge_relationships_event_trigger
    AFTER INSERT OR UPDATE OR DELETE ON knowledge_relationships
    FOR EACH ROW EXECUTE FUNCTION log_knowledge_event();

-- Add comment with usage information
COMMENT ON SCHEMA graphql_public IS 'Enhanced GraphQL schema for Universal AI Tools with temporal knowledge graph support. Access via /graphql/v1 endpoint.';

-- Notify completion
DO $$
BEGIN
    RAISE NOTICE 'Enhanced GraphQL schema with temporal knowledge graph has been created successfully!';
    RAISE NOTICE 'Available endpoints:';
    RAISE NOTICE '  - knowledge_snapshot_at_time(timestamp) - Get knowledge state at specific time';
    RAISE NOTICE '  - knowledge_evolution(start, end) - Get knowledge changes over time period';
    RAISE NOTICE '  - search_knowledge_entities(embedding, threshold, limit) - Semantic search';
    RAISE NOTICE '  - find_connected_entities(entity_id, depth, types) - Graph traversal';
    RAISE NOTICE '  - search_memories_with_context(query, agent_id, threshold, limit, temporal_weight) - Enhanced memory search';
    RAISE NOTICE '  - get_agent_coordination_data(agent_ids) - Agent coordination data';
    RAISE NOTICE 'Views available: agent_summary, memory_graph, current_knowledge_snapshot, agent_performance';
END $$;