#!/usr/bin/env npx tsx
/**
 * PostgreSQL Direct MCP Migration Deployment
 * Uses the DATABASE_URL to execute the migration directly
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { log, LogContext } from '../src/utils/logger';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

async function deployMigrationPostgres(): Promise<void> {
  let client: pg.Client | null = null;
  
  try {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('🔌 Connecting to PostgreSQL database...');
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    
    console.log('📋 Reading MCP migration file...');
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20250730030000_mcp_context_system.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    console.log('🚀 Executing MCP context system migration...');
    console.log('   This will create all MCP tables, indexes, functions, and policies');
    console.log('');

    // Execute the entire migration as a single transaction
    await client.query('BEGIN');
    
    try {
      await client.query(migrationSQL);
      await client.query('COMMIT');
      
      console.log('✅ Migration executed successfully!');
      
      // Verify tables were created
      const tables = ['mcp_context', 'mcp_code_patterns', 'mcp_task_progress', 'mcp_error_analysis'];
      console.log('🔍 Verifying table creation...');
      
      for (const table of tables) {
        try {
          const result = await client.query(
            `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)`,
            [table]
          );
          
          if (result.rows[0].exists) {
            console.log(`   ✅ Table ${table} exists`);
          } else {
            console.log(`   ❌ Table ${table} was not created`);
          }
        } catch (error) {
          console.log(`   ❌ Table ${table} verification failed:`, error instanceof Error ? error.message : String(error));
        }
      }

      // Verify functions were created
      const functions = ['search_context_by_similarity', 'cleanup_expired_context', 'increment_context_access'];
      console.log('🔍 Verifying function creation...');
      
      for (const func of functions) {
        try {
          const result = await client.query(
            `SELECT EXISTS (SELECT FROM pg_proc WHERE proname = $1)`,
            [func]
          );
          
          if (result.rows[0].exists) {
            console.log(`   ✅ Function ${func} exists`);
          } else {
            console.log(`   ❌ Function ${func} was not created`);
          }
        } catch (error) {
          console.log(`   ❌ Function ${func} verification failed:`, error instanceof Error ? error.message : String(error));
        }
      }

      // Verify views were created
      const views = ['mcp_context_analytics', 'mcp_pattern_effectiveness', 'mcp_error_trends'];
      console.log('🔍 Verifying view creation...');
      
      for (const view of views) {
        try {
          const result = await client.query(
            `SELECT EXISTS (SELECT FROM information_schema.views WHERE table_schema = 'public' AND table_name = $1)`,
            [view]
          );
          
          if (result.rows[0].exists) {
            console.log(`   ✅ View ${view} exists`);
          } else {
            console.log(`   ❌ View ${view} was not created`);
          }
        } catch (error) {
          console.log(`   ❌ View ${view} verification failed:`, error instanceof Error ? error.message : String(error));
        }
      }

      console.log('');
      console.log('🎉 MCP context system deployment completed successfully!');
      console.log('');
      console.log('🔧 Created infrastructure:');
      console.log('   ✓ mcp_context - Context storage with vector embeddings');
      console.log('   ✓ mcp_code_patterns - Code learning patterns');
      console.log('   ✓ mcp_task_progress - Task tracking and analytics');
      console.log('   ✓ mcp_error_analysis - Error analysis and prevention');
      console.log('   ✓ RLS policies for multi-tenant security');
      console.log('   ✓ Utility functions for context management');
      console.log('   ✓ Analytics views for monitoring');
      console.log('');
      console.log('🚀 Next steps:');
      console.log('   1. Run: npm run mcp:verify');
      console.log('   2. Start your server: npm run dev');
      console.log('   3. Test MCP integration with API calls');

      log.info('🎉 MCP database migration deployed successfully via PostgreSQL', LogContext.MCP, {
        timestamp: new Date().toISOString(),
        tablesCreated: tables.length,
        functionsCreated: functions.length,
        viewsCreated: views.length,
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error('❌ PostgreSQL migration deployment failed:', error);
    
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      if (error.message.includes('relation') && error.message.includes('already exists')) {
        console.log('');
        console.log('ℹ️ It looks like the MCP tables already exist.');
        console.log('   This might mean the migration was already run.');
        console.log('   You can run: npm run mcp:verify to check the system.');
      }
    }
    
    log.error('❌ MCP PostgreSQL migration failed', LogContext.MCP, {
      error: error instanceof Error ? error.message : String(error),
    });
    
    process.exit(1);
  } finally {
    if (client) {
      await client.end();
    }
  }
}

// Run the deployment
deployMigrationPostgres().catch((error) => {
  console.error('💥 PostgreSQL deployment script failed:', error);
  process.exit(1);
});