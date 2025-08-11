-- Curated, security-conscious enablement of useful Postgres extensions
-- This migration is idempotent and only enables extensions if available.

BEGIN;

-- Ensure the common extension schema exists (Supabase convention)
CREATE SCHEMA IF NOT EXISTS extensions;

-- Core text/types utilities
CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS hstore WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

-- JSON schema validation for structured metadata
CREATE EXTENSION IF NOT EXISTS pg_jsonschema WITH SCHEMA extensions;

-- JWT helpers (used by apps; no direct DB network access)
CREATE EXTENSION IF NOT EXISTS pgjwt WITH SCHEMA extensions;

-- Scheduling (local dev convenience; assess before enabling in prod)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Auditing
CREATE EXTENSION IF NOT EXISTS pgaudit WITH SCHEMA extensions;

-- Hypothetical indexes for performance planning
CREATE EXTENSION IF NOT EXISTS hypopg WITH SCHEMA extensions;

-- Index helpers and trigram search
CREATE EXTENSION IF NOT EXISTS btree_gin WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- Vectors for embeddings (already present on many setups)
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- UUID/crypto helpers
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Explicitly NOT enabling http/pg_net to comply with DB egress lockdown
-- CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions; -- intentionally omitted
-- CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions; -- intentionally omitted

COMMIT;


