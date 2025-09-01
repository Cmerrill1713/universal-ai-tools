/**
 * Functional Middleware Testing with Playwright
 * Comprehensive end-to-end testing of middleware functionality
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:9999';
const FRONTEND_URL = 'http://localhost:5173';

test.describe('Universal AI Tools - Middleware Functional Tests', () => {
  
  test.beforeAll(async () => {
    // Wait for services to be ready
    console.log('🚀 Starting middleware functional tests...');
  });

  test('Health Check Endpoint', async ({ request }) => {
    console.log('🔍 Testing health check endpoint...');
    
    const response = await request.get(`${BASE_URL}/health`);
    expect(response.status()).toBe(200);
    
    const health = await response.json();
    console.log('Health Status:', health);
    
    expect(health.status).toBe('ok');
    expect(health.services).toBeDefined();
    expect(health.agents).toBeDefined();
  });

  test('API Authentication Middleware', async ({ request }) => {
    console.log('🔐 Testing API authentication middleware...');
    
    // Test without API key - should be blocked by network auth
    const noAuthResponse = await request.get(`${BASE_URL}/api/v1/agents`);
    console.log('No Auth Response Status:', noAuthResponse.status());
    
    // Test with invalid API key
    const invalidAuthResponse = await request.get(`${BASE_URL}/api/v1/agents`, {
      headers: {
        'X-API-Key': 'invalid-key'
      }
    });
    console.log('Invalid Auth Response Status:', invalidAuthResponse.status());
    
    // Test with correct API key
    const validAuthResponse = await request.get(`${BASE_URL}/api/v1/agents`, {
      headers: {
        'X-API-Key': 'universal-ai-tools-network-2025-secure-key'
      }
    });
    console.log('Valid Auth Response Status:', validAuthResponse.status());
  });

  test('Memory Validation Middleware', async ({ request }) => {
    console.log('🧠 Testing memory validation middleware...');
    
    // Test memory creation with validation
    const memoryData = {
      type: 'user_interaction',
      content: 'Test memory for validation',
      metadata: {
        source: 'playwright_test',
        timestamp: new Date().toISOString()
      },
      tags: ['test', 'validation'],
      importance: 0.7
    };
    
    const createResponse = await request.post(`${BASE_URL}/api/v1/memory`, {
      headers: {
        'X-API-Key': 'universal-ai-tools-network-2025-secure-key',
        'Content-Type': 'application/json'
      },
      data: memoryData
    });
    
    console.log('Memory Creation Status:', createResponse.status());
    
    if (createResponse.status() !== 200) {
      const errorData = await createResponse.json();
      console.log('Memory Creation Error:', errorData);
    }
  });

  test('CORS Middleware', async ({ request }) => {
    console.log('🌐 Testing CORS middleware...');
    
    // Test preflight request
    const preflightResponse = await request.fetch(`${BASE_URL}/api/v1/health`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:5173',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });
    
    console.log('Preflight Response Status:', preflightResponse.status());
    console.log('CORS Headers:', preflightResponse.headers());
  });

  test('Rate Limiting Middleware', async ({ request }) => {
    console.log('⚡ Testing rate limiting middleware...');
    
    // Make multiple rapid requests to test rate limiting
    const requests = [];
    for (let i = 0; i < 10; i++) {
      requests.push(
        request.get(`${BASE_URL}/health`, {
          headers: {
            'X-API-Key': 'universal-ai-tools-network-2025-secure-key'
          }
        })
      );
    }
    
    const responses = await Promise.all(requests);
    const statusCodes = responses.map(r => r.status());
    console.log('Rate Limit Status Codes:', statusCodes);
    
    // Check if any requests were rate limited (429 status)
    const rateLimited = statusCodes.filter(code => code === 429);
    console.log('Rate Limited Requests:', rateLimited.length);
  });

  test('Error Handling Middleware', async ({ request }) => {
    console.log('❌ Testing error handling middleware...');
    
    // Test non-existent endpoint
    const notFoundResponse = await request.get(`${BASE_URL}/api/non-existent-endpoint`);
    console.log('404 Response Status:', notFoundResponse.status());
    expect(notFoundResponse.status()).toBe(404);
    
    const notFoundData = await notFoundResponse.json();
    console.log('404 Error Response:', notFoundData);
    expect(notFoundData.success).toBe(false);
    expect(notFoundData.error).toBeDefined();
  });

  test('Frontend Integration', async ({ page }) => {
    console.log('🎨 Testing frontend integration...');
    
    // Navigate to frontend
    await page.goto(FRONTEND_URL);
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check if page loads without errors
    const title = await page.title();
    console.log('Frontend Title:', title);
    
    // Check for JavaScript errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Wait a moment to capture any console errors
    await page.waitForTimeout(2000);
    
    if (errors.length > 0) {
      console.log('Frontend Errors:', errors);
    }
    
    // Check if the main container exists
    const mainContainer = await page.locator('body').first();
    await expect(mainContainer).toBeVisible();
  });

  test('WebSocket Connection', async ({ page }) => {
    console.log('🔌 Testing WebSocket connection...');
    
    await page.goto(FRONTEND_URL);
    
    // Test WebSocket connection by injecting JavaScript
    const wsTest = await page.evaluate(async () => {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket('ws://localhost:8080/ws');
        
        ws.onopen = () => {
          resolve({ status: 'connected', url: ws.url });
          ws.close();
        };
        
        ws.onerror = (error) => {
          resolve({ status: 'error', error: error.toString() });
        };
        
        ws.onclose = () => {
          resolve({ status: 'closed' });
        };
        
        // Timeout after 5 seconds
        setTimeout(() => {
          if (ws.readyState === WebSocket.CONNECTING) {
            ws.close();
            resolve({ status: 'timeout' });
          }
        }, 5000);
      });
    });
    
    console.log('WebSocket Test Result:', wsTest);
  });

  test('Agent System Integration', async ({ request }) => {
    console.log('🤖 Testing agent system integration...');
    
    // Test agent listing
    const agentsResponse = await request.get(`${BASE_URL}/api/v1/agents`, {
      headers: {
        'X-API-Key': 'universal-ai-tools-network-2025-secure-key'
      }
    });
    
    console.log('Agents Response Status:', agentsResponse.status());
    
    if (agentsResponse.status() === 200) {
      const agentsData = await agentsResponse.json();
      console.log('Available Agents:', agentsData);
    } else {
      const errorData = await agentsResponse.json();
      console.log('Agents Error:', errorData);
    }
  });

  test('LLM Integration Test', async ({ request }) => {
    console.log('🧠 Testing LLM integration...');
    
    // Test LLM router endpoint
    const llmTestData = {
      prompt: 'Hello, this is a test message',
      provider: 'ollama',
      model: 'llama3.2:3b',
      maxTokens: 100
    };
    
    const llmResponse = await request.post(`${BASE_URL}/api/v1/llm/chat`, {
      headers: {
        'X-API-Key': 'universal-ai-tools-network-2025-secure-key',
        'Content-Type': 'application/json'
      },
      data: llmTestData
    });
    
    console.log('LLM Response Status:', llmResponse.status());
    
    if (llmResponse.status() === 200) {
      const llmData = await llmResponse.json();
      console.log('LLM Response:', llmData);
    } else {
      const errorData = await llmResponse.json();
      console.log('LLM Error:', errorData);
    }
  });

  test('Vision System Test', async ({ request }) => {
    console.log('👁️ Testing vision system...');
    
    // Test vision health endpoint
    const visionResponse = await request.get(`${BASE_URL}/api/v1/vision/health`, {
      headers: {
        'X-API-Key': 'universal-ai-tools-network-2025-secure-key'
      }
    });
    
    console.log('Vision Health Status:', visionResponse.status());
    
    if (visionResponse.status() === 200) {
      const visionData = await visionResponse.json();
      console.log('Vision System Status:', visionData);
    }
  });
});

test.describe('Middleware Error Analysis', () => {
  test('Comprehensive Error Detection', async ({ request, page }) => {
    console.log('🔍 Running comprehensive error detection...');
    
    const results = {
      endpoints: {},
      frontend: {},
      integration: {}
    };
    
    // Test critical endpoints
    const criticalEndpoints = [
      '/health',
      '/api/v1/agents',
      '/api/v1/memory',
      '/api/v1/llm/health',
      '/api/v1/vision/health'
    ];
    
    for (const endpoint of criticalEndpoints) {
      try {
        const response = await request.get(`${BASE_URL}${endpoint}`, {
          headers: {
            'X-API-Key': 'universal-ai-tools-network-2025-secure-key'
          }
        });
        
        const responseData = response.ok() ? await response.json() : null;
        results.endpoints[endpoint] = {
          status: response.status(),
          ok: response.ok(),
          data: responseData,
          contentType: response.headers()['content-type']
        };
        
        console.log(`✅ ${endpoint}: ${response.status()}`);
      } catch (error) {
        results.endpoints[endpoint] = {
          error: error.message,
          status: 'failed'
        };
        console.log(`❌ ${endpoint}: ${error.message}`);
      }
    }
    
    // Test frontend loading
    try {
      await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
      
      const errors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      await page.waitForTimeout(3000);
      
      results.frontend = {
        loaded: true,
        errors: errors,
        title: await page.title()
      };
      
      console.log('✅ Frontend loaded successfully');
      if (errors.length > 0) {
        console.log('⚠️ Frontend errors:', errors);
      }
    } catch (error) {
      results.frontend = {
        loaded: false,
        error: error.message
      };
      console.log('❌ Frontend failed to load:', error.message);
    }
    
    // Generate final report
    console.log('\n🎯 COMPREHENSIVE ERROR ANALYSIS REPORT');
    console.log('=====================================');
    console.log(JSON.stringify(results, null, 2));
    
    // Create summary
    const workingEndpoints = Object.values(results.endpoints).filter(r => r.ok).length;
    const totalEndpoints = Object.keys(results.endpoints).length;
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`- Working Endpoints: ${workingEndpoints}/${totalEndpoints}`);
    console.log(`- Frontend Status: ${results.frontend.loaded ? 'Working' : 'Failed'}`);
    console.log(`- Frontend Errors: ${results.frontend.errors?.length || 0}`);
    
    // Fail test if critical systems are down
    expect(workingEndpoints).toBeGreaterThan(totalEndpoints * 0.6); // At least 60% working
  });
});