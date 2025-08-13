-- User Preference Learning System Tables
-- Supports personalized model selection and adaptive learning
-- Generated: 2025-08-12

-- User preferences table - stores learned preferences for each user
CREATE TABLE IF NOT EXISTS user_preferences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- User identification
  user_id text NOT NULL UNIQUE,
  
  -- Learned preferences (JSONB for flexibility)
  model_preferences jsonb DEFAULT '{}'::jsonb,
  task_preferences jsonb DEFAULT '{}'::jsonb,
  general_preferences jsonb DEFAULT '{
    "responseSpeed": "balanced",
    "creativityLevel": 0.5,
    "technicalDetail": 0.5,
    "explainationDepth": 0.5,
    "preferredTone": "neutral",
    "languageComplexity": "moderate"
  }'::jsonb,
  
  -- Adaptive learning weights
  adaptive_weights jsonb DEFAULT '{
    "recencyWeight": 0.2,
    "frequencyWeight": 0.2,
    "ratingWeight": 0.3,
    "contextWeight": 0.2,
    "performanceWeight": 0.1
  }'::jsonb,
  
  -- Version control for preferences
  version integer DEFAULT 1,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- User interactions table - stores all user interactions for learning
CREATE TABLE IF NOT EXISTS user_interactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- User and session identification
  user_id text NOT NULL,
  session_id text NOT NULL,
  
  -- Interaction details
  interaction_type text NOT NULL CHECK (interaction_type IN (
    'model_selection', 
    'prompt_submission', 
    'response_rating', 
    'correction', 
    'regeneration'
  )),
  
  -- Model information
  model_id text NOT NULL,
  provider_id text NOT NULL,
  
  -- Content
  prompt text,
  response text,
  
  -- Feedback
  rating integer CHECK (rating BETWEEN 1 AND 5),
  feedback text,
  
  -- Context and metadata
  context jsonb DEFAULT '{}'::jsonb,
  task_type text,
  response_time integer, -- in milliseconds
  token_count integer,
  was_regenerated boolean DEFAULT false,
  corrections text[],
  
  -- Timestamp
  timestamp timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_user_id ON user_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_session ON user_interactions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_timestamp ON user_interactions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_user_interactions_model ON user_interactions(model_id, provider_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_type ON user_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_user_interactions_rating ON user_interactions(rating) WHERE rating IS NOT NULL;

-- Create function to update updated_at timestamps (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_user_preferences_updated_at 
    BEFORE UPDATE ON user_preferences 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for secure access
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
        -- Users can access their own preferences
        EXECUTE 'CREATE POLICY "Users can access own preferences" ON user_preferences
            FOR ALL USING (auth.uid()::text = user_id)';

        -- Users can access their own interactions
        EXECUTE 'CREATE POLICY "Users can access own interactions" ON user_interactions
            FOR ALL USING (auth.uid()::text = user_id)';
    END IF;
END $$;