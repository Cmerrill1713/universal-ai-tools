-- MCP (Model Context Protocol) Integration Tables

-- MCP Agents table
CREATE TABLE IF NOT EXISTS mcp_agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '🤖',
  description TEXT,
  capabilities JSONB DEFAULT '[]'::jsonb,
  required_keys JSONB DEFAULT '[]'::jsonb,
  endpoint TEXT NOT NULL,
  status TEXT DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error', 'pending')),
  last_heartbeat TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- MCP Key Vault table for storing encrypted agent credentials
CREATE TABLE IF NOT EXISTS mcp_key_vault (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES mcp_agents(id) ON DELETE CASCADE,
  key_name TEXT NOT NULL,
  encrypted_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(agent_id, key_name)
);

-- MCP Agent Executions table for logging
CREATE TABLE IF NOT EXISTS mcp_agent_executions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES mcp_agents(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  params JSONB,
  result JSONB,
  error TEXT,
  execution_time_ms INTEGER,
  service_id UUID REFERENCES ai_services(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_mcp_agents_status ON mcp_agents(status);
CREATE INDEX idx_mcp_agents_last_heartbeat ON mcp_agents(last_heartbeat);
CREATE INDEX idx_mcp_key_vault_agent_id ON mcp_key_vault(agent_id);
CREATE INDEX idx_mcp_agent_executions_agent_id ON mcp_agent_executions(agent_id);
CREATE INDEX idx_mcp_agent_executions_created_at ON mcp_agent_executions(created_at);

-- Row Level Security
ALTER TABLE mcp_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_key_vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_agent_executions ENABLE ROW LEVEL SECURITY;

-- Policies for mcp_agents (read-only for authenticated users)
CREATE POLICY "Authenticated users can read MCP agents" ON mcp_agents
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policies for mcp_key_vault (restricted access)
CREATE POLICY "Service role can manage MCP keys" ON mcp_key_vault
  FOR ALL
  USING (auth.role() = 'service_role');

-- Policies for mcp_agent_executions (write for authenticated, read for service)
CREATE POLICY "Authenticated users can create MCP executions" ON mcp_agent_executions
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Service role can read MCP executions" ON mcp_agent_executions
  FOR SELECT
  USING (auth.role() = 'service_role');

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_mcp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_mcp_agents_updated_at
  BEFORE UPDATE ON mcp_agents
  FOR EACH ROW
  EXECUTE FUNCTION update_mcp_updated_at();

CREATE TRIGGER update_mcp_key_vault_updated_at
  BEFORE UPDATE ON mcp_key_vault
  FOR EACH ROW
  EXECUTE FUNCTION update_mcp_updated_at();

-- Sample MCP agents (commented out, for reference)
-- INSERT INTO mcp_agents (id, name, icon, description, capabilities, required_keys, endpoint) VALUES
-- ('github-mcp', 'GitHub MCP', '🐙', 'GitHub integration via MCP', 
--   '["repository_management", "issue_tracking", "pull_requests", "actions"]'::jsonb,
--   '[{"name": "github_token", "description": "GitHub Personal Access Token", "type": "token"}]'::jsonb,
--   '/api/mcp/agents/github-mcp'),
-- ('slack-mcp', 'Slack MCP', '💬', 'Slack integration via MCP',
--   '["messaging", "channels", "users", "files"]'::jsonb,
--   '[{"name": "slack_token", "description": "Slack Bot Token", "type": "token"}, 
--     {"name": "slack_signing_secret", "description": "Slack Signing Secret", "type": "password"}]'::jsonb,
--   '/api/mcp/agents/slack-mcp');