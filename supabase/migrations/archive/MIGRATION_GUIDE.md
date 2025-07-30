# Database Migration Guide

## Overview

This guide explains how to migrate from the fragmented migration files to the unified production schema v3.

## Current State

### Problems with Existing Migrations
- **41 migration files** with conflicts and duplicates
- **Duplicate migration numbers** (two files numbered 024)
- **Conflicting table definitions** (memories, widgets)
- **Mixed vector dimensions** (384 vs 1536)
- **Security risks** (SECURITY DEFINER functions, hardcoded credentials)
- **Non-existent table references** in vector search functions

### Solution: Unified Schema v3
- Single consolidated migration file
- Conflict-free table definitions
- Standardized vector dimensions (1536)
- All functions use SECURITY INVOKER
- Comprehensive RLS policies
- Production-ready indexes

## Migration Steps

### 1. Backup Current Database

```bash
# Create a full backup
pg_dump -h your-host -U postgres -d your-database > backup_$(date +%Y%m%d_%H%M%S).sql

# Or use Supabase CLI
supabase db dump > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Test Migration in Development

```bash
# Create a test database
supabase db reset --local

# Apply the unified schema
supabase db push --local migrations/003_unified_production_schema.sql

# Run data migration
supabase db push --local migrations/004_data_migration.sql

# Verify migration
npm run migrate:verify
```

### 3. Review Migration Changes

Key changes in v3:
- **Unified memory system**: Single `memories` table with 1536-dim vectors
- **Unified widget system**: Single `widgets` table with proper versioning
- **Enhanced security**: All functions use SECURITY INVOKER
- **Comprehensive RLS**: Policies on all tables
- **Performance indexes**: Vector, JSONB, and text search indexes

### 4. Apply to Production

```bash
# 1. Set maintenance mode (if applicable)
# 2. Create final backup
supabase db dump > pre_migration_backup.sql

# 3. Apply unified schema
supabase migration up 003_unified_production_schema.sql

# 4. Run data migration
supabase migration up 004_data_migration.sql

# 5. Verify migration
npm run migrate:verify

# 6. Remove maintenance mode
```

### 5. Post-Migration Tasks

1. **Update application code**:
   - Update vector dimension to 1536 in embedding services
   - Update table references (ai_memories → memories, ai_widgets → widgets)
   - Update any raw SQL queries

2. **Regenerate embeddings** (if needed):
   ```sql
   -- If you were using 384-dim vectors, you'll need to regenerate
   UPDATE memories SET embedding = NULL WHERE vector_dims(embedding) = 384;
   ```

3. **Clean up old tables** (after verification):
   ```sql
   -- Only after confirming data migration success
   DROP TABLE IF EXISTS ai_memories CASCADE;
   DROP TABLE IF EXISTS ai_widgets CASCADE;
   -- etc.
   ```

## Rollback Procedure

If issues occur, you can rollback:

```bash
# 1. Apply rollback script
supabase migration up 005_rollback_to_v2.sql

# 2. Restore from backup if needed
psql -h your-host -U postgres -d your-database < pre_migration_backup.sql
```

## Migration Verification

Run the verification script to ensure migration success:

```bash
npm run migrate:verify
```

This checks:
- ✅ Schema version
- ✅ Required tables exist
- ✅ Table structures correct
- ✅ Vector dimensions (1536)
- ✅ No duplicate migrations
- ✅ No SECURITY DEFINER functions
- ✅ RLS policies enabled
- ✅ Critical indexes exist
- ✅ Data integrity

## Troubleshooting

### Common Issues

1. **"Unified schema not found" error**
   - Ensure 003_unified_production_schema.sql ran successfully
   - Check schema_migrations table

2. **Vector dimension mismatch**
   - Old embeddings may be 384-dim
   - Regenerate embeddings using your embedding service

3. **Missing data after migration**
   - Check source tables still exist
   - Review migration logs for errors
   - Use backup to investigate

4. **Permission errors**
   - Ensure service role is used for migration
   - Check RLS policies aren't blocking migration

### Getting Help

1. Check migration logs in Supabase dashboard
2. Review the verification script output
3. Consult the rollback procedure if needed
4. Keep backups until migration is verified

## Production Checklist

- [ ] Backup current database
- [ ] Test migration in development
- [ ] Review all schema changes
- [ ] Update application code
- [ ] Schedule maintenance window
- [ ] Apply migration
- [ ] Run verification
- [ ] Test application thoroughly
- [ ] Monitor for issues
- [ ] Clean up old tables (after 1 week)

## Summary

The unified schema v3 provides a clean, conflict-free foundation for production deployment. It consolidates 41 migrations into a single, well-structured schema with proper security, performance optimizations, and data integrity constraints.