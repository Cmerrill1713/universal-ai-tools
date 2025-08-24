# Supabase Migration Status

Last Updated: August 18, 2025

## Overview

This document tracks the status of Supabase migrations and provides solutions for common issues.

## Migration Status

### ✅ Active Migrations (Working)

These migrations are currently active and working:

1. **002_comprehensive_knowledge_rollback.sql** - Rollback for knowledge base tables
2. **013_autonomous_actions_tables.sql** - Autonomous action tracking
3. **014_proactive_tasks_tables.sql** - Proactive task management
4. **20250119_ollama_ai_functions.sql** - Ollama AI function definitions
5. **20250730021000_template_and_asset_management.sql** - Template and asset system
6. **20250730030000_mcp_context_system.sql** - MCP context with vector search
7. **20250731040000_context_storage_system.sql** - Context storage infrastructure

### ❌ Disabled Migrations (Backed up with .backup extension)

These migrations have issues and are temporarily disabled:

#### Schema Conflicts
- **000_complete_consolidated_schema.sql** - Duplicate schema definitions
- **001_consolidated_schema.sql** - Conflicts with existing tables
- **000_consolidated_rollback.sql** - References non-existent tables

#### Missing Dependencies
- **20250803153243_fix_parameter_executions_table.sql** - Missing trigger function
- **20250808_verified_facts.sql** - Missing `trigger_set_timestamp()` function
- **20250808_verified_facts_rls.sql** - Table `verified_facts` doesn't exist

#### Type Mismatches
- **20250807000000_autonomous_actions_tables.sql** - Foreign key type mismatch (text vs uuid)
- **20250807_create_mcp_tables.sql** - Missing `user_id` column
- **20250808_fix_mcp_tables.sql** - References non-existent columns

#### Policy Syntax Errors
- **20250804220938_create_memories.sql** - Fixed: RLS policy syntax corrected

#### August 2025 Migrations (All disabled)
All migrations from August 3rd onwards have various compatibility issues and are backed up.

## Common Issues and Solutions

### Issue 1: Foreign Key Type Mismatch

**Error**: 
```sql
ERROR: foreign key constraint "table_name_fkey" cannot be implemented
Key columns "column1" and "column2" are of incompatible types: text and uuid.
```

**Solution**:
```bash
# Backup the problematic migration
mv supabase/migrations/problematic_migration.sql supabase/migrations/problematic_migration.sql.backup

# Restart Supabase
npx supabase stop && npx supabase start
```

### Issue 2: Missing Functions

**Error**:
```sql
ERROR: function trigger_set_timestamp() does not exist
```

**Solution**:
Create the missing function before running migrations:
```sql
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Issue 3: Duplicate Schema

**Error**:
```sql
ERROR: duplicate key value violates unique constraint "schema_migrations_pkey"
```

**Solution**:
```bash
# Remove conflicting migrations
rm supabase/migrations/000_*.sql
rm supabase/migrations/001_*.sql

# Restart fresh
npx supabase stop && npx supabase start
```

### Issue 4: RLS Policy Syntax

**Error**:
```sql
ERROR: only WITH CHECK expression allowed for INSERT
```

**Solution**:
Correct policy syntax:
```sql
-- Wrong
CREATE POLICY name ON table FOR INSERT TO PUBLIC USING (true) WITH CHECK (true);

-- Correct
CREATE POLICY name ON table FOR INSERT WITH CHECK (true);
```

## Migration Management Commands

### Start Fresh Database
```bash
# Complete reset
npx supabase stop
npx supabase db reset
npx supabase start
```

### Check Migration Status
```bash
# View current status
npx supabase status

# List migrations
ls -la supabase/migrations/

# View backed up migrations
ls -la supabase/migrations/*.backup
```

### Restore Backed Up Migration
```bash
# Restore a specific migration
mv supabase/migrations/migration_name.sql.backup supabase/migrations/migration_name.sql

# Apply it
npx supabase db push
```

### Create New Migration
```bash
# Create new migration file
npx supabase migration new migration_name

# Edit the file
code supabase/migrations/*_migration_name.sql

# Apply it
npx supabase db push
```

## Best Practices

1. **Always backup migrations before modifying**
   ```bash
   cp migration.sql migration.sql.backup
   ```

2. **Test migrations locally first**
   ```bash
   npx supabase start --local
   ```

3. **Use conditional checks in migrations**
   ```sql
   -- Check if table exists
   CREATE TABLE IF NOT EXISTS table_name (...);
   
   -- Check if column exists
   DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                    WHERE table_name='table' AND column_name='column') THEN
       ALTER TABLE table ADD COLUMN column TYPE;
     END IF;
   END $$;
   ```

4. **Handle rollbacks properly**
   ```sql
   -- In migration file
   BEGIN;
     -- Your changes
   COMMIT;
   
   -- In rollback file
   BEGIN;
     -- Undo changes
   ROLLBACK;
   ```

## Current Database Schema

After successful migrations, the following tables are available:

- `autonomous_actions` - Autonomous action tracking
- `proactive_tasks` - Proactive task management
- `agent_templates` - Agent configuration templates
- `system_configurations` - System configuration storage
- `mcp_context` - MCP context with vector embeddings
- `mcp_error_analysis` - Error pattern analysis
- `mcp_task_progress` - Task execution tracking
- `context_storage` - General context storage
- `goals` - User goals and milestones

## Recovery Procedures

### If Supabase Won't Start

1. **Check Docker containers**
   ```bash
   docker ps -a | grep supabase
   docker logs supabase_db_universal-ai-tools
   ```

2. **Clean and restart**
   ```bash
   npx supabase stop --backup
   rm -rf .supabase/
   npx supabase start
   ```

3. **Use minimal migrations**
   ```bash
   # Move all migrations to backup
   mkdir -p supabase/migrations/archive
   mv supabase/migrations/*.sql supabase/migrations/archive/
   
   # Copy only working migrations back
   cp supabase/migrations/archive/002_*.sql supabase/migrations/
   cp supabase/migrations/archive/013_*.sql supabase/migrations/
   cp supabase/migrations/archive/014_*.sql supabase/migrations/
   
   # Start fresh
   npx supabase start
   ```

## Future Migration Strategy

1. **Consolidate migrations** - Combine all working migrations into a single baseline
2. **Add version checks** - Include schema version tracking
3. **Implement safe rollbacks** - Ensure all migrations have safe rollback procedures
4. **Test in CI/CD** - Add migration testing to GitHub Actions
5. **Document dependencies** - Clearly document function and table dependencies