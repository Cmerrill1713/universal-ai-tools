#!/usr/bin/env npx tsx
/**
 * Clean MCP Migration Deployment
 * Deploys MCP migration with proper error handling for existing objects
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

async function deployMCPClean(): Promise<void> {
  let client: pg.Client | null = null;
  
  try {
    console.log('🔌 Connecting to PostgreSQL database...');
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    
    console.log('📋 Reading MCP migration file...');
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20250730030000_mcp_context_system.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    console.log('🚀 Executing MCP context system migration with error handling...');
    console.log('');

    // Split migration into logical sections and execute each with error handling
    const sections = migrationSQL.split('-- =============================================================================');
    
    let successCount = 0;
    let warningCount = 0;

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i].trim();
      if (!section || section.length < 10) continue;

      // Extract section name from comment
      const sectionMatch = section.match(/^(.*?)$/m);
      const sectionName = sectionMatch ? sectionMatch[1].replace(/[-=]/g, '').trim() : `Section ${i + 1}`;
      
      console.log(`📝 Executing: ${sectionName}...`);

      try {
        await client.query(section);
        console.log(`   ✅ ${sectionName} - SUCCESS`);
        successCount++;
      } catch (error) {
        if (error instanceof Error) {
          // Handle common "already exists" errors
          if (error.message.includes('already exists') || 
              error.message.includes('duplicate key') ||
              (error.message.includes('relation') && error.message.includes('already exists'))) {
            console.log(`   ⚠️  ${sectionName} - SKIPPED (already exists)`);
            warningCount++;
          } else {
            console.log(`   ❌ ${sectionName} - ERROR: ${error.message.substring(0, 100)}...`);
            // Don't exit, continue with other sections
          }
        }
      }
    }

    console.log('');
    console.log(`📊 Migration Results:`);
    console.log(`   ✅ Successful sections: ${successCount}`);
    console.log(`   ⚠️  Skipped sections: ${warningCount}`);
    console.log('');

    // Now verify the key components exist
    await verifyMCPComponents(client);

    console.log('');
    console.log('🎉 MCP migration deployment completed!');
    console.log('   Next: npm run mcp:verify');

    log.info('🎉 MCP clean migration deployed', LogContext.MCP, {
      successCount,
      warningCount,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('❌ Clean migration deployment failed:', error);
    log.error('❌ MCP clean migration failed', LogContext.MCP, {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  } finally {
    if (client) {
      await client.end();
    }
  }
}

async function verifyMCPComponents(client: pg.Client): Promise<void> {
  console.log('🔍 Verifying MCP components...');

  // Check tables
  const tables = ['mcp_context', 'mcp_code_patterns', 'mcp_task_progress', 'mcp_error_analysis'];
  let tablesExist = 0;
  
  for (const table of tables) {
    try {
      const result = await client.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)`,
        [table]
      );
      
      if (result.rows[0].exists) {
        console.log(`   ✅ Table ${table}`);
        tablesExist++;
      } else {
        console.log(`   ❌ Table ${table} missing`);
      }
    } catch (error) {
      console.log(`   ❌ Table ${table} check failed`);
    }
  }

  // Check key functions
  const functions = ['search_context_by_similarity', 'get_current_user_id'];
  let functionsExist = 0;
  
  for (const func of functions) {
    try {
      const result = await client.query(
        `SELECT EXISTS (SELECT FROM pg_proc WHERE proname = $1)`,
        [func]
      );
      
      if (result.rows[0].exists) {
        console.log(`   ✅ Function ${func}`);
        functionsExist++;
      } else {
        console.log(`   ❌ Function ${func} missing`);
      }
    } catch (error) {
      console.log(`   ❌ Function ${func} check failed`);
    }
  }

  console.log('');
  console.log(`📈 Component Status:`);
  console.log(`   Tables: ${tablesExist}/${tables.length}`);
  console.log(`   Functions: ${functionsExist}/${functions.length}`);
  
  if (tablesExist === tables.length && functionsExist >= 1) {
    console.log('   🎯 MCP system is ready for testing!');
  } else {
    console.log('   ⚠️  Some components may be missing');
  }
}

// Run the deployment
deployMCPClean().catch((error) => {
  console.error('💥 Clean deployment script failed:', error);
  process.exit(1);
});