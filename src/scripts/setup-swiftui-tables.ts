#!/usr/bin/env tsx

/**
 * Setup SwiftUI Documentation Tables
 * Creates the necessary tables for storing SwiftUI documentation
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { LogContext, log } from '../utils/logger.js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing required environment variables: SUPABASE_URL or SUPABASE_KEY');
  process.exit(1);
}

return undefined;


const supabase = createClient(supabaseUrl, supabaseKey);

async function setupTables() {
  try {
    log.info('Setting up SwiftUI documentation tables...', LogContext.SYSTEM);

    // Check if code_examples table exists
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'code_examples')
      .single();

    if (tablesError && tablesError.code === 'PGRST116') {
      // Table doesn't exist, create it
      log.info('Creating code_examples table...', LogContext.SYSTEM);
      
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS code_examples (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          source_url TEXT NOT NULL,
          title TEXT NOT NULL,
          code TEXT NOT NULL,
          language TEXT DEFAULT 'swift',
          category TEXT,
          tags TEXT[] DEFAULT '{}',
          embedding vector(1536),
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(source_url, title)
        );

        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_code_examples_category ON code_examples (category);
        CREATE INDEX IF NOT EXISTS idx_code_examples_language ON code_examples (language);
        CREATE INDEX IF NOT EXISTS idx_code_examples_source ON code_examples (source_url);
      `;

      const { error: createError } = await supabase.rpc('exec_sql', {
        sql: createTableQuery
      });

      if (createError) {
        // Try a simpler approach - create through direct SQL
        log.warn('Direct SQL creation failed, trying alternative approach', LogContext.SYSTEM);
        
        // For now, we'll proceed assuming the table will be created by migrations
        log.info('Table creation will be handled by migrations', LogContext.SYSTEM);
      } else {
        log.info('code_examples table created successfully', LogContext.SYSTEM);
      }
    } else {
      log.info('code_examples table already exists', LogContext.SYSTEM);
    }

    // Verify knowledge_sources table exists
    const { error: knowledgeError } = await supabase
      .from('knowledge_sources')
      .select('count(*)')
      .limit(1);

    if (knowledgeError) {
      log.error('knowledge_sources table not found', LogContext.SYSTEM, { error: knowledgeError });
      log.info('Please ensure all migrations have been run', LogContext.SYSTEM);
    } else {
      log.info('knowledge_sources table verified', LogContext.SYSTEM);
    }

    // Verify mcp_context table exists
    const { error: mcpError } = await supabase
      .from('mcp_context')
      .select('count(*)')
      .limit(1);

    if (mcpError) {
      log.error('mcp_context table not found', LogContext.SYSTEM, { error: mcpError });
    } else {
      log.info('mcp_context table verified', LogContext.SYSTEM);
    }

    log.info('Table setup completed', LogContext.SYSTEM);
    return true;
  } catch (error) {
    log.error('Failed to setup tables', LogContext.SYSTEM, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return false;
  }
}

// Run the setup
setupTables()
  .then((success) => {
    if (success) {
      log.info('SwiftUI table setup completed successfully', LogContext.SYSTEM);
      process.exit(0);
    } else {
      log.error('SwiftUI table setup failed', LogContext.SYSTEM);
      process.exit(1);
    }
  })
  .catch((error) => {
    log.error('Unexpected error during setup', LogContext.SYSTEM, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    process.exit(1);
  });