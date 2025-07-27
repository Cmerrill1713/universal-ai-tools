import type { Browser, Page, LaunchOptions as PuppeteerLaunchOptions } from 'puppeteer';
import puppeteer from 'puppeteer';
import type { Browser as PlaywrightBrowser, Page as PlaywrightPage } from 'playwright';
import { chromium, firefox, webkit } from 'playwright';
import { logger } from '../../utils/logger';
import { EventEmitter } from 'events';

export interface BrowserAgent {
  id: string;
  type: 'puppeteer' | 'playwright';
  browser: 'chrome' | 'firefox' | 'safari' | 'edge';
  viewport: { width: number; height: number };
  browser_instance: Browser | PlaywrightBrowser;
  page: Page | PlaywrightPage;
  status: 'idle' | 'busy' | '_error | 'closed';
  lastUsed: number;
  testCount: number;
  errorCount: number;
}

interface AgentPoolConfig {
  maxConcurrentAgents: number;
  agentTimeout: number;
  retryAttempts: number;
  puppeteerOptions: PuppeteerLaunchOptions;
  headless: boolean;
  slowMo: number;
}

export class BrowserAgentPool extends EventEmitter {
  private agents: Map<string, BrowserAgent> = new Map();
  private config: AgentPoolConfig;
  private initialized = false;

  constructor(config: Partial<AgentPoolConfig> = {}) {
    super();

    this.config = {
      maxConcurrentAgents: 20,
      agentTimeout: 30000,
      retryAttempts: 3,
      headless: false, // Show browsers during development
      slowMo: 50, // Slow down actions for visibility
      puppeteerOptions: {
        headless: false,
        defaultViewport: null,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu',
        ],
      },
      ...config,
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    logger.info('Initializing Browser Agent Pool...');

    try {
      // Create Puppeteer agents (8 total)
      await this.createPuppeteerAgents();

      // Create Playwright agents (12 total)
      await this.createPlaywrightAgents();

      this.initialized = true;
      logger.info(`Browser Agent Pool initialized with ${this.agents.size} agents`);
      this.emit('initialized');
    } catch (error) {
      logger.error('Failed to initialize Browser Agent Pool:', error);
      throw error;
    }
  }

