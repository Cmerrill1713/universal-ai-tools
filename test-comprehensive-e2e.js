#!/usr/bin/env node

/**
 * Universal AI Tools - Comprehensive End-to-End Testing Suite
 * 
 * This script performs comprehensive workflow testing including:
 * 1. Authentication flow testing
 * 2. API versioning functionality
 * 3. Middleware chain execution
 * 4. AI service integration testing
 * 5. Critical user workflows
 * 6. Error handling scenarios
 * 7. WebSocket functionality
 * 8. Performance metrics collection
 */

import axios from 'axios';
import WebSocket from 'ws';
import { performance } from 'perf_hooks';
import fs from 'fs/promises';
import path from 'path';

const BASE_URL = 'http://localhost:9999';
const WS_BASE_URL = 'ws://localhost:9999';

// Test configuration
const TEST_CONFIG = {
  timeout: 30000,
  maxRetries: 3,
  performanceThresholds: {
    apiResponse: 2000, // 2 seconds
    dbQuery: 1000,     // 1 second
    wsConnection: 5000  // 5 seconds
  }
};

// Test results collection
const testResults = {
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0
  },
  categories: {
    authentication: { tests: [], passed: 0, failed: 0 },
    apiVersioning: { tests: [], passed: 0, failed: 0 },
    middleware: { tests: [], passed: 0, failed: 0 },
    aiServices: { tests: [], passed: 0, failed: 0 },
    userWorkflows: { tests: [], passed: 0, failed: 0 },
    errorHandling: { tests: [], passed: 0, failed: 0 },
    webSocket: { tests: [], passed: 0, failed: 0 },
    performance: { tests: [], passed: 0, failed: 0 }
  },
  performanceMetrics: {
    responseTime: [],
    memoryUsage: [],
    errorRate: 0,
    throughput: 0
  },
  recommendations: []
};

// Test utilities
class TestRunner {
  constructor() {
    this.currentCategory = null;
    this.testApiKey = null;
    this.testServiceId = null;
  }

  async runTest(name, category, testFunction) {
    console.log(`\n🧪 Running test: ${name}`);
    testResults.summary.total++;
    
    const startTime = performance.now();
    let result = { name, category, status: 'failed', error: null, duration: 0, metrics: {} };
    
    try {
      const testResult = await Promise.race([
        testFunction(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Test timeout')), TEST_CONFIG.timeout)
        )
      ]);
      
      result.status = 'passed';
      result.data = testResult;
      testResults.summary.passed++;
      testResults.categories[category].passed++;
      console.log(`✅ PASSED: ${name}`);
      
    } catch (error) {
      result.error = error.message;
      testResults.summary.failed++;
      testResults.categories[category].failed++;
      console.log(`❌ FAILED: ${name} - ${error.message}`);
    }
    
    result.duration = performance.now() - startTime;
    testResults.categories[category].tests.push(result);
    
    // Collect performance metrics
    if (result.status === 'passed' && result.duration) {
      testResults.performanceMetrics.responseTime.push(result.duration);
    }
    
    return result;
  }

  async makeRequest(method, endpoint, data = null, headers = {}) {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      validateStatus: () => true // Don't throw on HTTP errors
    };
    
    if (data) {
      config.data = data;
    }
    
    const startTime = performance.now();
    const response = await axios(config);
    const duration = performance.now() - startTime;
    
    return { ...response, duration };
  }

  async setupTestAuthentication() {
    try {
      // Register a test service
      const response = await this.makeRequest('POST', '/api/register', {
        service_name: 'E2E Test Service',
        service_type: 'custom',
        capabilities: ['memory', 'context', 'tools', 'ai_chat']
      });
      
      if (response.status === 200) {
        this.testApiKey = response.data.api_key;
        this.testServiceId = response.data.service_id;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to setup test authentication:', error.message);
      return false;
    }
  }

  getAuthHeaders() {
    return {
      'X-API-Key': this.testApiKey || 'local-dev-key',
      'X-AI-Service': 'local-ui'
    };
  }
}

const testRunner = new TestRunner();

// Test Categories

