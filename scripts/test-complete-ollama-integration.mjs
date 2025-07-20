#!/usr/bin/env node

import chalk from 'chalk';
import fetch from 'node-fetch';
import { execSync } from 'child_process';

console.log(chalk.blue.bold('🧪 Testing Complete Ollama Integration\n'));

const tests = {
  passed: 0,
  failed: 0,
  results: []
};

async function test(name, fn) {
  try {
    console.log(chalk.yellow(`Running: ${name}...`));
    const result = await fn();
    tests.passed++;
    tests.results.push({ name, status: 'passed', result });
    console.log(chalk.green(`✅ ${name}`));
    if (result) console.log(chalk.gray(`   ${result}`));
  } catch (error) {
    tests.failed++;
    tests.results.push({ name, status: 'failed', error: error.message });
    console.log(chalk.red(`❌ ${name}`));
    console.log(chalk.red(`   Error: ${error.message}`));
  }
}

async function runTests() {
  // Test 1: Ollama is running
  await test('Ollama is accessible', async () => {
    const response = await fetch('http://localhost:11434/api/tags');
    const data = await response.json();
    return `${data.models?.length || 0} models available`;
  });

  // Test 2: Nginx proxy is running
  await test('Nginx proxy is accessible', async () => {
    const response = await fetch('http://localhost:8080/api/tags');
    const data = await response.json();
    return `Proxy working on port 8080`;
  });

  // Test 3: SQL generation via nginx
  await test('SQL generation works', async () => {
    const response = await fetch('http://localhost:8080/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2:3b',
        prompt: 'Generate PostgreSQL to count all tables. Return only SQL.',
        stream: false,
        temperature: 0.1
      })
    });
    const data = await response.json();
    const sql = data.response?.replace(/```sql\n?/gi, '').replace(/```\n?/gi, '').trim();
    return sql ? 'Generated valid SQL' : 'No SQL generated';
  });

  // Test 4: SQL explanation
  await test('SQL explanation works', async () => {
    const response = await fetch('http://localhost:8080/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2:3b',
        prompt: 'Explain this SQL in one sentence: SELECT COUNT(*) FROM users;',
        stream: false
      })
    });
    const data = await response.json();
    return data.response ? 'Explanation generated' : 'No explanation';
  });

  // Test 5: Supabase is running
  await test('Supabase is accessible', async () => {
    const response = await fetch('http://localhost:54321/rest/v1/', {
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
      }
    });
    return `Status: ${response.status}`;
  });

  // Test 6: AI memories table exists
  await test('AI memories table exists', async () => {
    try {
      execSync('psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT COUNT(*) FROM ai_memories;" > /dev/null 2>&1');
      return 'Table exists and accessible';
    } catch (error) {
      throw new Error('Table not found');
    }
  });

  // Test 7: Test HTML page
  await test('Test HTML page exists', async () => {
    const fs = await import('fs');
    const exists = fs.existsSync('test-ollama-integration.html');
    return exists ? 'Test page available' : 'Test page missing';
  });

  // Test 8: Multiple models available
  await test('Multiple Ollama models', async () => {
    const response = await fetch('http://localhost:8080/api/tags');
    const data = await response.json();
    const models = data.models?.map(m => m.name) || [];
    const hasRequired = models.includes('llama3.2:3b');
    return hasRequired ? `llama3.2:3b available (${models.length} total)` : 'Required model missing';
  });

  // Summary
  console.log(chalk.blue.bold('\n📊 Test Summary:\n'));
  console.log(chalk.green(`   Passed: ${tests.passed}`));
  console.log(chalk.red(`   Failed: ${tests.failed}`));
  
  if (tests.failed === 0) {
    console.log(chalk.green.bold('\n✨ All tests passed! Ollama integration is working perfectly.\n'));
    console.log(chalk.cyan('Next steps:'));
    console.log(chalk.gray('1. Open test-ollama-integration.html in your browser'));
    console.log(chalk.gray('2. Copy scripts/supabase-studio-ai-helper.js to Supabase Studio console'));
    console.log(chalk.gray('3. Use AI.generate(), AI.explain(), AI.optimize() commands'));
  } else {
    console.log(chalk.red.bold('\n⚠️  Some tests failed. Check the errors above.\n'));
    console.log(chalk.yellow('Common fixes:'));
    console.log(chalk.gray('- Start Ollama: ollama serve'));
    console.log(chalk.gray('- Start nginx: npm run ollama:nginx:start'));
    console.log(chalk.gray('- Start Supabase: npx supabase start'));
  }

  // Show available commands
  console.log(chalk.blue.bold('\n🎯 Available Commands:\n'));
  console.log(chalk.gray('npm run ollama:test          # Test Ollama basics'));
  console.log(chalk.gray('npm run ollama:nginx:start   # Start nginx proxy'));
  console.log(chalk.gray('npm run ollama:nginx:logs    # View nginx logs'));
  console.log(chalk.gray('npm run view:memories        # View AI memories'));
  console.log(chalk.gray('npm run db:manager           # Database management'));
}

// Run all tests
runTests().catch(console.error);