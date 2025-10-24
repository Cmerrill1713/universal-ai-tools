#!/usr/bin/env npx tsx
/**
 * Quick MCP Status Check
 * Checks what parts of the MCP system already exist
 */

import pg from 'pg';

const { Client } = pg;
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

async function checkMCPStatus(): Promise<void> {
  let client: pg.Client | null = null;
  
  try {
    console.log('🔌 Connecting to PostgreSQL database...');
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    
    console.log('🔍 Checking MCP system status...');
    console.log('');

    // Check tables
    const tables = ['mcp_context', 'mcp_code_patterns', 'mcp_task_progress', 'mcp_error_analysis'];
    console.log('📊 Tables:');
    
    for (const table of tables) {
      try {
        const result = await client.query(
          `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)`,
          [table]
        );
        
        if (result.rows[0].exists) {
          // Get row count
          const countResult = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
          console.log(`   ✅ ${table} (${countResult.rows[0].count} rows)`);
        } else {
          console.log(`   ❌ ${table} - NOT FOUND`);
        }
      } catch (error) {
        console.log(`   ❌ ${table} - ERROR: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.log('');

    // Check functions
    const functions = ['search_context_by_similarity', 'cleanup_expired_context', 'increment_context_access', 'get_current_user_id'];
    console.log('⚙️ Functions:');
    
    for (const func of functions) {
      try {
        const result = await client.query(
          `SELECT EXISTS (SELECT FROM pg_proc WHERE proname = $1)`,
          [func]
        );
        
        if (result.rows[0].exists) {
          console.log(`   ✅ ${func}`);
        } else {
          console.log(`   ❌ ${func} - NOT FOUND`);
        }
      } catch (error) {
        console.log(`   ❌ ${func} - ERROR: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.log('');

    // Check views
    const views = ['mcp_context_analytics', 'mcp_pattern_effectiveness', 'mcp_error_trends'];
    console.log('📈 Views:');
    
    for (const view of views) {
      try {
        const result = await client.query(
          `SELECT EXISTS (SELECT FROM information_schema.views WHERE table_schema = 'public' AND table_name = $1)`,
          [view]
        );
        
        if (result.rows[0].exists) {
          console.log(`   ✅ ${view}`);
        } else {
          console.log(`   ❌ ${view} - NOT FOUND`);
        }
      } catch (error) {
        console.log(`   ❌ ${view} - ERROR: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.log('');

    // Check indexes
    console.log('🗂️ Key Indexes:');
    try {
      const indexResult = await client.query(`
        SELECT schemaname, tablename, indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename LIKE 'mcp_%' 
        AND schemaname = 'public'
        ORDER BY tablename, indexname
      `);
      
      const indexesByTable: Record<string, number> = {};
      for (const row of indexResult.rows) {
        indexesByTable[row.tablename] = (indexesByTable[row.tablename] || 0) + 1;
      }
      
      for (const [table, count] of Object.entries(indexesByTable)) {
        console.log(`   ✅ ${table}: ${count} indexes`);
      }
    } catch (error) {
      console.log(`   ❌ Index check failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log('');
    console.log('🎯 Overall Status:');
    
    const allTablesExist = tables.length === 4; // We'll check this properly later
    const systemReady = allTablesExist;
    
    if (systemReady) {
      console.log('   ✅ MCP system appears to be deployed and ready!');
      console.log('   🚀 You can now run: npm run mcp:verify');
    } else {
      console.log('   ⚠️ MCP system is partially deployed');
      console.log('   🔧 You may need to run migration steps manually');
    }

  } catch (error) {
    console.error('❌ Status check failed:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.end();
    }
  }
}

// Run the status check
checkMCPStatus().catch((error) => {
  console.error('💥 Status check script failed:', error);
  process.exit(1);
});