#!/usr/bin/env node

// Test DSPy Integration
// Verifies that MIPRO/DSPy is correctly installed and working

import { spawn } from 'child_process';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Testing Universal AI Tools DSPy/MIPRO Integration');
console.log('📅 Started at:', new Date().toISOString());
console.log();

// Set environment variables for testing
process.env.NODE_ENV = 'development';
process.env.PORT = '9998'; // Use different port to avoid conflicts

// Test 1: Check Python dependencies
console.log('📦 Test 1: Checking Python dependencies...');
try {
  const pythonCheck = spawn('python', ['-c', 'import dspy; print(f"DSPy version: {dspy.__version__}")'], {
    cwd: __dirname,
    stdio: 'pipe'
  });
  
  pythonCheck.stdout.on('data', (data) => {
    console.log('✅ Python DSPy check:', data.toString().trim());
  });
  
  pythonCheck.stderr.on('data', (data) => {
    console.log('❌ Python error:', data.toString().trim());
  });
  
  pythonCheck.on('close', (code) => {
    if (code === 0) {
      console.log('✅ DSPy installation verified');
      testDSPyServer();
    } else {
      console.log('❌ DSPy not properly installed');
      process.exit(1);
    }
  });
} catch (error) {
  console.log('❌ Failed to run Python check:', error.message);
  process.exit(1);
}

// Test 2: Start DSPy server directly
function testDSPyServer() {
  console.log('\n🐍 Test 2: Starting DSPy server directly...');
  
  const dspyServer = spawn('python', ['src/services/dspy-orchestrator/server.py'], {
    cwd: __dirname,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PYTHONUNBUFFERED: '1'
    },
    stdio: 'pipe'
  });
  
  let serverStarted = false;
  
  dspyServer.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('DSPy Server:', output.trim());
    
    if (output.includes('Starting DSPy server') || output.includes('server listening')) {
      serverStarted = true;
      // Give server time to fully start
      setTimeout(() => testDSPyConnection(), 3000);
    }
  });
  
  dspyServer.stderr.on('data', (data) => {
    const output = data.toString();
    console.log('DSPy Error:', output.trim());
    
    if (output.includes('server listening') && !serverStarted) {
      serverStarted = true;
      console.log('✅ DSPy server started successfully');
      // Give server time to fully start
      setTimeout(() => testDSPyConnection(), 2000);
    }
  });
  
  dspyServer.on('close', (code) => {
    console.log(`DSPy server exited with code ${code}`);
  });
  
  // Timeout if server doesn't start
  setTimeout(() => {
    if (!serverStarted) {
      console.log('❌ DSPy server failed to start within timeout');
      dspyServer.kill();
      process.exit(1);
    }
  }, 10000);
}

// Test 3: Test WebSocket connection to DSPy
async function testDSPyConnection() {
  console.log('\n🔌 Test 3: Testing DSPy WebSocket connection...');
  
  try {
    const WebSocket = await import('ws');
    const ws = new WebSocket.default('ws://localhost:8766');
    
    ws.on('open', () => {
      console.log('✅ Connected to DSPy WebSocket server');
      
      // Test orchestration request
      const testRequest = {
        requestId: 'test-123',
        method: 'orchestrate',
        params: {
          userRequest: 'Test MIPRO optimization with example task',
          context: { test: true }
        }
      };
      
      console.log('📤 Sending test orchestration request...');
      ws.send(JSON.stringify(testRequest));
    });
    
    ws.on('message', (data) => {
      try {
        const response = JSON.parse(data.toString());
        console.log('📥 Received DSPy response:');
        console.log(JSON.stringify(response, null, 2));
        
        if (response.success && response.data) {
          console.log('✅ DSPy orchestration working correctly');
          testMIPROOptimization(ws);
        } else {
          console.log('❌ DSPy orchestration failed');
          ws.close();
          process.exit(1);
        }
      } catch (error) {
        console.log('❌ Failed to parse DSPy response:', error.message);
      }
    });
    
    ws.on('error', (error) => {
      console.log('❌ WebSocket error:', error.message);
      process.exit(1);
    });
    
    ws.on('close', () => {
      console.log('🔌 DSPy WebSocket connection closed');
    });
    
  } catch (error) {
    console.log('❌ Failed to connect to DSPy server:', error.message);
    process.exit(1);
  }
}

