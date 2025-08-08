#!/usr/bin/env tsx;
/**
 * Check Supabase Data;
 * Checks what context and data we have stored in Supabase;
 */

import { createClient } from '@supabase/supabase-js';
import { LogContext, log } from '../utils/logger?.js';

async function checkSupabaseData(): Promise<void> {
  log?.info('🔍 Checking Supabase data...', LogContext?.MCP);

  try {
    // Try to get Supabase configuration;
    const supabaseUrl = process?.env?.SUPABASE_URL;
    const supabaseKey =
      process?.env?.SUPABASE_SERVICE_ROLE_KEY ||
      process?.env?.SUPABASE_SERVICE_KEY ||
      process?.env?.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      log?.warn('⚠️ Supabase configuration not found in environment variables', LogContext?.MCP);

      // Check .env?.local file;
      console?.log('\n📁 Checking .env?.local configuration:');
      try {
        const fs = await import('fs/promises');
        const envLocal = await fs?.readFile('.env?.local', 'utf8');
        const lines = envLocal?.split('\n').filter((line) => line?.trim() && !line?.startsWith('#'));

        console?.log('Environment variables from .env?.local:');
        for (const line of lines) {
          const [key] = line?.split('=');
          if (key) {
            console?.log(`  - ${key}`);
          }
        }

        // Try to parse the local Supabase URL;
        const urlMatch = envLocal?.match(/SUPABASE_URL=(.+)/);
        const keyMatch = envLocal?.match(/SUPABASE_ANON_KEY=(.+)/);

        if (urlMatch && keyMatch) {
          const localUrl = urlMatch[1].trim();
          const localKey = keyMatch[1].trim();

          if (localUrl && localKey) {
            log?.info('📡 Attempting to connect to local Supabase...', LogContext?.MCP);
            const supabase = createClient(localUrl, localKey);

          // Check if we can connect;
          const { data: healthCheck, error: healthError } = await supabase;
            .from('ai_memories')
            .select('count(*)')
            .limit(1);

          if (healthError) {
            console?.log('❌ Local Supabase connection failed:', healthError?.message);
            return;
          }

          console?.log('✅ Connected to local Supabase!');

          // Check available tables;
          const tables = [
            'ai_memories',
            'mcp_context',
            'mcp_code_patterns',
            'mcp_task_progress',
            'mcp_error_analysis',
            'api_secrets',
          ];

          console?.log('\n📊 Checking tables:');

          for (const tableName of tables) {
            try {
              const { data, error, count } = await supabase;
                .from(tableName)
                .select('*', { count: 'exact' })
                .limit(5);

              if (error) {
                console?.log(`  ❌ ${tableName}: ${error?.message}`);
              } else {
                console?.log(`  ✅ ${tableName}: ${count || 0} records`);

                if (data && data?.length > 0) {
                  console?.log(`     Sample data keys: ${Object?.keys(data[0]).join(', ')}`);
                }
              }
            } catch (error) {
              console?.log(`  ❌ ${tableName}: ${error}`);
            }
          }

          // Check specific MCP context data;
          console?.log('\n🧠 MCP Context Categories:');
          try {
            const { data: contextData } = await supabase;
              .from('mcp_context')
              .select('category');

            if (contextData && contextData?.length > 0) {
              // Count categories manually;
              const categoryCounts = new Map<string, number>();
              for (const item of contextData) {
                categoryCounts?.set(item?.category, (categoryCounts?.get(item?.category) || 0) + 1);
              }
              
              for (const [category, count] of categoryCounts?.entries()) {
                console?.log(`  - ${category}: ${count} entries`);
              }
            } else {
              console?.log('  No MCP context data found');
            }
          } catch (error) {
            console?.log('  Could not check MCP context categories');
          }

          // Check ai_memories content;
          console?.log('\n📚 AI Memories:');
          try {
            const { data: memories } = await supabase;
              .from('ai_memories')
              .select('content, metadata')
              .limit(3);

            if (memories && memories?.length > 0) {
              for (let i = 0; i < memories?.length; i++) {
                const memory = memories[i];
                console?.log(`  Memory ${i + 1}:`);
                console?.log(`    Content: ${memory?.content?.substring(0, 100)}...`);
                console?.log(`    Metadata: ${JSON?.stringify(memory?.metadata)}`);
              }
            } else {
              console?.log('  No AI memories found');
            }
          } catch (error) {
            console?.log('  Could not check AI memories');
          }
          } else {
            console?.log('❌ Could not parse Supabase credentials from .env?.local');
          }
        } else {
          console?.log('❌ Could not find Supabase configuration in .env?.local');
        }
      } catch (error) {
        console?.log('❌ Could not read .env?.local file:', error);
      }

      return;
    }

    // If we have environment variables, use them;
    const supabase = createClient(supabaseUrl, supabaseKey);
    log?.info('✅ Connected to Supabase using environment variables', LogContext?.MCP);

    // Rest of the checking logic would go here...
  } catch (error) {
    log?.error('❌ Failed to check Supabase data', LogContext?.MCP, {
      error: error instanceof Error ? error?.message : String(error),
    });
  }
}

// Run if called directly;
if (import?.meta?.url === `file://${process?.argv[1]}`) {
  checkSupabaseData()
    .then(() => {
      console?.log('\n✅ Supabase data check completed');
      process?.exit(0);
    })
    .catch((error) => {
      console?.error('❌ Supabase data check failed:', error);
      process?.exit(1);
    });
}

export { checkSupabaseData };
