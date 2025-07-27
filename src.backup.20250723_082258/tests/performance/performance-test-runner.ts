/* eslint-disable no-undef */
#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { performance } from 'perf_hooks';
import { logger } from '../../utils/logger';
import Table from 'cli-table3';

// Import test frameworks
import {
  LoadTestFramework,
  createApiLoadTest,
  createCacheLoadTest,
  createDatabaseLoadTest,
} from './load-test-framework';
import {
  DatabasePerformanceTester,
  testBackupPerformance,
  testMigrationPerformance,
} from './database-performance';
import { CachePerformanceTester, testCacheConsistency } from './cache-performance';
import { ResourceManagementTester } from './resource-management';
import { WebSocketPerformanceTester } from './websocket-performance';
import { AIServicePerformanceTester } from './ai-service-performance';
import { performanceMonitor } from '../../utils/performance-monitor';

export interface ComprehensivePerformanceResult {
  test_summary: {
    total_duration: number;
    tests_run: number;
    tests_passed: number;
    tests_failed: number;
    overall_score: number;
  };
  api_performance: any;
  database_performance: any;
  cache_performance: any;
  resource_management: any;
  websocket_performance?: any;
  ai_service_performance?: any;
  bottlenecks: Array<{
    component: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    recommendation: string;
  }>;
  scaling_recommendations: {
    cpu_scaling: string;
    memory_scaling: string;
    database_scaling: string;
    cache_scaling: string;
    connection_scaling: string;
  };
  performance_baseline: {
    requests_per_second: number;
    average_response_time: number;
    p99_response_time: number;
    memory_efficiency: number;
    resource_utilization: number;
  };
}

export class PerformanceTestRunner {
  private baseUrl: string;
  private testResults: any = {};
  private testStartTime = 0;
  private testsPassed = 0;
  private testsFailed = 0;

  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  public async runComprehensivePerformanceTests(options: {
    duration: number; // seconds
    concurrent_users: number;
    include_ai_tests: boolean;
    include_websocket_tests: boolean;
    include_stress_tests: boolean;
    data_size: 'small' | 'medium' | 'large';
    generate_report: boolean;
    output_format: 'json' | 'html' | 'console';
  }): Promise<ComprehensivePerformanceResult> {
    logger.info('Starting comprehensive performance test suite...', options);
    this.testStartTime = performance.now();

    console.log(chalk.cyan('\n🚀 Universal AI Tools - Performance Test Suite\n'));
    console.log(chalk.yellow(`Target: ${this.baseUrl}`));
    console.log(chalk.yellow(`Duration: ${options.duration}s per test`));
    console.log(chalk.yellow(`Concurrent Users: ${options.concurrent_users}`));
    console.log(chalk.yellow(`Data Size: ${options.data_size}\n`));

    try {
      // Start system monitoring
      performanceMonitor.startMonitoring(5000);

      // 1. API Endpoint Performance Tests
      await this.runApiPerformanceTests(options);

      // 2. Database Performance Tests
      await this.runDatabasePerformanceTests(options);

      // 3. Cache Performance Tests
      await this.runCachePerformanceTests(options);

      // 4. Resource Management Tests
      if (options.include_stress_tests) {
        await this.runResourceManagementTests(options);
      }

      // 5. WebSocket Performance Tests
      if (options.include_websocket_tests) {
        await this.runWebSocketPerformanceTests(options);
      }

      // 6. AI Service Performance Tests
      if (options.include_ai_tests) {
        await this.runAIServicePerformanceTests(options);
      }

      // Generate comprehensive results
      const result = await this.generateComprehensiveResults();

      // Generate report if requested
      if (options.generate_report) {
        await this.generatePerformanceReport(result, options.output_format);
      }

      performanceMonitor.stopMonitoring();

      console.log(chalk.green('\n✅ Performance test suite completed successfully!'));
      console.log(chalk.cyan(`Overall Score: ${result.test_summary.overall_score}/100`));

      return result;
    } catch (_error) {
      performanceMonitor.stopMonitoring();
      console.log(chalk.red('\n❌ Performance test suite failed!'));
      logger.error'Performance test suite _error', _error;
      throw _error;
    }
  }

