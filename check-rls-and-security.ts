#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, supabaseKey);

interface RLSCheck {
  tableName: string;
  rlsEnabled: boolean;
  policies: any[];
}

interface IndexCheck {
  tableName: string;
  indexName: string;
  columns: string[];
}

async function checkRLS() {
  console.log('🔐 Checking Row Level Security (RLS) Status\n');
  
  // Query to check RLS status
  const { data: tables, error } = await supabase.rpc('exec_sql', {
    sql_string: `
      SELECT 
        schemaname,
        tablename,
        rowsecurity
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `
  }).single();

  if (error) {
    // Fallback query
    console.log('Using fallback RLS check...\n');
    
    const { data: allTables } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');
      
    if (allTables) {
      console.log('⚠️  Cannot check RLS status directly. Tables found:');
      allTables.forEach(t => console.log(`  - ${t.table_name}`));
      console.log('\n💡 To check RLS manually:');
      console.log('   1. Open Supabase Studio');
      console.log('   2. Go to Authentication > Policies');
      console.log('   3. Check each table for RLS status');
    }
    return;
  }

  // Parse results
  if (tables) {
    const rlsResults = JSON.parse(tables);
    let enabledCount = 0;
    let disabledCount = 0;
    
    console.log('📊 RLS Status by Table:\n');
    
    const criticalTables = [
      'ai_service_keys',
      'api_keys', 
      'jwt_secrets',
      'encryption_keys',
      'mcp_key_vault'
    ];
    
    rlsResults.forEach((table: any) => {
      const isCritical = criticalTables.includes(table.tablename);
      if (table.rowsecurity) {
        enabledCount++;
        console.log(`  ✅ ${table.tablename} - RLS Enabled ${isCritical ? '🔒 (Critical)' : ''}`);
      } else {
        disabledCount++;
        console.log(`  ❌ ${table.tablename} - RLS Disabled ${isCritical ? '⚠️  (SECURITY RISK!)' : ''}`);
      }
    });
    
    console.log(`\n📈 Summary: ${enabledCount} enabled, ${disabledCount} disabled`);
    
    if (disabledCount > 0) {
      console.log('\n⚠️  SECURITY RECOMMENDATIONS:');
      console.log('   1. Enable RLS on all tables containing sensitive data');
      console.log('   2. Critical tables that MUST have RLS:');
      criticalTables.forEach(t => console.log(`      - ${t}`));
      console.log('   3. Add appropriate policies for authenticated/service role access');
    }
  }
}

async function checkIndexes() {
  console.log('\n\n📇 Checking Database Indexes\n');
  
  const { data: indexes, error } = await supabase.rpc('exec_sql', {
    sql_string: `
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND indexname NOT LIKE '%_pkey'
      ORDER BY tablename, indexname;
    `
  }).single();

  if (error) {
    console.log('⚠️  Cannot check indexes directly');
    return;
  }

  if (indexes) {
    const indexResults = JSON.parse(indexes);
    const tableIndexes: Record<string, string[]> = {};
    
    indexResults.forEach((idx: any) => {
      if (!tableIndexes[idx.tablename]) {
        tableIndexes[idx.tablename] = [];
      }
      tableIndexes[idx.tablename].push(idx.indexname);
    });
    
    console.log('📊 Indexes by Table:\n');
    Object.entries(tableIndexes).forEach(([table, idxs]) => {
      console.log(`  ${table}:`);
      idxs.forEach(idx => console.log(`    - ${idx}`));
    });
    
    // Check for missing critical indexes
    console.log('\n🔍 Checking for recommended indexes...\n');
    
    const recommendedIndexes = [
      { table: 'ai_memories', column: 'service_id' },
      { table: 'ai_memories', column: 'created_at' },
      { table: 'agent_performance_metrics', column: 'agent_id' },
      { table: 'mcp_context', column: 'category' },
      { table: 'mcp_context', column: 'timestamp' },
      { table: 'mcp_code_patterns', column: 'pattern_type' },
      { table: 'mcp_task_progress', column: 'status' },
      { table: 'knowledge_base', column: 'source_id' },
    ];
    
    let missingCount = 0;
    recommendedIndexes.forEach(({ table, column }) => {
      const tableIdxs = tableIndexes[table] || [];
      const hasIndex = tableIdxs.some(idx => idx.includes(column));
      if (!hasIndex) {
        console.log(`  ⚠️  Missing index on ${table}.${column}`);
        missingCount++;
      }
    });
    
    if (missingCount === 0) {
      console.log('  ✅ All recommended indexes are present');
    }
  }
}

