#!/usr/bin/env node

/**
 * GitLab Integration Test Script
 * Tests the GitLab integration functionality
 */

const http = require('http');

const BASE_URL = 'http://localhost:9999';
const ENDPOINTS = [
  '/api/gitlab/status',
  '/api/gitlab/project', 
  '/api/gitlab/issues',
  '/api/gitlab/merge-requests',
  '/api/gitlab/pipelines',
  '/api/gitlab/analysis'
];

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 9999,
      path: path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function testGitLabIntegration() {
  console.log('🧪 Testing GitLab Integration...\n');

  // Test each endpoint
  for (const endpoint of ENDPOINTS) {
    try {
      console.log(`Testing ${endpoint}...`);
      const result = await makeRequest(endpoint);
      
      if (result.status === 200) {
        console.log(`  ✅ ${endpoint} - Status: ${result.status}`);
        
        // Show some data for key endpoints
        if (endpoint === '/api/gitlab/status') {
          console.log(`     Connected: ${result.data.connected}`);
          console.log(`     Config: ${JSON.stringify(result.data.config)}`);
        } else if (endpoint === '/api/gitlab/project') {
          console.log(`     Project: ${result.data.data?.name || 'Mock Project'}`);
        } else if (endpoint === '/api/gitlab/issues') {
          console.log(`     Issues: ${result.data.data?.length || 0} found`);
        } else if (endpoint === '/api/gitlab/analysis') {
          console.log(`     Health Score: ${result.data.data?.healthScore || 'N/A'}`);
        }
      } else {
        console.log(`  ❌ ${endpoint} - Status: ${result.status}`);
        console.log(`     Error: ${result.data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.log(`  ❌ ${endpoint} - Error: ${error.message}`);
    }
    console.log('');
  }

  console.log('✅ GitLab Integration Test Complete!');
}

// Check if server is running first
async function checkServer() {
  try {
    await makeRequest('/health');
    return true;
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log('🔍 Checking if server is running...');
  
  const serverRunning = await checkServer();
  if (!serverRunning) {
    console.log('❌ Server is not running. Please start the server first:');
    console.log('   cd nodejs-api-server && npm start');
    process.exit(1);
  }
  
  console.log('✅ Server is running, starting tests...\n');
  await testGitLabIntegration();
}

main().catch(console.error);