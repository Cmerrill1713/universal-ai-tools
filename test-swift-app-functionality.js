#!/usr/bin/env node

/**
 * Test script for Universal AI Tools macOS application
 * Tests core functionality through API endpoints
 */

import axios from 'axios';
import WebSocket from 'ws';

const BASE_URL = 'http://localhost:9999';
const WS_URL = 'ws://localhost:8080';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

async function test(name, fn) {
  try {
    await fn();
    console.log(`${colors.green}✓ ${name}${colors.reset}`);
    return true;
  } catch (error) {
    console.error(`${colors.red}✗ ${name}${colors.reset}`);
    console.error(`  ${colors.red}${error.message}${colors.reset}`);
    return false;
  }
}

async function runTests() {
  console.log(`\n${colors.blue}=== Testing Universal AI Tools macOS Application ===${colors.reset}\n`);
  
  let passedTests = 0;
  let totalTests = 0;

  // Test 1: Backend Health Check
  totalTests++;
  if (await test('Backend server is running', async () => {
    const response = await axios.get(`${BASE_URL}/api/v1/system/health`);
    if (!response.data.success) throw new Error('Health check failed');
  })) passedTests++;

  // Test 2: Athena Status
  totalTests++;
  if (await test('Athena system is operational', async () => {
    const response = await axios.get(`${BASE_URL}/api/v1/athena/status`);
    if (!response.data.success) throw new Error('Athena status check failed');
    console.log(`  ${colors.magenta}Active agents: ${response.data.data.status.agents.total}${colors.reset}`);
  })) passedTests++;

  // Test 3: Spawn Agent
  totalTests++;
  let spawnedAgent = null;
  if (await test('Can spawn Athena agent', async () => {
    const response = await axios.post(`${BASE_URL}/api/v1/athena/spawn`, {
      task: 'Assist with SwiftUI development',
      context: 'Testing Universal AI Tools macOS application',
      expertise_needed: ['swift', 'swiftui', 'macos'],
      autonomy_level: 'intermediate'
    });
    if (!response.data.success) throw new Error('Failed to spawn agent');
    spawnedAgent = response.data.data.agent;
    console.log(`  ${colors.magenta}Spawned agent: ${spawnedAgent.name} (${spawnedAgent.id})${colors.reset}`);
  })) passedTests++;

  // Test 4: Execute with Agent
  totalTests++;
  if (await test('Can execute task with agent', async () => {
    if (!spawnedAgent) throw new Error('No agent spawned');
    
    const response = await axios.post(`${BASE_URL}/api/v1/athena/execute`, {
      agentId: spawnedAgent.id,
      task: 'Generate a simple SwiftUI button component',
      context: {
        purpose: 'Testing agent execution'
      }
    });
    if (!response.data.success) throw new Error('Agent execution failed');
    console.log(`  ${colors.magenta}Execution time: ${response.data.data.performance.executionTime}ms${colors.reset}`);
  })) passedTests++;

  // Test 5: Chat Functionality
  totalTests++;
  if (await test('Chat API is functional', async () => {
    // First create a conversation
    const createResponse = await axios.post(`${BASE_URL}/api/v1/chat/conversations`, {
      title: 'Test Conversation'
    });
    
    const conversationId = createResponse.data.data.id;
    
    // Send a message
    const messageResponse = await axios.post(`${BASE_URL}/api/v1/chat/messages`, {
      conversationId,
      content: 'Hello from test script!',
      role: 'user'
    });
    
    if (!messageResponse.data.success) throw new Error('Failed to send message');
    console.log(`  ${colors.magenta}Message sent to conversation: ${conversationId}${colors.reset}`);
  })) passedTests++;

  // Test 6: WebSocket Connection
  totalTests++;
  if (await test('WebSocket connection works', async () => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${WS_URL}/ws/unified`);
      
      ws.on('open', () => {
        console.log(`  ${colors.magenta}WebSocket connected${colors.reset}`);
        ws.close();
        resolve();
      });
      
      ws.on('error', (error) => {
        reject(new Error(`WebSocket error: ${error.message}`));
      });
      
      setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket connection timeout'));
      }, 5000);
    });
  })) passedTests++;

  // Test 7: Device Auth API
  totalTests++;
  if (await test('Device auth endpoints are accessible', async () => {
    try {
      // This should return 404 if no device registered, which is fine
      await axios.get(`${BASE_URL}/api/v1/device-auth/status/test-device-id`);
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log(`  ${colors.magenta}Device not registered (expected)${colors.reset}`);
        return; // This is expected behavior
      }
      throw error;
    }
  })) passedTests++;

  // Test 8: MCP Context Storage
  totalTests++;
  if (await test('Can store context in MCP', async () => {
    const response = await axios.post(`${BASE_URL}/api/v1/mcp/context`, {
      content: 'Test context from Swift app testing',
      category: 'testing',
      metadata: {
        source: 'test-script',
        timestamp: new Date().toISOString()
      }
    });
    if (!response.data.success) throw new Error('Failed to store context');
    console.log(`  ${colors.magenta}Context stored with ID: ${response.data.data.id}${colors.reset}`);
  })) passedTests++;

  // Test 9: Tool Creation API
  totalTests++;
  if (await test('Tool creation API is available', async () => {
    const response = await axios.post(`${BASE_URL}/api/v1/athena/tools/create`, {
      name: 'TestTool',
      description: 'A test tool for validation',
      purpose: 'Testing tool creation from Swift app',
      type: 'utility',
      inputs: [
        {
          name: 'input',
          type: 'string',
          description: 'Test input',
          required: true
        }
      ],
      outputs: [
        {
          name: 'result',
          type: 'string',
          description: 'Test result'
        }
      ],
      implementation: 'return { result: input + " processed" };'
    });
    if (!response.data.success) throw new Error('Failed to create tool');
    console.log(`  ${colors.magenta}Tool created: ${response.data.data.tool.name}${colors.reset}`);
  })) passedTests++;

  // Test 10: Memory Search
  totalTests++;
  if (await test('Memory search functionality works', async () => {
    const response = await axios.post(`${BASE_URL}/api/v1/memory/search`, {
      query: 'SwiftUI',
      limit: 5
    });
    if (!response.data.success) throw new Error('Memory search failed');
    console.log(`  ${colors.magenta}Found ${response.data.data.results.length} memory results${colors.reset}`);
  })) passedTests++;

  // Summary
  console.log(`\n${colors.blue}=== Test Summary ===${colors.reset}`);
  console.log(`Total tests: ${totalTests}`);
  console.log(`Passed: ${colors.green}${passedTests}${colors.reset}`);
  console.log(`Failed: ${colors.red}${totalTests - passedTests}${colors.reset}`);
  
  if (passedTests === totalTests) {
    console.log(`\n${colors.green}All tests passed! The Universal AI Tools macOS app is fully functional.${colors.reset}\n`);
  } else {
    console.log(`\n${colors.yellow}Some tests failed. Please check the errors above.${colors.reset}\n`);
  }

  // Additional info about the running app
  console.log(`${colors.blue}=== Application Status ===${colors.reset}`);
  console.log(`Backend URL: ${BASE_URL}`);
  console.log(`WebSocket URL: ${WS_URL}`);
  console.log(`\nThe macOS app should be visible in your menu bar or dock.`);
  console.log(`Look for the Universal AI Tools icon to interact with the GUI.\n`);
}

// Run the tests
runTests().catch(console.error);