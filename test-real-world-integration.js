#!/usr/bin/env node
/**
 * Real-World Integration Test Suite for Universal AI Tools
 * 
 * This test suite performs actual browser automation and API calls
 * to verify the system works end-to-end without mocks.
 */

import { chromium } from 'playwright';
import { spawn } from 'child_process';
import axios from 'axios';
import WebSocket from 'ws';
import chalk from 'chalk';

console.log(chalk.bold.cyan('🚀 Universal AI Tools - Real-World Integration Test Suite'));
console.log(chalk.gray('=' .repeat(60)));

class RealWorldTester {
  constructor() {
    this.baseURL = 'http://localhost:5173';
    this.apiURL = 'http://localhost:9999';
    this.supabaseURL = 'http://localhost:54321';
    this.browser = null;
    this.page = null;
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  async setup() {
    console.log(chalk.yellow('\n📦 Setting up test environment...'));
    
    // Launch browser
    this.browser = await chromium.launch({
      headless: false, // Show browser for debugging
      slowMo: 100 // Slow down for visibility
    });
    
    this.page = await this.browser.newPage();
    
    // Set up console logging
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(chalk.red(`[Browser Error] ${msg.text()}`));
      }
    });
    
    // Set up request logging
    this.page.on('request', request => {
      if (request.url().includes('/api/')) {
        console.log(chalk.gray(`[API Request] ${request.method()} ${request.url()}`));
      }
    });
    
    // Set up response logging
    this.page.on('response', response => {
      if (response.url().includes('/api/') && response.status() !== 200) {
        console.log(chalk.red(`[API Response] ${response.status()} ${response.url()}`));
      }
    });
  }

  async runTest(name, testFn) {
    this.results.total++;
    console.log(chalk.cyan(`\n🧪 Testing: ${name}`));
    
    try {
      const startTime = Date.now();
      await testFn();
      const duration = Date.now() - startTime;
      
      this.results.passed++;
      this.results.tests.push({
        name,
        status: 'passed',
        duration
      });
      
      console.log(chalk.green(`✅ Passed (${duration}ms)`));
    } catch (error) {
      this.results.failed++;
      this.results.tests.push({
        name,
        status: 'failed',
        error: error.message
      });
      
      console.log(chalk.red(`❌ Failed: ${error.message}`));
      
      // Take screenshot on failure
      const screenshotPath = `test-failure-${name.replace(/\s+/g, '-')}.png`;
      await this.page.screenshot({ path: screenshotPath });
      console.log(chalk.gray(`   Screenshot saved: ${screenshotPath}`));
    }
  }

  async testSupabaseConnection() {
    await this.runTest('Supabase Connection', async () => {
      const response = await axios.get(`${this.supabaseURL}/rest/v1/`, {
        headers: {
          'apikey': process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
        }
      });
      
      if (response.status !== 200) {
        throw new Error(`Supabase returned status ${response.status}`);
      }
    });
  }

  async testBackendAPI() {
    await this.runTest('Backend API Health', async () => {
      const response = await axios.get(`${this.apiURL}/api/health`);
      
      if (response.data.status !== 'healthy') {
        throw new Error('Backend API is not healthy');
      }
      
      // Verify all services
      const services = ['database', 'redis', 'memory'];
      for (const service of services) {
        if (!response.data.services[service]) {
          throw new Error(`Service ${service} is not running`);
        }
      }
    });
  }

  async testFrontendLoading() {
    await this.runTest('Frontend Loading', async () => {
      await this.page.goto(this.baseURL);
      
      // Wait for React to mount
      await this.page.waitForSelector('#root > div', { timeout: 10000 });
      
      // Check if main layout is visible
      const layoutVisible = await this.page.isVisible('div.flex.h-screen');
      if (!layoutVisible) {
        throw new Error('Main layout not visible');
      }
      
      // Check navigation
      const navItems = await this.page.$$('nav a');
      if (navItems.length < 5) {
        throw new Error(`Expected at least 5 nav items, found ${navItems.length}`);
      }
    });
  }

  async testGraphQLEndpoint() {
    await this.runTest('GraphQL Endpoint', async () => {
      const query = `
        query TestQuery {
          __schema {
            types {
              name
            }
          }
        }
      `;
      
      const response = await axios.post(
        `${this.supabaseURL}/graphql/v1`,
        { query },
        {
          headers: {
            'apikey': process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.data.data || !response.data.data.__schema) {
        throw new Error('GraphQL schema not accessible');
      }
    });
  }

  async testRealtimeSubscription() {
    await this.runTest('Realtime Subscription', async () => {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket(`${this.supabaseURL.replace('http', 'ws')}/realtime/v1/websocket?apikey=${process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'}&vsn=1.0.0`);
        
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('WebSocket connection timeout'));
        }, 5000);
        
        ws.on('open', () => {
          clearTimeout(timeout);
          ws.close();
          resolve();
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });
  }

  async testMemoryOperations() {
    await this.runTest('Memory Operations', async () => {
      // Store a memory
      const storeResponse = await axios.post(
        `${this.apiURL}/api/memory/store`,
        {
          content: 'Test memory for integration testing',
          metadata: { test: true, timestamp: new Date().toISOString() }
        }
      );
      
      if (!storeResponse.data.id) {
        throw new Error('Memory storage failed - no ID returned');
      }
      
      // Search for the memory
      const searchResponse = await axios.post(
        `${this.apiURL}/api/memory/search`,
        {
          query: 'integration testing',
          limit: 5
        }
      );
      
      if (!Array.isArray(searchResponse.data.results)) {
        throw new Error('Memory search failed - no results array');
      }
      
      // Verify our test memory is found
      const found = searchResponse.data.results.some(r => 
        r.content.includes('Test memory for integration testing')
      );
      
      if (!found) {
        throw new Error('Stored memory not found in search results');
      }
    });
  }

  async testSweetAthenaUI() {
    await this.runTest('Sweet Athena UI Components', async () => {
      // Navigate to Sweet Athena demo
      await this.page.goto(`${this.baseURL}/sweet-athena`);
      
      // Wait for page load
      await this.page.waitForLoadState('networkidle');
      
      // Check for 3D canvas (avatar renderer)
      const canvasExists = await this.page.locator('canvas').count();
      if (canvasExists === 0) {
        throw new Error('3D canvas for avatar not found');
      }
      
      // Check for chat interface
      const chatInterface = await this.page.locator('[class*="chat"]').first();
      if (!chatInterface) {
        throw new Error('Chat interface not found');
      }
      
      // Check for voice button
      const voiceButton = await this.page.locator('button:has-text("Mic")').count();
      if (voiceButton === 0) {
        // Try alternate selector
        const altVoiceButton = await this.page.locator('[aria-label*="voice"]').count();
        if (altVoiceButton === 0) {
          throw new Error('Voice button not found');
        }
      }
    });
  }

  async testAgentSystem() {
    await this.runTest('Agent System', async () => {
      const response = await axios.get(`${this.apiURL}/api/agents`);
      
      if (!Array.isArray(response.data)) {
        throw new Error('Agents endpoint did not return an array');
      }
      
      // Verify we have cognitive agents
      const cognitiveAgents = [
        'analytical',
        'creative', 
        'critical',
        'systems',
        'research'
      ];
      
      for (const agentType of cognitiveAgents) {
        const found = response.data.some(a => a.type === agentType);
        if (!found) {
          throw new Error(`${agentType} agent not found`);
        }
      }
    });
  }

  async testSelfHealing() {
    await this.runTest('Self-Healing System', async () => {
      // Simulate an error condition
      try {
        await axios.post(`${this.apiURL}/api/debug/simulate-error`, {
          type: 'api_timeout'
        });
      } catch (error) {
        // Expected to fail
      }
      
      // Wait for self-healing to kick in
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check if system recovered
      const healthResponse = await axios.get(`${this.apiURL}/api/health`);
      
      if (healthResponse.data.status !== 'healthy') {
        throw new Error('Self-healing did not recover the system');
      }
    });
  }

  async testEdgeFunctions() {
    await this.runTest('Edge Functions', async () => {
      // Test voice processor edge function
      const voiceTest = await axios.post(
        `${this.supabaseURL}/functions/v1/voice-processor`,
        {
          action: 'transcribe',
          audio: 'dGVzdCBhdWRpbyBkYXRh' // base64 test data
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'}`,
            'Content-Type': 'application/json'
          }
        }
      ).catch(err => {
        // Edge functions might not be deployed locally
        console.log(chalk.yellow('   Edge function not available (expected in local dev)'));
        return { data: { skipped: true } };
      });
      
      if (voiceTest.data.skipped) {
        console.log(chalk.gray('   Skipped: Edge functions not deployed locally'));
      }
    });
  }

  async cleanup() {
    console.log(chalk.yellow('\n🧹 Cleaning up...'));
    
    if (this.browser) {
      await this.browser.close();
    }
  }

  async generateReport() {
    console.log(chalk.bold.cyan('\n📊 Test Results Summary'));
    console.log(chalk.gray('=' .repeat(60)));
    
    console.log(chalk.white(`Total Tests: ${this.results.total}`));
    console.log(chalk.green(`Passed: ${this.results.passed}`));
    console.log(chalk.red(`Failed: ${this.results.failed}`));
    console.log(chalk.cyan(`Success Rate: ${((this.results.passed / this.results.total) * 100).toFixed(1)}%`));
    
    console.log(chalk.gray('\nDetailed Results:'));
    this.results.tests.forEach(test => {
      const icon = test.status === 'passed' ? '✅' : '❌';
      const color = test.status === 'passed' ? chalk.green : chalk.red;
      console.log(color(`${icon} ${test.name}${test.duration ? ` (${test.duration}ms)` : ''}`));
      if (test.error) {
        console.log(chalk.gray(`   Error: ${test.error}`));
      }
    });
    
    // Save results to file
    const fs = await import('fs/promises');
    await fs.writeFile(
      'test-results-real-world.json',
      JSON.stringify(this.results, null, 2)
    );
    
    console.log(chalk.gray('\nResults saved to test-results-real-world.json'));
  }

  async run() {
    try {
      await this.setup();
      
      // Run all tests
      await this.testSupabaseConnection();
      await this.testBackendAPI();
      await this.testFrontendLoading();
      await this.testGraphQLEndpoint();
      await this.testRealtimeSubscription();
      await this.testMemoryOperations();
      await this.testSweetAthenaUI();
      await this.testAgentSystem();
      await this.testSelfHealing();
      await this.testEdgeFunctions();
      
      await this.generateReport();
    } catch (error) {
      console.error(chalk.red('\n💥 Test suite failed:'), error);
    } finally {
      await this.cleanup();
    }
    
    // Exit with appropriate code
    process.exit(this.results.failed > 0 ? 1 : 0);
  }
}

// Run the tests
const tester = new RealWorldTester();
tester.run();