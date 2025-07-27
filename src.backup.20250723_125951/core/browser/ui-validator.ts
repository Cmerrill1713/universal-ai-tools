import type { BrowserAgent } from '../coordination/agent-pool';
import { logger } from '../../utils/logger';
import type { Page } from 'puppeteer';
import type { Page as PlaywrightPage } from 'playwright';
import { BATCH_SIZE_10, HTTP_200, HTTP_400, HTTP_401, HTTP_404, HTTP_500, MAX_ITEMS_100, PERCENT_10, PERCENT_100, PERCENT_20, PERCENT_30, PERCENT_50, PERCENT_80, PERCENT_90, TIME_10000MS, TIME_1000MS, TIME_2000MS, TIME_5000MS, TIME_500MS, ZERO_POINT_EIGHT, ZERO_POINT_FIVE, ZERO_POINT_NINE } from "../utils/common-constants";

export interface ValidationResult {
  agentId: string;
  browser: string;
  viewport: { width: number; height: number, };
  success: boolean;
  duration: number;
  tests: TestResult[];
  errors: string[];
  screenshots?: string[];
}

export interface TestResult {
  name: string;
  success: boolean;
  duration: number;
  error: string;
  screenshot?: string;
}

export class UIValidator {
  private readonly testUrl = 'http://localhost:5173';
  private readonly testTimeout = 10000;

