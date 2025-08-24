/**
 * Simple Supabase Extensions Check
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('❌ No Supabase key found in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkExtensions() {
  console.log('🔍 Checking Supabase Extensions...\n');
  console.log(`URL: ${supabaseUrl}\n`);

  try {
    // Get enabled extensions
    const { data, error } = await supabase.rpc('get_enabled_extensions');
    
    if (error) {
      // Create the function if it doesn't exist
      console.log('Creating helper function...');
      
      const { error: createError } = await supabase.sql`
        CREATE OR REPLACE FUNCTION get_enabled_extensions()
        RETURNS TABLE(name text, version text)
        LANGUAGE sql
        SECURITY DEFINER
        SET search_path = public
        AS $$
          SELECT extname::text, extversion::text 
          FROM pg_extension 
          WHERE extname NOT IN ('plpgsql')
          ORDER BY extname;
        $$;
      `;
      
      if (createError) {
        console.error('Could not create function:', createError.message);
        
        // Try direct query
        const { data: directData, error: directError } = await supabase
          .from('pg_extension')
          .select('extname, extversion');
          
        if (directError) {
          console.error('❌ Cannot access pg_extension:', directError.message);
          return;
        }
        
        console.log('✅ Enabled Extensions (via direct query):');
        console.table(directData);
      } else {
        // Try again after creating function
        const { data: retryData, error: retryError } = await supabase.rpc('get_enabled_extensions');
        
        if (!retryError) {
          console.log('✅ Enabled Extensions:');
          console.table(retryData);
        }
      }
    } else {
      console.log('✅ Enabled Extensions:');
      console.table(data);
    }

    // Check specific tables
    console.log('\n📋 Checking AI Tables...\n');
    
    const tables = [
      'ai_memories',
      'ai_service_keys', 
      'agent_performance_metrics',
      'knowledge_sources',
      'mlx_fine_tuning_jobs',
      'intelligent_parameters'
    ];

    for (const table of tables) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (!error) {
        console.log(`✅ ${table}: ${count} records`);
      } else {
        console.log(`❌ ${table}: ${error.message}`);
      }
    }

    // Check if vector extension is enabled
    console.log('\n🔍 Checking for vector extension...');
    
    const { data: vectorCheck, error: vectorError } = await supabase.sql`
      SELECT COUNT(*) as count 
      FROM pg_extension 
      WHERE extname = 'vector';
    `;
    
    if (!vectorError && vectorCheck && vectorCheck[0].count > 0) {
      console.log('✅ Vector extension is enabled');
      
      // Check for vector columns
      const { data: vectorCols, error: vecColError } = await supabase.sql`
        SELECT 
          table_name,
          column_name
        FROM information_schema.columns
        WHERE udt_name = 'vector'
        AND table_schema = 'public';
      `;
      
      if (!vecColError && vectorCols && vectorCols.length > 0) {
        console.log('\n📊 Tables with vector columns:');
        console.table(vectorCols);
      } else {
        console.log('ℹ️ No vector columns found');
      }
    } else {
      console.log('❌ Vector extension is NOT enabled');
    }

    // Check for pg_cron
    console.log('\n⏰ Checking for pg_cron...');
    
    const { data: cronCheck, error: cronError } = await supabase.sql`
      SELECT COUNT(*) as count 
      FROM pg_extension 
      WHERE extname = 'pg_cron';
    `;
    
    if (!cronError && cronCheck && cronCheck[0].count > 0) {
      console.log('✅ pg_cron extension is enabled');
    } else {
      console.log('❌ pg_cron extension is NOT enabled');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkExtensions();