#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

console.log('🧪 Testing Supabase Memory System\n');

// Read Supabase config
const envContent = fs.readFileSync('.env', 'utf8');
const urlMatch = envContent.match(/SUPABASE_URL\s*=\s*["']?([^"'\s]+)["']?/);
const keyMatch = envContent.match(/SUPABASE_ANON_KEY\s*=\s*["']?([^"'\s]+)["']?/);

if (!urlMatch || !keyMatch) {
  console.error('❌ Could not find Supabase config in .env');
  process.exit(1);
}

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function testMemorySystem() {
  console.log(`📡 Connecting to: ${urlMatch[1]}`);
  
  try {
    // Test 1: Check if memories table exists
    console.log('\n🔍 Test 1: Checking memories table...');
    const { data: tableData, error: tableError } = await supabase
      .from('memories')
      .select('count')
      .limit(1);

    if (tableError) {
      console.error('❌ Memories table not found:', tableError.message);
      console.log('\n🛠️  Please run this SQL in Supabase Studio:');
      console.log('   Copy contents from: scripts/create-memory-table.sql');
      console.log('   Or visit: http://localhost:54323 → SQL Editor');
      return false;
    }

    console.log('✅ Memories table exists');

    // Test 2: Check existing memories
    console.log('\n🔍 Test 2: Checking existing autofix memories...');
    const { data: existingMemories, error: selectError } = await supabase
      .from('memories')
      .select('*')
      .like('user_id', 'claude-%')
      .order('created_at', { ascending: false })
      .limit(10);

    if (selectError) {
      console.error('❌ Failed to read memories:', selectError.message);
      return false;
    }

    console.log(`✅ Found ${existingMemories.length} existing autofix memories`);
    
    if (existingMemories.length > 0) {
      console.log('\n📚 Recent memories:');
      existingMemories.slice(0, 3).forEach((memory, i) => {
        console.log(`   ${i + 1}. ${memory.content.substring(0, 60)}...`);
        console.log(`      Type: ${memory.metadata.memory_type || 'unknown'}`);
        console.log(`      User: ${memory.user_id}`);
        console.log(`      Date: ${new Date(memory.created_at).toLocaleDateString()}`);
      });
    }

    // Test 3: Insert new test memory
    console.log('\n🔍 Test 3: Inserting new test memory...');
    const testMemory = {
      content: `Memory system test - ${new Date().toISOString()}`,
      metadata: {
        memory_type: 'system_test',
        test_run: true,
        autofix_version: '2.0.0',
        timestamp: new Date().toISOString(),
        tags: ['test', 'memory', 'autofix']
      },
      user_id: 'claude-autofix'
    };

    const { data: insertData, error: insertError } = await supabase
      .from('memories')
      .insert(testMemory)
      .select()
      .single();

    if (insertError) {
      console.error('❌ Failed to insert test memory:', insertError.message);
      return false;
    }

    console.log('✅ Successfully inserted test memory:', insertData.id);

    // Test 4: Test metadata filtering
    console.log('\n🔍 Test 4: Testing metadata filtering...');
    const { data: filteredData, error: filterError } = await supabase
      .from('memories')
      .select('*')
      .eq('metadata->>memory_type', 'system_test')
      .limit(5);

    if (filterError) {
      console.error('❌ Metadata filtering failed:', filterError.message);
      return false;
    }

    console.log(`✅ Metadata filtering works: Found ${filteredData.length} test memories`);

    // Test 5: Test autofix memory storage simulation
    console.log('\n🔍 Test 5: Simulating autofix memory storage...');
    const autofixMemory = {
      content: 'Simulated autofix: Fixed 5 TypeScript any types in test file',
      metadata: {
        memory_type: 'autofix',
        fix_type: 'type_improvement',
        file_path: 'test/example.ts',
        success: true,
        confidence: 0.88,
        errors_fixed: 2,
        warnings_fixed: 3,
        session_id: `test_${Date.now()}`,
        improvement_score: 0.15,
        tags: ['autofix', 'typescript', 'test']
      },
      user_id: 'claude-autofix'
    };

    const { data: autofixData, error: autofixError } = await supabase
      .from('memories')
      .insert(autofixMemory)
      .select()
      .single();

    if (autofixError) {
      console.error('❌ Failed to store autofix memory:', autofixError.message);
      return false;
    }

    console.log('✅ Successfully stored autofix memory:', autofixData.id);

    // Test 6: Retrieve autofix patterns
    console.log('\n🔍 Test 6: Retrieving autofix patterns...');
    const { data: patterns, error: patternsError } = await supabase
      .from('memories')
      .select('*')
      .eq('metadata->>memory_type', 'autofix')
      .order('created_at', { ascending: false })
      .limit(5);

    if (patternsError) {
      console.error('❌ Failed to retrieve patterns:', patternsError.message);
      return false;
    }

    console.log(`✅ Retrieved ${patterns.length} autofix patterns`);

    if (patterns.length > 0) {
      console.log('\n🎯 Autofix patterns found:');
      const fixTypes = {};
      patterns.forEach(pattern => {
        const fixType = pattern.metadata.fix_type || 'unknown';
        fixTypes[fixType] = (fixTypes[fixType] || 0) + 1;
      });
      
      Object.entries(fixTypes).forEach(([type, count]) => {
        console.log(`   • ${type}: ${count} instances`);
      });
    }

    console.log('\n🎉 All memory system tests passed!');
    console.log('\n🚀 Ready to use memory-enhanced autofix:');
    console.log('   npm run fix:advanced    # Will now store memories');
    console.log('   npm run fix:adaptive    # Will learn from stored patterns');
    console.log('\n📊 View data in Supabase Studio:');
    console.log('   http://localhost:54323 → Table Editor → memories');
    console.log('   Filter by user_id: claude-autofix');

    return true;

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Run tests
testMemorySystem().then(success => {
  if (!success) {
    console.log('\n⚠️  Some tests failed. Check the setup instructions above.');
    process.exit(1);
  }
});