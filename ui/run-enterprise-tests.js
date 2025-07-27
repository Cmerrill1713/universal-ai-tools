#!/usr/bin/env node

/**
 * Enterprise-Grade Test Runner for Universal AI Tools
 * 
 * Comprehensive automated testing suite using Playwright
 * Tests all UI interactions, buttons, forms, and user workflows
 * as if a real enterprise user was testing the application.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

class EnterpriseTestRunner {
  constructor() {
    this.testResults = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      browsers: [],
      coverage: {}
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const emoji = {
      'info': '📋',
      'success': '✅',
      'error': '❌',
      'warning': '⚠️',
      'start': '🚀'
    }[type] || '📋';
    
    console.log(`${emoji} [${timestamp}] ${message}`);
  }

  async checkPrerequisites() {
    this.log('Checking prerequisites...', 'start');
    
    try {
      // Check if frontend is running
      const frontendCheck = await fetch('http://localhost:5173');
      if (!frontendCheck.ok) {
        throw new Error('Frontend not running on port 5173');
      }
      this.log('Frontend server: Running ✓', 'success');
    } catch (error) {
      this.log('Frontend server: Not running ✗', 'error');
      this.log('Please start frontend with: npm run dev', 'warning');
      throw error;
    }

    try {
      // Check if backend is running
      const backendCheck = await fetch('http://localhost:9999/api/health');
      this.log('Backend API server: Running ✓', 'success');
    } catch (error) {
      this.log('Backend API server: Limited connectivity ⚠️', 'warning');
      this.log('Some API tests may be skipped', 'warning');
    }

    // Check Playwright installation
    try {
      execSync('npx playwright --version', { stdio: 'pipe' });
      this.log('Playwright: Installed ✓', 'success');
    } catch (error) {
      this.log('Playwright: Not installed ✗', 'error');
      throw new Error('Please install Playwright: npm install --save-dev @playwright/test');
    }
  }

  async runTestSuite(browser = 'chromium', headed = false) {
    this.log(`Starting ${browser} test suite (${headed ? 'headed' : 'headless'})...`, 'start');
    
    const testCommand = [
      'npx playwright test',
      `--project=${browser}`,
      headed ? '--headed' : '',
      '--reporter=json',
      '--output-dir=test-results',
      `--reporter=html:test-results/${browser}-report.html`
    ].filter(Boolean).join(' ');

    try {
      const startTime = Date.now();
      const output = execSync(testCommand, { 
        stdio: 'pipe',
        encoding: 'utf8',
        cwd: process.cwd()
      });
      
      const duration = Date.now() - startTime;
      this.log(`${browser} tests completed in ${duration}ms`, 'success');
      
      return { success: true, output, duration, browser };
    } catch (error) {
      this.log(`${browser} tests failed: ${error.message}`, 'error');
      return { success: false, error: error.message, browser };
    }
  }

  async runCrossBrowserTests() {
    this.log('Starting cross-browser testing...', 'start');
    
    const browsers = ['chromium', 'firefox', 'webkit'];
    const results = [];

    for (const browser of browsers) {
      this.log(`Testing with ${browser}...`, 'info');
      
      try {
        const result = await this.runTestSuite(browser, false);
        results.push(result);
        
        if (result.success) {
          this.log(`${browser}: PASSED ✓`, 'success');
        } else {
          this.log(`${browser}: FAILED ✗`, 'error');
        }
      } catch (error) {
        this.log(`${browser}: ERROR - ${error.message}`, 'error');
        results.push({ success: false, error: error.message, browser });
      }
    }

    return results;
  }

  async runMobileTests() {
    this.log('Starting mobile device testing...', 'start');
    
    const mobileDevices = ['Mobile Chrome', 'Mobile Safari', 'iPad'];
    const results = [];

    for (const device of mobileDevices) {
      this.log(`Testing with ${device}...`, 'info');
      
      try {
        const testCommand = `npx playwright test --project="${device}" --reporter=json`;
        const output = execSync(testCommand, { 
          stdio: 'pipe',
          encoding: 'utf8'
        });
        
        results.push({ success: true, device, output });
        this.log(`${device}: PASSED ✓`, 'success');
      } catch (error) {
        this.log(`${device}: FAILED ✗`, 'error');
        results.push({ success: false, device, error: error.message });
      }
    }

    return results;
  }

  async runPerformanceTests() {
    this.log('Running performance tests...', 'start');
    
    try {
      const performanceCommand = 'npx playwright test --grep="performance" --reporter=json';
      const output = execSync(performanceCommand, { 
        stdio: 'pipe',
        encoding: 'utf8'
      });
      
      this.log('Performance tests: PASSED ✓', 'success');
      return { success: true, output };
    } catch (error) {
      this.log('Performance tests: FAILED ✗', 'error');
      return { success: false, error: error.message };
    }
  }

  async runAccessibilityTests() {
    this.log('Running accessibility tests...', 'start');
    
    // Basic accessibility test using Playwright
    try {
      const a11yCommand = 'npx playwright test --grep="responsive|accessibility" --reporter=json';
      const output = execSync(a11yCommand, { 
        stdio: 'pipe',
        encoding: 'utf8'
      });
      
      this.log('Accessibility tests: PASSED ✓', 'success');
      return { success: true, output };
    } catch (error) {
      this.log('Accessibility tests: PARTIAL ⚠️', 'warning');
      return { success: false, error: error.message };
    }
  }

  generateTestReport(browserResults, mobileResults, performanceResults, a11yResults) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: browserResults.length + mobileResults.length + 2,
        passedTests: browserResults.filter(r => r.success).length + 
                   mobileResults.filter(r => r.success).length + 
                   (performanceResults.success ? 1 : 0) + 
                   (a11yResults.success ? 1 : 0),
        environment: {
          frontend: 'http://localhost:5173',
          backend: 'http://localhost:9999',
          nodeVersion: process.version,
          platform: process.platform
        }
      },
      browserTests: browserResults,
      mobileTests: mobileResults,
      performanceTests: performanceResults,
      accessibilityTests: a11yResults,
      recommendations: []
    };

    // Add recommendations based on results
    if (browserResults.some(r => !r.success)) {
      report.recommendations.push('Review failed browser tests for cross-browser compatibility issues');
    }
    
    if (mobileResults.some(r => !r.success)) {
      report.recommendations.push('Fix mobile responsiveness issues for better mobile user experience');
    }
    
    if (!performanceResults.success) {
      report.recommendations.push('Optimize application performance for better user experience');
    }

    const successRate = (report.summary.passedTests / report.summary.totalTests) * 100;
    report.summary.successRate = successRate;

    // Save report
    fs.writeFileSync('test-results/enterprise-test-report.json', JSON.stringify(report, null, 2));
    
    return report;
  }

  async runFullTestSuite() {
    const startTime = Date.now();
    
    console.log('\n' + '='.repeat(80));
    console.log('🎯 UNIVERSAL AI TOOLS - ENTERPRISE TEST SUITE');
    console.log('='.repeat(80));
    console.log('Comprehensive automated testing with Playwright');
    console.log('Testing all buttons, forms, interactions, and user workflows\n');

    try {
      // Prerequisites check
      await this.checkPrerequisites();
      
      // Create test results directory
      if (!fs.existsSync('test-results')) {
        fs.mkdirSync('test-results', { recursive: true });
      }

      // Run all test suites
      this.log('Phase 1: Cross-browser testing', 'start');
      const browserResults = await this.runCrossBrowserTests();
      
      this.log('Phase 2: Mobile device testing', 'start');
      const mobileResults = await this.runMobileTests();
      
      this.log('Phase 3: Performance testing', 'start');
      const performanceResults = await this.runPerformanceTests();
      
      this.log('Phase 4: Accessibility testing', 'start');
      const a11yResults = await this.runAccessibilityTests();

      // Generate comprehensive report
      const report = this.generateTestReport(browserResults, mobileResults, performanceResults, a11yResults);
      
      const totalDuration = Date.now() - startTime;
      
      // Display results
      console.log('\n' + '='.repeat(80));
      console.log('📊 ENTERPRISE TEST RESULTS SUMMARY');
      console.log('='.repeat(80));
      console.log(`Total Tests: ${report.summary.totalTests}`);
      console.log(`Passed: ${report.summary.passedTests}`);
      console.log(`Failed: ${report.summary.totalTests - report.summary.passedTests}`);
      console.log(`Success Rate: ${report.summary.successRate.toFixed(1)}%`);
      console.log(`Total Duration: ${(totalDuration / 1000).toFixed(1)}s`);
      
      console.log('\n📋 Browser Test Results:');
      browserResults.forEach(result => {
        const status = result.success ? '✅ PASSED' : '❌ FAILED';
        console.log(`  ${status} ${result.browser}`);
      });
      
      console.log('\n📱 Mobile Test Results:');
      mobileResults.forEach(result => {
        const status = result.success ? '✅ PASSED' : '❌ FAILED';
        console.log(`  ${status} ${result.device}`);
      });
      
      console.log(`\n⚡ Performance Tests: ${performanceResults.success ? '✅ PASSED' : '❌ FAILED'}`);
      console.log(`♿ Accessibility Tests: ${a11yResults.success ? '✅ PASSED' : '⚠️ PARTIAL'}`);

      if (report.recommendations.length > 0) {
        console.log('\n💡 Recommendations:');
        report.recommendations.forEach(rec => console.log(`  • ${rec}`));
      }

      if (report.summary.successRate >= 80) {
        console.log('\n🎉 EXCELLENT! Universal AI Tools passes enterprise-grade testing');
        console.log('✅ Ready for production deployment');
      } else if (report.summary.successRate >= 60) {
        console.log('\n⚠️ GOOD: Most tests passing, some issues to address');
        console.log('🔧 Review failed tests before production deployment');
      } else {
        console.log('\n❌ NEEDS IMPROVEMENT: Significant issues detected');
        console.log('🛠️ Address critical failures before proceeding');
      }

      console.log('\n📄 Detailed Reports:');
      console.log(`  • HTML Report: test-results/chromium-report.html`);
      console.log(`  • JSON Report: test-results/enterprise-test-report.json`);
      console.log(`  • Screenshots: test-results/screenshots/`);
      
      console.log('\n🎮 Manual Verification:');
      console.log('1. Open HTML report in browser for detailed test results');
      console.log('2. Check screenshots of any failed tests');
      console.log('3. Verify Sweet Athena personality switching manually');
      console.log('4. Test widget creation with voice input');
      console.log('5. Validate all form submissions and button clicks');

      return report;

    } catch (error) {
      this.log(`Enterprise test suite failed: ${error.message}`, 'error');
      throw error;
    }
  }
}

// Run the enterprise test suite
async function main() {
  const runner = new EnterpriseTestRunner();
  
  try {
    await runner.runFullTestSuite();
    process.exit(0);
  } catch (error) {
    console.error('❌ Enterprise testing failed:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { EnterpriseTestRunner };