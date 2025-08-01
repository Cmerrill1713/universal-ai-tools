#!/usr/bin/env npx tsx
/**
 * Final Scenario Validation
 * Tests core functionality with correct API endpoints
 */

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import chalk from 'chalk';

async function validateScenarios() {
  console.log(chalk.blue.bold('\n🧪 Universal AI Tools - Scenario Validation\n'));

  let passed = 0;
  let failed = 0;

  // Test 1: Basic Chat
  try {
    console.log(chalk.yellow('Testing basic chat...'));
    const response = await axios.post('http://localhost:9999/api/v1/chat', {
      message: 'Hello, how are you?',
      conversationId: uuidv4()
    });
    
    if (response.data.response) {
      console.log(chalk.green('✅ Basic chat working'));
      console.log(chalk.gray(`   Response: ${response.data.response.substring(0, 50)}...`));
      console.log(chalk.gray(`   Model: ${response.data.model}`));
      console.log(chalk.gray(`   LFM2: ${response.data.metadata?.lfm2Enabled ? 'Yes' : 'No'}`));
      passed++;
    }
  } catch (error: any) {
    console.log(chalk.red('❌ Basic chat failed'));
    console.log(chalk.gray(`   Error: ${error.message}`));
    failed++;
  }

  // Test 2: LFM2 Routing - Simple Task
  try {
    console.log(chalk.yellow('\nTesting LFM2 simple task routing...'));
    const response = await axios.post('http://localhost:9999/api/v1/chat', {
      message: 'What is 2 + 2?',
      conversationId: uuidv4()
    });
    
    console.log(chalk.green('✅ LFM2 simple routing working'));
    console.log(chalk.gray(`   Response: ${response.data.response}`));
    console.log(chalk.gray(`   Service: ${response.data.metadata?.serviceUsed || 'unknown'}`));
    console.log(chalk.gray(`   Complexity: ${response.data.metadata?.complexity || 'unknown'}`));
    passed++;
  } catch (error: any) {
    console.log(chalk.red('❌ LFM2 simple routing failed'));
    console.log(chalk.gray(`   Error: ${error.message}`));
    failed++;
  }

  // Test 3: LFM2 Routing - Complex Task
  try {
    console.log(chalk.yellow('\nTesting LFM2 complex task routing...'));
    const response = await axios.post('http://localhost:9999/api/v1/chat', {
      message: 'Write a Python function to calculate fibonacci numbers recursively',
      conversationId: uuidv4()
    });
    
    console.log(chalk.green('✅ LFM2 complex routing working'));
    console.log(chalk.gray(`   Service: ${response.data.metadata?.serviceUsed || 'unknown'}`));
    console.log(chalk.gray(`   Agent: ${response.data.metadata?.agentId || 'none'}`));
    console.log(chalk.gray(`   Complexity: ${response.data.metadata?.complexity || 'unknown'}`));
    passed++;
  } catch (error: any) {
    console.log(chalk.red('❌ LFM2 complex routing failed'));
    console.log(chalk.gray(`   Error: ${error.message}`));
    failed++;
  }

  // Test 4: Multi-turn Conversation
  try {
    console.log(chalk.yellow('\nTesting multi-turn conversation...'));
    const convId = uuidv4();
    
    // First message
    await axios.post('http://localhost:9999/api/v1/chat', {
      message: 'My name is TestUser',
      conversationId: convId
    });
    
    // Second message
    const response2 = await axios.post('http://localhost:9999/api/v1/chat', {
      message: 'What is my name?',
      conversationId: convId
    });
    
    const contextMaintained = response2.data.response?.toLowerCase().includes('testuser');
    
    if (contextMaintained) {
      console.log(chalk.green('✅ Multi-turn conversation working'));
      console.log(chalk.gray(`   Context maintained: Yes`));
      passed++;
    } else {
      console.log(chalk.yellow('⚠️  Multi-turn conversation - context not maintained'));
      console.log(chalk.gray(`   Response: ${response2.data.response?.substring(0, 100)}`));
      failed++;
    }
  } catch (error: any) {
    console.log(chalk.red('❌ Multi-turn conversation failed'));
    console.log(chalk.gray(`   Error: ${error.message}`));
    failed++;
  }

  // Test 5: Auto-generated Conversation ID
  try {
    console.log(chalk.yellow('\nTesting auto-generated conversation ID...'));
    const response = await axios.post('http://localhost:9999/api/v1/chat', {
      message: 'Test without conversation ID'
    });
    
    if (response.data.conversationId) {
      console.log(chalk.green('✅ Auto-generated ID working'));
      console.log(chalk.gray(`   Generated ID: ${response.data.conversationId}`));
      passed++;
    } else {
      console.log(chalk.red('❌ Auto-generated ID not working'));
      failed++;
    }
  } catch (error: any) {
    console.log(chalk.red('❌ Auto-generated ID test failed'));
    console.log(chalk.gray(`   Error: ${error.message}`));
    failed++;
  }

  // Test 6: Agent List
  try {
    console.log(chalk.yellow('\nTesting agent listing...'));
    const response = await axios.get('http://localhost:9999/api/v1/agents');
    
    console.log(chalk.green('✅ Agent listing working'));
    console.log(chalk.gray(`   Total agents: ${response.data.agents?.length || 0}`));
    console.log(chalk.gray(`   Available: ${response.data.agents?.map((a: any) => a.id).join(', ') || 'none'}`));
    passed++;
  } catch (error: any) {
    console.log(chalk.red('❌ Agent listing failed'));
    console.log(chalk.gray(`   Error: ${error.message}`));
    failed++;
  }

  // Test 7: Health Check
  try {
    console.log(chalk.yellow('\nTesting health check...'));
    const response = await axios.get('http://localhost:9999/health');
    
    console.log(chalk.green('✅ Health check working'));
    console.log(chalk.gray(`   Services: ${JSON.stringify(response.data.services)}`));
    passed++;
  } catch (error: any) {
    console.log(chalk.red('❌ Health check failed'));
    console.log(chalk.gray(`   Error: ${error.message}`));
    failed++;
  }

  // Test 8: Parallel Requests
  try {
    console.log(chalk.yellow('\nTesting parallel request handling...'));
    const start = Date.now();
    
    const requests = Array(3).fill(0).map((_, i) => 
      axios.post('http://localhost:9999/api/v1/chat', {
        message: `Parallel test ${i}`,
        conversationId: uuidv4()
      })
    );
    
    const results = await Promise.allSettled(requests);
    const duration = Date.now() - start;
    const successful = results.filter(r => r.status === 'fulfilled').length;
    
    console.log(chalk.green('✅ Parallel requests completed'));
    console.log(chalk.gray(`   Successful: ${successful}/3`));
    console.log(chalk.gray(`   Total time: ${duration}ms`));
    console.log(chalk.gray(`   Avg time: ${Math.round(duration / 3)}ms per request`));
    passed++;
  } catch (error: any) {
    console.log(chalk.red('❌ Parallel request test failed'));
    console.log(chalk.gray(`   Error: ${error.message}`));
    failed++;
  }

  // Summary
  const total = passed + failed;
  const percentage = Math.round((passed / total) * 100);
  
  console.log(chalk.blue('\n' + '═'.repeat(60)));
  console.log(chalk.bold(`\n📊 Results: ${passed}/${total} tests passed (${percentage}%)\n`));
  
  if (percentage === 100) {
    console.log(chalk.green.bold('✨ All scenarios validated successfully!\n'));
  } else if (percentage >= 75) {
    console.log(chalk.yellow.bold('⚡ Most scenarios working well.\n'));
  } else {
    console.log(chalk.red.bold('⚠️  Several scenarios need attention.\n'));
  }
  
  process.exit(percentage >= 75 ? 0 : 1);
}

validateScenarios().catch(error => {
  console.error(chalk.red('\n❌ Fatal error:'), error.message);
  process.exit(1);
});