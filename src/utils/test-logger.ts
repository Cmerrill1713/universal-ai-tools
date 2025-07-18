/**
 * Test Logging Utility for Universal AI Tools
 * 
 * Specialized logging for tests with detailed failure analysis,
 * screenshot capture, performance tracking, and Sweet Athena test debugging
 */
import { logger, LogContext, EnhancedLogger } from './enhanced-logger';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface TestContext {
  testName: string;
  testSuite: string;
  testType: 'unit' | 'integration' | 'e2e' | 'performance' | 'visual';
  environment: 'development' | 'testing' | 'staging' | 'production';
  browser?: string;
  viewport?: { width: number; height: number };
  sessionId: string;
}

export interface TestResult {
  testId: string;
  context: TestContext;
  status: 'pass' | 'fail' | 'skip' | 'timeout';
  duration: number;
  startTime: Date;
  endTime: Date;
  error?: Error;
  assertions?: AssertionResult[];
  screenshots?: string[];
  performanceMetrics?: PerformanceMetrics[];
  memoryUsage?: NodeJS.MemoryUsage;
  coverage?: CoverageData;
}

export interface AssertionResult {
  description: string;
  status: 'pass' | 'fail';
  expected?: any;
  actual?: any;
  error?: string;
  stackTrace?: string;
}

export interface PerformanceMetrics {
  operation: string;
  duration: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface CoverageData {
  lines: { total: number; covered: number; percentage: number };
  functions: { total: number; covered: number; percentage: number };
  branches: { total: number; covered: number; percentage: number };
  statements: { total: number; covered: number; percentage: number };
}

export interface SweetAthenaTestData {
  interactionType: string;
  personalityMood: string;
  sweetnessLevel: number;
  userInput?: string;
  expectedResponse?: string;
  actualResponse?: string;
  avatarState?: any;
  animationMetrics?: PerformanceMetrics[];
}

export class TestLogger {
  private enhancedLogger: EnhancedLogger;
  private testResults: Map<string, TestResult> = new Map();
  private testTimers: Map<string, number> = new Map();
  private screenshotDir: string;
  private logDir: string;

  constructor() {
    this.enhancedLogger = new EnhancedLogger('test-runner');
    this.screenshotDir = path.join(process.cwd(), 'tests', 'screenshots');
    this.logDir = path.join(process.cwd(), 'logs', 'tests');
    this.ensureDirectories();
  }

  private async ensureDirectories() {
    try {
      await fs.mkdir(this.screenshotDir, { recursive: true });
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create test directories:', error);
    }
  }

  // Start a test run
  startTest(context: TestContext): string {
    const testId = `${context.testSuite}_${context.testName}_${Date.now()}`;
    const startTime = new Date();
    
    this.testTimers.set(testId, Date.now());
    
    const testResult: TestResult = {
      testId,
      context,
      status: 'pass', // Default to pass, will be updated if it fails
      duration: 0,
      startTime,
      endTime: startTime, // Will be updated when test ends
      assertions: [],
      screenshots: [],
      performanceMetrics: [],
      memoryUsage: process.memoryUsage()
    };

    this.testResults.set(testId, testResult);

    logger.info(`Test started: ${context.testName}`, LogContext.TEST, {
      test_id: testId,
      test_context: context,
      memory_at_start: testResult.memoryUsage
    });

    return testId;
  }

  // End a test run
  endTest(testId: string, status: 'pass' | 'fail' | 'skip' | 'timeout', error?: Error): TestResult {
    const testResult = this.testResults.get(testId);
    if (!testResult) {
      throw new Error(`Test ${testId} not found`);
    }

    const endTime = new Date();
    const startTimestamp = this.testTimers.get(testId);
    const duration = startTimestamp ? Date.now() - startTimestamp : 0;

    testResult.status = status;
    testResult.endTime = endTime;
    testResult.duration = duration;
    testResult.error = error;

    // Clean up timer
    this.testTimers.delete(testId);

    // Log test completion
    const level = status === 'fail' ? 'error' : status === 'skip' ? 'warn' : 'info';
    logger.logTestResult(testResult.context.testName, status, duration, {
      test_id: testId,
      test_context: testResult.context,
      assertions_count: testResult.assertions?.length || 0,
      screenshots_count: testResult.screenshots?.length || 0,
      performance_metrics_count: testResult.performanceMetrics?.length || 0,
      error_message: error?.message,
      memory_delta: this.calculateMemoryDelta(testResult.memoryUsage!, process.memoryUsage())
    });

    // Generate test report if it failed
    if (status === 'fail') {
      this.generateFailureReport(testResult);
    }

    return testResult;
  }

