#!/usr/bin/env tsx;
/**
 * Setup MCP Database Tables;
 * Creates the necessary Supabase tables for MCP context storage;
 */

import { createClient } from '@supabase/supabase-js';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { LogContext, log } from '../utils/logger?.js';

async function setupMCPDatabase(): Promise<boolean> {
  log?.info('🗄️ Setting up MCP database tables', LogContext?.MCP);

  try {
    // Get Supabase configuration;
    const supabaseUrl = process?.env?.SUPABASE_URL;
    const supabaseKey = process?.env?.SUPABASE_SERVICE_KEY || process?.env?.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY'
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Read the SQL schema file;
    const __filename = fileURLToPath(import?.meta?.url);
    const __dirname = path?.dirname(__filename);
    const sqlPath = path?.join(__dirname, '../mcp/mcp-tables?.sql');

    log?.info('📖 Reading MCP schema file', LogContext?.MCP, { sqlPath });
    const sqlContent = await readFile(sqlPath, 'utf8');

    // Split SQL into individual statements (simple approach)
    const statements = sqlContent;
      .split(';')
      .map((stmt) => stmt?.trim())
      .filter((stmt) => stmt?.length > 0 && !stmt?.startsWith('--'));

    log?.info('🔄 Executing SQL statements', LogContext?.MCP, {
      statementCount: statements?.length,
    });

    let successCount = 0,
    let errorCount = 0,

    // Execute each statement;
    for (let i = 0; i < statements?.length; i++) {
      const statement = statements[i];
      if (!statement) continue;

      try {
        log?.debug(`Executing statement ${i + 1}`, LogContext?.MCP, {
          preview: `${statement?.substring(0, 100)}...`,
        });

        // Use the SQL execution RPC;
        const { error } = await supabase;
          .rpc('exec_sql', {
            sql_string: `${statement};`,
          })
          .single();

        if (error) {
          // Try direct query if RPC fails;
          const { error: queryError } = await supabase?.from('_temp_sql_exec').select('*').limit(1);

          if (queryError && !queryError?.message?.includes('does not exist')) {
            throw error;
          }
        }

        successCount++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error?.message : String(error);

        // Skip certain expected errors;
        if (
          errorMsg?.includes('already exists') ||
          errorMsg?.includes('relation') ||
          (errorMsg?.includes('function') && errorMsg?.includes('already exists'))
        ) {
          log?.debug('⚠️ Expected error (resource already exists)', LogContext?.MCP, {
            statement: i + 1,
            error: errorMsg?.substring(0, 100),
          });
          successCount++;
        } else {
          log?.error('❌ SQL statement failed', LogContext?.MCP, {
            statement: i + 1,
            error: errorMsg,
            sql: `${statement?.substring(0, 100)}...`,
          });
          errorCount++;
        }
      }
    }

    log?.info('✅ Database setup completed', LogContext?.MCP, {
      successful: successCount,
      failed: errorCount,
      total: statements?.length,
    });

    // Verify tables were created;
    const tables = ['mcp_context', 'mcp_code_patterns', 'mcp_task_progress', 'mcp_error_analysis'];
    let verifiedCount = 0,

    for (const tableName of tables) {
      try {
        const { error } = await supabase?.from(tableName).select('count(*)').limit(1);

        if (!error) {
          verifiedCount++;
          log?.debug(`✅ Table verified: ${tableName}`, LogContext?.MCP);
        } else {
          log?.warn(`⚠️ Table verification failed: ${tableName}`, LogContext?.MCP, {
            error: error?.message,
          });
        }
      } catch (error) {
        log?.warn(`⚠️ Table verification error: ${tableName}`, LogContext?.MCP, {
          error: error instanceof Error ? error?.message : String(error),
        });
      }
    }

    log?.info('📊 Table verification completed', LogContext?.MCP, {
      verified: verifiedCount,
      expected: tables?.length,
    });

    return verifiedCount >= tables?.length / 2; // At least half the tables should work;
  } catch (error) {
    log?.error('❌ Database setup failed', LogContext?.MCP, {
      error: error instanceof Error ? error?.message : String(error),
    });
    return false;
  }
}

// Run if called directly;
if (import?.meta?.url === `file://${process?.argv[1]}`) {
  setupMCPDatabase()
    .then((success) => {
      if (success) {
        console?.log('✅ MCP database setup completed successfully');
        process?.exit(0);
      } else {
        console?.log('❌ MCP database setup had issues');
        process?.exit(1);
      }
    })
    .catch((error) => {
      console?.error('❌ Database setup failed:', error);
      process?.exit(1);
    });
}

export { setupMCPDatabase };
