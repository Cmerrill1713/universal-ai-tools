#!/usr/bin/env npx tsx
/**
 * Cleanup MCP Orphaned Objects
 * Removes any orphaned constraints or objects that prevent table creation
 */

import pg from 'pg';

const { Client } = pg;
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

async function cleanupMCPOrphans(): Promise<void> {
  let client: pg.Client | null = null;
  
  try {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('🔌 Connecting to PostgreSQL database...');
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    
    console.log('🔍 Checking for orphaned MCP objects...');

    // Check for orphaned constraints
    const constraintResult = await client.query(`
      SELECT conname, contype, conrelid::regclass as table_name
      FROM pg_constraint 
      WHERE conname LIKE '%mcp_context%'
      ORDER BY conname;
    `);

    console.log('🧹 Found constraints:');
    for (const row of constraintResult.rows) {
      console.log(`   ${row.conname} (${row.contype}) on ${row.table_name}`);
    }

    // Check if tables exist
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'mcp_%'
      ORDER BY table_name;
    `);

    console.log('📊 Found tables:');
    for (const row of tableCheck.rows) {
      console.log(`   ${row.table_name}`);
    }

    // If we have constraints but no mcp_context table, clean up
    const hasConstraints = constraintResult.rows.length > 0;
    const hasMcpContext = tableCheck.rows.some(row => row.table_name === 'mcp_context');

    if (hasConstraints && !hasMcpContext) {
      console.log('🗑️ Cleaning up orphaned constraints...');
      
      for (const row of constraintResult.rows) {
        if (row.conname.includes('mcp_context')) {
          try {
            // Try to drop the constraint
            await client.query(`ALTER TABLE ${row.table_name} DROP CONSTRAINT IF EXISTS ${row.conname};`);
            console.log(`   ✅ Dropped constraint ${row.conname}`);
          } catch (error) {
            console.log(`   ⚠️  Could not drop ${row.conname}: ${error instanceof Error ? error.message.substring(0, 50) : String(error).substring(0, 50)}`);
          }
        }
      }
    }

    // Now try to create a simple mcp_context table
    console.log('📝 Creating clean mcp_context table...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.mcp_context (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          content TEXT NOT NULL,
          category TEXT NOT NULL,
          metadata JSONB DEFAULT '{}',
          user_id TEXT,
          session_id TEXT,
          source TEXT,
          relevance_score FLOAT DEFAULT 0.0,
          access_count INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          expires_at TIMESTAMPTZ
      );
    `);
    console.log('   ✅ Basic mcp_context table created');

    // Add the category check constraint separately
    try {
      await client.query(`
        ALTER TABLE public.mcp_context 
        ADD CONSTRAINT mcp_context_category_check 
        CHECK (category IN (
          'project_overview',
          'code_patterns', 
          'error_analysis',
          'conversation_history',
          'agent_responses',
          'user_feedback'
        ));
      `);
      console.log('   ✅ Category constraint added');
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        console.log('   ⚠️  Category constraint already exists');
      } else {
        console.log(`   ❌ Category constraint failed: ${error instanceof Error ? error.message.substring(0, 50) : String(error).substring(0, 50)}`);
      }
    }

    // Verify final state
    const finalCheck = await client.query(`SELECT COUNT(*) FROM mcp_context`);
    console.log('');
    console.log('🎯 Final verification:');
    console.log(`   ✅ mcp_context table accessible (${finalCheck.rows[0].count} rows)`);

    console.log('');
    console.log('🎉 MCP orphan cleanup completed!');
    console.log('   You can now run: npm run mcp:verify');

  } catch (error) {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error('❌ Cleanup failed:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.end();
    }
  }
}

// Run the cleanup
cleanupMCPOrphans().catch((error) => {
  console.error('💥 Cleanup script failed:', error);
  process.exit(1);
});