-- Run this in your Supabase SQL Editor to check extensions

-- 1. Show all currently enabled extensions
SELECT 
    extname AS "Extension Name",
    extversion AS "Version",
    extnamespace::regnamespace AS "Schema"
FROM pg_extension
WHERE extname NOT IN ('plpgsql')
ORDER BY extname;

-- 2. Check if key extensions are enabled
SELECT 
    'vector' as extension,
    EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector') as enabled
UNION ALL
SELECT 
    'pg_cron' as extension,
    EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') as enabled
UNION ALL
SELECT 
    'pg_net' as extension,
    EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_net') as enabled
UNION ALL
SELECT 
    'pgjwt' as extension,
    EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pgjwt') as enabled
UNION ALL
SELECT 
    'pg_jsonschema' as extension,
    EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_jsonschema') as enabled
UNION ALL
SELECT 
    'pg_graphql' as extension,
    EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_graphql') as enabled;

-- 3. Check for vector columns in our tables
SELECT 
    c.table_name,
    c.column_name,
    c.data_type
FROM information_schema.columns c
WHERE c.table_schema = 'public'
AND c.udt_name = 'vector';

-- 4. Check if we need to add vector columns
SELECT 
    'ai_memories' as table_name,
    EXISTS(
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ai_memories' 
        AND column_name = 'embedding'
        AND table_schema = 'public'
    ) as has_embedding_column
UNION ALL
SELECT 
    'knowledge_sources' as table_name,
    EXISTS(
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'knowledge_sources' 
        AND column_name = 'content_embedding'
        AND table_schema = 'public'
    ) as has_embedding_column;