#!/usr/bin/env tsx

/**
 * Debug the parallel analysis endpoint specifically
 */

import axios from 'axios';

const API_BASE = 'http://localhost:9999/api/v1';

const testCode = `
interface User {
  id: string;
  name: string;
  email: string;
}

function createUser(data: Omit<User, 'id'>): User {
  return {
    ...data,
    id: crypto.randomUUID()
  };
}
`;

async function testParallelAnalysis() {
  console.log('🔄 Testing parallel analysis...');
  
  try {
    const response = await axios.post(`${API_BASE}/typescript/parallel-analysis`, {
      code: testCode,
      filename: 'test-user.ts',
      options: {
        includeFixSuggestions: true,
        depth: 'normal'
      }
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 60000 // 60 second timeout
    });
    
    console.log('✅ Success!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.log('❌ Failed!');
    console.log('Status:', error.response?.status);
    console.log('Data:', JSON.stringify(error.response?.data, null, 2));
    console.log('Message:', error.message);
  }
}

testParallelAnalysis();