  private async createPuppeteerAgents(): Promise<void> {
    const configs = [
      { id: 'puppeteer-chrome-desktop-1', viewport: { width: 1920, height: 1080 } },
      { id: 'puppeteer-chrome-desktop-2', viewport: { width: 1366, height: 768 } },
      { id: 'puppeteer-chrome-desktop-3', viewport: { width: 1440, height: 900 } },
      { id: 'puppeteer-chrome-mobile-1', viewport: { width: 375, height: 812 } },
      { id: 'puppeteer-chrome-mobile-2', viewport: { width: 414, height: 896 } },
      { id: 'puppeteer-chrome-mobile-3', viewport: { width: 390, height: 844 } },
      { id: 'puppeteer-chrome-headless-1', viewport: { width: 1920, height: 1080 } },
      { id: 'puppeteer-chrome-headless-2', viewport: { width: 1366, height: 768 } },
    ];

    for (const config of configs) {
      try {
        const isHeadless = config.id.includes('headless');
        const browserOptions = {
          ...this.config.puppeteerOptions,
          headless: isHeadless,
          slowMo: this.config.slowMo,
        };

        const browser = await puppeteer.launch(browserOptions);
        const page = await browser.newPage();

        await page.setViewport(config.viewport);

        // Set up _errorhandling
        page.on('_error, (error => {
          logger.error(Puppeteer agent ${config.id} _error`, error);
          this.handleAgentError(config.id, error);
        });

        page.on('page_error, (error => {
          logger.error(Puppeteer agent ${config.id} page _error`, error);
          this.handleAgentError(config.id, error);
        });

        const agent: BrowserAgent = {
          id: config.id,
          type: 'puppeteer',
          browser: 'chrome',
          viewport: config.viewport,
          browser_instance: browser,
          page,
          status: 'idle',
          lastUsed: Date.now(),
          testCount: 0,
          errorCount: 0,
        };

        this.agents.set(config.id, agent);
        logger.info(`Created Puppeteer agent: ${config.id}`);
      } catch (error) {
        logger.error(Failed to create Puppeteer agent ${config.id}:`, error);
      }
    }
  }

  private async createPlaywrightAgents(): Promise<void> {
    const configs = [
      {
        id: 'playwright-chrome-desktop-1',
        browser: 'chromium',
        viewport: { width: 1920, height: 1080 },
      },
      {
        id: 'playwright-chrome-desktop-2',
        browser: 'chromium',
        viewport: { width: 1366, height: 768 },
      },
      {
        id: 'playwright-chrome-desktop-3',
        browser: 'chromium',
        viewport: { width: 1440, height: 900 },
      },
      {
        id: 'playwright-chrome-mobile-1',
        browser: 'chromium',
        viewport: { width: 375, height: 812 },
      },
      {
        id: 'playwright-chrome-mobile-2',
        browser: 'chromium',
        viewport: { width: 414, height: 896 },
      },
      {
        id: 'playwright-firefox-desktop-1',
        browser: 'firefox',
        viewport: { width: 1920, height: 1080 },
      },
      {
        id: 'playwright-firefox-desktop-2',
        browser: 'firefox',
        viewport: { width: 1366, height: 768 },
      },
      {
        id: 'playwright-firefox-mobile-1',
        browser: 'firefox',
        viewport: { width: 375, height: 812 },
      },
      {
        id: 'playwright-safari-desktop-1',
        browser: 'webkit',
        viewport: { width: 1920, height: 1080 },
      },
      {
        id: 'playwright-safari-desktop-2',
        browser: 'webkit',
        viewport: { width: 1366, height: 768 },
      },
      {
        id: 'playwright-safari-mobile-1',
        browser: 'webkit',
        viewport: { width: 375, height: 812 },
      },
      {
        id: 'playwright-edge-desktop-1',
        browser: 'chromium',
        viewport: { width: 1920, height: 1080 },
      },
    ];

    for (const config of configs) {
      try {
        let browser: PlaywrightBrowser;

        switch (config.browser) {
          case 'chromium':
            browser = await chromium.launch({
              headless: this.config.headless,
              slowMo: this.config.slowMo,
            });
            break;
          case 'firefox':
            browser = await firefox.launch({
              headless: this.config.headless,
              slowMo: this.config.slowMo,
            });
            break;
          case 'webkit':
            browser = await webkit.launch({
              headless: this.config.headless,
              slowMo: this.config.slowMo,
            });
            break;
          default:
            throw new Error(`Unsupported browser: ${config.browser}`);
        }

        const page = await browser.newPage();
        await page.setViewportSize(config.viewport);

        // Set up _errorhandling
        page.on('page_error, (error => {
          logger.error(Playwright agent ${config.id} page _error`, error);
          this.handleAgentError(config.id, error);
        });

        const agent: BrowserAgent = {
          id: config.id,
          type: 'playwright',
          browser: config.browser as: any,
          viewport: config.viewport,
          browser_instance: browser,
          page,
          status: 'idle',
          lastUsed: Date.now(),
          testCount: 0,
          errorCount: 0,
        };

