-- Template and Asset Management System
-- Migrate static content from local filesystem to Supabase

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- STORAGE BUCKETS FOR STATIC ASSETS
-- ==========================================

-- Create storage buckets for different asset types
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('prp-templates', 'PRP Template Library', true),
  ('enterprise-templates', 'Enterprise Development Templates', true),
  ('config-templates', 'Configuration Templates', true),
  ('debug-screenshots', 'Debug Screenshots Archive', false),
  ('archived-logs', 'Archived Log Files', false),
  ('system-assets', 'System Assets and Resources', true),
  ('agent-resources', 'Agent Resources and Prompts', false)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- PRP TEMPLATE MANAGEMENT
-- ==========================================

-- PRP Templates table for version-controlled template management
CREATE TABLE IF NOT EXISTS prp_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'base', 'advanced', 'mlx', 'dspy', 'agents'
  title TEXT NOT NULL,
  description TEXT,
  template_content TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  storage_path TEXT, -- Supabase storage path if stored as file
  metadata JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(name, version)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_prp_templates_category ON prp_templates(category);
CREATE INDEX IF NOT EXISTS idx_prp_templates_tags ON prp_templates USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_prp_templates_active ON prp_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_prp_templates_created_at ON prp_templates(created_at);

-- ==========================================
-- SYSTEM CONFIGURATION TEMPLATES
-- ==========================================

-- System configurations and templates
CREATE TABLE IF NOT EXISTS system_configurations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_type TEXT NOT NULL, -- 'agent', 'llm', 'service', 'middleware'
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  configuration JSONB NOT NULL,
  schema_version TEXT DEFAULT '1.0',
  is_template BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  storage_path TEXT, -- If stored as file in Supabase storage
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(config_type, name, category)
);

-- Create indexes for configuration queries
CREATE INDEX IF NOT EXISTS idx_system_configurations_type ON system_configurations(config_type);
CREATE INDEX IF NOT EXISTS idx_system_configurations_category ON system_configurations(config_type, category);
CREATE INDEX IF NOT EXISTS idx_system_configurations_template ON system_configurations(is_template);
CREATE INDEX IF NOT EXISTS idx_system_configurations_active ON system_configurations(is_active);

-- ==========================================
-- CLAUDE COMMANDS AND SLASH COMMANDS
-- ==========================================

-- Store Claude commands and slash commands in database
CREATE TABLE IF NOT EXISTS claude_commands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  command_name TEXT NOT NULL UNIQUE, -- e.g., 'generate-prp', 'execute-prp'
  command_description TEXT NOT NULL,
  command_content TEXT NOT NULL, -- Full command template/content
  category TEXT NOT NULL, -- 'prp', 'development', 'analysis'
  parameters TEXT[] DEFAULT '{}', -- Expected parameters
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  storage_path TEXT, -- Path in Supabase storage if stored as file
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for command queries
CREATE INDEX IF NOT EXISTS idx_claude_commands_name ON claude_commands(command_name);
CREATE INDEX IF NOT EXISTS idx_claude_commands_category ON claude_commands(category);
CREATE INDEX IF NOT EXISTS idx_claude_commands_active ON claude_commands(is_active);

-- ==========================================
-- AGENT TEMPLATES AND PROMPTS
-- ==========================================

-- Enhanced agent templates storage
CREATE TABLE IF NOT EXISTS agent_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  agent_type TEXT NOT NULL, -- 'enhanced-base', 'cognitive', 'personal', 'specialized'
  template_category TEXT NOT NULL, -- 'system-prompt', 'config', 'implementation'
  content TEXT NOT NULL,
  parameters JSONB DEFAULT '{}', -- Template parameters
  metadata JSONB DEFAULT '{}',
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  parent_template_id UUID REFERENCES agent_templates(id),
  storage_path TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(name, agent_type, template_category, version)
);

