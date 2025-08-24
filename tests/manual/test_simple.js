// Simple test to verify agent loading
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

async function testBasicSetup() {
  console.log('🧪 Testing Basic Setup...\n');

  // Test Supabase connection
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Supabase client created');

    // Test database
    const { data, error } = await supabase.from('ai_memories').select('*').limit(1);
    if (error) throw error;
    console.log('✅ Database connection successful');
  } catch (error) {
    console.error('❌ Supabase error:', error.message);
  }

  // Test Ollama
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    const data = await response.json();
    console.log('✅ Ollama is running');
    console.log('Available models:', data.models.map(m => m.name).join(', '));
  } catch (error) {
    console.error('❌ Ollama error:', error.message);
  }

  // Test system commands
  try {
    const { execSync } = require('child_process');
    
    // Test exiftool
    execSync('exiftool -ver', { stdio: 'pipe' });
    console.log('✅ exiftool is installed');
    
    // Test Python
    execSync('python3 --version', { stdio: 'pipe' });
    console.log('✅ Python3 is available');
  } catch (error) {
    console.error('❌ System dependency error:', error.message);
  }

  console.log('\n✅ Basic setup test completed!');
}

testBasicSetup();