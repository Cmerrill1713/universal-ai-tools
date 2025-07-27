#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const CONFIG = {
  outputDir: path.join(__dirname, '..', 'test-reports'),
  baseUrl: process.env.BASE_URL || 'http://localhost:9999',
  reportFormats: ['markdown', 'json', 'html'],
  testSuites: [
    {
      name: 'Phase 1 Fixes',
      script: 'tests/test-phase1-fixes.js',
      weight: 40, // Most important for production readiness
      category: 'critical',
    },
    {
      name: 'Security Validation',
      script: 'tests/test-security-validation.js',
      weight: 35, // Critical for security
      category: 'security',
    },
    {
      name: 'Performance Tests',
      script: 'test-performance-middleware.js',
      weight: 15,
      category: 'performance',
    },
    {
      name: 'Integration Tests',
      script: 'test-comprehensive-e2e.js',
      weight: 10,
      category: 'integration',
    },
  ],
  healthChecks: [
    { name: 'Server Health', endpoint: '/api/health' },
    { name: 'GraphQL', endpoint: '/graphql' },
    { name: 'Performance Metrics', endpoint: '/api/performance/metrics' },
    { name: 'Security Status', endpoint: '/api/security/status' },
  ],
};

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

class TestReportGenerator {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      overallHealth: 0,
      testSuites: [],
      healthChecks: [],
      performance: {},
      security: {},
      summary: {},
      recommendations: [],
      phase1Progress: 0,
    };

    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(CONFIG.outputDir)) {
      fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    }
  }

  log(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] ${level.toUpperCase()}:`;

    switch (level) {
      case 'info':
        console.log(`${colors.blue}${prefix}${colors.reset} ${message}`, ...args);
        break;
      case 'success':
        console.log(`${colors.green}${prefix}${colors.reset} ${message}`, ...args);
        break;
      case 'error':
        console.log(`${colors.red}${prefix}${colors.reset} ${message}`, ...args);
        break;
      case 'warn':
        console.log(`${colors.yellow}${prefix}${colors.reset} ${message}`, ...args);
        break;
      default:
        console.log(`${prefix} ${message}`, ...args);
    }
  }

  async runCommand(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        stdio: 'pipe',
        cwd: path.join(__dirname, '..'),
        ...options,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        resolve({
          code,
          stdout,
          stderr,
          success: code === 0,
        });
      });

      proc.on('error', reject);
    });
  }

  async checkServerHealth() {
    this.log('info', 'Checking server health...');
    const healthResults = [];

    for (const check of CONFIG.healthChecks) {
      try {
        const startTime = Date.now();
        const response = await axios.get(`${CONFIG.baseUrl}${check.endpoint}`, {
          timeout: 5000,
          validateStatus: () => true,
        });
        const duration = Date.now() - startTime;

        healthResults.push({
          name: check.name,
          status: response.status < 400 ? 'healthy' : 'unhealthy',
          statusCode: response.status,
          responseTime: duration,
          endpoint: check.endpoint,
        });

        this.log('success', `${check.name}: ${response.status} (${duration}ms)`);
      } catch (error) {
        healthResults.push({
          name: check.name,
          status: 'error',
          error: error.message,
          endpoint: check.endpoint,
        });
        this.log('error', `${check.name}: ${error.message}`);
      }
    }

    this.results.healthChecks = healthResults;
    return healthResults.every((check) => check.status === 'healthy');
  }

  async runTestSuite(suite) {
    this.log('info', `Running ${suite.name}...`);
    const scriptPath = path.join(__dirname, '..', suite.script);

    if (!fs.existsSync(scriptPath)) {
      this.log('warn', `Test script not found: ${suite.script}`);
      return {
        name: suite.name,
        status: 'skipped',
        reason: 'Script not found',
        weight: suite.weight,
        category: suite.category,
      };
    }

    try {
      const startTime = Date.now();
      const result = await this.runCommand('node', [scriptPath]);
      const duration = Date.now() - startTime;

      // Parse test results from output
      const testResult = this.parseTestOutput(result.stdout, result.stderr);

      return {
        name: suite.name,
        status: result.success ? 'passed' : 'failed',
        exitCode: result.code,
        duration,
        weight: suite.weight,
        category: suite.category,
        details: testResult,
        output: {
          stdout: result.stdout,
          stderr: result.stderr,
        },
      };
    } catch (error) {
      this.log('error', `Failed to run ${suite.name}: ${error.message}`);
      return {
        name: suite.name,
        status: 'error',
        error: error.message,
        weight: suite.weight,
        category: suite.category,
      };
    }
  }

  parseTestOutput(stdout, stderr) {
    const lines = stdout.split('\n');
    const result = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      coverage: null,
      details: [],
    };

    // Look for common test result patterns
    for (const line of lines) {
      // Jest/Test results patterns
      if (line.includes('Tests:')) {
        const match = line.match(/(\d+) passed.*?(\d+) failed.*?(\d+) total/);
        if (match) {
          result.passed = parseInt(match[1]);
          result.failed = parseInt(match[2]);
          result.total = parseInt(match[3]);
        }
      }

      // Coverage patterns
      if (line.includes('Coverage:') || line.includes('%')) {
        const coverageMatch = line.match(/(\d+(?:\.\d+)?)%/);
        if (coverageMatch) {
          result.coverage = parseFloat(coverageMatch[1]);
        }
      }

      // Custom test output patterns (from our test scripts)
      if (line.includes('Total Tests:')) {
        const totalMatch = line.match(/Total Tests:\s*(\d+)/);
        if (totalMatch) result.total = parseInt(totalMatch[1]);
      }

      if (line.includes('Passed:')) {
        const passedMatch = line.match(/Passed:\s*(\d+)/);
        if (passedMatch) result.passed = parseInt(passedMatch[1]);
      }

      if (line.includes('Failed:')) {
        const failedMatch = line.match(/Failed:\s*(\d+)/);
        if (failedMatch) result.failed = parseInt(failedMatch[1]);
      }

      // Security score
      if (line.includes('Security Score:')) {
        const scoreMatch = line.match(/Security Score:\s*(\d+)/);
        if (scoreMatch) {
          result.securityScore = parseInt(scoreMatch[1]);
        }
      }
    }

    return result;
  }

  async gatherPerformanceMetrics() {
    this.log('info', 'Gathering performance metrics...');

    try {
      const response = await axios.get(`${CONFIG.baseUrl}/api/performance/metrics`, {
        timeout: 5000,
      });

      this.results.performance = {
        ...response.data,
        timestamp: new Date().toISOString(),
      };

      this.log('success', 'Performance metrics collected');
    } catch (error) {
      this.log('warn', `Could not gather performance metrics: ${error.message}`);
      this.results.performance = { error: error.message };
    }
  }

  async runAllTests() {
    this.log('info', 'Starting comprehensive test run...');

    // Check server health first
    const serverHealthy = await this.checkServerHealth();
    if (!serverHealthy) {
      this.log('warn', 'Server health checks failed - some tests may not run correctly');
    }

    // Gather performance metrics
    await this.gatherPerformanceMetrics();

    // Run all test suites
    for (const suite of CONFIG.testSuites) {
      const result = await this.runTestSuite(suite);
      this.results.testSuites.push(result);
    }

    // Calculate overall health score
    this.calculateOverallHealth();

    // Generate recommendations
    this.generateRecommendations();

    // Calculate Phase 1 progress
    this.calculatePhase1Progress();
  }

  calculateOverallHealth() {
    let totalWeight = 0;
    let weightedScore = 0;

    for (const suite of this.results.testSuites) {
      if (suite.status === 'skipped') continue;

      totalWeight += suite.weight;

      let suiteScore = 0;
      if (suite.status === 'passed') {
        suiteScore = 100;
      } else if (suite.status === 'failed' && suite.details) {
        // Partial credit based on pass rate
        const passRate =
          suite.details.total > 0 ? (suite.details.passed / suite.details.total) * 100 : 0;
        suiteScore = passRate;
      }

      weightedScore += (suiteScore * suite.weight) / 100;
    }

    this.results.overallHealth = totalWeight > 0 ? (weightedScore / totalWeight) * 100 : 0;

    // Factor in health checks
    const healthyChecks = this.results.healthChecks.filter((c) => c.status === 'healthy').length;
    const healthCheckScore = (healthyChecks / this.results.healthChecks.length) * 100;

    // Weighted combination: 80% test results, 20% health checks
    this.results.overallHealth = this.results.overallHealth * 0.8 + healthCheckScore * 0.2;

    this.log('info', `Overall health score: ${this.results.overallHealth.toFixed(2)}%`);
  }

  calculatePhase1Progress() {
    const phase1Suite = this.results.testSuites.find((s) => s.name === 'Phase 1 Fixes');
    if (phase1Suite && phase1Suite.details) {
      this.results.phase1Progress =
        phase1Suite.details.total > 0
          ? (phase1Suite.details.passed / phase1Suite.details.total) * 100
          : 0;
    }
  }

  generateRecommendations() {
    const recommendations = [];

    // Critical issues
    const failedCritical = this.results.testSuites.filter(
      (s) => s.category === 'critical' && s.status === 'failed'
    );

    if (failedCritical.length > 0) {
      recommendations.push({
        priority: 'critical',
        title: 'Critical Infrastructure Issues',
        description: 'Fix all Phase 1 critical issues before proceeding',
        action: 'Run npm run test:phase1 and address all failing tests',
      });
    }

    // Security issues
    const securitySuite = this.results.testSuites.find((s) => s.category === 'security');
    if (securitySuite && securitySuite.details && securitySuite.details.securityScore < 80) {
      recommendations.push({
        priority: 'high',
        title: 'Security Vulnerabilities Detected',
        description: `Security score: ${securitySuite.details.securityScore}/100`,
        action: 'Review security validation report and fix vulnerabilities',
      });
    }

    // Performance issues
    if (this.results.performance.error) {
      recommendations.push({
        priority: 'medium',
        title: 'Performance Monitoring Unavailable',
        description: 'Cannot gather performance metrics',
        action: 'Check if performance middleware is enabled',
      });
    }

    // Health check issues
    const unhealthyChecks = this.results.healthChecks.filter((c) => c.status !== 'healthy');
    if (unhealthyChecks.length > 0) {
      recommendations.push({
        priority: 'medium',
        title: 'Service Health Issues',
        description: `${unhealthyChecks.length} services are not responding properly`,
        action: 'Check server logs and restart services if needed',
      });
    }

    // Overall health recommendations
    if (this.results.overallHealth < 35) {
      recommendations.push({
        priority: 'critical',
        title: 'System Not Production Ready',
        description: `Overall health: ${this.results.overallHealth.toFixed(1)}% (Target: 95%+)`,
        action: 'Do not deploy to production. Focus on Phase 1 completion.',
      });
    } else if (this.results.overallHealth < 80) {
      recommendations.push({
        priority: 'high',
        title: 'Significant Issues Detected',
        description: `Overall health: ${this.results.overallHealth.toFixed(1)}% (Target: 95%+)`,
        action: 'Address failing tests before considering deployment',
      });
    }

    this.results.recommendations = recommendations;
  }

  generateMarkdownReport() {
    const timestamp = new Date().toLocaleString();
    let md = `# Universal AI Tools - Comprehensive Test Report\n\n`;
    md += `**Generated:** ${timestamp}\n`;
    md += `**Overall Health Score:** ${this.results.overallHealth.toFixed(2)}%\n`;
    md += `**Phase 1 Progress:** ${this.results.phase1Progress.toFixed(2)}%\n\n`;

    // Executive Summary
    md += `## 🎯 Executive Summary\n\n`;
    const healthStatus =
      this.results.overallHealth >= 95
        ? '🟢 Excellent'
        : this.results.overallHealth >= 80
          ? '🟡 Good'
          : this.results.overallHealth >= 60
            ? '🟠 Fair'
            : '🔴 Poor';
    md += `**System Health:** ${healthStatus} (${this.results.overallHealth.toFixed(1)}%)\n\n`;

    const totalTests = this.results.testSuites.reduce((sum, s) => sum + (s.details?.total || 0), 0);
    const passedTests = this.results.testSuites.reduce(
      (sum, s) => sum + (s.details?.passed || 0),
      0
    );
    const failedTests = this.results.testSuites.reduce(
      (sum, s) => sum + (s.details?.failed || 0),
      0
    );

    md += `- **Total Tests:** ${totalTests}\n`;
    md += `- **Passed:** ${passedTests} ✅\n`;
    md += `- **Failed:** ${failedTests} ❌\n`;
    md += `- **Pass Rate:** ${totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : 0}%\n\n`;

    // Test Suite Results
    md += `## 📊 Test Suite Results\n\n`;
    md += `| Suite | Status | Score | Duration | Category |\n`;
    md += `|-------|--------|-------|----------|----------|\n`;

    for (const suite of this.results.testSuites) {
      const status =
        suite.status === 'passed'
          ? '✅ Passed'
          : suite.status === 'failed'
            ? '❌ Failed'
            : suite.status === 'skipped'
              ? '⏭️ Skipped'
              : '❌ Error';

      const score =
        suite.details?.total > 0
          ? `${((suite.details.passed / suite.details.total) * 100).toFixed(1)}%`
          : suite.status === 'passed'
            ? '100%'
            : '0%';

      const duration = suite.duration ? `${suite.duration}ms` : 'N/A';

      md += `| ${suite.name} | ${status} | ${score} | ${duration} | ${suite.category} |\n`;
    }
    md += `\n`;

    // Health Checks
    md += `## 🏥 Service Health Checks\n\n`;
    md += `| Service | Status | Response Time | Endpoint |\n`;
    md += `|---------|--------|---------------|----------|\n`;

    for (const check of this.results.healthChecks) {
      const status =
        check.status === 'healthy'
          ? '✅ Healthy'
          : check.status === 'unhealthy'
            ? '⚠️ Unhealthy'
            : '❌ Error';
      const responseTime = check.responseTime ? `${check.responseTime}ms` : 'N/A';

      md += `| ${check.name} | ${status} | ${responseTime} | ${check.endpoint} |\n`;
    }
    md += `\n`;

    // Performance Metrics
    if (this.results.performance && !this.results.performance.error) {
      md += `## ⚡ Performance Metrics\n\n`;
      md += `- **Memory Usage:** ${JSON.stringify(this.results.performance.memory || {})}\n`;
      md += `- **Request Metrics:** ${JSON.stringify(this.results.performance.requests || {})}\n`;
      md += `- **Cache Performance:** ${JSON.stringify(this.results.performance.cache || {})}\n\n`;
    }

    // Security Summary
    const securitySuite = this.results.testSuites.find((s) => s.category === 'security');
    if (securitySuite) {
      md += `## 🔒 Security Summary\n\n`;
      if (securitySuite.details?.securityScore !== undefined) {
        md += `**Security Score:** ${securitySuite.details.securityScore}/100\n\n`;
      }
      md += `- **Status:** ${securitySuite.status}\n`;
      md += `- **Tests:** ${securitySuite.details?.passed || 0}/${securitySuite.details?.total || 0} passed\n\n`;
    }

    // Recommendations
    if (this.results.recommendations.length > 0) {
      md += `## 🚨 Recommendations\n\n`;
      const criticalRecs = this.results.recommendations.filter((r) => r.priority === 'critical');
      const highRecs = this.results.recommendations.filter((r) => r.priority === 'high');
      const mediumRecs = this.results.recommendations.filter((r) => r.priority === 'medium');

      if (criticalRecs.length > 0) {
        md += `### 🔴 Critical Issues\n\n`;
        for (const rec of criticalRecs) {
          md += `**${rec.title}**\n`;
          md += `- ${rec.description}\n`;
          md += `- **Action:** ${rec.action}\n\n`;
        }
      }

      if (highRecs.length > 0) {
        md += `### 🟡 High Priority\n\n`;
        for (const rec of highRecs) {
          md += `**${rec.title}**\n`;
          md += `- ${rec.description}\n`;
          md += `- **Action:** ${rec.action}\n\n`;
        }
      }

      if (mediumRecs.length > 0) {
        md += `### 🟢 Medium Priority\n\n`;
        for (const rec of mediumRecs) {
          md += `**${rec.title}**\n`;
          md += `- ${rec.description}\n`;
          md += `- **Action:** ${rec.action}\n\n`;
        }
      }
    }

    // Phase 1 Progress Tracker
    md += `## 📈 Phase 1 Progress Tracker\n\n`;
    md += `Current Progress: ${this.results.phase1Progress.toFixed(1)}%\n\n`;
    const progressBar =
      '█'.repeat(Math.floor(this.results.phase1Progress / 5)) +
      '░'.repeat(20 - Math.floor(this.results.phase1Progress / 5));
    md += `\`${progressBar}\` ${this.results.phase1Progress.toFixed(1)}%\n\n`;

    if (this.results.phase1Progress >= 100) {
      md += `✅ **Phase 1 Complete!** Ready to proceed to Phase 2.\n\n`;
    } else if (this.results.phase1Progress >= 80) {
      md += `🟡 **Nearly Complete** - Address remaining issues before Phase 2.\n\n`;
    } else {
      md += `🔴 **More Work Needed** - Focus on completing Phase 1 before proceeding.\n\n`;
    }

    // Test Details
    md += `## 📋 Detailed Test Results\n\n`;
    for (const suite of this.results.testSuites) {
      md += `### ${suite.name}\n\n`;
      md += `- **Status:** ${suite.status}\n`;
      md += `- **Category:** ${suite.category}\n`;
      md += `- **Weight:** ${suite.weight}%\n`;

      if (suite.details) {
        md += `- **Tests:** ${suite.details.passed}/${suite.details.total} passed\n`;
        if (suite.details.coverage) {
          md += `- **Coverage:** ${suite.details.coverage}%\n`;
        }
        if (suite.details.securityScore) {
          md += `- **Security Score:** ${suite.details.securityScore}/100\n`;
        }
      }

      if (suite.duration) {
        md += `- **Duration:** ${suite.duration}ms\n`;
      }

      if (suite.error) {
        md += `- **Error:** ${suite.error}\n`;
      }

      md += `\n`;
    }

    return md;
  }

  generateHtmlReport() {
    const md = this.generateMarkdownReport();

    // Simple HTML wrapper for markdown content
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Universal AI Tools - Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; line-height: 1.6; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
        .metric { display: inline-block; margin: 10px 20px 10px 0; padding: 10px; background: #e9ecef; border-radius: 4px; }
        .status-good { color: #28a745; }
        .status-warning { color: #ffc107; }
        .status-error { color: #dc3545; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #dee2e6; padding: 12px; text-align: left; }
        th { background-color: #f8f9fa; }
        .progress-bar { width: 100%; height: 20px; background: #e9ecef; border-radius: 10px; overflow: hidden; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #dc3545 0%, #ffc107 50%, #28a745 100%); transition: width 0.3s; }
        pre { background: #f8f9fa; padding: 15px; border-radius: 4px; overflow-x: auto; }
        .recommendation { margin: 15px 0; padding: 15px; border-left: 4px solid #007bff; background: #f8f9fa; }
        .recommendation.critical { border-left-color: #dc3545; }
        .recommendation.high { border-left-color: #ffc107; }
        .recommendation.medium { border-left-color: #28a745; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Universal AI Tools - Test Report</h1>
        <div class="metric">
            <strong>Overall Health:</strong> 
            <span class="${this.results.overallHealth >= 80 ? 'status-good' : this.results.overallHealth >= 60 ? 'status-warning' : 'status-error'}">
                ${this.results.overallHealth.toFixed(2)}%
            </span>
        </div>
        <div class="metric">
            <strong>Phase 1 Progress:</strong> 
            <span class="${this.results.phase1Progress >= 100 ? 'status-good' : this.results.phase1Progress >= 80 ? 'status-warning' : 'status-error'}">
                ${this.results.phase1Progress.toFixed(2)}%
            </span>
        </div>
        <div class="metric">
            <strong>Generated:</strong> ${new Date(this.results.timestamp).toLocaleString()}
        </div>
    </div>
    
    <div class="progress-bar">
        <div class="progress-fill" style="width: ${this.results.overallHealth}%"></div>
    </div>
    
    <pre>${md.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
</body>
</html>`;

    return html;
  }

  async saveReports() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseFilename = `test-report-${timestamp}`;

    try {
      // Save markdown report
      const mdPath = path.join(CONFIG.outputDir, `${baseFilename}.md`);
      const markdownReport = this.generateMarkdownReport();
      fs.writeFileSync(mdPath, markdownReport);
      this.log('success', `Markdown report saved to: ${mdPath}`);

      // Save JSON report
      const jsonPath = path.join(CONFIG.outputDir, `${baseFilename}.json`);
      fs.writeFileSync(jsonPath, JSON.stringify(this.results, null, 2));
      this.log('success', `JSON report saved to: ${jsonPath}`);

      // Save HTML report
      const htmlPath = path.join(CONFIG.outputDir, `${baseFilename}.html`);
      const htmlReport = this.generateHtmlReport();
      fs.writeFileSync(htmlPath, htmlReport);
      this.log('success', `HTML report saved to: ${htmlPath}`);

      // Create latest symlinks
      const latestMd = path.join(CONFIG.outputDir, 'latest-report.md');
      const latestJson = path.join(CONFIG.outputDir, 'latest-report.json');
      const latestHtml = path.join(CONFIG.outputDir, 'latest-report.html');

      try {
        if (fs.existsSync(latestMd)) fs.unlinkSync(latestMd);
        if (fs.existsSync(latestJson)) fs.unlinkSync(latestJson);
        if (fs.existsSync(latestHtml)) fs.unlinkSync(latestHtml);

        fs.symlinkSync(path.basename(mdPath), latestMd);
        fs.symlinkSync(path.basename(jsonPath), latestJson);
        fs.symlinkSync(path.basename(htmlPath), latestHtml);

        this.log('success', 'Latest report symlinks created');
      } catch (error) {
        // Symlinks might not be supported on all systems
        this.log('warn', `Could not create symlinks: ${error.message}`);
      }

      return {
        markdown: mdPath,
        json: jsonPath,
        html: htmlPath,
      };
    } catch (error) {
      this.log('error', `Failed to save reports: ${error.message}`);
      throw error;
    }
  }

  printSummary() {
    console.log(`\n${colors.bold}${colors.cyan}=====================================`);
    console.log(`${colors.bold}${colors.cyan}UNIVERSAL AI TOOLS - TEST SUMMARY`);
    console.log(
      `${colors.bold}${colors.cyan}=====================================${colors.reset}\n`
    );

    const healthColor =
      this.results.overallHealth >= 80
        ? colors.green
        : this.results.overallHealth >= 60
          ? colors.yellow
          : colors.red;

    console.log(
      `${colors.bold}Overall Health Score:${colors.reset} ${healthColor}${this.results.overallHealth.toFixed(2)}%${colors.reset}`
    );
    console.log(
      `${colors.bold}Phase 1 Progress:${colors.reset} ${this.results.phase1Progress.toFixed(2)}%`
    );

    const totalTests = this.results.testSuites.reduce((sum, s) => sum + (s.details?.total || 0), 0);
    const passedTests = this.results.testSuites.reduce(
      (sum, s) => sum + (s.details?.passed || 0),
      0
    );
    const failedTests = this.results.testSuites.reduce(
      (sum, s) => sum + (s.details?.failed || 0),
      0
    );

    console.log(
      `${colors.bold}Test Results:${colors.reset} ${colors.green}${passedTests} passed${colors.reset}, ${colors.red}${failedTests} failed${colors.reset}, ${totalTests} total\n`
    );

    // Show critical recommendations
    const criticalRecs = this.results.recommendations.filter((r) => r.priority === 'critical');
    if (criticalRecs.length > 0) {
      console.log(`${colors.red}${colors.bold}🚨 CRITICAL ISSUES:${colors.reset}`);
      criticalRecs.forEach((rec) => {
        console.log(`${colors.red}• ${rec.title}${colors.reset}`);
        console.log(`  ${rec.description}`);
      });
      console.log();
    }

    // Production readiness assessment
    if (this.results.overallHealth >= 95) {
      console.log(`${colors.green}${colors.bold}✅ SYSTEM READY FOR PRODUCTION${colors.reset}`);
    } else if (this.results.overallHealth >= 80) {
      console.log(
        `${colors.yellow}${colors.bold}⚠️  SOME ISSUES DETECTED - REVIEW BEFORE DEPLOYMENT${colors.reset}`
      );
    } else {
      console.log(
        `${colors.red}${colors.bold}🔴 NOT READY FOR PRODUCTION - CRITICAL ISSUES MUST BE ADDRESSED${colors.reset}`
      );
    }
  }
}

async function main() {
  const generator = new TestReportGenerator();

  try {
    console.log(
      `${colors.bold}${colors.blue}🧪 Universal AI Tools - Comprehensive Test Report Generator${colors.reset}\n`
    );

    await generator.runAllTests();
    const reportPaths = await generator.saveReports();

    generator.printSummary();

    console.log(`\n${colors.bold}Reports Generated:${colors.reset}`);
    console.log(`• Markdown: ${reportPaths.markdown}`);
    console.log(`• JSON: ${reportPaths.json}`);
    console.log(`• HTML: ${reportPaths.html}`);

    // Exit with appropriate code for CI/CD integration
    const exitCode = generator.results.overallHealth >= 80 ? 0 : 1;
    process.exit(exitCode);
  } catch (error) {
    generator.log('error', `Test report generation failed: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { TestReportGenerator };