-- Create indexes for agent template queries
CREATE INDEX IF NOT EXISTS idx_agent_templates_type ON agent_templates(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_templates_category ON agent_templates(template_category);
CREATE INDEX IF NOT EXISTS idx_agent_templates_active ON agent_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_agent_templates_parent ON agent_templates(parent_template_id);

-- ==========================================
-- ASSET ARCHIVE AND CLEANUP TRACKING
-- ==========================================

-- Track archived assets for cleanup and retrieval
CREATE TABLE IF NOT EXISTS archived_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_path TEXT NOT NULL,
  storage_bucket TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  asset_type TEXT NOT NULL, -- 'log', 'screenshot', 'backup', 'template'
  file_size BIGINT,
  checksum TEXT, -- For integrity verification
  archived_reason TEXT, -- 'age-limit', 'space-cleanup', 'migration'
  metadata JSONB DEFAULT '{}',
  can_delete_local BOOLEAN DEFAULT false, -- Safe to delete from local filesystem
  retention_until TIMESTAMPTZ, -- When can be permanently deleted
  created_at TIMESTAMPTZ DEFAULT NOW(),
  archived_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for asset management
CREATE INDEX IF NOT EXISTS idx_archived_assets_type ON archived_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_archived_assets_bucket ON archived_assets(storage_bucket);
CREATE INDEX IF NOT EXISTS idx_archived_assets_retention ON archived_assets(retention_until);
CREATE INDEX IF NOT EXISTS idx_archived_assets_can_delete ON archived_assets(can_delete_local);

-- ==========================================
-- ROW LEVEL SECURITY POLICIES
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE prp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE claude_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE archived_assets ENABLE ROW LEVEL SECURITY;

-- PRP Templates policies (public read, authenticated write)
CREATE POLICY "Public can read active PRP templates" ON prp_templates
  FOR SELECT USING (is_active = true);

CREATE POLICY "Authenticated users can create PRP templates" ON prp_templates
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own PRP templates" ON prp_templates
  FOR UPDATE USING (auth.uid() = created_by);

-- System configurations policies (admin only for sensitive configs)
CREATE POLICY "Authenticated users can read system configurations" ON system_configurations
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create system configurations" ON system_configurations
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Claude commands policies (public read for active commands)
CREATE POLICY "Public can read active Claude commands" ON claude_commands
  FOR SELECT USING (is_active = true);

CREATE POLICY "Authenticated users can create Claude commands" ON claude_commands
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Agent templates policies (user-specific access)
CREATE POLICY "Users can read their own agent templates" ON agent_templates
  FOR SELECT USING (auth.uid() = created_by OR is_active = true);

CREATE POLICY "Users can create agent templates" ON agent_templates
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own agent templates" ON agent_templates
  FOR UPDATE USING (auth.uid() = created_by);

-- Archived assets policies (admin access)
CREATE POLICY "Authenticated users can read archived assets" ON archived_assets
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create archived assets" ON archived_assets
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ==========================================
-- STORAGE POLICIES
-- ==========================================

-- PRP Templates bucket (public read)
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'prp-templates');
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'prp-templates' AND auth.role() = 'authenticated');

-- Enterprise Templates bucket (public read)
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'enterprise-templates');
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'enterprise-templates' AND auth.role() = 'authenticated');

-- Config Templates bucket (public read)
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'config-templates');
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'config-templates' AND auth.role() = 'authenticated');

-- System Assets bucket (public read)
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'system-assets');
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'system-assets' AND auth.role() = 'authenticated');

-- Debug Screenshots bucket (authenticated access only)
CREATE POLICY "Authenticated Access" ON storage.objects FOR SELECT USING (bucket_id = 'debug-screenshots' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'debug-screenshots' AND auth.role() = 'authenticated');

-- Archived Logs bucket (authenticated access only)
CREATE POLICY "Authenticated Access" ON storage.objects FOR SELECT USING (bucket_id = 'archived-logs' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'archived-logs' AND auth.role() = 'authenticated');

