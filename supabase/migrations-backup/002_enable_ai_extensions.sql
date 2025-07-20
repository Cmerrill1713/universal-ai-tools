-- Enable AI and memory-related extensions for Universal AI Tools

-- Core AI Extensions
CREATE EXTENSION IF NOT EXISTS vector; -- pgvector for embeddings and similarity search
CREATE EXTENSION IF NOT EXISTS pg_jsonschema; -- JSON validation for structured data
CREATE EXTENSION IF NOT EXISTS pg_cron; -- Scheduled jobs for memory management

-- Performance and Indexing Extensions
CREATE EXTENSION IF NOT EXISTS btree_gin; -- Better indexing for composite queries
CREATE EXTENSION IF NOT EXISTS btree_gist; -- GiST indexing support
-- CREATE EXTENSION IF NOT EXISTS rum; -- Not available in Supabase local

-- Monitoring and Analytics Extensions (only those available in Supabase)
-- CREATE EXTENSION IF NOT EXISTS pg_stat_monitor; -- Not available in Supabase local
-- CREATE EXTENSION IF NOT EXISTS index_advisor; -- Not available in Supabase local
-- CREATE EXTENSION IF NOT EXISTS hypopg; -- Not available in Supabase local

-- Text and Similarity Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- Trigram similarity for fuzzy text matching
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch; -- String similarity functions

-- Utility Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- Additional UUID functions
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- Cryptographic functions for security

-- Print confirmation
DO $$
BEGIN
    RAISE NOTICE 'AI Extensions enabled successfully';
    RAISE NOTICE 'pgvector version: %', (SELECT extversion FROM pg_extension WHERE extname = 'vector');
END $$;