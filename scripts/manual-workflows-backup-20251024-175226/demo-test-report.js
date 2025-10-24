#!/usr/bin/env node

import { TestReportGenerator } from './generate-test-report.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Demo script showing how to use the Test Report Generator
 * This creates sample test data and generates reports without running actual tests
 */

class DemoTestReportGenerator extends TestReportGenerator {
  constructor() {
    super();
    console.log('🎬 Running Test Report Generator Demo');
  }

  // Override to provide demo data instead of running real tests
  async runTestSuite(suite) {
    console.log(`📝 Generating demo data for: ${suite.name}`);

    // Simulate test execution time
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Generate realistic demo results based on suite type
    const demoResults = this.generateDemoResults(suite);

    return {
      name: suite.name,
      status: demoResults.status,
      duration: demoResults.duration,
      weight: suite.weight,
      category: suite.category,
      details: demoResults.details,
    };
  }

  // Override to provide demo health check data
  async checkServerHealth() {
    console.log('🏥 Generating demo health check data');

    this.results.healthChecks = [
      {
        name: 'Server Health',
        status: 'healthy',
        statusCode: 200,
        responseTime: 45,
        endpoint: '/api/health',
      },
      {
        name: 'GraphQL',
        status: 'healthy',
        statusCode: 200,
        responseTime: 120,
        endpoint: '/graphql',
      },
      {
        name: 'Performance Metrics',
        status: 'healthy',
        statusCode: 200,
        responseTime: 67,
        endpoint: '/api/performance/metrics',
      },
      {
        name: 'Security Status',
        status: 'unhealthy',
        statusCode: 503,
        responseTime: 89,
        endpoint: '/api/security/status',
      },
    ];

    return true;
  }

  // Override to provide demo performance data
  async gatherPerformanceMetrics() {
    console.log('📊 Generating demo performance metrics');

    this.results.performance = {
      memory: {
        used: 234567890,
        total: 1073741824,
        percentage: 21.8,
      },
      requests: {
        total: 15420,
        successful: 15234,
        failed: 186,
        averageResponseTime: 89,
      },
      cache: {
        hits: 8934,
        misses: 1234,
        hitRate: 87.9,
      },
      timestamp: new Date().toISOString(),
    };
  }

  generateDemoResults(suite) {
    // Create realistic demo data based on suite characteristics
    const scenarios = {
      'Phase 1 Fixes': {
        status: 'failed',
        duration: 2340,
        details: {
          total: 15,
          passed: 12,
          failed: 3,
          coverage: 78.5,
        },
      },
      'Security Validation': {
        status: 'failed',
        duration: 3210,
        details: {
          total: 22,
          passed: 18,
          failed: 4,
          securityScore: 73,
        },
      },
      'Performance Tests': {
        status: 'passed',
        duration: 1850,
        details: {
          total: 8,
          passed: 8,
          failed: 0,
          coverage: 92.1,
        },
      },
      'Integration Tests': {
        status: 'passed',
        duration: 4560,
        details: {
          total: 12,
          passed: 11,
          failed: 1,
          coverage: 85.3,
        },
      },
    };

    return (
      scenarios[suite.name] || {
        status: 'passed',
        duration: 1000,
        details: {
          total: 10,
          passed: 9,
          failed: 1,
          coverage: 80,
        },
      }
    );
  }
}

async function runDemo() {
  console.log(`
🎭 Universal AI Tools - Test Report Generator Demo
=================================================

This demo shows how the test report generator works by creating
sample test data and generating all report formats.

Generated reports will show:
- Mixed test results (some passing, some failing)
- Realistic performance metrics
- Security assessment with vulnerabilities
- Production readiness analysis
- Phase 1 progress tracking

`);

  try {
    const demo = new DemoTestReportGenerator();

    console.log('🔄 Running demo test suite...\n');
    await demo.runAllTests();

    console.log('💾 Generating demo reports...\n');
    const reportPaths = await demo.saveReports();

    demo.printSummary();

    console.log(`\n📄 Demo Reports Generated:`);
    console.log(`• Markdown: ${reportPaths.markdown}`);
    console.log(`• JSON: ${reportPaths.json}`);
    console.log(`• HTML: ${reportPaths.html}`);

    // Show sample of markdown report
    console.log(`\n📖 Sample Markdown Report Preview:`);
    console.log('='.repeat(50));
    const markdown = demo.generateMarkdownReport();
    const preview = markdown.split('\n').slice(0, 20).join('\n');
    console.log(preview);
    console.log('...(truncated - see full report in generated files)');
    console.log('='.repeat(50));

    // Show JSON structure
    console.log(`\n🔧 Sample JSON Structure:`);
    console.log(
      JSON.stringify(
        {
          timestamp: demo.results.timestamp,
          overallHealth: demo.results.overallHealth,
          phase1Progress: demo.results.phase1Progress,
          testSuites: demo.results.testSuites.length,
          recommendations: demo.results.recommendations.length,
        },
        null,
        2
      )
    );

    console.log(`\n✨ Demo completed successfully!`);
    console.log(`\nTo run with real tests:`);
    console.log(`  npm run report:full`);
    console.log(`  node scripts/run-comprehensive-tests.js --open`);
  } catch (error) {
    console.error(`❌ Demo failed: ${error.message}`);
    process.exit(1);
  }
}

// Run demo if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo().catch(console.error);
}

export { DemoTestReportGenerator };
