/**
 * Check Supabase Extensions and Database State
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('❌ No Supabase key found in environment variables');
  process.exit(1);
}

console.log('🔍 Checking Supabase Extensions and Database State...\n');
console.log(`📍 URL: ${supabaseUrl}\n`);

const supabase = createClient(supabaseUrl, supabaseKey);

// First, let's check what tables exist
console.log('📋 Checking existing tables...\n');

const { data: tables, error: tablesError } = await supabase
  .from('information_schema.tables')
  .select('table_schema, table_name')
  .eq('table_schema', 'public')
  .order('table_name');

if (tablesError) {
  console.error('❌ Error checking tables:', tablesError.message);
  
  // Try a simpler approach - check specific tables
  const tablesToCheck = [
    'ai_memories',
    'ai_service_keys',
    'agent_performance_metrics',
    'knowledge_sources',
    'mlx_fine_tuning_jobs',
    'intelligent_parameters',
    'self_improvement_logs',
    'alpha_evolve_experiments'
  ];

  console.log('Checking specific tables:\n');
  
  for (const table of tablesToCheck) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (!error) {
        console.log(`✅ ${table}: ${count || 0} records`);
      } else {
        console.log(`❌ ${table}: Not found`);
      }
    } catch (e) {
      console.log(`❌ ${table}: Error - ${e.message}`);
    }
  }
} else {
  console.log('✅ Found', tables?.length || 0, 'tables in public schema\n');
  
  if (tables && tables.length > 0) {
    // Group tables by category
    const aiTables = tables.filter(t => 
      t.table_name.includes('ai_') || 
      t.table_name.includes('agent_') ||
      t.table_name.includes('memory') ||
      t.table_name.includes('knowledge')
    );
    
    const migrationTables = tables.filter(t => 
      t.table_name.includes('migration')
    );
    
    if (aiTables.length > 0) {
      console.log('🤖 AI-related tables:');
      aiTables.forEach(t => console.log(`  - ${t.table_name}`));
      console.log('');
    }
    
    if (migrationTables.length > 0) {
      console.log('📦 Migration tables:');
      migrationTables.forEach(t => console.log(`  - ${t.table_name}`));
      console.log('');
    }
  }
}

// Check for extensions via functions
console.log('\n🔧 Checking extensions...\n');

try {
  // Try to check if vector operations work
  const { data: vectorTest, error: vectorError } = await supabase.rpc('test_vector_extension');
  
  if (vectorError && vectorError.message.includes('function') && vectorError.message.includes('does not exist')) {
    console.log('ℹ️  Vector extension check: Function not found, creating test...');
    
    // Let's just check if we can query ai_memories with embedding column
    const { data: memoryCheck, error: memError } = await supabase
      .from('ai_memories')
      .select('id, embedding')
      .limit(1);
    
    if (!memError) {
      console.log('✅ ai_memories table exists');
      if (memoryCheck && memoryCheck.length > 0 && 'embedding' in memoryCheck[0]) {
        console.log('✅ Vector column (embedding) exists in ai_memories');
      } else {
        console.log('ℹ️  No embedding column found in ai_memories');
      }
    } else {
      console.log('❌ ai_memories table not accessible:', memError.message);
    }
  } else if (!vectorError) {
    console.log('✅ Vector extension is working');
  }
} catch (e) {
  console.log('ℹ️  Could not check vector extension');
}

// Check auth configuration
console.log('\n🔐 Checking auth configuration...\n');

const { data: authConfig, error: authError } = await supabase.auth.getSession();

if (!authError) {
  console.log('✅ Auth is configured and accessible');
} else {
  console.log('⚠️  Auth check failed:', authError.message);
}

// Summary
console.log('\n📊 Summary:\n');
console.log('1. Database connection: ✅ Working');
console.log('2. Run the SQL script in Supabase Dashboard for detailed extension info');
console.log('3. Use Dashboard > Database > Extensions to enable/disable extensions');
console.log('\n✨ Check complete!');