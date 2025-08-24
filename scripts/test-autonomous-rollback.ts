#!/usr/bin/env tsx
/**
 * Autonomous Action Rollback Test Runner
 * 
 * This script runs the rollback tests independently of the main build,
 * allowing us to validate the rollback mechanisms even if there are
 * compilation errors in other parts of the codebase.
 * 
 * Usage:
 * npm run test:autonomous-rollback
 * or
 * npx tsx scripts/test-autonomous-rollback.ts
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TestResult {
  testFile: string;
  passed: boolean;
  duration: number;
  output: string;
  errors?: string;
}

class AutonomousRollbackTestRunner {
  private results: TestResult[] = [];
  private projectRoot: string;

  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
  }

  async runTests(): Promise<void> {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('\n🧪 Autonomous Action Rollback Test Suite');
    console.log('==========================================\n');

    const testFiles = [
      'tests/services/autonomous-action-rollback.test.ts',
      'tests/integration/autonomous-action-rollback-integration.test.ts'
    ];

    const startTime = Date.now();

    for (const testFile of testFiles) {
      await this.runTestFile(testFile);
    }

    const totalDuration = Date.now() - startTime;

    console.log('\n📊 Test Results Summary');
    console.log('=======================');
    this.printTestSummary(totalDuration);

    // Run demo if all tests pass
    const allTestsPassed = this.results.every(r => r.passed);
    if (allTestsPassed) {
      console.log('\n🎉 All tests passed! Running demonstration...\n');
      await this.runDemo();
    } else {
      console.log('\n❌ Some tests failed. Skipping demonstration.');
      process.exit(1);
    }
  }

  private async runTestFile(testFile: string): Promise<void> {
    const fullPath = path.join(this.projectRoot, testFile);
    
    if (!existsSync(fullPath)) {
      console.log(`⚠️ Test file not found: ${testFile}`);
      this.results.push({
        testFile,
        passed: false,
        duration: 0,
        output: '',
        errors: 'Test file not found'
      });
      return;
    }

    console.log(`🔍 Running tests in: ${testFile}`);

    const startTime = Date.now();
    
    try {
      // Run the test using Jest with TypeScript support
      const jestCommand = `npx jest "${fullPath}" --verbose --no-coverage --detectOpenHandles`;
      
      const output = execSync(jestCommand, {
        cwd: this.projectRoot,
        encoding: 'utf8',
        timeout: 30000, // 30 second timeout
        env: {
          ...process.env,
          NODE_ENV: 'test',
          // Disable external services during testing
          SUPABASE_URL: 'http://localhost:54321',
          SUPABASE_ANON_KEY: 'test-key'
        }
      });

      const duration = Date.now() - startTime;
      
      this.results.push({
        testFile,
        passed: true,
        duration,
        output
      });

      console.log(`✅ Tests passed in ${duration}ms`);
      
      // Show key test results
      this.extractTestResults(output);

    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      
      this.results.push({
        testFile,
        passed: false,
        duration,
        output: error.stdout || '',
        errors: error.stderr || error.message
      });

      console.log(`❌ Tests failed in ${duration}ms`);
      console.log(`Error: ${error.message}`);
      
      if (error.stdout) {
        console.log('\nTest Output:');
        console.log(error.stdout);
      }
    }
  }

  private extractTestResults(output: string): void {
    const lines = output.split('\n');
    const testLines = lines.filter(line => 
      line.includes('✓') || line.includes('✗') || 
      line.includes('PASS') || line.includes('FAIL')
    );

    if (testLines.length > 0) {
      console.log('\n📋 Test Details:');
      testLines.slice(0, 10).forEach(line => { // Show first 10 test results
        if (line.trim()) {
          const cleanLine = line.replace(/\s+/g, ' ').trim();
          if (cleanLine.includes('✓')) {
            console.log(`   ✅ ${cleanLine.replace('✓', '').trim()}`);
          } else if (cleanLine.includes('✗')) {
            console.log(`   ❌ ${cleanLine.replace('✗', '').trim()}`);
          }
        }
      });

      // Show test count summary
      const passCount = output.match(/✓/g)?.length || 0;
      const failCount = output.match(/✗/g)?.length || 0;
      
      if (passCount || failCount) {
        console.log(`   📊 ${passCount} passed, ${failCount} failed`);
      }
    }
  }

  private printTestSummary(totalDuration: number): void {
    const passedTests = this.results.filter(r => r.passed);
    const failedTests = this.results.filter(r => !r.passed);

    console.log(`\nTotal Files: ${this.results.length}`);
    console.log(`Passed: ${passedTests.length}`);
    console.log(`Failed: ${failedTests.length}`);
    console.log(`Total Time: ${totalDuration}ms`);

    if (failedTests.length > 0) {
      console.log('\n❌ Failed Tests:');
      failedTests.forEach(test => {
        console.log(`   • ${test.testFile}`);
        if (test.errors) {
          const errorLines = test.errors.split('\n').slice(0, 3);
          errorLines.forEach(line => {
            if (line.trim()) console.log(`     ${line.trim()}`);
          });
        }
      });
    }

    if (passedTests.length > 0) {
      console.log('\n✅ Passed Tests:');
      passedTests.forEach(test => {
        console.log(`   • ${test.testFile} (${test.duration}ms)`);
      });
    }
  }

  private async runDemo(): Promise<void> {
    try {
      console.log('🎬 Running Autonomous Rollback Demonstration...');
      
      const demoCommand = `npx tsx scripts/demo-autonomous-rollback.ts`;
      
      const demoOutput = execSync(demoCommand, {
        cwd: this.projectRoot,
        encoding: 'utf8',
        timeout: 15000, // 15 second timeout for demo
        env: {
          ...process.env,
          NODE_ENV: 'demo'
        }
      });

      console.log(demoOutput);
      console.log('\n🎉 Demonstration completed successfully!');

    } catch (error: unknown) {
      console.log('\n⚠️ Demo failed, but tests passed. This might be expected.');
      console.log(`Demo error: ${error.message}`);
      
      // Don't fail the overall test run if demo fails
      // The demo might fail due to external dependencies
    }
  }

  async runValidation(): Promise<void> {
    console.log('\n🔍 Running Autonomous Rollback Validation...');
    
    try {
      const validationCommand = `npx tsx scripts/validate-autonomous-rollback.ts --quick`;
      
      const validationOutput = execSync(validationCommand, {
        cwd: this.projectRoot,
        encoding: 'utf8',
        timeout: 10000, // 10 second timeout
        env: {
          ...process.env,
          NODE_ENV: 'test'
        }
      });

      console.log(validationOutput);
      console.log('\n✅ Validation completed successfully!');

    } catch (error: unknown) {
      console.log('\n❌ Validation failed:');
      console.log(error.message);
      
      if (error.stdout) {
        console.log('\nValidation Output:');
        console.log(error.stdout);
      }
    }
  }

  async runQuickTest(): Promise<void> {
    console.log('\n⚡ Running Quick Rollback Logic Test...');

    // Test rollback trigger logic directly
    const testRollbackTrigger = (
      beforeMetric: number, 
      afterMetric: number, 
      threshold: number
    ): boolean => {
      // Only trigger rollback for degradation (negative change for success rate metrics)
      const changePercent = (beforeMetric - afterMetric) / beforeMetric;
      return changePercent > threshold;
    };

    // Test scenarios
    const scenarios = [
      {
        name: '8% degradation should trigger rollback',
        before: 0.85,
        after: 0.782,
        threshold: 0.05,
        expectedTrigger: true
      },
      {
        name: '3% degradation should not trigger rollback',
        before: 0.85,
        after: 0.8245,
        threshold: 0.05,
        expectedTrigger: false
      },
      {
        name: '10% improvement should not trigger rollback',
        before: 0.80,
        after: 0.88,
        threshold: 0.05,
        expectedTrigger: false
      }
    ];

    let passed = 0;
    let failed = 0;

    scenarios.forEach(scenario => {
      const actualTrigger = testRollbackTrigger(
        scenario.before,
        scenario.after,
        scenario.threshold
      );

      if (actualTrigger === scenario.expectedTrigger) {
        console.log(`   ✅ ${scenario.name}`);
        passed++;
      } else {
        console.log(`   ❌ ${scenario.name} (expected: ${scenario.expectedTrigger}, got: ${actualTrigger})`);
        failed++;
      }
    });

    console.log(`\n📊 Quick Test Results: ${passed} passed, ${failed} failed`);

    if (failed === 0) {
      console.log('✅ Core rollback logic is working correctly!');
    } else {
      console.log('❌ Core rollback logic has issues.');
    }
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  const testRunner = new AutonomousRollbackTestRunner();

  try {
    if (args.includes('--quick')) {
      await testRunner.runQuickTest();
    } else if (args.includes('--validate')) {
      await testRunner.runValidation();
    } else if (args.includes('--demo')) {
      console.log('🎬 Running demo only...');
      await (testRunner as any).runDemo();
    } else {
      // Full test suite
      await testRunner.runTests();
      
      if (args.includes('--with-validation')) {
        await testRunner.runValidation();
      }
    }

    console.log('\n🎯 Autonomous Rollback Testing Complete!');
    console.log('\nNext steps:');
    console.log('  • npm run demo:autonomous-rollback (to see rollback in action)');
    console.log('  • npm run validate:autonomous-rollback (to validate system configuration)');
    console.log('  • npm run test:autonomous-rollback --quick (for quick logic tests)');

  } catch (error) {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error('\n❌ Test runner failed:', error);
    process.exit(1);
  }
}

// Run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { AutonomousRollbackTestRunner };