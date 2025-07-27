import chokidar from 'chokidar';
import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { BrowserAgentPool } from './agent-pool';
import { UIValidator } from '../browser/ui-validator';
import { PerformanceMonitor } from './performance-monitor';
import { BATCH_SIZE_10, HTTP_200, HTTP_400, HTTP_401, HTTP_404, HTTP_500, MAX_ITEMS_100, PERCENT_10, PERCENT_100, PERCENT_20, PERCENT_30, PERCENT_50, PERCENT_80, PERCENT_90, TIME_10000MS, TIME_1000MS, TIME_2000MS, TIME_5000MS, TIME_500MS, ZERO_POINT_EIGHT, ZERO_POINT_FIVE, ZERO_POINT_NINE } from "../utils/common-constants";

interface HotReloadConfig {
  watchPaths: string[];
  ignorePatterns: string[];
  debounceMs: number;
  maxConcurrentTests: number;
  testTimeout: number;
}

export class HotReloadMonitor extends EventEmitter {
  private watcher: any | null = null;
  private agentPool: BrowserAgentPool;
  private uiValidator: UIValidator;
  private performanceMonitor: PerformanceMonitor;
  private config: HotReloadConfig;
  private reloadInProgress = false;
  private debounceTimer: NodeJS.Timeout | null = null;
  private testResults: Map<string, any> = new Map();

  constructor(config: Partial<HotReloadConfig> = {}) {
    super();

    this.config = {
      watchPaths: ['src/**/*', 'ui/src/**/*'],
      ignorePatterns: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/*.log',
        '**/*.tmp',
        '**/.git/**',
      ],
      debounceMs: 1000,
      maxConcurrentTests: 14,
      testTimeout: 30000,
      ...config,
    };

    this.agentPool = new BrowserAgentPool({
      maxConcurrentAgents: this.config.maxConcurrentTests,
    });

    this.uiValidator = new UIValidator();
    this.performanceMonitor = new PerformanceMonitor();
  }

  async start())): Promise<void> {
    logger.info('Starting Hot Reload Monitor...');

    // Initialize agent pool
    await this.agentPool.initialize();

    // Start file watching
    this.watcher = chokidar.watch(this.config.watchPaths, {
      ignored: this.config.ignorePatterns,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    });

    // Set up event listeners
    this.watcher
      .on('change', (path): string => this.handleFileChange(path, 'change'))
      .on('add', (path): string => this.handleFileChange(path, 'add'))
      .on('unlink', (path): string => this.handleFileChange(path, 'unlink'))
      .on('_error, (_error: any => logger.error('File watcher_error', error);

    // Start performance monitoring
    this.performanceMonitor.start();

    logger.info('Hot Reload Monitor started successfully');
    this.emit('started');
  }

  async stop())): Promise<void> {
    logger.info('Stopping Hot Reload Monitor...');

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    if (this.watcher) {
      await this.watcher.close();
    }

    await this.agentPool.shutdown();
    await this.performanceMonitor.stop();

    logger.info('Hot Reload Monitor stopped');
    this.emit('stopped');
  }

  private handleFileChange(filePath: string, eventType: string): void {
    if (this.reloadInProgress) {
      logger.debug(`Ignoring file change (${eventType}): ${filePath} - reload in progress`);
      return;
    }

    logger.info(`File ${eventType}: ${filePath}`);

    // Clear existing debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Set new debounce timer
    this.debounceTimer = setTimeout(() => {
      this.triggerHotReload(filePath, eventType;
    }, this.config.debounceMs);
  }

  private async triggerHotReload(filePath: string, eventType: string)): Promise<void> {
    if (this.reloadInProgress) {
      return;
    }

    this.reloadInProgress = true;
    const startTime = Date.now();

    try {
      logger.info(`Triggering hot reload for ${filePath} (${eventType})`);
      this.emit('reload-start', { filePath, eventType });

      // Step 1: Notify all agents about the reload
      await this.agentPool.broadcastReload();

      // Step 2: Wait for UI to reload (Vite: HMR
      await this.waitForUIReload();

      // Step 3: Validate UI functionality across all browsers
      const validationResults = await this.validateAllBrowsers();

      // Step 4: Run performance checks
      const performanceResults = await this.performanceMonitor.runChecks();

      // Step 5: Compile results
      const reloadResults = {
        filePath,
        eventType,
        startTime,
        duration: Date.now() - startTime,
        validationResults,
        performanceResults,
        success: validationResults.every((r) => r.success),
      };

      this.testResults.set(`${Date.now()}-${filePath}`, reloadResults);`

      // Step 6: Emit results
      this.emit('reload-complete', reloadResults);

      if (reloadResults.success) {
        logger.info(`Hot reload successful for ${filePath} (${reloadResults.duration}ms)`);
      } else {
        logger.error(Hot reload failed for ${filePath}`, reloadResults);`
        this.emit('reload-failed', reloadResults);
      }
    } catch (error) {
      logger.error('Hot reload_error', error);
      this.emit('reload-_error, { filePath, eventType, error});
    } finally {
      this.reloadInProgress = false;
    }
  }

  private async waitForUIReload())): Promise<void> {
    // Wait for Vite HMR to complete
    await new Promise((resolve) => setTimeout(TIME_500MS));

    // Check if UI is responding
    const maxRetries = 10;
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch('http://localhost:5173/');
        if (response.ok) {
          return;
        }
      } catch (error) {
        // UI not ready yet
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error('UI did not respond after reload');
  }

  private async validateAllBrowsers(): Promise<any[]> {
    const agents = await this.agentPool.getAllAgents();
    const validationPromises = agents.map((agent) => this.uiValidator.validateAgent(agent));

    return Promise.all(validationPromises);
  }

  public getTestResults(): Map<string, any> {
    return this.testResults;
  }

  public getLatestResults(): any | null {
    const keys = Array.from(this.testResults.keys()).sort();
    const latestKey = keys[keys.length - 1];
    return latestKey ? this.testResults.get(latestKey) : null;
  }

  public clearResults()): void {
    this.testResults.clear();
  }
}

// Export singleton instance
export const hotReloadMonitor = new HotReloadMonitor();