-- Agent Resources bucket (user-specific access)
CREATE POLICY "User Access" ON storage.objects FOR SELECT USING (bucket_id = 'agent-resources' AND auth.role() = 'authenticated');
CREATE POLICY "User Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'agent-resources' AND auth.role() = 'authenticated');

-- ==========================================
-- HELPER FUNCTIONS
-- ==========================================

-- Function to get active PRP templates by category
CREATE OR REPLACE FUNCTION get_prp_templates(template_category TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  name TEXT,
  category TEXT,
  title TEXT,
  description TEXT,
  template_content TEXT,
  version INTEGER,
  tags TEXT[],
  created_at TIMESTAMPTZ
) LANGUAGE SQL STABLE AS $$
  SELECT 
    t.id, t.name, t.category, t.title, t.description, 
    t.template_content, t.version, t.tags, t.created_at
  FROM prp_templates t
  WHERE t.is_active = true
    AND (template_category IS NULL OR t.category = template_category)
  ORDER BY t.category, t.name, t.version DESC;
$$;

-- Function to get system configurations by type
CREATE OR REPLACE FUNCTION get_system_configurations(config_type_filter TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  config_type TEXT,
  name TEXT,
  category TEXT,
  configuration JSONB,
  is_template BOOLEAN,
  created_at TIMESTAMPTZ
) LANGUAGE SQL STABLE AS $$
  SELECT 
    c.id, c.config_type, c.name, c.category, 
    c.configuration, c.is_template, c.created_at
  FROM system_configurations c
  WHERE c.is_active = true
    AND (config_type_filter IS NULL OR c.config_type = config_type_filter)
  ORDER BY c.config_type, c.category, c.name;
$$;

-- Function to track asset archival
CREATE OR REPLACE FUNCTION archive_asset(
  p_original_path TEXT,
  p_storage_bucket TEXT,
  p_storage_path TEXT,
  p_asset_type TEXT,
  p_file_size BIGINT DEFAULT NULL,
  p_archived_reason TEXT DEFAULT 'migration',
  p_retention_days INTEGER DEFAULT 365
) RETURNS UUID LANGUAGE SQL AS $$
  INSERT INTO archived_assets (
    original_path, storage_bucket, storage_path, asset_type,
    file_size, archived_reason, retention_until
  ) VALUES (
    p_original_path, p_storage_bucket, p_storage_path, p_asset_type,
    p_file_size, p_archived_reason, 
    NOW() + (p_retention_days || ' days')::INTERVAL
  )
  RETURNING id;
$$;

-- ==========================================
-- INITIAL DATA SEEDING
-- ==========================================

-- Insert base PRP template
INSERT INTO prp_templates (name, category, title, description, template_content, tags) VALUES (
  'prp_base',
  'base',
  'Universal AI Tools PRP Template v1',
  'Base PRP template for Universal AI Tools production features',
  'Template content will be loaded from storage',
  ARRAY['base', 'production', 'universal-tools']
) ON CONFLICT (name, version) DO NOTHING;

-- Insert Claude commands
INSERT INTO claude_commands (command_name, command_description, command_content, category, parameters) VALUES 
  ('generate-prp', 'Generate Universal AI Tools PRP', 'Command content will be loaded from storage', 'prp', ARRAY['feature_description']),
  ('execute-prp', 'Execute Universal AI Tools PRP', 'Command content will be loaded from storage', 'prp', ARRAY['prp_file_path'])
ON CONFLICT (command_name) DO NOTHING;

-- Insert system configuration templates
INSERT INTO system_configurations (config_type, name, category, configuration, is_template) VALUES 
  ('agent', 'enhanced-base-template', 'cognitive', '{"systemPrompt": "", "capabilities": [], "maxLatencyMs": 5000}', true),
  ('service', 'context-injection-template', 'ai', '{"maxContextTokens": 4000, "cacheExpiryMs": 300000}', true),
  ('llm', 'ollama-model-template', 'local', '{"baseURL": "http://localhost:11434", "model": "", "temperature": 0.7}', true)
ON CONFLICT (config_type, name, category) DO NOTHING;