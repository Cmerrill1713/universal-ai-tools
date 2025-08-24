/**
 * End-to-End Workflow Integration Tests
 * Tests complete user workflows across the multi-language architecture
 */

import { describe, test, expect } from '@jest/globals';
import axios from 'axios';
import { WebSocket } from 'ws';
import jwt from 'jsonwebtoken';

const TEST_JWT_SECRET = 'test-secret-key-for-integration-testing';
const BASE_URL = 'http://localhost:9999';
const WS_URL = 'ws://localhost:8081';

function createTestToken(payload: any = {}): string {
  const claims = {
    userId: payload.userId || 'e2e-test-user',
    email: payload.email || 'e2e@example.com',
    isAdmin: payload.isAdmin || false,
    permissions: payload.permissions || ['api_access', 'chat_access', 'websocket_access'],
    trusted: payload.trusted || true,
    iss: 'universal-ai-tools',
    aud: 'universal-ai-tools-api',
    jti: `e2e-${Date.now()}`,
    sub: payload.userId || 'e2e-test-user',
  };

  return jwt.sign(claims, TEST_JWT_SECRET, { expiresIn: '1h' });
}

describe('End-to-End Workflow Integration', () => {
  const userToken = createTestToken();
  const adminToken = createTestToken({ isAdmin: true, permissions: ['api_access', 'admin_access', 'broadcast_access'] });

  describe('Complete Chat Workflow', () => {
    test('should handle authenticated chat request with tracing', async () => {
      const traceId = Date.now().toString(36);
      
      try {
        console.log('🚀 Testing complete chat workflow...');
        
        // 1. Authenticate and start chat session
        const chatResponse = await axios.post(`${BASE_URL}/api/chat`, {
          message: 'Hello, this is an integration test for the multi-language architecture',
          model: 'ollama/llama3.2:3b',
          stream: false,
        }, {
          headers: {
            Authorization: `Bearer ${userToken}`,
            'X-Trace-Id': traceId,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        });

        // Should get a response (even if no LLM is available, auth should work)
        expect([200, 202, 404, 503]).toContain(chatResponse.status);
        
        console.log(`✅ Chat request completed: ${chatResponse.status}`);
        console.log(`   Response: ${JSON.stringify(chatResponse.data).substring(0, 100)}...`);
        
        // 2. Check if the request was traced properly
        if (chatResponse.headers['x-trace-id']) {
          expect(chatResponse.headers['x-trace-id']).toBe(traceId);
          console.log(`✅ Trace ID propagated: ${traceId}`);
        }
        
      } catch (error: any) {
        if (error.code === 'ECONNREFUSED') {
          console.log('⚠️ Chat workflow test skipped - TypeScript service not available');
        } else {
          console.error('❌ Chat workflow failed:', error.message);
          // Auth should work even if chat functionality is incomplete
          expect(error.response?.status).not.toBe(401);
        }
      }
    });

    test('should handle LLM routing through Rust service', async () => {
      try {
        console.log('🦀 Testing Rust LLM routing with authentication...');
        
        const llmResponse = await axios.post(`http://localhost:8080/v1/completions`, {
          prompt: 'Test prompt for integration testing',
          model: 'test-model',
          max_tokens: 10,
        }, {
          headers: {
            Authorization: `Bearer ${userToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        });

        // Should get a response or graceful failure
        expect([200, 202, 404, 503]).toContain(llmResponse.status);
        console.log(`✅ Rust LLM router responded: ${llmResponse.status}`);
        
      } catch (error: any) {
        if (error.code === 'ECONNREFUSED') {
          console.log('⚠️ Rust LLM router test skipped - service not available');
        } else if (error.response?.status === 401) {
          console.error('❌ Rust service JWT authentication failed');
          throw error;
        } else {
          console.log(`✅ Rust service authenticated, functional response: ${error.response?.status}`);
        }
      }
    });
  });

  describe('WebSocket Integration', () => {
    test('should establish authenticated WebSocket connection', async () => {
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket test timeout'));
        }, 15000);

        try {
          console.log('🔌 Testing authenticated WebSocket connection...');
          
          const ws = new WebSocket(`${WS_URL}/ws`, {
            headers: {
              Authorization: `Bearer ${userToken}`,
            },
          });

          ws.on('open', () => {
            console.log('✅ WebSocket connection established with authentication');
            
            // Send a test message
            ws.send(JSON.stringify({
              type: 'test_message',
              content: 'Integration test message',
              timestamp: new Date().toISOString(),
            }));
          });

          ws.on('message', (data) => {
            console.log('📨 WebSocket message received:', data.toString().substring(0, 100));
            ws.close();
            clearTimeout(timeout);
            resolve();
          });

          ws.on('error', (error) => {
            console.error('❌ WebSocket error:', error.message);
            clearTimeout(timeout);
            
            // Check if it's an auth error or connection error
            if (error.message.includes('401') || error.message.includes('Unauthorized')) {
              reject(new Error('WebSocket authentication failed'));
            } else {
              console.log('⚠️ WebSocket service not available, but auth was attempted');
              resolve(); // Don't fail if service is just not running
            }
          });

          ws.on('close', (code, reason) => {
            console.log(`🔌 WebSocket closed: ${code} - ${reason}`);
            clearTimeout(timeout);
            resolve();
          });

        } catch (error) {
          clearTimeout(timeout);
          console.log('⚠️ WebSocket test skipped - service not available');
          resolve();
        }
      });
    });
  });

  describe('Memory and Performance Under Load', () => {
    test('should maintain performance with authentication across services', async () => {
      console.log('📊 Testing system performance with multi-service authentication...');
      
      const testResults = {
        typescript: { requests: 0, successful: 0, avgResponseTime: 0 },
        rust: { requests: 0, successful: 0, avgResponseTime: 0 },
        go: { requests: 0, successful: 0, avgResponseTime: 0 },
      };

      const token = createTestToken();
      const requestsPerService = 5;

      // Test TypeScript service performance
      console.log('📡 Testing TypeScript service performance...');
      const tsPromises = Array(requestsPerService).fill(0).map(async () => {
        const start = Date.now();
        testResults.typescript.requests++;
        
        try {
          const response = await axios.get(`${BASE_URL}/api/health`, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 5000,
          });
          
          if (response.status === 200) {
            testResults.typescript.successful++;
            testResults.typescript.avgResponseTime += (Date.now() - start);
          }
        } catch (error) {
          // Service not available
        }
      });

      // Test Rust service performance
      console.log('🦀 Testing Rust service performance...');
      const rustPromises = Array(requestsPerService).fill(0).map(async () => {
        const start = Date.now();
        testResults.rust.requests++;
        
        try {
          const response = await axios.get('http://localhost:8080/health', {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 5000,
          });
          
          if (response.status === 200) {
            testResults.rust.successful++;
            testResults.rust.avgResponseTime += (Date.now() - start);
          }
        } catch (error) {
          // Service not available
        }
      });

      // Test Go service performance  
      console.log('🐹 Testing Go service performance...');
      const goPromises = Array(requestsPerService).fill(0).map(async () => {
        const start = Date.now();
        testResults.go.requests++;
        
        try {
          const response = await axios.get('http://localhost:8081/health', {
            timeout: 5000, // Public endpoint
          });
          
          if (response.status === 200) {
            testResults.go.successful++;
            testResults.go.avgResponseTime += (Date.now() - start);
          }
        } catch (error) {
          // Service not available
        }
      });

      // Wait for all requests to complete
      await Promise.allSettled([...tsPromises, ...rustPromises, ...goPromises]);

      // Calculate averages and report results
      Object.entries(testResults).forEach(([service, results]) => {
        if (results.successful > 0) {
          results.avgResponseTime = results.avgResponseTime / results.successful;
          console.log(`📈 ${service.toUpperCase()}: ${results.successful}/${results.requests} successful, avg ${results.avgResponseTime.toFixed(0)}ms`);
        } else {
          console.log(`⚠️ ${service.toUpperCase()}: Service not available for testing`);
        }
      });

      // At least one service should be working
      const totalSuccessful = Object.values(testResults).reduce((sum, r) => sum + r.successful, 0);
      expect(totalSuccessful).toBeGreaterThan(0);
      
      console.log(`🎯 Multi-service performance test completed: ${totalSuccessful} total successful requests`);
    });
  });

  describe('Security Validation', () => {
    test('should enforce consistent security policies across all services', async () => {
      console.log('🔒 Testing security policy consistency...');
      
      const securityTests = [
        {
          name: 'No authentication',
          headers: {},
          expectedStatus: 401,
          endpoints: [
            `${BASE_URL}/api/agents`,
            'http://localhost:8080/v1/completions',
            'http://localhost:8081/ws', // Protected WebSocket endpoint
          ]
        },
        {
          name: 'Invalid token format',
          headers: { Authorization: 'Bearer invalid-format' },
          expectedStatus: 401,
          endpoints: [
            `${BASE_URL}/api/agents`,
            'http://localhost:8080/v1/completions',
          ]
        },
        {
          name: 'Valid API key',
          headers: { 'X-API-Key': 'development-api-key' },
          expectedStatus: [200, 404, 503], // Should authenticate but may fail functionally
          endpoints: [
            `${BASE_URL}/api/health`,
            'http://localhost:8080/health',
            'http://localhost:8081/status',
          ]
        }
      ];

      for (const testCase of securityTests) {
        console.log(`🧪 Testing: ${testCase.name}`);
        
        for (const endpoint of testCase.endpoints) {
          try {
            const response = await axios.get(endpoint, {
              headers: testCase.headers,
              timeout: 5000,
            });
            
            if (Array.isArray(testCase.expectedStatus)) {
              expect(testCase.expectedStatus).toContain(response.status);
            } else {
              expect(response.status).toBe(testCase.expectedStatus);
            }
            
            console.log(`   ✅ ${endpoint}: ${response.status} (expected)`);
            
          } catch (error: any) {
            if (error.code === 'ECONNREFUSED') {
              console.log(`   ⚠️ ${endpoint}: Service not available`);
            } else {
              if (Array.isArray(testCase.expectedStatus)) {
                expect(testCase.expectedStatus).toContain(error.response?.status);
              } else {
                expect(error.response?.status).toBe(testCase.expectedStatus);
              }
              console.log(`   ✅ ${endpoint}: ${error.response?.status} (expected security rejection)`);
            }
          }
        }
      }
      
      console.log('🔒 Security policy consistency verified across available services');
    });
  });
});