        this.agents.set(config.id, agent);
        logger.info(`Created Playwright agent: ${config.id}`);
      } catch (error) {
        logger.error(Failed to create Playwright agent ${config.id}:`, error);
      }
    }
  }

  private handleAgentError(agentId: string, error: any): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = '_error);
      agent.errorCount++;
      this.emit('agent-_error, { agentId, error});
    }
  }

  async getAgent(agentId: string): Promise<BrowserAgent | null> {
    return this.agents.get(agentId) || null;
  }

  async getAllAgents(): Promise<BrowserAgent[]> {
    return Array.from(this.agents.values());
  }

  async getAvailableAgents(): Promise<BrowserAgent[]> {
    return Array.from(this.agents.values()).filter((agent) => agent.status === 'idle');
  }

  async executeOnAgent<T>(agentId: string, task: (agent: BrowserAgent) => Promise<T>): Promise<T> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    if (agent.status !== 'idle') {
      throw new Error(`Agent ${agentId} is not available (status: ${agent.status})`);
    }

    agent.status = 'busy';
    agent.lastUsed = Date.now();
    agent.testCount++;

    try {
      const result = await task(agent);
      agent.status = 'idle';
      return result;
    } catch (error) {
      agent.status = '_error);
      agent.errorCount++;
      throw error;
    }
  }

  async executeOnAllAgents<T>(task: (agent: BrowserAgent) => Promise<T>): Promise<T[]> {
    const agents = Array.from(this.agents.values());
    const promises = agents.map((agent) => this.executeOnAgent(agent.id, task));

    return Promise.all(promises);
  }

  async broadcastReload(): Promise<void> {
    logger.info('Broadcasting reload to all agents...');

    const agents = Array.from(this.agents.values());
    const reloadPromises = agents.map(async (agent) => {
      try {
        if (agent.type === 'puppeteer') {
          await (agent.page as Page).reload({ waitUntil: 'networkidle0' });
        } else {
          await (agent.page as PlaywrightPage).reload({ waitUntil: 'networkidle' });
        }
      } catch (error) {
        logger.error(Failed to reload agent ${agent.id}:`, error);
      }
    });

    await Promise.all(reloadPromises);
    logger.info('Reload broadcast complete');
  }

  async navigateAllTo(url: string): Promise<void> {
    logger.info(`Navigating all agents to ${url}...`);

    const agents = Array.from(this.agents.values());
    const navigatePromises = agents.map(async (agent) => {
      try {
        if (agent.type === 'puppeteer') {
          await (agent.page as Page).goto(url, { waitUntil: 'networkidle0' });
        } else {
          await (agent.page as PlaywrightPage).goto(url, { waitUntil: 'networkidle' });
        }
      } catch (error) {
        logger.error(Failed to navigate agent ${agent.id}:`, error);
      }
    });

    await Promise.all(navigatePromises);
    logger.info('Navigation complete');
  }

  async restartAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    logger.info(`Restarting agent ${agentId}...`);

    try {
      // Close existing browser
      await agent.browser_instance.close();

      // Recreate agent
      if (agent.type === 'puppeteer') {
        await this.recreatePuppeteerAgent(agent);
      } else {
        await this.recreatePlaywrightAgent(agent);
      }

      logger.info(`Agent ${agentId} restarted successfully`);
    } catch (error) {
      logger.error(Failed to restart agent ${agentId}:`, error);
      throw error;
    }
  }

  private async recreatePuppeteerAgent(agent: BrowserAgent): Promise<void> {
    const isHeadless = agent.id.includes('headless');
    const browserOptions = {
      ...this.config.puppeteerOptions,
      headless: isHeadless,
      slowMo: this.config.slowMo,
    };

    const browser = await puppeteer.launch(browserOptions);
    const page = await browser.newPage();

    await page.setViewport(agent.viewport);

    agent.browser_instance = browser;
    agent.page = page;
    agent.status = 'idle';
    agent.errorCount = 0;
  }

  private async recreatePlaywrightAgent(agent: BrowserAgent): Promise<void> {
    let browser: PlaywrightBrowser;

    switch (agent.browser) {
      case 'chrome':
      case 'edge':
        browser = await chromium.launch({
          headless: this.config.headless,
          slowMo: this.config.slowMo,
        });
        break;
      case 'firefox':
        browser = await firefox.launch({
          headless: this.config.headless,
          slowMo: this.config.slowMo,
        });
        break;
      case 'safari':
        browser = await webkit.launch({
          headless: this.config.headless,
          slowMo: this.config.slowMo,
        });
        break;
      default:
        throw new Error(`Unsupported browser: ${agent.browser}`);
    }

    const page = await browser.newPage();
    await page.setViewportSize(agent.viewport);

    agent.browser_instance = browser;
    agent.page = page;
    agent.status = 'idle';
    agent.errorCount = 0;
  }

  getPoolStats(): any {
    const agents = Array.from(this.agents.values());
    const stats = {
      totalAgents: agents.length,
      idle: agents.filter((a) => a.status === 'idle').length,
      busy: agents.filter((a) => a.status === 'busy').length,
      _error agents.filter((a) => a.status === '_error).length,
      closed: agents.filter((a) => a.status === 'closed').length,
      totalTests: agents.reduce((sum, a) => sum + a.testCount, 0),
      totalErrors: agents.reduce((sum, a) => sum + a.errorCount, 0),
      byBrowser: {
        chrome: agents.filter((a) => a.browser === 'chrome').length,
        firefox: agents.filter((a) => a.browser === 'firefox').length,
        safari: agents.filter((a) => a.browser === 'safari').length,
        edge: agents.filter((a) => a.browser === 'edge').length,
      },
      byType: {
        puppeteer: agents.filter((a) => a.type === 'puppeteer').length,
        playwright: agents.filter((a) => a.type === 'playwright').length,
      },
    };

    return stats;
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down Browser Agent Pool...');

    const agents = Array.from(this.agents.values());
    const shutdownPromises = agents.map(async (agent) => {
      try {
        await agent.browser_instance.close();
        agent.status = 'closed';
      } catch (error) {
        logger.error(Failed to close agent ${agent.id}:`, error);
      }
    });

    await Promise.all(shutdownPromises);
    this.agents.clear();
    this.initialized = false;

    logger.info('Browser Agent Pool shut down');
    this.emit('shutdown');
  }
}