  // Add assertion result
  addAssertion(testId: string, assertion: AssertionResult) {
    const testResult = this.testResults.get(testId);
    if (!testResult) {
      console.warn(`Test ${testId} not found for assertion`);
      return;
    }

    testResult.assertions = testResult.assertions || [];
    testResult.assertions.push(assertion);

    if (assertion.status === 'fail') {
      testResult.status = 'fail';
      
      logger.error(`Assertion failed in ${testResult.context.testName}`, LogContext.TEST, {
        test_id: testId,
        assertion,
        test_context: testResult.context
      });
    } else {
      logger.debug(`Assertion passed: ${assertion.description}`, LogContext.TEST, {
        test_id: testId,
        assertion_description: assertion.description
      });
    }
  }

  // Capture screenshot for visual tests
  async captureScreenshot(testId: string, description: string, screenshotData: Buffer | string): Promise<string> {
    const testResult = this.testResults.get(testId);
    if (!testResult) {
      throw new Error(`Test ${testId} not found`);
    }

    const filename = `${testId}_${description.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.png`;
    const filepath = path.join(this.screenshotDir, filename);

    try {
      if (typeof screenshotData === 'string') {
        // Base64 data
        const base64Data = screenshotData.replace(/^data:image\/\w+;base64,/, '');
        await fs.writeFile(filepath, base64Data, 'base64');
      } else {
        // Buffer data
        await fs.writeFile(filepath, screenshotData);
      }

      testResult.screenshots = testResult.screenshots || [];
      testResult.screenshots.push(filepath);

      logger.info(`Screenshot captured for test ${testResult.context.testName}`, LogContext.TEST, {
        test_id: testId,
        screenshot_path: filepath,
        description
      });

      return filepath;
    } catch (error) {
      logger.error(`Failed to capture screenshot for test ${testId}`, LogContext.TEST, {
        test_id: testId,
        error: error.message,
        description
      });
      throw error;
    }
  }

  // Add performance metric
  addPerformanceMetric(testId: string, metric: PerformanceMetrics) {
    const testResult = this.testResults.get(testId);
    if (!testResult) {
      console.warn(`Test ${testId} not found for performance metric`);
      return;
    }

    testResult.performanceMetrics = testResult.performanceMetrics || [];
    testResult.performanceMetrics.push(metric);

    logger.debug(`Performance metric recorded for ${testResult.context.testName}`, LogContext.PERFORMANCE, {
      test_id: testId,
      metric,
      test_context: testResult.context
    });
  }

  // Sweet Athena specific test logging
  logAthenaTestInteraction(testId: string, athenaData: SweetAthenaTestData) {
    const testResult = this.testResults.get(testId);
    if (!testResult) {
      console.warn(`Test ${testId} not found for Athena interaction`);
      return;
    }

    logger.info(`Sweet Athena test interaction in ${testResult.context.testName}`, LogContext.ATHENA, {
      test_id: testId,
      athena_data: athenaData,
      test_context: testResult.context
    });

    // Add animation performance metrics if available
    if (athenaData.animationMetrics) {
      athenaData.animationMetrics.forEach(metric => {
        this.addPerformanceMetric(testId, metric);
      });
    }
  }

  // Log test environment setup
  logTestEnvironmentSetup(environment: Record<string, any>) {
    logger.info('Test environment setup', LogContext.TEST, {
      environment,
      node_version: process.version,
      platform: process.platform,
      arch: process.arch,
      memory_total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
    });
  }

  // Log test suite start
  logTestSuiteStart(suiteName: string, testCount: number) {
    logger.info(`Test suite started: ${suiteName}`, LogContext.TEST, {
      suite_name: suiteName,
      test_count: testCount,
      timestamp: new Date().toISOString()
    });
  }

  // Log test suite completion
  logTestSuiteComplete(suiteName: string, results: { passed: number; failed: number; skipped: number; total: number }) {
    const success = results.failed === 0;
    const level = success ? 'info' : 'error';

    logger.log(level, `Test suite completed: ${suiteName}`, {
      context: LogContext.TEST,
      suite_name: suiteName,
      results,
      success_rate: ((results.passed / results.total) * 100).toFixed(2) + '%',
      timestamp: new Date().toISOString()
    });
  }

