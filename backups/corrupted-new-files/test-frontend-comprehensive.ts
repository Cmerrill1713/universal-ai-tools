/**
 * Comprehensive Frontend Test Suite for Universal AI Tools
 * Tests all UI components, API integrations, and performance metrics
 */

import puppeteer from 'puppeteer';
import { performance } from 'perf_hooks';

interface TestResult {
  test: string;
  passed: boolean;
  details?: string;
  duration?: number;
}

class FrontendTestSuite {
  private browser: puppeteer.Browser | null = null;
  private page: puppeteer.Page | null = null;
  private baseUrl = 'http://localhost:9999';
  private results: TestResult[] = [];

  async setup() {
    console.log('🚀 Setting up Puppeteer browser...');
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    this.page = await this.browser.newPage();
    
    // Set viewport for consistent testing
    await this.page.setViewport({ width: 1280, height: 720 });
    
    // Enable console log collection
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('❌ Console Error:', msg.text());
      }
    });
    
    // Monitor network failures
    this.page.on('requestfailed', request => {
      console.log('❌ Request failed:', request.url());
    });
  }

  async teardown() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async runTest(testName: string, testFn: () => Promise<boolean>): Promise<void> {
    const startTime = performance.now();
    try {
      const passed = await testFn();
      const duration = performance.now() - startTime;
      this.results.push({ test: testName, passed, duration });
      console.log(`${passed ? '✅' : '❌'} ${testName} (${duration.toFixed(2)}ms)`);
    } catch (error) {
      const duration = performance.now() - startTime;
      this.results.push({ 
        test: testName, 
        passed: false, 
        details: error instanceof Error ? error.message : String(error),
        duration 
      });
      console.log(`❌ ${testName} - Error: ${error}`);
    }
  }

  // Test 1: Homepage loads successfully
  async testHomepageLoad(): Promise<boolean> {
    const response = await this.page!.goto(this.baseUrl, { waitUntil: 'networkidle2' });
    return response?.status() === 200 || response?.status() === 401; // 401 if auth required
  }

  // Test 2: API Status endpoint accessible
  async testAPIStatus(): Promise<boolean> {
    const response = await this.page!.evaluate(async () => {
      const res = await fetch('/api/v1/status');
      return { ok: res.ok, status: res.status };
    });
    return response.ok && response.status === 200;
  }

  // Test 3: Health check endpoint
  async testHealthEndpoint(): Promise<boolean> {
    const response = await this.page!.evaluate(async () => {
      const res = await fetch('/health');
      const data = await res.json();
      return { ok: res.ok, status: data.status };
    });
    return response.ok && response.status === 'healthy';
  }

  // Test 4: Smart Healing API Integration
  async testSmartHealingAPI(): Promise<boolean> {
    const response = await this.page!.evaluate(async () => {
      const res = await fetch('/api/v1/smart-healing/health');
      const data = await res.json();
      return { success: data.success, status: data.status };
    });
    return response.success && response.status === 'healthy';
  }

  // Test 5: Agents API
  async testAgentsAPI(): Promise<boolean> {
    const response = await this.page!.evaluate(async () => {
      const res = await fetch('/api/v1/agents');
      const data = await res.json();
      return { success: data.success, hasAgents: data.data?.agents?.length > 0 };
    });
    return response.success && response.hasAgents;
  }

  // Test 6: WebSocket Connection
  async testWebSocketConnection(): Promise<boolean> {
    const connected = await this.page!.evaluate(() => {
      return new Promise((resolve) => {
        const ws = new WebSocket('ws://localhost:8080/ws');
        ws.onopen = () => {
          ws.close();
          resolve(true);
        };
        ws.onerror = () => resolve(false);
        setTimeout(() => resolve(false), 3000);
      });
    });
    return connected as boolean;
  }

  // Test 7: Performance Metrics
  async testPerformanceMetrics(): Promise<boolean> {
    await this.page!.goto(this.baseUrl, { waitUntil: 'load' });
    const metrics = await this.page!.evaluate(() => {
      const perf = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: perf.domContentLoadedEventEnd - perf.domContentLoadedEventStart,
        loadComplete: perf.loadEventEnd - perf.loadEventStart,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
      };
    });
    
    console.log('  📊 Performance Metrics:');
    console.log(`    - DOM Content Loaded: ${metrics.domContentLoaded.toFixed(2)}ms`);
    console.log(`    - Load Complete: ${metrics.loadComplete.toFixed(2)}ms`);
    console.log(`    - First Contentful Paint: ${metrics.firstContentfulPaint.toFixed(2)}ms`);
    
    // Pass if FCP is under 3 seconds
    return metrics.firstContentfulPaint < 3000;
  }

  // Test 8: Console Errors Check
  async testNoConsoleErrors(): Promise<boolean> {
    const errors: string[] = [];
    this.page!.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await this.page!.goto(this.baseUrl, { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for any async errors
    
    if (errors.length > 0) {
      console.log('  ⚠️ Console errors found:', errors);
    }
    
    return errors.length === 0;
  }

  // Test 9: API Response Times
  async testAPIResponseTimes(): Promise<boolean> {
    const endpoints = [
      '/api/v1/status',
      '/api/v1/agents',
      '/api/v1/smart-healing/health'
    ];
    
    const results = await this.page!.evaluate(async (endpoints) => {
      const timings: Record<string, number> = {};
      for (const endpoint of endpoints) {
        const start = performance.now();
        await fetch(endpoint);
        timings[endpoint] = performance.now() - start;
      }
      return timings;
    }, endpoints);
    
    console.log('  ⏱️ API Response Times:');
    let allFast = true;
    for (const [endpoint, time] of Object.entries(results)) {
      console.log(`    - ${endpoint}: ${time.toFixed(2)}ms`);
      if (time > 1000) allFast = false; // Fail if any endpoint takes > 1 second
    }
    
    return allFast;
  }

  // Test 10: Memory Usage
  async testMemoryUsage(): Promise<boolean> {
    if (!this.page) return false;
    
    const metrics = await this.page.metrics();
    console.log('  💾 Memory Usage:');
    console.log(`    - JS Heap Used: ${(metrics.JSHeapUsedSize / 1024 / 1024).toFixed(2)}MB`);
    console.log(`    - JS Heap Total: ${(metrics.JSHeapTotalSize / 1024 / 1024).toFixed(2)}MB`);
    
    // Pass if heap usage is under 100MB
    return metrics.JSHeapUsedSize < 100 * 1024 * 1024;
  }

  async runAllTests() {
    console.log('🧪 Running Comprehensive Frontend Tests');
    console.log('=====================================\n');
    
    await this.setup();
    
    // Core functionality tests
    await this.runTest('Homepage Load Test', () => this.testHomepageLoad());
    await this.runTest('API Status Test', () => this.testAPIStatus());
    await this.runTest('Health Check Test', () => this.testHealthEndpoint());
    await this.runTest('Smart Healing API Test', () => this.testSmartHealingAPI());
    await this.runTest('Agents API Test', () => this.testAgentsAPI());
    await this.runTest('WebSocket Connection Test', () => this.testWebSocketConnection());
    
    // Performance tests
    await this.runTest('Performance Metrics Test', () => this.testPerformanceMetrics());
    await this.runTest('Console Errors Test', () => this.testNoConsoleErrors());
    await this.runTest('API Response Times Test', () => this.testAPIResponseTimes());
    await this.runTest('Memory Usage Test', () => this.testMemoryUsage());
    
    await this.teardown();
    
    // Summary
    console.log('\n📊 Test Results Summary');
    console.log('======================');
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const totalDuration = this.results.reduce((sum, r) => sum + (r.duration || 0), 0);
    
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏱️ Total Duration: ${totalDuration.toFixed(2)}ms`);
    console.log(`📈 Success Rate: ${((passed / this.results.length) * 100).toFixed(1)}%`);
    
    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results.filter(r => !r.passed).forEach(r => {
        console.log(`  - ${r.test}${r.details ? `: ${r.details}` : ''}`);
      });
    }
    
    return failed === 0;
  }
}

// Run the test suite
async function main() {
  const suite = new FrontendTestSuite();
  try {
    const allPassed = await suite.runAllTests();
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('Test suite failed:', error);
    process.exit(1);
  }
}

// Only run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { FrontendTestSuite };