#!/usr/bin/env node

/**
 * Comprehensive Frontend Testing Script
 * Tests all major components and features of Universal AI Tools
 */

const http = require('http');
const https = require('https');

// Configuration
const FRONTEND_URL = 'http://localhost:5173';
const BACKEND_URL = 'http://localhost:9999';
const API_KEY = 'test-api-key-123';

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Test results
const testResults = {
  passed: [],
  failed: [],
  warnings: []
};

// Helper function to make HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

// Test categories
async function testFrontendServer() {
  console.log(`\n${colors.cyan}1. FRONTEND SERVER TESTS${colors.reset}`);
  console.log('=' .repeat(50));
  
  try {
    // Test if frontend is running
    const response = await makeRequest(FRONTEND_URL);
    if (response.statusCode === 200) {
      testResults.passed.push('Frontend server is running on port 5173');
      console.log(`${colors.green}✅ Frontend server is running${colors.reset}`);
    } else {
      testResults.failed.push(`Frontend returned status ${response.statusCode}`);
      console.log(`${colors.red}❌ Frontend returned unexpected status: ${response.statusCode}${colors.reset}`);
    }
    
    // Check for React app root
    if (response.body.includes('<div id="root">')) {
      testResults.passed.push('React root element found');
      console.log(`${colors.green}✅ React root element found${colors.reset}`);
    } else {
      testResults.failed.push('React root element not found');
      console.log(`${colors.red}❌ React root element not found${colors.reset}`);
    }
    
    // Check for Vite HMR script
    if (response.body.includes('vite') || response.body.includes('/@vite')) {
      testResults.passed.push('Vite HMR enabled');
      console.log(`${colors.green}✅ Vite HMR (Hot Module Replacement) enabled${colors.reset}`);
    } else {
      testResults.warnings.push('Vite HMR might not be enabled');
      console.log(`${colors.yellow}⚠️ Vite HMR might not be enabled${colors.reset}`);
    }
    
  } catch (error) {
    testResults.failed.push(`Frontend server test failed: ${error.message}`);
    console.log(`${colors.red}❌ Frontend server test failed: ${error.message}${colors.reset}`);
  }
}

async function testBackendIntegration() {
  console.log(`\n${colors.cyan}2. BACKEND INTEGRATION TESTS${colors.reset}`);
  console.log('=' .repeat(50));
  
  const endpoints = [
    { path: '/health', method: 'GET', name: 'Health Check' },
    { path: '/api/v1/status', method: 'GET', name: 'System Status' },
    { path: '/api/v1/agents', method: 'GET', name: 'Agents List' },
    { path: '/api/v1', method: 'GET', name: 'API Base' }
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await makeRequest(`${BACKEND_URL}${endpoint.path}`, {
        method: endpoint.method,
        headers: {
          'X-API-Key': API_KEY,
          'X-AI-Service': 'universal-ai-ui'
        }
      });
      
      if (response.statusCode === 200) {
        testResults.passed.push(`${endpoint.name} endpoint working`);
        console.log(`${colors.green}✅ ${endpoint.name}: Working (200 OK)${colors.reset}`);
        
        // Parse and check response
        try {
          const data = JSON.parse(response.body);
          if (data.success !== false) {
            console.log(`   ${colors.blue}Response: ${JSON.stringify(data).substring(0, 100)}...${colors.reset}`);
          }
        } catch (e) {
          // Not JSON, that's okay
        }
      } else {
        testResults.failed.push(`${endpoint.name} returned ${response.statusCode}`);
        console.log(`${colors.red}❌ ${endpoint.name}: Status ${response.statusCode}${colors.reset}`);
      }
    } catch (error) {
      testResults.failed.push(`${endpoint.name} failed: ${error.message}`);
      console.log(`${colors.red}❌ ${endpoint.name}: ${error.message}${colors.reset}`);
    }
  }
}

async function testProxyConfiguration() {
  console.log(`\n${colors.cyan}3. PROXY CONFIGURATION TESTS${colors.reset}`);
  console.log('=' .repeat(50));
  
  // Test if frontend proxy is working
  try {
    // Make request through frontend proxy
    const response = await makeRequest(`${FRONTEND_URL}/api/v1/status`, {
      headers: {
        'X-API-Key': API_KEY,
        'X-AI-Service': 'universal-ai-ui'
      }
    });
    
    if (response.statusCode === 200) {
      testResults.passed.push('Frontend proxy to backend working');
      console.log(`${colors.green}✅ Frontend proxy configuration working${colors.reset}`);
      console.log(`   ${colors.blue}Proxy: /api -> ${BACKEND_URL}${colors.reset}`);
    } else {
      testResults.warnings.push(`Frontend proxy returned ${response.statusCode}`);
      console.log(`${colors.yellow}⚠️ Frontend proxy returned status ${response.statusCode}${colors.reset}`);
    }
  } catch (error) {
    testResults.failed.push(`Frontend proxy test failed: ${error.message}`);
    console.log(`${colors.red}❌ Frontend proxy test failed: ${error.message}${colors.reset}`);
  }
}

async function testWebSocketConnection() {
  console.log(`\n${colors.cyan}4. WEBSOCKET CONNECTION TEST${colors.reset}`);
  console.log('=' .repeat(50));
  
  // Note: Full WebSocket testing requires a WebSocket client
  // Here we just check if the WebSocket endpoint is accessible
  try {
    const response = await makeRequest(`${BACKEND_URL}/`);
    if (response.statusCode === 200) {
      console.log(`${colors.green}✅ Backend server accepting connections${colors.reset}`);
      console.log(`   ${colors.blue}WebSocket endpoint: ws://localhost:9999${colors.reset}`);
      testResults.passed.push('WebSocket endpoint accessible');
    }
  } catch (error) {
    testResults.warnings.push('Could not verify WebSocket endpoint');
    console.log(`${colors.yellow}⚠️ Could not verify WebSocket: ${error.message}${colors.reset}`);
  }
}

