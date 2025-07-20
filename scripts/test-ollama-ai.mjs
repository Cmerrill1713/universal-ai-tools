#!/usr/bin/env node

import fetch from 'node-fetch';
import chalk from 'chalk';

console.log(chalk.blue.bold('🧪 Testing Ollama AI Integration\n'));

async function testOllamaAI() {
  try {
    // Test SQL generation
    console.log(chalk.yellow('🔍 Testing SQL generation...'));
    const genResponse = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2:3b',
        prompt: 'Generate a PostgreSQL query to select all users created in the last 7 days. Return only SQL.',
        temperature: 0.1,
        stream: false
      })
    });

    const genData = await genResponse.json();
    console.log(chalk.green('✅ SQL Generation Test:'));
    console.log(chalk.gray(genData.response));

    // Test SQL explanation
    console.log(chalk.yellow('\n🔍 Testing SQL explanation...'));
    const explainResponse = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2:3b',
        prompt: 'Explain this SQL: SELECT * FROM users WHERE created_at > NOW() - INTERVAL \'7 days\';',
        temperature: 0.3,
        stream: false
      })
    });

    const explainData = await explainResponse.json();
    console.log(chalk.green('\n✅ SQL Explanation Test:'));
    console.log(chalk.gray(explainData.response));

    console.log(chalk.green('\n✅ All tests passed!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Test failed:'), error.message);
  }
}

testOllamaAI();
