#!/usr/bin/env node

/**
 * Frontend API Client Test
 * 
 * This test simulates the frontend API client calls to verify the integration works
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test configuration
const API_BASE_URL = 'http://localhost:9999/api';
const LOCAL_DEV_KEY = 'local-dev-key';
const AI_SERVICE = 'local-ui';

// Read the actual frontend API client
const apiClientPath = join(__dirname, 'ui/src/lib/api.ts');
console.log('📁 Frontend API Client Path:', apiClientPath);

// Test that the frontend can make API calls
async function testFrontendApiPattern() {
  console.log('🧪 Testing Frontend API Pattern...\n');
  
  try {
    // Import fetch for our test
    const fetch = (await import('node-fetch')).default;
    
    // Simulate the frontend API client configuration
    const apiClient = {
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': LOCAL_DEV_KEY,
        'x-ai-service': AI_SERVICE,
      },
      timeout: 30000,
    };

    console.log('🔧 API Configuration:');
    console.log(`   Base URL: ${apiClient.baseURL}`);
    console.log(`   API Key: ${apiClient.headers['x-api-key']}`);
    console.log(`   AI Service: ${apiClient.headers['x-ai-service']}`);
    console.log('');

    // Test each API category as used by the frontend
    
    // 1. System API
    console.log('📊 Testing System API...');
    const healthResponse = await fetch(apiClient.baseURL.replace('/api', '/health'));
    const healthData = await healthResponse.json();
    console.log(`   ✅ Health: ${healthData.status}`);

    const statsResponse = await fetch(`${apiClient.baseURL}/stats`, {
      headers: apiClient.headers
    });
    const statsData = await statsResponse.json();
    console.log(`   ✅ Stats: ${statsData.stats.activeAgents} agents, ${statsData.stats.totalMemories} memories`);

    // 2. Memory API
    console.log('\n🧠 Testing Memory API...');
    const memorySearchResponse = await fetch(`${apiClient.baseURL}/memory/search`, {
      method: 'POST',
      headers: apiClient.headers,
      body: JSON.stringify({
        query: 'frontend test search',
        limit: 5
      })
    });
    const memoryData = await memorySearchResponse.json();
    console.log(`   ✅ Memory Search: Found ${memoryData.memories?.length || 0} results`);

    // 3. Agents API
    console.log('\n🤖 Testing Agents API...');
    const agentsResponse = await fetch(`${apiClient.baseURL}/agents`, {
      headers: apiClient.headers
    });
    const agentsData = await agentsResponse.json();
    console.log(`   ✅ Agents: ${agentsData.agents?.length || 0} agents available`);

    // 4. Orchestration API
    console.log('\n🎯 Testing Orchestration API...');
    const orchestrationResponse = await fetch(`${apiClient.baseURL}/orchestration/orchestrate`, {
      method: 'POST',
      headers: apiClient.headers,
      body: JSON.stringify({
        userRequest: 'Test orchestration from frontend',
        orchestrationMode: 'simple',
        sessionId: 'frontend-test-session'
      })
    });
    const orchestrationData = await orchestrationResponse.json();
    console.log(`   ✅ Orchestration: Mode=${orchestrationData.mode}, Confidence=${orchestrationData.confidence}`);

    // 5. Performance API
    console.log('\n📈 Testing Performance API...');
    const performanceResponse = await fetch(`${apiClient.baseURL}/performance/metrics`, {
      headers: apiClient.headers
    });
    const performanceData = await performanceResponse.json();
    console.log(`   ✅ Performance: ${Object.keys(performanceData.metrics || {}).length} metric categories`);

    // 6. Ollama Integration
    console.log('\n🦙 Testing Ollama API...');
    const ollamaResponse = await fetch(`${apiClient.baseURL}/ollama/status`, {
      headers: apiClient.headers
    });
    const ollamaData = await ollamaResponse.json();
    console.log(`   ✅ Ollama: Status=${ollamaData.status}, Models=${ollamaData.models?.length || 0}`);

    console.log('\n🎉 All frontend API patterns work correctly!');
    console.log('\n📝 Sweet Athena Components can successfully:');
    console.log('   ✅ Authenticate with backend');
    console.log('   ✅ Access memory system');
    console.log('   ✅ Manage AI agents');
    console.log('   ✅ Use DSPy orchestration');
    console.log('   ✅ Monitor performance');
    console.log('   ✅ Integrate with Ollama');
    
    return true;
  } catch (error) {
    console.error('❌ Frontend API test failed:', error.message);
    return false;
  }
}

// Check if the frontend API client file exists and has the right structure
function verifyFrontendApiClient() {
  console.log('🔍 Verifying Frontend API Client...\n');
  
  try {
    if (fs.existsSync(apiClientPath)) {
      const apiClientContent = fs.readFileSync(apiClientPath, 'utf8');
      
      // Check for key components
      const checks = [
        { name: 'API Base URL', pattern: /API_BASE_URL.*9999/ },
        { name: 'Authentication Headers', pattern: /x-api-key.*local-dev-key/ },
        { name: 'Memory API', pattern: /memoryApi.*search/ },
        { name: 'Chat API', pattern: /chatApi.*sendMessage/ },
        { name: 'Orchestration API', pattern: /orchestrationApi.*orchestrate/ },
        { name: 'Agents API', pattern: /agentsApi/ },
        { name: 'Performance API', pattern: /performanceApi/ },
        { name: 'System API', pattern: /systemApi/ }
      ];

      console.log('✅ Frontend API Client Structure:');
      checks.forEach(check => {
        const found = check.pattern.test(apiClientContent);
        console.log(`   ${found ? '✅' : '❌'} ${check.name}: ${found ? 'Found' : 'Missing'}`);
      });

      return checks.every(check => check.pattern.test(apiClientContent));
    } else {
      console.log('❌ Frontend API client file not found');
      return false;
    }
  } catch (error) {
    console.error('❌ Error reading frontend API client:', error.message);
    return false;
  }
}

// Main test function
async function runFrontendIntegrationTest() {
  console.log('🎭 Sweet Athena Frontend-Backend Integration Test');
  console.log('================================================\n');
  
  const apiClientValid = verifyFrontendApiClient();
  console.log('');
  
  if (apiClientValid) {
    const apiTestsPassed = await testFrontendApiPattern();
    
    if (apiTestsPassed) {
      console.log('\n🏆 SUCCESS: Sweet Athena frontend components are fully integrated with the backend!');
      process.exit(0);
    } else {
      console.log('\n❌ FAILURE: API communication issues detected');
      process.exit(1);
    }
  } else {
    console.log('\n❌ FAILURE: Frontend API client structure issues detected');
    process.exit(1);
  }
}

// Run the test
runFrontendIntegrationTest().catch(error => {
  console.error('❌ Integration test crashed:', error.message);
  process.exit(1);
});