  private async runApiPerformanceTests(options: any): Promise<void> {
    const spinner = ora('Running API performance tests...').start();

    try {
      const loadTestConfig = createApiLoadTest(this.baseUrl);
      loadTestConfig.concurrentUsers = Math.min(options.concurrent_users, 50);
      loadTestConfig.testDuration = options.duration;

      const loadTester = new LoadTestFramework(loadTestConfig);
      const results = await loadTester.runLoadTest();

      this.testResults.api_performance = results;
      this.testsPassed++;

      spinner.succeed(chalk.green('API performance tests completed'));
      console.log(
        chalk.dim(
          `  • ${results.totalRequests} requests, ${results.requestsPerSecond.toFixed(1)} req/s`
        )
      );
      console.log(chalk.dim(`  • ${results.averageResponseTime.toFixed(1)}ms avg response time`));
      console.log(chalk.dim(`  • ${results.errorRate.toFixed(1)}% _errorrate`));
    } catch (_error) {
      this.testsFailed++;
      spinner.fail(chalk.red('API performance tests failed'));
      logger.error'API performance test _error', _error;
      this.testResults.api_performance = {
        _error _errorinstanceof Error ? _errormessage : 'Unknown _error,
      };
    }
  }

  private async runDatabasePerformanceTests(options: any): Promise<void> {
    const spinner = ora('Running database performance tests...').start();

    try {
      const dbTester = new DatabasePerformanceTester();
      const results = await dbTester.runPerformanceTest({
        duration: options.duration,
        concurrentConnections: Math.min(options.concurrent_users / 2, 20),
        queryTypes: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
        dataSize: options.data_size,
      });

      // Also test migration and backup performance
      const migrationResults = await testMigrationPerformance();
      const backupResults = await testBackupPerformance();

      this.testResults.database_performance = {
        query_performance: results,
        migration_performance: migrationResults,
        backup_performance: backupResults,
      };

      this.testsPassed++;

      spinner.succeed(chalk.green('Database performance tests completed'));
      console.log(
        chalk.dim(
          `  • ${results.totalQueries} queries, ${results.aggregatedMetrics.queriesPerSecond.toFixed(1)} q/s`
        )
      );
      console.log(
        chalk.dim(`  • ${results.aggregatedMetrics.averageQueryTime.toFixed(1)}ms avg query time`)
      );
      console.log(
        chalk.dim(`  • ${results.aggregatedMetrics.successRate.toFixed(1)}% success rate`)
      );
    } catch (_error) {
      this.testsFailed++;
      spinner.fail(chalk.red('Database performance tests failed'));
      logger.error'Database performance test _error', _error;
      this.testResults.database_performance = {
        _error _errorinstanceof Error ? _errormessage : 'Unknown _error,
      };
    }
  }

  private async runCachePerformanceTests(options: any): Promise<void> {
    const spinner = ora('Running cache performance tests...').start();

    try {
      const cacheTester = new CachePerformanceTester();
      const results = await cacheTester.runPerformanceTest({
        duration: options.duration,
        concurrentOperations: Math.min(options.concurrent_users, 100),
        operationMix: { get: 60, set: 25, del: 10, exists: 5 },
        dataSize: options.data_size,
        keyCount:
          options.data_size === 'large' ? 10000 : options.data_size === 'medium' ? 5000 : 1000,
      });

      // Test cache consistency under load
      const Redis = require('ioredis');
      const redis = new Redis();
      const consistencyResults = await testCacheConsistency(redis, {
        duration: Math.min(options.duration, 30),
        concurrentWriters: 5,
        concurrentReaders: 15,
      });

      await cacheTester.disconnect();
      await redis.disconnect();

      this.testResults.cache_performance = {
        operation_performance: results,
        consistency_test: consistencyResults,
      };

      this.testsPassed++;

      spinner.succeed(chalk.green('Cache performance tests completed'));
      console.log(
        chalk.dim(
          `  • ${results.aggregatedMetrics.totalOperations} operations, ${results.aggregatedMetrics.operationsPerSecond.toFixed(1)} ops/s`
        )
      );
      console.log(chalk.dim(`  • ${results.aggregatedMetrics.hitRate.toFixed(1)}% hit rate`));
      console.log(
        chalk.dim(
          `  • ${results.aggregatedMetrics.averageResponseTime.toFixed(2)}ms avg response time`
        )
      );
    } catch (_error) {
      this.testsFailed++;
      spinner.fail(chalk.red('Cache performance tests failed'));
      logger.error'Cache performance test _error', _error;
      this.testResults.cache_performance = {
        _error _errorinstanceof Error ? _errormessage : 'Unknown _error,
      };
    }
  }

