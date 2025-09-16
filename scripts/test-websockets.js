#!/usr/bin/env node

/**
 * WebSocket Testing Utility for Universal AI Tools
 * Tests all WebSocket endpoints for connectivity and basic functionality
 */

const WebSocket = require('ws');

// Configuration
const BASE_URL = process.env.WS_BASE_URL || 'ws://localhost:9999';
const TEST_TIMEOUT = 5000;

// WebSocket endpoints to test
const WEBSOCKET_ENDPOINTS = [
  {
    name: 'Athena WebSocket',
    path: '/ws/athena',
    testMessage: { type: 'ping', data: 'test' }
  },
  {
    name: 'Device Authentication WebSocket',
    path: '/ws/device-auth',
    testMessage: { type: 'heartbeat', timestamp: Date.now() }
  },
  {
    name: 'Voice Commands WebSocket', 
    path: '/ws/voice',
    testMessage: { type: 'voice_status', data: 'test' }
  },
  {
    name: 'Browser Scraping Bridge',
    path: '/ws/browser-scraping',
    testMessage: { type: 'status', data: 'health_check' }
  }
];

// Colors for output
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bright: '\x1b[1m'
};

function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const colorMap = {
    info: colors.blue,
    success: colors.green,
    warning: colors.yellow,
    error: colors.red
  };
  
  const color = colorMap[level] || colors.reset;
  console.log(`${color}[${timestamp}] ${level.toUpperCase()}: ${message}${colors.reset}`);
  
  if (data) {
    console.log(`${colors.bright}  Data:${colors.reset}`, data);
  }
}

function testWebSocket(endpoint) {
  return new Promise((resolve) => {
    const url = `${BASE_URL}${endpoint.path}`;
    let ws;
    let connected = false;
    let responded = false;
    
    const timeout = setTimeout(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      resolve({
        name: endpoint.name,
        path: endpoint.path,
        connected,
        responded,
        success: false,
        error: 'Connection timeout'
      });
    }, TEST_TIMEOUT);
    
    try {
      ws = new WebSocket(url);
      
      ws.on('open', () => {
        connected = true;
        log('info', `Connected to ${endpoint.name}`);
        
        // Send test message
        ws.send(JSON.stringify(endpoint.testMessage));
      });
      
      ws.on('message', (data) => {
        responded = true;
        log('success', `Received response from ${endpoint.name}`, data.toString());
        
        clearTimeout(timeout);
        ws.close();
        resolve({
          name: endpoint.name,
          path: endpoint.path,
          connected,
          responded,
          success: true,
          response: data.toString()
        });
      });
      
      ws.on('error', (error) => {
        log('error', `WebSocket error for ${endpoint.name}`, error.message);
        
        clearTimeout(timeout);
        resolve({
          name: endpoint.name,
          path: endpoint.path,
          connected: false,
          responded: false,
          success: false,
          error: error.message
        });
      });
      
      ws.on('close', (code, reason) => {
        log('info', `WebSocket closed for ${endpoint.name}`, { code, reason: reason.toString() });
        
        if (!responded && connected) {
          // Connection was established but no response received
          clearTimeout(timeout);
          resolve({
            name: endpoint.name,
            path: endpoint.path,
            connected,
            responded: false,
            success: false,
            error: 'No response received'
          });
        }
      });
      
    } catch (error) {
      clearTimeout(timeout);
      resolve({
        name: endpoint.name,
        path: endpoint.path,
        connected: false,
        responded: false,
        success: false,
        error: error.message
      });
    }
  });
}

async function main() {
  console.log(`${colors.bright}🔌 WebSocket Testing Utility for Universal AI Tools${colors.reset}`);
  console.log('='.repeat(60));
  console.log(`Testing WebSocket endpoints at: ${BASE_URL}`);
  console.log(`Timeout: ${TEST_TIMEOUT}ms\n`);
  
  const results = [];
  
  for (const endpoint of WEBSOCKET_ENDPOINTS) {
    log('info', `Testing ${endpoint.name} (${endpoint.path})`);
    const result = await testWebSocket(endpoint);
    results.push(result);
    console.log(); // Empty line for spacing
  }
  
  // Summary
  console.log(`${colors.bright}📊 Test Results Summary${colors.reset}`);
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success).length;
  const total = results.length;
  
  results.forEach(result => {
    const status = result.success ? 
      `${colors.green}✅ PASS${colors.reset}` : 
      `${colors.red}❌ FAIL${colors.reset}`;
    
    console.log(`${status} ${result.name}`);
    console.log(`   Path: ${result.path}`);
    console.log(`   Connected: ${result.connected ? '✓' : '✗'}`);
    console.log(`   Responded: ${result.responded ? '✓' : '✗'}`);
    
    if (!result.success) {
      console.log(`   Error: ${result.error}`);
    }
    
    console.log();
  });
  
  console.log(`${colors.bright}Final Score: ${successful}/${total} WebSocket endpoints working${colors.reset}`);
  
  if (successful === total) {
    console.log(`${colors.green}🎉 All WebSocket endpoints are functional!${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`${colors.yellow}⚠️ ${total - successful} WebSocket endpoint(s) need attention${colors.reset}`);
    
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Ensure the server is running: npm run dev');
    console.log('2. Check that WebSocket services are initialized');
    console.log('3. Verify firewall settings allow WebSocket connections');
    console.log('4. Check server logs for WebSocket initialization errors');
    
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  log('error', 'Uncaught exception', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  log('error', 'Unhandled rejection', error.message);
  process.exit(1);
});

// Run the tests
main().catch(error => {
  log('error', 'Test execution failed', error.message);
  process.exit(1);
});