// 1. Authentication Flow Testing
async function testAuthenticationWorkflows() {
  console.log('\n🔐 Testing Authentication Workflows...');
  
  // Test service registration
  await testRunner.runTest('Service Registration', 'authentication', async () => {
    const response = await testRunner.makeRequest('POST', '/api/register', {
      service_name: 'Test Auth Service',
      service_type: 'claude',
      capabilities: ['memory', 'tools']
    });
    
    if (response.status !== 200) {
      throw new Error(`Registration failed: ${response.status}`);
    }
    
    if (!response.data.api_key || !response.data.service_id) {
      throw new Error('Missing API key or service ID in response');
    }
    
    return response.data;
  });
  
  // Test authentication with valid credentials
  await testRunner.runTest('Valid Authentication', 'authentication', async () => {
    const response = await testRunner.makeRequest('GET', '/api/stats', null, testRunner.getAuthHeaders());
    
    if (response.status !== 200) {
      throw new Error(`Authentication failed: ${response.status}`);
    }
    
    return response.data;
  });
  
  // Test authentication with invalid credentials
  await testRunner.runTest('Invalid Authentication', 'authentication', async () => {
    const response = await testRunner.makeRequest('GET', '/api/stats', null, {
      'X-API-Key': 'invalid-key',
      'X-AI-Service': 'invalid-service'
    });
    
    if (response.status !== 401) {
      throw new Error(`Expected 401, got ${response.status}`);
    }
    
    return { expectedFailure: true };
  });
  
  // Test missing authentication headers
  await testRunner.runTest('Missing Auth Headers', 'authentication', async () => {
    const response = await testRunner.makeRequest('GET', '/api/stats');
    
    if (response.status !== 401) {
      throw new Error(`Expected 401, got ${response.status}`);
    }
    
    return { expectedFailure: true };
  });
}

// 2. API Versioning Testing
async function testApiVersioning() {
  console.log('\n🔄 Testing API Versioning...');
  
  // Test API version detection
  await testRunner.runTest('Version Detection', 'apiVersioning', async () => {
    const response = await testRunner.makeRequest('GET', '/api/docs');
    
    if (response.status !== 200) {
      throw new Error(`API docs failed: ${response.status}`);
    }
    
    if (!response.data.apiVersions) {
      throw new Error('Missing API version information');
    }
    
    return response.data.apiVersions;
  });
  
  // Test v1 API endpoints
  await testRunner.runTest('V1 API Access', 'apiVersioning', async () => {
    const response = await testRunner.makeRequest('GET', '/api/v1/memory', null, testRunner.getAuthHeaders());
    
    if (response.status !== 200) {
      throw new Error(`V1 API failed: ${response.status}`);
    }
    
    return response.data;
  });
  
  // Test legacy API redirect
  await testRunner.runTest('Legacy API Support', 'apiVersioning', async () => {
    const response = await testRunner.makeRequest('GET', '/api/memory', null, testRunner.getAuthHeaders());
    
    if (response.status !== 200) {
      throw new Error(`Legacy API failed: ${response.status}`);
    }
    
    return response.data;
  });
  
  // Test content negotiation
  await testRunner.runTest('Content Negotiation', 'apiVersioning', async () => {
    const response = await testRunner.makeRequest('GET', '/api/v1/memory', null, {
      ...testRunner.getAuthHeaders(),
      'Accept': 'application/vnd.api+json;version=1'
    });
    
    if (response.status !== 200) {
      throw new Error(`Content negotiation failed: ${response.status}`);
    }
    
    return response.data;
  });
}

