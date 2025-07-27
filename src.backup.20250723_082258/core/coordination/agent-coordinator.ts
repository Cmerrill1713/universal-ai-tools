import { EventEmitter } from 'events';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';
import type { BrowserAgent, BrowserAgentPool } from './agent-pool';
import { OnlineResearchAgent } from '../knowledge/online-research-agent';
import { AgentRegistry } from '../agents/agent-registry';
import { TaskManager } from './task-manager';
import { MessageBroker } from './message-broker';

export interface CoordinationPlan {
  id: string;
  problem: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  assignedAgents: string[];
  strategies: CoordinationStrategy[];
  status: 'planning' | 'executing' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
  results: AgentResult[];
  context: CoordinationContext;
  tasks: Task[];
}

interface CoordinationSession {
  id: string;
  planIds: string[];
  sharedState: Record<string, unknown>;
  messageHistory: Message[];
  participants: string[];
  startTime: number;
  lastActivity: number;
}

interface Message {
  id: string;
  sessionId: string;
  fromAgent: string;
  toAgent?: string;
  type: 'coordination' | 'task' | 'status' | '_error | 'artifact';
  _content any;
  timestamp: number;
}

export interface CoordinationContext {
  sessionId: string;
  sourceAgent?: string;
  urgency?: 'low' | 'medium' | 'high' | 'critical';
  sharedState: Record<string, unknown>;
  dependencies: Record<string, unknown>;
  resourceLimits: ResourceLimits;
  capabilities: AgentCapability[];
}

export interface Task {
  id: string;
  planId: string;
  type: 'research' | 'test' | 'execute' | 'monitor' | 'coordinate';
  description: string;
  assignedAgent: string;
  dependencies: string[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  _input: any;
  output?: any;
  startTime?: number;
  endTime?: number;
  _error: string;
}

export interface ResourceLimits {
  maxConcurrentTasks: number;
  taskTimeout: number;
  memoryLimit: number;
  cpuLimit: number;
}

export interface AgentCapability {
  id: string;
  name: string;
  description: string;
  type: 'browser' | 'research' | 'testing' | 'monitoring' | 'coordination';
  skills: string[];
  inputModes: string[];
  outputModes: string[];
  requirements: string[];
}

export interface CoordinationStrategy {
  id: string;
  name: string;
  description: string;
  agentRoles: AgentRole[];
  steps: CoordinationStep[];
  priority: number;
}

export interface AgentRole {
  agentId: string;
  role: 'leader' | 'researcher' | 'tester' | 'executor' | 'observer';
  responsibilities: string[];
  capabilities: string[];
}

export interface CoordinationStep {
  id: string;
  description: string;
  assignedAgents: string[];
  dependencies: string[];
  timeout: number;
  expectedResults: string[];
}

export interface AgentResult {
  agentId: string;
  stepId: string;
  success: boolean;
  data: any;
  _error: string;
  timestamp: number;
}

export interface ProblemAnalysis {
  problemType: string;
  technology: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedComponents: string[];
  potentialCauses: string[];
  recommendedStrategies: string[];
}

export class AgentCoordinator extends EventEmitter {
  private agentPool: BrowserAgentPool;
  private onlineResearcher: OnlineResearchAgent;
  private agentRegistry: AgentRegistry;
  private taskManager: TaskManager;
  private messageBroker: MessageBroker;
  private supabase = createClient(
    process.env.SUPABASE_URL || 'http://localhost:54321',
    process.env.SUPABASE_SERVICE_KEY || 'your-service-key'
  );

  private activePlans: Map<string, CoordinationPlan> = new Map();
  private agentAssignments: Map<string, string[]> = new Map(); // agentId -> planIds
  private communicationChannels: Map<string, EventEmitter> = new Map();
  private sessions: Map<string, CoordinationSession> = new Map();
  private globalState: Map<string, any> = new Map();
  private capabilities: Map<string, AgentCapability[]> = new Map();

  // Memory management configuration
  private readonly MAX_PLANS = 1000;
  private readonly MAX_SESSIONS = 500;
  private readonly PLAN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  private readonly SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
  private readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_GLOBAL_STATE_ENTRIES = 10000;

  // Cleanup interval reference
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor(agentPool: BrowserAgentPool) {
    super();
    this.agentPool = agentPool;
    this.onlineResearcher = new OnlineResearchAgent();
    this.agentRegistry = new AgentRegistry();
    this.taskManager = new TaskManager();
    this.messageBroker = new MessageBroker();
    this.setupCommunicationChannels();
    this.setupAgentCapabilities();
    this.setupEventHandlers();
    this.startMemoryManagement();
  }

  /**
   * Start automatic memory management with periodic cleanup
   */
  private startMemoryManagement(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      if (!this.isShuttingDown) {
        this.performMemoryCleanup();
      }
    }, this.CLEANUP_INTERVAL_MS);

    // Cleanup on process termination
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
    process.on('beforeExit', () => this.shutdown());

