#!/usr/bin/env node

const axios = require('axios');
const WebSocket = require('ws');

const API_BASE = 'http://localhost:8080';
const WS_URL = 'ws://localhost:8018/ws'; // Direct connection to WebSocket service

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

console.log('🚀 Starting Complete Integration Test');
console.log('=====================================');

async function testCompleteIntegration() {
  let authToken = null;
  let userId = null;
  
  try {
    // Step 1: Test API Gateway Health
    console.log('\n1. Testing API Gateway Health...');
    const healthResponse = await axios.get(`${API_BASE}/health`);
    console.log('✅ API Gateway Status:', healthResponse.data);
    
    if (!healthResponse.data.services.auth || !healthResponse.data.services.memory || !healthResponse.data.services.websocket) {
      console.error('❌ Not all services are healthy');
      return false;
    }
    
    // Step 2: User Authentication
    console.log('\n2. Testing User Authentication...');
    
    // Try to login with existing user
    try {
      const loginResponse = await axios.post(`${API_BASE}/api/auth/login`, {
        username: 'admin',
        password: 'password'
      });
      authToken = loginResponse.data.token;
      userId = loginResponse.data.user.id;
      console.log('✅ Login successful for existing user:', loginResponse.data.user.username);
    } catch (error) {
      console.log('ℹ️  Admin login failed, trying to register new user...');
      
      // Register new user
      const registerResponse = await axios.post(`${API_BASE}/api/auth/register`, {
        username: 'testuser',
        email: 'test@example.com',
        password: 'testpass'
      });
      authToken = registerResponse.data.token;
      userId = registerResponse.data.user.id;
      console.log('✅ New user registered:', registerResponse.data.user.username);
    }
    
    // Verify token
    const verifyResponse = await axios.get(`${API_BASE}/api/auth/verify`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log('✅ Token verified:', verifyResponse.data);
    
    // Step 3: Memory Storage and Retrieval
    console.log('\n3. Testing Memory Service...');
    
    // Store memories
    const memories = [
      {
        type: 'conversation',
        content: 'User asked about integration testing',
        tags: ['testing', 'integration'],
        metadata: 'priority:high'
      },
      {
        type: 'note',
        content: 'Local backend services are working well',
        tags: ['backend', 'status'],
        metadata: 'status:success'
      },
      {
        type: 'task',
        content: 'Complete functional testing of all services',
        tags: ['todo', 'testing'],
        metadata: 'progress:in-progress'
      }
    ];
    
    const storedMemories = [];
    for (let i = 0; i < memories.length; i++) {
      const memory = memories[i];
      const storeResponse = await axios.post(`${API_BASE}/api/memory/memories`, memory, {
        headers: { 'X-User-ID': userId }
      });
      storedMemories.push(storeResponse.data);
      console.log(`✅ Memory ${i + 1} stored:`, memory.type, '-', memory.content.substring(0, 30) + '...');
      await delay(100); // Small delay between requests
    }
    
    // Search memories
    const searchResponse = await axios.get(`${API_BASE}/api/memory/memories/search?q=testing&limit=5`, {
      headers: { 'X-User-ID': userId }
    });
    console.log('✅ Memory search results:', searchResponse.data.count, 'memories found');
    
    // Step 4: WebSocket Real-time Communication
    console.log('\n4. Testing WebSocket Communication...');
    
    await testWebSocketCommunication(userId);
    
    // Step 5: Cross-service Data Flow
    console.log('\n5. Testing Cross-service Data Flow...');
    
    // Get all users from auth service
    const usersResponse = await axios.get(`${API_BASE}/api/auth/users`);
    console.log('✅ Auth service users:', Object.keys(usersResponse.data).length, 'users');
    
    // Get API Gateway stats
    const gatewayStatsResponse = await axios.get(`${API_BASE}/health`);
    console.log('✅ Gateway services status:', gatewayStatsResponse.data.services);
    
    // Step 6: Concurrent Operations
    console.log('\n6. Testing Concurrent Operations...');
    
    const concurrentPromises = [
      axios.get(`${API_BASE}/health`),
      axios.get(`${API_BASE}/api/auth/verify`, { headers: { Authorization: `Bearer ${authToken}` } }),
      axios.get(`${API_BASE}/api/memory/memories/search?q=backend`, { headers: { 'X-User-ID': userId } }),
      axios.post(`${API_BASE}/api/memory/memories`, {
        type: 'test',
        content: 'Concurrent operation test',
        tags: ['concurrent', 'test']
      }, { headers: { 'X-User-ID': userId } })
    ];
    
    const concurrentResults = await Promise.all(concurrentPromises);
    console.log('✅ All concurrent operations completed successfully');
    
    console.log('\n🎉 Complete Integration Test PASSED!');
    console.log('=====================================');
    console.log('✅ API Gateway routing working');
    console.log('✅ Authentication flow working');
    console.log('✅ Memory storage and search working');
    console.log('✅ WebSocket communication working');
    console.log('✅ Cross-service data flow working');
    console.log('✅ Concurrent operations working');
    
    return true;
    
  } catch (error) {
    console.error('\n❌ Integration test failed:');
    console.error('Error:', error.response?.data || error.message);
    console.error('Status:', error.response?.status);
    return false;
  }
}

async function testWebSocketCommunication(userId) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_URL}?user_id=${userId}`);
    let messagesReceived = 0;
    const expectedMessages = 3;
    
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('WebSocket test timeout'));
    }, 10000);
    
    ws.on('open', () => {
      console.log('✅ WebSocket connected');
      
      // Send test messages
      const testMessages = [
        { type: 'chat', content: 'Hello from integration test!' },
        { type: 'status', content: 'Testing WebSocket functionality' },
        { type: 'data', content: { test: 'integration', timestamp: Date.now() } }
      ];
      
      testMessages.forEach((msg, index) => {
        setTimeout(() => {
          ws.send(JSON.stringify(msg));
          console.log(`✅ Sent message ${index + 1}:`, msg.type);
        }, (index + 1) * 500);
      });
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        messagesReceived++;
        console.log('✅ WebSocket message received:', message.type, '-', 
                   typeof message.content === 'string' ? message.content.substring(0, 30) + '...' : 'object');
        
        if (messagesReceived >= expectedMessages) {
          clearTimeout(timeout);
          ws.close();
          resolve();
        }
      } catch (error) {
        console.log('✅ WebSocket raw message:', data.toString().substring(0, 50) + '...');
        messagesReceived++;
        if (messagesReceived >= expectedMessages) {
          clearTimeout(timeout);
          ws.close();
          resolve();
        }
      }
    });
    
    ws.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

// Run the test
testCompleteIntegration()
  .then((success) => {
    if (success) {
      console.log('\n🎯 All systems operational - Local backend ready for production!');
      process.exit(0);
    } else {
      console.log('\n💥 Integration test failed - Check service logs');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('\n💥 Unexpected error during integration test:', error.message);
    process.exit(1);
  });