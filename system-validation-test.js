#!/usr/bin/env node

/**
 * Universal AI Tools System Validation Test
 * Comprehensive health check for all core functionality
 */

import http from 'http';

const BASE_URL = 'http://localhost:9999';

async function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 9999,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data, error: e.message });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function testChatAPI() {
  console.log('\n🗣️  Testing Chat API...');
  try {
    const response = await makeRequest('/api/v1/chat', 'POST', {
      message: 'Hello! This is a system validation test.'
    });
    
    if (response.status === 200 && response.data.success) {
      console.log('✅ Chat API is working');
      console.log(`📝 Response: ${response.data.message?.substring(0, 50)}...`);
      return true;
    } else {
      console.log('❌ Chat API failed:', response.data);
      return false;
    }
  } catch (error) {
    console.log('❌ Chat API error:', error.message);
    return false;
  }
}

async function testHealthEndpoint() {
  console.log('\n🏥 Testing Health Endpoint...');
  try {
    const response = await makeRequest('/api/v1/health');
    
    if (response.status === 200) {
      console.log('✅ Health endpoint is working');
      return true;
    } else {
      console.log('❌ Health endpoint failed:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Health endpoint error:', error.message);
    return false;
  }
}

async function testAgentsEndpoint() {
  console.log('\n🤖 Testing Agents Endpoint...');
  try {
    const response = await makeRequest('/api/v1/agents');
    
    if (response.status === 200) {
      console.log('✅ Agents endpoint is working');
      if (response.data.agents) {
        console.log(`📊 Available agents: ${response.data.agents.length}`);
      }
      return true;
    } else {
      console.log('❌ Agents endpoint failed:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Agents endpoint error:', error.message);
    return false;
  }
}

async function testMLXEndpoint() {
  console.log('\n🍎 Testing MLX Endpoint...');
  try {
    const response = await makeRequest('/api/v1/mlx/status');
    
    if (response.status === 200) {
      console.log('✅ MLX endpoint is working');
      return true;
    } else {
      console.log('❌ MLX endpoint failed:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ MLX endpoint error:', error.message);
    return false;
  }
}

async function runValidation() {
  console.log('🚀 Universal AI Tools System Validation');
  console.log('=' .repeat(50));
  
  const results = [];
  
  // Test core functionality
  results.push(await testHealthEndpoint());
  results.push(await testChatAPI());
  results.push(await testAgentsEndpoint());
  results.push(await testMLXEndpoint());
  
  // Summary
  console.log('\n📊 Validation Summary');
  console.log('=' .repeat(50));
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log(`✅ Passed: ${passed}/${total} tests`);
  console.log(`❌ Failed: ${total - passed}/${total} tests`);
  
  if (passed === total) {
    console.log('\n🎉 System is healthy and ready for use!');
    process.exit(0);
  } else {
    console.log('\n⚠️  System has issues that need attention.');
    process.exit(1);
  }
}

// Give server time to start up if needed
setTimeout(runValidation, 2000);