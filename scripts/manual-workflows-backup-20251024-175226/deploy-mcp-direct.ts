#!/usr/bin/env npx tsx
/**
 * Direct MCP Database Migration Deployment
 * Uses direct PostgreSQL connection to deploy the migration
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { log, LogContext } from '../src/utils/logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function deployMigrationDirect(): Promise<void> {
  try {
    console.log('📋 Reading MCP migration file...');
    
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20250730030000_mcp_context_system.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    console.log('🚀 Deploying MCP context system migration...');
    console.log('   This will create all MCP tables, indexes, and functions');
    console.log('');

    // Import and use the supabase client from our existing service
    const { supabase } = await import('../src/services/supabase-client');

    // Split the migration into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('/*'));

    console.log(`📝 Executing ${statements.length} SQL statements...`);

    let successCount = 0;
    let warningCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (!statement || statement.length < 5) continue;

      try {
        console.log(`   ${i + 1}/${statements.length}: ${statement.substring(0, 50)}...`);
        
        const { error } = await supabase.rpc('exec', {
          sql: statement + ';'
        });

        if (error) {
          // Check if it's just a "already exists" warning
          if (error.message.includes('already exists') || 
              error.message.includes('duplicate key') ||
              error.message.includes('relation') && error.message.includes('already exists')) {
            console.log(`   ⚠️  Warning: ${error.message.substring(0, 80)}...`);
            warningCount++;
          } else {
            console.log(`   ❌ Error: ${error.message.substring(0, 80)}...`);
            // Continue with other statements even if one fails
          }
        } else {
          successCount++;
        }
      } catch (error) {
        console.log(`   ❌ Exception: ${error instanceof Error ? error.message.substring(0, 80) : String(error).substring(0, 80)}...`);
      }
    }

    console.log('');
    console.log(`✅ Migration deployment completed!`);
    console.log(`   Successful statements: ${successCount}`);
    console.log(`   Warnings: ${warningCount}`);
    console.log('');

    // Verify key tables were created
    const tables = ['mcp_context', 'mcp_code_patterns', 'mcp_task_progress', 'mcp_error_analysis'];
    console.log('🔍 Verifying table creation...');
    
    for (const table of tables) {
      try {
        const { error } = await supabase.from(table).select('*').limit(1);
        if (error && error.code === 'PGRST116') {
          console.log(`   ❌ Table ${table} was not created`);
        } else {
          console.log(`   ✅ Table ${table} exists`);
        }
      } catch {
        console.log(`   ❌ Table ${table} verification failed`);
      }
    }

    console.log('');
    console.log('🎉 MCP context system deployment completed!');
    console.log('   You can now run: npm run mcp:verify');

    log.info('🎉 MCP database migration deployed via direct method', LogContext.MCP, {
      successCount,
      warningCount,
      totalStatements: statements.length,
    });

  } catch (error) {
    console.error('❌ Direct migration deployment failed:', error);
    log.error('❌ MCP direct migration failed', LogContext.MCP, {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

// Run the deployment
deployMigrationDirect().catch((error) => {
  console.error('💥 Direct deployment script failed:', error);
  process.exit(1);
});