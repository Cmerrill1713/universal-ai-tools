-- Fix the missing unique constraint on athena_personality_state.user_id
-- This allows the ON CONFLICT clause to work properly

-- Add unique constraint to user_id if table exists and constraint doesn't
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'athena_personality_state'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'athena_personality_state_user_id_key'
    ) THEN
        ALTER TABLE athena_personality_state 
        ADD CONSTRAINT athena_personality_state_user_id_key UNIQUE (user_id);
    END IF;
END $$;

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

-- Now we can safely insert the default personality state
INSERT INTO athena_personality_state (user_id, current_mood, energy_level, confidence_level, interaction_comfort)
VALUES ('default', 'sweet', 7, 6, 8)
ON CONFLICT (user_id) DO UPDATE
SET 
    updated_at = NOW(),
    current_mood = EXCLUDED.current_mood,
    energy_level = EXCLUDED.energy_level,
    confidence_level = EXCLUDED.confidence_level,
    interaction_comfort = EXCLUDED.interaction_comfort;