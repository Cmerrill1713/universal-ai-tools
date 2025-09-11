-- Migration System Setup
-- Creates required tables and functions for the custom migration system

-- Create schema_migrations table
CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    checksum TEXT NOT NULL,
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    applied_by TEXT DEFAULT current_user,
    execution_time_ms INTEGER,
    rollback_sql TEXT,
    UNIQUE(name)
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_migrations_applied_at 
ON schema_migrations(applied_at DESC);

-- Function to execute arbitrary SQL (admin only)
CREATE OR REPLACE FUNCTION execute_sql(sql TEXT)
RETURNS VOID AS $$
BEGIN
  -- Simple execution for now - permissions handled at application level
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Transaction management functions
CREATE OR REPLACE FUNCTION begin_transaction()
RETURNS VOID AS $$
BEGIN
  -- In Supabase, each RPC call is already in a transaction
  -- This is a placeholder for explicit transaction control
  NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION commit_transaction()
RETURNS VOID AS $$
BEGIN
  -- Placeholder - transaction commits automatically
  NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION rollback_transaction()
RETURNS VOID AS $$
BEGIN
  -- This will actually rollback the current transaction
  RAISE EXCEPTION 'Rollback requested';
END;
$$ LANGUAGE plpgsql;

-- Function to create migration table (used by migration service)
CREATE OR REPLACE FUNCTION create_migration_table(sql TEXT)
RETURNS VOID AS $$
BEGIN
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check database health
CREATE OR REPLACE FUNCTION health_check_db()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  -- Simple health check - verify database is accessible
  SELECT json_build_object(
    'status', 'healthy',
    'timestamp', NOW(),
    'version', version()
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION execute_sql(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION create_migration_table(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION health_check_db() TO service_role, anon, authenticated;
GRANT EXECUTE ON FUNCTION begin_transaction() TO service_role;
GRANT EXECUTE ON FUNCTION commit_transaction() TO service_role;
GRANT EXECUTE ON FUNCTION rollback_transaction() TO service_role;

-- Grant table permissions
GRANT ALL ON schema_migrations TO service_role;
GRANT SELECT ON schema_migrations TO authenticated;

-- Migration system setup completed successfully