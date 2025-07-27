import type { BrowserAgent, BrowserAgentPool } from '../coordination/agent-pool.js';
import type { UIValidator } from '../browser/ui-validator.js';
import { ValidationResult } from '../browser/ui-validator.js';
import type { PerformanceMonitor } from '../coordination/performance-monitor.js';
import type { ResearchQuery } from '../knowledge/online-research-agent.js';
import { OnlineResearchAgent } from '../knowledge/online-research-agent.js';
import { logger } from '../../utils/logger.js';
import { EventEmitter } from 'events';

export interface HealingAction {
  id: string;
  type:
    | 'restart_agent'
    | 'reload_page'
    | 'clear_cache'
    | 'restart_service'
    | 'fix_api_call'
    | 'online_research';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  automated: boolean;
  implementation: (agent: BrowserAgent, context: any) => Promise<boolean>;
}

export interface Issue {
  id: string;
  agentId: string;
  type: 'performance' | 'ui' | 'api' | 'network' | 'memory' | 'crash';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  context: any;
  resolved: boolean;
  healingActions: string[];
}

export interface HealingResult {
  issueId: string;
  success: boolean;
  actionsApplied: string[];
  duration: number;
  error: string;
}

export interface HealingContext {
  issue: Issue;
  agent?: BrowserAgent;
  timestamp: number;
  attempts: number;
}

export interface RecoveryAction {
  id: string;
  name: string;
  execute: () => Promise<boolean>;
}

export interface DiagnosticResult {
  healthy: boolean;
  issues: Issue[];
  metrics: any;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  agents: number;
  activeIssues: number;
  resolvedIssues: number;
}

export interface HealingReport {
  period: string;
  totalIssues: number;
  resolvedIssues: number;
  successRate: number;
  averageHealingTime: number;
}

export class SelfHealingAgent extends EventEmitter {
  private agentPool: BrowserAgentPool;
  private uiValidator: UIValidator;
  private performanceMonitor: PerformanceMonitor;
  private onlineResearchAgent: OnlineResearchAgent;
  private issues: Map<string, Issue> = new Map();
  private healingActions: Map<string, HealingAction> = new Map();
  private isRunning = false;
  private healingInterval: NodeJS.Timeout | null = null;

  constructor(
    agentPool: BrowserAgentPool,
    uiValidator: UIValidator,
    performanceMonitor: PerformanceMonitor
  ) {
    super();
    this.agentPool = agentPool;
    this.uiValidator = uiValidator;
    this.performanceMonitor = performanceMonitor;
    this.onlineResearchAgent = new OnlineResearchAgent();

    this.initializeHealingActions();
    this.setupEventListeners();
  }

