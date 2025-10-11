# Migration Cleanup Plan

## Current Migration Issues
- Duplicate migration numbers (004_pattern_analytics.sql, 004_simple_analytics.sql)
- Conflicting migration files
- Some migrations may have failed during previous runs

## Clean Migration Sequence (Keeping Only Essential Ones)

### Core Migrations (Working)
1. `000_exec_sql_function.sql` - Essential SQL execution function
2. `001_consolidated_schema.sql` - Core database schema
3. `002_comprehensive_knowledge_system.sql` - Knowledge system tables
4. `003_architecture_knowledge.sql` - Architecture patterns system
5. `004_pattern_analytics_fixed.sql` - Fixed pattern analytics (keeping this one)
6. `20250730021000_template_and_asset_management.sql` - Template system
7. `20250730030000_mcp_context_system.sql` - MCP context tables
8. `20250731040000_context_storage_system.sql` - Context storage (new)

### Archived/Removed
- `004_pattern_analytics.sql` (duplicate)
- `004_simple_analytics.sql` (duplicate)
- `005_storage_and_edge_functions.sql` (moved to archive - may conflict)

## Next Steps
1. Reset Supabase local database
2. Apply clean migration sequence
3. Test all migrations work properly
4. Commit clean git state