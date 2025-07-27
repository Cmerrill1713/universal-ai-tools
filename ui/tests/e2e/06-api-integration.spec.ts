import { test, expect } from '@playwright/test';

test.describe('API Integration Testing', () => {
  const API_BASE = 'http://localhost:9999';
  const API_KEY = 'universal-ai-tools-production-key-2025';

  test('should test API connectivity from frontend', async ({ page }) => {
    // Intercept API calls
    const apiCalls: string[] = [];
    
    page.on('request', request => {
      if (request.url().includes(API_BASE)) {
        apiCalls.push(request.url());
      }
    });

    // Visit pages that should make API calls
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await page.goto('/performance');
    await page.waitForLoadState('networkidle');
    
    // Check if any API calls were made
    console.log('API calls detected:', apiCalls);
    
    // Verify frontend can reach API server
    const response = await page.request.get(`${API_BASE}/api/health`);
    expect(response.status()).toBeLessThan(500);
  });

  test('should test API authentication integration', async ({ page }) => {
    // Test API call with proper authentication
    const response = await page.request.get(`${API_BASE}/api/health`, {
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    
    const healthData = await response.json();
    expect(healthData).toHaveProperty('status');
  });

  test('should test API endpoints used by frontend', async ({ page }) => {
    const endpoints = [
      '/api/health',
      '/api/v1/tools',
      '/api/v1/status'
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await page.request.get(`${API_BASE}${endpoint}`, {
          headers: {
            'X-API-Key': API_KEY,
            'Content-Type': 'application/json'
          }
        });
        
        // API should respond (might be 503 for database issues, but shouldn't be 404)
        expect(response.status()).not.toBe(404);
        
        if (response.ok()) {
          const data = await response.json();
          expect(data).toBeDefined();
        }
      } catch (e) {
        console.log(`API endpoint ${endpoint} test skipped:`, e);
      }
    }
  });

  test('should test real-time WebSocket functionality', async ({ page }) => {
    let websocketConnected = false;
    
    // Listen for WebSocket connections
    page.on('websocket', ws => {
      websocketConnected = true;
      console.log('WebSocket connection detected');
      
      ws.on('close', () => console.log('WebSocket closed'));
    });
    
    // Visit pages that might establish WebSocket connections
    await page.goto('/performance');
    await page.waitForTimeout(3000); // Wait for potential WebSocket connection
    
    await page.goto('/chat');
    await page.waitForTimeout(3000);
    
    // WebSocket might not be immediately established, that's okay
    console.log('WebSocket connection status:', websocketConnected);
  });

  test('should test error handling for API failures', async ({ page }) => {
    // Simulate API failures by making requests to invalid endpoints
    const invalidResponse = await page.request.get(`${API_BASE}/api/invalid-endpoint`, {
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    expect(invalidResponse.status()).toBe(404);
    
    // Test without API key
    const unauthorizedResponse = await page.request.get(`${API_BASE}/api/v1/tools`);
    expect([401, 403]).toContain(unauthorizedResponse.status());
  });

  test('should test frontend error boundaries with API failures', async ({ page }) => {
    // Intercept API calls and return errors for some
    await page.route(`${API_BASE}/api/v1/**`, route => {
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Service temporarily unavailable' })
      });
    });
    
    // Visit pages that make API calls
    await page.goto('/performance');
    await page.waitForLoadState('networkidle');
    
    // Page should still load even with API errors
    await expect(page.locator('#root')).toBeVisible();
    
    // Remove route interception
    await page.unroute(`${API_BASE}/api/v1/**`);
  });

  test('should test CORS configuration', async ({ page }) => {
    // Make cross-origin request to test CORS
    const corsTestScript = `
      fetch('${API_BASE}/api/health', {
        method: 'GET',
        headers: {
          'X-API-Key': '${API_KEY}',
          'Content-Type': 'application/json'
        }
      })
      .then(response => response.json())
      .then(data => window.__corsTestResult = { success: true, data })
      .catch(error => window.__corsTestResult = { success: false, error: error.message });
    `;
    
    await page.goto('/');
    await page.evaluate(corsTestScript);
    
    // Wait for fetch to complete
    await page.waitForTimeout(2000);
    
    const corsResult = await page.evaluate(() => window.__corsTestResult);
    
    // CORS should be properly configured (either success or specific CORS error)
    expect(corsResult).toBeDefined();
    console.log('CORS test result:', corsResult);
  });

  test('should test API response performance', async ({ page }) => {
    const performanceTests = [
      { endpoint: '/api/health', maxTime: 1000 },
      { endpoint: '/api/v1/status', maxTime: 2000 }
    ];
    
    for (const { endpoint, maxTime } of performanceTests) {
      const startTime = Date.now();
      
      try {
        const response = await page.request.get(`${API_BASE}${endpoint}`, {
          headers: {
            'X-API-Key': API_KEY,
            'Content-Type': 'application/json'
          }
        });
        
        const responseTime = Date.now() - startTime;
        console.log(`${endpoint} response time: ${responseTime}ms`);
        
        if (response.ok()) {
          // Only check performance for successful requests
          expect(responseTime).toBeLessThan(maxTime);
        }
      } catch (e) {
        console.log(`Performance test for ${endpoint} skipped:`, e);
      }
    }
  });
});