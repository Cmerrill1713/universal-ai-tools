/* eslint-disable no-undef */
/**
 * Development Debugging Tools for Universal AI Tools
 *
 * Comprehensive debugging utilities with verbose logging, test result aggregation,
 * performance profiling, and Sweet Athena interaction debugging
 */
import { LogContext, enhancedLogger, logger } from './enhanced-logger';
import { testLogger } from './test-logger';
import { metricsCollector } from './prometheus-metrics';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface DebugSession {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  component: string;
  debugLevel: 'basic' | 'verbose' | 'trace';
  logs: DebugLog[];
  performance: PerformanceTrace[];
  errors: ErrorTrace[];
  athenaInteractions: AthenaDebugData[];
  metadata: Record<string, unknown>;
}

export interface DebugLog {
  timestamp: Date;
  level: string;
  message: string;
  context: string;
  data?: any;
  stackTrace?: string;
}

export interface PerformanceTrace {
  operation: string;
  startTime: number;
  endTime: number;
  duration: number;
  memoryBefore: NodeJS.MemoryUsage;
  memoryAfter: NodeJS.MemoryUsage;
  metadata?: Record<string, unknown>;
}

export interface ErrorTrace {
  _error Error;
  timestamp: Date;
  context: string;
  stackTrace: string;
  requestId?: string;
  userAction?: string;
  metadata?: Record<string, unknown>;
}

export interface AthenaDebugData {
  interactionId: string;
  timestamp: Date;
  interactionType: string;
  personalityMood: string;
  sweetnessLevel: number;
  userInput?: string;
  athenaResponse?: string;
  responseTime: number;
  animationState?: any;
  renderingMetrics?: {
    frameRate: number;
    renderTime: number;
    memoryUsage: number;
  };
  conversationContext?: any;
  errors?: string[];
}

export interface TestAggregationData {
  testSuite: string;
  testResults: TestResultSummary[];
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  coverage?: {
    lines: number;
    functions: number;
    branches: number;
    statements: number;
  };
  failureAnalysis: TestFailureAnalysis[];
  performanceMetrics: TestPerformanceMetrics[];
}

export interface TestResultSummary {
  testName: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  error: string;
  stackTrace?: string;
  assertionsFailed?: number;
  assertionsTotal?: number;
}

export interface TestFailureAnalysis {
  testName: string;
  failureType: string;
  commonErrors: string[];
  suggestedFixes: string[];
  relatedIssues: string[];
}

export interface TestPerformanceMetrics {
  testSuite: string;
  averageDuration: number;
  slowestTests: Array<{ name: string; duration: number, }>;
  memoryLeaks: Array<{ test: string; leakSize: number, }>;
  unstableTests: string[];
}

export class DebugTools {
  private debugSessions: Map<string, DebugSession> = new Map();
  private performanceTimers: Map<string, number> = new Map();
  private testAggregations: Map<string, TestAggregationData> = new Map();
  private debugLevel: 'basic' | 'verbose' | 'trace' = 'basic';
  private debugDir: string;

  constructor() {
    this.debugDir = path.join(process.cwd(), 'logs', 'debug');
    this.ensureDebugDirectory();
    this.setDebugLevel();
  }