async function checkFunctions() {
  console.log('\n\n🔧 Checking Database Functions & Stored Procedures\n');
  
  const { data: functions, error } = await supabase.rpc('exec_sql', {
    sql_string: `
      SELECT 
        routine_name,
        routine_type,
        data_type
      FROM information_schema.routines
      WHERE routine_schema = 'public'
      ORDER BY routine_name;
    `
  }).single();

  if (error) {
    console.log('⚠️  Cannot check functions directly');
    return;
  }

  if (functions) {
    const funcResults = JSON.parse(functions);
    
    if (funcResults.length === 0) {
      console.log('  ℹ️  No custom functions found');
    } else {
      console.log('📊 Available Functions:\n');
      funcResults.forEach((func: any) => {
        console.log(`  - ${func.routine_name} (${func.routine_type})`);
      });
    }
    
    // Check for expected functions
    console.log('\n🔍 Checking for expected functions...\n');
    
    const expectedFunctions = [
      'update_updated_at_column',
      'vector_search',
      'exec_sql',
      'get_tables'
    ];
    
    const foundFunctions = funcResults.map((f: any) => f.routine_name);
    expectedFunctions.forEach(funcName => {
      if (foundFunctions.includes(funcName)) {
        console.log(`  ✅ ${funcName}`);
      } else {
        console.log(`  ⚠️  Missing: ${funcName}`);
      }
    });
  }
}

async function checkVault() {
  console.log('\n\n🔑 Checking Supabase Vault Setup\n');
  
  // Check if vault schema exists
  const { data: schemas, error } = await supabase.rpc('exec_sql', {
    sql_string: `
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name = 'vault';
    `
  }).single();

  if (error || !schemas || JSON.parse(schemas).length === 0) {
    console.log('  ❌ Vault schema not found');
    console.log('\n  💡 To enable Vault:');
    console.log('     1. Go to Supabase Dashboard > Settings > Vault');
    console.log('     2. Enable the Vault extension');
    console.log('     3. Use vault.create_secret() to store API keys');
    return;
  }

  console.log('  ✅ Vault schema is installed');
  
  // Check for vault functions
  const { data: vaultFuncs } = await supabase.rpc('exec_sql', {
    sql_string: `
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'vault'
      AND routine_name IN ('create_secret', 'read_secret', 'update_secret', 'delete_secret');
    `
  }).single();

  if (vaultFuncs) {
    const funcs = JSON.parse(vaultFuncs);
    console.log(`  ✅ Vault functions available: ${funcs.length}/4`);
  }
}

async function suggestMissingTools() {
  console.log('\n\n🛠️  Suggested Additional Tools & Tables\n');
  
  console.log('1. 📊 Monitoring & Observability:');
  console.log('   - system_health_checks table');
  console.log('   - api_request_logs table');
  console.log('   - error_logs table with stack traces');
  console.log('   - performance_metrics table');
  
  console.log('\n2. 🔄 Workflow Management:');
  console.log('   - workflow_templates table');
  console.log('   - workflow_executions table');
  console.log('   - workflow_state_transitions table');
  
  console.log('\n3. 🧪 Testing & Validation:');
  console.log('   - test_suites table');
  console.log('   - test_results table');
  console.log('   - model_benchmarks table');
  
  console.log('\n4. 💬 Communication & Notifications:');
  console.log('   - notifications table');
  console.log('   - webhook_endpoints table');
  console.log('   - event_subscriptions table');
  
  console.log('\n5. 🎯 Feature Flags & Configuration:');
  console.log('   - feature_flags table');
  console.log('   - configuration_overrides table');
  console.log('   - environment_settings table');
  
  console.log('\n6. 📝 Audit & Compliance:');
  console.log('   - audit_logs table with who/what/when/why');
  console.log('   - data_retention_policies table');
  console.log('   - compliance_reports table');
}

async function runSecurityCheck() {
  console.log('🔒 UNIVERSAL AI TOOLS - SECURITY & COMPLETENESS CHECK\n');
  console.log('=' + '='.repeat(59) + '\n');
  
  await checkRLS();
  await checkIndexes();
  await checkFunctions();
  await checkVault();
  await suggestMissingTools();
  
  console.log('\n\n📋 SECURITY CHECKLIST:\n');
  console.log('[ ] Enable RLS on all tables with sensitive data');
  console.log('[ ] Add RLS policies for service_role and authenticated users');
  console.log('[ ] Store all API keys in Supabase Vault');
  console.log('[ ] Enable audit logging for critical operations');
  console.log('[ ] Set up proper indexes for query performance');
  console.log('[ ] Implement rate limiting on API endpoints');
  console.log('[ ] Regular security audits and penetration testing');
  console.log('[ ] Encrypt sensitive data at rest');
  console.log('[ ] Implement proper CORS policies');
  console.log('[ ] Set up monitoring and alerting');
}

runSecurityCheck().catch(console.error);