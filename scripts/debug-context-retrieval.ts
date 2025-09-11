#!/usr/bin/env npx tsx
/**
 * Debug Context Retrieval
 * Investigates why context retrieval is failing
 */

import { mcpIntegrationService } from '../src/services/mcp-integration-service';
import { log, LogContext } from '../src/utils/logger';
import pg from 'pg';

const { Client } = pg;
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

async function debugContextRetrieval(): Promise<void> {
  let client: pg.Client | null = null;
  
  try {
    console.log('🔌 Connecting to PostgreSQL database...');
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    
    // Check what's in the mcp_context table
    console.log('📊 Checking mcp_context table...');
    const contextResult = await client.query(`
      SELECT id, content, category, user_id, created_at 
      FROM mcp_context 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    console.log(`   Found ${contextResult.rows.length} context entries:`);
    for (const row of contextResult.rows) {
      console.log(`   • ${row.category}: ${row.content.substring(0, 50)}... (user: ${row.user_id || 'none'})`);
    }

    // Test MCP service connection
    console.log('');
    console.log('🚀 Testing MCP service...');
    const started = await mcpIntegrationService.start();
    console.log(`   MCP service started: ${started}`);
    
    if (started) {
      const status = mcpIntegrationService.getStatus();
      console.log(`   Status: ${status.status}`);
      console.log(`   Connected: ${status.connected}`);
      
      // Test context saving
      console.log('');
      console.log('💾 Testing context saving...');
      const saveResult = await mcpIntegrationService.sendMessage('save_context', {
        content: 'Debug test context for retrieval debugging',
        category: 'project_overview',
        metadata: {
          debug: true,
          timestamp: new Date().toISOString(),
        },
      });
      console.log(`   Save result:`, saveResult);

      // Check what was actually saved
      const updatedResult = await client.query(`
        SELECT id, content, category, user_id, created_at 
        FROM mcp_context 
        WHERE content LIKE '%Debug test context%'
        ORDER BY created_at DESC 
        LIMIT 5
      `);
      console.log(`   Found ${updatedResult.rows.length} debug entries after save`);

      // Test context retrieval
      console.log('');
      console.log('🔍 Testing context retrieval...');
      try {
        const searchResult = await mcpIntegrationService.sendMessage('search_context', {
          query: 'debug test',
          category: 'project_overview',
          limit: 5,
        });
        console.log(`   Search result:`, searchResult);
      } catch (error) {
        console.log(`   Search error:`, error instanceof Error ? error.message : String(error));
      }

      // Test get_recent_context
      console.log('');
      console.log('📋 Testing get_recent_context...');
      try {
        const recentResult = await mcpIntegrationService.sendMessage('get_recent_context', {
          category: 'project_overview',
          limit: 5,
        });
        console.log(`   Recent result:`, recentResult);
      } catch (error) {
        console.log(`   Recent context error:`, error instanceof Error ? error.message : String(error));
      }

      await mcpIntegrationService.shutdown();
    }

  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    if (client) {
      await client.end();
    }
  }
}

// Run the debug
debugContextRetrieval().catch((error) => {
  console.error('💥 Debug script failed:', error);
  process.exit(1);
});