#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

console.log('🧪 Testing AI Memories System for Autofix\n');

// Read Supabase config
const envContent = fs.readFileSync('.env', 'utf8');
const urlMatch = envContent.match(/SUPABASE_URL\s*=\s*["']?([^"'\s]+)["']?/);
const keyMatch = envContent.match(/SUPABASE_ANON_KEY\s*=\s*["']?([^"'\s]+)["']?/);

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function testAIMemoriesSystem() {
  console.log(`📡 Connecting to: ${urlMatch[1]}`);
  
  try {
    // Test 1: Insert autofix memory
    console.log('\n🔍 Test 1: Inserting autofix memory...');
    const autofixMemory = {
      service_id: 'claude-autofix',
      memory_type: 'autofix_pattern',
      content: 'Successfully fixed TypeScript any types in base_agent.ts - replaced 12 any types with proper Request/Response types',
      metadata: {
        fix_type: 'type_improvement',
        file_path: 'src/agents/base_agent.ts',
        success: true,
        confidence: 0.85,
        errors_fixed: 0,
        warnings_fixed: 12,
        session_id: `test_${Date.now()}`,
        improvement_score: 0.25,
        tags: ['autofix', 'typescript', 'any-types']
      },
      memory_category: 'code_improvement',
      importance_score: 0.8,
      keywords: ['autofix', 'typescript', 'types', 'base_agent']
    };

    const { data: insertData, error: insertError } = await supabase
      .from('ai_memories')
      .insert(autofixMemory)
      .select()
      .single();

    if (insertError) {
      console.error('❌ Failed to insert autofix memory:', insertError.message);
      return false;
    }

    console.log('✅ Successfully inserted autofix memory:', insertData.id);

    // Test 2: Insert session summary
    console.log('\n🔍 Test 2: Inserting session summary...');
    const sessionSummary = {
      service_id: 'claude-advanced-autofix',
      memory_type: 'session_summary',
      content: 'Advanced autofix session completed: 42 errors fixed, 18 warnings fixed across 6 files with 95% success rate',
      metadata: {
        total_errors_fixed: 42,
        total_warnings_fixed: 18,
        files_modified: 6,
        patterns_used: ['type_improvement', 'import_sorting', 'magic_numbers', 'unused_variables'],
        session_id: `test_${Date.now()}`,
        success_rate: 0.95,
        duration_ms: 45000,
        tags: ['autofix', 'session', 'summary', 'advanced']
      },
      memory_category: 'system_performance',
      importance_score: 0.9,
      keywords: ['autofix', 'session', 'summary', 'performance']
    };

    const { data: sessionData, error: sessionError } = await supabase
      .from('ai_memories')
      .insert(sessionSummary)
      .select()
      .single();

    if (sessionError) {
      console.error('❌ Failed to insert session summary:', sessionError.message);
      return false;
    }

    console.log('✅ Successfully inserted session summary:', sessionData.id);

    // Test 3: Retrieve autofix memories
    console.log('\n🔍 Test 3: Retrieving autofix memories...');
    const { data: autofixMemories, error: retrieveError } = await supabase
      .from('ai_memories')
      .select('*')
      .eq('service_id', 'claude-autofix')
      .order('created_at', { ascending: false })
      .limit(10);

    if (retrieveError) {
      console.error('❌ Failed to retrieve memories:', retrieveError.message);
      return false;
    }

    console.log(`✅ Retrieved ${autofixMemories.length} autofix memories`);

    // Test 4: Search by memory type
    console.log('\n🔍 Test 4: Searching by memory type...');
    const { data: typeMemories, error: typeError } = await supabase
      .from('ai_memories')
      .select('*')
      .eq('memory_type', 'autofix_pattern')
      .order('importance_score', { ascending: false })
      .limit(5);

    if (typeError) {
      console.error('❌ Failed to search by type:', typeError.message);
      return false;
    }

    console.log(`✅ Found ${typeMemories.length} autofix pattern memories`);

    // Test 5: Update access count (simulate memory retrieval)
    console.log('\n🔍 Test 5: Updating memory access...');
    const { data: updateData, error: updateError } = await supabase
      .from('ai_memories')
      .update({ 
        access_count: 1,
        last_accessed: new Date().toISOString()
      })
      .eq('id', insertData.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Failed to update access:', updateError.message);
      return false;
    }

    console.log('✅ Successfully updated memory access count');

    // Test 6: Show memory summary
    console.log('\n📊 Memory Summary:');
    const { data: summary, error: summaryError } = await supabase
      .from('ai_memories')
      .select('memory_type, service_id')
      .like('service_id', 'claude-%');

    if (!summaryError && summary) {
      const stats = {};
      summary.forEach(mem => {
        const key = `${mem.service_id}:${mem.memory_type}`;
        stats[key] = (stats[key] || 0) + 1;
      });

      Object.entries(stats).forEach(([key, count]) => {
        console.log(`   • ${key}: ${count} memories`);
      });
    }

    console.log('\n🎉 All AI memories tests passed!');
    console.log('\n🚀 System ready for memory-enhanced autofix!');
    console.log('\n📖 View data in Supabase Studio:');
    console.log('   http://localhost:54323 → Table Editor → ai_memories');
    console.log('   Filter by service_id: claude-autofix');

    return true;

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Run tests
testAIMemoriesSystem().then(success => {
  if (!success) {
    console.log('\n⚠️  Some tests failed.');
    process.exit(1);
  }
});