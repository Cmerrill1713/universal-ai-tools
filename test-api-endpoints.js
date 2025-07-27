#!/usr/bin/env node

const fetch = require('node-fetch');
const colors = require('colors/safe');

const API_URL = 'http://localhost:9999';
const API_KEY = 'test-api-key-123';

const headers = {
  'Content-Type': 'application/json',
  'X-API-Key': API_KEY,
  'X-AI-Service': 'universal-ai-test'
};

async function testEndpoint(method, path, body = null, description = '') {
  const url = `${API_URL}${path}`;
  console.log(`\nTesting: ${colors.yellow(description || `${method} ${path}`)}`);
  
  try {
    const options = {
      method,
      headers,
      ...(body && { body: JSON.stringify(body) })
    };
    
    const response = await fetch(url, options);
    const data = await response.json().catch(() => null);
    
    if (response.ok) {
      console.log(colors.green(`✓ Success (${response.status})`));
      if (data) {
        console.log(colors.gray(JSON.stringify(data, null, 2).substring(0, 200) + '...'));
      }
      return { success: true, data };
    } else {
      console.log(colors.red(`✗ Failed (${response.status})`));
      if (data) {
        console.log(colors.red(JSON.stringify(data, null, 2)));
      }
      return { success: false, error: data };
    }
  } catch (error) {
    console.log(colors.red(`✗ Error: ${error.message}`));
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log(colors.cyan('\n🚀 Universal AI Tools - API Endpoint Tests\n'));
  console.log(colors.gray(`API URL: ${API_URL}`));
  console.log(colors.gray(`API Key: ${API_KEY}\n`));
  
  // Check if server is running
  try {
    await fetch(API_URL);
  } catch (error) {
    console.log(colors.red('\n❌ Server is not running!'));
    console.log(colors.yellow('Please start the server with: npm start\n'));
    process.exit(1);
  }
  
  const results = [];
  
  // Test health endpoint
  results.push(await testEndpoint('GET', '/health', null, 'Health Check'));
  
  // Test chat endpoints
  results.push(await testEndpoint('POST', '/api/v1/chat', {
    message: 'Hello, this is a test message',
    conversationId: null
  }, 'Send Chat Message'));
  
  // Test agents endpoints
  results.push(await testEndpoint('GET', '/api/v1/agents', null, 'List Available Agents'));
  
  // Test monitoring endpoints
  results.push(await testEndpoint('GET', '/api/v1/monitoring/metrics', null, 'Get Performance Metrics'));
  
  // Test MLX endpoints
  results.push(await testEndpoint('GET', '/api/v1/mlx/models', null, 'List MLX Models'));
  
  // Test vision endpoints (if enabled)
  results.push(await testEndpoint('GET', '/api/v1/vision/status', null, 'Vision Service Status'));
  
  // Summary
  console.log(colors.cyan('\n📊 Test Summary\n'));
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(colors.green(`✓ Passed: ${passed}`));
  console.log(colors.red(`✗ Failed: ${failed}`));
  console.log(colors.gray(`Total: ${results.length}`));
  
  if (failed === 0) {
    console.log(colors.green('\n✨ All tests passed!'));
  } else {
    console.log(colors.yellow('\n⚠️  Some tests failed. Check the output above for details.'));
  }
}

// Run tests
runTests().catch(console.error);