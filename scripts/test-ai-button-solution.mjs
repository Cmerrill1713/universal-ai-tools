#!/usr/bin/env node

import chalk from 'chalk';
import fetch from 'node-fetch';

console.log(chalk.blue.bold('🧪 Testing Supabase Studio AI Button Solution\n'));

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testService(name, url, expectedResponse) {
  try {
    console.log(chalk.yellow(`Testing ${name}...`));
    const response = await fetch(url);
    const data = await response.json();
    
    if (expectedResponse && !expectedResponse(data)) {
      throw new Error('Unexpected response format');
    }
    
    console.log(chalk.green(`✅ ${name} is running`));
    return true;
  } catch (error) {
    console.log(chalk.red(`❌ ${name} is not running`));
    return false;
  }
}

async function testOpenAIProxy() {
  console.log(chalk.yellow('\nTesting OpenAI proxy endpoints...\n'));
  
  // Test chat completions
  try {
    const response = await fetch('http://localhost:8081/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: 'Generate SQL to count all users' }
        ],
        model: 'llama3.2:3b',
        temperature: 0.1
      })
    });
    
    const data = await response.json();
    
    if (data.choices && data.choices[0]?.message?.content) {
      const sql = data.choices[0].message.content;
      console.log(chalk.green('✅ Chat completions endpoint works'));
      console.log(chalk.gray(`   Generated: ${sql.substring(0, 50)}...`));
      return true;
    } else {
      throw new Error('Invalid response format');
    }
  } catch (error) {
    console.log(chalk.red('❌ Chat completions endpoint failed'));
    console.log(chalk.red(`   Error: ${error.message}`));
    return false;
  }
}

async function runTests() {
  console.log(chalk.cyan('Checking required services...\n'));
  
  // Test Ollama
  const ollamaOk = await testService(
    'Ollama', 
    'http://localhost:11434/api/tags',
    data => data.models && Array.isArray(data.models)
  );
  
  // Test Nginx proxy
  const nginxOk = await testService(
    'Nginx proxy',
    'http://localhost:8080/api/tags',
    data => data.models && Array.isArray(data.models)
  );
  
  // Test OpenAI proxy
  const openaiProxyOk = await testService(
    'OpenAI proxy',
    'http://localhost:8081/',
    data => data.service === 'OpenAI → Ollama Proxy'
  );
  
  // Test OpenAI endpoints
  let openaiEndpointsOk = false;
  if (openaiProxyOk) {
    openaiEndpointsOk = await testOpenAIProxy();
  }
  
  // Summary
  console.log(chalk.blue.bold('\n📊 Test Summary:\n'));
  
  const allOk = ollamaOk && nginxOk && openaiProxyOk && openaiEndpointsOk;
  
  if (allOk) {
    console.log(chalk.green.bold('✅ All services running! AI Button should work.\n'));
    
    console.log(chalk.cyan('To use the AI Assistant button:'));
    console.log(chalk.gray('1. Open Supabase Studio: http://localhost:54323'));
    console.log(chalk.gray('2. Go to SQL Editor'));
    console.log(chalk.gray('3. Click the AI Assistant button'));
    console.log(chalk.gray('4. Type your SQL request'));
    
    console.log(chalk.cyan('\nIf button still doesn\'t work:'));
    console.log(chalk.gray('1. Open browser console (F12)'));
    console.log(chalk.gray('2. Paste the script from: scripts/patch-supabase-studio.js'));
    console.log(chalk.gray('3. Try the button again'));
    
  } else {
    console.log(chalk.red.bold('❌ Some services are not running.\n'));
    
    if (!ollamaOk) {
      console.log(chalk.yellow('Start Ollama:'));
      console.log(chalk.gray('   ollama serve'));
    }
    
    if (!nginxOk) {
      console.log(chalk.yellow('\nStart Nginx proxy:'));
      console.log(chalk.gray('   npm run ollama:nginx:start'));
    }
    
    if (!openaiProxyOk) {
      console.log(chalk.yellow('\nStart OpenAI proxy:'));
      console.log(chalk.gray('   npm run openai:proxy'));
    }
  }
  
  // Show configuration
  console.log(chalk.blue.bold('\n🔧 Configuration:\n'));
  console.log(chalk.gray('OPENAI_API_KEY=sk-ollama-proxy-key'));
  console.log(chalk.gray('OPENAI_API_BASE=http://localhost:8081/v1'));
  
  console.log(chalk.blue.bold('\n🎯 Quick Commands:\n'));
  console.log(chalk.gray('npm run ollama:nginx:start   # Start nginx proxy'));
  console.log(chalk.gray('npm run openai:proxy         # Start OpenAI proxy'));
  console.log(chalk.gray('npm run test:ollama:full     # Run all tests'));
}

// Run tests
runTests().catch(console.error);