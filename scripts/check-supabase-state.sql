-- Check Supabase Database State
-- Run this in Supabase SQL Editor

-- 1. Check currently enabled extensions
SELECT 
    extname AS extension_name,
    extversion AS version,
    extnamespace::regnamespace AS schema
FROM pg_extension
ORDER BY extname;

-- 2. Check if specific extensions are available
SELECT 
    name,
    installed_version,
    comment
FROM pg_available_extensions
WHERE name IN (
    'vector',
    'pg_cron', 
    'pg_net',
    'pgjwt',
    'pg_jsonschema',
    'pg_graphql',
    'wrappers',
    'pg_stat_statements',
    'hypopg',
    'pgaudit'
)
ORDER BY name;

-- 3. Check for tables with vector columns
SELECT 
    table_schema,
    table_name,
    column_name,
    data_type,
    udt_name
FROM information_schema.columns
WHERE udt_name = 'vector'
ORDER BY table_schema, table_name, column_name;

-- 4. Check if cron schema exists
SELECT 
    schema_name 
FROM information_schema.schemata 
WHERE schema_name = 'cron';

-- 5. Check our AI-related tables
SELECT 
    schemaname,
    tablename,
    n_live_tup as row_count
FROM pg_stat_user_tables
WHERE tablename IN (
    'ai_memories',
    'ai_service_keys',
    'agent_performance_metrics',
    'knowledge_sources',
    'mlx_fine_tuning_jobs',
    'intelligent_parameters',
    'webhook_events',
    'scheduled_jobs'
)
ORDER BY tablename;

-- 6. Check if we have any migrations table
SELECT 
    tablename,
    n_live_tup as migration_count
FROM pg_stat_user_tables
WHERE tablename LIKE '%migration%'
ORDER BY tablename;

-- 7. Database size info
SELECT 
    pg_database.datname as database_name,
    pg_size_pretty(pg_database_size(pg_database.datname)) as size
FROM pg_database
WHERE datname = current_database();

-- 8. Check for existing functions that might use extensions
SELECT 
    routine_schema,
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema NOT IN ('pg_catalog', 'information_schema')
AND (
    routine_name LIKE '%vector%'
    OR routine_name LIKE '%embedding%'
    OR routine_name LIKE '%webhook%'
    OR routine_name LIKE '%cron%'
)
ORDER BY routine_schema, routine_name;