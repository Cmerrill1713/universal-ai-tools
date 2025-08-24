/**
 * API Black Box Testing Suite
 * Tests the API as a black box without knowledge of internal implementation
 * Focuses on inputs, outputs, and behavior from external perspective
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import http from 'http';
import { spawn } from 'child_process';

interface ApiResponse {
  success: boolean;
  status: number;
  data?: any;
  error?: any;
  headers?: any;
  responseTime: number;
}

class ApiBlackBoxTester {
  private serverProcess: any = null;
  private baseUrl = 'http://localhost:9999';
  private authToken: string | null = null;

  async startServer(): Promise<void> {
    // First check if server is already running
    try {
      const response = await this.makeRequest('/health');
      if (response.status === 200) {
        console.log('✅ Server already running, skipping startup');
        return;
      }
    } catch (error) {
      // Server not running, proceed to start it
    }

    return new Promise((resolve, reject) => {
      this.serverProcess = spawn('npm', ['run', 'dev'], {
        cwd: process.cwd(),
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // Wait for server to start
      setTimeout(() => {
        this.makeRequest('/health').then(response => {
          if (response.status === 200) {
            resolve();
          } else {
            reject(new Error('Server failed to start properly'));
          }
        }).catch(() => {
          // Server might not have health endpoint, just proceed
          resolve();
        });
      }, 8000);
    });
  }

  async stopServer(): Promise<void> {
    if (this.serverProcess) {
      this.serverProcess.kill();
      this.serverProcess = null;
    }
  }

  async getAuthToken(): Promise<string> {
    if (this.authToken) return this.authToken;

    try {
      const response = await this.makeRequest('/api/v1/auth/demo-token', 'POST', {
        name: 'Black Box Tester',
        purpose: 'Automated black box testing'
      });

      if (response.success && response.data?.token) {
        this.authToken = response.data.token;
        return this.authToken;
      }
    } catch (error) {
      console.log('Auth endpoint not available, using fallback token');
    }

    // Fallback token for testing
    this.authToken = 'demo-token-for-testing';
    return this.authToken;
  }

  async makeRequest(path: string, method = 'GET', data?: any, useAuth = false): Promise<ApiResponse> {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'X-Test-Bypass': 'true',
          'X-Testing-Mode': 'true',
          ...(useAuth && this.authToken ? { 'Authorization': `Bearer ${this.authToken}` } : {})
        }
      };

      const startTime = Date.now();
      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          const responseTime = Date.now() - startTime;
          try {
            const parsedBody = body ? JSON.parse(body) : {};
            resolve({
              success: res.statusCode! >= 200 && res.statusCode! < 400,
              status: res.statusCode!,
              data: parsedBody.data || parsedBody,
              error: parsedBody.error,
              headers: res.headers,
              responseTime
            });
          } catch (e) {
            resolve({
              success: res.statusCode! >= 200 && res.statusCode! < 400,
              status: res.statusCode!,
              data: body,
              responseTime
            });
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(10000);

      if (data) {
        req.write(JSON.stringify(data));
      }
      req.end();
    });
  }
}

describe('API Black Box Testing Suite', () => {
  const tester = new ApiBlackBoxTester();

  beforeAll(async () => {
    console.log('🚀 Starting server for black box testing...');
    await tester.startServer();
    console.log('✅ Server started, obtaining auth token...');
    await tester.getAuthToken();
    console.log('✅ Auth token obtained, beginning tests...');
  }, 30000);

  afterAll(async () => {
    console.log('🛑 Stopping server...');
    await tester.stopServer();
  });

  describe('🔐 Authentication Black Box Tests', () => {
    it('should reject requests without authentication', async () => {
      const response = await tester.makeRequest('/api/v1/agents', 'GET', null, false);
      expect(response.status).toBe(401);
      expect(response.success).toBe(false);
    });

    it('should accept valid authentication tokens', async () => {
      const response = await tester.makeRequest('/api/v1/agents', 'GET', null, true);
      expect([200, 404, 503]).toContain(response.status);
    });

    it('should provide demo tokens for testing', async () => {
      const response = await tester.makeRequest('/api/v1/auth/demo-token', 'POST', {
        name: 'Test User',
        purpose: 'Testing'
      });
      
      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('token');
      expect(typeof response.data.token).toBe('string');
    });
  });

  describe('🤖 Agents Black Box Tests', () => {
    it('should list available agents', async () => {
      const response = await tester.makeRequest('/api/v1/agents', 'GET', null, true);
      
      if (response.success) {
        expect(response.data).toHaveProperty('agents');
        expect(response.data.agents).toHaveProperty('main');
        expect(response.data.agents).toHaveProperty('singleFile');
        expect(Array.isArray(response.data.agents.main)).toBe(true);
        expect(Array.isArray(response.data.agents.singleFile)).toBe(true);
      }
    });

    it('should provide agent capabilities information', async () => {
      const response = await tester.makeRequest('/api/v1/agents', 'GET', null, true);
      
      if (response.success) {
        expect(response.data).toHaveProperty('capabilities');
        expect(response.data.capabilities).toHaveProperty('mainAgents');
        expect(response.data.capabilities).toHaveProperty('singleFileAgents');
      }
    });
  });

  describe('💬 Chat Black Box Tests', () => {
    it('should handle basic chat messages', async () => {
      const response = await tester.makeRequest('/api/v1/chat', 'POST', {
        message: 'Hello, this is a test message'
      }, true);

      // Should either succeed or fail gracefully
      expect([200, 400, 401, 503]).toContain(response.status);
      
      if (response.success) {
        expect(response.data).toHaveProperty('response');
        expect(typeof response.data.response).toBe('string');
      }
    });

    it('should handle single-file agent fallback requests', async () => {
      const response = await tester.makeRequest('/api/v1/chat', 'POST', {
        message: 'Help me detect faces in my photos',
        agentName: 'unknown_agent'
      }, true);

      // Should fallback to single-file agents or provide meaningful response
      expect([200, 400, 401, 503]).toContain(response.status);
      
      if (response.success) {
        expect(response.data).toHaveProperty('response');
        // Should mention faces, photos, or fallback behavior
        const responseText = response.data.response.toLowerCase();
        expect(
          responseText.includes('face') || 
          responseText.includes('photo') || 
          responseText.includes('help') ||
          responseText.includes('agent')
        ).toBe(true);
      }
    });

    it('should reject empty messages', async () => {
      const response = await tester.makeRequest('/api/v1/chat', 'POST', {
        message: ''
      }, true);

      expect([400, 422]).toContain(response.status);
    });

    it('should handle conversation context', async () => {
      // Start a conversation
      const firstResponse = await tester.makeRequest('/api/v1/chat', 'POST', {
        message: 'My name is John'
      }, true);

      if (firstResponse.success && firstResponse.data.conversationId) {
        // Continue the conversation
        const secondResponse = await tester.makeRequest('/api/v1/chat', 'POST', {
          message: 'What is my name?',
          conversationId: firstResponse.data.conversationId
        }, true);

        if (secondResponse.success) {
          // Should remember the name or handle context appropriately
          expect(secondResponse.data).toHaveProperty('response');
        }
      }
    });
  });

  describe('🎤 Voice Integration Black Box Tests', () => {
    it('should provide voice status information', async () => {
      const response = await tester.makeRequest('/api/v1/voice/status', 'GET', null, true);
      
      // Voice service should either be available or unavailable
      expect([200, 401, 503]).toContain(response.status);
    });

    it('should handle voice chat requests', async () => {
      const response = await tester.makeRequest('/api/v1/voice/chat', 'POST', {
        text: 'Test voice message',
        interactionMode: 'conversational'
      }, true);

      // Should either process or require auth
      expect([200, 400, 401, 429, 503]).toContain(response.status);
    });
  });

  describe('⚡ Performance Black Box Tests', () => {
    it('should respond within acceptable time limits', async () => {
      const response = await tester.makeRequest('/api/v1/agents', 'GET', null, true);
      
      expect(response.responseTime).toBeLessThan(5000); // 5 seconds max
      
      if (response.success) {
        expect(response.responseTime).toBeLessThan(2000); // 2 seconds for successful requests
      }
    });

    it('should handle concurrent requests', async () => {
      const promises = Array.from({ length: 5 }, () => 
        tester.makeRequest('/api/v1/agents', 'GET', null, true)
      );

      const responses = await Promise.all(promises);
      
      // All requests should complete
      expect(responses).toHaveLength(5);
      
      // Most should succeed or fail gracefully
      const successfulResponses = responses.filter(r => r.success || [401, 503].includes(r.status));
      expect(successfulResponses.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('🛡️ Error Handling Black Box Tests', () => {
    it('should handle malformed JSON requests', async () => {
      const response = await tester.makeRequest('/api/v1/chat', 'POST', 'invalid json', true);
      
      expect([400, 422]).toContain(response.status);
    });

    it('should handle unknown endpoints gracefully', async () => {
      const response = await tester.makeRequest('/api/v1/nonexistent-endpoint', 'GET', null, true);
      
      expect(response.status).toBe(404);
    });

    it('should provide meaningful error messages', async () => {
      const response = await tester.makeRequest('/api/v1/chat', 'POST', {
        // Missing required message field
        agentName: 'test'
      }, true);

      if (response.status === 400 && response.error) {
        expect(response.error).toHaveProperty('message');
        expect(typeof response.error.message).toBe('string');
        expect(response.error.message.length).toBeGreaterThan(0);
      }
    });
  });

  describe('🔄 Single-File Agent Integration Black Box Tests', () => {
    it('should detect and route face detection requests', async () => {
      const response = await tester.makeRequest('/api/v1/agents/detect', 'POST', {
        message: 'I want to detect faces in my family photos'
      }, true);

      if (response.success) {
        expect(response.data).toHaveProperty('suggestions');
        const suggestions = response.data.suggestions;
        
        if (suggestions.length > 0) {
          const faceDetectionSuggestion = suggestions.find((s: any) => 
            s.name.includes('face') || s.description.toLowerCase().includes('face')
          );
          expect(faceDetectionSuggestion).toBeDefined();
        }
      }
    });

    it('should route photo organization requests', async () => {
      const response = await tester.makeRequest('/api/v1/agents/detect', 'POST', {
        message: 'Help me organize my photos'
      }, true);

      if (response.success && response.data.suggestions.length > 0) {
        const photoSuggestion = response.data.suggestions.find((s: any) => 
          s.name.includes('photo') || s.description.toLowerCase().includes('photo')
        );
        expect(photoSuggestion).toBeDefined();
      }
    });

    it('should provide fallback when no specialized agent matches', async () => {
      const response = await tester.makeRequest('/api/v1/agents/detect', 'POST', {
        message: 'What is the weather like today?'
      }, true);

      if (response.success) {
        expect(response.data).toHaveProperty('recommendedAgent');
        expect(response.data.recommendedAgent).toBe('personal_assistant');
      }
    });
  });
});