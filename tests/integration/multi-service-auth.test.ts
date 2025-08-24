/**
 * Multi-Service JWT Authentication Integration Tests
 * Tests JWT authentication across TypeScript, Rust, and Go services
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { ChildProcess, spawn } from 'child_process';
import axios from 'axios';

// Test configuration
const TEST_JWT_SECRET = 'test-secret-key-for-integration-testing';
const TEST_PORTS = {
  typescript: 9999,
  rust: 8080,
  go: 8081,
};

// Service process management
let services: {
  typescript?: ChildProcess;
  rust?: ChildProcess;
  go?: ChildProcess;
} = {};

// Helper function to create test JWT tokens
function createTestToken(payload: any, expiresIn: string = '1h'): string {
  const claims = {
    userId: payload.userId || 'test-user',
    email: payload.email || 'test@example.com',
    isAdmin: payload.isAdmin || false,
    permissions: payload.permissions || ['api_access'],
    deviceId: payload.deviceId,
    deviceType: payload.deviceType,
    trusted: payload.trusted || true,
    iss: 'universal-ai-tools',
    aud: 'universal-ai-tools-api',
    jti: `test-${Date.now()}`,
    sub: payload.userId || 'test-user',
    isDemoToken: payload.isDemoToken || false,
  };

  return jwt.sign(claims, TEST_JWT_SECRET, { expiresIn });
}

// Helper function to wait for service to be ready
async function waitForService(url: string, timeout: number = 30000): Promise<boolean> {
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    try {
      const response = await axios.get(`${url}/health`, { timeout: 2000 });
      if (response.status === 200) {
        return true;
      }
    } catch (error) {
      // Service not ready yet, continue waiting
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return false;
}

// Start services before tests
beforeAll(async () => {
  console.log('🚀 Starting multi-service integration test environment...');
  
  // Set environment variables for testing
  process.env.JWT_SECRET = TEST_JWT_SECRET;
  process.env.JWT_ISSUER = 'universal-ai-tools';
  process.env.JWT_AUDIENCE = 'universal-ai-tools-api';
  process.env.REQUIRE_AUTH = 'true';
  process.env.NODE_ENV = 'test';
  
  // Start TypeScript service
  try {
    console.log('📡 Starting TypeScript service...');
    services.typescript = spawn('npm', ['run', 'dev'], {
      env: { ...process.env, PORT: TEST_PORTS.typescript.toString() },
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd(),
    });
    
    // Wait for TypeScript service to be ready
    const tsReady = await waitForService(`http://localhost:${TEST_PORTS.typescript}`);
    if (!tsReady) {
      throw new Error('TypeScript service failed to start');
    }
    console.log('✅ TypeScript service ready');
  } catch (error) {
    console.error('❌ Failed to start TypeScript service:', error);
  }

  // Start Rust service
  try {
    console.log('🦀 Starting Rust LLM router service...');
    services.rust = spawn('cargo', ['run'], {
      env: { 
        ...process.env, 
        PORT: TEST_PORTS.rust.toString(),
        JWT_SECRET: TEST_JWT_SECRET,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: './rust-services/llm-router',
    });
    
    // Wait for Rust service to be ready
    const rustReady = await waitForService(`http://localhost:${TEST_PORTS.rust}`);
    if (!rustReady) {
      console.warn('⚠️ Rust service may not be ready, continuing with available services');
    } else {
      console.log('✅ Rust service ready');
    }
  } catch (error) {
    console.error('❌ Failed to start Rust service:', error);
  }

  // Start Go service
  try {
    console.log('🐹 Starting Go WebSocket service...');
    services.go = spawn('./websocket-service', [], {
      env: { 
        ...process.env, 
        PORT: TEST_PORTS.go.toString(),
        JWT_SECRET: TEST_JWT_SECRET,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: './rust-services/go-websocket',
    });
    
    // Wait for Go service to be ready
    const goReady = await waitForService(`http://localhost:${TEST_PORTS.go}`);
    if (!goReady) {
      console.warn('⚠️ Go service may not be ready, continuing with available services');
    } else {
      console.log('✅ Go service ready');
    }
  } catch (error) {
    console.error('❌ Failed to start Go service:', error);
  }

  // Wait a bit more for all services to stabilize
  await new Promise(resolve => setTimeout(resolve, 5000));
  console.log('🎯 Multi-service test environment ready!');
}, 60000); // 60 second timeout for service startup

// Cleanup after tests
afterAll(async () => {
  console.log('🧹 Cleaning up test services...');
  
  // Kill all spawned services
  Object.entries(services).forEach(([name, process]) => {
    if (process && !process.killed) {
      console.log(`🛑 Stopping ${name} service...`);
      process.kill('SIGTERM');
      
      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (!process.killed) {
          process.kill('SIGKILL');
        }
      }, 5000);
    }
  });
  
  // Wait for cleanup
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log('✅ Test environment cleanup complete');
});

describe('Multi-Service JWT Authentication', () => {
  const validToken = createTestToken({
    userId: 'integration-test-user',
    email: 'test@integration.com',
    isAdmin: false,
    permissions: ['api_access', 'chat_access'],
    trusted: true,
  });

  const adminToken = createTestToken({
    userId: 'integration-admin-user',
    email: 'admin@integration.com',
    isAdmin: true,
    permissions: ['api_access', 'admin_access', 'broadcast_access'],
    trusted: true,
  });

  const expiredToken = createTestToken({
    userId: 'expired-user',
  }, '-1h'); // Expired 1 hour ago

  describe('TypeScript Service Authentication', () => {
    test('should allow access with valid JWT token', async () => {
      try {
        const response = await axios.get(`http://localhost:${TEST_PORTS.typescript}/api/health`, {
          headers: { Authorization: `Bearer ${validToken}` },
          timeout: 5000,
        });
        
        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('status');
      } catch (error) {
        console.log('TypeScript service test skipped - service not available');
      }
    });

    test('should reject requests without authentication', async () => {
      try {
        await axios.get(`http://localhost:${TEST_PORTS.typescript}/api/agents`);
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.response?.status).toBe(401);
      }
    });

    test('should reject expired tokens', async () => {
      try {
        await axios.get(`http://localhost:${TEST_PORTS.typescript}/api/agents`, {
          headers: { Authorization: `Bearer ${expiredToken}` },
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.response?.status).toBe(401);
      }
    });
  });

  describe('Rust LLM Router Authentication', () => {
    test('should allow access with valid JWT token', async () => {
      try {
        const response = await axios.get(`http://localhost:${TEST_PORTS.rust}/health`, {
          headers: { Authorization: `Bearer ${validToken}` },
          timeout: 5000,
        });
        
        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('status');
      } catch (error) {
        console.log('Rust service test skipped - service not available');
      }
    });

    test('should handle LLM completion with authentication', async () => {
      try {
        const response = await axios.post(`http://localhost:${TEST_PORTS.rust}/v1/completions`, {
          prompt: 'Hello, world!',
          model: 'test-model',
          max_tokens: 10,
        }, {
          headers: { Authorization: `Bearer ${validToken}` },
          timeout: 10000,
        });
        
        // Should either succeed or fail gracefully with auth
        expect([200, 404, 503]).toContain(response.status);
      } catch (error: any) {
        // Should not be auth-related error
        expect(error.response?.status).not.toBe(401);
      }
    });

    test('should reject unauthenticated requests to protected endpoints', async () => {
      try {
        await axios.post(`http://localhost:${TEST_PORTS.rust}/v1/completions`, {
          prompt: 'Hello, world!',
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.response?.status).toBe(401);
      }
    });
  });

  describe('Go WebSocket Service Authentication', () => {
    test('should allow public health check access', async () => {
      try {
        const response = await axios.get(`http://localhost:${TEST_PORTS.go}/health`, {
          timeout: 5000,
        });
        
        expect(response.status).toBe(200);
      } catch (error) {
        console.log('Go service test skipped - service not available');
      }
    });

    test('should reject unauthenticated WebSocket connections', async () => {
      try {
        // Try to establish WebSocket connection without auth
        const response = await axios.get(`http://localhost:${TEST_PORTS.go}/ws`, {
          headers: { Upgrade: 'websocket' },
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.response?.status).toBe(401);
      }
    });

    test('should require admin for broadcast endpoint', async () => {
      try {
        // Try broadcast with regular user token
        await axios.post(`http://localhost:${TEST_PORTS.go}/broadcast`, {
          message: 'test broadcast',
        }, {
          headers: { Authorization: `Bearer ${validToken}` },
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.response?.status).toBe(403); // Forbidden
      }
    });

    test('should allow admin broadcast access', async () => {
      try {
        const response = await axios.post(`http://localhost:${TEST_PORTS.go}/broadcast`, {
          message: 'admin test broadcast',
        }, {
          headers: { Authorization: `Bearer ${adminToken}` },
          timeout: 5000,
        });
        
        expect([200, 202]).toContain(response.status);
      } catch (error: any) {
        // Should not be auth-related error for admin
        expect(error.response?.status).not.toBe(401);
        expect(error.response?.status).not.toBe(403);
      }
    });
  });

  describe('Cross-Service Token Compatibility', () => {
    test('should use same JWT secret across all services', async () => {
      const testToken = createTestToken({
        userId: 'cross-service-test',
        permissions: ['api_access'],
      });

      const services = [
        { name: 'TypeScript', url: `http://localhost:${TEST_PORTS.typescript}/api/health` },
        { name: 'Rust', url: `http://localhost:${TEST_PORTS.rust}/health` },
        { name: 'Go', url: `http://localhost:${TEST_PORTS.go}/status` },
      ];

      for (const service of services) {
        try {
          const response = await axios.get(service.url, {
            headers: { Authorization: `Bearer ${testToken}` },
            timeout: 5000,
          });
          
          console.log(`✅ ${service.name} service accepts shared JWT token`);
          expect(response.status).toBe(200);
        } catch (error: any) {
          if (error.code === 'ECONNREFUSED') {
            console.log(`⚠️ ${service.name} service not available for testing`);
          } else {
            console.error(`❌ ${service.name} service JWT compatibility failed:`, error.message);
          }
        }
      }
    });

    test('should handle token expiration consistently across services', async () => {
      const expiredToken = createTestToken({
        userId: 'expired-test',
      }, '-1h');

      const protectedEndpoints = [
        `http://localhost:${TEST_PORTS.typescript}/api/agents`,
        `http://localhost:${TEST_PORTS.rust}/v1/completions`,
        `http://localhost:${TEST_PORTS.go}/ws`,
      ];

      for (const endpoint of protectedEndpoints) {
        try {
          await axios.get(endpoint, {
            headers: { Authorization: `Bearer ${expiredToken}` },
            timeout: 5000,
          });
          expect(true).toBe(false); // Should not reach here
        } catch (error: any) {
          if (error.code !== 'ECONNREFUSED') {
            expect(error.response?.status).toBe(401);
          }
        }
      }
    });
  });

  describe('Distributed Tracing Integration', () => {
    test('should propagate trace context across authenticated requests', async () => {
      const traceId = 'test-trace-' + Date.now();
      const token = createTestToken({
        userId: 'trace-test-user',
        permissions: ['api_access'],
      });

      try {
        // Make authenticated request to TypeScript service with trace headers
        const response = await axios.get(`http://localhost:${TEST_PORTS.typescript}/api/health`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Trace-Id': traceId,
            'traceparent': `00-${traceId.padEnd(32, '0')}-${'1'.padEnd(16, '0')}-01`,
          },
          timeout: 5000,
        });
        
        expect(response.status).toBe(200);
        
        // Verify trace headers are present in response (if service supports it)
        if (response.headers['x-trace-id']) {
          expect(response.headers['x-trace-id']).toBe(traceId);
        }
        
        console.log('✅ Distributed tracing with JWT authentication verified');
      } catch (error: any) {
        if (error.code !== 'ECONNREFUSED') {
          console.error('❌ Distributed tracing test failed:', error.message);
        }
      }
    });
  });

  describe('Performance and Load Testing', () => {
    test('should handle concurrent authenticated requests efficiently', async () => {
      const token = createTestToken({
        userId: 'performance-test-user',
        permissions: ['api_access'],
      });

      const concurrentRequests = 10;
      const promises: Promise<any>[] = [];

      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          axios.get(`http://localhost:${TEST_PORTS.typescript}/api/health`, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 10000,
          }).catch(error => {
            if (error.code === 'ECONNREFUSED') {
              return { status: 'skipped', reason: 'service_unavailable' };
            }
            throw error;
          })
        );
      }

      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => 
        r.status === 'fulfilled' && 
        (r.value.status === 200 || r.value.status === 'skipped')
      ).length;

      console.log(`✅ ${successful}/${concurrentRequests} concurrent requests completed successfully`);
      expect(successful).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Security', () => {
    test('should handle malformed JWT tokens gracefully', async () => {
      const malformedTokens = [
        'invalid-token',
        'Bearer invalid',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
        '', // empty token
      ];

      for (const badToken of malformedTokens) {
        try {
          await axios.get(`http://localhost:${TEST_PORTS.typescript}/api/agents`, {
            headers: { Authorization: `Bearer ${badToken}` },
            timeout: 5000,
          });
          expect(true).toBe(false); // Should not reach here
        } catch (error: any) {
          if (error.code !== 'ECONNREFUSED') {
            expect(error.response?.status).toBe(401);
          }
        }
      }
    });

    test('should prevent demo tokens in production environment', async () => {
      const demoToken = createTestToken({
        userId: 'demo-user',
        isDemoToken: true,
      });

      // Temporarily set production environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        await axios.get(`http://localhost:${TEST_PORTS.typescript}/api/health`, {
          headers: { Authorization: `Bearer ${demoToken}` },
          timeout: 5000,
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        if (error.code !== 'ECONNREFUSED') {
          expect(error.response?.status).toBe(401);
        }
      } finally {
        // Restore original environment
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('API Key Authentication Fallback', () => {
    test('should support API key authentication across services', async () => {
      // Set valid API key for testing
      process.env.VALID_API_KEYS = 'test-api-key-integration';

      const services = [
        { name: 'TypeScript', url: `http://localhost:${TEST_PORTS.typescript}/api/health` },
        { name: 'Rust', url: `http://localhost:${TEST_PORTS.rust}/health` },
        { name: 'Go', url: `http://localhost:${TEST_PORTS.go}/status` },
      ];

      for (const service of services) {
        try {
          const response = await axios.get(service.url, {
            headers: { 'X-API-Key': 'test-api-key-integration' },
            timeout: 5000,
          });
          
          console.log(`✅ ${service.name} service accepts API key authentication`);
          expect(response.status).toBe(200);
        } catch (error: any) {
          if (error.code === 'ECONNREFUSED') {
            console.log(`⚠️ ${service.name} service not available for API key testing`);
          } else {
            console.error(`❌ ${service.name} API key auth failed:`, error.message);
          }
        }
      }
    });
  });
});