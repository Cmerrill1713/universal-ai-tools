#!/usr/bin/env tsx
/**
 * Verify database migration integrity
 * Checks for conflicts, missing tables, and data consistency
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../src/config';
import { logger } from '../src/utils/enhanced-logger';

interface MigrationCheck {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

class MigrationVerifier {
  private supabase;
  private checks: MigrationCheck[] = [];

  constructor() {
    this.supabase = createClient(config.supabase.url, config.supabase.serviceKey);
  }

  async verify() {
    console.log('🔍 Starting migration verification...\n');

    // Run all checks
    await this.checkSchemaVersion();
    await this.checkRequiredTables();
    await this.checkTableStructure();
    await this.checkVectorDimensions();
    await this.checkDuplicateMigrations();
    await this.checkSecurityDefinerFunctions();
    await this.checkRLSPolicies();
    await this.checkIndexes();
    await this.checkDataIntegrity();

    // Print results
    this.printResults();
  }

  private async checkSchemaVersion() {
    try {
      const { data, error } = await this.supabase
        .from('schema_migrations')
        .select('version, name, executed_at')
        .order('version', { ascending: false })
        .limit(1);

      if (error) throw error;

      const latestVersion = data?.[0]?.version || 'none';
      const expectedVersion = '003';

      this.addCheck({
        name: 'Schema Version',
        status: latestVersion === expectedVersion ? 'pass' : 'warning',
        message: `Current version: ${latestVersion}, Expected: ${expectedVersion}`,
        details: data,
      });
    } catch (error) {
      this.addCheck({
        name: 'Schema Version',
        status: 'fail',
        message: 'Failed to check schema version',
        details: error,
      });
    }
  }

  private async checkRequiredTables() {
    const requiredTables = [
      'user_profiles',
      'api_keys',
      'user_sessions',
      'agents',
      'agent_capabilities_registry',
      'agent_performance_metrics',
      'memories',
      'memory_associations',
      'widgets',
      'widget_versions',
      'widget_likes',
      'widget_comments',
      'knowledge_base',
      'knowledge_relationships',
      'tasks',
      'task_executions',
      'storage_objects',
      'job_queue',
      'resource_permissions',
      'alpha_evolve_iterations',
      'mcp_agents',
      'sweet_athena_states',
    ];

    const { data, error } = await this.supabase.rpc('get_all_tables');
    const existingTables = data?.map((t: any) => t.table_name) || [];

    const missingTables = requiredTables.filter((t) => !existingTables.includes(t));

    this.addCheck({
      name: 'Required Tables',
      status: missingTables.length === 0 ? 'pass' : 'fail',
      message:
        missingTables.length === 0
          ? 'All required tables exist'
          : `Missing ${missingTables.length} tables`,
      details: { missing: missingTables },
    });
  }

  private async checkTableStructure() {
    // Check memories table structure
    const { data: columns } = await this.supabase.rpc('get_table_columns', {
      table_name: 'memories',
    });

    const requiredColumns = [
      'id',
      'user_id',
      'agent_id',
      'type',
      'content',
      'embedding',
      'importance',
    ];
    const columnNames = columns?.map((c: any) => c.column_name) || [];
    const missingColumns = requiredColumns.filter((c) => !columnNames.includes(c));

    this.addCheck({
      name: 'Memories Table Structure',
      status: missingColumns.length === 0 ? 'pass' : 'fail',
      message:
        missingColumns.length === 0
          ? 'Memories table has correct structure'
          : `Missing columns: ${missingColumns.join(', ')}`,
      details: { columns: columnNames, missing: missingColumns },
    });
  }

  private async checkVectorDimensions() {
    try {
      // Check vector dimensions in memories table
      const { data: memoryVector } = await this.supabase.rpc('get_vector_dimension', {
        table_name: 'memories',
        column_name: 'embedding',
      });

      const { data: knowledgeVector } = await this.supabase.rpc('get_vector_dimension', {
        table_name: 'knowledge_base',
        column_name: 'embedding',
      });

      const expectedDimension = 1536;
      const memoryDim = memoryVector?.[0]?.dimension;
      const knowledgeDim = knowledgeVector?.[0]?.dimension;

      this.addCheck({
        name: 'Vector Dimensions',
        status:
          memoryDim === expectedDimension && knowledgeDim === expectedDimension ? 'pass' : 'fail',
        message: `Memory: ${memoryDim || 'not found'}, Knowledge: ${knowledgeDim || 'not found'}, Expected: ${expectedDimension}`,
        details: { memoryDim, knowledgeDim, expectedDimension },
      });
    } catch (error) {
      this.addCheck({
        name: 'Vector Dimensions',
        status: 'warning',
        message: 'Could not verify vector dimensions',
        details: error,
      });
    }
  }

  private async checkDuplicateMigrations() {
    const { data } = await this.supabase
      .from('schema_migrations')
      .select('version, COUNT(*)')
      .group('version');

    const duplicates = data?.filter((m: any) => m.count > 1) || [];

    this.addCheck({
      name: 'Duplicate Migrations',
      status: duplicates.length === 0 ? 'pass' : 'fail',
      message:
        duplicates.length === 0
          ? 'No duplicate migrations found'
          : `Found ${duplicates.length} duplicate migration versions`,
      details: duplicates,
    });
  }

  private async checkSecurityDefinerFunctions() {
    const { data } = await this.supabase.rpc('get_security_definer_functions');
    const definerFunctions = data || [];

    this.addCheck({
      name: 'Security Definer Functions',
      status: definerFunctions.length === 0 ? 'pass' : 'warning',
      message:
        definerFunctions.length === 0
          ? 'No SECURITY DEFINER functions found'
          : `Found ${definerFunctions.length} SECURITY DEFINER functions`,
      details: definerFunctions,
    });
  }

  private async checkRLSPolicies() {
    const criticalTables = ['memories', 'tasks', 'api_keys', 'user_sessions'];
    const tablesWithoutRLS: string[] = [];

    for (const table of criticalTables) {
      const { data } = await this.supabase.rpc('check_rls_enabled', { table_name: table });

      if (!data?.[0]?.enabled) {
        tablesWithoutRLS.push(table);
      }
    }

    this.addCheck({
      name: 'RLS Policies',
      status: tablesWithoutRLS.length === 0 ? 'pass' : 'fail',
      message:
        tablesWithoutRLS.length === 0
          ? 'RLS enabled on all critical tables'
          : `RLS disabled on: ${tablesWithoutRLS.join(', ')}`,
      details: { tablesWithoutRLS },
    });
  }

  private async checkIndexes() {
    const criticalIndexes = [
      'idx_memories_embedding',
      'idx_memories_user_id',
      'idx_tasks_status',
      'idx_knowledge_embedding',
    ];

    const { data } = await this.supabase.rpc('get_all_indexes');
    const existingIndexes = data?.map((i: any) => i.indexname) || [];
    const missingIndexes = criticalIndexes.filter((i) => !existingIndexes.includes(i));

    this.addCheck({
      name: 'Critical Indexes',
      status: missingIndexes.length === 0 ? 'pass' : 'warning',
      message:
        missingIndexes.length === 0
          ? 'All critical indexes exist'
          : `Missing indexes: ${missingIndexes.join(', ')}`,
      details: { missing: missingIndexes },
    });
  }

  private async checkDataIntegrity() {
    // Check for orphaned records
    const checks = [
      {
        name: 'Orphaned memories',
        query: `SELECT COUNT(*) as count FROM memories m 
                LEFT JOIN auth.users u ON m.user_id = u.id 
                WHERE u.id IS NULL`,
      },
      {
        name: 'Orphaned tasks',
        query: `SELECT COUNT(*) as count FROM tasks t 
                LEFT JOIN agents a ON t.agent_id = a.id 
                WHERE t.agent_id IS NOT NULL AND a.id IS NULL`,
      },
    ];

    const integrityIssues: any[] = [];

    for (const check of checks) {
      const { data } = await this.supabase.rpc('execute_query', { query: check.query });
      if (data?.[0]?.count > 0) {
        integrityIssues.push({ ...check, count: data[0].count });
      }
    }

    this.addCheck({
      name: 'Data Integrity',
      status: integrityIssues.length === 0 ? 'pass' : 'warning',
      message:
        integrityIssues.length === 0
          ? 'No data integrity issues found'
          : `Found ${integrityIssues.length} integrity issues`,
      details: integrityIssues,
    });
  }

  private addCheck(check: MigrationCheck) {
    this.checks.push(check);
  }

  private printResults() {
    console.log('\n📊 Migration Verification Results\n');
    console.log('='.repeat(50));

    let passCount = 0;
    let failCount = 0;
    let warningCount = 0;

    for (const check of this.checks) {
      const icon = check.status === 'pass' ? '✅' : check.status === 'fail' ? '❌' : '⚠️';
      console.log(`${icon} ${check.name}: ${check.message}`);

      if (check.details && check.status !== 'pass') {
        console.log(`   Details: ${JSON.stringify(check.details, null, 2)}`);
      }

      if (check.status === 'pass') passCount++;
      else if (check.status === 'fail') failCount++;
      else warningCount++;
    }

    console.log('\n' + '='.repeat(50));
    console.log(`Summary: ${passCount} passed, ${failCount} failed, ${warningCount} warnings`);
    console.log('='.repeat(50) + '\n');

    if (failCount > 0) {
      console.log('❌ Migration verification FAILED');
      console.log('   Please fix the issues above before deploying to production');
      process.exit(1);
    } else if (warningCount > 0) {
      console.log('⚠️  Migration verification passed with warnings');
      console.log('   Review warnings above and ensure they are acceptable');
    } else {
      console.log('✅ Migration verification PASSED');
      console.log('   Database is ready for production');
    }
  }
}

// Create helper SQL functions if they don't exist
async function createHelperFunctions() {
  const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

  // Function to get all tables
  await supabase
    .rpc('create_or_replace_function', {
      name: 'get_all_tables',
      definition: `
      CREATE OR REPLACE FUNCTION get_all_tables()
      RETURNS TABLE(table_name text)
      LANGUAGE sql
      SECURITY INVOKER
      AS $$
        SELECT table_name::text
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE';
      $$;
    `,
    })
    .catch(() => {}); // Ignore if exists

  // Function to get table columns
  await supabase
    .rpc('create_or_replace_function', {
      name: 'get_table_columns',
      definition: `
      CREATE OR REPLACE FUNCTION get_table_columns(table_name text)
      RETURNS TABLE(column_name text, data_type text)
      LANGUAGE sql
      SECURITY INVOKER
      AS $$
        SELECT column_name::text, data_type::text
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = $1;
      $$;
    `,
    })
    .catch(() => {});

  // Add other helper functions...
}

// Run verification
async function main() {
  try {
    await createHelperFunctions();
    const verifier = new MigrationVerifier();
    await verifier.verify();
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { MigrationVerifier };