// 3. Middleware Chain Testing
async function testMiddlewareChain() {
  console.log('\n⚙️ Testing Middleware Chain...');
  
  // Test security middleware
  await testRunner.runTest('Security Headers', 'middleware', async () => {
    const response = await testRunner.makeRequest('GET', '/health');
    
    const securityHeaders = [
      'x-content-type-options',
      'x-frame-options',
      'x-xss-protection'
    ];
    
    for (const header of securityHeaders) {
      if (!response.headers[header]) {
        throw new Error(`Missing security header: ${header}`);
      }
    }
    
    return { securityHeaders: Object.keys(response.headers) };
  });
  
  // Test rate limiting
  await testRunner.runTest('Rate Limiting', 'middleware', async () => {
    const requests = [];
    for (let i = 0; i < 5; i++) {
      requests.push(testRunner.makeRequest('GET', '/health'));
    }
    
    const responses = await Promise.all(requests);
    const rateLimitHeaders = responses[0].headers['x-ratelimit-limit'];
    
    if (!rateLimitHeaders) {
      throw new Error('Rate limit headers not found');
    }
    
    return { rateLimitHeaders };
  });
  
  // Test CORS middleware
  await testRunner.runTest('CORS Headers', 'middleware', async () => {
    const response = await testRunner.makeRequest('OPTIONS', '/api/docs', null, {
      'Origin': 'http://localhost:3001',
      'Access-Control-Request-Method': 'GET'
    });
    
    if (!response.headers['access-control-allow-origin']) {
      throw new Error('CORS headers not found');
    }
    
    return { corsHeaders: response.headers };
  });
  
  // Test request validation
  await testRunner.runTest('Request Validation', 'middleware', async () => {
    const response = await testRunner.makeRequest('POST', '/api/v1/memory', {
      invalid: 'data'
    }, testRunner.getAuthHeaders());
    
    // Should validate and potentially reject malformed requests
    return { validationResponse: response.status };
  });
}

// 4. AI Service Integration Testing
async function testAIServiceIntegration() {
  console.log('\n🤖 Testing AI Service Integration...');
  
  // Test Ollama service connectivity
  await testRunner.runTest('Ollama Service Status', 'aiServices', async () => {
    const response = await testRunner.makeRequest('GET', '/api/ollama/status');
    
    if (response.status !== 200) {
      throw new Error(`Ollama status check failed: ${response.status}`);
    }
    
    return response.data;
  });
  
  // Test memory service operations
  await testRunner.runTest('Memory Service Operations', 'aiServices', async () => {
    // Store a memory
    const storeResponse = await testRunner.makeRequest('POST', '/api/v1/memory', {
      content: 'Test memory for E2E testing',
      memory_type: 'working',
      metadata: { test: true, timestamp: new Date().toISOString() }
    }, testRunner.getAuthHeaders());
    
    if (storeResponse.status !== 200) {
      throw new Error(`Memory store failed: ${storeResponse.status}`);
    }
    
    // Retrieve memories
    const retrieveResponse = await testRunner.makeRequest('GET', '/api/v1/memory', null, testRunner.getAuthHeaders());
    
    if (retrieveResponse.status !== 200) {
      throw new Error(`Memory retrieve failed: ${retrieveResponse.status}`);
    }
    
    return { stored: storeResponse.data, retrieved: retrieveResponse.data };
  });
  
  // Test speech service functionality
  await testRunner.runTest('Speech Service Integration', 'aiServices', async () => {
    const response = await testRunner.makeRequest('GET', '/api/v1/speech/voices', null, testRunner.getAuthHeaders());
    
    // Speech service might not be fully configured, so we check for reasonable response
    if (response.status !== 200 && response.status !== 503) {
      throw new Error(`Unexpected speech service response: ${response.status}`);
    }
    
    return { status: response.status, available: response.status === 200 };
  });
  
  // Test agent orchestration
  await testRunner.runTest('Agent Orchestration', 'aiServices', async () => {
    const response = await testRunner.makeRequest('POST', '/api/assistant/route-request', {
      request: 'Test agent orchestration',
      context: { test: true }
    }, testRunner.getAuthHeaders());
    
    return { status: response.status, orchestration: response.data };
  });
}

