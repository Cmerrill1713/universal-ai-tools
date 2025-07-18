#!/usr/bin/env node
/**
 * Integration Test for Personal AI Agents
 * Simple JavaScript test that doesn't require compilation
 */

const { createClient } = require('@supabase/supabase-js');

console.log('🧪 Personal AI Agents Integration Test\n');

// Test Supabase connection
async function testSupabase() {
  console.log('📡 Testing Supabase Connection...');
  
  const supabaseUrl = 'http://127.0.0.1:54321';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
  
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Test inserting a memory
    const { data, error } = await supabase
      .from('ai_memories')
      .insert({
        service_id: 'test_agent',
        memory_type: 'test',
        content: 'Integration test memory',
        metadata: { test: true }
      })
      .select()
      .single();
    
    if (error) throw error;
    
    console.log('  ✅ Supabase connection successful');
    console.log('  ✅ Memory stored:', data.id);
    
    // Clean up
    await supabase.from('ai_memories').delete().eq('id', data.id);
    
    return true;
  } catch (error) {
    console.log('  ❌ Supabase connection failed:', error.message);
    return false;
  }
}

// Test Ollama connection
async function testOllama() {
  console.log('\n🤖 Testing Ollama Connection...');
  
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    const data = await response.json();
    
    console.log('  ✅ Ollama is running');
    console.log('  Available models:', data.models.map(m => m.name).join(', '));
    
    // Check for required models
    const hasLlama = data.models.some(m => m.name.includes('llama3.2:3b'));
    const hasDeepseek = data.models.some(m => m.name.includes('deepseek-r1:14b'));
    
    console.log(`  ${hasLlama ? '✅' : '❌'} llama3.2:3b model`);
    console.log(`  ${hasDeepseek ? '✅' : '❌'} deepseek-r1:14b model`);
    
    return hasLlama && hasDeepseek;
  } catch (error) {
    console.log('  ❌ Ollama connection failed:', error.message);
    return false;
  }
}

// Test system dependencies
async function testSystemDependencies() {
  console.log('\n🔧 Testing System Dependencies...');
  
  const { exec } = require('child_process');
  const util = require('util');
  const execAsync = util.promisify(exec);
  
  // Test exiftool
  try {
    const { stdout } = await execAsync('exiftool -ver');
    console.log(`  ✅ ExifTool installed: v${stdout.trim()}`);
  } catch (error) {
    console.log('  ❌ ExifTool not found');
  }
  
  // Test Python
  try {
    const { stdout } = await execAsync('python3 --version');
    console.log(`  ✅ Python installed: ${stdout.trim()}`);
  } catch (error) {
    console.log('  ❌ Python3 not found');
  }
  
  // Test if playwright browsers are installed
  try {
    const { stdout } = await execAsync('npx playwright --version');
    console.log(`  ✅ Playwright installed: ${stdout.trim()}`);
  } catch (error) {
    console.log('  ❌ Playwright not found');
  }
}

// Test a simple agent workflow
async function testSimpleWorkflow() {
  console.log('\n🎯 Testing Simple Agent Workflow...');
  
  const supabase = createClient(
    'http://127.0.0.1:54321',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
  );
  
  try {
    // Test storing an agent log
    const { data: log, error: logError } = await supabase
      .from('agent_logs')
      .insert({
        agent_name: 'test_agent',
        operation: 'integration_test',
        status: 'success',
        duration_ms: 100,
        metadata: { test: true }
      })
      .select()
      .single();
    
    if (logError) throw logError;
    
    console.log('  ✅ Agent log stored successfully');
    
    // Test user preferences
    const { data: pref, error: prefError } = await supabase
      .from('user_preferences')
      .insert({
        user_id: 'test_user',
        preferences: {
          theme: 'dark',
          language: 'en',
          timezone: 'America/Los_Angeles'
        }
      })
      .select()
      .single();
    
    if (prefError && !prefError.message.includes('duplicate')) {
      throw prefError;
    }
    
    console.log('  ✅ User preferences stored successfully');
    
    // Clean up
    if (log) await supabase.from('agent_logs').delete().eq('id', log.id);
    if (pref) await supabase.from('user_preferences').delete().eq('id', pref.id);
    
    return true;
  } catch (error) {
    console.log('  ❌ Workflow test failed:', error.message);
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('Starting integration tests...\n');
  
  const results = {
    supabase: await testSupabase(),
    ollama: await testOllama(),
    workflow: await testSimpleWorkflow()
  };
  
  await testSystemDependencies();
  
  console.log('\n📊 Test Summary:');
  console.log('================');
  
  const passed = Object.values(results).filter(r => r).length;
  const total = Object.keys(results).length;
  
  console.log(`✅ Passed: ${passed}/${total}`);
  console.log(`${passed === total ? '🎉' : '⚠️'} Overall: ${passed === total ? 'All tests passed!' : 'Some tests failed'}`);
  
  if (passed === total) {
    console.log('\n🚀 Your Personal AI Assistant system is ready to use!');
    console.log('\nNext steps:');
    console.log('1. Compile the TypeScript code: npm run build');
    console.log('2. Start the service: npm start');
    console.log('3. Try example commands like:');
    console.log('   - "Schedule a meeting tomorrow at 2pm"');
    console.log('   - "Organize my photos by people"');
    console.log('   - "Clean up duplicate files in Downloads"');
    console.log('   - "Generate a Python script to process CSV files"');
  }
}

// Execute tests
runTests().catch(console.error);