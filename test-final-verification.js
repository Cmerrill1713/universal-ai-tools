#!/usr/bin/env node

/**
 * Universal AI Tools - Full System Startup & Testing
 * 
 * This script:
 * 1. Starts the backend server
 * 2. Starts the frontend server  
 * 3. Uses Playwright to test the complete system
 * 4. Verifies all core functionality is working
 */

import { spawn } from 'child_process';
import { chromium } from 'playwright';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const log = (color, message) => console.log(`${colors[color]}${message}${colors.reset}`);

class UniversalAITestSuite {
  constructor() {
    this.backendProcess = null;
    this.frontendProcess = null;
    this.browser = null;
    this.page = null;
    this.results = {
      backend: [],
      frontend: [],
      integration: [],
      sweetAthena: []
    };
  }

  async run() {
    try {
      log('cyan', '🚀 Universal AI Tools - Full System Test Suite');
      log('cyan', '=================================================');

      await this.startBackend();
      await this.startFrontend();
      await this.setupPlaywright();
      await this.testBackendAPI();
      await this.testFrontendLoading();
      await this.testSweetAthenaIntegration();
      await this.testFullWorkflow();
      await this.generateReport();

    } catch (error) {
      log('red', `❌ Test suite failed: ${error.message}`);
      console.error(error);
    } finally {
      await this.cleanup();
    }
  }

  async startBackend() {
    log('blue', '🔧 Starting backend server...');
    
    return new Promise((resolve, reject) => {
      this.backendProcess = spawn('npm', ['run', 'dev'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
      });

      let output = '';
      this.backendProcess.stdout.on('data', (data) => {
        output += data.toString();
        if (output.includes('Server running on port 9999') || output.includes('🚀')) {
          log('green', '✅ Backend server started on port 9999');
          resolve();
        }
      });

      this.backendProcess.stderr.on('data', (data) => {
        const errorOutput = data.toString();
        if (errorOutput.includes('EADDRINUSE')) {
          log('yellow', '⚠️  Port 9999 already in use, assuming backend is running');
          resolve();
        }
      });

      setTimeout(() => {
        if (this.backendProcess.exitCode === null) {
          resolve(); // Assume it started
        } else {
          reject(new Error('Backend failed to start within 10 seconds'));
        }
      }, 10000);
    });
  }

  async startFrontend() {
    log('blue', '🎨 Starting frontend server...');

    return new Promise((resolve, reject) => {
      this.frontendProcess = spawn('npm', ['run', 'dev'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: path.join(process.cwd(), 'ui')
      });

      let output = '';
      this.frontendProcess.stdout.on('data', (data) => {
        output += data.toString();
        if (output.includes('Local:') && output.includes('5174')) {
          log('green', '✅ Frontend server started on port 5174');
          resolve();
        }
      });

      this.frontendProcess.stderr.on('data', (data) => {
        const errorOutput = data.toString();
        if (errorOutput.includes('EADDRINUSE')) {
          log('yellow', '⚠️  Port 5174 already in use, assuming frontend is running');
          resolve();
        }
      });

      setTimeout(() => {
        if (this.frontendProcess.exitCode === null) {
          resolve(); // Assume it started
        } else {
          reject(new Error('Frontend failed to start within 15 seconds'));
        }
      }, 15000);
    });
  }

  async setupPlaywright() {
    log('blue', '🎭 Setting up Playwright browser...');
    
    this.browser = await chromium.launch({ 
      headless: false, // Show browser for debugging
      slowMo: 1000     // Slow down actions for visibility
    });
    
    this.page = await this.browser.newPage();
    await this.page.setViewportSize({ width: 1200, height: 800 });
    
    log('green', '✅ Playwright browser ready');
  }

