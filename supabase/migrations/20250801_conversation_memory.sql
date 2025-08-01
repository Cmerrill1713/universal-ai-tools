-- Migration: Conversation Memory System
-- Creates tables for persistent conversation storage

-- Create conversation_messages table
CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  session_id TEXT,
  message TEXT NOT NULL,
  response TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  agent_model TEXT NOT NULL,
  confidence DECIMAL(3,2) DEFAULT 0.5,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT UNIQUE NOT NULL,
  preferred_agent TEXT,
  communication_style TEXT,
  topics TEXT[] DEFAULT '{}',
  preferences JSONB DEFAULT '{}',
  session_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_conversation_messages_user_id ON conversation_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_timestamp ON conversation_messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_agent_type ON conversation_messages(agent_type);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_last_activity ON user_preferences(last_activity DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (simple policies for now - can be enhanced later)
CREATE POLICY "Users can access their own conversation messages" 
ON conversation_messages FOR ALL 
TO authenticated 
USING (user_id = auth.uid()::text);

CREATE POLICY "Service role can access all conversation messages" 
ON conversation_messages FOR ALL 
TO service_role 
USING (true);

CREATE POLICY "Users can access their own preferences" 
ON user_preferences FOR ALL 
TO authenticated 
USING (user_id = auth.uid()::text);

CREATE POLICY "Service role can access all preferences" 
ON user_preferences FOR ALL 
TO service_role 
USING (true);

-- Function to update user preferences automatically
CREATE OR REPLACE FUNCTION update_user_preferences()
RETURNS TRIGGER AS $$
BEGIN
  -- Update or insert user preferences when a new message is added
  INSERT INTO user_preferences (user_id, last_activity, message_count)
  VALUES (NEW.user_id, NEW.timestamp, 1)
  ON CONFLICT (user_id) DO UPDATE SET
    last_activity = NEW.timestamp,
    message_count = user_preferences.message_count + 1,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update user preferences
DROP TRIGGER IF EXISTS trigger_update_user_preferences ON conversation_messages;
CREATE TRIGGER trigger_update_user_preferences
  AFTER INSERT ON conversation_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_user_preferences();

-- Function to clean up old conversation messages (optional)
CREATE OR REPLACE FUNCTION cleanup_old_conversations(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM conversation_messages 
  WHERE timestamp < NOW() - INTERVAL '1 day' * days_to_keep;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get conversation stats
CREATE OR REPLACE FUNCTION get_conversation_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_users', COUNT(DISTINCT user_id),
    'total_messages', COUNT(*),
    'messages_today', COUNT(*) FILTER (WHERE timestamp > CURRENT_DATE),
    'active_users_today', COUNT(DISTINCT user_id) FILTER (WHERE timestamp > CURRENT_DATE),
    'avg_messages_per_user', ROUND(COUNT(*)::DECIMAL / NULLIF(COUNT(DISTINCT user_id), 0), 2)
  ) INTO result
  FROM conversation_messages;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;