  // Generate detailed failure report
  private async generateFailureReport(testResult: TestResult) {
    const reportData = {
      test_id: testResult.testId,
      test_name: testResult.context.testName,
      test_suite: testResult.context.testSuite,
      test_type: testResult.context.testType,
      environment: testResult.context.environment,
      status: testResult.status,
      duration: testResult.duration,
      error: testResult.error ? {
        message: testResult.error.message,
        stack: testResult.error.stack,
        name: testResult.error.name
      } : null,
      assertions: testResult.assertions,
      screenshots: testResult.screenshots,
      performance_metrics: testResult.performanceMetrics,
      memory_usage: testResult.memoryUsage,
      timestamp: testResult.endTime.toISOString()
    };

    const filename = `failure_report_${testResult.testId}.json`;
    const filepath = path.join(this.logDir, filename);

    try {
      await fs.writeFile(filepath, JSON.stringify(reportData, null, 2));
      
      logger.info(`Failure report generated for ${testResult.context.testName}`, LogContext.TEST, {
        test_id: testResult.testId,
        report_path: filepath
      });
    } catch (error) {
      logger.error(`Failed to generate failure report for ${testResult.testId}`, LogContext.TEST, {
        test_id: testResult.testId,
        error: error.message
      });
    }
  }

  // Get all test results
  getAllTestResults(): TestResult[] {
    return Array.from(this.testResults.values());
  }

  // Get test results by status
  getTestResultsByStatus(status: 'pass' | 'fail' | 'skip' | 'timeout'): TestResult[] {
    return this.getAllTestResults().filter(result => result.status === status);
  }

  // Calculate memory delta
  private calculateMemoryDelta(initial: NodeJS.MemoryUsage, final: NodeJS.MemoryUsage) {
    return {
      heapUsed: final.heapUsed - initial.heapUsed,
      heapTotal: final.heapTotal - initial.heapTotal,
      external: final.external - initial.external,
      rss: final.rss - initial.rss
    };
  }

  // Generate test summary report
  async generateSummaryReport(): Promise<string> {
    const allResults = this.getAllTestResults();
    const summary = {
      total: allResults.length,
      passed: allResults.filter(r => r.status === 'pass').length,
      failed: allResults.filter(r => r.status === 'fail').length,
      skipped: allResults.filter(r => r.status === 'skip').length,
      timeout: allResults.filter(r => r.status === 'timeout').length,
      average_duration: allResults.reduce((sum, r) => sum + r.duration, 0) / allResults.length,
      success_rate: (allResults.filter(r => r.status === 'pass').length / allResults.length) * 100
    };

    const reportData = {
      summary,
      timestamp: new Date().toISOString(),
      detailed_results: allResults
    };

    const filename = `test_summary_${Date.now()}.json`;
    const filepath = path.join(this.logDir, filename);

    await fs.writeFile(filepath, JSON.stringify(reportData, null, 2));
    
    logger.info('Test summary report generated', LogContext.TEST, {
      summary,
      report_path: filepath
    });

    return filepath;
  }

  // Cleanup resources
  async cleanup() {
    this.testResults.clear();
    this.testTimers.clear();
    await this.enhancedLogger.shutdown();
  }
}

// Create singleton instance for tests
export const testLogger = new TestLogger();

// Convenience functions for easy test integration
export const startTest = (context: TestContext) => testLogger.startTest(context);
export const endTest = (testId: string, status: 'pass' | 'fail' | 'skip' | 'timeout', error?: Error) => 
  testLogger.endTest(testId, status, error);
export const addAssertion = (testId: string, assertion: AssertionResult) => 
  testLogger.addAssertion(testId, assertion);
export const captureScreenshot = (testId: string, description: string, screenshotData: Buffer | string) =>
  testLogger.captureScreenshot(testId, description, screenshotData);
export const addPerformanceMetric = (testId: string, metric: PerformanceMetrics) =>
  testLogger.addPerformanceMetric(testId, metric);
export const logAthenaTestInteraction = (testId: string, athenaData: SweetAthenaTestData) =>
  testLogger.logAthenaTestInteraction(testId, athenaData);

export default testLogger;