-- Create MCP (Model Context Protocol) tables
-- These tables are needed for the MCP integration service

-- MCP agent sessions table
CREATE TABLE IF NOT EXISTS mcp_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT UNIQUE NOT NULL,
    agent_id TEXT NOT NULL,
    context JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Normalize to support existing deployments that may have different columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='mcp_messages'
  ) THEN
    CREATE TABLE mcp_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id TEXT REFERENCES mcp_sessions(session_id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  ELSE
    -- Ensure required columns exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='mcp_messages' AND column_name='session_id'
    ) THEN
      EXECUTE 'ALTER TABLE mcp_messages ADD COLUMN session_id TEXT';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='mcp_messages' AND column_name='role'
    ) THEN
      EXECUTE 'ALTER TABLE mcp_messages ADD COLUMN role TEXT CHECK (role IN (''user'',''assistant'',''system''))';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='mcp_messages' AND column_name='metadata'
    ) THEN
      EXECUTE 'ALTER TABLE mcp_messages ADD COLUMN metadata JSONB DEFAULT ''{}''::jsonb';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='mcp_messages' AND column_name='created_at'
    ) THEN
      EXECUTE 'ALTER TABLE mcp_messages ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW()';
    END IF;
  END IF;
END$$;

-- MCP tools table
CREATE TABLE IF NOT EXISTS mcp_tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    parameters JSONB NOT NULL,
    handler TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_mcp_sessions_agent_id ON mcp_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_mcp_messages_session_id ON mcp_messages(session_id);
-- Create index only if column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='mcp_messages' AND column_name='created_at'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_mcp_messages_created_at ON mcp_messages(created_at DESC)';
  END IF;
END$$;
-- Create index on tool name if the column exists; otherwise use tool_name
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='mcp_tools' AND column_name='name'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_mcp_tools_name ON mcp_tools(name)';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='mcp_tools' AND column_name='tool_name'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_mcp_tools_name ON mcp_tools(tool_name)';
  END IF;
END$$;

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_mcp_sessions_updated_at'
  ) THEN
    EXECUTE 'CREATE TRIGGER update_mcp_sessions_updated_at BEFORE UPDATE ON mcp_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_mcp_tools_updated_at'
  ) THEN
    EXECUTE 'CREATE TRIGGER update_mcp_tools_updated_at BEFORE UPDATE ON mcp_tools FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()';
  END IF;
END$$;
