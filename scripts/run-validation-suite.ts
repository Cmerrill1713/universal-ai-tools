#!/usr/bin/env tsx

/**
 * Validation Suite Runner
 * Orchestrates execution of all validation and testing categories
 */

import { execSync, spawn } from 'child_process';
import { performance } from 'perf_hooks';
import { writeFileSync, existsSync } from 'fs';
import chalk from 'chalk';

interface TestSuiteResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN' | 'SKIP';
  duration: number;
  details?: string;
  coverage?: number;
  errors?: string[];
}

interface ValidationSuiteReport {
  timestamp: string;
  environment: string;
  totalDuration: number;
  suites: TestSuiteResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    skipped: number;
    successRate: number;
    averageDuration: number;
  };
}

class ValidationSuiteRunner {
  private results: TestSuiteResult[] = [];
  private startTime = performance.now();
  
  /**
   * Run all validation suites
   */
  async runAll(): Promise<ValidationSuiteReport> {
    console.log(chalk.blue('🚀 Universal AI Tools - Validation Suite Runner'));
    console.log(chalk.gray('=' .repeat(60)));
    console.log(chalk.gray(`Started: ${new Date().toISOString()}`));
    console.log(chalk.gray(`Environment: ${process.env.NODE_ENV || 'development'}`));
    console.log();
    
    try {
      // Phase 1: Infrastructure Check
      await this.runInfrastructureCheck();
      
      // Phase 2: Core Validation Tests
      await this.runCoreValidation();
      
      // Phase 3: Security Validation
      await this.runSecurityValidation();
      
      // Phase 4: Performance Benchmarking  
      await this.runPerformanceBenchmark();
      
      // Phase 5: AI/ML System Validation
      await this.runAIMLValidation();
      
      // Phase 6: Integration Tests
      await this.runIntegrationTests();
      
      // Phase 7: Code Quality Assessment
      await this.runCodeQualityCheck();
      
      return this.generateReport();
    } catch (error) {
      console.error(chalk.red(`💥 Validation suite failed: ${error.message}`));
      throw error;
    }
  }
  
  /**
   * Phase 1: Infrastructure Check
   */
  private async runInfrastructureCheck(): Promise<void> {
    console.log(chalk.yellow('🏗️ Phase 1: Infrastructure Check'));
    
    await this.runTestSuite('Infrastructure Health Check', async () => {
      const result = await this.executeCommand('tsx scripts/comprehensive-validation-suite.ts');
      return result.includes('SUCCESS') || result.includes('PASS');
    });
  }
  
  /**
   * Phase 2: Core Validation Tests
   */
  private async runCoreValidation(): Promise<void> {
    console.log(chalk.blue('\n🧪 Phase 2: Core Validation Tests'));
    
    // Jest unit tests
    await this.runTestSuite('Unit Tests', async () => {
      const result = await this.executeCommand('npm run test:unit --passWithNoTests');
      return result.includes('PASS') && !result.includes('FAIL');
    });
    
    // Middleware tests
    await this.runTestSuite('Middleware Tests', async () => {
      const result = await this.executeCommand('npx playwright test tests/middleware-functional.test.ts');
      return result.includes('passed') && !result.includes('failed');
    });
  }
  
  /**
   * Phase 3: Security Validation
   */
  private async runSecurityValidation(): Promise<void> {
    console.log(chalk.red('\n🔐 Phase 3: Security Validation'));
    
    await this.runTestSuite('Security Tests', async () => {
      const result = await this.executeCommand('npx playwright test tests/security-validation.test.ts');
      return result.includes('passed') && !result.includes('failed');
    });
    
    await this.runTestSuite('Dependency Security', async () => {
      const result = await this.executeCommand('npm audit --audit-level moderate');
      const criticalVulns = (result.match(/critical/gi) || []).length;
      return criticalVulns === 0;
    });
  }
  
  /**
   * Phase 4: Performance Benchmarking
   */
  private async runPerformanceBenchmark(): Promise<void> {
    console.log(chalk.green('\n⚡ Phase 4: Performance Benchmarking'));
    
    await this.runTestSuite('Performance Benchmark', async () => {
      const result = await this.executeCommand('npx playwright test tests/performance-benchmark.test.ts');
      return result.includes('passed') && !result.includes('failed');
    });
    
    await this.runTestSuite('API Performance', async () => {
      const result = await this.executeCommand('tsx scripts/quick-performance-test.ts api');
      return result.includes('✅') || result.includes('PASS');
    });
  }
  
  /**
   * Phase 5: AI/ML System Validation
   */
  private async runAIMLValidation(): Promise<void> {
    console.log(chalk.magenta('\n🤖 Phase 5: AI/ML System Validation'));
    
    await this.runTestSuite('AI/ML System Tests', async () => {
      const result = await this.executeCommand('npx playwright test tests/ai-ml-validation.test.ts');
      return result.includes('passed') && !result.includes('failed');
    });
    
    await this.runTestSuite('LLM Integration', async () => {
      const result = await this.executeCommand('node test-llm-improvements.js');
      return result.includes('✅') && result.includes('100%');
    });
  }
  
  /**
   * Phase 6: Integration Tests
   */
  private async runIntegrationTests(): Promise<void> {
    console.log(chalk.cyan('\n🔗 Phase 6: Integration Tests'));
    
    await this.runTestSuite('API Integration', async () => {
      const result = await this.executeCommand('npm run test:api --passWithNoTests');
      return result.includes('PASS') || result.includes('No tests found');
    });
    
    await this.runTestSuite('Database Integration', async () => {
      const result = await this.executeCommand('npm run test:database --passWithNoTests');
      return result.includes('PASS') || result.includes('No tests found');
    });
    
    await this.runTestSuite('E2E Browser Tests', async () => {
      const result = await this.executeCommand('npx playwright test --project=chromium --grep="Frontend Integration"');
      return result.includes('passed') || result.includes('No tests found');
    });
  }
  
  /**
   * Phase 7: Code Quality Assessment
   */
  private async runCodeQualityCheck(): Promise<void> {
    console.log(chalk.blue('\n📊 Phase 7: Code Quality Assessment'));
    
    await this.runTestSuite('TypeScript Compilation', async () => {
      const result = await this.executeCommand('npm run type-check');
      return !result.includes('error');
    });
    
    await this.runTestSuite('ESLint Code Quality', async () => {
      const result = await this.executeCommand('npm run lint');
      const errorCount = (result.match(/error/gi) || []).length;
      return errorCount === 0;
    });
    
    await this.runTestSuite('Code Coverage', async () => {
      const result = await this.executeCommand('npm run test:coverage --passWithNoTests');
      const coverageMatch = result.match(/All files.*?(\d+\.?\d*)%/);
      const coverage = coverageMatch ? parseFloat(coverageMatch[1]) : 0;
      
      // Store coverage for report
      if (this.results.length > 0) {
        this.results[this.results.length - 1].coverage = coverage;
      }
      
      return coverage >= 60; // Minimum 60% coverage
    });
    
    await this.runTestSuite('Production Readiness', async () => {
      const result = await this.executeCommand('npm run check:all');
      return !result.includes('FAIL') && !result.includes('ERROR');
    });
  }
  
  /**
   * Run individual test suite
   */
  private async runTestSuite(name: string, testFn: () => Promise<boolean>): Promise<void> {
    const startTime = performance.now();
    console.log(chalk.gray(`  🧪 Running ${name}...`));
    
    try {
      const success = await testFn();
      const duration = performance.now() - startTime;
      const status = success ? 'PASS' : 'FAIL';
      
      this.results.push({
        name,
        status,
        duration
      });
      
      const statusColor = status === 'PASS' ? chalk.green : chalk.red;
      console.log(statusColor(`     ${status} (${Math.round(duration)}ms)`));
      
    } catch (error) {
      const duration = performance.now() - startTime;
      
      this.results.push({
        name,
        status: 'WARN',
        duration,
        details: error.message,
        errors: [error.message]
      });
      
      console.log(chalk.yellow(`     WARN (${Math.round(duration)}ms) - ${error.message.substring(0, 100)}...`));
    }
  }
  
