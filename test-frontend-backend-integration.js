#!/usr/bin/env node

/**
 * Frontend-Backend Integration Test
 * 
 * This test verifies that the Sweet Athena frontend components can successfully
 * communicate with the backend API services.
 */

import axios from 'axios';

// Test configuration
const API_BASE_URL = 'http://localhost:9999/api';
const LOCAL_DEV_KEY = 'local-dev-key';
const AI_SERVICE = 'local-ui';

// Create axios instance matching frontend configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': LOCAL_DEV_KEY,
    'x-ai-service': AI_SERVICE,
  },
  timeout: 30000,
});

// Test results tracker
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(testName, success, details) {
  const status = success ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} ${testName}`);
  if (details) {
    console.log(`   ${details}`);
  }
  
  testResults.tests.push({ name: testName, success, details });
  if (success) {
    testResults.passed++;
  } else {
    testResults.failed++;
  }
}

async function testHealthEndpoint() {
  try {
    const response = await axios.get('http://localhost:9999/health');
    logTest('Health Endpoint', response.status === 200 && response.data.status === 'healthy', 
           `Status: ${response.data.status}`);
    return true;
  } catch (error) {
    logTest('Health Endpoint', false, `Error: ${error.message}`);
    return false;
  }
}

async function testAuthenticatedEndpoint() {
  try {
    const response = await apiClient.get('/stats');
    const success = response.status === 200 && response.data.success === true;
    logTest('Authenticated Stats Endpoint', success, 
           `Active Agents: ${response.data.stats?.activeAgents}, Memory Count: ${response.data.stats?.totalMemories}`);
    return success;
  } catch (error) {
    logTest('Authenticated Stats Endpoint', false, `Error: ${error.message}`);
    return false;
  }
}

async function testMemoryAPI() {
  try {
    // Test memory search (should work even with no memories)
    const searchResponse = await apiClient.post('/memory/search', {
      query: 'test search',
      limit: 5
    });
    
    const success = searchResponse.status === 200 && Array.isArray(searchResponse.data.memories);
    logTest('Memory Search API', success, 
           `Found ${searchResponse.data.memories?.length || 0} memories`);
    return success;
  } catch (error) {
    logTest('Memory Search API', false, `Error: ${error.message}`);
    return false;
  }
}

async function testAgentsAPI() {
  try {
    const response = await apiClient.get('/agents');
    const success = response.status === 200 && Array.isArray(response.data.agents);
    logTest('Agents List API', success, 
           `Found ${response.data.agents?.length || 0} agents`);
    return success;
  } catch (error) {
    logTest('Agents List API', false, `Error: ${error.message}`);
    return false;
  }
}

async function testOrchestrationAPI() {
  try {
    const response = await apiClient.post('/orchestration/orchestrate', {
      userRequest: 'Hello, test orchestration',
      orchestrationMode: 'simple',
      context: { test: true },
      sessionId: 'test-session-123'
    });
    
    const success = response.status === 200 && response.data.success === true;
    logTest('DSPy Orchestration API', success, 
           `Mode: ${response.data.mode}, Confidence: ${response.data.confidence}`);
    return success;
  } catch (error) {
    logTest('DSPy Orchestration API', false, `Error: ${error.message}`);
    return false;
  }
}

async function testPerformanceMetrics() {
  try {
    const response = await apiClient.get('/performance/metrics');
    const success = response.status === 200 && response.data.success === true;
    logTest('Performance Metrics API', success, 
           `Metrics available: ${Object.keys(response.data.metrics || {}).length} categories`);
    return success;
  } catch (error) {
    logTest('Performance Metrics API', false, `Error: ${error.message}`);
    return false;
  }
}

async function testOllamaIntegration() {
  try {
    const response = await apiClient.get('/ollama/status');
    const success = response.status === 200;
    const status = response.data.status || 'unknown';
    const modelCount = response.data.models?.length || 0;
    
    logTest('Ollama Integration', success, 
           `Status: ${status}, Models: ${modelCount}`);
    return success;
  } catch (error) {
    logTest('Ollama Integration', false, `Error: ${error.message}`);
    return false;
  }
}

async function testChatAPI() {
  try {
    const response = await apiClient.post('/assistant/chat', {
      message: 'Hello, this is a test message',
      model: 'llama3.2:3b',
      conversation_id: 'test-integration-chat'
    });
    
    const success = response.status === 200 && response.data.response;
    logTest('Chat API (Ollama)', success, 
           `Response length: ${response.data.response?.length || 0} chars`);
    return success;
  } catch (error) {
    logTest('Chat API (Ollama)', false, `Error: ${error.message}`);
    return false;
  }
}

async function runIntegrationTests() {
  console.log('🧪 Sweet Athena Frontend-Backend Integration Test\n');
  console.log('Testing communication between frontend API client and backend services...\n');

  // Basic connectivity tests
  console.log('📡 Basic Connectivity Tests:');
  await testHealthEndpoint();
  await testAuthenticatedEndpoint();
  
  console.log('\n🔍 API Functionality Tests:');
  await testMemoryAPI();
  await testAgentsAPI();
  await testPerformanceMetrics();
  
  console.log('\n🤖 AI Integration Tests:');
  await testOrchestrationAPI();
  await testOllamaIntegration();
  // Skip chat test if Ollama is not available
  if (testResults.tests.find(t => t.name === 'Ollama Integration')?.success) {
    await testChatAPI();
  } else {
    logTest('Chat API (Ollama)', false, 'Skipped - Ollama not available');
  }
  
  // Summary
  console.log('\n📊 Test Summary:');
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
  
  if (testResults.failed === 0) {
    console.log('\n🎉 All tests passed! Frontend-backend communication is working properly.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the details above for troubleshooting.');
  }
  
  // Return exit code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run the tests
runIntegrationTests().catch(error => {
  console.error('❌ Integration test failed:', error.message);
  process.exit(1);
});