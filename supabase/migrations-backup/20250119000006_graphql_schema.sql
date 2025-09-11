-- Configure GraphQL schema for Universal AI Tools

-- Create custom GraphQL functions for AI operations

-- Function to process AI chat messages via GraphQL
CREATE OR REPLACE FUNCTION graphql.process_ai_message(
    user_message TEXT,
    model_name TEXT DEFAULT 'gpt-4',
    context_window INT DEFAULT 10
) RETURNS JSONB AS $$
DECLARE
    response JSONB;
    model_id UUID;
BEGIN
    -- Get model ID
    SELECT id INTO model_id FROM llm_users.models WHERE model_name = process_ai_message.model_name;
    
    -- Log the request
    INSERT INTO analytics_events (event_type, llm_model_id, metadata)
    VALUES ('ai_message', model_id, jsonb_build_object(
        'message_length', length(user_message),
        'context_window', context_window
    ));
    
    -- Return mock response for now (would integrate with actual AI service)
    response := jsonb_build_object(
        'message', 'GraphQL AI response to: ' || left(user_message, 50) || '...',
        'model', model_name,
        'timestamp', now()
    );
    
    RETURN response;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to manage memory operations via GraphQL
CREATE OR REPLACE FUNCTION graphql.memory_operation(
    operation TEXT, -- 'store', 'retrieve', 'search'
    content TEXT DEFAULT NULL,
    query TEXT DEFAULT NULL,
    limit_count INT DEFAULT 10
) RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    CASE operation
        WHEN 'store' THEN
            -- Store memory
            INSERT INTO memories (content, embedding)
            VALUES (content, ai_generate_embedding(content))
            RETURNING jsonb_build_object('id', id, 'created_at', created_at) INTO result;
            
        WHEN 'retrieve' THEN
            -- Retrieve recent memories
            SELECT jsonb_agg(jsonb_build_object(
                'id', id,
                'content', content,
                'created_at', created_at
            )) INTO result
            FROM (
                SELECT id, content, created_at 
                FROM memories 
                ORDER BY created_at DESC 
                LIMIT limit_count
            ) m;
            
        WHEN 'search' THEN
            -- Vector search memories
            SELECT jsonb_agg(jsonb_build_object(
                'id', id,
                'content', content,
                'similarity', similarity
            )) INTO result
            FROM (
                SELECT id, content, 
                       1 - (embedding <=> ai_generate_embedding(query)) as similarity
                FROM memories
                WHERE embedding IS NOT NULL
                ORDER BY embedding <=> ai_generate_embedding(query)
                LIMIT limit_count
            ) m;
            
        ELSE
            result := jsonb_build_object('error', 'Invalid operation');
    END CASE;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to manage agent operations via GraphQL
CREATE OR REPLACE FUNCTION graphql.agent_operation(
    agent_type TEXT,
    action TEXT,
    parameters JSONB DEFAULT '{}'
) RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    -- Log the agent operation
    INSERT INTO analytics_events (event_type, metadata)
    VALUES ('agent_operation', jsonb_build_object(
        'agent_type', agent_type,
        'action', action,
        'parameters', parameters
    ));
    
    -- Return operation result
    result := jsonb_build_object(
        'agent_type', agent_type,
        'action', action,
        'status', 'completed',
        'result', parameters,
        'timestamp', now()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create GraphQL views for easy querying
CREATE OR REPLACE VIEW graphql.llm_models AS
SELECT 
    id,
    model_name,
    provider,
    capabilities,
    rate_limits,
    usage_stats,
    created_at,
    updated_at
FROM llm_users.models;

CREATE OR REPLACE VIEW graphql.recent_analytics AS
SELECT 
    id,
    event_type,
    user_id,
    llm_model_id,
    metadata,
    timestamp
FROM analytics_events
WHERE timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;

CREATE OR REPLACE VIEW graphql.memory_stats AS
SELECT 
    COUNT(*) as total_memories,
    COUNT(DISTINCT user_id) as unique_users,
    MAX(created_at) as last_memory_created,
    AVG(LENGTH(content)) as avg_content_length
FROM memories;

-- Grant permissions for GraphQL access
GRANT USAGE ON SCHEMA graphql TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA graphql TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA graphql TO authenticated;

-- Create composite types for GraphQL
CREATE TYPE graphql.ai_message_input AS (
    message TEXT,
    model_name TEXT,
    context_window INT
);

CREATE TYPE graphql.memory_operation_input AS (
    operation TEXT,
    content TEXT,
    query TEXT,
    limit_count INT
);

-- Comment the schema for GraphQL introspection
COMMENT ON FUNCTION graphql.process_ai_message IS 'Process an AI message and return the response';
COMMENT ON FUNCTION graphql.memory_operation IS 'Perform memory operations: store, retrieve, or search';
COMMENT ON FUNCTION graphql.agent_operation IS 'Execute agent operations with specified parameters';
COMMENT ON VIEW graphql.llm_models IS 'Available LLM models and their configurations';
COMMENT ON VIEW graphql.recent_analytics IS 'Recent analytics events from the last 24 hours';
COMMENT ON VIEW graphql.memory_stats IS 'Statistics about stored memories';