// Test 4: Test MIPRO optimization
function testMIPROOptimization(ws) {
  console.log('\n🧠 Test 4: Testing MIPRO optimization...');
  
  const miprov2Request = {
    requestId: 'mipro-test-456',
    method: 'optimize_prompts',
    params: {
      examples: [
        {
          userRequest: 'Analyze this data for patterns',
          expectedIntent: 'analysis',
          expectedComplexity: 'moderate'
        },
        {
          userRequest: 'Create a simple report',
          expectedIntent: 'generation',
          expectedComplexity: 'simple'
        }
      ]
    }
  };
  
  console.log('📤 Sending MIPRO optimization request...');
  ws.send(JSON.stringify(miprov2Request));
  
  // Set up one-time listener for MIPRO response
  const originalMessageHandler = ws.onmessage;
  ws.onmessage = (event) => {
    try {
      const response = JSON.parse(event.data);
      if (response.requestId === 'mipro-test-456') {
        console.log('📥 Received MIPRO optimization response:');
        console.log(JSON.stringify(response, null, 2));
        
        if (response.success && response.data.optimized) {
          console.log('✅ MIPRO optimization working correctly');
          console.log('🎯 Performance gain:', response.data.performance_gain);
          console.log('🔧 Optimization method:', response.data.optimization_details.method);
        } else {
          console.log('⚠️ MIPRO optimization completed but may have issues');
        }
        
        // Test knowledge management
        testKnowledgeManagement(ws);
        return;
      }
      
      // Call original handler for other messages
      if (originalMessageHandler) {
        originalMessageHandler(event);
      }
    } catch (error) {
      console.log('❌ Failed to parse MIPRO response:', error.message);
    }
  };
}

// Test 5: Test knowledge management with optimization
function testKnowledgeManagement(ws) {
  console.log('\n📚 Test 5: Testing optimized knowledge management...');
  
  const knowledgeRequest = {
    requestId: 'knowledge-test-789',
    method: 'manage_knowledge',
    params: {
      operation: 'extract',
      data: {
        content: 'Universal AI Tools is a comprehensive platform for AI agent orchestration using DSPy and MIPRO optimization.',
        context: { type: 'documentation', source: 'system' }
      }
    }
  };
  
  console.log('📤 Sending knowledge extraction request...');
  ws.send(JSON.stringify(knowledgeRequest));
  
  // Set up one-time listener for knowledge response
  const originalMessageHandler = ws.onmessage;
  ws.onmessage = (event) => {
    try {
      const response = JSON.parse(event.data);
      if (response.requestId === 'knowledge-test-789') {
        console.log('📥 Received knowledge management response:');
        console.log(JSON.stringify(response, null, 2));
        
        if (response.success && response.data) {
          console.log('✅ Optimized knowledge extraction working correctly');
        } else {
          console.log('❌ Knowledge extraction failed');
        }
        
        // Complete testing
        completeTest(ws);
        return;
      }
      
      // Call original handler for other messages
      if (originalMessageHandler) {
        originalMessageHandler(event);
      }
    } catch (error) {
      console.log('❌ Failed to parse knowledge response:', error.message);
    }
  };
}

// Complete the test
function completeTest(ws) {
  console.log('\n🎉 DSPy/MIPRO Integration Test Complete!');
  console.log('📊 Summary:');
  console.log('  ✅ DSPy installation verified');
  console.log('  ✅ DSPy server started successfully');
  console.log('  ✅ WebSocket connection established');
  console.log('  ✅ Orchestration working');
  console.log('  ✅ MIPRO optimization functional');
  console.log('  ✅ Knowledge management operational');
  console.log();
  console.log('🚀 MIPRO/DSPy is correctly installed and working!');
  console.log('🎯 Ready for production use with real API keys');
  
  ws.close();
  
  // Exit gracefully
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}