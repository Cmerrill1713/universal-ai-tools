-- Migration: 031_vision_support.sql
-- Description: Add vision support tables and extend memory system for visual embeddings
-- Created: 2025-01-07

-- Enable vector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Add vision columns to ai_memories table
ALTER TABLE ai_memories 
ADD COLUMN IF NOT EXISTS visual_embedding vector(512),
ADD COLUMN IF NOT EXISTS image_metadata JSONB,
ADD COLUMN IF NOT EXISTS image_path TEXT,
ADD COLUMN IF NOT EXISTS is_generated BOOLEAN DEFAULT FALSE;

-- Create index for visual similarity search
CREATE INDEX IF NOT EXISTS idx_ai_memories_visual_embedding 
ON ai_memories USING ivfflat (visual_embedding vector_cosine_ops)
WHERE visual_embedding IS NOT NULL;

-- Vision analysis results table
CREATE TABLE IF NOT EXISTS vision_analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID REFERENCES ai_memories(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL CHECK (analysis_type IN ('object_detection', 'scene_analysis', 'ocr', 'generation')),
  model_used TEXT NOT NULL,
  results JSONB NOT NULL,
  confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),
  processing_time_ms INTEGER,
  cached BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Image embeddings table for faster lookups
CREATE TABLE IF NOT EXISTS vision_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID REFERENCES ai_memories(id) ON DELETE CASCADE,
  embedding vector(512) NOT NULL,
  model_version TEXT NOT NULL DEFAULT 'clip-vit-b32',
  confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(memory_id, model_version)
);

-- Create index for embedding search
CREATE INDEX idx_vision_embeddings_vector 
ON vision_embeddings USING ivfflat (embedding vector_cosine_ops);

-- Visual concepts table for grounding
CREATE TABLE IF NOT EXISTS visual_concepts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concept TEXT NOT NULL UNIQUE,
  description TEXT,
  visual_prototypes vector(512)[] NOT NULL,
  linguistic_embedding vector(768),
  learned_relations JSONB DEFAULT '{}',
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for concept search
CREATE INDEX idx_visual_concepts_concept ON visual_concepts(concept);

-- Visual learning experiences table
CREATE TABLE IF NOT EXISTS visual_learning_experiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  memory_id UUID REFERENCES ai_memories(id),
  visual_input BYTEA,
  visual_embedding vector(512),
  prediction JSONB NOT NULL,
  actual_outcome JSONB NOT NULL,
  learning_delta JSONB,
  success BOOLEAN DEFAULT FALSE,
  confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Index for learning analysis
CREATE INDEX idx_visual_learning_agent ON visual_learning_experiences(agent_id, timestamp DESC);
CREATE INDEX idx_visual_learning_success ON visual_learning_experiences(success);

-- Generated images table
CREATE TABLE IF NOT EXISTS generated_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt TEXT NOT NULL,
  negative_prompt TEXT,
  model TEXT NOT NULL DEFAULT 'sd3b',
  parameters JSONB NOT NULL,
  image_data TEXT, -- Base64 encoded or URL
  quality_metrics JSONB,
  memory_id UUID REFERENCES ai_memories(id),
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for prompt search
CREATE INDEX idx_generated_images_prompt ON generated_images USING gin(to_tsvector('english', prompt));

-- Visual hypothesis table for reasoning
CREATE TABLE IF NOT EXISTS visual_hypotheses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concept TEXT NOT NULL,
  hypothesis TEXT NOT NULL,
  generated_image_id UUID REFERENCES generated_images(id),
  expected_outcome JSONB NOT NULL,
  actual_outcome JSONB,
  validation_score FLOAT,
  learning_outcome JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  validated_at TIMESTAMPTZ
);

-- Function to search similar images
CREATE OR REPLACE FUNCTION search_similar_images(
  query_embedding vector(512),
  limit_count INTEGER DEFAULT 10,
  threshold FLOAT DEFAULT 0.8
)
RETURNS TABLE (
  memory_id UUID,
  similarity FLOAT,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id as memory_id,
    1 - (m.visual_embedding <=> query_embedding) as similarity,
    m.metadata
  FROM ai_memories m
  WHERE m.visual_embedding IS NOT NULL
    AND 1 - (m.visual_embedding <=> query_embedding) > threshold
  ORDER BY m.visual_embedding <=> query_embedding
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update visual concept
CREATE OR REPLACE FUNCTION update_visual_concept(
  p_concept TEXT,
  p_new_prototype vector(512)
)
RETURNS void AS $$
DECLARE
  v_current_prototypes vector(512)[];
BEGIN
  -- Get current prototypes
  SELECT visual_prototypes INTO v_current_prototypes
  FROM visual_concepts
  WHERE concept = p_concept;
  
  IF v_current_prototypes IS NULL THEN
    -- Create new concept
    INSERT INTO visual_concepts (concept, visual_prototypes, usage_count)
    VALUES (p_concept, ARRAY[p_new_prototype], 1);
  ELSE
    -- Update existing concept
    UPDATE visual_concepts
    SET 
      visual_prototypes = array_append(visual_prototypes, p_new_prototype),
      usage_count = usage_count + 1,
      updated_at = NOW()
    WHERE concept = p_concept;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_vision_analysis_updated_at BEFORE UPDATE
  ON vision_analysis_results FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_visual_concepts_updated_at BEFORE UPDATE
  ON visual_concepts FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Comments
COMMENT ON TABLE vision_analysis_results IS 'Stores results from vision analysis tasks';
COMMENT ON TABLE vision_embeddings IS 'Stores visual embeddings for fast similarity search';
COMMENT ON TABLE visual_concepts IS 'Maps visual patterns to linguistic concepts';
COMMENT ON TABLE visual_learning_experiences IS 'Tracks visual learning outcomes for agents';
COMMENT ON TABLE generated_images IS 'Stores AI-generated images and their metadata';
COMMENT ON TABLE visual_hypotheses IS 'Tracks visual reasoning hypotheses and validations';

-- Grant permissions (adjust based on your roles)
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;