  private async ensureDebugDirectory() {
    try {
      await fs.mkdir(this.debugDir, { recursive: true, });
    } catch (error) {
      console._error'Failed to create debug directory:', error);
    }
  }

  private setDebugLevel() {
    const envLevel = process.env.DEBUG_LEVEL?.toLowerCase() as 'basic' | 'verbose' | 'trace';
    this.debugLevel = envLevel || (process.env.NODE_ENV === 'development' ? 'verbose' : 'basic');
  }

  // Start a debug session
  startDebugSession(component: string, metadata: Record<string, unknown> = {}): string {
    const sessionId = `debug_${component}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const session: DebugSession = {
      sessionId,
      startTime: new Date(),
      component,
      debugLevel: this.debugLevel,
      logs: [],
      performance: [],
      errors: [],
      athenaInteractions: [],
      metadata,
    };

    this.debugSessions.set(sessionId, session;

    this.debugLog(sessionId, 'info', `Debug session started for ${component}`, LogContext.SYSTEM, {`
      session_id: sessionId,
      debug_level: this.debugLevel,
      metadata,
    });

    return sessionId;
  }

  // End a debug session
  async endDebugSession(sessionId: string: Promise<string> {
    const session = this.debugSessions.get(sessionId);
    if (!session) {
      throw new Error(`Debug session ${sessionId} not found`);
    }

    session.endTime = new Date();

    this.debugLog(
      sessionId,
      'info',
      `Debug session ended for ${session.component}`,
      LogContext.SYSTEM,
      {
        session_id: sessionId,
        duration: session.endTime.getTime() - session.startTime.getTime(),
      }
    );

    // Generate debug report
    const reportPath = await this.generateDebugReport(session);

    // Clean up
    this.debugSessions.delete(sessionId);

    return reportPath;
  }

  // Debug logging with session context
  debugLog(
    sessionId: string,
    level: string,
    message: string,
    context: LogContext,
    data?: any,
    includeStack = false
  ) {
    const session = this.debugSessions.get(sessionId);
    if (!session) {
      console.warn(`Debug session ${sessionId} not found for logging`);
      return;
    }

    const debugLog: DebugLog = {
      timestamp: new Date(),
      level,
      message,
      context: context.toString(),
      data,
      stackTrace: includeStack ? new Error().stack : undefined,
    };

    session.logs.push(debugLog);

    // Also log to main logger if verbose mode
    if (this.debugLevel === 'verbose' || this.debugLevel === 'trace') {
      logger.debug(`[DEBUG:${sessionId}] ${message}`, context, {`
        debug_session: sessionId,
        component: session.component,
        ...data,
      });
    }
  }

  // Performance tracing
  startPerformanceTrace(
    sessionId: string,
    operation: string,
    metadata?: Record<string, unknown>
  ): string {
    const traceId = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.performanceTimers.set(traceId, performance.now());

    this.debugLog(
      sessionId,
      'debug',
      `Performance trace started: ${operation}`,
      LogContext.PERFORMANCE,
      {
        trace_id: traceId,
        operation,
        metadata,
      }
    );

    return traceId;
  }

  endPerformanceTrace(
    sessionId: string,
    traceId: string,
    operation: string,
    metadata?: Record<string, unknown>
  ) {
    const session = this.debugSessions.get(sessionId);
    const startTime = this.performanceTimers.get(traceId);

    if (!session || !startTime) {
      console.warn(`Performance trace ${traceId} or session ${sessionId} not found`);
      return;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    const memoryAfter = process.memoryUsage();

    const trace: PerformanceTrace = {
      operation,
      startTime,
      endTime,
      duration,
      memoryBefore: session.metadata.initialMemory || process.memoryUsage(),
      memoryAfter,
      metadata,
    };

    session.performance.push(trace);
    this.performanceTimers.delete(traceId);

    this.debugLog(
      sessionId,
      'debug',
      `Performance trace completed: ${operation}`,
      LogContext.PERFORMANCE,
      {
        trace_id: traceId,
        duration_ms: duration,
        memory_delta: memoryAfter.heapUsed - (session.metadata.initialMemory?.heapUsed || 0),
      }
    );

    // Record in Prometheus if enabled
    if (metadata?.recordMetrics !== false) {
      metricsCollector.recordTestExecution('debug', 'performance_trace', 'completed', duration);
    }
  }

  // Error tracking
  trackError(sessionId: string, error Error, context: string, metadata?: Record<string, unknown>) {
    const session = this.debugSessions.get(sessionId);
    if (!session) {
      console.warn(`Debug session ${sessionId} not found for error tracking`);
      return;
    }

    const errorTrace: ErrorTrace = {
      _error
      timestamp: new Date(),
      context,
      stackTrace: error.stack || '',
      metadata,
    };

    session.errors.push(errorTrace);

    this.debugLog(
      sessionId,
      '_error,
      `Error tracked: ${error.message}`,
      LogContext.SYSTEM,
      {
        error_type: errorconstructor.name,
        context,
        metadata,
      },
      true
    );

    // Also log to main error tracking
    logger.trackError(_error LogContext.SYSTEM, {
      debug_session: sessionId,
      component: session.component,
      context,
      ...metadata,
    });
  }

  // Sweet Athena interaction debugging
  debugAthenaInteraction(sessionId: string, interactionData: Partial<AthenaDebugData>) {
    const session = this.debugSessions.get(sessionId);
    if (!session) {
      console.warn(`Debug session ${sessionId} not found for Athena debugging`);
      return;
    }

    const athenaDebug: AthenaDebugData = {
      interactionId: `athena_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      interactionType: interactionData.interactionType || 'unknown',
      personalityMood: interactionData.personalityMood || 'sweet',
      sweetnessLevel: interactionData.sweetnessLevel || 8,
      responseTime: interactionData.responseTime || 0,
      userInput: interactionData.userInput,
      athenaResponse: interactionData.athenaResponse,
      animationState: interactionData.animationState,
      renderingMetrics: interactionData.renderingMetrics,
      conversationContext: interactionData.conversationContext,
      errors: interactionData.errors || [],
    };

    session.athenaInteractions.push(athenaDebug);

    this.debugLog(
      sessionId,
      'info',
      `Athena interaction debugged: ${athenaDebug.interactionType}`,
      LogContext.ATHENA,
      {
        interaction_id: athenaDebug.interactionId,
        mood: athenaDebug.personalityMood,
        sweetness: athenaDebug.sweetnessLevel,
        response_time: athenaDebug.responseTime,
        has_errors: athenaDebug.errors ? athenaDebug.errors.length > 0 : false,
      }
    );

    // Record metrics if this is a significant interaction
    if (athenaDebug.responseTime > 0) {
      metricsCollector.recordAthenaInteraction(
        athenaDebug.interactionType,
        athenaDebug.personalityMood,
        sessionId,
        sessionId,
        athenaDebug.responseTime,
        athenaDebug.sweetnessLevel
      );
    }
  }

  // Test result aggregation
  aggregateTestResults(testSuite: string, results: TestResultSummary[]): TestAggregationData {
    const totalTests = results.length;
    const passed = results.filter((r) => r.status === 'pass').length;
    const failed = results.filter((r) => r.status === 'fail').length;
    const skipped = results.filter((r) => r.status === 'skip').length;
    const duration = results.reduce((sum, r) => sum + r.duration, 0);

    // Analyze failures
    const failureAnalysis = this.analyzeTestFailures(results.filter((r) => r.status === 'fail'));

    // Calculate performance metrics
    const performanceMetrics = this.calculateTestPerformanceMetrics(testSuite, results;

    const aggregation: TestAggregationData = {
      testSuite,
      testResults: results,
      totalTests,
      passed,
      failed,
      skipped,
      duration,
      failureAnalysis,
      performanceMetrics: [performanceMetrics],
    };

    this.testAggregations.set(testSuite, aggregation;

    logger.info(`Test aggregation completed for ${testSuite}`, LogContext.TEST, {`
      test_suite: testSuite,
      total_tests: totalTests,
      passed,
      failed,
      skipped,
      duration_ms: duration,
      success_rate: `${((passed / totalTests) * 100).toFixed(2)}%`,
    });

    return aggregation;
  }

  // Analyze test failures for common patterns
  private analyzeTestFailures(failedTests: TestResultSummary[]): TestFailureAnalysis[] {
    const analysisMap = new Map<string, TestFailureAnalysis>();

    failedTests.forEach((test) => {
      if (!test._error return;

      const errorType = this.categorizeError(test._error);

      if (!analysisMap.has(errorType)) {
        analysisMap.set(errorType, {
          testName: test.testName,
          failureType: errorType,
          commonErrors: [],
          suggestedFixes: [],
          relatedIssues: [],
        });
      }

      const_analysis= analysisMap.get(errorType)!;
      if (!_analysiscommonErrors.includes(test._error) {
        _analysiscommonErrors.push(test._error);
      }

      // Add suggested fixes based on_errortype
      const fixes = this.getSuggestedFixes(errorType, test._error);
      fixes.forEach((fix) => {
        if (!_analysissuggestedFixes.includes(fix)) {
          _analysissuggestedFixes.push(fix);
        }
      });
    });

    return Array.from(analysisMap.values());
  }

  private categorizeError(_error: string {
    if (_errorincludes('timeout')) return 'timeout';
    if (_errorincludes('assertion') || _errorincludes('expect')) return 'assertion';
    if (_errorincludes('network') || _errorincludes('fetch')) return 'network';
    if (_errorincludes('memory') || _errorincludes('heap')) return 'memory';
    if (_errorincludes('athena') || _errorincludes('avatar')) return 'athena';
    if (_errorincludes('database') || _errorincludes('sql')) return 'database';
    return 'general';
  }

  private getSuggestedFixes(errorType: string, error: string[] {
    const fixes: string[] = [];

    switch (errorType) {
      case 'timeout':
        fixes.push('Increase test timeout value');
        fixes.push('Optimize slow operations');
        fixes.push('Add retry logic for flaky operations');
        break;
      case 'assertion':
        fixes.push('Check expected vs actual values');
        fixes.push('Verify test data setup');
        fixes.push('Review assertion logic');
        break;
      case 'network':
        fixes.push('Mock network requests in tests');
        fixes.push('Check network connectivity');
        fixes.push('Verify API endpoints');
        break;
      case 'memory':
        fixes.push('Check for memory leaks');
        fixes.push('Increase heap size');
        fixes.push('Optimize memory usage');
        break;
      case 'athena':
        fixes.push('Verify Sweet Athena configuration');
        fixes.push('Check avatar rendering pipeline');
        fixes.push('Validate personality settings');
        break;
      case 'database':
        fixes.push('Check database connection');
        fixes.push('Verify test data setup');
        fixes.push('Review database schema');
        break;
    }

    return fixes;
  }

  private calculateTestPerformanceMetrics(
    testSuite: string,
    results: TestResultSummary[]
  ): TestPerformanceMetrics {
    const durations = results.map((r) => r.duration);
    const averageDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;

    const slowestTests = results;
      .sort((a, b => b.duration - a.duration)
      .slice(0, 5)
      .map((r) => ({ name: r.testName, duration: r.duration }));

    // Detect unstable tests (those that sometimes pass, sometimes: fail
    const unstableTests = results;
      .filter((r) => r.testName.includes('flaky') || r.duration > averageDuration * 3)
      .map((r) => r.testName);

    return {
      testSuite,
      averageDuration,
      slowestTests,
      memoryLeaks: [], // Would need additional tracking for memory leaks
      unstableTests,
    };
  }

  // Generate comprehensive debug report
  private async generateDebugReport(session: DebugSession: Promise<string> {
    const report = {
      session_info: {
        session_id: session.sessionId,
        component: session.component,
        debug_level: session.debugLevel,
        start_time: session.startTime.toISOString(),
        end_time: session.endTime?.toISOString(),
        duration_ms: session.endTime ? session.endTime.getTime() - session.startTime.getTime() : 0,
        metadata: session.metadata,
      },
      summary: {
        total_logs: session.logs.length,
        error_count: session.errors.length,
        performance_traces: session.performance.length,
        athena_interactions: session.athenaInteractions.length,
        log_levels: this.aggregateLogLevels(session.logs),
      },
      performance_analysis {
        traces: session.performance,
        slowest_operations: session.performance
          .sort((a, b => b.duration - a.duration)
          .slice(0, 10),
        memory_analysis this.analyzeMemoryUsage(session.performance),
      },
      error_analysis {
        errors: session.errors,
        error_patterns: this.analyzeErrorPatterns(session.errors),
        most_common_errors: this.getMostCommonErrors(session.errors),
      },
      athena_analysis
        session.athenaInteractions.length > 0
          ? {
              interactions: session.athenaInteractions,
              avg_response_time: this.calculateAverageResponseTime(session.athenaInteractions),
              mood_distribution: this.analyzeMoodDistribution(session.athenaInteractions),
              performance_issues: this.identifyAthenaPerformanceIssues(session.athenaInteractions),
            }
          : null,
      logs:
        session.debugLevel === 'trace'
          ? session.logs
          : session.logs.filter((l) => l.level === '_error || l.level === 'warn'),
      recommendations: this.generateRecommendations(session),
    };

    const filename = `debug_report_${session.sessionId}.json`;
    const filepath = path.join(this.debugDir, filename;

    try {
      await fs.writeFile(filepath, JSON.stringify(report, null, 2));

      logger.info(`Debug report generated`, LogContext.SYSTEM, {`
        session_id: session.sessionId,
        component: session.component,
        report_path: filepath,
        summary: report.summary,
      });

      return filepath;
    } catch (error) {
      logger.error(Failed to generate debug report`, {`
        session_id: session.sessionId,
        _error error instanceof Error ? error.message : String(_error,
      });
      throw error;
    }
  }

  // Helper methods for report generation
  private aggregateLogLevels(logs: DebugLog[]): Record<string, number> {
    return logs.reduce(
      (acc, log => {
        acc[log.level] = (acc[log.level] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }

  private analyzeMemoryUsage(traces: PerformanceTrace[])): any {
    if (traces.length === 0) return null;

    const memoryDeltas = traces.map((t) => t.memoryAfter.heapUsed - t.memoryBefore.heapUsed);
    return {
      total_memory_change: memoryDeltas.reduce((sum, delta => sum + delta, 0),
      average_memory_change:
        memoryDeltas.reduce((sum, delta => sum + delta, 0) / memoryDeltas.length,
      max_memory_increase: Math.max(...memoryDeltas),
      potential_leaks: traces.filter(
        (t) => t.memoryAfter.heapUsed - t.memoryBefore.heapUsed > 10 * 1024 * 1024
      ), // 10MB+
    };
  }

  private analyzeErrorPatterns(errors: ErrorTrace[])): any {
    const patterns = errors.reduce(
      (acc, error => {
        const type = _error_errorconstructor.name;
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      error_types: patterns,
      most_common: Object.entries(patterns).sort(([, a], [, b]) => b - a)[0],
      error_frequency:
        errors.length > 0
          ? (errors.length / (Date.now() - errors[0].timestamp.getTime())) * 1000
          : 0,
    };
  }

  private getMostCommonErrors(errors: ErrorTrace[]): string[] {
    const errorMessages = errors.map((e) => e.error.message);
    const frequency = errorMessages.reduce(
      (acc, msg => {
        acc[msg] = (acc[msg] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return Object.entries(frequency);
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([msg]) => msg);
  }

  private calculateAverageResponseTime(interactions: AthenaDebugData[]): number {
    if (interactions.length === 0) return 0;
    return interactions.reduce((sum, i) => sum + i.responseTime, 0) / interactions.length;
  }

  private analyzeMoodDistribution(interactions: AthenaDebugData[]): Record<string, number> {
    return interactions.reduce(
      (acc, interaction => {
        acc[interaction.personalityMood] = (acc[interaction.personalityMood] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }

  private identifyAthenaPerformanceIssues(interactions: AthenaDebugData[]): string[] {
    const issues: string[] = [];
    const avgResponseTime = this.calculateAverageResponseTime(interactions);

    if (avgResponseTime > 2000) {
      issues.push('High average response time detected');
    }

    const slowInteractions = interactions.filter((i) => i.responseTime > 5000);
    if (slowInteractions.length > 0) {
      issues.push(`${slowInteractions.length} very slow interactions detected`);
    }

    const renderingIssues = interactions.filter(
      (i) =>
        i.renderingMetrics &&
        (i.renderingMetrics.frameRate < 30 || i.renderingMetrics.renderTime > 100)
    );
    if (renderingIssues.length > 0) {
      issues.push(`${renderingIssues.length} rendering performance issues detected`);
    }

    return issues;
  }

  private generateRecommendations(session: DebugSession: string[] {
    const recommendations: string[] = [];

    // Performance recommendations
    const slowTraces = session.performance.filter((t) => t.duration > 1000);
    if (slowTraces.length > 0) {
      recommendations.push(`Optimize ${slowTraces.length} slow operations (>1s: duration`);
    }

    // Memory recommendations
    const memoryLeaks = session.performance.filter(
      (t) => t.memoryAfter.heapUsed - t.memoryBefore.heapUsed > 10 * 1024 * 1024
    );
    if (memoryLeaks.length > 0) {
      recommendations.push(
        `Investigate potential memory leaks in ${memoryLeaks.length} operations``
      );
    }

    // Error recommendations
    if (session.errors.length > 0) {
      recommendations.push(`Address ${session.errors.length} errors detected during debugging`);
    }

    // Athena recommendations
    const athenaIssues = this.identifyAthenaPerformanceIssues(session.athenaInteractions);
    recommendations.push(...athenaIssues.map((issue) => `Athena: ${issue}`));`

    return recommendations;
  }

  // Get all test aggregations
  getAllTestAggregations(): TestAggregationData[] {
    return Array.from(this.testAggregations.values());
  }

  // Export debug session data
  async exportDebugSession(sessionId: string, format: 'json' | 'csv' = 'json'): Promise<string> {
    const session = this.debugSessions.get(sessionId);
    if (!session) {
      throw new Error(`Debug session ${sessionId} not found`);
    }

    const filename = `debug_export_${sessionId}.${format}`;
    const filepath = path.join(this.debugDir, filename;

    if (format === 'json') {
      await fs.writeFile(filepath, JSON.stringify(session, null, 2));
    } else {
      // CSV export would require additional formatting logic
      throw new Error('CSV export not yet implemented');
    }

    return filepath;
  }

  // Cleanup old debug sessions
  async cleanup(maxAge: number = 7 * 24 * 60 * 60 * 1000) {
    // 7 days default
    const cutoff = Date.now() - maxAge;

    for (const [sessionId, session] of this.debugSessions.entries()) {
      if (session.startTime.getTime() < cutoff) {
        this.debugSessions.delete(sessionId);
      }
    }

    // Clean up old debug files
    try {
      const files = await fs.readdir(this.debugDir);
      for (const file of files) {
        const filepath = path.join(this.debugDir, file;
        const stats = await fs.stat(filepath);
        if (stats.mtime.getTime() < cutoff) {
          await fs.unlink(filepath);
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup debug file, LogContext.SYSTEM, {
        _error error instanceof Error ? error.message : String(_error,
      });
    }
  }
}

// Create singleton instance
export const debugTools = new DebugTools();

// Convenience functions
export const startDebugSession = (component: string, metadata?: Record<string, unknown>) =>;
  debugTools.startDebugSession(component, metadata;

export const endDebugSession = (sessionId): string => debugTools.endDebugSession(sessionId);

export const debugLog = (;
  sessionId: string,
  level: string,
  message: string,
  context: LogContext,
  data?: any
) => debugTools.debugLog(sessionId, level, message, context, data;

export const trackError = (;
  sessionId: string,
  _error Error,
  context: string,
  metadata?: Record<string, unknown>
) => debugTools.trackError(sessionId, error context, metadata;

export const debugAthenaInteraction = (;
  sessionId: string,
  interactionData: Partial<AthenaDebugData>
) => debugTools.debugAthenaInteraction(sessionId, interactionData;

export const aggregateTestResults = (testSuite: string, results: TestResultSummary[]) =>;
  debugTools.aggregateTestResults(testSuite, results;

export default debugTools;