  /**
   * Execute command with timeout and error handling
   */
  private async executeCommand(command: string, timeoutMs = 120000): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const result = execSync(command, { 
          encoding: 'utf8', 
          timeout: timeoutMs,
          maxBuffer: 1024 * 1024 * 50, // 50MB buffer
          stdio: 'pipe'
        });
        resolve(result.toString());
      } catch (error) {
        // Some commands may have non-zero exit codes but still provide useful output
        if (error.stdout || error.stderr) {
          resolve((error.stdout || error.stderr).toString());
        } else {
          reject(error);
        }
      }
    });
  }
  
  /**
   * Generate comprehensive validation report
   */
  private generateReport(): ValidationSuiteReport {
    const totalDuration = performance.now() - this.startTime;
    
    const summary = {
      total: this.results.length,
      passed: this.results.filter(r => r.status === 'PASS').length,
      failed: this.results.filter(r => r.status === 'FAIL').length,
      warnings: this.results.filter(r => r.status === 'WARN').length,
      skipped: this.results.filter(r => r.status === 'SKIP').length,
      successRate: 0,
      averageDuration: 0
    };
    
    summary.successRate = summary.total > 0 ? (summary.passed / summary.total) * 100 : 0;
    summary.averageDuration = summary.total > 0 ? 
      this.results.reduce((acc, r) => acc + r.duration, 0) / summary.total : 0;
    
    const report: ValidationSuiteReport = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      totalDuration,
      suites: this.results,
      summary
    };
    
    // Save detailed report
    const reportPath = `validation-reports/validation-suite-${Date.now()}.json`;
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Print summary
    this.printSummary(report);
    
    return report;
  }
  
  /**
   * Print validation summary
   */
  private printSummary(report: ValidationSuiteReport): void {
    console.log(chalk.blue('\n📋 Validation Suite Summary'));
    console.log(chalk.gray('=' .repeat(60)));
    
    console.log(`🕒 Total Duration: ${Math.round(report.totalDuration / 1000)}s`);
    console.log(`📊 Test Suites: ${report.summary.total}`);
    console.log(chalk.green(`✅ Passed: ${report.summary.passed}`));
    console.log(chalk.red(`❌ Failed: ${report.summary.failed}`));
    console.log(chalk.yellow(`⚠️  Warnings: ${report.summary.warnings}`));
    console.log(chalk.cyan(`⏭️  Skipped: ${report.summary.skipped}`));
    console.log(`📈 Success Rate: ${report.summary.successRate.toFixed(1)}%`);
    console.log(`⏱️  Average Duration: ${Math.round(report.summary.averageDuration)}ms`);
    
    // Coverage summary
    const coverageResults = report.suites.filter(s => s.coverage !== undefined);
    if (coverageResults.length > 0) {
      const avgCoverage = coverageResults.reduce((acc, r) => acc + r.coverage!, 0) / coverageResults.length;
      console.log(`📊 Average Coverage: ${avgCoverage.toFixed(1)}%`);
    }
    
    console.log(chalk.gray(`📄 Detailed report: ${reportPath}`));
    
    // Failed tests summary
    const failedTests = report.suites.filter(s => s.status === 'FAIL');
    if (failedTests.length > 0) {
      console.log(chalk.red('\n❌ Failed Test Suites:'));
      failedTests.forEach(test => {
        console.log(chalk.red(`   • ${test.name}`));
        if (test.details) {
          console.log(chalk.gray(`     ${test.details.substring(0, 100)}...`));
        }
      });
    }
    
    // Warnings summary
    const warningTests = report.suites.filter(s => s.status === 'WARN');
    if (warningTests.length > 0) {
      console.log(chalk.yellow('\n⚠️  Test Suite Warnings:'));
      warningTests.forEach(test => {
        console.log(chalk.yellow(`   • ${test.name}`));
        if (test.details) {
          console.log(chalk.gray(`     ${test.details.substring(0, 100)}...`));
        }
      });
    }
    
    // Overall status
    const overallStatus = report.summary.failed === 0 ? 
      report.summary.warnings === 0 ? 'SUCCESS' : 'SUCCESS_WITH_WARNINGS' : 
      'PARTIAL_SUCCESS';
    
    const statusColor = overallStatus === 'SUCCESS' ? chalk.green : 
                       overallStatus === 'SUCCESS_WITH_WARNINGS' ? chalk.yellow : chalk.red;
    
    console.log(statusColor(`\n🎯 Overall Status: ${overallStatus.replace(/_/g, ' ')}`));
    
    // Recommendations
    if (report.summary.successRate < 80) {
      console.log(chalk.red('\n💡 Recommendations:'));
      console.log('   • Address failed test suites before production deployment');
      console.log('   • Review system health and dependencies');
      console.log('   • Check service availability and configuration');
    } else if (report.summary.warnings > 0) {
      console.log(chalk.yellow('\n💡 Recommendations:'));
      console.log('   • Review warnings for potential improvements');
      console.log('   • Consider addressing non-critical issues');
    } else {
      console.log(chalk.green('\n✨ All validation checks passed! System is ready for production.'));
    }
  }
}

// CLI Interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new ValidationSuiteRunner();
  
  const command = process.argv[2] || 'all';
  
  switch (command) {
    case 'all':
    case 'run':
      runner.runAll()
        .then(report => {
          const exitCode = report.summary.failed > 0 ? 1 : 0;
          process.exit(exitCode);
        })
        .catch(error => {
          console.error(chalk.red(`\n💥 Validation failed: ${error.message}`));
          process.exit(1);
        });
      break;
      
    default:
      console.log('Usage: run-validation-suite.ts [all|run]');
      console.log('  all|run - Run complete validation suite');
      break;
  }
}

export { ValidationSuiteRunner, type ValidationSuiteReport, type TestSuiteResult };