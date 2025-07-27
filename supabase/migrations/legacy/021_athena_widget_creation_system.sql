-- Athena Widget Creation System
-- Tables for storing user-generated widgets and creation history

-- AI Generated Widgets table
CREATE TABLE IF NOT EXISTS ai_generated_widgets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  widget_id TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  widget_name TEXT NOT NULL,
  description TEXT NOT NULL,
  component_code TEXT NOT NULL,
  style_code TEXT,
  props_schema JSONB DEFAULT '{}',
  dependencies TEXT[] DEFAULT '{}',
  created_by TEXT DEFAULT 'athena_widget_service',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Custom Tools table (if not exists)
CREATE TABLE IF NOT EXISTS ai_custom_tools (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tool_name TEXT NOT NULL,
  description TEXT NOT NULL,
  implementation_type TEXT NOT NULL DEFAULT 'function',
  implementation TEXT NOT NULL,
  input_schema JSONB DEFAULT '{}',
  output_schema JSONB DEFAULT '{}',
  dependencies TEXT[] DEFAULT '{}',
  security JSONB DEFAULT '{"permissions": ["basic"], "sandbox": true}',
  metadata JSONB DEFAULT '{}',
  created_by TEXT DEFAULT 'tool_maker_agent',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Tool Templates table (if not exists)
CREATE TABLE IF NOT EXISTS ai_tool_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  template_code TEXT NOT NULL,
  parameters TEXT[] DEFAULT '{}',
  examples TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Tool Deployments table (if not exists)
CREATE TABLE IF NOT EXISTS ai_tool_deployments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tool_id TEXT NOT NULL,
  deployment_target TEXT NOT NULL,
  deployment_config JSONB DEFAULT '{}',
  deployed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Athena Conversations table (if not exists)
CREATE TABLE IF NOT EXISTS athena_conversations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  message_text TEXT NOT NULL,
  response_text TEXT,
  message_type TEXT DEFAULT 'user', -- 'user' or 'athena'
  development_intent JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Athena Sweet Memories table (if not exists)
CREATE TABLE IF NOT EXISTS athena_sweet_memories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id TEXT NOT NULL,
  memory_content TEXT NOT NULL,
  memory_type TEXT DEFAULT 'conversation', -- 'conversation', 'preference', 'achievement'
  importance_to_relationship INTEGER DEFAULT 5,
  emotional_tone TEXT DEFAULT 'neutral',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Athena User Requests table (if not exists)
CREATE TABLE IF NOT EXISTS athena_user_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  request_text TEXT NOT NULL,
  request_type TEXT NOT NULL, -- 'create_table', 'add_tool', 'build_feature', etc.
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'completed', 'rejected'
  implementation_notes JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ai_generated_widgets_user_id ON ai_generated_widgets(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_generated_widgets_widget_id ON ai_generated_widgets(widget_id);
CREATE INDEX IF NOT EXISTS idx_ai_generated_widgets_created_at ON ai_generated_widgets(created_at);

CREATE INDEX IF NOT EXISTS idx_ai_custom_tools_tool_name ON ai_custom_tools(tool_name);
CREATE INDEX IF NOT EXISTS idx_ai_custom_tools_created_by ON ai_custom_tools(created_by);

CREATE INDEX IF NOT EXISTS idx_ai_tool_templates_category ON ai_tool_templates(category);

CREATE INDEX IF NOT EXISTS idx_athena_conversations_user_id ON athena_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_athena_conversations_conversation_id ON athena_conversations(conversation_id);

CREATE INDEX IF NOT EXISTS idx_athena_sweet_memories_user_id ON athena_sweet_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_athena_sweet_memories_importance ON athena_sweet_memories(importance_to_relationship);

CREATE INDEX IF NOT EXISTS idx_athena_user_requests_user_id ON athena_user_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_athena_user_requests_status ON athena_user_requests(status);

-- Enable Row Level Security (RLS)
ALTER TABLE ai_generated_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_custom_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tool_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tool_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE athena_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE athena_sweet_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE athena_user_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_generated_widgets
CREATE POLICY "Users can view their own widgets" ON ai_generated_widgets
  FOR SELECT USING (true); -- Allow all reads for now

CREATE POLICY "Users can create widgets" ON ai_generated_widgets
  FOR INSERT WITH CHECK (true); -- Allow all inserts for now

CREATE POLICY "Users can update their own widgets" ON ai_generated_widgets
  FOR UPDATE USING (true); -- Allow all updates for now

-- RLS Policies for ai_custom_tools
CREATE POLICY "Anyone can view tools" ON ai_custom_tools
  FOR SELECT USING (true);

CREATE POLICY "Service can create tools" ON ai_custom_tools
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can update tools" ON ai_custom_tools
  FOR UPDATE USING (true);

-- RLS Policies for ai_tool_templates
CREATE POLICY "Anyone can view templates" ON ai_tool_templates
  FOR SELECT USING (true);

CREATE POLICY "Service can manage templates" ON ai_tool_templates
  FOR ALL USING (true);

-- RLS Policies for other tables
CREATE POLICY "Users can view their conversations" ON athena_conversations
  FOR SELECT USING (true);

CREATE POLICY "Users can create conversations" ON athena_conversations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view their memories" ON athena_sweet_memories
  FOR SELECT USING (true);

CREATE POLICY "Service can manage memories" ON athena_sweet_memories
  FOR ALL USING (true);

CREATE POLICY "Users can view their requests" ON athena_user_requests
  FOR SELECT USING (true);

CREATE POLICY "Service can manage requests" ON athena_user_requests
  FOR ALL USING (true);

-- Add helpful comments
COMMENT ON TABLE ai_generated_widgets IS 'Stores React widgets generated by Athena through conversation';
COMMENT ON TABLE ai_custom_tools IS 'Custom tools created by the tool maker agent';
COMMENT ON TABLE ai_tool_templates IS 'Templates for different types of tools and widgets';
COMMENT ON TABLE ai_tool_deployments IS 'Deployment tracking for custom tools';
COMMENT ON TABLE athena_conversations IS 'Conversation history with Sweet Athena';
COMMENT ON TABLE athena_sweet_memories IS 'Sweet memories and relationship building data';
COMMENT ON TABLE athena_user_requests IS 'User requests for development tasks';

-- Insert some default tool templates
INSERT INTO ai_tool_templates (id, name, description, category, template_code, parameters, examples) VALUES
('react_display_widget', 'React Display Widget', 'A basic display widget template', 'display', 
 'import React from ''react''; const Widget = ({data}) => <div>{JSON.stringify(data)}</div>; export default Widget;',
 ARRAY['data'], ARRAY['Display user data', 'Show API response']),
('react_input_widget', 'React Input Widget', 'An interactive input widget template', 'input',
 'import React, {useState} from ''react''; const Widget = ({onSubmit}) => { const [value, setValue] = useState(''''); return <input value={value} onChange={e => setValue(e.target.value)} onBlur={() => onSubmit(value)} />; }; export default Widget;',
 ARRAY['onSubmit'], ARRAY['Form input', 'Search box', 'Text entry'])
ON CONFLICT (id) DO NOTHING;

-- Success message
SELECT 'Athena Widget Creation System migration completed successfully!' as status;