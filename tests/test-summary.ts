/**
 * Test Summary Generator
 * Generates comprehensive test coverage and quality reports
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TWO, MILLISECONDS_IN_SECOND } from '../src/utils/constants';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

interface CoverageSummary {
  lines: { total: number; covered: number; skipped: number; pct: number };
  statements: { total: number; covered: number; skipped: number; pct: number };
  functions: { total: number; covered: number; skipped: number; pct: number };
  branches: { total: number; covered: number; skipped: number; pct: number };
}

interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  coverage?: CoverageSummary;
  errors?: string[];
}

interface TestSummaryReport {
  timestamp: string;
  overallStatus: 'passed' | 'failed' | 'partial';
  testSuites: TestResult[];
  coverage: {
    overall: CoverageSummary;
    byCategory: Record<string, CoverageSummary>;
    qualityGate: 'excellent' | 'good' | 'fair' | 'poor';
  };
  metrics: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    skippedTests: number;
    totalDuration: number;
    averageDuration: number;
  };
  recommendations: string[];
  productionReadiness: {
    score: number;
    level: 'ready' | 'near-ready' | 'needs-work' | 'not-ready';
    blockers: string[];
    warnings: string[];
  };
}

export class TestSummaryGenerator {
  private testSuites: Array<{
    name: string;
    command: string;
    category: string;
    weight: number;
    required: boolean;
  }> = [
    {
      name: 'API Routes',
      command: 'npm run test:api',
      category: 'integration',
      weight: 20,
      required: true
    },
    {
      name: 'Authentication Middleware',
      command: 'npm run test:middleware -- --testPathPattern=auth',
      category: 'security',
      weight: 25,
      required: true
    },
    {
      name: 'Security Middleware',
      command: 'npm run test:security',
      category: 'security',
      weight: 25,
      required: true
    },
    {
      name: 'Agent Functionality',
      command: 'npm run test:agents',
      category: 'functional',
      weight: 15,
      required: false
    },
    {
      name: 'Database Operations',
      command: 'npm run test:database',
      category: 'integration',
      weight: 20,
      required: true
    },
    {
      name: 'Error Handling',
      command: 'npm run test:error-handling',
      category: 'reliability',
      weight: 15,
      required: true
    },
    {
      name: 'Performance Tests',
      command: 'npm run test:performance',
      category: 'performance',
      weight: 10,
      required: false
    }
  ];

  private results: TestResult[] = [];
  private startTime: number = Date.now();

  async runTestSuite(suite: typeof this.testSuites[0]): Promise<TestResult> {
    console.log(`\n🧪 Running ${suite.name}...`);
    const startTime = Date.now();

    try {
      // Run the test command
      const output = execSync(suite.command, {
        cwd: rootDir,
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 120000 // 2 minutes timeout
      });

      const duration = Date.now() - startTime;
      
      console.log(`✅ ${suite.name} passed (${duration}ms)`);
      
      return {
        name: suite.name,
        status: 'passed',
        duration
      };
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      
      console.log(`❌ ${suite.name} failed (${duration}ms)`);
      
      return {
        name: suite.name,
        status: 'failed',
        duration,
        errors: [String(error)]
      };
    }
  }

  async generateCoverageReport(): Promise<CoverageSummary | null> {
    try {
      console.log('\n📊 Generating coverage report...');
      
      // Run coverage collection
      execSync('npm run test:coverage:report', {
        cwd: rootDir,
        stdio: 'pipe',
        timeout: 180000 // 3 minutes timeout
      });

      // Read coverage summary
      const summaryPath = path.join(rootDir, 'coverage', 'coverage-summary.json');
      
      if (existsSync(summaryPath)) {
        const summaryData = JSON.parse(readFileSync(summaryPath, 'utf-8'));
        return summaryData.total;
      }
      
      return null;
    } catch (error) {
      console.log('⚠️ Failed to generate coverage report:', error);
      return null;
    }
  }

  determineQualityGate(coverage: CoverageSummary): 'excellent' | 'good' | 'fair' | 'poor' {
    const avgCoverage = (
      coverage.lines.pct +
      coverage.statements.pct +
      coverage.functions.pct +
      coverage.branches.pct
    ) / 4;

    if (avgCoverage >= 90) return 'excellent';
    if (avgCoverage >= 80) return 'good';
    if (avgCoverage >= 70) return 'fair';
    return 'poor';
  }

  calculateProductionReadiness(summary: TestSummaryReport): {
    score: number;
    level: 'ready' | 'near-ready' | 'needs-work' | 'not-ready';
    blockers: string[];
    warnings: string[];
  } {
    const blockers: string[] = [];
    const warnings: string[] = [];
    let score = 100;

    // Test results impact
    const requiredTests = this.testSuites.filter(s => s.required);
    const failedRequired = this.results.filter(r => 
      r.status === 'failed' && 
      requiredTests.some(t => t.name === r.name)
    );

    if (failedRequired.length > 0) {
      score -= failedRequired.length * 20;
      blockers.push(`${failedRequired.length} required test suite(s) failing`);
    }

    // Coverage impact
    if (summary.coverage.overall) {
      const avgCoverage = (
        summary.coverage.overall.lines.pct +
        summary.coverage.overall.statements.pct +
        summary.coverage.overall.functions.pct +
        summary.coverage.overall.branches.pct
      ) / 4;

      if (avgCoverage < 80) {
        score -= (80 - avgCoverage) * TWO;
        blockers.push(`Coverage below 80% (currently ${avgCoverage.toFixed(1)}%)`);
      } else if (avgCoverage < 85) {
        warnings.push(`Coverage below target 85% (currently ${avgCoverage.toFixed(1)}%)`);
      }
    }

    // Security tests impact
    const securityTests = this.results.filter(r => 
      r.name.toLowerCase().includes('security') || 
      r.name.toLowerCase().includes('auth')
    );
    const failedSecurity = securityTests.filter(r => r.status === 'failed');
    
    if (failedSecurity.length > 0) {
      score -= failedSecurity.length * 30;
      blockers.push(`${failedSecurity.length} security test(s) failing`);
    }

    // Performance tests impact
    const performanceTests = this.results.filter(r => 
      r.name.toLowerCase().includes('performance')
    );
    const failedPerformance = performanceTests.filter(r => r.status === 'failed');
    
    if (failedPerformance.length > 0) {
      score -= failedPerformance.length * 10;
      warnings.push(`${failedPerformance.length} performance test(s) failing`);
    }

    // Determine level
    let level: 'ready' | 'near-ready' | 'needs-work' | 'not-ready';
    if (score >= 95 && blockers.length === 0) {
      level = 'ready';
    } else if (score >= 85 && blockers.length === 0) {
      level = 'near-ready';
    } else if (score >= 70) {
      level = 'needs-work';
    } else {
      level = 'not-ready';
    }

    return { score: Math.max(0, score), level, blockers, warnings };
  }

  generateRecommendations(summary: TestSummaryReport): string[] {
    const recommendations: string[] = [];

    // Test failures
    const failedTests = summary.testSuites.filter(t => t.status === 'failed');
    if (failedTests.length > 0) {
      recommendations.push(`Fix ${failedTests.length} failing test suite(s): ${failedTests.map(t => t.name).join(', ')}`);
    }

    // Coverage recommendations
    if (summary.coverage.overall) {
      const coverage = summary.coverage.overall;
      
      if (coverage.lines.pct < 80) {
        recommendations.push(`Increase line coverage from ${coverage.lines.pct.toFixed(1)}% to 80%`);
      }
      
      if (coverage.branches.pct < 80) {
        recommendations.push(`Increase branch coverage from ${coverage.branches.pct.toFixed(1)}% to 80%`);
      }
      
      if (coverage.functions.pct < 80) {
        recommendations.push(`Increase function coverage from ${coverage.functions.pct.toFixed(1)}% to 80%`);
      }
    }

    // Security recommendations
    const securityTests = summary.testSuites.filter(t => 
      t.name.toLowerCase().includes('security') || 
      t.name.toLowerCase().includes('auth')
    );
    const failedSecurity = securityTests.filter(t => t.status === 'failed');
    
    if (failedSecurity.length > 0) {
      recommendations.push('Prioritize fixing security and authentication tests before deployment');
    }

    // Performance recommendations
    const avgDuration = summary.metrics.averageDuration;
    if (avgDuration > 5000) { // More than 5 seconds average
      recommendations.push('Optimize test execution time - consider parallelization or test splitting');
    }

    if (recommendations.length === 0) {
      recommendations.push('All tests passing with good coverage - ready for deployment!');
    }

    return recommendations;
  }

  async generateReport(): Promise<TestSummaryReport> {
    console.log('\n🚀 Starting comprehensive test execution...\n');
    
    // Run all test suites
    for (const suite of this.testSuites) {
      const result = await this.runTestSuite(suite);
      this.results.push(result);
    }

    // Generate coverage report
    const overallCoverage = await this.generateCoverageReport();
    
    const totalDuration = Date.now() - this.startTime;
    
    // Calculate metrics
    const metrics = {
      totalTests: this.results.length,
      passedTests: this.results.filter(r => r.status === 'passed').length,
      failedTests: this.results.filter(r => r.status === 'failed').length,
      skippedTests: this.results.filter(r => r.status === 'skipped').length,
      totalDuration,
      averageDuration: totalDuration / this.results.length
    };

    // Determine overall status
    const requiredFailures = this.results.filter(r => 
      r.status === 'failed' && 
      this.testSuites.find(s => s.name === r.name)?.required
    ).length;
    
    const overallStatus: 'passed' | 'failed' | 'partial' = 
      requiredFailures > 0 ? 'failed' : 
      metrics.failedTests > 0 ? 'partial' : 'passed';

    // Build summary report
    const summary: TestSummaryReport = {
      timestamp: new Date().toISOString(),
      overallStatus,
      testSuites: this.results,
      coverage: {
        overall: overallCoverage || {
          lines: { total: 0, covered: 0, skipped: 0, pct: 0 },
          statements: { total: 0, covered: 0, skipped: 0, pct: 0 },
          functions: { total: 0, covered: 0, skipped: 0, pct: 0 },
          branches: { total: 0, covered: 0, skipped: 0, pct: 0 }
        },
        byCategory: {},
        qualityGate: overallCoverage ? this.determineQualityGate(overallCoverage) : 'poor'
      },
      metrics,
      recommendations: [],
      productionReadiness: {
        score: 0,
        level: 'not-ready',
        blockers: [],
        warnings: []
      }
    };

    // Calculate production readiness
    summary.productionReadiness = this.calculateProductionReadiness(summary);
    
    // Generate recommendations
    summary.recommendations = this.generateRecommendations(summary);

    return summary;
  }

  printSummary(summary: TestSummaryReport): void {
    console.log('\n' + '='.repeat(80));
    console.log('🧪 COMPREHENSIVE TEST SUMMARY');
    console.log('='.repeat(80));
    
    // Overall status
    const statusEmoji = {
      passed: '✅',
      failed: '❌',
      partial: '⚠️'
    }[summary.overallStatus];
    
    console.log(`\n${statusEmoji} Overall Status: ${summary.overallStatus.toUpperCase()}`);
    console.log(`⏱️  Total Duration: ${(summary.metrics.totalDuration / MILLISECONDS_IN_SECOND).toFixed(1)}s`);
    console.log(`📊 Test Results: ${summary.metrics.passedTests}/${summary.metrics.totalTests} passed`);
    
    if (summary.coverage.overall.lines.total > 0) {
      const avgCoverage = (
        summary.coverage.overall.lines.pct +
        summary.coverage.overall.statements.pct +
        summary.coverage.overall.functions.pct +
        summary.coverage.overall.branches.pct
      ) / 4;
      
      console.log(`📈 Average Coverage: ${avgCoverage.toFixed(1)}% (${summary.coverage.qualityGate})`);
    }
    
    // Production readiness
    const readinessEmoji = {
      ready: '🚀',
      'near-ready': '🟡',
      'needs-work': '🔧',
      'not-ready': '🚨'
    }[summary.productionReadiness.level];
    
    console.log(`\n${readinessEmoji} Production Readiness: ${summary.productionReadiness.level.toUpperCase()} (${summary.productionReadiness.score}%)`);
    
    // Blockers
    if (summary.productionReadiness.blockers.length > 0) {
      console.log('\n🚨 BLOCKERS:');
      summary.productionReadiness.blockers.forEach(blocker => {
        console.log(`  • ${blocker}`);
      });
    }
    
    // Warnings
    if (summary.productionReadiness.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      summary.productionReadiness.warnings.forEach(warning => {
        console.log(`  • ${warning}`);
      });
    }
    
    // Recommendations
    if (summary.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      summary.recommendations.forEach(rec => {
        console.log(`  • ${rec}`);
      });
    }
    
    console.log('\n' + '='.repeat(80));
  }

  async saveReport(summary: TestSummaryReport): Promise<string> {
    const reportsDir = path.join(rootDir, 'test-reports');
    if (!existsSync(reportsDir)) {
      mkdirSync(reportsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(reportsDir, `test-summary-${timestamp}.json`);
    
    writeFileSync(reportPath, JSON.stringify(summary, null, TWO));
    
    // Also save as latest
    const latestPath = path.join(reportsDir, 'latest-test-summary.json');
    writeFileSync(latestPath, JSON.stringify(summary, null, TWO));
    
    console.log(`\n📄 Report saved: ${reportPath}`);
    return reportPath;
  }

  async run(): Promise<TestSummaryReport> {
    const summary = await this.generateReport();
    this.printSummary(summary);
    await this.saveReport(summary);
    return summary;
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const generator = new TestSummaryGenerator();
  
  generator.run()
    .then(summary => {
      const exitCode = summary.productionReadiness.level === 'ready' || 
                      summary.productionReadiness.level === 'near-ready' ? 0 : 1;
      process.exit(exitCode);
    })
    .catch(error => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}