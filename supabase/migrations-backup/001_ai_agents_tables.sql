-- Create tables for Universal AI Tools Personal Agents

-- Agent memories table
CREATE TABLE IF NOT EXISTS ai_memories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id TEXT NOT NULL,
  memory_type TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_ai_memories_service_id ON ai_memories(service_id);
CREATE INDEX idx_ai_memories_memory_type ON ai_memories(memory_type);
CREATE INDEX idx_ai_memories_timestamp ON ai_memories(timestamp DESC);

-- Agent contexts table for storing user preferences and settings
CREATE TABLE IF NOT EXISTS ai_contexts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  context_type TEXT NOT NULL,
  context_key TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(context_type, context_key)
);

-- Custom tools created by ToolMakerAgent
CREATE TABLE IF NOT EXISTS ai_custom_tools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tool_name TEXT NOT NULL UNIQUE,
  description TEXT,
  implementation_type TEXT NOT NULL,
  implementation TEXT NOT NULL,
  input_schema JSONB DEFAULT '{}',
  output_schema JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_by TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  rate_limit INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent activity logs
CREATE TABLE IF NOT EXISTS ai_agent_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_name TEXT NOT NULL,
  action TEXT NOT NULL,
  request TEXT,
  response JSONB,
  success BOOLEAN DEFAULT false,
  latency_ms INTEGER,
  error_message TEXT,
  user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for activity logs
CREATE INDEX idx_ai_agent_logs_agent_name ON ai_agent_logs(agent_name);
CREATE INDEX idx_ai_agent_logs_created_at ON ai_agent_logs(created_at DESC);

-- Photo face detections for PhotoOrganizerAgent
CREATE TABLE IF NOT EXISTS ai_photo_faces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photo_path TEXT NOT NULL,
  person_id TEXT,
  person_name TEXT,
  face_encoding JSONB,
  confidence FLOAT,
  bounding_box JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for photo faces
CREATE INDEX idx_ai_photo_faces_person_id ON ai_photo_faces(person_id);
CREATE INDEX idx_ai_photo_faces_photo_path ON ai_photo_faces(photo_path);

-- File organization rules for FileManagerAgent
CREATE TABLE IF NOT EXISTS ai_file_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_name TEXT NOT NULL UNIQUE,
  rule_type TEXT NOT NULL,
  pattern TEXT NOT NULL,
  action JSONB NOT NULL,
  priority INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Calendar events cache for CalendarAgent
CREATE TABLE IF NOT EXISTS ai_calendar_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  location TEXT,
  description TEXT,
  attendees JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ai_memories_updated_at BEFORE UPDATE ON ai_memories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_contexts_updated_at BEFORE UPDATE ON ai_contexts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_custom_tools_updated_at BEFORE UPDATE ON ai_custom_tools
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_file_rules_updated_at BEFORE UPDATE ON ai_file_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_calendar_cache_updated_at BEFORE UPDATE ON ai_calendar_cache
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();