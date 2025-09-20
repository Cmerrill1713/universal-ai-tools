-- User Voice Preferences Table
-- Stores learned user preferences for voice commands

CREATE TABLE IF NOT EXISTS user_voice_preferences (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default_user',
    intent_category TEXT NOT NULL, -- 'browser', 'code_editor', 'music_player', etc.
    preferred_choice TEXT NOT NULL, -- 'chrome', 'vscode', 'spotify', etc.
    usage_count INTEGER DEFAULT 1,
    confidence_score DECIMAL(3,2) DEFAULT 0.1 CHECK (confidence_score >= 0 AND confidence_score <= 1),
    last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_user_voice_preferences_user_category 
ON user_voice_preferences (user_id, intent_category);

CREATE INDEX IF NOT EXISTS idx_user_voice_preferences_confidence 
ON user_voice_preferences (confidence_score DESC, usage_count DESC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_voice_preferences_updated_at 
BEFORE UPDATE ON user_voice_preferences 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add some helpful comments
COMMENT ON TABLE user_voice_preferences IS 'Stores learned user preferences for voice commands to enable personalization';
COMMENT ON COLUMN user_voice_preferences.intent_category IS 'Category of the intent (browser, code_editor, music_player, etc.)';
COMMENT ON COLUMN user_voice_preferences.preferred_choice IS 'The user''s preferred choice for this category (chrome, vscode, spotify, etc.)';
COMMENT ON COLUMN user_voice_preferences.confidence_score IS 'Confidence in this preference (0.0-1.0), increases with usage';
COMMENT ON COLUMN user_voice_preferences.usage_count IS 'Number of times user has chosen this preference';