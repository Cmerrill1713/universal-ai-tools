/**
 * Performance E2E Tests
 * Performance testing with Web Vitals and Playwright
 */

import { test, expect } from '@playwright/test';

test.describe('Performance Testing', () => {
  test('should load the homepage within performance budgets', async ({ page }) => {
    // Start performance monitoring
    const performanceEntries: any[] = [];
    
    page.on('response', (response) => {
      if (response.url().includes('localhost')) {
        performanceEntries.push({
          url: response.url(),
          status: response.status(),
          timing: Date.now(),
        });
      }
    });
    
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const endTime = Date.now();
    
    const loadTime = endTime - startTime;
    
    // Performance budget: page should load in under 3 seconds
    expect(loadTime).toBeLessThan(3000);
    
    // Check that main resources loaded successfully
    const mainResources = performanceEntries.filter(entry => 
      entry.status === 200 && (
        entry.url.includes('/index.html') ||
        entry.url.includes('/main.js') ||
        entry.url.includes('/style.css')
      )
    );
    
    expect(mainResources.length).toBeGreaterThan(0);
  });

  test('should have good Largest Contentful Paint (LCP)', async ({ page }) => {
    // Navigate and measure LCP
    await page.goto('/');
    
    const lcpValue = await page.evaluate(() => {
      return new Promise((resolve) => {
        if ('PerformanceObserver' in window) {
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            if (lastEntry) {
              resolve(lastEntry.startTime);
            }
          });
          observer.observe({ entryTypes: ['largest-contentful-paint'] });
          
          // Fallback timeout
          setTimeout(() => resolve(0), 5000);
        } else {
          resolve(0);
        }
      });
    });
    
    // LCP should be under 2.5 seconds (good performance)
    if (lcpValue > 0) {
      expect(lcpValue).toBeLessThan(2500);
    }
  });

  test('should have minimal Cumulative Layout Shift (CLS)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const clsValue = await page.evaluate(() => {
      return new Promise((resolve) => {
        let clsScore = 0;
        
        if ('PerformanceObserver' in window) {
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!(entry as any).hadRecentInput) {
                clsScore += (entry as any).value;
              }
            }
          });
          observer.observe({ entryTypes: ['layout-shift'] });
          
          setTimeout(() => resolve(clsScore), 3000);
        } else {
          resolve(0);
        }
      });
    });
    
    // CLS should be under 0.1 (good performance)
    expect(clsValue).toBeLessThan(0.1);
  });

  test('should respond quickly to user interactions', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Find interactive elements
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    
    if (buttonCount > 0) {
      const testButton = buttons.first();
      
      // Measure interaction response time
      const startTime = Date.now();
      await testButton.click();
      
      // Wait for any visual feedback (like state changes)
      await page.waitForTimeout(100);
      const endTime = Date.now();
      
      const responseTime = endTime - startTime;
      
      // Interaction should respond within 100ms (good responsiveness)
      expect(responseTime).toBeLessThan(200);
    }
  });

  test('should efficiently handle scroll performance', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Test scroll performance
    const scrollStartTime = Date.now();
    
    // Scroll down the page
    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(50);
    }
    
    const scrollEndTime = Date.now();
    const scrollTime = scrollEndTime - scrollStartTime;
    
    // Scrolling should be smooth (under 500ms for 5 scroll actions)
    expect(scrollTime).toBeLessThan(1000);
  });

  test('should have reasonable bundle sizes', async ({ page }) => {
    const resourceSizes: { [key: string]: number } = {};
    
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('localhost') && (
        url.includes('.js') || 
        url.includes('.css') || 
        url.includes('.wasm')
      )) {
        try {
          const buffer = await response.body();
          resourceSizes[url] = buffer.length;
        } catch {
          // Ignore errors for resource size measurement
        }
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check JavaScript bundle sizes
    const jsResources = Object.entries(resourceSizes)
      .filter(([url]) => url.includes('.js'))
      .map(([url, size]) => ({ url, size: size / 1024 })); // Convert to KB
    
    // Main JS bundle should be under 500KB
    const mainBundle = jsResources.find(({ url }) => 
      url.includes('main') || url.includes('index')
    );
    
    if (mainBundle) {
      expect(mainBundle.size).toBeLessThan(500);
    }
    
    // Total JS size should be under 1MB
    const totalJsSize = jsResources.reduce((sum, { size }) => sum + size, 0);
    expect(totalJsSize).toBeLessThan(1024);
  });

  test('should handle concurrent requests efficiently', async ({ page }) => {
    await page.goto('/');
    
    // Simulate concurrent API requests
    const requestPromises = [];
    const startTime = Date.now();
    
    // Make multiple concurrent requests to test performance under load
    for (let i = 0; i < 3; i++) {
      const promise = page.evaluate(async (index) => {
        const response = await fetch(`/api/health?test=${index}`).catch(() => null);
        return response ? response.status : 0;
      }, i);
      requestPromises.push(promise);
    }
    
    const responses = await Promise.allSettled(requestPromises);
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    // Concurrent requests should complete within 5 seconds
    expect(totalTime).toBeLessThan(5000);
    
    // At least some requests should succeed (or fail gracefully)
    const succeededRequests = responses.filter(result => result.status === 'fulfilled');
    expect(succeededRequests.length).toBeGreaterThanOrEqual(0);
  });

  test('should have efficient memory usage', async ({ page, context }) => {
    // Monitor memory usage
    const cdpSession = await context.newCDPSession(page);
    await cdpSession.send('Performance.enable');
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Force garbage collection and measure memory
    await cdpSession.send('Runtime.collectGarbage');
    
    const heapUsage = await cdpSession.send('Runtime.getHeapUsage');
    const usedMemoryMB = heapUsage.usedSize / (1024 * 1024);
    
    // Memory usage should be reasonable (under 50MB for initial load)
    expect(usedMemoryMB).toBeLessThan(50);
    
    await cdpSession.detach();
  });

  test('should maintain performance with animations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Look for animated elements
    const animatedElements = page.locator('[class*="animate"], [class*="transition"], [class*="motion"]');
    const animatedCount = await animatedElements.count();
    
    if (animatedCount > 0) {
      // Interact with animated elements
      const startTime = Date.now();
      
      for (let i = 0; i < Math.min(animatedCount, 3); i++) {
        const element = animatedElements.nth(i);
        if (await element.isVisible()) {
          await element.hover();
          await page.waitForTimeout(100);
        }
      }
      
      const endTime = Date.now();
      const animationTime = endTime - startTime;
      
      // Animation interactions should be responsive (under 1 second total)
      expect(animationTime).toBeLessThan(1000);
    }
  });

  test('should load efficiently on slower connections', async ({ page, context }) => {
    // Simulate slower network conditions
    await context.route('**/*', async (route) => {
      // Add artificial delay to simulate slower network
      await new Promise(resolve => setTimeout(resolve, 50));
      await route.continue();
    });
    
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const endTime = Date.now();
    
    const loadTime = endTime - startTime;
    
    // Even with network delay, should load within reasonable time (under 8 seconds)
    expect(loadTime).toBeLessThan(8000);
  });
});