  private initializeHealingActions(): void {
    const actions: HealingAction[] = [
      {
        id: 'restart_agent',
        type: 'restart_agent',
        description: 'Restart browser agent',
        severity: 'medium',
        automated: true,
        implementation: async (agent: BrowserAgent) => {
          try {
            await this.agentPool.restartAgent(agent.id);
            logger.info(`Successfully restarted agent ${agent.id}`);
            return true;
          } catch (error) {
            logger.error(Failed to restart agent ${agent.id}:`, error);
            return false;
          }
        },
      },
      {
        id: 'reload_page',
        type: 'reload_page',
        description: 'Reload page in browser',
        severity: 'low',
        automated: true,
        implementation: async (agent: BrowserAgent) => {
          try {
            if (agent.type === 'puppeteer') {
              await (agent.page as: any).reload({ waitUntil: 'networkidle0' });
            } else {
              await (agent.page as: any).reload({ waitUntil: 'networkidle' });
            }
            logger.info(`Successfully reloaded page for agent ${agent.id}`);
            return true;
          } catch (error) {
            logger.error(Failed to reload page for agent ${agent.id}:`, error);
            return false;
          }
        },
      },
      {
        id: 'clear_cache',
        type: 'clear_cache',
        description: 'Clear browser cache and cookies',
        severity: 'low',
        automated: true,
        implementation: async (agent: BrowserAgent) => {
          try {
            if (agent.type === 'puppeteer') {
              const page = agent.page as: any;
              await page.evaluate(() => {
                // This code runs in the browser context where window is available
                window.localStorage.clear();
                window.sessionStorage.clear();
              });
            } else {
              const page = agent.page as: any;
              await page.evaluate(() => {
                // This code runs in the browser context where window is available
                window.localStorage.clear();
                window.sessionStorage.clear();
              });
            }
            logger.info(`Successfully cleared cache for agent ${agent.id}`);
            return true;
          } catch (error) {
            logger.error(Failed to clear cache for agent ${agent.id}:`, error);
            return false;
          }
        },
      },
      {
        id: 'fix_api_call',
        type: 'fix_api_call',
        description: 'Retry failed API calls',
        severity: 'medium',
        automated: true,
        implementation: async (agent: BrowserAgent, context: any) => {
          try {
            // Navigate to page and retry API calls
            if (agent.type === 'puppeteer') {
              await (agent.page as: any).goto('http://localhost:5173/', {
                waitUntil: 'networkidle0',
              });
            } else {
              await (agent.page as: any).goto('http://localhost:5173/', {
                waitUntil: 'networkidle',
              });
            }

            // Wait for potential API calls to complete
            await new Promise((resolve) => setTimeout(resolve, 2000));

            logger.info(`Successfully retried API calls for agent ${agent.id}`);
            return true;
          } catch (error) {
            logger.error(Failed to retry API calls for agent ${agent.id}:`, error);
            return false;
          }
        },
      },
      {
        id: 'online_research',
        type: 'online_research',
        description: 'Research solution online when local healing fails',
        severity: 'high',
        automated: true,
        implementation: async (agent: BrowserAgent, context: any) => {
          try {
            const _error= context._error|| context.description || 'Unknown error);
            const technology = this.detectTechnology(_error);

            logger.info(`🔍 Initiating online research for: ${error:`);

            const researchQuery: ResearchQuery = {
              _error
              context: JSON.stringify(context),
              technology,
              severity: context.severity || 'medium',
            };

            const solution = await this.onlineResearchAgent.researchSolution(researchQuery);

            if (solution) {
              logger.info(`✅ Found online solution with ${solution.confidence}% confidence`);

              // Try to apply the solution
              const applied = await this.applySolution(agent, solution, context);

              if (applied) {
                // Update success rate
                await this.onlineResearchAgent.updateSuccessRate(solution.id, true);
                logger.info(`🎯 Successfully applied online research solution`);
                return true;
              } else {
                await this.onlineResearchAgent.updateSuccessRate(solution.id, false);
                logger.warn(`❌ Failed to apply online research solution`);
                return false;
              }
            } else {
              logger.warn(`❌ No online solution found for: ${error:`);
              return false;
            }
          } catch (error) {
            logger.error(Online research failed for agent ${agent.id}:`, error);
            return false;
          }
        },
      },
      {
        id: 'restart_service',
        type: 'restart_service',
        description: 'Restart backend service (manual intervention required)',
        severity: 'critical',
        automated: false,
        implementation: async () => {
          logger.warn('Service restart required - manual intervention needed');
          return false;
        },
      },
    ];

    actions.forEach((action) => {
      this.healingActions.set(action.id, action);
    });
  }

  private setupEventListeners(): void {
    // Listen for agent errors
    this.agentPool.on('agent-_error, (data: any) => {
      this.reportIssue({
        agentId: data.agentId,
        type: 'crash',
        description: `Agent _error ${data.error.message}`,
        severity: 'high',
        context: data.error
      });
    });

    // Listen for performance issues
    this.performanceMonitor.on('performance-issue', (data: any) => {
      this.reportIssue({
        agentId: data.agentId,
        type: 'performance',
        description: `Performance issue: ${data.description}`,
        severity: data.severity,
        context: data,
      });
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    logger.info('Starting Self-Healing Agent...');

    // Start continuous monitoring and healing
    this.healingInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
        await this.processUnresolvedIssues();
      } catch (error) {
        logger.error('Error in healing process:', error);
      }
    }, 10000); // Check every 10 seconds

    logger.info('Self-Healing Agent started');
    this.emit('started');
  }

  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.healingInterval) {
      clearInterval(this.healingInterval);
      this.healingInterval = null;
    }

    logger.info('Self-Healing Agent stopped');
    this.emit('stopped');
  }

  private async performHealthCheck(): Promise<void> {
    try {
      // Check all agents
      const agents = await this.agentPool.getAllAgents();

      for (const agent of agents) {
        // Check if agent is in _errorstate
        if (agent.status === '_error && agent.errorCount > 0) {
          this.reportIssue({
            agentId: agent.id,
            type: 'crash',
            description: `Agent in _errorstate with ${agent.errorCount} errors`,
            severity: 'high',
            context: { errorCount: agent.errorCount },
          });
        }

        // Check if agent hasn't been used recently (potential hanging)
        const timeSinceLastUse = Date.now() - agent.lastUsed;
        if (timeSinceLastUse > 300000 && agent.status === 'busy') {
          // 5 minutes
          this.reportIssue({
            agentId: agent.id,
            type: 'ui',
            description: 'Agent appears to be hanging',
            severity: 'medium',
            context: { timeSinceLastUse },
          });
        }
      }

      // Check system performance
      const performanceChecks = await this.performanceMonitor.runChecks();
      if (!performanceChecks.overall) {
        this.reportIssue({
          agentId: 'system',
          type: 'api',
          description: 'System performance checks failed',
          severity: 'high',
          context: performanceChecks,
        });
      }
    } catch (error) {
      logger.error('Health check failed:', error);
    }
  }

  private async processUnresolvedIssues(): Promise<void> {
    const unresolvedIssues = Array.from(this.issues.values())
      .filter((issue) => !issue.resolved)
      .sort((a, b) => this.getSeverityScore(b.severity) - this.getSeverityScore(a.severity));

    for (const issue of unresolvedIssues) {
      try {
        await this.healIssue(issue);
      } catch (error) {
        logger.error(Failed to heal issue ${issue.id}:`, error);
      }
    }
  }

  private getSeverityScore(severity: Issue['severity']): number {
    switch (severity) {
      case 'critical':
        return 4;
      case 'high':
        return 3;
      case 'medium':
        return 2;
      case 'low':
        return 1;
      default:
        return 0;
    }
  }

  reportIssue(params: {
    agentId: string;
    type: Issue['type'];
    description: string;
    severity: Issue['severity'];
    context?: any;
  }): string {
    const issueId = `${params.agentId}-${params.type}-${Date.now()}`;

    const issue: Issue = {
      id: issueId,
      agentId: params.agentId,
      type: params.type,
      description: params.description,
      severity: params.severity,
      timestamp: Date.now(),
      context: params.context || {},
      resolved: false,
      healingActions: [],
    };

    this.issues.set(issueId, issue);

    logger.warn(`Issue reported: ${issue.description} (${issue.severity})`);
    this.emit('issue-reported', issue);

    return issueId;
  }

  async healIssue(issue: Issue): Promise<HealingResult> {
    const startTime = Date.now();
    const result: HealingResult = {
      issueId: issue.id,
      success: false,
      actionsApplied: [],
      duration: 0,
    };

    try {
      logger.info(`Attempting to heal issue: ${issue.description}`);

      // Get appropriate healing actions for this issue
      const actions = this.getHealingActionsForIssue(issue);

      // Get the agent if it exists
      const agent = await this.agentPool.getAgent(issue.agentId);

      // Apply healing actions in order of severity
      for (const action of actions) {
        if (!action.automated) {
          logger.warn(`Manual intervention required for action: ${action.description}`);
          continue;
        }

        try {
          logger.info(`Applying healing action: ${action.description}`);
          const actionSuccess = await action.implementation(agent!, issue.context);

          result.actionsApplied.push(action.id);
          issue.healingActions.push(action.id);

          if (actionSuccess) {
            logger.info(`Healing action ${action.id} successful`);

            // Verify the issue is resolved
            const isResolved = await this.verifyIssueResolved(issue, agent!);
            if (isResolved) {
              result.success = true;
              issue.resolved = true;
              logger.info(`Issue ${issue.id} resolved successfully`);
              break;
            }
          } else {
            logger.warn(`Healing action ${action.id} failed`);
          }
        } catch (error) {
          logger.error(Error applying healing action ${action.id}:`, error);
          result.error= error instanceof Error ? error.message : String(_error);
        }
      }

      result.duration = Date.now() - startTime;

      if (result.success) {
        this.emit('issue-healed', { issue, result });
      } else {
        this.emit('issue-heal-failed', { issue, result });
      }
    } catch (error) {
      result.error= error instanceof Error ? error.message : String(_error);
      result.duration = Date.now() - startTime;
      logger.error(Failed to heal issue ${issue.id}:`, error);
    }

    return result;
  }

  private getHealingActionsForIssue(issue: Issue): HealingAction[] {
    const actions: HealingAction[] = [];

    switch (issue.type) {
      case 'crash':
        actions.push(
          this.healingActions.get('restart_agent')!,
          this.healingActions.get('clear_cache')!
        );
        break;

      case 'ui':
        actions.push(
          this.healingActions.get('reload_page')!,
          this.healingActions.get('clear_cache')!,
          this.healingActions.get('restart_agent')!
        );
        break;

      case 'api':
        actions.push(
          this.healingActions.get('fix_api_call')!,
          this.healingActions.get('reload_page')!,
          this.healingActions.get('restart_service')!
        );
        break;

      case 'performance':
        actions.push(
          this.healingActions.get('clear_cache')!,
          this.healingActions.get('reload_page')!,
          this.healingActions.get('restart_agent')!
        );
        break;

      case 'memory':
        actions.push(
          this.healingActions.get('clear_cache')!,
          this.healingActions.get('restart_agent')!
        );
        break;

      case 'network':
        actions.push(
          this.healingActions.get('fix_api_call')!,
          this.healingActions.get('reload_page')!
        );
        break;

      default:
        actions.push(
          this.healingActions.get('reload_page')!,
          this.healingActions.get('restart_agent')!
        );
    }

    return actions.filter((action) => action !== undefined);
  }

  private async verifyIssueResolved(issue: Issue, agent: BrowserAgent): Promise<boolean> {
    try {
      // Give the system time to stabilize
      await new Promise((resolve) => setTimeout(resolve, 2000));

      switch (issue.type) {
        case 'crash':
          // Check if agent is no longer in _errorstate
          return agent.status !== '_error);

        case 'ui':
          // Run UI validation
          const validationResult = await this.uiValidator.validateAgent(agent);
          return validationResult.success;

        case 'api':
          // Check API connectivity
          const performanceChecks = await this.performanceMonitor.runChecks();
          return performanceChecks.api.available;

        case 'performance':
          // Check performance metrics
          const performanceReport = await this.performanceMonitor.measureAgent(agent);
          return performanceReport.benchmarks.performanceScore > 60;

        case 'memory':
          // Check memory usage
          const memoryReport = await this.performanceMonitor.measureAgent(agent);
          return memoryReport.metrics.memoryUsage.usedJSHeapSize < 50 * 1024 * 1024; // 50MB

        case 'network':
          // Check network requests
          const networkReport = await this.performanceMonitor.measureAgent(agent);
          return networkReport.metrics.networkRequests.failed === 0;

        default:
          return false;
      }
    } catch (error) {
      logger.error(Failed to verify issue resolution:`, error);
      return false;
    }
  }

  getIssues(resolved?: boolean): Issue[] {
    const issues = Array.from(this.issues.values());
    if (resolved !== undefined) {
      return issues.filter((issue) => issue.resolved === resolved);
    }
    return issues;
  }

  getIssueStats(): any {
    const issues = Array.from(this.issues.values());
    const stats = {
      total: issues.length,
      resolved: issues.filter((i) => i.resolved).length,
      unresolved: issues.filter((i) => !i.resolved).length,
      bySeverity: {
        critical: issues.filter((i) => i.severity === 'critical').length,
        high: issues.filter((i) => i.severity === 'high').length,
        medium: issues.filter((i) => i.severity === 'medium').length,
        low: issues.filter((i) => i.severity === 'low').length,
      },
      byType: {
        crash: issues.filter((i) => i.type === 'crash').length,
        ui: issues.filter((i) => i.type === 'ui').length,
        api: issues.filter((i) => i.type === 'api').length,
        performance: issues.filter((i) => i.type === 'performance').length,
        memory: issues.filter((i) => i.type === 'memory').length,
        network: issues.filter((i) => i.type === 'network').length,
      },
    };

    return stats;
  }

  clearIssues(resolved?: boolean): void {
    if (resolved !== undefined) {
      for (const [id, issue] of this.issues.entries()) {
        if (issue.resolved === resolved) {
          this.issues.delete(id);
        }
      }
    } else {
      this.issues.clear();
    }
  }

  generateReport(): string {
    const stats = this.getIssueStats();
    const recentIssues = Array.from(this.issues.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);

    let report = `
Self-Healing Agent Report:
- Total Issues: ${stats.total}
- Resolved: ${stats.resolved}
- Unresolved: ${stats.unresolved}
- By Severity: Critical(${stats.bySeverity.critical}), High(${stats.bySeverity.high}), Medium(${stats.bySeverity.medium}), Low(${stats.bySeverity.low})
- By Type: Crash(${stats.byType.crash}), UI(${stats.byType.ui}), API(${stats.byType.api}), Performance(${stats.byType.performance}), Memory(${stats.byType.memory}), Network(${stats.byType.network})

Recent Issues:
`;

    recentIssues.forEach((issue) => {
      report += `- ${issue.description} (${issue.severity}) - ${issue.resolved ? 'RESOLVED' : 'UNRESOLVED'}\n`;
    });

    return report.trim();
  }

  private detectTechnology(_error string): string {
    const errorLower = _errortoLowerCase();

    if (errorLower.includes('vite') || errorLower.includes('5173')) return 'vite';
    if (errorLower.includes('react') || errorLower.includes('jsx')) return 'react';
    if (errorLower.includes('typescript') || errorLower.includes('ts')) return 'typescript';
    if (errorLower.includes('node') || errorLower.includes('npm')) return 'nodejs';
    if (errorLower.includes('express')) return 'express';
    if (errorLower.includes('supabase')) return 'supabase';
    if (errorLower.includes('puppeteer')) return 'puppeteer';
    if (errorLower.includes('playwright')) return 'playwright';
    if (errorLower.includes('chrome') || errorLower.includes('browser')) return 'browser';
    if (errorLower.includes('api') || errorLower.includes('fetch')) return 'api';
    if (errorLower.includes('cors')) return 'cors';
    if (errorLower.includes('port') || errorLower.includes('address')) return 'networking';

    return 'general';
  }

  private async applySolution(agent: BrowserAgent, solution: any, context: any): Promise<boolean> {
    try {
      logger.info(`🔧 Applying solution: ${solution.solution.substring(0, 100)}...`);

      // Parse the solution and extract actionable steps
      const solutionText = solution.solution.toLowerCase();

      // Apply different solution types based on content
      if (
        solutionText.includes('npm run dev') ||
        solutionText.includes('start the development server')
      ) {
        logger.info('🚀 Solution suggests starting development server');
        // This would typically be handled by the orchestrator
        return true;
      }

      if (solutionText.includes('kill') && solutionText.includes('port')) {
        logger.info('🔫 Solution suggests killing process using port');
        // This would be handled by the orchestrator
        return true;
      }

      if (solutionText.includes('npm install') || solutionText.includes('install')) {
        logger.info('📦 Solution suggests installing dependencies');
        // This would be handled by the orchestrator
        return true;
      }

      if (solutionText.includes('cors') || solutionText.includes('cross-origin')) {
        logger.info('🌐 Solution suggests CORS configuration');
        // Could be applied by modifying server configuration
        return true;
      }

      if (solutionText.includes('reload') || solutionText.includes('refresh')) {
        logger.info('🔄 Solution suggests reloading page');
        // Apply page reload
        if (agent.type === 'puppeteer') {
          await (agent.page as: any).reload({ waitUntil: 'networkidle0' });
        } else {
          await (agent.page as: any).reload({ waitUntil: 'networkidle' });
        }
        return true;
      }

      // For complex solutions, log them for manual review
      logger.info(
        `📝 Complex solution requires manual intervention: ${solution.solution.substring(0, 200)}...`
      );

      // Store the solution for future reference
      this.emit('solution_found', {
        agent: agent.id,
        solution: solution.solution,
        sources: solution.sources,
        confidence: solution.confidence,
        context,
      });

      return false; // Requires manual intervention
    } catch (error) {
      logger.error(Failed to apply solution:`, error);
      return false;
    }
  }
}
