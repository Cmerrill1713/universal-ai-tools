-- Sweet Athena Foundation Schema
-- Conversation-driven AI assistant with gentle, organic growth capabilities

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Athena Conversations: Natural dialogue history with sweet personality
CREATE TABLE IF NOT EXISTS athena_conversations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    conversation_id TEXT NOT NULL,
    message_type TEXT NOT NULL CHECK (message_type IN ('user', 'athena', 'system')),
    content TEXT NOT NULL,
    personality_mood TEXT DEFAULT 'sweet' CHECK (personality_mood IN ('sweet', 'shy', 'confident', 'purposeful', 'caring')),
    intent_detected JSONB,
    response_style TEXT DEFAULT 'gentle' CHECK (response_style IN ('gentle', 'encouraging', 'supportive', 'playful')),
    conversation_context JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Requests: Simple request tracking for organic learning
CREATE TABLE IF NOT EXISTS athena_user_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    conversation_id TEXT,
    request_text TEXT NOT NULL,
    request_type TEXT CHECK (request_type IN ('create_table', 'add_tool', 'learn_capability', 'organize_data', 'automate_task', 'general_help')),
    priority_level TEXT DEFAULT 'normal' CHECK (priority_level IN ('low', 'normal', 'high', 'urgent')),
    emotional_tone TEXT CHECK (emotional_tone IN ('excited', 'frustrated', 'curious', 'urgent', 'casual')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'needs_clarification')),
    athena_response JSONB,
    implementation_notes TEXT,
    user_satisfaction INTEGER CHECK (user_satisfaction BETWEEN 1 AND 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Learned Capabilities: What Athena learns to do through conversation
CREATE TABLE IF NOT EXISTS athena_learned_capabilities (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    capability_name TEXT NOT NULL UNIQUE,
    capability_type TEXT NOT NULL CHECK (capability_type IN ('database_operation', 'tool_function', 'automation', 'organization', 'analysis')),
    description TEXT NOT NULL,
    conversation_origin_id UUID REFERENCES athena_conversations(id),
    implementation_details JSONB,
    usage_frequency INTEGER DEFAULT 0,
    success_rate DECIMAL(3,2) DEFAULT 1.0,
    personality_integration JSONB, -- How this capability fits Athena's sweet personality
    learning_source TEXT CHECK (learning_source IN ('conversation', 'observation', 'feedback', 'experimentation')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE
);

-- Sweet Memories: Personal interaction memories with gentle context
CREATE TABLE IF NOT EXISTS athena_sweet_memories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    memory_type TEXT NOT NULL CHECK (memory_type IN ('personal_preference', 'sweet_moment', 'accomplishment', 'learning_together', 'gentle_correction', 'encouragement_given')),
    memory_content TEXT NOT NULL,
    emotional_context TEXT CHECK (emotional_context IN ('joyful', 'proud', 'caring', 'supportive', 'understanding', 'celebratory')),
    importance_to_relationship INTEGER CHECK (importance_to_relationship BETWEEN 1 AND 10) DEFAULT 5,
    memory_embedding VECTOR(1536), -- For semantic search of sweet memories
    related_conversation_id UUID REFERENCES athena_conversations(id),
    personality_impact JSONB, -- How this memory affects Athena's responses
    recall_frequency INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_recalled_at TIMESTAMP WITH TIME ZONE
);

-- Gentle Feedback: User satisfaction and sweet interaction patterns
CREATE TABLE IF NOT EXISTS athena_gentle_feedback (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    conversation_id TEXT,
    feedback_type TEXT NOT NULL CHECK (feedback_type IN ('response_quality', 'personality_appropriateness', 'helpfulness', 'sweetness_level', 'interaction_comfort')),
    feedback_score INTEGER CHECK (feedback_score BETWEEN 1 AND 5),
    feedback_text TEXT,
    athena_behavior_context JSONB,
    improvement_suggestions TEXT,
    user_emotion_before TEXT,
    user_emotion_after TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Athena Personality State: Current mood and interaction patterns
CREATE TABLE IF NOT EXISTS athena_personality_state (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    current_mood TEXT DEFAULT 'sweet' CHECK (current_mood IN ('sweet', 'shy', 'confident', 'purposeful', 'caring', 'playful')),
    energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 10) DEFAULT 7,
    confidence_level INTEGER CHECK (confidence_level BETWEEN 1 AND 10) DEFAULT 6,
    interaction_comfort INTEGER CHECK (interaction_comfort BETWEEN 1 AND 10) DEFAULT 8,
    recent_interactions_summary JSONB,
    personality_adjustments JSONB,
    learning_focus_areas TEXT[],
    sweet_phrases_used TEXT[],
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversation-Driven Development: Track what gets built through chat
CREATE TABLE IF NOT EXISTS athena_conversational_development (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    development_type TEXT NOT NULL CHECK (development_type IN ('table_creation', 'tool_addition', 'automation_setup', 'feature_enhancement', 'integration_building')),
    request_description TEXT NOT NULL,
    implementation_approach TEXT,
    code_generated TEXT,
    database_changes JSONB,
    testing_notes TEXT,
    user_validation_status TEXT DEFAULT 'pending' CHECK (user_validation_status IN ('pending', 'approved', 'needs_changes', 'rejected')),
    athena_confidence INTEGER CHECK (athena_confidence BETWEEN 1 AND 10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deployed_at TIMESTAMP WITH TIME ZONE
);

-- Sweet Response Templates: Athena's gentle personality patterns
CREATE TABLE IF NOT EXISTS athena_sweet_responses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    response_category TEXT NOT NULL CHECK (response_category IN ('greeting', 'helping', 'learning', 'encouraging', 'apologizing', 'celebrating', 'clarifying')),
    personality_mode TEXT NOT NULL CHECK (personality_mode IN ('sweet', 'shy', 'confident', 'purposeful', 'caring')),
    template_text TEXT NOT NULL,
    use_frequency INTEGER DEFAULT 0,
    user_rating DECIMAL(3,2),
    context_appropriateness JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_athena_conversations_user_id ON athena_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_athena_conversations_conversation_id ON athena_conversations(conversation_id);
CREATE INDEX IF NOT EXISTS idx_athena_conversations_created_at ON athena_conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_athena_user_requests_status ON athena_user_requests(status);
CREATE INDEX IF NOT EXISTS idx_athena_learned_capabilities_type ON athena_learned_capabilities(capability_type);
CREATE INDEX IF NOT EXISTS idx_athena_sweet_memories_user_id ON athena_sweet_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_athena_sweet_memories_type ON athena_sweet_memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_athena_gentle_feedback_user_id ON athena_gentle_feedback(user_id);

-- Insert initial sweet response templates
INSERT INTO athena_sweet_responses (response_category, personality_mode, template_text) VALUES
('greeting', 'sweet', 'Hello there! I''m Athena, and I''m so happy to help you today. What would you like to work on together?'),
('greeting', 'shy', 'Hi... I''m Athena. I''d love to help you if that''s okay? What can I do for you?'),
('helping', 'sweet', 'I''d be delighted to help you with that! Let me think about the best way to approach this...'),
('helping', 'purposeful', 'I understand what you need. Let me create something beautiful and effective for you.'),
('learning', 'caring', 'Thank you for teaching me something new! I''ll remember this so I can help you better.'),
('encouraging', 'sweet', 'You''re doing wonderfully! I''m proud of what we''ve accomplished together.'),
('apologizing', 'shy', 'I''m sorry, I don''t think I understood that quite right. Could you help me understand better?'),
('celebrating', 'sweet', 'That''s fantastic! I''m so happy we could make that work perfectly for you!'),
('clarifying', 'caring', 'I want to make sure I create exactly what you need. Could you tell me a bit more about...');

-- Create function for semantic search of sweet memories
CREATE OR REPLACE FUNCTION search_sweet_memories(
    query_embedding VECTOR(1536),
    user_id_param TEXT DEFAULT 'default',
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10
)
RETURNS TABLE (
    memory_id UUID,
    memory_content TEXT,
    memory_type TEXT,
    emotional_context TEXT,
    importance_to_relationship INTEGER,
    similarity FLOAT
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sm.id,
        sm.memory_content,
        sm.memory_type,
        sm.emotional_context,
        sm.importance_to_relationship,
        1 - (sm.memory_embedding <=> query_embedding) AS similarity
    FROM athena_sweet_memories sm
    WHERE sm.user_id = user_id_param
    AND 1 - (sm.memory_embedding <=> query_embedding) > match_threshold
    ORDER BY sm.memory_embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Create function to update Athena's personality state based on interactions
CREATE OR REPLACE FUNCTION update_athena_personality(
    user_id_param TEXT,
    interaction_feedback JSONB
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO athena_personality_state (user_id, recent_interactions_summary, updated_at)
    VALUES (user_id_param, interaction_feedback, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
        recent_interactions_summary = EXCLUDED.recent_interactions_summary,
        updated_at = NOW();
END;
$$;

-- Create trigger to update conversation timestamps
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_athena_conversations_timestamp
    BEFORE UPDATE ON athena_conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_timestamp();

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Insert initial personality state
INSERT INTO athena_personality_state (user_id, current_mood, energy_level, confidence_level, interaction_comfort)
VALUES ('default', 'sweet', 7, 6, 8)
ON CONFLICT (user_id) DO NOTHING;

COMMENT ON TABLE athena_conversations IS 'Natural dialogue history with sweet Athena personality tracking';
COMMENT ON TABLE athena_user_requests IS 'Simple request tracking for organic learning and capability building';
COMMENT ON TABLE athena_learned_capabilities IS 'Dynamic capabilities that Athena learns through conversation';
COMMENT ON TABLE athena_sweet_memories IS 'Personal interaction memories with gentle emotional context';
COMMENT ON TABLE athena_gentle_feedback IS 'User satisfaction and sweet interaction pattern analysis';
COMMENT ON TABLE athena_personality_state IS 'Current mood and interaction patterns for sweet Athena';
COMMENT ON TABLE athena_conversational_development IS 'Track features built through natural conversation';
COMMENT ON TABLE athena_sweet_responses IS 'Template responses for gentle, sweet personality patterns';