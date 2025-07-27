#!/usr/bin/env node

/**
 * Frontend Integration Test Script
 * Tests chat and agent functionality with the backend
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:9999/api';
const API_KEY = process.env.API_KEY || 'test-key-123';
const AI_SERVICE = 'test-client';

// Create axios instance with auth headers
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY,
    'X-AI-Service': AI_SERVICE
  }
});

// Test results collector
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

// Helper function to run a test
async function runTest(name, testFn) {
  console.log(`\n🧪 Testing: ${name}`);
  try {
    await testFn();
    console.log(`✅ PASSED: ${name}`);
    testResults.passed++;
    testResults.tests.push({ name, status: 'passed' });
  } catch (error) {
    console.log(`❌ FAILED: ${name}`);
    console.error(`   Error: ${error.message}`);
    testResults.failed++;
    testResults.tests.push({ name, status: 'failed', error: error.message });
  }
}

// Test 1: Health Check
async function testHealthCheck() {
  const response = await api.get('/health');
  if (response.data.status !== 'healthy') {
    throw new Error('Health check failed');
  }
}

// Test 2: SweetAthena Status
async function testSweetAthenaStatus() {
  const response = await api.get('/sweet-athena/status');
  if (!response.data.success) {
    throw new Error('SweetAthena status check failed');
  }
}

// Test 3: SweetAthena Chat
async function testSweetAthenaChat() {
  const chatMessage = {
    message: 'Hello Sweet Athena!',
    type: 'text',
    personalityMode: 'sweet',
    expectedResponseType: 'text'
  };
  
  const response = await api.post('/sweet-athena/chat', chatMessage);
  if (!response.data.success || !response.data.response.text) {
    throw new Error('SweetAthena chat failed');
  }
  console.log(`   Response: "${response.data.response.text}"`);
}

// Test 4: List Agents
async function testListAgents() {
  const response = await api.get('/agents');
  if (!Array.isArray(response.data.agents)) {
    throw new Error('Agent list response is not an array');
  }
  console.log(`   Found ${response.data.agents.length} agents`);
}

// Test 5: Create Agent
async function testCreateAgent() {
  const newAgent = {
    name: 'Test Agent',
    description: 'A test agent created by integration test',
    capabilities: ['testing', 'demo'],
    instructions: 'You are a test agent',
    model: 'llama3.2:3b'
  };
  
  const response = await api.post('/agents', newAgent);
  if (!response.data.agent || !response.data.agent.id) {
    throw new Error('Agent creation failed');
  }
  console.log(`   Created agent with ID: ${response.data.agent.id}`);
  return response.data.agent.id;
}

// Test 6: Execute Agent
async function testExecuteAgent(agentId) {
  const execution = {
    input: 'What is 2+2?',
    context: {}
  };
  
  const response = await api.post(`/agents/${agentId}/execute`, execution);
  if (!response.data.success) {
    throw new Error('Agent execution failed');
  }
  console.log(`   Agent output: "${response.data.output}"`);
}

// Test 7: Test Regular Chat (Ollama)
async function testOllamaChat() {
  const chatRequest = {
    message: 'What is the capital of France?',
    model: 'llama3.2:3b',
    conversation_id: 'test-conv-' + Date.now()
  };
  
  const response = await api.post('/assistant/chat', chatRequest);
  if (!response.data.response) {
    throw new Error('Ollama chat failed');
  }
  console.log(`   Response: "${response.data.response.substring(0, 100)}..."`);
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Frontend Integration Tests');
  console.log(`📍 API URL: ${API_BASE_URL}`);
  console.log(`🔑 Using API Key: ${API_KEY.substring(0, 10)}...`);
  console.log('=' .repeat(50));

  // Run all tests
  await runTest('Health Check', testHealthCheck);
  await runTest('SweetAthena Status', testSweetAthenaStatus);
  await runTest('SweetAthena Chat', testSweetAthenaChat);
  await runTest('List Agents', testListAgents);
  
  let agentId;
  await runTest('Create Agent', async () => {
    agentId = await testCreateAgent();
  });
  
  if (agentId) {
    await runTest('Execute Agent', () => testExecuteAgent(agentId));
  }
  
  await runTest('Ollama Chat', testOllamaChat);

  // Print summary
  console.log('\n' + '=' .repeat(50));
  console.log('📊 Test Summary:');
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Total: ${testResults.tests.length}`);
  
  if (testResults.failed > 0) {
    console.log('\n❌ Failed tests:');
    testResults.tests
      .filter(t => t.status === 'failed')
      .forEach(t => console.log(`   - ${t.name}: ${t.error}`));
  }
  
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  console.error('🚨 Test runner crashed:', error);
  process.exit(1);
});