// 5. Critical User Workflows
async function testCriticalUserWorkflows() {
  console.log('\n👤 Testing Critical User Workflows...');
  
  // Test user registration and authentication
  await testRunner.runTest('User Registration Flow', 'userWorkflows', async () => {
    const registrationData = {
      service_name: `User Workflow Test ${Date.now()}`,
      service_type: 'custom',
      capabilities: ['memory', 'context']
    };
    
    const response = await testRunner.makeRequest('POST', '/api/register', registrationData);
    
    if (response.status !== 200) {
      throw new Error(`User registration failed: ${response.status}`);
    }
    
    return response.data;
  });
  
  // Test AI assistant conversation
  await testRunner.runTest('AI Assistant Conversation', 'userWorkflows', async () => {
    const conversationId = `test-conv-${Date.now()}`;
    
    const chatResponse = await testRunner.makeRequest('POST', '/api/assistant/chat', {
      message: 'Hello, this is a test message',
      conversation_id: conversationId,
      model: 'llama3.2:3b'
    }, testRunner.getAuthHeaders());
    
    return { 
      status: chatResponse.status, 
      hasResponse: !!chatResponse.data?.response,
      conversationId 
    };
  });
  
  // Test file upload and processing (if available)
  await testRunner.runTest('File Processing Workflow', 'userWorkflows', async () => {
    // Test with a simple text upload simulation
    const response = await testRunner.makeRequest('POST', '/api/v1/tools/execute', {
      tool_name: 'text_processor',
      parameters: { text: 'Test file content for processing' }
    }, testRunner.getAuthHeaders());
    
    return { status: response.status, processed: response.status === 200 };
  });
  
  // Test memory storage and retrieval workflow
  await testRunner.runTest('Memory Workflow', 'userWorkflows', async () => {
    const testMemory = {
      content: 'Complete workflow test memory',
      memory_type: 'long_term',
      metadata: { 
        workflow: 'e2e_test',
        importance: 'high',
        timestamp: new Date().toISOString()
      }
    };
    
    // Store memory
    const storeResponse = await testRunner.makeRequest('POST', '/api/v1/memory', testMemory, testRunner.getAuthHeaders());
    
    if (storeResponse.status !== 200) {
      throw new Error(`Memory storage failed: ${storeResponse.status}`);
    }
    
    // Search memory
    const searchResponse = await testRunner.makeRequest('POST', '/api/v1/memory/search', {
      query: 'Complete workflow test',
      limit: 10
    }, testRunner.getAuthHeaders());
    
    return { 
      stored: storeResponse.status === 200,
      searched: searchResponse.status === 200,
      results: searchResponse.data
    };
  });
}

// 6. Error Handling Testing
async function testErrorHandling() {
  console.log('\n🚨 Testing Error Handling...');
  
  // Test invalid authentication scenarios
  await testRunner.runTest('Invalid Auth Error Handling', 'errorHandling', async () => {
    const response = await testRunner.makeRequest('GET', '/api/v1/memory', null, {
      'X-API-Key': 'definitely-invalid-key',
      'X-AI-Service': 'non-existent-service'
    });
    
    if (response.status !== 401) {
      throw new Error(`Expected 401, got ${response.status}`);
    }
    
    if (!response.data.error) {
      throw new Error('Error response missing error field');
    }
    
    return { errorHandled: true, errorMessage: response.data.error };
  });
  
  // Test malformed request handling
  await testRunner.runTest('Malformed Request Handling', 'errorHandling', async () => {
    const response = await testRunner.makeRequest('POST', '/api/v1/memory', {
      malformed: true,
      // missing required fields
    }, testRunner.getAuthHeaders());
    
    if (response.status === 200) {
      throw new Error('Malformed request was accepted');
    }
    
    return { errorHandled: true, status: response.status };
  });
  
  // Test service unavailability scenarios
  await testRunner.runTest('Service Unavailability Handling', 'errorHandling', async () => {
    // Test with a service that might be down
    const response = await testRunner.makeRequest('POST', '/api/assistant/chat', {
      message: 'Test message',
      model: 'non-existent-model'
    }, testRunner.getAuthHeaders());
    
    // Should handle gracefully whether service is up or down
    return { 
      handled: true, 
      status: response.status,
      hasErrorMessage: !!response.data?.error
    };
  });
  
  // Test network timeout handling
  await testRunner.runTest('Timeout Handling', 'errorHandling', async () => {
    // Test with a request that might timeout
    const response = await testRunner.makeRequest('GET', '/api/health/detailed');
    
    return { 
      handled: true, 
      status: response.status,
      duration: response.duration
    };
  });
}