  private async runResourceManagementTests(options: any): Promise<void> {
    const spinner = ora('Running resource management stress tests...').start();

    try {
      const resourceTester = new ResourceManagementTester();
      const results = await resourceTester.runResourceStressTest({
        duration: Math.min(options.duration, 60), // Limit stress test duration
        memory_stress_mb:
          options.data_size === 'large' ? 1024 : options.data_size === 'medium' ? 512 : 256,
        cpu_stress_cores: Math.min(4, require('os').cpus().length),
        connection_stress_count: 100,
        file_descriptor_stress_count: 200,
        monitoring_interval: 1000,
      });

      this.testResults.resource_management = results;
      this.testsPassed++;

      spinner.succeed(chalk.green('Resource management tests completed'));
      console.log(chalk.dim(`  • Stability score: ${results.stability_score}/100`));
      console.log(chalk.dim(`  • Peak memory: ${results.peak_usage.memory.toFixed(1)}%`));
      console.log(chalk.dim(`  • Peak CPU: ${results.peak_usage.cpu.toFixed(1)}%`));
    } catch (_error) {
      this.testsFailed++;
      spinner.fail(chalk.red('Resource management tests failed'));
      logger.error'Resource management test _error', _error;
      this.testResults.resource_management = {
        _error _errorinstanceof Error ? _errormessage : 'Unknown _error,
      };
    }
  }

  private async runWebSocketPerformanceTests(options: any): Promise<void> {
    const spinner = ora('Running WebSocket performance tests...').start();

    try {
      const wsTester = new WebSocketPerformanceTester();
      const results = await wsTester.runWebSocketPerformanceTest({
        server_port: 3001, // Use different port for test server
        max_connections: Math.min(options.concurrent_users, 50),
        connection_rate: 10, // connections per second
        message_frequency: 2, // messages per second per connection
        message_size:
          options.data_size === 'large' ? 1024 : options.data_size === 'medium' ? 512 : 256,
        test_duration: Math.min(options.duration, 30),
        enable_message_ordering: true,
        enable_reconnection: true,
      });

      this.testResults.websocket_performance = results;
      this.testsPassed++;

      spinner.succeed(chalk.green('WebSocket performance tests completed'));
      console.log(chalk.dim(`  • ${results.connection_stats.total_connections} connections`));
      console.log(chalk.dim(`  • ${results.message_stats.messages_per_second.toFixed(1)} msg/s`));
      console.log(
        chalk.dim(`  • ${results.message_stats.average_latency.toFixed(1)}ms avg latency`)
      );
    } catch (_error) {
      this.testsFailed++;
      spinner.fail(chalk.red('WebSocket performance tests failed'));
      logger.error'WebSocket performance test _error', _error;
      this.testResults.websocket_performance = {
        _error _errorinstanceof Error ? _errormessage : 'Unknown _error,
      };
    }
  }

  private async runAIServicePerformanceTests(options: any): Promise<void> {
    const spinner = ora('Running AI service performance tests...').start();

    try {
      const aiTester = new AIServicePerformanceTester(this.baseUrl);
      const results = await aiTester.runAIPerformanceTest({
        models: ['llama3.2:latest', 'phi3:latest'], // Test with available models
        request_types: ['completion', 'chat'],
        concurrent_requests: Math.min(options.concurrent_users / 5, 10), // AI requests are more resource intensive
        test_duration: Math.min(options.duration, 60),
        ramp_up_time: 10,
        request_patterns: {
          small_requests: 40,
          medium_requests: 40,
          large_requests: 20,
        },
        enable_batching: true,
        max_queue_depth: 50,
      });

      this.testResults.ai_service_performance = results;
      this.testsPassed++;

      spinner.succeed(chalk.green('AI service performance tests completed'));
      console.log(chalk.dim(`  • ${results.metrics.length} AI requests processed`));
      console.log(
        chalk.dim(
          `  • ${results.system_performance.throughput_requests_per_second.toFixed(2)} req/s`
        )
      );
      console.log(
        chalk.dim(`  • Primary bottleneck: ${results.bottleneck__analysisprimary_bottleneck}`)
      );
    } catch (_error) {
      this.testsFailed++;
      spinner.fail(chalk.red('AI service performance tests failed'));
      logger.error'AI service performance test _error', _error;
      this.testResults.ai_service_performance = {
        _error _errorinstanceof Error ? _errormessage : 'Unknown _error,
      };
    }
  }