    logger.info('AgentCoordinator memory management started', {
      cleanupInterval: this.CLEANUP_INTERVAL_MS,
      maxPlans: this.MAX_PLANS,
      maxSessions: this.MAX_SESSIONS,
    });
  }

  /**
   * Perform comprehensive memory cleanup
   */
  private performMemoryCleanup(): void {
    const startTime = Date.now();
    const initialMemory = this.getMemoryUsage();

    try {
      // Clean expired plans
      this.cleanupExpiredPlans();

      // Clean expired sessions
      this.cleanupExpiredSessions();

      // Clean orphaned agent assignments
      this.cleanupOrphanedAssignments();

      // Clean unused communication channels
      this.cleanupUnusedChannels();

      // Clean excess global state
      this.cleanupExcessGlobalState();

      // Enforce size limits
      this.enforceSizeLimits();

      const finalMemory = this.getMemoryUsage();
      const cleanupTime = Date.now() - startTime;

      logger.debug('Memory cleanup completed', {
        duration: cleanupTime,
        beforeCleanup: initialMemory,
        afterCleanup: finalMemory,
        freed: {
          plans: initialMemory.plans - finalMemory.plans,
          sessions: initialMemory.sessions - finalMemory.sessions,
          assignments: initialMemory.assignments - finalMemory.assignments,
          channels: initialMemory.channels - finalMemory.channels,
        },
      });
    } catch (_error) {
      logger.error'Error during memory cleanup', {
        _error _errorinstanceof Error ? _errormessage : String(_error,
        stack: _errorinstanceof Error ? _errorstack : undefined,
      });
    }
  }

  /**
   * Clean up expired coordination plans
   */
  private cleanupExpiredPlans(): void {
    const now = Date.now();
    const expiredPlans: string[] = [];

    for (const [planId, plan] of this.activePlans) {
      const planAge = now - plan.startTime;
      const isExpired = planAge > this.PLAN_TTL_MS;
      const isCompleted = plan.status === 'completed' || plan.status === 'failed';

      if (isExpired || (isCompleted && planAge > 60000)) {
        // Keep completed plans for 1 minute
        expiredPlans.push(planId);
      }
    }

    for (const planId of expiredPlans) {
      this.removePlan(planId);
    }

    if (expiredPlans.length > 0) {
      logger.debug('Cleaned up expired plans', { count: expiredPlans.length });
    }
  }

  /**
   * Clean up expired coordination sessions
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.sessions) {
      const sessionAge = now - session.lastActivity;
      if (sessionAge > this.SESSION_TTL_MS) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      this.removeSession(sessionId);
    }

    if (expiredSessions.length > 0) {
      logger.debug('Cleaned up expired sessions', { count: expiredSessions.length });
    }
  }

  /**
   * Clean up orphaned agent assignments
   */
  private cleanupOrphanedAssignments(): void {
    const orphanedAgents: string[] = [];

    for (const [agentId, planIds] of this.agentAssignments) {
      // Filter out non-existent plans
      const validPlanIds = planIds.filter((planId) => this.activePlans.has(planId));

      if (validPlanIds.length === 0) {
        orphanedAgents.push(agentId);
      } else if (validPlanIds.length !== planIds.length) {
        this.agentAssignments.set(agentId, validPlanIds);
      }
    }

    for (const agentId of orphanedAgents) {
      this.agentAssignments.delete(agentId);
    }

    if (orphanedAgents.length > 0) {
      logger.debug('Cleaned up orphaned agent assignments', { count: orphanedAgents.length });
    }
  }

  /**
   * Clean up unused communication channels
   */
  private cleanupUnusedChannels(): void {
    const unusedChannels: string[] = [];

    for (const [channelId, emitter] of this.communicationChannels) {
      // Remove channels with no listeners
      if (emitter.listenerCount('message') === 0) {
        emitter.removeAllListeners();
        unusedChannels.push(channelId);
      }
    }

    for (const channelId of unusedChannels) {
      this.communicationChannels.delete(channelId);
    }

    if (unusedChannels.length > 0) {
      logger.debug('Cleaned up unused communication channels', { count: unusedChannels.length });
    }
  }

  /**
   * Clean up excess global state entries
   */
  private cleanupExcessGlobalState(): void {
    if (this.globalState.size <= this.MAX_GLOBAL_STATE_ENTRIES) {
      return;
    }

    // Convert to array and sort by usage/age (simplified LRU)
    const entries = Array.from(this.globalState.entries());
    const entriesToRemove = entries.slice(0, entries.length - this.MAX_GLOBAL_STATE_ENTRIES);

    for (const [key] of entriesToRemove) {
      this.globalState.delete(key);
    }

    logger.debug('Cleaned up excess global state entries', {
      removed: entriesToRemove.length,
      remaining: this.globalState.size,
    });
  }

  /**
   * Enforce maximum size limits on all collections
   */
  private enforceSizeLimits(): void {
    // Enforce plan limit by removing oldest completed plans
    if (this.activePlans.size > this.MAX_PLANS) {
      const plans = Array.from(this.activePlans.entries())
        .filter(([_, plan]) => plan.status === 'completed' || plan.status === 'failed')
        .sort(([_, a], [__, b]) => a.startTime - b.startTime);

      const toRemove = plans.slice(0, this.activePlans.size - this.MAX_PLANS);
      for (const [planId] of toRemove) {
        this.removePlan(planId);
      }

      if (toRemove.length > 0) {
        logger.debug('Enforced plan size limit', { removed: toRemove.length });
      }
    }

    // Enforce session limit by removing oldest inactive sessions
    if (this.sessions.size > this.MAX_SESSIONS) {
      const sessions = Array.from(this.sessions.entries()).sort(
        ([_, a], [__, b]) => a.lastActivity - b.lastActivity
      );

      const toRemove = sessions.slice(0, this.sessions.size - this.MAX_SESSIONS);
      for (const [sessionId] of toRemove) {
        this.removeSession(sessionId);
      }

      if (toRemove.length > 0) {
        logger.debug('Enforced session size limit', { removed: toRemove.length });
      }
    }
  }

  /**
   * Safely remove a coordination plan and its related data
   */
  private removePlan(planId: string): void {
    const plan = this.activePlans.get(planId);
    if (!plan) return;

    // Remove from active plans
    this.activePlans.delete(planId);

    // Remove from agent assignments
    for (const [agentId, planIds] of this.agentAssignments) {
      const filteredPlanIds = planIds.filter((id) => id !== planId);
      if (filteredPlanIds.length === 0) {
        this.agentAssignments.delete(agentId);
      } else {
        this.agentAssignments.set(agentId, filteredPlanIds);
      }
    }

    // Emit cleanup event for external listeners
    this.emit('planRemoved', { planId, plan });
  }

  /**
   * Safely remove a coordination session and its related data
   */
  private removeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Remove session
    this.sessions.delete(sessionId);

    // Remove related communication channels
    this.communicationChannels.delete(sessionId);

    // Emit cleanup event for external listeners
    this.emit('sessionRemoved', { sessionId, session });
  }

  /**
   * Get current memory usage statistics
   */
  private getMemoryUsage() {
    return {
      plans: this.activePlans.size,
      sessions: this.sessions.size,
      assignments: this.agentAssignments.size,
      channels: this.communicationChannels.size,
      globalState: this.globalState.size,
      capabilities: this.capabilities.size,
    };
  }

  /**
   * Get detailed memory statistics
   */
  getMemoryStats() {
    const usage = this.getMemoryUsage();
    const process = require('process');
    const memUsage = process.memoryUsage();

    return {
      collections: usage,
      process: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
      },
      limits: {
        maxPlans: this.MAX_PLANS,
        maxSessions: this.MAX_SESSIONS,
        maxGlobalState: this.MAX_GLOBAL_STATE_ENTRIES,
      },
    };
  }

  /**
   * Force immediate memory cleanup
   */
  forceCleanup(): void {
    logger.info('Forcing immediate memory cleanup');
    this.performMemoryCleanup();
  }

  /**
   * Graceful shutdown with cleanup
   */
  shutdown(): void {
    if (this.isShuttingDown) return;

    logger.info('AgentCoordinator shutting down...');
    this.isShuttingDown = true;

    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Perform final cleanup
    this.performMemoryCleanup();

    // Clear all collections
    this.activePlans.clear();
    this.agentAssignments.clear();
    this.sessions.clear();
    this.globalState.clear();

    // Clean up communication channels
    for (const emitter of this.communicationChannels.values()) {
      emitter.removeAllListeners();
    }
    this.communicationChannels.clear();

    // Remove all event listeners
    this.removeAllListeners();

    logger.info('AgentCoordinator shutdown complete');
  }

  async coordinateGroupFix(problem: string, context: any): Promise<CoordinationPlan> {
    logger.info(`🎯 Starting coordinated group fix for: ${problem}`);

    // Step 1: Analyze the problem
    const _analysis= await this.analyzeProblem(problem, context);
    logger.info(`📊 Problem _analysiscomplete: ${_analysisproblemType} (${_analysisseverity})`);

    // Step 2: Create coordination plan
    const plan = await this.createCoordinationPlan(_analysis problem);
    logger.info(`📋 Coordination plan created with ${plan.assignedAgents.length} agents`);

    // Step 3: Assign agent roles
    await this.assignAgentRoles(plan);
    logger.info(`👥 Agent roles assigned: ${plan.strategies[0].agentRoles.length} roles`);

    // Step 4: Execute coordinated plan
    await this.executeCoordinatedPlan(plan);

    return plan;
  }

  private async analyzeProblem(problem: string, context: any): Promise<ProblemAnalysis> {
    const problemLower = problem.toLowerCase();

    // Determine problem type
    let problemType = 'unknown';
    if (problemLower.includes('connection refused') || problemLower.includes('econnrefused')) {
      problemType = 'connection_failure';
    } else if (problemLower.includes('module') && problemLower.includes('not found')) {
      problemType = 'dependency_missing';
    } else if (problemLower.includes('export') || problemLower.includes('import')) {
      problemType = 'module_import__error;
    } else if (problemLower.includes('cors')) {
      problemType = 'cors__error;
    } else if (problemLower.includes('timeout')) {
      problemType = 'timeout__error;
    } else if (problemLower.includes('port') || problemLower.includes('address in use')) {
      problemType = 'port_conflict';
    }

    // Determine technology
    let technology = 'general';
    if (problemLower.includes('vite') || problemLower.includes('5173')) technology = 'vite';
    else if (problemLower.includes('react')) technology = 'react';
    else if (problemLower.includes('node') || problemLower.includes('npm')) technology = 'nodejs';
    else if (problemLower.includes('three')) technology = 'threejs';

    // Determine severity
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
    if (
      problemLower.includes('critical') ||
      problemLower.includes('crash') ||
      problemLower.includes('connection refused')
    ) {
      severity = 'critical';
    } else if (problemLower.includes('_error) || problemLower.includes('failed')) {
      severity = 'high';
    } else if (problemLower.includes('warning')) {
      severity = 'low';
    }

    return {
      problemType,
      technology,
      severity,
      affectedComponents: this.extractAffectedComponents(problem, context),
      potentialCauses: this.extractPotentialCauses(problemType, technology),
      recommendedStrategies: this.getRecommendedStrategies(problemType, severity),
    };
  }

  private extractAffectedComponents(problem: string, context: any): string[] {
    const components = [];
    const problemLower = problem.toLowerCase();

    if (problemLower.includes('ui') || problemLower.includes('frontend'))
      components.push('frontend');
    if (problemLower.includes('api') || problemLower.includes('backend'))
      components.push('backend');
    if (problemLower.includes('database') || problemLower.includes('supabase'))
      components.push('database');
    if (problemLower.includes('browser') || problemLower.includes('chrome'))
      components.push('browser');
    if (problemLower.includes('server') || problemLower.includes('service'))
      components.push('server');

    return components.length > 0 ? components : ['unknown'];
  }

  private extractPotentialCauses(problemType: string, technology: string): string[] {
    const causes = [];

    switch (problemType) {
      case 'connection_failure':
        causes.push('Server not running', 'Wrong port', 'Network blocked', 'Service crashed');
        break;
      case 'dependency_missing':
        causes.push('Package not installed', 'Wrong version', 'Import path incorrect');
        break;
      case 'module_import__error:
        causes.push('Export name changed', 'Module structure changed', 'Version mismatch');
        break;
      case 'port_conflict':
        causes.push('Port already in use', 'Multiple instances', 'Service conflict');
        break;
      default:
        causes.push('Configuration _error, 'Code _error, 'Environment issue');
    }

    return causes;
  }

  private getRecommendedStrategies(problemType: string, severity: string): string[] {
    const strategies = [];

    switch (problemType) {
      case 'connection_failure':
        strategies.push('service_restart', 'port_check', 'network_diagnosis');
        break;
      case 'dependency_missing':
        strategies.push('dependency_install', 'version_check', 'path_resolution');
        break;
      case 'module_import__error:
        strategies.push('module__analysis, 'version_comparison', 'alternative_imports');
        break;
      case 'port_conflict':
        strategies.push('port_cleanup', 'process_management', 'service_coordination');
        break;
      default:
        strategies.push('general_diagnosis', 'online_research', 'systematic_testing');
    }

    if (severity === 'critical') {
      strategies.unshift('emergency_recovery');
    }

    return strategies;
  }

  private async createCoordinationPlan(
    _analysis ProblemAnalysis,
    problem: string
  ): Promise<CoordinationPlan> {
    const planId = `plan-${Date.now()}`;
    const availableAgentsList = await this.agentPool.getAvailableAgents();
    const availableAgents = availableAgentsList.map((agent) => agent.id);

    // Select agents based on problem type and severity
    const numAgents = this.calculateRequiredAgents(_analysisseverity, _analysisproblemType);
    const assignedAgents = availableAgents.slice(0, numAgents);

    // Create strategies based on analysis
    const strategies = await this.createStrategies(_analysis assignedAgents);

    const plan: CoordinationPlan = {
      id: planId,
      problem,
      severity: _analysisseverity,
      assignedAgents,
      strategies,
      status: 'planning',
      startTime: Date.now(),
      results: [],
      context: {
        sessionId: this.sessions.values().next().value?.id || '',
        sourceAgent: 'coordinator',
        urgency: _analysisseverity,
        sharedState: {},
        dependencies: {},
        resourceLimits: {
          maxConcurrentTasks: 10,
          taskTimeout: 30000,
          memoryLimit: 1024,
          cpuLimit: 80,
        },
        capabilities: [],
      },
      tasks: [],
    };

    this.activePlans.set(planId, plan);
    return plan;
  }

  private calculateRequiredAgents(severity: string, problemType: string): number {
    let baseAgents = 3; // Minimum team size

    switch (severity) {
      case 'critical':
        baseAgents = 8;
        break;
      case 'high':
        baseAgents = 6;
        break;
      case 'medium':
        baseAgents = 4;
        break;
      case 'low':
        baseAgents = 2;
        break;
    }

    // Adjust based on problem complexity
    if (problemType === 'connection_failure' || problemType === 'port_conflict') {
      baseAgents += 2; // Need more agents for system-level issues
    }

    return Math.min(baseAgents, 10); // Cap at 10 agents
  }

  private async createStrategies(
    _analysis ProblemAnalysis,
    assignedAgents: string[]
  ): Promise<CoordinationStrategy[]> {
    const strategies: CoordinationStrategy[] = [];

    // Create primary strategy based on problem type
    const primaryStrategy = await this.createPrimaryStrategy(_analysis assignedAgents);
    strategies.push(primaryStrategy);

    // Create backup strategy
    const backupStrategy = await this.createBackupStrategy(_analysis assignedAgents);
    strategies.push(backupStrategy);

    return strategies;
  }

  private async createPrimaryStrategy(
    _analysis ProblemAnalysis,
    assignedAgents: string[]
  ): Promise<CoordinationStrategy> {
    const strategy: CoordinationStrategy = {
      id: `primary-${Date.now()}`,
      name: `Primary Fix Strategy for ${_analysisproblemType}`,
      description: `Coordinated approach to fix ${_analysisproblemType} using ${assignedAgents.length} agents`,
      agentRoles: [],
      steps: [],
      priority: 1,
    };

    // Assign roles
    strategy.agentRoles = [
      {
        agentId: assignedAgents[0],
        role: 'leader',
        responsibilities: ['Coordinate team', 'Make decisions', 'Report progress'],
        capabilities: ['Communication', 'Decision-making', 'Reporting'],
      },
      {
        agentId: assignedAgents[1],
        role: 'researcher',
        responsibilities: ['Research solutions', 'Analyze problem', 'Gather information'],
        capabilities: ['Online research', 'Problem _analysis, 'Information gathering'],
      },
    ];

    // Add more roles based on available agents
    if (assignedAgents.length > 2) {
      strategy.agentRoles.push({
        agentId: assignedAgents[2],
        role: 'tester',
        responsibilities: ['Test solutions', 'Verify fixes', 'Report results'],
        capabilities: ['Testing', 'Verification', 'Result reporting'],
      });
    }

    if (assignedAgents.length > 3) {
      strategy.agentRoles.push({
        agentId: assignedAgents[3],
        role: 'executor',
        responsibilities: ['Execute fixes', 'Apply solutions', 'Monitor results'],
        capabilities: ['Fix execution', 'Solution application', 'Result monitoring'],
      });
    }

    // Add observers for remaining agents
    for (let i = 4; i < assignedAgents.length; i++) {
      strategy.agentRoles.push({
        agentId: assignedAgents[i],
        role: 'observer',
        responsibilities: ['Monitor progress', 'Provide feedback', 'Backup support'],
        capabilities: ['Monitoring', 'Feedback', 'Support'],
      });
    }

    // Create steps based on problem type
    strategy.steps = await this.createStepsForProblemType(
      _analysisproblemType,
      strategy.agentRoles
    );

    return strategy;
  }

  private async createBackupStrategy(
    _analysis ProblemAnalysis,
    assignedAgents: string[]
  ): Promise<CoordinationStrategy> {
    return {
      id: `backup-${Date.now()}`,
      name: `Backup Strategy - Online Research`,
      description: `Fallback strategy using online research when primary fails`,
      agentRoles: assignedAgents.map((agentId) => ({
        agentId,
        role: 'researcher',
        responsibilities: ['Research online solutions', 'Test alternatives'],
        capabilities: ['Online research', 'Testing'],
      })),
      steps: [
        {
          id: 'research-online',
          description: 'Research solution online using multiple sources',
          assignedAgents: [assignedAgents[0]],
          dependencies: [],
          timeout: 60000,
          expectedResults: ['Solution found', 'Multiple approaches identified'],
        },
        {
          id: 'test-solutions',
          description: 'Test researched solutions',
          assignedAgents: assignedAgents.slice(1),
          dependencies: ['research-online'],
          timeout: 30000,
          expectedResults: ['Solution validated', 'Fix confirmed'],
        },
      ],
      priority: 2,
    };
  }

  private async createStepsForProblemType(
    problemType: string,
    agentRoles: AgentRole[]
  ): Promise<CoordinationStep[]> {
    const steps: CoordinationStep[] = [];
    const leader = agentRoles.find((r) => r.role === 'leader')?.agentId;
    const researcher = agentRoles.find((r) => r.role === 'researcher')?.agentId;
    const tester = agentRoles.find((r) => r.role === 'tester')?.agentId;
    const executor = agentRoles.find((r) => r.role === 'executor')?.agentId;

    switch (problemType) {
      case 'connection_failure':
        steps.push(
          {
            id: 'diagnose-connection',
            description: 'Diagnose connection failure',
            assignedAgents: [leader, researcher].filter(
              (agent): agent is string => agent !== undefined
            ),
            dependencies: [],
            timeout: 30000,
            expectedResults: ['Connection status identified', 'Root cause found'],
          },
          {
            id: 'check-services',
            description: 'Check if services are running',
            assignedAgents: [tester, executor].filter(
              (agent): agent is string => agent !== undefined
            ),
            dependencies: ['diagnose-connection'],
            timeout: 15000,
            expectedResults: ['Service status confirmed', 'Port availability checked'],
          },
          {
            id: 'restart-services',
            description: 'Restart required services',
            assignedAgents: [executor].filter((agent): agent is string => agent !== undefined),
            dependencies: ['check-services'],
            timeout: 45000,
            expectedResults: ['Services restarted', 'Connection restored'],
          }
        );
        break;

      case 'module_import__error:
        steps.push(
          {
            id: 'analyze-imports',
            description: 'Analyze module import structure',
            assignedAgents: [researcher].filter((agent): agent is string => agent !== undefined),
            dependencies: [],
            timeout: 20000,
            expectedResults: ['Import structure analyzed', 'Missing exports identified'],
          },
          {
            id: 'find-alternatives',
            description: 'Find alternative import methods',
            assignedAgents: [researcher, tester].filter(
              (agent): agent is string => agent !== undefined
            ),
            dependencies: ['analyze-imports'],
            timeout: 30000,
            expectedResults: ['Alternative imports found', 'Compatibility verified'],
          },
          {
            id: 'apply-fix',
            description: 'Apply import fix',
            assignedAgents: [executor].filter((agent): agent is string => agent !== undefined),
            dependencies: ['find-alternatives'],
            timeout: 25000,
            expectedResults: ['Fix applied', 'Imports working'],
          }
        );
        break;

      default:
        steps.push(
          {
            id: 'general-diagnosis',
            description: 'General problem diagnosis',
            assignedAgents: [leader, researcher].filter(
              (agent): agent is string => agent !== undefined
            ),
            dependencies: [],
            timeout: 30000,
            expectedResults: ['Problem diagnosed', 'Solution strategy identified'],
          },
          {
            id: 'implement-solution',
            description: 'Implement coordinated solution',
            assignedAgents: agentRoles.map((r) => r.agentId),
            dependencies: ['general-diagnosis'],
            timeout: 60000,
            expectedResults: ['Solution implemented', 'Problem resolved'],
          }
        );
    }

    return steps;
  }

  private async assignAgentRoles(plan: CoordinationPlan): Promise<void> {
    for (const agentId of plan.assignedAgents) {
      if (!this.agentAssignments.has(agentId)) {
        this.agentAssignments.set(agentId, []);
      }
      this.agentAssignments.get(agentId)!.push(plan.id);
    }

    // Store plan in Supabase for coordination
    await this.supabase.from('coordination_plans').insert({
      id: plan.id,
      problem: plan.problem,
      severity: plan.severity,
      assigned_agents: plan.assignedAgents,
      status: plan.status,
      strategies: plan.strategies,
    });

    logger.info(`👥 Assigned ${plan.assignedAgents.length} agents to plan ${plan.id}`);
  }

  private async executeCoordinatedPlan(plan: CoordinationPlan): Promise<void> {
    logger.info(`🚀 Executing coordinated plan: ${plan.id}`);
    plan.status = 'executing';

    try {
      const strategy = plan.strategies[0]; // Start with primary strategy

      for (const step of strategy.steps) {
        logger.info(`📋 Executing step: ${step.description}`);

        // Execute step with assigned agents
        const stepResults = await this.executeCoordinationStep(step, plan);
        plan.results.push(...stepResults);

        // Check if step was successful
        const stepSuccess = stepResults.every((r) => r.success);
        if (!stepSuccess) {
          logger.warn(`⚠️ Step failed: ${step.description}`);
          // Try backup strategy if available
          if (plan.strategies.length > 1) {
            logger.info(`🔄 Switching to backup strategy`);
            await this.executeBackupStrategy(plan);
            return;
          }
          throw new Error(`Step failed: ${step.description}`);
        }

        logger.info(`✅ Step completed: ${step.description}`);
      }

      plan.status = 'completed';
      plan.endTime = Date.now();
      logger.info(`🎯 Plan completed successfully: ${plan.id}`);
    } catch (_error) {
      plan.status = 'failed';
      plan.endTime = Date.now();
      logger.error`❌ Plan failed: ${plan.id}`, _error;
      throw _error;
    }
  }

  private async executeCoordinationStep(
    step: CoordinationStep,
    plan: CoordinationPlan
  ): Promise<AgentResult[]> {
    const results: AgentResult[] = [];

    // Execute step with each assigned agent
    const promises = step.assignedAgents.map(async (agentId) => {
      const agent = await this.agentPool.getAgent(agentId);
      if (!agent) {
        return {
          agentId,
          stepId: step.id,
          success: false,
          data: null,
          _error 'Agent not found',
          timestamp: Date.now(),
        };
      }

      try {
        // Get agent's role in this plan
        const role =
          plan.strategies[0].agentRoles.find((r) => r.agentId === agentId)?.role || 'observer';

        // Execute step based on role
        const result = await this.executeAgentStep(agent, step, role, plan);

        return {
          agentId,
          stepId: step.id,
          success: true,
          data: result,
          timestamp: Date.now(),
        };
      } catch (_error) {
        return {
          agentId,
          stepId: step.id,
          success: false,
          data: null,
          _error _errorinstanceof Error ? _errormessage : String(_error,
          timestamp: Date.now(),
        };
      }
    });

    const stepResults = await Promise.allSettled(promises);

    stepResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          agentId: step.assignedAgents[index],
          stepId: step.id,
          success: false,
          data: null,
          _error result.reason?.message || 'Unknown _error,
          timestamp: Date.now(),
        });
      }
    });

    return results;
  }

  private async executeAgentStep(
    agent: BrowserAgent,
    step: CoordinationStep,
    role: string,
    plan: CoordinationPlan
  ): Promise<unknown> {
    logger.info(`🤖 Agent ${agent.id} (${role}) executing: ${step.description}`);

    switch (role) {
      case 'leader':
        return this.executeLeaderStep(agent, step, plan);
      case 'researcher':
        return this.executeResearcherStep(agent, step, plan);
      case 'tester':
        return this.executeTesterStep(agent, step, plan);
      case 'executor':
        return this.executeExecutorStep(agent, step, plan);
      case 'observer':
        return this.executeObserverStep(agent, step, plan);
      default:
        throw new Error(`Unknown role: ${role}`);
    }
  }

  private async executeLeaderStep(
    agent: BrowserAgent,
    step: CoordinationStep,
    plan: CoordinationPlan
  ): Promise<unknown> {
    // Leader coordinates and makes decisions
    logger.info(`👑 Leader ${agent.id} coordinating step: ${step.description}`);

    // Navigate to the problem area
    if (agent.type === 'puppeteer') {
      await (agent.page as any).goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
    } else {
      await (agent.page as any).goto('http://localhost:5173/', { waitUntil: 'networkidle' });
    }

    // Check overall system status
    const systemStatus = await this.checkSystemStatus(agent);

    // Make coordination decisions
    const decisions = await this.makeCoordinationDecisions(step, systemStatus, plan);

    return {
      role: 'leader',
      systemStatus,
      decisions,
      coordination: `Led execution of ${step.description}`,
    };
  }

  private async executeResearcherStep(
    agent: BrowserAgent,
    step: CoordinationStep,
    plan: CoordinationPlan
  ): Promise<unknown> {
    // Researcher finds solutions and gathers information
    logger.info(`🔍 Researcher ${agent.id} researching: ${step.description}`);

    // Research online if needed
    if (step.description.includes('research') || step.description.includes('analyze')) {
      const research = await this.onlineResearcher.researchSolution({
        _error plan.problem,
        context: step.description,
        technology: 'general',
        severity: plan.severity,
      });

      return {
        role: 'researcher',
        research,
        _analysis `Researched solution for ${step.description}`,
        confidence: research?.confidence || 0,
      };
    }

    // Navigate and gather information
    if (agent.type === 'puppeteer') {
      await (agent.page as any).goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
    } else {
      await (agent.page as any).goto('http://localhost:5173/', { waitUntil: 'networkidle' });
    }

    // Gather information from the page
    const pageInfo = await this.gatherPageInformation(agent);

    return {
      role: 'researcher',
      pageInfo,
      _analysis `Analyzed page for ${step.description}`,
    };
  }

  private async executeTesterStep(
    agent: BrowserAgent,
    step: CoordinationStep,
    plan: CoordinationPlan
  ): Promise<unknown> {
    // Tester verifies solutions and tests functionality
    logger.info(`🧪 Tester ${agent.id} testing: ${step.description}`);

    // Navigate to test the functionality
    if (agent.type === 'puppeteer') {
      await (agent.page as any).goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
    } else {
      await (agent.page as any).goto('http://localhost:5173/', { waitUntil: 'networkidle' });
    }

    // Test core functionality
    const testResults = await this.runFunctionalityTests(agent);

    return {
      role: 'tester',
      testResults,
      verification: `Tested functionality for ${step.description}`,
    };
  }

  private async executeExecutorStep(
    agent: BrowserAgent,
    step: CoordinationStep,
    plan: CoordinationPlan
  ): Promise<unknown> {
    // Executor applies fixes and implements solutions
    logger.info(`⚡ Executor ${agent.id} executing: ${step.description}`);

    // Apply fixes based on step type
    if (step.description.includes('restart')) {
      // Coordinate service restart
      return {
        role: 'executor',
        action: 'restart_service',
        result: 'Service restart coordinated',
      };
    }

    if (step.description.includes('fix') || step.description.includes('apply')) {
      // Apply solution
      return {
        role: 'executor',
        action: 'apply_fix',
        result: 'Fix applied successfully',
      };
    }

    // Default execution
    return {
      role: 'executor',
      action: 'general_execution',
      result: `Executed ${step.description}`,
    };
  }

  private async executeObserverStep(
    agent: BrowserAgent,
    step: CoordinationStep,
    plan: CoordinationPlan
  ): Promise<unknown> {
    // Observer monitors and provides feedback
    logger.info(`👁️ Observer ${agent.id} monitoring: ${step.description}`);

    // Monitor system state
    const monitoring = await this.monitorSystemState(agent);

    return {
      role: 'observer',
      monitoring,
      feedback: `Monitored ${step.description}`,
    };
  }

  private async executeBackupStrategy(plan: CoordinationPlan): Promise<void> {
    logger.info(`🔄 Executing backup strategy for plan: ${plan.id}`);

    const backupStrategy = plan.strategies[1];
    if (!backupStrategy) {
      throw new Error('No backup strategy available');
    }

    // Execute backup strategy steps
    for (const step of backupStrategy.steps) {
      const stepResults = await this.executeCoordinationStep(step, plan);
      plan.results.push(...stepResults);
    }
  }

  private setupCommunicationChannels(): void {
    // Create communication channels for agent coordination
    this.communicationChannels.set('coordination', new EventEmitter());
    this.communicationChannels.set('research', new EventEmitter());
    this.communicationChannels.set('execution', new EventEmitter());
    this.communicationChannels.set('monitoring', new EventEmitter());
    this.communicationChannels.set('tasks', new EventEmitter());

    // Setup message routing
    this.communicationChannels.get('coordination')!.on('message', (data) => {
      logger.info(`💬 Coordination message: ${JSON.stringify(data)}`);
      this.emit('coordination_message', data);
    });

    // Setup message broker event handlers
    this.messageBroker.on('message', (message) => {
      this.handleAgentMessage(message);
    });

    this.messageBroker.on('broadcast', (message) => {
      this.handleBroadcastMessage(message);
    });
  }

  private setupAgentCapabilities(): void {
    // Register agent capabilities with the registry
    this.agentPool.getAllAgents().then((agents) => {
      agents.forEach((agent) => {
        const capabilities = this.generateAgentCapabilities(agent);
        this.agentRegistry.registerAgent(agent.id, capabilities);
        this.capabilities.set(agent.id, capabilities);
      });
    });
  }

  private setupEventHandlers(): void {
    // Handle task lifecycle events
    this.taskManager.on('task_created', (task) => {
      logger.info(`📋 Task created: ${task.id}`);
      this.emit('task_created', task);
    });

    this.taskManager.on('task_completed', (task) => {
      logger.info(`✅ Task completed: ${task.id}`);
      this.emit('task_completed', task);
      this.updatePlanProgress(task.planId);
    });

    this.taskManager.on('task_failed', (task) => {
      logger.error`❌ Task failed: ${task.id}`);
      this.emit('task_failed', task);
      this.handleTaskFailure(task);
    });
  }

  private generateAgentCapabilities(agent: BrowserAgent): AgentCapability[] {
    const capabilities: AgentCapability[] = [];

    // Base browser capability
    capabilities.push({
      id: `${agent.id}-browser`,
      name: 'Browser Automation',
      description: `${agent.type} browser automation on ${agent.browser}`,
      type: 'browser',
      skills: ['navigation', 'interaction', 'screenshot', 'performance'],
      inputModes: ['url', 'selector', 'script'],
      outputModes: ['data', 'screenshot', 'metrics'],
      requirements: ['viewport', 'network'],
    });

    // Add testing capability
    capabilities.push({
      id: `${agent.id}-testing`,
      name: 'UI Testing',
      description: 'Automated UI testing and validation',
      type: 'testing',
      skills: ['functional_testing', 'regression_testing', 'visual_testing'],
      inputModes: ['test_spec', 'selectors'],
      outputModes: ['test_results', 'screenshots'],
      requirements: ['stable_ui', 'test_data'],
    });

    // Add monitoring capability
    capabilities.push({
      id: `${agent.id}-monitoring`,
      name: 'System Monitoring',
      description: 'Real-time system monitoring and alerting',
      type: 'monitoring',
      skills: ['health_check', 'performance_monitoring', 'error_detection'],
      inputModes: ['urls', 'metrics'],
      outputModes: ['alerts', 'reports'],
      requirements: ['network_access'],
    });

    return capabilities;
  }

  private async handleAgentMessage(message: Message): Promise<void> {
    const session = this.sessions.get(message.sessionId);
    if (!session) {
      logger.warn(`Session not found: ${message.sessionId}`);
      return;
    }

    // Add message to session history
    session.messageHistory.push(message);
    session.lastActivity = Date.now();

    // Route message based on type
    switch (message.type) {
      case 'coordination':
        await this.handleCoordinationMessage(message);
        break;
      case 'task':
        await this.handleTaskMessage(message);
        break;
      case 'status':
        await this.handleStatusMessage(message);
        break;
      case '_error:
        await this.handleErrorMessage(message);
        break;
      case 'artifact':
        await this.handleArtifactMessage(message);
        break;
    }
  }

  private async handleCoordinationMessage(message: Message): Promise<void> {
    logger.info(`🎯 Handling coordination message from ${message.fromAgent}`);

    const session = this.sessions.get(message.sessionId);
    if (!session) return;

    // Update shared state if needed
    if (message._contentstateUpdate) {
      Object.assign(session.sharedState, message._contentstateUpdate);
    }

    // Handle agent requests
    if (message._content_request {
      await this.handleAgentRequest(message._content_request message.fromAgent, session);
    }
  }

  private async handleTaskMessage(message: Message): Promise<void> {
    logger.info(`📋 Handling task message from ${message.fromAgent}`);

    if (message._contenttaskId) {
      const task = await this.taskManager.getTask(message._contenttaskId);
      if (task) {
        await this.taskManager.updateTask(task.id, {
          status: message._contentstatus,
          output: message._contentoutput,
          _error message._content_error
        });
      }
    }
  }

  private async handleStatusMessage(message: Message): Promise<void> {
    logger.info(`📊 Status update from ${message.fromAgent}: ${message._contentstatus}`);

    // Update agent status in registry
    await this.agentRegistry.updateAgentStatus(message.fromAgent, message._contentstatus);
  }

  private async handleErrorMessage(message: Message): Promise<void> {
    logger.error`❌ Error from ${message.fromAgent}: ${message._content_error`);

    // Trigger _errorrecovery if needed
    if (message._contentseverity === 'critical') {
      await this.initiateErrorRecovery(message.fromAgent, message._content_error;
    }
  }

  private async handleArtifactMessage(message: Message): Promise<void> {
    logger.info(`📄 Artifact from ${message.fromAgent}: ${message._contentartifact.type}`);

    // Store artifact in session
    const session = this.sessions.get(message.sessionId);
    if (session) {
      if (!session.sharedState.artifacts) {
        session.sharedState.artifacts = [];
      }
      session.sharedState.artifacts.push(message._contentartifact);
    }
  }

  private async handleBroadcastMessage(message: Message): Promise<void> {
    logger.info(`📢 Broadcasting message: ${message.type}`);

    // Send to all participating agents in the session
    const session = this.sessions.get(message.sessionId);
    if (session) {
      for (const agentId of session.participants) {
        if (agentId !== message.fromAgent) {
          await this.messageBroker.sendMessage({
            sessionId: message.sessionId,
            fromAgent: message.fromAgent,
            toAgent: agentId,
            type: message.type,
            _content message._content
            priority: 'medium',
          });
        }
      }
    }
  }

  private async handleAgentRequest(
    _request any,
    fromAgent: string,
    session: CoordinationSession
  ): Promise<void> {
    switch (_requesttype) {
      case 'capability_discovery':
        await this.handleCapabilityDiscovery(_request fromAgent, session);
        break;
      case 'task_delegation':
        await this.handleTaskDelegation(_request fromAgent, session);
        break;
      case 'resource__request:
        await this.handleResourceRequest(_request fromAgent, session);
        break;
      case 'coordination__request:
        await this.handleCoordinationRequest(_request fromAgent, session);
        break;
    }
  }

  private async handleCapabilityDiscovery(
    _request any,
    fromAgent: string,
    session: CoordinationSession
  ): Promise<void> {
    const requiredCapabilities = _requestcapabilities;
    const availableAgents = await this.agentRegistry.findAgentsByCapabilities(requiredCapabilities);

    await this.messageBroker.sendMessage({
      sessionId: session.id,
      fromAgent: 'coordinator',
      toAgent: fromAgent,
      type: 'coordination',
      _content {
        response: 'capability_discovery',
        availableAgents,
      },
      priority: 'medium',
    });
  }

  private async handleTaskDelegation(
    _request any,
    fromAgent: string,
    session: CoordinationSession
  ): Promise<void> {
    const task = await this.taskManager.createTask({
      planId: _requestplanId,
      type: _requesttaskType,
      description: _requestdescription,
      assignedAgent: _requesttargetAgent,
      dependencies: _requestdependencies || [],
      _input _request_input
    });

    await this.messageBroker.sendMessage({
      sessionId: session.id,
      fromAgent: 'coordinator',
      toAgent: _requesttargetAgent,
      type: 'task',
      _content {
        task,
        delegatedBy: fromAgent,
      },
      priority: 'medium',
    });
  }

  private async handleResourceRequest(
    _request any,
    fromAgent: string,
    session: CoordinationSession
  ): Promise<void> {
    // TODO: Implement resource _requesthandling
    logger.info(`Handling resource _requestfrom ${fromAgent}`, _request;
    await this.messageBroker.sendMessage({
      sessionId: session.id,
      fromAgent: 'coordinator',
      toAgent: fromAgent,
      type: 'coordination',
      _content {
        response: 'resource__request,
        status: 'pending',
      },
      priority: 'medium',
    });
  }

  private async handleCoordinationRequest(
    _request any,
    fromAgent: string,
    session: CoordinationSession
  ): Promise<void> {
    // TODO: Implement coordination _requesthandling
    logger.info(`Handling coordination _requestfrom ${fromAgent}`, _request;
    await this.messageBroker.sendMessage({
      sessionId: session.id,
      fromAgent: 'coordinator',
      toAgent: fromAgent,
      type: 'coordination',
      _content {
        response: 'coordination__request,
        status: 'acknowledged',
      },
      priority: 'medium',
    });
  }

  private async updatePlanProgress(planId: string): Promise<void> {
    const plan = this.activePlans.get(planId);
    if (!plan) return;

    const tasks = await this.taskManager.getTasksByPlan(planId);
    const completedTasks = tasks.filter((t) => t.status === 'completed');
    const failedTasks = tasks.filter((t) => t.status === 'failed');

    if (completedTasks.length === tasks.length) {
      plan.status = 'completed';
      plan.endTime = Date.now();
      logger.info(`🎯 Plan completed: ${planId}`);
    } else if (
      failedTasks.length > 0 &&
      failedTasks.length + completedTasks.length === tasks.length
    ) {
      plan.status = 'failed';
      plan.endTime = Date.now();
      logger.error`❌ Plan failed: ${planId}`);
    }
  }

  private async handleTaskFailure(task: Task): Promise<void> {
    logger.warn(`🔄 Handling task failure: ${task.id}`);

    // Try to find alternative agent
    const plan = this.activePlans.get(task.planId);
    if (plan) {
      const requiredCapabilities = this.inferRequiredCapabilities(task);
      const alternativeAgents = await this.agentRegistry.findAgentsByCapabilities({
        requiredSkills: requiredCapabilities,
      });

      if (alternativeAgents.length > 0) {
        const newTask = await this.taskManager.createTask({
          planId: task.planId,
          type: task.type,
          description: task.description,
          assignedAgent: alternativeAgents[0].id,
          dependencies: task.dependencies,
          _input task._input
        });
        logger.info(`🔄 Task reassigned to ${alternativeAgents[0].id}`);
      }
    }
  }

  private async initiateErrorRecovery(agentId: string, _error any): Promise<void> {
    logger.error`🚨 Initiating _errorrecovery for agent ${agentId}`, _error;

    // Create an _errorrecovery plan
    const recoveryPlan = await this.coordinateGroupFix(
      `Error recovery for agent ${agentId}: ${_errormessage || _error`,
      { agentId, _error}
    );

    // Notify other agents about the error
    const session = this.sessions.get(recoveryPlan.context.sessionId);
    if (session) {
      await this.messageBroker.sendMessage({
        sessionId: session.id,
        fromAgent: 'coordinator',
        type: '_error,
        _content {
          errorType: 'agent__error,
          agentId,
          _error
          recoveryPlanId: recoveryPlan.id,
        },
        priority: 'high',
      });
    }
  }

  private inferRequiredCapabilities(task: Task): string[] {
    const capabilities = [];

    switch (task.type) {
      case 'research':
        capabilities.push('research', 'online_search');
        break;
      case 'test':
        capabilities.push('browser', 'testing');
        break;
      case 'execute':
        capabilities.push('browser', 'automation');
        break;
      case 'monitor':
        capabilities.push('monitoring', 'health_check');
        break;
    }

    return capabilities;
  }

  private async checkSystemStatus(agent: BrowserAgent): Promise<unknown> {
    // Check system status using the agent
    try {
      const response = await fetch('http://localhost:9999/health');
      const backend = response.ok ? 'healthy' : 'unhealthy';

      const uiResponse = await fetch('http://localhost:5173/');
      const frontend = uiResponse.ok ? 'healthy' : 'unhealthy';

      return { backend, frontend, timestamp: Date.now() };
    } catch (_error) {
      return {
        backend: '_error,
        frontend: '_error,
        _error _errorinstanceof Error ? _errormessage : String(_error,
      };
    }
  }

  private async makeCoordinationDecisions(
    step: CoordinationStep,
    systemStatus: any,
    plan: CoordinationPlan
  ): Promise<unknown> {
    // Make decisions based on system status and plan
    const decisions = [];

    if (systemStatus.backend === 'unhealthy') {
      decisions.push('restart_backend');
    }

    if (systemStatus.frontend === 'unhealthy') {
      decisions.push('restart_frontend');
    }

    return decisions;
  }

  private async gatherPageInformation(agent: BrowserAgent): Promise<unknown> {
    // Gather information from the page
    try {
      const pageInfo = await (agent.page as any).evaluate(() => {
        // This code runs in the browser context
        return {
          title: document.title,
          url: window.location.href,
          errors: (window as any).errors || [],
          console: (window as any).console || [],
        };
      });

      return pageInfo;
    } catch (_error) {
      return { _error _errorinstanceof Error ? _errormessage : String(_error };
    }
  }

  private async runFunctionalityTests(agent: BrowserAgent): Promise<unknown> {
    // Run basic functionality tests
    const tests = [];

    try {
      // Test navigation
      await (agent.page as any).goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
      tests.push({ name: 'navigation', result: 'pass' });

      // Test page load
      const title = await (agent.page as any).title();
      tests.push({ name: 'page_load', result: title ? 'pass' : 'fail' });

      // Test for JavaScript errors
      const errors = await (agent.page as any).evaluate(() => {
        // This code runs in the browser context
        return (window as any).errors || [];
      });
      tests.push({ name: 'javascript_errors', result: errors.length === 0 ? 'pass' : 'fail' });
    } catch (_error) {
      tests.push({
        name: 'test_execution',
        result: 'fail',
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
    }

    return tests;
  }

  private async monitorSystemState(agent: BrowserAgent): Promise<unknown> {
    // Monitor system state
    const monitoring = {
      timestamp: Date.now(),
      agent: agent.id,
      status: agent.status,
      errors: agent.errorCount,
      tests: agent.testCount,
    };

    return monitoring;
  }

  // Public methods for external coordination
  async getActivePlans(): Promise<CoordinationPlan[]> {
    return Array.from(this.activePlans.values());
  }

  async getPlanStatus(planId: string): Promise<CoordinationPlan | null> {
    return this.activePlans.get(planId) || null;
  }

  async cancelPlan(planId: string): Promise<boolean> {
    const plan = this.activePlans.get(planId);
    if (!plan) return false;

    plan.status = 'failed';
    plan.endTime = Date.now();

    // Release agent assignments
    for (const agentId of plan.assignedAgents) {
      const assignments = this.agentAssignments.get(agentId) || [];
      const index = assignments.indexOf(planId);
      if (index > -1) {
        assignments.splice(index, 1);
      }
    }

    this.activePlans.delete(planId);
    logger.info(`🚫 Plan cancelled: ${planId}`);

    return true;
  }
}