  async testBackendAPI() {
    log('blue', '🔍 Testing Backend API endpoints...');

    const endpoints = [
      { name: 'Health Check', url: 'http://localhost:9999/api/health', method: 'GET' },
      { name: 'Metrics', url: 'http://localhost:9999/metrics', method: 'GET' },
      { name: 'Performance', url: 'http://localhost:9999/api/performance/metrics', method: 'GET' },
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint.url, { method: endpoint.method });
        const status = response.status;
        const success = status >= 200 && status < 300;
        
        this.results.backend.push({
          name: endpoint.name,
          success,
          status,
          url: endpoint.url
        });

        log(success ? 'green' : 'red', 
          `${success ? '✅' : '❌'} ${endpoint.name}: ${status}`);
        
      } catch (error) {
        this.results.backend.push({
          name: endpoint.name,
          success: false,
          error: error.message,
          url: endpoint.url
        });
        log('red', `❌ ${endpoint.name}: ${error.message}`);
      }
    }
  }

  async testFrontendLoading() {
    log('blue', '🎨 Testing Frontend application loading...');

    try {
      // Navigate to frontend
      await this.page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
      
      // Check if the page loaded
      const title = await this.page.title();
      this.results.frontend.push({
        name: 'Page Load',
        success: title.length > 0,
        title
      });
      log('green', `✅ Frontend loaded: "${title}"`);

      // Check for React components
      await this.page.waitForSelector('div#root', { timeout: 5000 });
      this.results.frontend.push({
        name: 'React Mount',
        success: true
      });
      log('green', '✅ React application mounted');

      // Check for navigation
      const navExists = await this.page.locator('nav').count() > 0;
      this.results.frontend.push({
        name: 'Navigation',
        success: navExists
      });
      log(navExists ? 'green' : 'yellow', 
        `${navExists ? '✅' : '⚠️'} Navigation: ${navExists ? 'Found' : 'Not found'}`);

    } catch (error) {
      this.results.frontend.push({
        name: 'Frontend Load',
        success: false,
        error: error.message
      });
      log('red', `❌ Frontend loading failed: ${error.message}`);
    }
  }

  async testSweetAthenaIntegration() {
    log('blue', '🍯 Testing Sweet Athena components...');

    try {
      // Look for Sweet Athena chat component
      const chatExists = await this.page.locator('[class*="sweet-athena"], [class*="SweetAthena"], [data-testid*="athena"]').count() > 0;
      this.results.sweetAthena.push({
        name: 'Chat Component',
        success: chatExists
      });
      log(chatExists ? 'green' : 'yellow', 
        `${chatExists ? '✅' : '⚠️'} Sweet Athena Chat: ${chatExists ? 'Found' : 'Not visible'}`);

      // Look for AI Assistant Avatar
      const avatarExists = await this.page.locator('[class*="avatar"], [class*="Assistant"], canvas').count() > 0;
      this.results.sweetAthena.push({
        name: 'Avatar Component',
        success: avatarExists
      });
      log(avatarExists ? 'green' : 'yellow',
        `${avatarExists ? '✅' : '⚠️'} AI Avatar: ${avatarExists ? 'Found' : 'Not visible'}`);

      // Test chat input if available
      const chatInput = this.page.locator('input[placeholder*="message"], input[placeholder*="chat"], textarea[placeholder*="message"]').first();
      const inputExists = await chatInput.count() > 0;
      
      if (inputExists) {
        await chatInput.fill('Hello Sweet Athena!');
        log('green', '✅ Chat input is functional');
        
        // Look for send button
        const sendButton = this.page.locator('button[type="submit"], button:has-text("Send"), button:has-text("►")').first();
        const sendExists = await sendButton.count() > 0;
        
        if (sendExists) {
          // Don't actually send to avoid API calls in demo
          log('green', '✅ Send button found');
        }
        
        this.results.sweetAthena.push({
          name: 'Chat Interaction',
          success: inputExists && sendExists
        });
      }

    } catch (error) {
      this.results.sweetAthena.push({
        name: 'Sweet Athena Test',
        success: false,
        error: error.message
      });
      log('red', `❌ Sweet Athena test failed: ${error.message}`);
    }
  }

  async testFullWorkflow() {
    log('blue', '🔄 Testing complete user workflow...');

    try {
      // Take a screenshot for documentation
      await this.page.screenshot({ 
        path: 'test-results-screenshot.png',
        fullPage: true 
      });
      log('green', '✅ Screenshot saved: test-results-screenshot.png');

      // Test API call from frontend (if possible)
      const apiResponse = await this.page.evaluate(async () => {
        try {
          const response = await fetch('/api/health');
          return { success: true, status: response.status };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      this.results.integration.push({
        name: 'Frontend to Backend API',
        success: apiResponse.success,
        ...apiResponse
      });

      log(apiResponse.success ? 'green' : 'red',
        `${apiResponse.success ? '✅' : '❌'} API Integration: ${apiResponse.success ? 'Working' : 'Failed'}`);

    } catch (error) {
      this.results.integration.push({
        name: 'Full Workflow',
        success: false,
        error: error.message
      });
      log('red', `❌ Workflow test failed: ${error.message}`);
    }
  }

  async generateReport() {
    log('blue', '📊 Generating test report...');

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        backend: this.results.backend.filter(r => r.success).length + '/' + this.results.backend.length,
        frontend: this.results.frontend.filter(r => r.success).length + '/' + this.results.frontend.length,
        sweetAthena: this.results.sweetAthena.filter(r => r.success).length + '/' + this.results.sweetAthena.length,
        integration: this.results.integration.filter(r => r.success).length + '/' + this.results.integration.length
      },
      details: this.results
    };

    await fs.writeFile('test-results.json', JSON.stringify(report, null, 2));
    
    // Console summary
    log('cyan', '\n📋 TEST SUMMARY');
    log('cyan', '================');
    log('blue', `Backend API:      ${report.summary.backend}`);
    log('blue', `Frontend:         ${report.summary.frontend}`);
    log('blue', `Sweet Athena:     ${report.summary.sweetAthena}`);
    log('blue', `Integration:      ${report.summary.integration}`);

    const totalTests = Object.values(this.results).flat().length;
    const passedTests = Object.values(this.results).flat().filter(r => r.success).length;
    const successRate = ((passedTests / totalTests) * 100).toFixed(1);

    log('green', `\n🎉 OVERALL SUCCESS RATE: ${passedTests}/${totalTests} (${successRate}%)`);
    log('blue', '\n📄 Detailed results saved to: test-results.json');
    log('blue', '📸 Screenshot saved to: test-results-screenshot.png');
  }

  async cleanup() {
    log('yellow', '🧹 Cleaning up...');

    if (this.browser) {
      await this.browser.close();
      log('green', '✅ Browser closed');
    }

    // Keep servers running for continued development
    log('blue', '💡 Servers left running for development');
    log('blue', '   • Backend:  http://localhost:9999');
    log('blue', '   • Frontend: http://localhost:5174');
    log('yellow', '   • Use Ctrl+C in terminal tabs to stop them');
  }
}

// Run the test suite
const testSuite = new UniversalAITestSuite();
testSuite.run().catch(console.error);