async function testComponentEndpoints() {
  console.log(`\n${colors.cyan}5. COMPONENT ENDPOINT TESTS${colors.reset}`);
  console.log('=' .repeat(50));
  
  const componentEndpoints = [
    { name: 'Chat API', path: '/api/v1/chat', method: 'POST', body: JSON.stringify({ message: 'test' }) },
    { name: 'Assistant API', path: '/api/v1/assistant/chat', method: 'POST', body: JSON.stringify({ message: 'test' }) },
    { name: 'Vision Health', path: '/api/v1/vision/health', method: 'GET' },
    { name: 'MLX Models', path: '/api/v1/mlx/models', method: 'GET' },
    { name: 'AB-MCTS Status', path: '/api/v1/ab-mcts/status', method: 'GET' }
  ];
  
  for (const endpoint of componentEndpoints) {
    try {
      const options = {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
          'X-AI-Service': 'universal-ai-ui'
        }
      };
      
      if (endpoint.body) {
        options.body = endpoint.body;
        options.headers['Content-Length'] = Buffer.byteLength(endpoint.body);
      }
      
      const response = await makeRequest(`${BACKEND_URL}${endpoint.path}`, options);
      
      if (response.statusCode === 200 || response.statusCode === 201) {
        testResults.passed.push(`${endpoint.name} working`);
        console.log(`${colors.green}✅ ${endpoint.name}: Working${colors.reset}`);
      } else if (response.statusCode === 404) {
        testResults.warnings.push(`${endpoint.name} not found (might not be implemented)`);
        console.log(`${colors.yellow}⚠️ ${endpoint.name}: Not found (404)${colors.reset}`);
      } else {
        testResults.failed.push(`${endpoint.name} returned ${response.statusCode}`);
        console.log(`${colors.red}❌ ${endpoint.name}: Status ${response.statusCode}${colors.reset}`);
      }
    } catch (error) {
      testResults.failed.push(`${endpoint.name} failed: ${error.message}`);
      console.log(`${colors.red}❌ ${endpoint.name}: ${error.message}${colors.reset}`);
    }
  }
}

async function printSummary() {
  console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.cyan}COMPREHENSIVE FRONTEND TEST SUMMARY${colors.reset}`);
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
  
  const total = testResults.passed.length + testResults.failed.length + testResults.warnings.length;
  const passRate = total > 0 ? ((testResults.passed.length / total) * 100).toFixed(1) : 0;
  
  console.log(`${colors.green}✅ PASSED: ${testResults.passed.length} tests${colors.reset}`);
  testResults.passed.forEach(test => {
    console.log(`   ${colors.green}• ${test}${colors.reset}`);
  });
  
  if (testResults.warnings.length > 0) {
    console.log(`\n${colors.yellow}⚠️ WARNINGS: ${testResults.warnings.length} tests${colors.reset}`);
    testResults.warnings.forEach(test => {
      console.log(`   ${colors.yellow}• ${test}${colors.reset}`);
    });
  }
  
  if (testResults.failed.length > 0) {
    console.log(`\n${colors.red}❌ FAILED: ${testResults.failed.length} tests${colors.reset}`);
    testResults.failed.forEach(test => {
      console.log(`   ${colors.red}• ${test}${colors.reset}`);
    });
  }
  
  console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.cyan}Overall Pass Rate: ${passRate}%${colors.reset}`);
  console.log(`${colors.cyan}Total Tests: ${total}${colors.reset}`);
  
  // Recommendations
  console.log(`\n${colors.cyan}RECOMMENDATIONS:${colors.reset}`);
  
  if (testResults.failed.length === 0 && testResults.warnings.length === 0) {
    console.log(`${colors.green}✨ All systems operational! The frontend and backend integration is working perfectly.${colors.reset}`);
  } else {
    if (testResults.failed.includes('Frontend server test failed: connect ECONNREFUSED ::1:5173')) {
      console.log(`${colors.yellow}• Start the frontend server: cd ui && npm run dev${colors.reset}`);
    }
    if (testResults.failed.some(f => f.includes('Backend'))) {
      console.log(`${colors.yellow}• Ensure the backend is running: npm start${colors.reset}`);
    }
    if (testResults.warnings.some(w => w.includes('WebSocket'))) {
      console.log(`${colors.yellow}• WebSocket functionality should be tested with a proper WebSocket client${colors.reset}`);
    }
    if (testResults.warnings.some(w => w.includes('not found'))) {
      console.log(`${colors.yellow}• Some endpoints are not implemented yet - this is expected for features in development${colors.reset}`);
    }
  }
  
  console.log(`\n${colors.cyan}Test completed at: ${new Date().toLocaleString()}${colors.reset}\n`);
}

// Main test runner
async function runTests() {
  console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.cyan}UNIVERSAL AI TOOLS - COMPREHENSIVE FRONTEND TESTING${colors.reset}`);
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  console.log(`\n${colors.blue}Frontend URL: ${FRONTEND_URL}${colors.reset}`);
  console.log(`${colors.blue}Backend URL: ${BACKEND_URL}${colors.reset}`);
  console.log(`${colors.blue}Starting tests...${colors.reset}\n`);
  
  await testFrontendServer();
  await testBackendIntegration();
  await testProxyConfiguration();
  await testWebSocketConnection();
  await testComponentEndpoints();
  await printSummary();
}

// Run the tests
runTests().catch(error => {
  console.error(`${colors.red}Fatal error running tests: ${error.message}${colors.reset}`);
  process.exit(1);
});