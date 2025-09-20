-- Migration: Create code_templates table and fix missing tables
-- Date: 2025-08-30
-- Description: Creates the code_templates table required by the evolution service

-- Create code_templates table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.code_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  template_type TEXT NOT NULL CHECK (template_type IN ('component', 'service', 'utility', 'test', 'config', 'agent')),
  language TEXT NOT NULL DEFAULT 'typescript',
  template_content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  is_active BOOLEAN DEFAULT true
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_code_templates_type ON public.code_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_code_templates_language ON public.code_templates(language);
CREATE INDEX IF NOT EXISTS idx_code_templates_tags ON public.code_templates USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_code_templates_active ON public.code_templates(is_active) WHERE is_active = true;

-- Add RLS policies
ALTER TABLE public.code_templates ENABLE ROW LEVEL SECURITY;

-- Policy for reading templates (everyone can read active templates)
CREATE POLICY "code_templates_read_policy" ON public.code_templates
  FOR SELECT
  USING (is_active = true);

-- Policy for inserting templates (authenticated users only)
CREATE POLICY "code_templates_insert_policy" ON public.code_templates
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Policy for updating templates (only creator can update)
CREATE POLICY "code_templates_update_policy" ON public.code_templates
  FOR UPDATE
  USING (created_by = auth.uid() OR auth.uid() IS NOT NULL);

-- Policy for deleting templates (only creator can delete)
CREATE POLICY "code_templates_delete_policy" ON public.code_templates
  FOR DELETE
  USING (created_by = auth.uid());

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_code_templates_updated_at
  BEFORE UPDATE ON public.code_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert some default templates
INSERT INTO public.code_templates (name, description, template_type, language, template_content, tags)
VALUES 
  ('TypeScript Service', 'Basic TypeScript service template', 'service', 'typescript', 
   E'import { log, LogContext } from \'@/utils/logger\';\n\nexport class {{ServiceName}} {\n  constructor() {\n    log.info(\'{{ServiceName}} initialized\', LogContext.SERVICE);\n  }\n\n  async execute(): Promise<void> {\n    // Implementation here\n  }\n}', 
   ARRAY['typescript', 'service', 'basic']),
  
  ('React Component', 'Basic React functional component', 'component', 'typescript',
   E'import React from \'react\';\n\ninterface {{ComponentName}}Props {\n  // Define props here\n}\n\nexport const {{ComponentName}}: React.FC<{{ComponentName}}Props> = (props) => {\n  return (\n    <div>\n      {/* Component content */}\n    </div>\n  );\n};',
   ARRAY['react', 'component', 'typescript']),
   
  ('Express Router', 'Express router template', 'utility', 'typescript',
   E'import { Router } from \'express\';\nimport { handleValidationErrors } from \'@/middleware/request-validator\';\nimport { authenticate } from \'@/middleware/auth\';\n\nconst router = Router();\n\nrouter.get(\'/{{endpoint}}\', authenticate, async (req, res, next) => {\n  try {\n    // Implementation here\n    res.json({ success: true });\n  } catch (error) {\n    next(error);\n  }\n});\n\nexport default router;',
   ARRAY['express', 'router', 'api'])
ON CONFLICT DO NOTHING;

-- Create MCP context tables if they don't exist
CREATE TABLE IF NOT EXISTS public.mcp_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  source TEXT,
  user_id UUID,
  project_path TEXT,
  title TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.mcp_code_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_type TEXT NOT NULL,
  pattern_type TEXT NOT NULL,
  pattern TEXT NOT NULL,
  solution TEXT,
  frequency INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.mcp_task_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for MCP tables
CREATE INDEX IF NOT EXISTS idx_mcp_context_category ON public.mcp_context(category);
CREATE INDEX IF NOT EXISTS idx_mcp_context_user ON public.mcp_context(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_code_patterns_error ON public.mcp_code_patterns(error_type);
CREATE INDEX IF NOT EXISTS idx_mcp_task_progress_status ON public.mcp_task_progress(status);

-- Add update triggers for MCP tables
CREATE TRIGGER update_mcp_context_updated_at
  BEFORE UPDATE ON public.mcp_context
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mcp_code_patterns_updated_at
  BEFORE UPDATE ON public.mcp_code_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mcp_task_progress_updated_at
  BEFORE UPDATE ON public.mcp_task_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT ALL ON public.code_templates TO authenticated;
GRANT ALL ON public.mcp_context TO authenticated;
GRANT ALL ON public.mcp_code_patterns TO authenticated;
GRANT ALL ON public.mcp_task_progress TO authenticated;

COMMENT ON TABLE public.code_templates IS 'Stores code templates for the evolution service';
COMMENT ON TABLE public.mcp_context IS 'Stores context information for the MCP service';
COMMENT ON TABLE public.mcp_code_patterns IS 'Stores code patterns and solutions for error resolution';
COMMENT ON TABLE public.mcp_task_progress IS 'Tracks task progress for the MCP service';