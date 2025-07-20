-- Create core AI agents tables for Universal AI Tools

-- AI Services table for managing different AI service integrations
CREATE TABLE IF NOT EXISTS ai_services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_name TEXT NOT NULL UNIQUE,
  service_type TEXT NOT NULL,
  capabilities JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Service Keys table for API key management
CREATE TABLE IF NOT EXISTS ai_service_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES ai_services(id) ON DELETE CASCADE,
  key_name TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  permissions JSONB DEFAULT '["read", "write", "execute"]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Agents table for managing individual AI agents
CREATE TABLE IF NOT EXISTS ai_agents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  capabilities JSONB DEFAULT '[]',
  instructions TEXT,
  model TEXT DEFAULT 'llama3.2:3b',
  created_by TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Agent Executions table for tracking agent runs
CREATE TABLE IF NOT EXISTS ai_agent_executions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  input TEXT NOT NULL,
  output TEXT,
  context TEXT,
  model TEXT,
  service_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Tool Executions table for tracking tool usage
CREATE TABLE IF NOT EXISTS ai_tool_executions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  input_params JSONB DEFAULT '{}',
  output_result JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  execution_time_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_ai_services_type ON ai_services(service_type);
CREATE INDEX idx_ai_service_keys_service_id ON ai_service_keys(service_id);
CREATE INDEX idx_ai_agents_created_by ON ai_agents(created_by);
CREATE INDEX idx_ai_agents_is_active ON ai_agents(is_active);
CREATE INDEX idx_ai_agent_executions_agent_id ON ai_agent_executions(agent_id);
CREATE INDEX idx_ai_agent_executions_created_at ON ai_agent_executions(created_at DESC);
CREATE INDEX idx_ai_tool_executions_service_id ON ai_tool_executions(service_id);
CREATE INDEX idx_ai_tool_executions_tool_name ON ai_tool_executions(tool_name);
CREATE INDEX idx_ai_tool_executions_created_at ON ai_tool_executions(created_at DESC);

-- Create updated_at triggers for new tables
CREATE TRIGGER update_ai_services_updated_at BEFORE UPDATE ON ai_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_service_keys_updated_at BEFORE UPDATE ON ai_service_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_agents_updated_at BEFORE UPDATE ON ai_agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default service for local development
INSERT INTO ai_services (service_name, service_type, capabilities) VALUES
  ('Local UI', 'custom', '["memory", "context", "tools", "ai_chat"]')
ON CONFLICT (service_name) DO NOTHING;

-- Insert sample agents for demonstration
INSERT INTO ai_agents (name, description, capabilities, instructions, created_by) VALUES
  ('General Assistant', 'A helpful general-purpose AI assistant', '["conversation", "analysis", "help"]', 'You are a helpful AI assistant. Provide clear, accurate, and helpful responses to user queries.', 'local-dev'),
  ('Code Helper', 'An AI assistant specialized in coding tasks', '["coding", "debugging", "analysis"]', 'You are a coding assistant. Help users with programming tasks, debugging, and code analysis.', 'local-dev'),
  ('Research Assistant', 'An AI assistant for research and information gathering', '["research", "analysis", "summarization"]', 'You are a research assistant. Help users find information, analyze data, and provide comprehensive summaries.', 'local-dev')
ON CONFLICT DO NOTHING;