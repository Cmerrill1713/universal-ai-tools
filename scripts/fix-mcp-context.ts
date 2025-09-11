#!/usr/bin/env npx tsx
/**
 * Fix Missing MCP Context Components
 * Manually creates the missing mcp_context table and related components
 */

import pg from 'pg';
import { log, LogContext } from '../src/utils/logger';

const { Client } = pg;
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

async function fixMCPContext(): Promise<void> {
  let client: pg.Client | null = null;
  
  try {
    console.log('🔌 Connecting to PostgreSQL database...');
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    
    console.log('🔧 Creating missing MCP context table...');

    // Create the mcp_context table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.mcp_context (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          content TEXT NOT NULL,
          category TEXT NOT NULL CHECK (category IN (
              'project_overview',
              'code_patterns', 
              'error_analysis',
              'conversation_history',
              'agent_responses',
              'user_feedback'
          )),
          metadata JSONB DEFAULT '{}',
          embedding vector(1536), -- OpenAI ada-002 embedding size
          user_id TEXT, -- Allow anonymous usage
          session_id TEXT,
          source TEXT,
          relevance_score FLOAT DEFAULT 0.0,
          access_count INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          expires_at TIMESTAMPTZ, -- Optional expiration for temporary context
          
          -- Constraints
          CONSTRAINT mcp_context_category_check CHECK (length(category) > 0),
          CONSTRAINT mcp_context_content_check CHECK (length(content) > 0)
      );
    `);
    console.log('   ✅ mcp_context table created');

    // Create indexes
    console.log('🗂️ Creating indexes...');
    
    const indexes = [
      `CREATE INDEX IF NOT EXISTS mcp_context_category_idx ON public.mcp_context(category);`,
      `CREATE INDEX IF NOT EXISTS mcp_context_user_id_idx ON public.mcp_context(user_id);`,
      `CREATE INDEX IF NOT EXISTS mcp_context_created_at_idx ON public.mcp_context(created_at DESC);`,
      `CREATE INDEX IF NOT EXISTS mcp_context_relevance_idx ON public.mcp_context(relevance_score DESC);`,
      `CREATE INDEX IF NOT EXISTS mcp_context_metadata_idx ON public.mcp_context USING GIN(metadata);`,
      `CREATE INDEX IF NOT EXISTS mcp_context_search_idx ON public.mcp_context USING GIN(to_tsvector('english', content));`,
    ];

    for (const indexQuery of indexes) {
      try {
        await client.query(indexQuery);
        console.log('   ✅ Index created');
      } catch (error) {
        if (error instanceof Error && error.message.includes('already exists')) {
          console.log('   ⚠️  Index already exists');
        } else {
          console.log(`   ❌ Index failed: ${error instanceof Error ? error.message.substring(0, 50) : String(error).substring(0, 50)}`);
        }
      }
    }

    // Create vector index (may fail if vector extension not available)
    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS mcp_context_embedding_idx ON public.mcp_context 
        USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
      `);
      console.log('   ✅ Vector similarity index created');
    } catch (error) {
      console.log('   ⚠️  Vector index skipped (extension may not be available)');
    }

    // Enable RLS
    console.log('🔒 Enabling Row Level Security...');
    await client.query(`ALTER TABLE public.mcp_context ENABLE ROW LEVEL SECURITY;`);
    console.log('   ✅ RLS enabled');

    // Create get_current_user_id function
    console.log('⚙️ Creating missing functions...');
    await client.query(`
      CREATE OR REPLACE FUNCTION get_current_user_id() RETURNS TEXT AS $$
      BEGIN
          -- Try to get user ID from JWT token
          RETURN COALESCE(
              auth.jwt() ->> 'sub',
              current_setting('request.jwt.claims', true)::json ->> 'sub',
              'anonymous'
          );
      EXCEPTION WHEN OTHERS THEN
          RETURN 'anonymous';
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `);
    console.log('   ✅ get_current_user_id function created');

    // Create RLS policies
    console.log('🛡️ Creating RLS policies...');
    const policies = [
      `CREATE POLICY mcp_context_select_policy ON public.mcp_context 
       FOR SELECT USING (user_id = get_current_user_id() OR user_id IS NULL);`,
      `CREATE POLICY mcp_context_insert_policy ON public.mcp_context 
       FOR INSERT WITH CHECK (user_id = get_current_user_id() OR user_id IS NULL);`,
      `CREATE POLICY mcp_context_update_policy ON public.mcp_context 
       FOR UPDATE USING (user_id = get_current_user_id() OR user_id IS NULL);`,
      `CREATE POLICY mcp_context_delete_policy ON public.mcp_context 
       FOR DELETE USING (user_id = get_current_user_id() OR user_id IS NULL);`
    ];

    for (const policy of policies) {
      try {
        await client.query(policy);
        console.log('   ✅ RLS policy created');
      } catch (error) {
        if (error instanceof Error && error.message.includes('already exists')) {
          console.log('   ⚠️  RLS policy already exists');
        } else {
          console.log(`   ❌ RLS policy failed: ${error instanceof Error ? error.message.substring(0, 50) : String(error).substring(0, 50)}`);
        }
      }
    }

    // Create trigger for updated_at
    console.log('⏰ Creating triggers...');
    await client.query(`
      CREATE TRIGGER update_mcp_context_updated_at 
          BEFORE UPDATE ON public.mcp_context 
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    console.log('   ✅ Updated_at trigger created');

    // Grant permissions
    console.log('🔑 Granting permissions...');
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON public.mcp_context TO authenticated;`);
    await client.query(`GRANT SELECT, INSERT ON public.mcp_context TO anonymous;`);
    console.log('   ✅ Permissions granted');

    // Create analytics view
    console.log('📊 Creating analytics view...');
    await client.query(`
      CREATE OR REPLACE VIEW mcp_context_analytics AS
      SELECT 
          category,
          COUNT(*) as total_entries,
          AVG(access_count) as avg_access_count,
          MAX(access_count) as max_access_count,
          COUNT(DISTINCT user_id) as unique_users,
          DATE_TRUNC('day', created_at) as created_date
      FROM public.mcp_context
      GROUP BY category, DATE_TRUNC('day', created_at)
      ORDER BY created_date DESC, total_entries DESC;
    `);
    console.log('   ✅ Analytics view created');

    console.log('');
    console.log('🎉 MCP context table and components fixed successfully!');
    
    // Final verification
    const result = await client.query(`SELECT COUNT(*) FROM mcp_context`);
    console.log(`   📊 mcp_context table ready (${result.rows[0].count} rows)`);

    log.info('🎉 MCP context table fixed', LogContext.MCP, {
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('❌ Fix failed:', error);
    log.error('❌ MCP context fix failed', LogContext.MCP, {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  } finally {
    if (client) {
      await client.end();
    }
  }
}

// Run the fix
fixMCPContext().catch((error) => {
  console.error('💥 Fix script failed:', error);
  process.exit(1);
});