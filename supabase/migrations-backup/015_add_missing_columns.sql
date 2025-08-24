-- Add missing columns to existing tables
ALTER TABLE ai_custom_tools ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE ai_custom_tools ADD COLUMN IF NOT EXISTS rate_limit INTEGER DEFAULT 0;