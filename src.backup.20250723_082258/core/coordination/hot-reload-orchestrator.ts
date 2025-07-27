#!/usr/bin/env tsx

import { HotReloadMonitor } from './hot-reload-monitor';
import { BrowserAgentPool } from './agent-pool';
import { UIValidator } from '../browser/ui-validator';
import { PerformanceMonitor } from './performance-monitor';
import { SelfHealingAgent } from '../agents/self-healing-agent';
import { dspyService } from '../../services/dspy-service';
import { logger } from '../../utils/logger';
import { EventEmitter } from 'events';

export interface OrchestratorConfig {
  maxConcurrentAgents: number;
  headless: boolean;
  slowMo: number;
  enableSelfHealing: boolean;
  enablePerformanceMonitoring: boolean;
  debounceMs: number;
  testTimeout: number;
  reportInterval: number;
}

export class HotReloadOrchestrator extends EventEmitter {
  private config: OrchestratorConfig;
  private hotReloadMonitor!: HotReloadMonitor;
  private agentPool!: BrowserAgentPool;
  private uiValidator!: UIValidator;
  private performanceMonitor!: PerformanceMonitor;
  private selfHealingAgent!: SelfHealingAgent;
  // Enhanced coordination now provided by DSPy service
  private isRunning = false;
  private reportInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<OrchestratorConfig> = {}) {
    super();

    this.config = {
      maxConcurrentAgents: 20, // Increased from 14 to 20
      headless: false,
      slowMo: 50,
      enableSelfHealing: true,
      enablePerformanceMonitoring: true,
      debounceMs: 1000,
      testTimeout: 30000,
      reportInterval: 30000, // Report every 30 seconds
      ...config,
    };

    this.initializeComponents();
    this.setupEventHandlers();
  }

  private initializeComponents(): void {
    // Initialize agent pool
    this.agentPool = new BrowserAgentPool({
      maxConcurrentAgents: this.config.maxConcurrentAgents,
      headless: this.config.headless,
      slowMo: this.config.slowMo,
      agentTimeout: this.config.testTimeout,
    });

    // Initialize UI validator
    this.uiValidator = new UIValidator();

    // Initialize performance monitor
    this.performanceMonitor = new PerformanceMonitor();

    // Initialize self-healing agent
    this.selfHealingAgent = new SelfHealingAgent(
      this.agentPool,
      this.uiValidator,
      this.performanceMonitor
    );

    // Enhanced coordination now provided by DSPy service
    logger.info('🎯 DSPy service will handle coordination');

    // Initialize hot reload monitor
    this.hotReloadMonitor = new HotReloadMonitor({
      debounceMs: this.config.debounceMs,
      maxConcurrentTests: this.config.maxConcurrentAgents,
      testTimeout: this.config.testTimeout,
    });
  }

  private setupEventHandlers(): void {
    // Hot reload events
    this.hotReloadMonitor.on('reload-start', (data) => {
      logger.info(`🔄 Hot reload started for ${data.filePath}`);
      this.emit('reload-start', data);
    });

    this.hotReloadMonitor.on('reload-complete', (data) => {
      if (data.success) {
        logger.info(`✅ Hot reload completed successfully in ${data.duration}ms`);
      } else {
        logger.error`❌ Hot reload failed after ${data.duration}ms`);
      }
      this.emit('reload-complete', data);
    });

    this.hotReloadMonitor.on('reload-failed', (data) => {
      logger.error`💥 Hot reload failed: ${JSON.stringify(data.validationResults)}`);
      this.emit('reload-failed', data);

      // Trigger enhanced coordination for complex failures
      if (data.validationResults && data.validationResults.length > 0) {
        this.triggerEnhancedCoordination(data);
      }
    });

    // Agent pool events
    this.agentPool.on('initialized', () => {
      logger.info(
        `🚀 Agent pool initialized with ${this.agentPool.getPoolStats().totalAgents} agents`
      );
      this.emit('agents-ready');
    });

    this.agentPool.on('agent-_error, (data) => {
      logger.error`🚨 Agent _error ${data.agentId} - ${data._errormessage}`);
      this.emit('agent-_error, data);
    });

    // Self-healing events
    this.selfHealingAgent.on('issue-reported', (issue: any) => {
      logger.warn(`🔧 Issue reported: ${issue.description} (${issue.severity})`);
      this.emit('issue-reported', issue);
    });

    this.selfHealingAgent.on('issue-healed', (data: any) => {
      logger.info(`🎯 Issue healed: ${data.issue.description} in ${data.result.duration}ms`);
      this.emit('issue-healed', data);
    });

    this.selfHealingAgent.on('issue-heal-failed', (data: any) => {
      logger.error`⚠️ Failed to heal issue: ${data.issue.description}`);
      this.emit('issue-heal-failed', data);
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Hot Reload Orchestrator is already running');
      return;
    }

    this.isRunning = true;
    logger.info('🎬 Starting Hot Reload Orchestrator...');

    try {
      // Start components in order
      logger.info('📊 Starting performance monitor...');
      if (this.config.enablePerformanceMonitoring) {
        await this.performanceMonitor.start();
      }

      logger.info('🤖 Initializing browser agent pool...');
      await this.agentPool.initialize();

      logger.info('🩺 Starting self-healing agent...');
      if (this.config.enableSelfHealing) {
        await this.selfHealingAgent.start();
      }

      logger.info('👁️ Starting hot reload monitor...');
      await this.hotReloadMonitor.start();

      // Navigate all agents to the UI
      logger.info('🧭 Navigating agents to UI...');
      await this.agentPool.navigateAllTo('http://localhost:5173');

      // Run initial validation
      logger.info('🧪 Running initial validation...');
      await this.runInitialValidation();

      // Start reporting
      this.startReporting();

      logger.info('🎉 Hot Reload Orchestrator started successfully!');
      logger.info(`📈 Monitoring ${this.agentPool.getPoolStats().totalAgents} browser agents`);
      logger.info(`🔄 Hot reload monitoring active for file changes`);
      logger.info(`🎯 Self-healing: ${this.config.enableSelfHealing ? 'ENABLED' : 'DISABLED'}`);
      logger.info(
        `📊 Performance monitoring: ${this.config.enablePerformanceMonitoring ? 'ENABLED' : 'DISABLED'}`
      );

      this.emit('started');
    } catch (_error) {
      logger.error'❌ Failed to start Hot Reload Orchestrator:', _error;
      this.isRunning = false;
      throw _error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Hot Reload Orchestrator is not running');
      return;
    }

    this.isRunning = false;
    logger.info('🛑 Stopping Hot Reload Orchestrator...');

    try {
      // Stop reporting
      if (this.reportInterval) {
        clearInterval(this.reportInterval);
        this.reportInterval = null;
      }

      // Stop components in reverse order
      logger.info('🔄 Stopping hot reload monitor...');
      await this.hotReloadMonitor.stop();

      logger.info('🩺 Stopping self-healing agent...');
      await this.selfHealingAgent.stop();

      logger.info('🤖 Shutting down browser agent pool...');
      await this.agentPool.shutdown();

      logger.info('📊 Stopping performance monitor...');
      await this.performanceMonitor.stop();

      logger.info('✅ Hot Reload Orchestrator stopped successfully');
      this.emit('stopped');
    } catch (_error) {
      logger.error'❌ Error stopping Hot Reload Orchestrator:', _error;
      throw _error;
    }
  }

  private async runInitialValidation(): Promise<void> {
    try {
      const agents = await this.agentPool.getAllAgents();
      const validationPromises = agents.map((agent) => this.uiValidator.validateAgent(agent));

      const results = await Promise.all(validationPromises);
      const successCount = results.filter((r: any) => r.success).length;
      const totalCount = results.length;

      logger.info(`🧪 Initial validation complete: ${successCount}/${totalCount} agents passed`);

      if (successCount < totalCount) {
        logger.warn(`⚠️ ${totalCount - successCount} agents failed initial validation`);

        // Report failures as issues for self-healing
        results.forEach((result: any) => {
          if (!result.success) {
            this.selfHealingAgent.reportIssue({
              agentId: result.agentId,
              type: 'ui',
              description: `Initial validation failed: ${result.errors.join(', ')}`,
              severity: 'medium',
              context: result,
            });
          }
        });
      }
    } catch (_error) {
      logger.error'❌ Initial validation failed:', _error;
    }
  }

  private startReporting(): void {
    this.reportInterval = setInterval(() => {
      try {
        this.generateAndLogReport();
      } catch (_error) {
        logger.error'Error generating report:', _error;
      }
    }, this.config.reportInterval);
  }

  private generateAndLogReport(): void {
    const poolStats = this.agentPool.getPoolStats();
    const issueStats = this.selfHealingAgent.getIssueStats();
    const recentResults = this.hotReloadMonitor.getLatestResults();

    const report = `
🎯 Hot Reload Orchestrator Status Report
═══════════════════════════════════════

📊 Agent Pool Status:
  • Total Agents: ${poolStats.totalAgents}
  • Idle: ${poolStats.idle}
  • Busy: ${poolStats.busy}
  • Error: ${poolStats._error
  • Total Tests: ${poolStats.totalTests}
  • Total Errors: ${poolStats.totalErrors}

🔧 Self-Healing Status:
  • Total Issues: ${issueStats.total}
  • Resolved: ${issueStats.resolved}
  • Unresolved: ${issueStats.unresolved}
  • Critical: ${issueStats.bySeverity.critical}
  • High: ${issueStats.bySeverity.high}

🔄 Latest Hot Reload:
  ${
    recentResults
      ? `• File: ${recentResults.filePath}
     • Duration: ${recentResults.duration}ms
     • Success: ${recentResults.success ? '✅' : '❌'}
     • Validation: ${recentResults.validationResults.filter((r: any) => r.success).length}/${recentResults.validationResults.length} passed`
      : '• No recent reloads'
  }

📈 Browser Coverage:
  • Chrome: ${poolStats.byBrowser.chrome}
  • Firefox: ${poolStats.byBrowser.firefox}  
  • Safari: ${poolStats.byBrowser.safari}
  • Edge: ${poolStats.byBrowser.edge}
    `.trim();

    logger.info(report);
  }

  async forceValidation(): Promise<void> {
    logger.info('🔍 Running manual validation...');
    await this.runInitialValidation();
  }

  async forceReload(): Promise<void> {
    logger.info('🔄 Running manual reload...');
    await this.agentPool.broadcastReload();
  }

  async restartAgent(agentId: string): Promise<void> {
    logger.info(`🔄 Restarting agent ${agentId}...`);
    await this.agentPool.restartAgent(agentId);
  }

  getStatus(): any {
    return {
      isRunning: this.isRunning,
      config: this.config,
      agentPool: this.agentPool.getPoolStats(),
      issues: this.selfHealingAgent.getIssueStats(),
      latestReload: this.hotReloadMonitor.getLatestResults(),
    };
  }

  generateDetailedReport(): string {
    const poolStats = this.agentPool.getPoolStats();
    const issueStats = this.selfHealingAgent.getIssueStats();
    const performanceReport = this.performanceMonitor.generateReport();
    const healingReport = this.selfHealingAgent.generateReport();

    return `
Hot Reload Orchestrator Detailed Report
======================================

${new Date().toISOString()}

Agent Pool Status:
${JSON.stringify(poolStats, null, 2)}

Performance Report:
${performanceReport}

Self-Healing Report:
${healingReport}

Configuration:
${JSON.stringify(this.config, null, 2)}
    `.trim();
  }

  private async triggerEnhancedCoordination(failureData: any): Promise<void> {
    try {
      logger.info('🎯 Triggering enhanced agent coordination for failure resolution...');

      // Extract problem description from failure data
      const problemDescription = this.extractProblemDescription(failureData);

      // Create context for coordination
      const context = {
        failureData,
        timestamp: Date.now(),
        orchestratorConfig: this.config,
        agentPoolStats: this.agentPool.getPoolStats(),
        systemState: await this.gatherSystemState(),
      };

      // Trigger DSPy coordinated group fix
      const availableAgents = ['researcher', 'executor', 'validator', 'monitor', 'ui-tester'];
      const coordination = await dspyService.coordinateAgents(
        problemDescription,
        availableAgents,
        context
      );

      logger.info(`✅ DSPy coordination completed: ${coordination.success ? 'SUCCESS' : 'FAILED'}`);
      logger.info(`🤖 Selected agents: ${coordination.selectedAgents}`);
      this.emit('enhanced-coordination-started', { plan: coordination });
    } catch (_error) {
      logger.error'❌ Enhanced coordination failed:', _error;
      this.emit('enhanced-coordination-failed', {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
    }
  }

  private extractProblemDescription(failureData: any): string {
    if (failureData.validationResults) {
      const errors = failureData.validationResults
        .map((result: any) => result._error|| result.message)
        .filter(Boolean)
        .join('; ');
      return `Hot reload validation failed: ${errors}`;
    }

    if (failureData._error {
      return `Hot reload _error ${failureData._error`;
    }

    return 'Hot reload system failure detected';
  }

  private async gatherSystemState(): Promise<unknown> {
    const state: any = {
      agentPool: this.agentPool.getPoolStats(),
      selfHealing: this.selfHealingAgent.getIssueStats(),
      timestamp: Date.now(),
    };

    if (this.config.enablePerformanceMonitoring) {
      state.performance = this.performanceMonitor.getMetrics();
    }

    return state;
  }

  async getEnhancedCoordinationStats(): Promise<unknown> {
    // Return DSPy service status and basic coordination stats
    const dspyStatus = dspyService.getStatus();
    const agentPoolStats = this.agentPool.getPoolStats();

    return {
      dspyService: {
        connected: dspyStatus.connected,
        initialized: dspyStatus.initialized,
        queueSize: dspyStatus.queueSize,
      },
      agentPool: agentPoolStats,
      coordinationMode: 'dspy-enhanced',
    };
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  async function main() {
    const orchestrator = new HotReloadOrchestrator({
      headless: process.argv.includes('--headless'),
      maxConcurrentAgents: parseInt(
        process.argv.find((arg) => arg.startsWith('--agents='))?.split('=')[1] || '20'
      ),
      slowMo: parseInt(
        process.argv.find((arg) => arg.startsWith('--slowmo='))?.split('=')[1] || '50'
      ),
      enableSelfHealing: !process.argv.includes('--no-healing'),
      enablePerformanceMonitoring: !process.argv.includes('--no-performance'),
    });

    // Handle graceful shutdown
    const shutdown = async () => {
      logger.info('🛑 Shutting down...');
      await orchestrator.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    try {
      await orchestrator.start();

      // Keep the process alive and report enhanced coordination stats
      setInterval(async () => {
        const stats = await orchestrator.getEnhancedCoordinationStats();
        logger.info(
          `📊 Enhanced Coordination Stats: ${stats.activePlans} active plans, ${stats.successRate}% success rate`
        );
      }, 30000); // Report every 30 seconds
    } catch (_error) {
      logger.error'❌ Failed to start orchestrator:', _error;
      process.exit(1);
    }
  }

  main().catch((_error => {
    logger.error'❌ Orchestrator _error', _error;
    process.exit(1);
  });
}

// Export for module use
export default HotReloadOrchestrator;