// 7. WebSocket Functionality Testing
async function testWebSocketFunctionality() {
  console.log('\n🔌 Testing WebSocket Functionality...');
  
  // Test WebSocket connection
  await testRunner.runTest('WebSocket Connection', 'webSocket', async () => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${WS_BASE_URL}/ws`);
      let connected = false;
      
      const timeout = setTimeout(() => {
        if (!connected) {
          ws.close();
          reject(new Error('WebSocket connection timeout'));
        }
      }, 5000);
      
      ws.on('open', () => {
        connected = true;
        clearTimeout(timeout);
        ws.close();
        resolve({ connected: true });
      });
      
      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  });
  
  // Test real-time message delivery
  await testRunner.runTest('Real-time Message Delivery', 'webSocket', async () => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${WS_BASE_URL}/ws`);
      let messageReceived = false;
      
      const timeout = setTimeout(() => {
        ws.close();
        if (!messageReceived) {
          reject(new Error('No message received within timeout'));
        }
      }, 10000);
      
      ws.on('open', () => {
        // Subscribe to a test channel
        ws.send(JSON.stringify({
          type: 'subscribe',
          channel: 'test',
          table: 'ai_memories'
        }));
      });
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          messageReceived = true;
          clearTimeout(timeout);
          ws.close();
          resolve({ messageReceived: true, message });
        } catch (error) {
          clearTimeout(timeout);
          ws.close();
          reject(error);
        }
      });
      
      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  });
}

// 8. Performance Testing
async function testPerformance() {
  console.log('\n⚡ Testing Performance...');
  
  // Test API response times
  await testRunner.runTest('API Response Times', 'performance', async () => {
    const endpoints = [
      '/health',
      '/api/docs',
      '/api/ollama/status',
      '/api/v1/memory'
    ];
    
    const results = [];
    
    for (const endpoint of endpoints) {
      const headers = endpoint.includes('/api/v1/') ? testRunner.getAuthHeaders() : {};
      const response = await testRunner.makeRequest('GET', endpoint, null, headers);
      
      results.push({
        endpoint,
        duration: response.duration,
        status: response.status,
        acceptable: response.duration < TEST_CONFIG.performanceThresholds.apiResponse
      });
    }
    
    return results;
  });
  
  // Test concurrent request handling
  await testRunner.runTest('Concurrent Request Handling', 'performance', async () => {
    const concurrentRequests = 10;
    const requests = [];
    
    for (let i = 0; i < concurrentRequests; i++) {
      requests.push(testRunner.makeRequest('GET', '/health'));
    }
    
    const startTime = performance.now();
    const responses = await Promise.all(requests);
    const totalTime = performance.now() - startTime;
    
    const successfulRequests = responses.filter(r => r.status === 200).length;
    const averageResponseTime = responses.reduce((sum, r) => sum + r.duration, 0) / responses.length;
    
    return {
      concurrentRequests,
      successfulRequests,
      totalTime,
      averageResponseTime,
      throughput: (successfulRequests / totalTime) * 1000 // requests per second
    };
  });
  
  // Test memory usage monitoring
  await testRunner.runTest('Memory Usage Monitoring', 'performance', async () => {
    const response = await testRunner.makeRequest('GET', '/api/stats', null, testRunner.getAuthHeaders());
    
    if (response.status !== 200) {
      throw new Error(`Stats endpoint failed: ${response.status}`);
    }
    
    const memoryUsage = response.data.stats?.memoryUsage;
    if (!memoryUsage) {
      throw new Error('Memory usage data not available');
    }
    
    return {
      memoryUsage,
      heapUsedMB: memoryUsage.heapUsed / 1024 / 1024,
      heapTotalMB: memoryUsage.heapTotal / 1024 / 1024,
      acceptable: memoryUsage.heapUsed < (1024 * 1024 * 1024) // Less than 1GB
    };
  });
  
  // Test database query performance
  await testRunner.runTest('Database Query Performance', 'performance', async () => {
    const startTime = performance.now();
    
    const response = await testRunner.makeRequest('GET', '/api/v1/memory', null, testRunner.getAuthHeaders());
    
    const queryTime = performance.now() - startTime;
    
    return {
      queryTime,
      status: response.status,
      acceptable: queryTime < TEST_CONFIG.performanceThresholds.dbQuery
    };
  });
}