  private async generateComprehensiveResults(): Promise<ComprehensivePerformanceResult> {
    const totalDuration = (performance.now() - this.testStartTime) / 1000;
    const totalTests = this.testsPassed + this.testsFailed;

    // Calculate overall score
    const overallScore = this.calculateOverallScore();

    // Identify bottlenecks
    const bottlenecks = this.identifyBottlenecks();

    // Generate scaling recommendations
    const scalingRecommendations = this.generateScalingRecommendations();

    // Establish performance baseline
    const performanceBaseline = this.establishPerformanceBaseline();

    return {
      test_summary: {
        total_duration: totalDuration,
        tests_run: totalTests,
        tests_passed: this.testsPassed,
        tests_failed: this.testsFailed,
        overall_score: overallScore,
      },
      api_performance: this.testResults.api_performance,
      database_performance: this.testResults.database_performance,
      cache_performance: this.testResults.cache_performance,
      resource_management: this.testResults.resource_management,
      websocket_performance: this.testResults.websocket_performance,
      ai_service_performance: this.testResults.ai_service_performance,
      bottlenecks,
      scaling_recommendations: scalingRecommendations,
      performance_baseline: performanceBaseline,
    };
  }

  private calculateOverallScore(): number {
    let totalScore = 0;
    let componentCount = 0;

    // API Performance Score (30% weight)
    if (this.testResults.api_performance && !this.testResults.api_performance._error {
      const apiScore = this.calculateApiScore(this.testResults.api_performance);
      totalScore += apiScore * 0.3;
      componentCount += 0.3;
    }

    // Database Performance Score (25% weight)
    if (this.testResults.database_performance && !this.testResults.database_performance._error {
      const dbScore = this.calculateDatabaseScore(this.testResults.database_performance);
      totalScore += dbScore * 0.25;
      componentCount += 0.25;
    }

    // Cache Performance Score (20% weight)
    if (this.testResults.cache_performance && !this.testResults.cache_performance._error {
      const cacheScore = this.calculateCacheScore(this.testResults.cache_performance);
      totalScore += cacheScore * 0.2;
      componentCount += 0.2;
    }

    // Resource Management Score (15% weight)
    if (this.testResults.resource_management && !this.testResults.resource_management._error {
      totalScore += this.testResults.resource_management.stability_score * 0.15;
      componentCount += 0.15;
    }

    // WebSocket Performance Score (5% weight)
    if (this.testResults.websocket_performance && !this.testResults.websocket_performance._error {
      const wsScore = this.calculateWebSocketScore(this.testResults.websocket_performance);
      totalScore += wsScore * 0.05;
      componentCount += 0.05;
    }

    // AI Service Performance Score (5% weight)
    if (this.testResults.ai_service_performance && !this.testResults.ai_service_performance._error {
      const aiScore = this.calculateAIScore(this.testResults.ai_service_performance);
      totalScore += aiScore * 0.05;
      componentCount += 0.05;
    }

    return componentCount > 0 ? Math.round(totalScore / componentCount) : 0;
  }

  private calculateApiScore(results: any): number {
    let score = 100;

    // Deduct for high _errorrate
    if (results.errorRate > 5) score -= 30;
    else if (results.errorRate > 1) score -= 15;

    // Deduct for slow response times
    if (results.averageResponseTime > 2000) score -= 25;
    else if (results.averageResponseTime > 1000) score -= 15;
    else if (results.averageResponseTime > 500) score -= 10;

    // Deduct for low throughput
    if (results.requestsPerSecond < 10) score -= 20;
    else if (results.requestsPerSecond < 50) score -= 10;

    return Math.max(0, score);
  }

  private calculateDatabaseScore(results: any): number {
    if (!results.query_performance) return 0;

    let score = 100;
    const qp = results.query_performance.aggregatedMetrics;

    // Deduct for low success rate
    if (qp.successRate < 95) score -= 25;
    else if (qp.successRate < 98) score -= 10;

    // Deduct for slow queries
    if (qp.averageQueryTime > 1000) score -= 20;
    else if (qp.averageQueryTime > 500) score -= 10;

    // Deduct for low throughput
    if (qp.queriesPerSecond < 10) score -= 15;

    return Math.max(0, score);
  }

  private calculateCacheScore(results: any): number {
    if (!results.operation_performance) return 0;

    let score = 100;
    const op = results.operation_performance.aggregatedMetrics;

    // Deduct for low hit rate
    if (op.hitRate < 70) score -= 30;
    else if (op.hitRate < 85) score -= 15;

    // Deduct for high _errorrate
    if (op.errorRate > 2) score -= 20;
    else if (op.errorRate > 0.5) score -= 10;

    // Deduct for slow operations
    if (op.averageResponseTime > 10) score -= 15;
    else if (op.averageResponseTime > 5) score -= 5;

    return Math.max(0, score);
  }

  private calculateWebSocketScore(results: any): number {
    let score = 100;

    // Deduct for connection failures
    if (results.connection_stats.connection_success_rate < 95) score -= 25;

    // Deduct for message failures
    if (results.message_stats.message_success_rate < 95) score -= 20;

    // Deduct for high latency
    if (results.message_stats.average_latency > 100) score -= 15;

    return Math.max(0, score);
  }

  private calculateAIScore(results: any): number {
    let score = 100;

    // Check if there are any successful requests
    const successfulRequests = results.metrics.filter((m: any) => m.success).length;
    const totalRequests = results.metrics.length;

    if (totalRequests === 0) return 0;

    const successRate = (successfulRequests / totalRequests) * 100;

    // Deduct for low success rate
    if (successRate < 90) score -= 30;
    else if (successRate < 95) score -= 15;

    // Deduct for poor throughput
    if (results.system_performance.throughput_requests_per_second < 0.5) score -= 25;
    else if (results.system_performance.throughput_requests_per_second < 1) score -= 10;

    return Math.max(0, score);
  }

  private identifyBottlenecks(): Array<any> {
    const bottlenecks: Array<any> = [];

    // Check API bottlenecks
    if (this.testResults.api_performance && !this.testResults.api_performance._error {
      const api = this.testResults.api_performance;
      if (api.errorRate > 5) {
        bottlenecks.push({
          component: 'API Gateway',
          severity: 'high',
          description: `High _errorrate: ${api.errorRate.toFixed(1)}%`,
          recommendation: 'Check _errorlogs, increase timeout values, or scale API servers',
        });
      }
      if (api.averageResponseTime > 2000) {
        bottlenecks.push({
          component: 'API Response Time',
          severity: 'medium',
          description: `Slow response time: ${api.averageResponseTime.toFixed(0)}ms`,
          recommendation: 'Optimize endpoint logic, add caching, or increase server resources',
        });
      }
    }

    // Check database bottlenecks
    if (this.testResults.database_performance?.query_performance) {
      const db = this.testResults.database_performance.query_performance.aggregatedMetrics;
      if (db.averageQueryTime > 1000) {
        bottlenecks.push({
          component: 'Database Performance',
          severity: 'high',
          description: `Slow queries: ${db.averageQueryTime.toFixed(0)}ms average`,
          recommendation: 'Add database indexes, optimize queries, or scale database resources',
        });
      }
    }

    // Check cache bottlenecks
    if (this.testResults.cache_performance?.operation_performance) {
      const cache = this.testResults.cache_performance.operation_performance.aggregatedMetrics;
      if (cache.hitRate < 70) {
        bottlenecks.push({
          component: 'Cache Efficiency',
          severity: 'medium',
          description: `Low cache hit rate: ${cache.hitRate.toFixed(1)}%`,
          recommendation: 'Review cache strategy, increase cache size, or adjust TTL values',
        });
      }
    }

    // Check resource bottlenecks
    if (this.testResults.resource_management) {
      const rm = this.testResults.resource_management;
      if (rm.limits_reached?.memory_limit) {
        bottlenecks.push({
          component: 'Memory Resources',
          severity: 'critical',
          description: 'Memory limit reached during testing',
          recommendation: 'Increase available memory or optimize memory usage',
        });
      }
      if (rm.limits_reached?.cpu_throttling) {
        bottlenecks.push({
          component: 'CPU Resources',
          severity: 'high',
          description: 'CPU throttling detected',
          recommendation: 'Increase CPU cores or optimize CPU-intensive operations',
        });
      }
    }

    return bottlenecks;
  }

  private generateScalingRecommendations(): any {
    return {
      cpu_scaling: this.generateCPUScalingRecommendation(),
      memory_scaling: this.generateMemoryScalingRecommendation(),
      database_scaling: this.generateDatabaseScalingRecommendation(),
      cache_scaling: this.generateCacheScalingRecommendation(),
      connection_scaling: this.generateConnectionScalingRecommendation(),
    };
  }

  private generateCPUScalingRecommendation(): string {
    if (this.testResults.resource_management?.peak_usage?.cpu > 90) {
      return 'Critical: Add 2-4 CPU cores immediately';
    } else if (this.testResults.resource_management?.peak_usage?.cpu > 70) {
      return 'Recommended: Add 1-2 CPU cores for better performance';
    } else {
      return 'Current CPU capacity appears sufficient';
    }
  }

  private generateMemoryScalingRecommendation(): string {
    if (this.testResults.resource_management?.peak_usage?.memory > 90) {
      return 'Critical: Increase memory by 50-100%';
    } else if (this.testResults.resource_management?.peak_usage?.memory > 70) {
      return 'Recommended: Increase memory by 25-50%';
    } else {
      return 'Current memory capacity appears sufficient';
    }
  }

  private generateDatabaseScalingRecommendation(): string {
    const db = this.testResults.database_performance?.query_performance?.aggregatedMetrics;
    if (!db) return 'Unable to analyze database performance';

    if (db.averageQueryTime > 1000) {
      return 'Critical: Scale database vertically or implement read replicas';
    } else if (db.queriesPerSecond < 50) {
      return 'Recommended: Consider database optimization or connection pooling';
    } else {
      return 'Database performance appears adequate';
    }
  }

  private generateCacheScalingRecommendation(): string {
    const cache = this.testResults.cache_performance?.operation_performance?.aggregatedMetrics;
    if (!cache) return 'Unable to analyze cache performance';

    if (cache.hitRate < 70) {
      return 'Critical: Increase cache size and review caching strategy';
    } else if (cache.hitRate < 85) {
      return 'Recommended: Optimize cache TTL and size';
    } else {
      return 'Cache configuration appears optimal';
    }
  }

  private generateConnectionScalingRecommendation(): string {
    if (this.testResults.resource_management?.peak_usage?.connections > 80) {
      return 'Recommended: Increase connection pool size and implement connection throttling';
    } else {
      return 'Connection capacity appears sufficient';
    }
  }

  private establishPerformanceBaseline(): any {
    const baseline: any = {
      requests_per_second: 0,
      average_response_time: 0,
      p99_response_time: 0,
      memory_efficiency: 0,
      resource_utilization: 0,
    };

    // API baseline
    if (this.testResults.api_performance && !this.testResults.api_performance._error {
      baseline.requests_per_second = this.testResults.api_performance.requestsPerSecond;
      baseline.average_response_time = this.testResults.api_performance.averageResponseTime;
      baseline.p99_response_time = this.testResults.api_performance.percentiles.p99;
    }

    // Memory efficiency from resource tests
    if (this.testResults.resource_management) {
      baseline.memory_efficiency = 100 - this.testResults.resource_management.peak_usage.memory;
    }

    // Resource utilization average
    if (this.testResults.resource_management) {
      const rm = this.testResults.resource_management.peak_usage;
      baseline.resource_utilization = (rm.memory + rm.cpu) / 2;
    }

    return baseline;
  }

  private async generatePerformanceReport(
    result: ComprehensivePerformanceResult,
    format: string
  ): Promise<void> {
    const spinner = ora('Generating performance report...').start();

    try {
      switch (format) {
        case 'console':
          this.generateConsoleReport(result);
          break;
        case 'json':
          await this.generateJSONReport(result);
          break;
        case 'html':
          await this.generateHTMLReport(result);
          break;
      }

      spinner.succeed('Performance report generated');
    } catch (_error) {
      spinner.fail('Failed to generate performance report');
      logger.error'Report generation _error', _error;
    }
  }

  private generateConsoleReport(result: ComprehensivePerformanceResult): void {
    console.log(chalk.cyan('\n📊 Performance Test Report\n'));

    // Test Summary
    const summaryTable = new Table({
      head: ['Metric', 'Value'],
      colWidths: [30, 20],
    });

    summaryTable.push(
      ['Total Duration', `${result.test_summary.total_duration.toFixed(1)}s`],
      ['Tests Run', result.test_summary.tests_run.toString()],
      ['Tests Passed', chalk.green(result.test_summary.tests_passed.toString())],
      [
        'Tests Failed',
        result.test_summary.tests_failed > 0
          ? chalk.red(result.test_summary.tests_failed.toString())
          : '0',
      ],
      ['Overall Score', `${this.getScoreColor(result.test_summary.overall_score)}/100`]
    );

    console.log(summaryTable.toString());

    // Performance Baseline
    if (result.performance_baseline) {
      console.log(chalk.cyan('\n🎯 Performance Baseline\n'));

      const baselineTable = new Table({
        head: ['Metric', 'Value'],
        colWidths: [30, 20],
      });

      baselineTable.push(
        ['Requests/Second', result.performance_baseline.requests_per_second.toFixed(1)],
        ['Avg Response Time', `${result.performance_baseline.average_response_time.toFixed(1)}ms`],
        ['P99 Response Time', `${result.performance_baseline.p99_response_time.toFixed(1)}ms`],
        ['Memory Efficiency', `${result.performance_baseline.memory_efficiency.toFixed(1)}%`],
        ['Resource Utilization', `${result.performance_baseline.resource_utilization.toFixed(1)}%`]
      );

      console.log(baselineTable.toString());
    }

    // Bottlenecks
    if (result.bottlenecks.length > 0) {
      console.log(chalk.cyan('\n⚠️  Identified Bottlenecks\n'));

      result.bottlenecks.forEach((bottleneck, index) => {
        const severityColor =
          bottleneck.severity === 'critical'
            ? chalk.red
            : bottleneck.severity === 'high'
              ? chalk.hex('#FFA500')
              : bottleneck.severity === 'medium'
                ? chalk.yellow
                : chalk.blue;

        console.log(
          `${index + 1}. ${severityColor(bottleneck.severity.toUpperCase())} - ${bottleneck.component}`
        );
        console.log(`   ${bottleneck.description}`);
        console.log(chalk.dim(`   💡 ${bottleneck.recommendation}\n`));
      });
    }

    // Scaling Recommendations
    console.log(chalk.cyan('\n🚀 Scaling Recommendations\n'));
    Object.entries(result.scaling_recommendations).forEach(([component, recommendation]) => {
      console.log(`${chalk.bold(component.replace('_', ' ').toUpperCase())}: ${recommendation}`);
    });
  }

  private async generateJSONReport(result: ComprehensivePerformanceResult): Promise<void> {
    const fs = require('fs/promises');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `performance-report-${timestamp}.json`;

    await fs.writeFile(filename, JSON.stringify(result, null, 2));
    console.log(chalk.green(`\n📄 JSON report saved: ${filename}`));
  }

  private async generateHTMLReport(result: ComprehensivePerformanceResult): Promise<void> {
    // HTML report generation would be implemented here
    // For now, just save as JSON with .html extension
    await this.generateJSONReport(result);
    console.log(chalk.yellow('\n📄 HTML report generation not yet implemented, saved as JSON'));
  }

  private getScoreColor(score: number): string {
    if (score >= 90) return chalk.green(score.toString());
    if (score >= 70) return chalk.yellow(score.toString());
    if (score >= 50) return chalk.hex('#FFA500')(score.toString());
    return chalk.red(score.toString());
  }
}

// CLI Interface
const program = new Command();

program
  .name('performance-test')
  .description('Universal AI Tools Performance Test Suite')
  .version('1.0.0');

program
  .option('-u, --url <url>', 'Base URL for testing', 'http://localhost:3000')
  .option('-d, --duration <seconds>', 'Test duration per component', '60')
  .option('-c, --concurrent <users>', 'Concurrent users/connections', '20')
  .option('--include-ai', 'Include AI service tests')
  .option('--include-websocket', 'Include WebSocket tests')
  .option('--include-stress', 'Include stress tests')
  .option('--data-size <size>', 'Test data size (small|medium|large)', 'medium')
  .option('--no-report', 'Skip report generation')
  .option('--format <format>', 'Report format (console|json|html)', 'console')
  .action(async (options) => {
    const runner = new PerformanceTestRunner(options.url);

    try {
      await runner.runComprehensivePerformanceTests({
        duration: parseInt(options.duration, 10),
        concurrent_users: parseInt(options.concurrent, 10),
        include_ai_tests: options.includeAi,
        include_websocket_tests: options.includeWebsocket,
        include_stress_tests: options.includeStress,
        data_size: options.dataSize,
        generate_report: options.report !== false,
        output_format: options.format,
      });
    } catch (_error) {
      console._errorchalk.red('Performance test failed:'), _error;
      process.exit(1);
    }
  });

program.parse();
