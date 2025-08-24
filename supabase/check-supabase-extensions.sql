-- Check currently enabled extensions
SELECT 
    extname AS extension_name,
    extversion AS version,
    extnamespace::regnamespace AS schema
FROM pg_extension
ORDER BY extname;

-- Check available extensions
SELECT name, comment 
FROM pg_available_extensions 
WHERE name IN (
    'vector',
    'pg_graphql',
    'pg_cron',
    'pgtap',
    'plv8',
    'pg_net',
    'wrappers',
    'pg_jsonschema',
    'pg_hashids',
    'pgaudit',
    'pgjwt',
    'pg_stat_monitor',
    'hypopg',
    'index_advisor'
)
ORDER BY name;
EOF < /dev/null