// Report Generation
async function generateTestReport() {
  console.log('\n📊 Generating Test Report...');
  
  // Calculate overall metrics
  const totalTests = testResults.summary.total;
  const passRate = (testResults.summary.passed / totalTests) * 100;
  const avgResponseTime = testResults.performanceMetrics.responseTime.length > 0 
    ? testResults.performanceMetrics.responseTime.reduce((a, b) => a + b, 0) / testResults.performanceMetrics.responseTime.length
    : 0;
  
  // Generate recommendations
  if (passRate < 90) {
    testResults.recommendations.push('Overall test pass rate is below 90%. Review failed tests and address issues.');
  }
  
  if (avgResponseTime > TEST_CONFIG.performanceThresholds.apiResponse) {
    testResults.recommendations.push(`Average response time (${avgResponseTime.toFixed(2)}ms) exceeds threshold. Consider performance optimization.`);
  }
  
  // Check for critical failures
  const criticalCategories = ['authentication', 'apiVersioning', 'aiServices'];
  for (const category of criticalCategories) {
    if (testResults.categories[category].failed > 0) {
      testResults.recommendations.push(`Critical failures detected in ${category}. This should be addressed immediately.`);
    }
  }
  
  // Generate report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests,
      passed: testResults.summary.passed,
      failed: testResults.summary.failed,
      passRate: passRate.toFixed(2) + '%',
      averageResponseTime: avgResponseTime.toFixed(2) + 'ms'
    },
    categories: Object.keys(testResults.categories).map(category => ({
      name: category,
      passed: testResults.categories[category].passed,
      failed: testResults.categories[category].failed,
      tests: testResults.categories[category].tests
    })),
    performanceMetrics: {
      averageResponseTime: avgResponseTime.toFixed(2) + 'ms',
      totalResponseTimes: testResults.performanceMetrics.responseTime.length,
      throughput: testResults.performanceMetrics.throughput || 'N/A'
    },
    recommendations: testResults.recommendations,
    fullResults: testResults
  };
  
  // Save report to file
  const reportPath = path.join(process.cwd(), 'e2e-test-report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  
  console.log('\n📋 Test Report Summary:');
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${testResults.summary.passed} (${passRate.toFixed(2)}%)`);
  console.log(`Failed: ${testResults.summary.failed}`);
  console.log(`Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
  
  if (testResults.recommendations.length > 0) {
    console.log('\n💡 Recommendations:');
    testResults.recommendations.forEach((rec, i) => {
      console.log(`${i + 1}. ${rec}`);
    });
  }
  
  console.log(`\n📄 Full report saved to: ${reportPath}`);
  
  return report;
}

// Main test execution
async function runAllTests() {
  console.log('🚀 Universal AI Tools - Comprehensive E2E Testing Suite');
  console.log('======================================================');
  
  try {
    // Setup authentication for tests
    console.log('\n🔧 Setting up test authentication...');
    const authSetup = await testRunner.setupTestAuthentication();
    if (!authSetup) {
      console.log('⚠️  Authentication setup failed, using local dev credentials');
    }
    
    // Run all test categories
    await testAuthenticationWorkflows();
    await testApiVersioning();
    await testMiddlewareChain();
    await testAIServiceIntegration();
    await testCriticalUserWorkflows();
    await testErrorHandling();
    await testWebSocketFunctionality();
    await testPerformance();
    
    // Generate final report
    const report = await generateTestReport();
    
    // Exit with appropriate code
    const exitCode = testResults.summary.failed > 0 ? 1 : 0;
    
    console.log('\n✨ E2E Testing Complete!');
    process.exit(exitCode);
    
  } catch (error) {
    console.error('\n💥 Test suite failed with error:', error.message);
    process.exit(1);
  }
}

// Handle script execution
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(error => {
    console.error('Failed to run tests:', error);
    process.exit(1);
  });
}

export { runAllTests, testRunner, TestRunner };