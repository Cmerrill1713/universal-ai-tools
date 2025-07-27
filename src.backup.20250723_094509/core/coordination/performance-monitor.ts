import { logger } from '../../s../../utils/logger';
import type { BrowserAgent } from './agent-pool';
import type { Page } from 'puppeteer';
import type { Page as PlaywrightPage } from 'playwright';
import { EventEmitter } from 'events';

export interface PerformanceMetrics {
  timestamp: number;
  pageLoadTime: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  firstInputDelay: number;
  timeToInteractive: number;
  totalBlockingTime: number;
  memoryUsage: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
  networkRequests: {
    total: number;
    successful: number;
    failed: number;
    totalSize: number;
    avgResponseTime: number;
  };
  errors: string[];
}

export interface PerformanceReport {
  agentId: string;
  browser: string;
  viewport: { width: number; height: number };
  metrics: PerformanceMetrics;
  benchmarks: {
    pageLoadGrade: 'A' | 'B' | 'C' | 'D' | 'F';
    performanceScore: number;
    recommendations: string[];
  };
}

export class PerformanceMonitor extends EventEmitter {
  private readonly baseUrl = 'http://localhost:5173';
  private readonly apiUrl = 'http://localhost:9999';
  private metrics: Map<string, PerformanceMetrics[]> = new Map();
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
  }

  async start(): Promise<void> {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    logger.info('Starting Performance Monitor...');

    // Start continuous monitoring
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectSystemMetrics();
      } catch (error) {
        logger.error('Error collecting system metrics:', error);
      }
    }, 5000); // Collect metrics every 5 seconds

    logger.info('Performance Monitor started');
  }

  async stop(): Promise<void> {
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    logger.info('Performance Monitor stopped');
  }

  async measureAgent(agent: BrowserAgent): Promise<PerformanceReport> {
    logger.info(`Measuring performance for agent ${agent.id}`);

    const startTime = Date.now();
    const metrics: PerformanceMetrics = {
      timestamp: startTime,
      pageLoadTime: 0,
      firstContentfulPaint: 0,
      largestContentfulPaint: 0,
      cumulativeLayoutShift: 0,
      firstInputDelay: 0,
      timeToInteractive: 0,
      totalBlockingTime: 0,
      memoryUsage: {
        usedJSHeapSize: 0,
        totalJSHeapSize: 0,
        jsHeapSizeLimit: 0,
      },
      networkRequests: {
        total: 0,
        successful: 0,
        failed: 0,
        totalSize: 0,
        avgResponseTime: 0,
      },
      errors: [],
    };

    try {
      // Navigate to the app and measure performance
      await this.navigateAndMeasure(agent, metrics);

      // Collect Web Vitals
      await this.collectWebVitals(agent, metrics);

      // Collect memory usage
      await this.collectMemoryUsage(agent, metrics);

      // Collect network metrics
      await this.collectNetworkMetrics(agent, metrics);

      // Store metrics
      const agentMetrics = this.metrics.get(agent.id) || [];
      agentMetrics.push(metrics);
      this.metrics.set(agent.id, agentMetrics);

      // Generate performance report
      const report: PerformanceReport = {
        agentId: agent.id,
        browser: agent.browser,
        viewport: agent.viewport,
        metrics,
        benchmarks: this.generateBenchmarks(metrics),
      };

      logger.info(
        `Performance measurement complete for agent ${agent.id}: Score ${report.benchmarks.performanceScore}`
      );
      return report;
    } catch (error) {
      logger.error(Performance measurement failed for agent ${agent.id}:`, error);
      metrics.errors.push(error instanceof Error ? error.message : String(_error);

      return {
        agentId: agent.id,
        browser: agent.browser,
        viewport: agent.viewport,
        metrics,
        benchmarks: {
          pageLoadGrade: 'F',
          performanceScore: 0,
          recommendations: ['Fix critical errors before performance optimization'],
        },
      };
    }
  }

  private async navigateAndMeasure(
    agent: BrowserAgent,
    metrics: PerformanceMetrics
  ): Promise<void> {
    const startTime = Date.now();

    if (agent.type === 'puppeteer') {
      const page = agent.page as Page;

      // Enable performance monitoring
      await page.setCacheEnabled(false);

      // Navigate to the app
      await page.goto(this.baseUrl, { waitUntil: 'networkidle0' });

      // Measure page load time
      metrics.pageLoadTime = Date.now() - startTime;
    } else {
      const page = agent.page as PlaywrightPage;

      // Navigate to the app
      await page.goto(this.baseUrl, { waitUntil: 'networkidle' });

      // Measure page load time
      metrics.pageLoadTime = Date.now() - startTime;
    }
  }

  private async collectWebVitals(agent: BrowserAgent, metrics: PerformanceMetrics): Promise<void> {
    try {
      if (agent.type === 'puppeteer') {
        const page = agent.page as Page;

        // Collect performance metrics from the browser
        const performanceMetrics: any = await page.evaluate(() => {
          return new Promise((resolve) => {
            // Use Performance Observer API to collect Web Vitals
            const vitals: any = {};

            // Get paint timings
            const paintEntries = performance.getEntriesByType('paint');
            paintEntries.forEach((entry) => {
              if (entry.name === 'first-contentful-paint') {
                vitals.firstContentfulPaint = entry.startTime;
              }
            });

            // Get LCP using Performance Observer
            try {
              const observer = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                if (entries.length > 0) {
                  vitals.largestContentfulPaint = entries[entries.length - 1].startTime;
                }
              });
              observer.observe({ entryTypes: ['largest-contentful-paint'] });
            } catch (e) {
              // LCP not supported in this browser
            }

            // Get navigation timing
            const navigation = performance.getEntriesByType(
              'navigation'
            )[0] as PerformanceNavigationTiming;
            if (navigation) {
              vitals.timeToInteractive = navigation.domInteractive - navigation.fetchStart;
            }

            // Get memory usage if available
            if ('memory' in performance) {
              vitals.memoryUsage = (performance as: any).memory;
            }

            resolve(vitals);
          });
        });

        // Update metrics with collected data
        if (performanceMetrics.firstContentfulPaint) {
          metrics.firstContentfulPaint = performanceMetrics.firstContentfulPaint;
        }
        if (performanceMetrics.largestContentfulPaint) {
          metrics.largestContentfulPaint = performanceMetrics.largestContentfulPaint;
        }
        if (performanceMetrics.timeToInteractive) {
          metrics.timeToInteractive = performanceMetrics.timeToInteractive;
        }
        if (performanceMetrics.memoryUsage) {
          metrics.memoryUsage = performanceMetrics.memoryUsage;
        }
      } else {
        const page = agent.page as PlaywrightPage;

        // Collect performance metrics from Playwright
        const performanceMetrics: any = await page.evaluate(() => {
          const vitals: any = {};

          // Get paint timings
          const paintEntries = performance.getEntriesByType('paint');
          paintEntries.forEach((entry) => {
            if (entry.name === 'first-contentful-paint') {
              vitals.firstContentfulPaint = entry.startTime;
            }
          });

          // Get navigation timing
          const navigation = performance.getEntriesByType(
            'navigation'
          )[0] as PerformanceNavigationTiming;
          if (navigation) {
            vitals.timeToInteractive = navigation.domInteractive - navigation.fetchStart;
          }

          // Get memory usage if available
          if ('memory' in performance) {
            vitals.memoryUsage = (performance as: any).memory;
          }

          return vitals;
        });

        // Update metrics with collected data
        if (performanceMetrics.firstContentfulPaint) {
          metrics.firstContentfulPaint = performanceMetrics.firstContentfulPaint;
        }
        if (performanceMetrics.timeToInteractive) {
          metrics.timeToInteractive = performanceMetrics.timeToInteractive;
        }
        if (performanceMetrics.memoryUsage) {
          metrics.memoryUsage = performanceMetrics.memoryUsage;
        }
      }
    } catch (error) {
      logger.error('Failed to collect Web Vitals:', error);
      metrics.errors.push(
        `Web Vitals collection failed: ${error instanceof Error ? error.message : String(_error}`
      );
    }
  }

  private async collectMemoryUsage(
    agent: BrowserAgent,
    metrics: PerformanceMetrics
  ): Promise<void> {
    try {
      if (agent.type === 'puppeteer') {
        const page = agent.page as Page;

        // Get memory usage from the browser
        const memoryUsage = await page.evaluate(() => {
          if ('memory' in performance) {
            return (performance as: any).memory;
          }
          return null;
        });

        if (memoryUsage) {
          metrics.memoryUsage = memoryUsage;
        }
      } else {
        const page = agent.page as PlaywrightPage;

        // Get memory usage from Playwright
        const memoryUsage = await page.evaluate(() => {
          if ('memory' in performance) {
            return (performance as: any).memory;
          }
          return null;
        });

        if (memoryUsage) {
          metrics.memoryUsage = memoryUsage;
        }
      }
    } catch (error) {
      logger.error('Failed to collect memory usage:', error);
      metrics.errors.push(
        `Memory usage collection failed: ${error instanceof Error ? error.message : String(_error}`
      );
    }
  }

  private async collectNetworkMetrics(
    agent: BrowserAgent,
    metrics: PerformanceMetrics
  ): Promise<void> {
    try {
      if (agent.type === 'puppeteer') {
        const page = agent.page as Page;

        // Get network metrics from the browser
        const networkMetrics = await page.evaluate(() => {
          const resourceEntries = performance.getEntriesByType('resource');
          const total = resourceEntries.length;
          let successful = 0;
          let failed = 0;
          let totalSize = 0;
          let totalResponseTime = 0;

          resourceEntries.forEach((entry) => {
            const resource = entry as PerformanceResourceTiming;
            if (resource.transferSize !== undefined) {
              totalSize += resource.transferSize;
            }

            const responseTime = resource.responseEnd - resource.requestStart;
            if (responseTime > 0) {
              totalResponseTime += responseTime;
              successful++;
            } else {
              failed++;
            }
          });

          return {
            total,
            successful,
            failed,
            totalSize,
            avgResponseTime: successful > 0 ? totalResponseTime / successful : 0,
          };
        });

        metrics.networkRequests = networkMetrics;
      } else {
        const page = agent.page as PlaywrightPage;

        // Get network metrics from Playwright
        const networkMetrics = await page.evaluate(() => {
          const resourceEntries = performance.getEntriesByType('resource');
          const total = resourceEntries.length;
          let successful = 0;
          let failed = 0;
          let totalSize = 0;
          let totalResponseTime = 0;

          resourceEntries.forEach((entry) => {
            const resource = entry as PerformanceResourceTiming;
            if (resource.transferSize !== undefined) {
              totalSize += resource.transferSize;
            }

            const responseTime = resource.responseEnd - resource.requestStart;
            if (responseTime > 0) {
              totalResponseTime += responseTime;
              successful++;
            } else {
              failed++;
            }
          });

          return {
            total,
            successful,
            failed,
            totalSize,
            avgResponseTime: successful > 0 ? totalResponseTime / successful : 0,
          };
        });

        metrics.networkRequests = networkMetrics;
      }
    } catch (error) {
      logger.error('Failed to collect network metrics:', error);
      metrics.errors.push(
        `Network metrics collection failed: ${error instanceof Error ? error.message : String(_error}`
      );
    }
  }

  private generateBenchmarks(metrics: PerformanceMetrics): PerformanceReport['benchmarks'] {
    const recommendations: string[] = [];
    let score = 100;

    // Analyze page load time
    if (metrics.pageLoadTime > 3000) {
      score -= 20;
      recommendations.push(
        'Page load time is too slow (>3s). Consider optimizing bundle size and lazy loading.'
      );
    } else if (metrics.pageLoadTime > 1000) {
      score -= 10;
      recommendations.push('Page load time could be improved (<1s is optimal).');
    }

    // Analyze First Contentful Paint
    if (metrics.firstContentfulPaint > 2000) {
      score -= 15;
      recommendations.push(
        'First Contentful Paint is too slow (>2s). Optimize critical rendering path.'
      );
    } else if (metrics.firstContentfulPaint > 1000) {
      score -= 5;
      recommendations.push('First Contentful Paint could be improved (<1s is optimal).');
    }

    // Analyze Largest Contentful Paint
    if (metrics.largestContentfulPaint > 4000) {
      score -= 20;
      recommendations.push(
        'Largest Contentful Paint is too slow (>4s). Optimize images and critical resources.'
      );
    } else if (metrics.largestContentfulPaint > 2500) {
      score -= 10;
      recommendations.push('Largest Contentful Paint could be improved (<2.5s is optimal).');
    }

    // Analyze memory usage
    if (metrics.memoryUsage.usedJSHeapSize > 50 * 1024 * 1024) {
      // 50MB
      score -= 15;
      recommendations.push('High memory usage detected (>50MB). Check for memory leaks.');
    } else if (metrics.memoryUsage.usedJSHeapSize > 25 * 1024 * 1024) {
      // 25MB
      score -= 5;
      recommendations.push('Memory usage is moderate (>25MB). Consider optimization.');
    }

    // Analyze network requests
    if (metrics.networkRequests.failed > 0) {
      score -= 25;
      recommendations.push(
        `${metrics.networkRequests.failed} network requests failed. Check API connectivity.`
      );
    }

    if (metrics.networkRequests.avgResponseTime > 1000) {
      score -= 15;
      recommendations.push(
        'Average API response time is slow (>1s). Optimize backend performance.'
      );
    } else if (metrics.networkRequests.avgResponseTime > 500) {
      score -= 5;
      recommendations.push('Average API response time could be improved (<500ms is optimal).');
    }

    // Add errors penalty
    if (metrics.errors.length > 0) {
      score -= metrics.errors.length * 10;
      recommendations.push(`${metrics.errors.length} errors detected. Fix critical issues first.`);
    }

    // Ensure score is within bounds
    score = Math.max(0, Math.min(100, score));

    // Determine grade
    let grade: 'A' | 'B' | 'C' | 'D' | 'F';
    if (score >= 90) grade = 'A';
    else if (score >= 80) grade = 'B';
    else if (score >= 70) grade = 'C';
    else if (score >= 60) grade = 'D';
    else grade = 'F';

    return {
      pageLoadGrade: grade,
      performanceScore: score,
      recommendations,
    };
  }

  private async collectSystemMetrics(): Promise<void> {
    try {
      // Test API health
      const response = await fetch(`${this.apiUrl}/health`);
      const healthData = await response.json();

      // Test API performance
      const apiStartTime = Date.now();
      await fetch(`${this.apiUrl}/api/stats`, {
        headers: {
          'X-API-Key': process.env.DEV_API_KEY || '',
          'X-AI-Service': 'local-ui',
        },
      });
      const apiResponseTime = Date.now() - apiStartTime;

      logger.debug(
        `System metrics - API Health: ${healthData.status}, Response Time: ${apiResponseTime}ms`
      );
    } catch (error) {
      logger.error('Failed to collect system metrics:', error);
    }
  }

  async runChecks(): Promise<unknown> {
    const startTime = Date.now();

    try {
      // Check UI availability
      const uiResponse = await fetch(this.baseUrl);
      const uiAvailable = uiResponse.ok;

      // Check API availability
      const apiResponse = await fetch(`${this.apiUrl}/health`);
      const apiHealth = await apiResponse.json();
      const apiAvailable = apiHealth.status === 'healthy';

      // Check API performance
      const apiStartTime = Date.now();
      await fetch(`${this.apiUrl}/api/stats`, {
        headers: {
          'X-API-Key': process.env.DEV_API_KEY || '',
          'X-AI-Service': 'local-ui',
        },
      });
      const apiResponseTime = Date.now() - apiStartTime;

      const checks = {
        duration: Date.now() - startTime,
        ui: {
          available: uiAvailable,
          url: this.baseUrl,
        },
        api: {
          available: apiAvailable,
          responseTime: apiResponseTime,
          url: this.apiUrl,
        },
        overall: uiAvailable && apiAvailable,
      };

      logger.info(
        `Performance checks complete: UI=${uiAvailable}, API=${apiAvailable}, Response Time=${apiResponseTime}ms`
      );
      return checks;
    } catch (error) {
      logger.error('Performance checks failed:', error);
      return {
        duration: Date.now() - startTime,
        ui: { available: false, url: this.baseUrl },
        api: { available: false, responseTime: -1, url: this.apiUrl },
        overall: false,
        _error error instanceof Error ? error.message : String(_error,
      };
    }
  }

  getMetrics(agentId?: string): PerformanceMetrics[] {
    if (agentId) {
      return this.metrics.get(agentId) || [];
    }

    // Return all metrics
    const allMetrics: PerformanceMetrics[] = [];
    for (const agentMetrics of this.metrics.values()) {
      allMetrics.push(...agentMetrics);
    }
    return allMetrics;
  }

  clearMetrics(agentId?: string): void {
    if (agentId) {
      this.metrics.delete(agentId);
    } else {
      this.metrics.clear();
    }
  }

  generateReport(): string {
    const allMetrics = this.getMetrics();
    if (allMetrics.length === 0) {
      return 'No performance metrics available';
    }

    const avgPageLoadTime =
      allMetrics.reduce((sum, m) => sum + m.pageLoadTime, 0) / allMetrics.length;
    const avgMemoryUsage =
      allMetrics.reduce((sum, m) => sum + m.memoryUsage.usedJSHeapSize, 0) / allMetrics.length;
    const totalErrors = allMetrics.reduce((sum, m) => sum + m.errors.length, 0);

    return `
Performance Report:
- Average Page Load Time: ${avgPageLoadTime.toFixed(2)}ms
- Average Memory Usage: ${(avgMemoryUsage / 1024 / 1024).toFixed(2)}MB
- Total Errors: ${totalErrors}
- Metrics Collected: ${allMetrics.length}
- Agents Monitored: ${this.metrics.size}
    `.trim();
  }
}
