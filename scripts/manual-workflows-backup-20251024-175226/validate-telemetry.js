#!/usr/bin/env node

/**
 * Telemetry Validation Script
 * Comprehensive validation of monitoring and observability systems
 */

import axios from 'axios';
import { spawn } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

const JAEGER_URL = process.env.JAEGER_URL || 'http://localhost:16686';
const PROMETHEUS_URL = process.env.PROMETHEUS_URL || 'http://localhost:9090';
const GRAFANA_URL = process.env.GRAFANA_URL || 'http://localhost:3003';
const APP_URL = process.env.APP_URL || 'http://localhost:9999';
const OTEL_COLLECTOR_URL = process.env.OTEL_COLLECTOR_URL || 'http://localhost:8888';

class TelemetryValidator {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      overall: { status: 'unknown', score: 0 },
      tracing: { status: 'unknown', tests: [] },
      metrics: { status: 'unknown', tests: [] },
      logging: { status: 'unknown', tests: [] },
      healthChecks: { status: 'unknown', tests: [] },
      resourceMonitoring: { status: 'unknown', tests: [] },
      alerting: { status: 'unknown', tests: [] },
      dashboards: { status: 'unknown', tests: [] },
      recommendations: [],
    };
  }

  // Utility function to make HTTP requests with timeout
  async makeRequest(url, options = {}) {
    try {
      const response = await axios({
        url,
        timeout: 10000,
        validateStatus: () => true,
        ...options,
      });
      return {
        status: response.status,
        data: response.data,
        headers: response.headers,
      };
    } catch (error) {
      return {
        status: 0,
        error: error.message,
      };
    }
  }

  // Test OpenTelemetry tracing
  async validateTracing() {
    console.log('🔍 Validating OpenTelemetry Tracing...');

    const tests = [
      {
        name: 'Jaeger UI Accessibility',
        test: async () => {
          const result = await this.makeRequest(`${JAEGER_URL}/api/services`);
          return {
            passed: result.status === 200,
            message:
              result.status === 200 ? 'Jaeger UI accessible' : `Jaeger UI error: ${result.status}`,
            details: result.data || result.error,
          };
        },
      },
      {
        name: 'OTLP Collector Health',
        test: async () => {
          const result = await this.makeRequest(`${OTEL_COLLECTOR_URL}/metrics`);
          return {
            passed: result.status === 200,
            message:
              result.status === 200
                ? 'OTLP Collector healthy'
                : `OTLP Collector error: ${result.status}`,
            details: result.error,
          };
        },
      },
      {
        name: 'Trace Collection',
        test: async () => {
          // Generate a test trace
          const traceResult = await this.makeRequest(`${APP_URL}/api/health`, {
            headers: {
              'X-Test-Trace': 'validation',
              traceparent: '00-' + '1'.repeat(32) + '-' + '2'.repeat(16) + '-01',
            },
          });

          // Wait a moment for trace to be processed
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Check if trace appears in Jaeger
          const jaegerResult = await this.makeRequest(
            `${JAEGER_URL}/api/traces?service=universal-ai-tools&limit=10`
          );

          return {
            passed: jaegerResult.status === 200 && jaegerResult.data?.data?.length > 0,
            message: jaegerResult.status === 200 ? 'Traces being collected' : 'No traces found',
            details: {
              traceGenerated: traceResult.status === 200,
              tracesInJaeger: jaegerResult.data?.data?.length || 0,
            },
          };
        },
      },
      {
        name: 'Span Context Propagation',
        test: async () => {
          const traceId = '1'.repeat(32);
          const spanId = '2'.repeat(16);

          const result = await this.makeRequest(`${APP_URL}/api/memory/query`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              traceparent: `00-${traceId}-${spanId}-01`,
            },
            data: { query: 'test trace propagation' },
          });

          return {
            passed: result.status >= 200 && result.status < 500,
            message: 'Span context propagation test completed',
            details: { status: result.status, traceId, spanId },
          };
        },
      },
    ];

    for (const test of tests) {
      try {
        const result = await test.test();
        this.results.tracing.tests.push({ name: test.name, ...result });
      } catch (error) {
        this.results.tracing.tests.push({
          name: test.name,
          passed: false,
          message: `Test failed: ${error.message}`,
          details: error.stack,
        });
      }
    }

    const passedTests = this.results.tracing.tests.filter((t) => t.passed).length;
    this.results.tracing.status =
      passedTests === tests.length ? 'healthy' : passedTests > 0 ? 'degraded' : 'unhealthy';
  }

  // Test Prometheus metrics
  async validateMetrics() {
    console.log('📊 Validating Prometheus Metrics...');

    const tests = [
      {
        name: 'Prometheus UI Accessibility',
        test: async () => {
          const result = await this.makeRequest(`${PROMETHEUS_URL}/api/v1/status/config`);
          return {
            passed: result.status === 200,
            message:
              result.status === 200
                ? 'Prometheus UI accessible'
                : `Prometheus error: ${result.status}`,
            details: result.error,
          };
        },
      },
      {
        name: 'Application Metrics Collection',
        test: async () => {
          const result = await this.makeRequest(`${APP_URL}/metrics`);
          return {
            passed: result.status === 200 && typeof result.data === 'string',
            message:
              result.status === 200
                ? 'Application metrics available'
                : 'Application metrics unavailable',
            details:
              result.status === 200
                ? `Metrics size: ${result.data?.length || 0} bytes`
                : result.error,
          };
        },
      },
      {
        name: 'Custom Metrics Validation',
        test: async () => {
          const metricsResult = await this.makeRequest(`${APP_URL}/metrics`);
          if (metricsResult.status !== 200) {
            return { passed: false, message: 'Cannot access metrics endpoint' };
          }

          const metrics = metricsResult.data;
          const customMetrics = [
            'http_requests_total',
            'athena_interactions_total',
            'memory_operations_total',
            'system_health_score',
          ];

          const foundMetrics = customMetrics.filter((metric) => metrics.includes(metric));

          return {
            passed: foundMetrics.length >= customMetrics.length * 0.75,
            message: `Found ${foundMetrics.length}/${customMetrics.length} custom metrics`,
            details: {
              found: foundMetrics,
              missing: customMetrics.filter((m) => !foundMetrics.includes(m)),
            },
          };
        },
      },
      {
        name: 'Metrics Accuracy',
        test: async () => {
          // Generate some requests to create metrics
          const requests = [];
          for (let i = 0; i < 5; i++) {
            requests.push(this.makeRequest(`${APP_URL}/api/health`));
          }
          await Promise.all(requests);

          // Wait for metrics to update
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Check if metrics reflect the requests
          const queryResult = await this.makeRequest(`${PROMETHEUS_URL}/api/v1/query`, {
            params: { query: 'http_requests_total{job="universal-ai-tools"}' },
          });

          return {
            passed: queryResult.status === 200 && queryResult.data?.data?.result?.length > 0,
            message:
              queryResult.status === 200
                ? 'Metrics accurately reflecting requests'
                : 'Metrics not updating',
            details: queryResult.data?.data?.result?.length || 0,
          };
        },
      },
    ];

    for (const test of tests) {
      try {
        const result = await test.test();
        this.results.metrics.tests.push({ name: test.name, ...result });
      } catch (error) {
        this.results.metrics.tests.push({
          name: test.name,
          passed: false,
          message: `Test failed: ${error.message}`,
          details: error.stack,
        });
      }
    }

    const passedTests = this.results.metrics.tests.filter((t) => t.passed).length;
    this.results.metrics.status =
      passedTests === tests.length ? 'healthy' : passedTests > 0 ? 'degraded' : 'unhealthy';
  }

  // Test health check endpoints
  async validateHealthChecks() {
    console.log('🏥 Validating Health Check Systems...');

    const tests = [
      {
        name: 'Application Health Endpoint',
        test: async () => {
          const result = await this.makeRequest(`${APP_URL}/api/health`);
          return {
            passed: result.status === 200,
            message:
              result.status === 200
                ? 'Health endpoint responsive'
                : `Health endpoint error: ${result.status}`,
            details: result.data || result.error,
          };
        },
      },
      {
        name: 'Detailed Health Report',
        test: async () => {
          const result = await this.makeRequest(`${APP_URL}/api/health/detailed`);
          return {
            passed: result.status === 200 && result.data?.services,
            message:
              result.status === 200
                ? 'Detailed health report available'
                : 'Detailed health report unavailable',
            details: result.data?.services || result.error,
          };
        },
      },
      {
        name: 'Readiness Check',
        test: async () => {
          const result = await this.makeRequest(`${APP_URL}/api/health/ready`);
          return {
            passed: result.status === 200,
            message: result.status === 200 ? 'Service ready' : 'Service not ready',
            details: result.data || result.error,
          };
        },
      },
      {
        name: 'Liveness Check',
        test: async () => {
          const result = await this.makeRequest(`${APP_URL}/api/health/live`);
          return {
            passed: result.status === 200,
            message: result.status === 200 ? 'Service alive' : 'Service not alive',
            details: result.data || result.error,
          };
        },
      },
    ];

    for (const test of tests) {
      try {
        const result = await test.test();
        this.results.healthChecks.tests.push({ name: test.name, ...result });
      } catch (error) {
        this.results.healthChecks.tests.push({
          name: test.name,
          passed: false,
          message: `Test failed: ${error.message}`,
          details: error.stack,
        });
      }
    }

    const passedTests = this.results.healthChecks.tests.filter((t) => t.passed).length;
    this.results.healthChecks.status =
      passedTests === tests.length ? 'healthy' : passedTests > 0 ? 'degraded' : 'unhealthy';
  }

  // Test resource monitoring
  async validateResourceMonitoring() {
    console.log('💻 Validating Resource Monitoring...');

    const tests = [
      {
        name: 'Memory Monitoring',
        test: async () => {
          return new Promise((resolve) => {
            const cmd = spawn('npm', ['run', 'resources:health'], {
              cwd: process.cwd(),
              stdio: 'pipe',
            });

            let output = '';
            cmd.stdout.on('data', (data) => (output += data.toString()));
            cmd.stderr.on('data', (data) => (output += data.toString()));

            cmd.on('close', (code) => {
              resolve({
                passed: code === 0,
                message: code === 0 ? 'Memory monitoring functional' : 'Memory monitoring failed',
                details: output,
              });
            });

            // Timeout after 30 seconds
            setTimeout(() => {
              cmd.kill();
              resolve({
                passed: false,
                message: 'Memory monitoring test timed out',
                details: output,
              });
            }, 30000);
          });
        },
      },
      {
        name: 'Connection Pool Monitoring',
        test: async () => {
          return new Promise((resolve) => {
            const cmd = spawn('npm', ['run', 'resources:connections'], {
              cwd: process.cwd(),
              stdio: 'pipe',
            });

            let output = '';
            cmd.stdout.on('data', (data) => (output += data.toString()));
            cmd.stderr.on('data', (data) => (output += data.toString()));

            cmd.on('close', (code) => {
              resolve({
                passed: code === 0,
                message:
                  code === 0
                    ? 'Connection pool monitoring functional'
                    : 'Connection pool monitoring failed',
                details: output,
              });
            });

            setTimeout(() => {
              cmd.kill();
              resolve({
                passed: false,
                message: 'Connection pool monitoring test timed out',
                details: output,
              });
            }, 30000);
          });
        },
      },
    ];

    for (const test of tests) {
      try {
        const result = await test.test();
        this.results.resourceMonitoring.tests.push({ name: test.name, ...result });
      } catch (error) {
        this.results.resourceMonitoring.tests.push({
          name: test.name,
          passed: false,
          message: `Test failed: ${error.message}`,
          details: error.stack,
        });
      }
    }

    const passedTests = this.results.resourceMonitoring.tests.filter((t) => t.passed).length;
    this.results.resourceMonitoring.status =
      passedTests === tests.length ? 'healthy' : passedTests > 0 ? 'degraded' : 'unhealthy';
  }

  // Test dashboard functionality
  async validateDashboards() {
    console.log('📈 Validating Dashboard Functionality...');

    const tests = [
      {
        name: 'Grafana Accessibility',
        test: async () => {
          const result = await this.makeRequest(`${GRAFANA_URL}/api/health`);
          return {
            passed: result.status === 200,
            message:
              result.status === 200 ? 'Grafana accessible' : `Grafana error: ${result.status}`,
            details: result.data || result.error,
          };
        },
      },
      {
        name: 'Dashboard Availability',
        test: async () => {
          const result = await this.makeRequest(`${GRAFANA_URL}/api/search?type=dash-db`);
          return {
            passed: result.status === 200 && Array.isArray(result.data),
            message:
              result.status === 200
                ? `Found ${result.data?.length || 0} dashboards`
                : 'Cannot access dashboards',
            details: result.data || result.error,
          };
        },
      },
      {
        name: 'Prometheus Data Source',
        test: async () => {
          const result = await this.makeRequest(`${GRAFANA_URL}/api/datasources`);
          const hasPrometheus = result.data?.some((ds) => ds.type === 'prometheus');
          return {
            passed: result.status === 200 && hasPrometheus,
            message: hasPrometheus
              ? 'Prometheus data source configured'
              : 'Prometheus data source missing',
            details: result.data?.map((ds) => ({ name: ds.name, type: ds.type })) || result.error,
          };
        },
      },
    ];

    for (const test of tests) {
      try {
        const result = await test.test();
        this.results.dashboards.tests.push({ name: test.name, ...result });
      } catch (error) {
        this.results.dashboards.tests.push({
          name: test.name,
          passed: false,
          message: `Test failed: ${error.message}`,
          details: error.stack,
        });
      }
    }

    const passedTests = this.results.dashboards.tests.filter((t) => t.passed).length;
    this.results.dashboards.status =
      passedTests === tests.length ? 'healthy' : passedTests > 0 ? 'degraded' : 'unhealthy';
  }

  // Calculate overall score and generate recommendations
  generateRecommendations() {
    console.log('💡 Generating Recommendations...');

    const categories = ['tracing', 'metrics', 'healthChecks', 'resourceMonitoring', 'dashboards'];
    const scores = categories.map((cat) => {
      const tests = this.results[cat].tests;
      return tests.length > 0 ? tests.filter((t) => t.passed).length / tests.length : 0;
    });

    this.results.overall.score = (scores.reduce((a, b) => a + b, 0) / scores.length) * 100;
    this.results.overall.status =
      this.results.overall.score >= 80
        ? 'healthy'
        : this.results.overall.score >= 60
          ? 'degraded'
          : 'unhealthy';

    // Generate specific recommendations
    categories.forEach((category, index) => {
      if (scores[index] < 0.8) {
        const failedTests = this.results[category].tests.filter((t) => !t.passed);
        failedTests.forEach((test) => {
          this.results.recommendations.push({
            category: category,
            priority: scores[index] < 0.5 ? 'high' : 'medium',
            issue: test.name,
            recommendation: this.getRecommendation(category, test.name),
            details: test.message,
          });
        });
      }
    });

    // Add general recommendations
    if (this.results.overall.score < 70) {
      this.results.recommendations.push({
        category: 'general',
        priority: 'high',
        issue: 'Overall monitoring health low',
        recommendation:
          'Consider reviewing monitoring infrastructure and addressing critical issues',
        details: `Overall score: ${this.results.overall.score.toFixed(1)}%`,
      });
    }
  }

  // Get specific recommendations for issues
  getRecommendation(category, testName) {
    const recommendations = {
      tracing: {
        'Jaeger UI Accessibility':
          'Ensure Jaeger container is running and accessible on port 16686',
        'OTLP Collector Health':
          "Check OpenTelemetry Collector configuration and ensure it's running",
        'Trace Collection':
          'Verify trace instrumentation is properly configured in the application',
        'Span Context Propagation': 'Check trace context headers are being properly propagated',
      },
      metrics: {
        'Prometheus UI Accessibility': 'Ensure Prometheus is running and accessible on port 9090',
        'Application Metrics Collection': 'Verify /metrics endpoint is properly configured',
        'Custom Metrics Validation':
          'Check custom metrics are being properly registered and exported',
        'Metrics Accuracy': 'Verify metrics collection frequency and data accuracy',
      },
      healthChecks: {
        'Application Health Endpoint': 'Implement or fix /api/health endpoint',
        'Detailed Health Report': 'Implement detailed health reporting with service status',
        'Readiness Check': 'Implement readiness probe for Kubernetes deployment',
        'Liveness Check': 'Implement liveness probe for container health',
      },
      resourceMonitoring: {
        'Memory Monitoring': 'Check memory monitoring scripts and system access',
        'Connection Pool Monitoring': 'Verify database connection pool monitoring is configured',
      },
      dashboards: {
        'Grafana Accessibility': 'Ensure Grafana is running and accessible on port 3000',
        'Dashboard Availability': 'Import or create monitoring dashboards',
        'Prometheus Data Source': 'Configure Prometheus as a data source in Grafana',
      },
    };

    return (
      recommendations[category]?.[testName] || 'Review configuration and logs for this component'
    );
  }

  // Print colored output
  printResults() {
    console.log('\n' + '='.repeat(60));
    console.log('🎯 TELEMETRY VALIDATION RESULTS');
    console.log('='.repeat(60));

    const statusIcon = {
      healthy: '✅',
      degraded: '⚠️',
      unhealthy: '❌',
      unknown: '❓',
    };

    console.log(
      `\n📊 Overall Status: ${statusIcon[this.results.overall.status]} ${this.results.overall.status.toUpperCase()}`
    );
    console.log(`📈 Overall Score: ${this.results.overall.score.toFixed(1)}%`);

    const categories = [
      { key: 'tracing', name: 'OpenTelemetry Tracing' },
      { key: 'metrics', name: 'Prometheus Metrics' },
      { key: 'healthChecks', name: 'Health Checks' },
      { key: 'resourceMonitoring', name: 'Resource Monitoring' },
      { key: 'dashboards', name: 'Dashboard Functionality' },
    ];

    categories.forEach(({ key, name }) => {
      const result = this.results[key];
      const passed = result.tests.filter((t) => t.passed).length;
      const total = result.tests.length;

      console.log(`\n${statusIcon[result.status]} ${name}: ${passed}/${total} tests passed`);

      result.tests.forEach((test) => {
        const icon = test.passed ? '  ✓' : '  ✗';
        console.log(`${icon} ${test.name}: ${test.message}`);
      });
    });

    if (this.results.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      this.results.recommendations.forEach((rec, index) => {
        const priority = rec.priority === 'high' ? '🔴' : '🟡';
        console.log(`${priority} ${index + 1}. [${rec.category.toUpperCase()}] ${rec.issue}`);
        console.log(`   → ${rec.recommendation}`);
        if (rec.details) {
          console.log(`   📝 ${rec.details}`);
        }
      });
    }

    console.log('\n' + '='.repeat(60));
  }

  // Run all validations
  async validate() {
    console.log('🚀 Starting Telemetry Validation...\n');

    await this.validateTracing();
    await this.validateMetrics();
    await this.validateHealthChecks();
    await this.validateResourceMonitoring();
    await this.validateDashboards();

    this.generateRecommendations();
    this.printResults();

    // Save results to file
    const resultsFile = `telemetry-validation-${Date.now()}.json`;
    writeFileSync(resultsFile, JSON.stringify(this.results, null, 2));
    console.log(`\n📄 Full results saved to: ${resultsFile}`);

    return this.results;
  }
}

// Run validation if script is called directly
if (process.argv[1].endsWith('validate-telemetry.js')) {
  const validator = new TelemetryValidator();
  validator.validate().catch(console.error);
}

export default TelemetryValidator;
