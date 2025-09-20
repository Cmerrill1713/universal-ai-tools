# Database Migration Consolidation Guide for Claude
## Current Migration Chaos
**CRITICAL**: 41 migration files with conflicts, duplicates, and inconsistent approaches. This guide helps Claude consolidate migrations safely.
## Migration Inventory
### Duplicate/Conflicting Migrations

#### Memory Tables (3 versions - CONFLICT!)

1. **003_enhanced_memory_tables.sql** - Creates `memories` table with vector(1536)

2. **20250719191801_create_memories.sql** - Creates `memories` table again

3. **001_ai_agents_tables.sql** - Creates `ai_memories` table (different name!)

#### Ollama Functions (3 versions - CONFLICT!)

1. **20250119_ollama_ai_functions.sql** - Basic Ollama integration

2. **20250119_ollama_ai_functions_simple.sql** - Simplified version

3. **20250119_ollama_via_nginx.sql** - NGINX routing version

#### Vector Dimensions (2 approaches - CONFLICT!)

1. **009_variable_embedding_dimensions.sql** - Dynamic dimensions

2. **011_fix_hardcoded_dimensions.sql** - Still uses hardcoded vector(1536)
### Security Concerns

31 SECURITY DEFINER functions that execute with owner privileges:

- `search_memories`

- `hybrid_search`

- `consolidate_memories`

- `ollama_chat`

- `ollama_embed`

- (and 26 more...)
## Consolidation Strategy
### Phase 1: Analyze Current State

```sql

-- Check what actually exists in database

SELECT table_name, column_name, data_type, udt_name

FROM information_schema.columns

WHERE table_schema = 'public'

AND table_name IN ('memories', 'ai_memories', 'memory', 'memory_metadata')

ORDER BY table_name, ordinal_position;
-- Check existing functions

SELECT routine_name, security_type

FROM information_schema.routines

WHERE routine_schema = 'public'

AND security_type = 'DEFINER';
-- Check for migration history table

SELECT * FROM schema_migrations ORDER BY version;

```
### Phase 2: Create Master Migration Plan

#### Step 1: Backup Everything

```bash
# Create full backup before starting

pg_dump -h localhost -U postgres -d your_database > backup_before_consolidation.sql

```

#### Step 2: Disable Conflicting Migrations

Rename these files to `.disabled`:

- `20250119_ollama_ai_functions_simple.sql.disabled`

- `20250119_ollama_via_nginx.sql.disabled`

- `001_ai_agents_tables.sql.disabled` (if memories table exists)

#### Step 3: Create Consolidation Migration

Create `999_consolidation_fix.sql`:

```sql

-- Migration consolidation fixes

BEGIN;
-- 1. Standardize memory table name

DO $$

BEGIN

    -- If ai_memories exists but memories doesn't, rename it

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_memories')

       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'memories') THEN

        ALTER TABLE ai_memories RENAME TO memories;

    END IF;

    

    -- If both exist, merge data and drop ai_memories

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_memories')

       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'memories') THEN

        -- Merge data (handle duplicates)

        INSERT INTO memories (id, content, metadata, embedding, created_at, updated_at)

        SELECT id, content, metadata, embedding, created_at, updated_at

        FROM ai_memories

        ON CONFLICT (id) DO NOTHING;

        

        DROP TABLE ai_memories CASCADE;

    END IF;

END $$;
-- 2. Fix vector dimensions to be consistent

ALTER TABLE memories 

ALTER COLUMN embedding TYPE vector(1536) USING embedding::vector(1536);
-- 3. Add missing indexes

CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at);

CREATE INDEX IF NOT EXISTS idx_memories_metadata ON memories USING gin(metadata);
-- 4. Update SECURITY DEFINER functions to SECURITY INVOKER

DO $$

DECLARE

    func RECORD;

BEGIN

    FOR func IN 

        SELECT routine_name 

        FROM information_schema.routines 

        WHERE routine_schema = 'public' 

        AND security_type = 'DEFINER'

    LOOP

        EXECUTE format('ALTER FUNCTION %I() SECURITY INVOKER', func.routine_name);

    END LOOP;

END $$;
COMMIT;

```
### Phase 3: Testing Strategy

#### Pre-Consolidation Tests

