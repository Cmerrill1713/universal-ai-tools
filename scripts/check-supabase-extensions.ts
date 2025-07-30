/**
 * Check Supabase Extensions and Database State
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../src/config/environment';

async function checkSupabaseExtensions() {
  console.log('🔍 Checking Supabase Extensions and Database State...\n');

  const supabase = createClient(
    config.supabase.url,
    config.supabase.serviceKey
  );

  try {
    // Check currently enabled extensions
    const { data: extensions, error: extError } = await supabase
      .from('pg_extension')
      .select('extname, extversion')
      .order('extname');

    if (extError) {
      // Try with direct SQL query
      const { data: sqlExtensions, error: sqlError } = await supabase.rpc('get_extensions', {});
      
      if (sqlError) {
        console.log('❌ Could not query extensions. Creating RPC function...');
        
        // Create the RPC function
        const { error: createError } = await supabase.rpc('create_extension_query', {
          query: `
            CREATE OR REPLACE FUNCTION get_extensions()
            RETURNS TABLE(name text, version text)
            LANGUAGE sql
            SECURITY DEFINER
            AS $$
              SELECT extname::text, extversion::text 
              FROM pg_extension 
              ORDER BY extname;
            $$;
          `
        });

        if (createError) {
          console.log('Using direct SQL query instead...');
          
          // Use raw SQL
          const { data, error } = await supabase.rpc('query_extensions');
          
          if (error) {
            console.error('Error checking extensions:', error);
            return;
          }
          
          console.log('✅ Currently Enabled Extensions:');
          console.table(data);
        }
      } else {
        console.log('✅ Currently Enabled Extensions:');
        console.table(sqlExtensions);
      }
    } else {
      console.log('✅ Currently Enabled Extensions:');
      console.table(extensions);
    }

    // Check available but not enabled extensions
    console.log('\n📦 Checking Available Extensions...');
    
    const checkExtensions = [
      'vector',
      'pg_cron',
      'pg_net',
      'pgjwt',
      'pg_jsonschema',
      'pg_graphql',
      'pg_stat_statements',
      'hypopg',
      'wrappers',
      'pgaudit'
    ];

    // Check which important extensions are NOT enabled
    const { data: availableExt, error: availError } = await supabase.rpc('check_available_extensions', {
      extension_list: checkExtensions
    }).single();

    if (availError) {
      console.log('Could not check available extensions');
    } else {
      console.log('\n📋 Extension Availability:');
      console.table(availableExt);
    }

    // Check existing tables with vector columns
    console.log('\n🔍 Checking for existing vector columns...');
    
    const { data: vectorColumns, error: vecError } = await supabase.rpc('find_vector_columns');
    
    if (!vecError && vectorColumns) {
      console.log('✅ Tables with vector columns:');
      console.table(vectorColumns);
    } else {
      console.log('ℹ️ No vector columns found or vector extension not enabled');
    }

    // Check for cron jobs
    console.log('\n⏰ Checking for scheduled jobs (pg_cron)...');
    
    const { data: cronJobs, error: cronError } = await supabase
      .from('cron.job')
      .select('*');
    
    if (!cronError && cronJobs) {
      console.log('✅ Scheduled cron jobs:');
      console.table(cronJobs);
    } else {
      console.log('ℹ️ No cron jobs found or pg_cron not enabled');
    }

    // Check database size and statistics
    console.log('\n📊 Database Statistics:');
    
    const { data: dbStats, error: statsError } = await supabase.rpc('get_database_stats');
    
    if (!statsError && dbStats) {
      console.table(dbStats);
    }

    // Check for our custom tables
    console.log('\n📋 Checking AI-related tables...');
    
    const aiTables = [
      'ai_memories',
      'ai_service_keys',
      'agent_performance_metrics',
      'knowledge_sources',
      'mlx_fine_tuning_jobs',
      'intelligent_parameters',
      'webhook_events',
      'scheduled_jobs'
    ];

    for (const table of aiTables) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (!error) {
        console.log(`✅ ${table}: ${count} records`);
      } else {
        console.log(`❌ ${table}: Not found or error`);
      }
    }

  } catch (error) {
    console.error('Error checking Supabase:', error);
  }
}

// Run the check
checkSupabaseExtensions();