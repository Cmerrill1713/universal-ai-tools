import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { BrowserAgentPool } from '../agent-pool';
import { UIValidator } from '../ui-validator';
import { PerformanceMonitor } from '../performance-monitor';
import { logger } from '../../../src/utils/logger';

describe('Basic Functionality Tests', () => {
  let agentPool: BrowserAgentPool;
  let uiValidator: UIValidator;
  let performanceMonitor: PerformanceMonitor;

  beforeAll(async () => {
    logger.info('🚀 Initializing browser agents for testing...');

    // TODO: Refactor nested ternary
agentPool = new BrowserAgentPool({
      maxConcurrentAgents: 4, // Reduced for testing
      headless: true, // Run headless in tests
      slowMo: 0, // No slow motion in tests
    });

    uiValidator = new UIValidator();
    performanceMonitor = new PerformanceMonitor();

    await agentPool.initialize();
    await performanceMonitor.start();

    logger.info('✅ Browser agents initialized');
  });

  afterAll(async () => {
    logger.info('🧹 Shutting down browser agents...');

    await agentPool.shutdown();
    await performanceMonitor.stop();

    logger.info('✅ Browser agents shut down');
  });

  test('should initialize browser agents successfully', async () => {
    const agents = await agentPool.getAllAgents();
    expect(agents.length).toBeGreaterThan(0);

    const stats = agentPool.getPoolStats();
    expect(stats.totalAgents).toBe(agents.length);
    expect(stats.idle).toBe(agents.length);
    expect(stats.busy).toBe(0);
    expect(stats.error).toBe(0);
  });

  test('should validate UI functionality across all browsers', async () => {
    const agents = await agentPool.getAllAgents();

    for (const agent of agents) {
      logger.info(`Testing agent: ${agent.id} (${agent.browser})`);

      const result = await uiValidator.validateAgent(agent);

      // Log detailed results
      logger.info(`Agent ${agent.id} results:`, {
        success: result.success,
        testsRun: result.tests.length,
        errors: result.errors.length,
        duration: result.duration,
      });

      // Expect basic validation to pass
      expect(result.success).toBe(true);
      expect(result.tests.length).toBeGreaterThan(0);
      expect(result.errors.length).toBe(0);
    }
  });

  test('should measure performance across all browsers', async () => {
    const agents = await agentPool.getAllAgents();

    for (const agent of agents) {
      logger.info(`Measuring performance for agent: ${agent.id} (${agent.browser})`);

      const report = await performanceMonitor.measureAgent(agent);

      // Log performance results
      logger.info(`Agent ${agent.id} performance:`, {
        score: report.benchmarks.performanceScore,
        grade: report.benchmarks.pageLoadGrade,
        pageLoadTime: report.metrics.pageLoadTime,
        memoryUsage: report.metrics.memoryUsage.usedJSHeapSize,
      });

      // Expect reasonable performance
      expect(report.benchmarks.performanceScore).toBeGreaterThan(0);
      expect(report.metrics.pageLoadTime).toBeGreaterThan(0);
      expect(report.metrics.pageLoadTime).toBeLessThan(10000); // Less than 10 seconds
    }
  });

  test('should handle navigation across all pages', async () => {
    const agents = await agentPool.getAllAgents();
    const pages = ['/', '/memory', '/tools', '/agents', '/chat'];

    for (const agent of agents) {
      logger.info(`Testing navigation for agent: ${agent.id}`);

      for (const page of pages) {
        await agentPool.executeOnAgent(agent.id, async (agent) => {
          if (agent.type === 'puppeteer') {
            await (agent.page as any).goto(`http://localhost:5173${page}`, {
              waitUntil: 'networkidle0',
            });
            const url = await (agent.page as any).url();
            expect(url).toContain(page === '/' ? 'localhost:5173' : page);
          } else {
            await (agent.page as any).goto(`http://localhost:5173${page}`, {
              waitUntil: 'networkidle',
            });
            const url = await (agent.page as any).url();
            expect(url).toContain(page === '/' ? 'localhost:5173' : page);
          }
        });
      }
    }
  });

  test('should detect and interact with buttons', async () => {
    const agents = await agentPool.getAllAgents();

    for (const agent of agents) {
      logger.info(`Testing button interactions for agent: ${agent.id}`);

      await agentPool.executeOnAgent(agent.id, async (agent) => {
        // Go to memory page
        if (agent.type === 'puppeteer') {
          await (agent.page as any).goto('http://localhost:5173/memory', {
            waitUntil: 'networkidle0',
          });

          // Look for buttons
          const buttons = await (agent.page as any).$$('button');
          expect(buttons.length).toBeGreaterThan(0);

          // Check if buttons are clickable
          for (const button of buttons.slice(0, THREE)) {
            // Test first 3 buttons
            const isEnabled = await button.evaluate((btn: unknown) => !btn.disabled);
            expect(isEnabled).toBe(true);
          }
        } else {
          await (agent.page as any).goto('http://localhost:5173/memory', {
            waitUntil: 'networkidle',
          });

          // Look for buttons
          const buttons = await (agent.page as any).$$('button');
          expect(buttons.length).toBeGreaterThan(0);

          // Check if buttons are clickable
          for (const button of buttons.slice(0, THREE)) {
            // Test first 3 buttons
            const isEnabled = await button.evaluate((btn: unknown) => !btn.disabled);
            expect(isEnabled).toBe(true);
          }
        }
      });
    }
  });

  test('should verify API connectivity', async () => {
    const agents = await agentPool.getAllAgents();

    for (const agent of agents) {
      logger.info(`Testing API connectivity for agent: ${agent.id}`);

      await agentPool.executeOnAgent(agent.id, async (agent) => {
        if (agent.type === 'puppeteer') {
          await (agent.page as any).goto('http://localhost:5173/', { waitUntil: 'networkidle0' });

          // Test API connectivity from browser
          const apiResponse = await (agent.page as any).evaluate(async () => {
            try {
              const response = await fetch('http://localhost:9999/health');
              const data = await response.json();
              return { success: true, status: data.status };
            } catch (error) {
              return { success: false, error: error.message };
            }
          });

          expect(apiResponse.success).toBe(true);
          expect(apiResponse.status).toBe('healthy');
        } else {
          await (agent.page as any).goto('http://localhost:5173/', { waitUntil: 'networkidle' });

          // Test API connectivity from browser
          const apiResponse = await (agent.page as any).evaluate(async () => {
            try {
              const response = await fetch('http://localhost:9999/health');
              const data = await response.json();
              return { success: true, status: data.status };
            } catch (error) {
              return { success: false, error: error.message };
            }
          });

          expect(apiResponse.success).toBe(true);
          expect(apiResponse.status).toBe('healthy');
        }
      });
    }
  });
});