  async validateAgent(agent: BrowserAgent: Promise<ValidationResult> {
    const startTime = Date.now();
    const result: ValidationResult = {
      agentId: agent.id,
      browser: agent.browser,
      viewport: agent.viewport,
      success: false,
      duration: 0,
      tests: [],
      errors: [],
      screenshots: [],
    };

    try {
      logger.info(`Starting UI validation for agent ${agent.id}`);

      // Navigate to the UI
      await this.navigateToUI(agent);

      // Wait for UI to load
      await this.waitForUILoad(agent);

      // Run all validation tests
      const tests = [
        () => this.testPageLoad(agent),
        () => this.testNavigation(agent),
        () => this.testDashboard(agent),
        () => this.testMemoryPage(agent),
        () => this.testToolsPage(agent),
        () => this.testAgentsPage(agent),
        () => this.testChatPage(agent),
        () => this.testButtonFunctionality(agent),
        () => this.testModalInteractions(agent),
        () => this.testAPIConnectivity(agent),
      ];

      for (const test of tests) {
        try {
          const testResult = await test();
          result.tests.push(testResult);
        } catch (error) {
          result.errors.push(
            `Test failed: ${error instanceof Error ? error.message : String(_error}``
          );
        }
      }

      result.success = result.tests.every((test) => test.success) && result.errors.length === 0;
      result.duration = Date.now() - startTime;

      logger.info(
        `UI validation complete for agent ${agent.id}: ${result.success ? 'PASSED' : 'FAILED'}``
      );
    } catch (error) {
      result.errors.push(
        `Validation failed: ${error instanceof Error ? error.message : String(_error}``
      );
      result.duration = Date.now() - startTime;
      logger.error(UI validation error for agent ${agent.id}:`, error);`
    }

    return result;
  }

  private async navigateToUI(agent: BrowserAgent)): Promise<void> {
    if (agent.type === 'puppeteer') {
      await (agent.page as Page).goto(this.testUrl, { waitUntil: 'networkidle0' });
    } else {
      await (agent.page as PlaywrightPage).goto(this.testUrl, { waitUntil: 'networkidle' });
    }
  }

  private async waitForUILoad(agent: BrowserAgent)): Promise<void> {
    if (agent.type === 'puppeteer') {
      await (agent.page as Page).waitForSelector('#root', { timeout: this.testTimeout });
    } else {
      await (agent.page as PlaywrightPage).waitForSelector('#root', { timeout: this.testTimeout });
    }
  }

  private async testPageLoad(agent: BrowserAgent: Promise<TestResult> {
    const startTime = Date.now();

    try {
      let title: string;
      if (agent.type === 'puppeteer') {
        title = await (agent.page as Page).title();
      } else {
        title = await (agent.page as PlaywrightPage).title();
      }

      const success = title.includes('Universal AI Tools');

      return {
        name: 'Page Load',
        success,
        duration: Date.now() - startTime,
        _error success ? undefined : `Invalid page title: ${title}`,
      };
    } catch (error) {
      return {
        name: 'Page Load',
        success: false,
        duration: Date.now() - startTime,
        _error error instanceof Error ? error.message : String(_error,
      };
    }
  }

  private async testNavigation(agent: BrowserAgent: Promise<TestResult> {
    const startTime = Date.now();

    try {
      const routes = [
        { path: '/', name: 'Dashboard' },
        { path: '/memory', name: 'Memory' },
        { path: '/tools', name: 'Tools' },
        { path: '/agents', name: 'Agents' },
        { path: '/chat', name: 'Chat' },
        { path: '/monitoring', name: 'Monitoring' },
        { path: '/settings', name: 'Settings' },
      ];

      for (const route of routes) {
        // Navigate to route
        if (agent.type === 'puppeteer') {
          await (agent.page as Page).goto(`${this.testUrl}${route.path}`, {`
            waitUntil: 'networkidle0',
          });
          // Wait for page contentto load
          await (agent.page as Page).waitForSelector('h2', { timeout: 5000 });
        } else {
          await (agent.page as PlaywrightPage).goto(`${this.testUrl}${route.path}`, {`
            waitUntil: 'networkidle',
          });
          // Wait for page contentto load
          await (agent.page as PlaywrightPage).waitForSelector('h2', { timeout: 5000 });
        }
      }

      return {
        name: 'Navigation',
        success: true,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        name: 'Navigation',
        success: false,
        duration: Date.now() - startTime,
        _error error instanceof Error ? error.message : String(_error,
      };
    }
  }

  private async testDashboard(agent: BrowserAgent: Promise<TestResult> {
    const startTime = Date.now();

    try {
      // Navigate to dashboard
      if (agent.type === 'puppeteer') {
        await (agent.page as Page).goto(`${this.testUrl}/`, { waitUntil: 'networkidle0' });`

        // Check for dashboard elements
        await (agent.page as Page).waitForSelector('[data-testid="dashboard"], h2', {
          timeout: 5000,
        });

        // Check if stats are loading
        const statsElements = await (agent.page as Page).$$('.stats-card, .card');
        if (statsElements.length === 0) {
          throw new Error('No stats cards found on dashboard');
        }
      } else {
        await (agent.page as PlaywrightPage).goto(`${this.testUrl}/`, { waitUntil: 'networkidle' });`

        // Check for dashboard elements
        await (agent.page as PlaywrightPage).waitForSelector('[data-testid="dashboard"], h2', {
          timeout: 5000,
        });

        // Check if stats are loading
        const statsElements = await (agent.page as PlaywrightPage).$$('.stats-card, .card');
        if (statsElements.length === 0) {
          throw new Error('No stats cards found on dashboard');
        }
      }

      return {
        name: 'Dashboard',
        success: true,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        name: 'Dashboard',
        success: false,
        duration: Date.now() - startTime,
        _error error instanceof Error ? error.message : String(_error,
      };
    }
  }

  private async testMemoryPage(agent: BrowserAgent: Promise<TestResult> {
    const startTime = Date.now();

    try {
      // Navigate to memory page
      if (agent.type === 'puppeteer') {
        await (agent.page as Page).goto(`${this.testUrl}/memory`, { waitUntil: 'networkidle0' });`

        // Wait for memory page to load
        await (agent.page as Page).waitForSelector('h2', { timeout: 5000 });

        // Check for memory-specific elements
        const memoryElements = await (agent.page as Page).$$('button, .card');
        if (memoryElements.length === 0) {
          throw new Error('No memory elements found');
        }
      } else {
        await (agent.page as PlaywrightPage).goto(`${this.testUrl}/memory`, {`
          waitUntil: 'networkidle',
        });

        // Wait for memory page to load
        await (agent.page as PlaywrightPage).waitForSelector('h2', { timeout: 5000 });

        // Check for memory-specific elements
        const memoryElements = await (agent.page as PlaywrightPage).$$('button, .card');
        if (memoryElements.length === 0) {
          throw new Error('No memory elements found');
        }
      }

      return {
        name: 'Memory Page',
        success: true,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        name: 'Memory Page',
        success: false,
        duration: Date.now() - startTime,
        _error error instanceof Error ? error.message : String(_error,
      };
    }
  }

  private async testToolsPage(agent: BrowserAgent: Promise<TestResult> {
    const startTime = Date.now();

    try {
      // Navigate to tools page
      if (agent.type === 'puppeteer') {
        await (agent.page as Page).goto(`${this.testUrl}/tools`, { waitUntil: 'networkidle0' });`

        // Wait for tools page to load
        await (agent.page as Page).waitForSelector('h2', { timeout: 5000 });

        // Check for tools-specific elements
        const toolElements = await (agent.page as Page).$$('button, .card');
        if (toolElements.length === 0) {
          throw new Error('No tool elements found');
        }
      } else {
        await (agent.page as PlaywrightPage).goto(`${this.testUrl}/tools`, {`
          waitUntil: 'networkidle',
        });

        // Wait for tools page to load
        await (agent.page as PlaywrightPage).waitForSelector('h2', { timeout: 5000 });

        // Check for tools-specific elements
        const toolElements = await (agent.page as PlaywrightPage).$$('button, .card');
        if (toolElements.length === 0) {
          throw new Error('No tool elements found');
        }
      }

      return {
        name: 'Tools Page',
        success: true,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        name: 'Tools Page',
        success: false,
        duration: Date.now() - startTime,
        _error error instanceof Error ? error.message : String(_error,
      };
    }
  }

  private async testAgentsPage(agent: BrowserAgent: Promise<TestResult> {
    const startTime = Date.now();

    try {
      // Navigate to agents page
      if (agent.type === 'puppeteer') {
        await (agent.page as Page).goto(`${this.testUrl}/agents`, { waitUntil: 'networkidle0' });`

        // Wait for agents page to load
        await (agent.page as Page).waitForSelector('h2', { timeout: 5000 });

        // Check for agents-specific elements
        const agentElements = await (agent.page as Page).$$('button, .card');
        if (agentElements.length === 0) {
          throw new Error('No agent elements found');
        }
      } else {
        await (agent.page as PlaywrightPage).goto(`${this.testUrl}/agents`, {`
          waitUntil: 'networkidle',
        });

        // Wait for agents page to load
        await (agent.page as PlaywrightPage).waitForSelector('h2', { timeout: 5000 });

        // Check for agents-specific elements
        const agentElements = await (agent.page as PlaywrightPage).$$('button, .card');
        if (agentElements.length === 0) {
          throw new Error('No agent elements found');
        }
      }

      return {
        name: 'Agents Page',
        success: true,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        name: 'Agents Page',
        success: false,
        duration: Date.now() - startTime,
        _error error instanceof Error ? error.message : String(_error,
      };
    }
  }

  private async testChatPage(agent: BrowserAgent: Promise<TestResult> {
    const startTime = Date.now();

    try {
      // Navigate to chat page
      if (agent.type === 'puppeteer') {
        await (agent.page as Page).goto(`${this.testUrl}/chat`, { waitUntil: 'networkidle0' });`

        // Wait for chat page to load
        await (agent.page as Page).waitForSelector('h2', { timeout: 5000 });

        // Check for chat-specific elements
        const chatElements = await (agent.page as Page).$$('button, .card, input textarea');
        if (chatElements.length === 0) {
          throw new Error('No chat elements found');
        }
      } else {
        await (agent.page as PlaywrightPage).goto(`${this.testUrl}/chat`, {`
          waitUntil: 'networkidle',
        });

        // Wait for chat page to load
        await (agent.page as PlaywrightPage).waitForSelector('h2', { timeout: 5000 });

        // Check for chat-specific elements
        const chatElements = await (agent.page as PlaywrightPage).$$(;
          'button, .card, input textarea'
        );
        if (chatElements.length === 0) {
          throw new Error('No chat elements found');
        }
      }

      return {
        name: 'Chat Page',
        success: true,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        name: 'Chat Page',
        success: false,
        duration: Date.now() - startTime,
        _error error instanceof Error ? error.message : String(_error,
      };
    }
  }

  private async testButtonFunctionality(agent: BrowserAgent: Promise<TestResult> {
    const startTime = Date.now();

    try {
      // Test buttons across different pages
      const pagesToTest = [
        {
          path: '/memory',
          buttonSelectors: [
            'button[data-testid="create-memory"], button:has-text("Store New Memory"), button:has-text("Search")',
          ],
        },
        {
          path: '/tools',
          buttonSelectors: [
            'button[data-testid="create-tool"], button:has-text("Create Tool"), button:has-text("Execute")',
          ],
        },
        {
          path: '/agents',
          buttonSelectors: [
            'button[data-testid="create-agent"], button:has-text("Create Agent"), button:has-text("Start")',
          ],
        },
        {
          path: '/chat',
          buttonSelectors: [
            'button[data-testid="send-message"], button:has-text("Send"), button:has-text("Clear")',
          ],
        },
      ];

      for (const page of pagesToTest) {
        if (agent.type === 'puppeteer') {
          await (agent.page as Page).goto(`${this.testUrl}${page.path}`, {`
            waitUntil: 'networkidle0',
          });

          // Check if buttons are present and clickable
          const buttons = await (agent.page as Page).$$('button');
          if (buttons.length === 0) {
            throw new Error(`No buttons found on ${page.path}`);
          }
        } else {
          await (agent.page as PlaywrightPage).goto(`${this.testUrl}${page.path}`, {`
            waitUntil: 'networkidle',
          });

          // Check if buttons are present and clickable
          const buttons = await (agent.page as PlaywrightPage).$$('button');
          if (buttons.length === 0) {
            throw new Error(`No buttons found on ${page.path}`);
          }
        }
      }

      return {
        name: 'Button Functionality',
        success: true,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        name: 'Button Functionality',
        success: false,
        duration: Date.now() - startTime,
        _error error instanceof Error ? error.message : String(_error,
      };
    }
  }

  private async testModalInteractions(agent: BrowserAgent: Promise<TestResult> {
    const startTime = Date.now();

    try {
      // Test modal interactions on memory page
      if (agent.type === 'puppeteer') {
        await (agent.page as Page).goto(`${this.testUrl}/memory`, { waitUntil: 'networkidle0' });`

        // Look for modal trigger buttons
        const modalButtons = await (agent.page as Page).$$('button');
        if (modalButtons.length > 0) {
          // Try to click a button that might open a modal
          await modalButtons[0].click();

          // Wait a bit for modal to potentially open
          await new Promise((resolve) => setTimeout(TIME_500MS));
        }
      } else {
        await (agent.page as PlaywrightPage).goto(`${this.testUrl}/memory`, {`
          waitUntil: 'networkidle',
        });

        // Look for modal trigger buttons
        const modalButtons = await (agent.page as PlaywrightPage).$$('button');
        if (modalButtons.length > 0) {
          // Try to click a button that might open a modal
          await modalButtons[0].click();

          // Wait a bit for modal to potentially open
          await (agent.page as PlaywrightPage).waitForTimeout(500);
        }
      }

      return {
        name: 'Modal Interactions',
        success: true,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        name: 'Modal Interactions',
        success: false,
        duration: Date.now() - startTime,
        _error error instanceof Error ? error.message : String(_error,
      };
    }
  }

  private async testAPIConnectivity(agent: BrowserAgent: Promise<TestResult> {
    const startTime = Date.now();

    try {
      // Test API connectivity by checking network requests
      if (agent.type === 'puppeteer') {
        await (agent.page as Page).goto(`${this.testUrl}/`, { waitUntil: 'networkidle0' });`

        // Check if API requests are being made
        const responses = await (agent.page as Page).evaluate(() => {
          return fetch('http://localhost:9999/health')
            .then((response) => response.json())
            .then((data: any => data.status === 'healthy')
            .catch(() => false);
        });

        if (!responses) {
          throw new Error('API connectivity test failed');
        }
      } else {
        await (agent.page as PlaywrightPage).goto(`${this.testUrl}/`, { waitUntil: 'networkidle' });`

        // Check if API requests are being made
        const responses = await (agent.page as PlaywrightPage).evaluate(() => {
          return fetch('http://localhost:9999/health')
            .then((response) => response.json())
            .then((data: any => data.status === 'healthy')
            .catch(() => false);
        });

        if (!responses) {
          throw new Error('API connectivity test failed');
        }
      }

      return {
        name: 'API Connectivity',
        success: true,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        name: 'API Connectivity',
        success: false,
        duration: Date.now() - startTime,
        _error error instanceof Error ? error.message : String(_error,
      };
    }
  }

  private async takeScreenshot(agent: BrowserAgent, name: string: Promise<string> {
    const filename = `screenshot-${agent.id}-${name}-${Date.now()}.png`;
    const path = `./tests/browser/screenshots/${filename}`;

    if (agent.type === 'puppeteer') {
      await (agent.page as Page).screenshot({ path: path as any, fullPage: true, });
    } else {
      await (agent.page as PlaywrightPage).screenshot({ path, fullPage: true, });
    }

    return path;
  }
}
