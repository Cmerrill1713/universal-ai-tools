#!/usr/bin/env npx tsx
/**
 * Create Missing Analytics Views
 * Creates the MCP analytics views that were missing
 */

import pg from 'pg';

const { Client } = pg;
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

async function createAnalyticsViews(): Promise<void> {
  let client: pg.Client | null = null;
  
  try {
    console.log('🔌 Connecting to PostgreSQL database...');
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    
    console.log('📊 Creating MCP analytics views...');

    // Create context analytics view
    console.log('   Creating mcp_context_analytics...');
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
    console.log('   ✅ mcp_context_analytics created');

    // Create pattern effectiveness view
    console.log('   Creating mcp_pattern_effectiveness...');
    await client.query(`
      CREATE OR REPLACE VIEW mcp_pattern_effectiveness AS
      SELECT 
          pattern_type,
          programming_language,
          COUNT(*) as pattern_count,
          AVG(success_rate) as avg_success_rate,
          AVG(usage_count) as avg_usage_count,
          MAX(last_used_at) as last_used
      FROM public.mcp_code_patterns
      GROUP BY pattern_type, programming_language
      ORDER BY avg_success_rate DESC, pattern_count DESC;
    `);
    console.log('   ✅ mcp_pattern_effectiveness created');

    // Create error trends view
    console.log('   Creating mcp_error_trends...');
    await client.query(`
      CREATE OR REPLACE VIEW mcp_error_trends AS
      SELECT 
          error_type,
          error_category,
          programming_language,
          COUNT(*) as occurrence_count,
          SUM(frequency) as total_frequency,
          AVG(frequency) as avg_frequency,
          COUNT(CASE WHEN resolution_status = 'resolved' THEN 1 END) as resolved_count,
          MAX(last_seen) as last_occurrence
      FROM public.mcp_error_analysis
      GROUP BY error_type, error_category, programming_language
      ORDER BY total_frequency DESC, occurrence_count DESC;
    `);
    console.log('   ✅ mcp_error_trends created');

    // Grant permissions on views
    console.log('🔑 Granting permissions on views...');
    await client.query(`GRANT SELECT ON mcp_context_analytics TO authenticated;`);
    await client.query(`GRANT SELECT ON mcp_pattern_effectiveness TO authenticated;`);
    await client.query(`GRANT SELECT ON mcp_error_trends TO authenticated;`);
    console.log('   ✅ Permissions granted');

    // Test the views
    console.log('🧪 Testing views...');
    const views = ['mcp_context_analytics', 'mcp_pattern_effectiveness', 'mcp_error_trends'];
    
    for (const view of views) {
      try {
        const result = await client.query(`SELECT COUNT(*) FROM ${view}`);
        console.log(`   ✅ ${view} working (${result.rows[0].count} rows)`);
      } catch (error) {
        console.log(`   ❌ ${view} failed: ${error instanceof Error ? error.message.substring(0, 50) : String(error).substring(0, 50)}`);
      }
    }

    console.log('');
    console.log('🎉 Analytics views created successfully!');

  } catch (error) {
    console.error('❌ Views creation failed:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.end();
    }
  }
}

// Run the creation
createAnalyticsViews().catch((error) => {
  console.error('💥 Views creation script failed:', error);
  process.exit(1);
});