```javascript

// Test current functionality before changes

const testMemoryOperations = async () => {

    // Test creating memory

    const memory = await supabase

        .from('memories')

        .insert({ content: 'Test memory', metadata: {} })

        .select()

        .single();

    

    // Test searching

    const search = await supabase

        .rpc('search_memories', { query_text: 'test' });

    

    // Test vector operations

    const vectorSearch = await supabase

        .rpc('vector_search', { 

            query_embedding: new Array(1536).fill(0.1),

            match_threshold: 0.7

        });

        

    return { memory, search, vectorSearch };

};

```

#### Post-Consolidation Validation

1. All memory operations work

2. Vector searches return results

3. No duplicate data

4. Performance is acceptable

5. All functions execute without errors
### Phase 4: Clean Migration Structure
Create new structure:

```

supabase/migrations/

├── 001_initial_schema.sql          # Core tables

├── 002_extensions.sql              # Required extensions

├── 003_memory_system.sql           # Memory tables and functions

├── 004_agent_system.sql            # Agent tables

├── 005_vector_search.sql           # Vector search functions

├── 006_ollama_integration.sql      # Ollama functions (single version)

├── 007_security_policies.sql       # RLS policies

└── archive/                        # Old migrations moved here

```
## Common Issues & Solutions
### Issue 1: "relation already exists"

```sql

-- Use CREATE TABLE IF NOT EXISTS

CREATE TABLE IF NOT EXISTS memories (...);
-- Or check first

DO $$

BEGIN

    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'memories') THEN

        CREATE TABLE memories (...);

    END IF;

END $$;

```
### Issue 2: "type vector does not exist"

```sql

-- Ensure pgvector is enabled

CREATE EXTENSION IF NOT EXISTS vector;

```
### Issue 3: Function signature conflicts

```sql

-- Drop existing function before recreating

DROP FUNCTION IF EXISTS search_memories(text, integer);

CREATE FUNCTION search_memories(query text, limit_count integer DEFAULT 10) ...

```
### Issue 4: Data type mismatches

```sql

-- Safe type conversion

ALTER TABLE memories 

ALTER COLUMN embedding TYPE vector(1536) 

USING 

    CASE 

        WHEN embedding IS NULL THEN NULL

        WHEN array_length(embedding::float[], 1) = 1536 THEN embedding::vector(1536)

        ELSE NULL  -- or handle differently

    END;

```
## Migration Testing Checklist
- [ ] Backup created before any changes

- [ ] Test environment migrations successful

- [ ] All tables have correct structure

- [ ] No duplicate functions

- [ ] Vector operations work

- [ ] Memory CRUD operations work

- [ ] Agent system functions work

- [ ] Performance acceptable

- [ ] No SECURITY DEFINER functions remain

- [ ] Documentation updated
## Rollback Plan
If consolidation fails:

```bash
# Restore from backup

psql -h localhost -U postgres -d your_database < backup_before_consolidation.sql

# Re-enable disabled migrations if needed

mv 20250119_ollama_ai_functions_simple.sql.disabled 20250119_ollama_ai_functions_simple.sql

```
## Best Practices Going Forward
1. **One Migration Per Feature** - Don't duplicate functionality

2. **Use IF EXISTS Checks** - Make migrations idempotent

3. **Version Consistently** - Use timestamps: YYYYMMDDHHMMSS_description.sql

4. **Test First** - Always test on a copy of production data

5. **Document Changes** - Add comments explaining why

6. **No SECURITY DEFINER** - Use SECURITY INVOKER unless absolutely necessary

7. **Atomic Changes** - Use transactions for related changes
## Quick Commands
```bash
# List all migrations

ls -la supabase/migrations/*.sql | wc -l

# Find duplicate patterns

ls supabase/migrations/*memory*.sql

ls supabase/migrations/*ollama*.sql

# Check for SECURITY DEFINER

grep -n "SECURITY DEFINER" supabase/migrations/*.sql

# Run specific migration

psql -f supabase/migrations/999_consolidation_fix.sql

```
## When in Doubt
1. **Don't Rush** - Migration errors can corrupt data

2. **Test Locally First** - Use Supabase local development

3. **Keep Backups** - Before and after each major change

4. **Document Everything** - Future you will thank you

5. **Ask for Review** - Migration changes should be peer-reviewed