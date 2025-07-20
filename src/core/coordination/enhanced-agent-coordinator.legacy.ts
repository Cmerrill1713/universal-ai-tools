import { EventEmitter } from 'events';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';
import type { BrowserAgent, BrowserAgentPool } from './agent-pool';
import { OnlineResearchAgent } from '../knowledge/online-research-agent';
import { AgentRegistry } from '../agents/agent-registry';
import type { Task } from './task-manager';
import { TaskManager } from './task-manager';
import type { Message } from './message-broker';
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

export interface CoordinationContext {
  sessionId: string;
  sharedState: Record<string, any>;
  dependencies: Record<string, any>;
  resourceLimits: ResourceLimits;
  capabilities: AgentCapability[];
}

export interface CoordinationSession {
  id: string;
  planIds: string[];
  sharedState: Record<string, any>;
  messageHistory: Message[];
  participants: string[];
  startTime: number;
  lastActivity: number;
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
  error?: string;
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

export class EnhancedAgentCoordinator extends EventEmitter {
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

  constructor(agentPool: BrowserAgentPool) {
    super();
    this.agentPool = agentPool;
    this.onlineResearcher = new OnlineResearchAgent();
    this.agentRegistry = new AgentRegistry();
    this.taskManager = new TaskManager(20); // Support up to 20 concurrent tasks
    this.messageBroker = new MessageBroker();
    this.setupCommunicationChannels();
    this.setupAgentCapabilities();
    this.setupEventHandlers();
  }

  async coordinateGroupFix(problem: string, context: any): Promise<CoordinationPlan> {
    logger.info(`🎯 Starting enhanced coordinated group fix for: ${problem}`);
    
    try {
      // Step 1: Create coordination session
      const session = await this.createCoordinationSession(problem, context);
      logger.info(`📋 Coordination session created: ${session.id}`);
      
      // Step 2: Analyze the problem
      const analysis = await this.analyzeProblem(problem, context);
      logger.info(`📊 Problem analysis complete: ${analysis.problemType} (${analysis.severity})`);
      
      // Step 3: Create coordination plan
      const plan = await this.createCoordinationPlan(analysis, problem, session);
      logger.info(`📋 Coordination plan created`);
      
      // Step 4: Discover and assign agents
      await this.discoverAndAssignAgents(plan);
      logger.info(`🤖 Agents discovered and assigned: ${plan.assignedAgents.length} agents`);
      
      // Step 5: Setup agent communication
      await this.setupAgentCommunication(plan, session);
      logger.info(`💬 Agent communication established`);
      
      // Step 6: Execute coordinated plan
      await this.executeCoordinatedPlan(plan);
      
      logger.info(`🎯 Enhanced coordinated group fix completed successfully for: ${problem}`);
      return plan;
      
    } catch (error) {
      logger.error(`❌ Enhanced coordinated group fix failed for: ${problem}`, error);
      throw error;
    }
  }

  private async createCoordinationSession(problem: string, context: any): Promise<CoordinationSession> {
    const session: CoordinationSession = {
      id: `session-${Date.now()}`,
      planIds: [],
      sharedState: {
        problem,
        context,
        startTime: Date.now(),
        artifacts: [],
        decisions: [],
        metrics: {}
      },
      messageHistory: [],
      participants: [],
      startTime: Date.now(),
      lastActivity: Date.now()
    };

    this.sessions.set(session.id, session);
    
    // Create broadcast group for this session
    await this.messageBroker.createBroadcastGroup({
      id: `session-${session.id}`,
      name: `Coordination Session ${session.id}`,
      description: `Broadcast group for coordination session ${session.id}`,
      messageTypes: ['coordination', 'status', 'artifact']
    });

    return session;
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
      problemType = 'module_import_error';
    } else if (problemLower.includes('cors')) {
      problemType = 'cors_error';
    } else if (problemLower.includes('timeout')) {
      problemType = 'timeout_error';
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
    if (problemLower.includes('critical') || problemLower.includes('crash') || problemLower.includes('connection refused')) {
      severity = 'critical';
    } else if (problemLower.includes('error') || problemLower.includes('failed')) {
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
      recommendedStrategies: this.getRecommendedStrategies(problemType, severity)
    };
  }

  private extractAffectedComponents(problem: string, context: any): string[] {
    const components = [];
    const problemLower = problem.toLowerCase();
    
    if (problemLower.includes('ui') || problemLower.includes('frontend')) components.push('frontend');
    if (problemLower.includes('api') || problemLower.includes('backend')) components.push('backend');
    if (problemLower.includes('database') || problemLower.includes('supabase')) components.push('database');
    if (problemLower.includes('browser') || problemLower.includes('chrome')) components.push('browser');
    if (problemLower.includes('server') || problemLower.includes('service')) components.push('server');
    
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
      case 'module_import_error':
        causes.push('Export name changed', 'Module structure changed', 'Version mismatch');
        break;
      case 'port_conflict':
        causes.push('Port already in use', 'Multiple instances', 'Service conflict');
        break;
      default:
        causes.push('Configuration error', 'Code error', 'Environment issue');
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
      case 'module_import_error':
        strategies.push('module_analysis', 'version_comparison', 'alternative_imports');
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

  private async createCoordinationPlan(analysis: ProblemAnalysis, problem: string, session: CoordinationSession): Promise<CoordinationPlan> {
    const planId = `plan-${Date.now()}`;
    
    // Create coordination context
    const context: CoordinationContext = {
      sessionId: session.id,
      sharedState: session.sharedState,
      dependencies: {
        onlineResearcher: this.onlineResearcher,
        supabase: this.supabase,
        session
      },
      resourceLimits: {
        maxConcurrentTasks: 20,
        taskTimeout: 300000, // 5 minutes
        memoryLimit: 1024 * 1024 * 100, // 100MB
        cpuLimit: 80 // 80% CPU
      },
      capabilities: [] // Will be populated during agent discovery
    };
    
    // Create strategies based on analysis
    const strategies = await this.createStrategies(analysis, []);
    
    const plan: CoordinationPlan = {
      id: planId,
      problem,
      severity: analysis.severity,
      assignedAgents: [], // Will be populated during agent discovery
      strategies,
      status: 'planning',
      startTime: Date.now(),
      results: [],
      context,
      tasks: []
    };
    
    // Add plan to session
    session.planIds.push(planId);
    
    this.activePlans.set(planId, plan);
    return plan;
  }

  private async discoverAndAssignAgents(plan: CoordinationPlan): Promise<void> {
    const requiredCapabilities = this.analyzeRequiredCapabilities(plan);
    
    // Find agents with required capabilities
    const availableAgents = await this.agentRegistry.findAgentsByCapabilities({
      requiredSkills: requiredCapabilities,
      minConfidence: 70
    });

    if (availableAgents.length === 0) {
      throw new Error('No agents available with required capabilities');
    }

    // Select optimal agent mix
    const selectedAgents = await this.selectOptimalAgentMix(availableAgents, plan);
    plan.assignedAgents = selectedAgents.map(agent => agent.id);
    
    // Update plan with actual agent capabilities
    plan.context.capabilities = selectedAgents.flatMap(agent => agent.capabilities);

    // Register agents for message broker
    for (const agent of selectedAgents) {
      await this.messageBroker.registerAgent(agent.id);
    }
  }

  private analyzeRequiredCapabilities(plan: CoordinationPlan): string[] {
    const capabilities = new Set<string>();
    
    // Add capabilities based on problem analysis
    const problemLower = plan.problem.toLowerCase();
    if (problemLower.includes('connection') || problemLower.includes('network')) {
      capabilities.add('browser');
      capabilities.add('monitoring');
      capabilities.add('networking');
    } else if (problemLower.includes('module') || problemLower.includes('import')) {
      capabilities.add('research');
      capabilities.add('testing');
      capabilities.add('debugging');
    } else if (problemLower.includes('performance')) {
      capabilities.add('monitoring');
      capabilities.add('performance_analysis');
      capabilities.add('optimization');
    } else {
      capabilities.add('browser');
      capabilities.add('testing');
      capabilities.add('research');
    }
    
    // Always need coordination capability
    capabilities.add('coordination');
    
    return Array.from(capabilities);
  }

  private async selectOptimalAgentMix(availableAgents: any[], plan: CoordinationPlan): Promise<any[]> {
    const requiredCount = this.calculateRequiredAgents(plan.severity, plan.problem);
    const selectedAgents: any[] = [];
    
    // Ensure we have diverse capabilities
    const capabilityGroups = new Map<string, any[]>();
    
    availableAgents.forEach(agent => {
      agent.capabilities.forEach((cap: any) => {
        if (!capabilityGroups.has(cap.type)) {
          capabilityGroups.set(cap.type, []);
        }
        capabilityGroups.get(cap.type)!.push(agent);
      });
    });
    
    // Select at least one agent from each capability group
    capabilityGroups.forEach((agents, capability) => {
      if (selectedAgents.length < requiredCount) {
        const bestAgent = agents.sort((a, b) => b.stats.successRate - a.stats.successRate)[0];
        if (!selectedAgents.includes(bestAgent)) {
          selectedAgents.push(bestAgent);
        }
      }
    });
    
    // Fill remaining slots with highest performing agents
    const remainingAgents = availableAgents
      .filter(agent => !selectedAgents.includes(agent))
      .sort((a, b) => b.stats.successRate - a.stats.successRate);
    
    while (selectedAgents.length < requiredCount && remainingAgents.length > 0) {
      selectedAgents.push(remainingAgents.shift()!);
    }
    
    return selectedAgents.slice(0, requiredCount);
  }

  private calculateRequiredAgents(severity: string, problemType: string): number {
    let baseAgents = 3; // Minimum team size
    
    switch (severity) {
      case 'critical': baseAgents = 8; break;
      case 'high': baseAgents = 6; break;
      case 'medium': baseAgents = 4; break;
      case 'low': baseAgents = 2; break;
    }
    
    // Adjust based on problem complexity
    const problemLower = problemType.toLowerCase();
    if (problemLower.includes('connection') || problemLower.includes('port')) {
      baseAgents += 2; // Need more agents for system-level issues
    }
    
    return Math.min(baseAgents, 20); // Cap at 20 agents
  }

  private async setupAgentCommunication(plan: CoordinationPlan, session: CoordinationSession): Promise<void> {
    // Add agents to session
    plan.assignedAgents.forEach(agentId => {
      session.participants.push(agentId);
    });
    
    // Add agents to broadcast group
    const groupId = `session-${session.id}`;
    for (const agentId of plan.assignedAgents) {
      await this.messageBroker.addToBroadcastGroup(groupId, agentId);
    }
    
    // Send initial coordination message
    await this.messageBroker.sendMessage({
      sessionId: session.id,
      fromAgent: 'coordinator',
      type: 'coordination',
      content: {
        action: 'session_started',
        plan: {
          id: plan.id,
          problem: plan.problem,
          severity: plan.severity,
          strategies: plan.strategies.map(s => ({ id: s.id, name: s.name, description: s.description }))
        },
        participants: plan.assignedAgents,
        sharedState: session.sharedState
      },
      priority: 'high'
    });
  }

  private async executeCoordinatedPlan(plan: CoordinationPlan): Promise<void> {
    logger.info(`🚀 Executing enhanced coordinated plan: ${plan.id}`);
    plan.status = 'executing';
    
    try {
      // Create tasks from strategy steps
      const strategy = plan.strategies[0]; // Start with primary strategy
      const tasks = await this.createTasksFromStrategy(strategy, plan);
      plan.tasks = tasks;
      
      // Start task execution with coordination
      await this.executeTasksWithCoordination(tasks, plan);
      
      plan.status = 'completed';
      plan.endTime = Date.now();
      logger.info(`🎯 Enhanced plan completed successfully: ${plan.id}`);
      
    } catch (error) {
      plan.status = 'failed';
      plan.endTime = Date.now();
      logger.error(`❌ Enhanced plan failed: ${plan.id}`, error);
      
      // Try backup strategy if available
      if (plan.strategies.length > 1) {
        logger.info(`🔄 Attempting backup strategy`);
        await this.executeBackupStrategy(plan);
      } else {
        throw error;
      }
    }
  }

  private async createTasksFromStrategy(strategy: CoordinationStrategy, plan: CoordinationPlan): Promise<Task[]> {
    const tasks: Task[] = [];
    
    for (const step of strategy.steps) {
      const task = await this.taskManager.createTask({
        planId: plan.id,
        type: this.mapStepToTaskType(step),
        description: step.description,
        assignedAgent: step.assignedAgents[0] || plan.assignedAgents[0],
        dependencies: step.dependencies,
        priority: this.mapSeverityToPriority(plan.severity),
        timeout: step.timeout,
        input: {
          step,
          plan,
          context: plan.context
        }
      });
      
      tasks.push(task);
    }
    
    return tasks;
  }

  private mapStepToTaskType(step: CoordinationStep): Task['type'] {
    const description = step.description.toLowerCase();
    
    if (description.includes('research') || description.includes('analyze')) {
      return 'research';
    } else if (description.includes('test') || description.includes('verify')) {
      return 'test';
    } else if (description.includes('monitor') || description.includes('check')) {
      return 'monitor';
    } else if (description.includes('coordinate') || description.includes('manage')) {
      return 'coordinate';
    } else {
      return 'execute';
    }
  }

  private mapSeverityToPriority(severity: string): Task['priority'] {
    switch (severity) {
      case 'critical': return 'critical';
      case 'high': return 'high';
      case 'medium': return 'medium';
      case 'low': return 'low';
      default: return 'medium';
    }
  }

  private async executeTasksWithCoordination(tasks: Task[], plan: CoordinationPlan): Promise<void> {
    logger.info(`🎯 Executing ${tasks.length} tasks with enhanced coordination`);
    
    // Set up task execution listeners
    this.taskManager.on('task_execution_requested', async (event) => {
      if (event.task.planId === plan.id) {
        await this.handleTaskExecutionRequest(event, plan);
      }
    });
    
    // Monitor task progress
    const progressMonitor = setInterval(async () => {
      const planTasks = await this.taskManager.getTasksByPlan(plan.id);
      const completed = planTasks.filter(t => t.status === 'completed').length;
      const total = planTasks.length;
      
      logger.info(`📊 Enhanced plan ${plan.id} progress: ${completed}/${total} tasks completed`);
      
      // Send progress update to agents
      await this.messageBroker.sendMessage({
        sessionId: plan.context.sessionId,
        fromAgent: 'coordinator',
        type: 'status',
        content: {
          action: 'progress_update',
          planId: plan.id,
          progress: { completed, total, percentage: Math.round((completed / total) * 100) }
        },
        priority: 'medium'
      });
      
      // Check if all tasks are complete
      if (completed === total) {
        clearInterval(progressMonitor);
      }
    }, 5000); // Update every 5 seconds
    
    // Wait for all tasks to complete
    await this.waitForTasksCompletion(tasks);
  }

  private async handleTaskExecutionRequest(event: any, plan: CoordinationPlan): Promise<void> {
    const { task, agentId } = event;
    
    logger.info(`🎯 Delegating task ${task.id} to agent ${agentId}`);
    
    // Send task to agent
    await this.messageBroker.sendMessage({
      sessionId: plan.context.sessionId,
      fromAgent: 'coordinator',
      toAgent: agentId,
      type: 'task',
      content: {
        action: 'execute_task',
        task,
        context: plan.context,
        instructions: this.generateTaskInstructions(task, plan)
      },
      priority: task.priority
    });
  }

  private generateTaskInstructions(task: Task, plan: CoordinationPlan): string {
    let instructions = `Enhanced Task: ${task.description}\n\n`;
    
    instructions += `Context:\n`;
    instructions += `- Problem: ${plan.problem}\n`;
    instructions += `- Severity: ${plan.severity}\n`;
    instructions += `- Plan ID: ${plan.id}\n`;
    instructions += `- Task Type: ${task.type}\n\n`;
    
    instructions += `Objectives:\n`;
    if (task.input?.step?.expectedResults) {
      task.input.step.expectedResults.forEach((result: any, index: number) => {
        instructions += `${index + 1}. ${result}\n`;
      });
    }
    
    instructions += `\nEnhanced Coordination Notes:\n`;
    instructions += `- You are part of a coordinated team effort with advanced communication\n`;
    instructions += `- Share important findings via status messages\n`;
    instructions += `- Report progress and any issues immediately\n`;
    instructions += `- Collaborate with other agents when needed\n`;
    instructions += `- Use online research capabilities when local knowledge is insufficient\n`;
    
    return instructions;
  }

  private async waitForTasksCompletion(tasks: Task[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkCompletion = async () => {
        const currentTasks = await Promise.all(
          tasks.map(task => this.taskManager.getTask(task.id))
        );
        
        const completedTasks = currentTasks.filter(t => t?.status === 'completed');
        const failedTasks = currentTasks.filter(t => t?.status === 'failed');
        
        if (completedTasks.length === tasks.length) {
          resolve();
        } else if (failedTasks.length > 0) {
          const errors = failedTasks.map(t => t?.error).filter(Boolean);
          reject(new Error(`Tasks failed: ${errors.join(', ')}`));
        } else {
          // Check again in 1 second
          setTimeout(checkCompletion, 1000);
        }
      };
      
      checkCompletion();
    });
  }

  private async executeBackupStrategy(plan: CoordinationPlan): Promise<void> {
    logger.info(`🔄 Executing backup strategy for plan: ${plan.id}`);
    
    const backupStrategy = plan.strategies[1];
    if (!backupStrategy) {
      throw new Error('No backup strategy available');
    }
    
    try {
      // Reset plan status
      plan.status = 'executing';
      
      // Create tasks from backup strategy
      const backupTasks = await this.createTasksFromStrategy(backupStrategy, plan);
      plan.tasks = [...plan.tasks, ...backupTasks];
      
      // Execute backup tasks
      await this.executeTasksWithCoordination(backupTasks, plan);
      
      plan.status = 'completed';
      plan.endTime = Date.now();
      logger.info(`🎯 Backup strategy completed successfully: ${plan.id}`);
      
    } catch (error) {
      plan.status = 'failed';
      plan.endTime = Date.now();
      logger.error(`❌ Backup strategy failed: ${plan.id}`, error);
      throw error;
    }
  }

  private async createStrategies(analysis: ProblemAnalysis, assignedAgents: string[]): Promise<CoordinationStrategy[]> {
    const strategies: CoordinationStrategy[] = [];
    
    // Create primary strategy based on problem type
    const primaryStrategy = await this.createPrimaryStrategy(analysis, assignedAgents);
    strategies.push(primaryStrategy);
    
    // Create backup strategy
    const backupStrategy = await this.createBackupStrategy(analysis, assignedAgents);
    strategies.push(backupStrategy);
    
    return strategies;
  }

  private async createPrimaryStrategy(analysis: ProblemAnalysis, assignedAgents: string[]): Promise<CoordinationStrategy> {
    const strategy: CoordinationStrategy = {
      id: `primary-${Date.now()}`,
      name: `Primary Fix Strategy for ${analysis.problemType}`,
      description: `Enhanced coordinated approach to fix ${analysis.problemType}`,
      agentRoles: [],
      steps: [],
      priority: 1
    };
    
    // Create steps based on problem type
    strategy.steps = await this.createStepsForProblemType(analysis.problemType, []);
    
    return strategy;
  }

  private async createBackupStrategy(analysis: ProblemAnalysis, assignedAgents: string[]): Promise<CoordinationStrategy> {
    return {
      id: `backup-${Date.now()}`,
      name: `Backup Strategy - Enhanced Online Research`,
      description: `Fallback strategy using enhanced online research and coordination`,
      agentRoles: [],
      steps: [
        {
          id: 'research-online',
          description: 'Research solution online using multiple enhanced sources',
          assignedAgents: [],
          dependencies: [],
          timeout: 60000,
          expectedResults: ['Solution found', 'Multiple approaches identified']
        },
        {
          id: 'test-solutions',
          description: 'Test researched solutions with coordination',
          assignedAgents: [],
          dependencies: ['research-online'],
          timeout: 30000,
          expectedResults: ['Solution validated', 'Fix confirmed']
        }
      ],
      priority: 2
    };
  }

  private async createStepsForProblemType(problemType: string, agentRoles: AgentRole[]): Promise<CoordinationStep[]> {
    const steps: CoordinationStep[] = [];
    
    switch (problemType) {
      case 'connection_failure':
        steps.push(
          {
            id: 'diagnose-connection',
            description: 'Diagnose connection failure with enhanced monitoring',
            assignedAgents: [],
            dependencies: [],
            timeout: 30000,
            expectedResults: ['Connection status identified', 'Root cause found']
          },
          {
            id: 'check-services',
            description: 'Check if services are running with coordination',
            assignedAgents: [],
            dependencies: ['diagnose-connection'],
            timeout: 15000,
            expectedResults: ['Service status confirmed', 'Port availability checked']
          },
          {
            id: 'restart-services',
            description: 'Restart required services with coordination',
            assignedAgents: [],
            dependencies: ['check-services'],
            timeout: 45000,
            expectedResults: ['Services restarted', 'Connection restored']
          }
        );
        break;
      
      case 'module_import_error':
        steps.push(
          {
            id: 'analyze-imports',
            description: 'Analyze module import structure with enhanced tools',
            assignedAgents: [],
            dependencies: [],
            timeout: 20000,
            expectedResults: ['Import structure analyzed', 'Missing exports identified']
          },
          {
            id: 'find-alternatives',
            description: 'Find alternative import methods with coordination',
            assignedAgents: [],
            dependencies: ['analyze-imports'],
            timeout: 30000,
            expectedResults: ['Alternative imports found', 'Compatibility verified']
          },
          {
            id: 'apply-fix',
            description: 'Apply import fix with validation',
            assignedAgents: [],
            dependencies: ['find-alternatives'],
            timeout: 25000,
            expectedResults: ['Fix applied', 'Imports working']
          }
        );
        break;
      
      default:
        steps.push(
          {
            id: 'general-diagnosis',
            description: 'General problem diagnosis with enhanced coordination',
            assignedAgents: [],
            dependencies: [],
            timeout: 30000,
            expectedResults: ['Problem diagnosed', 'Solution strategy identified']
          },
          {
            id: 'implement-solution',
            description: 'Implement coordinated solution with validation',
            assignedAgents: [],
            dependencies: ['general-diagnosis'],
            timeout: 60000,
            expectedResults: ['Solution implemented', 'Problem resolved']
          }
        );
    }
    
    return steps;
  }

  private setupCommunicationChannels(): void {
    // Create enhanced communication channels
    this.communicationChannels.set('coordination', new EventEmitter());
    this.communicationChannels.set('research', new EventEmitter());
    this.communicationChannels.set('execution', new EventEmitter());
    this.communicationChannels.set('monitoring', new EventEmitter());
    this.communicationChannels.set('tasks', new EventEmitter());
    
    // Setup message broker event handlers
    this.messageBroker.on('message', (message) => {
      this.handleAgentMessage(message);
    });

    this.messageBroker.on('broadcast', (message) => {
      this.handleBroadcastMessage(message);
    });
  }

  private setupAgentCapabilities(): void {
    // Register agent capabilities with the enhanced registry
    this.agentPool.getAllAgents().then(agents => {
      agents.forEach(agent => {
        const capabilities = this.generateAgentCapabilities(agent);
        this.agentRegistry.registerAgent(agent.id, capabilities);
        this.capabilities.set(agent.id, capabilities);
      });
    });
  }

  private generateAgentCapabilities(agent: BrowserAgent): AgentCapability[] {
    const capabilities: AgentCapability[] = [];

    // Enhanced browser capability
    capabilities.push({
      id: `${agent.id}-browser`,
      name: 'Enhanced Browser Automation',
      description: `${agent.type} browser automation on ${agent.browser} with coordination`,
      type: 'browser',
      skills: ['navigation', 'interaction', 'screenshot', 'performance', 'coordination'],
      inputModes: ['url', 'selector', 'script', 'commands'],
      outputModes: ['data', 'screenshot', 'metrics', 'reports'],
      requirements: ['viewport', 'network', 'coordination_channel']
    });

    // Enhanced testing capability
    capabilities.push({
      id: `${agent.id}-testing`,
      name: 'Coordinated UI Testing',
      description: 'Automated UI testing with coordination and validation',
      type: 'testing',
      skills: ['functional_testing', 'regression_testing', 'visual_testing', 'coordination'],
      inputModes: ['test_spec', 'selectors', 'coordination_messages'],
      outputModes: ['test_results', 'screenshots', 'coordination_updates'],
      requirements: ['stable_ui', 'test_data', 'coordination_channel']
    });

    // Enhanced monitoring capability
    capabilities.push({
      id: `${agent.id}-monitoring`,
      name: 'Coordinated System Monitoring',
      description: 'Real-time system monitoring with coordination and alerting',
      type: 'monitoring',
      skills: ['health_check', 'performance_monitoring', 'error_detection', 'coordination'],
      inputModes: ['urls', 'metrics', 'coordination_signals'],
      outputModes: ['alerts', 'reports', 'coordination_updates'],
      requirements: ['network_access', 'coordination_channel']
    });

    return capabilities;
  }

  private setupEventHandlers(): void {
    // Handle task lifecycle events
    this.taskManager.on('task_created', (task) => {
      logger.info(`📋 Enhanced task created: ${task.id}`);
      this.emit('task_created', task);
    });

    this.taskManager.on('task_completed', (task) => {
      logger.info(`✅ Enhanced task completed: ${task.id}`);
      this.emit('task_completed', task);
      this.updatePlanProgress(task.planId);
    });

    this.taskManager.on('task_failed', (task) => {
      logger.error(`❌ Enhanced task failed: ${task.id}`);
      this.emit('task_failed', task);
      this.handleTaskFailure(task);
    });
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
      case 'error':
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
    if (message.content.stateUpdate) {
      Object.assign(session.sharedState, message.content.stateUpdate);
    }

    // Handle agent requests
    if (message.content.request) {
      await this.handleAgentRequest(message.content.request, message.fromAgent, session);
    }
  }

  private async handleTaskMessage(message: Message): Promise<void> {
    logger.info(`📋 Handling task message from ${message.fromAgent}`);
    
    if (message.content.taskId) {
      const task = await this.taskManager.getTask(message.content.taskId);
      if (task) {
        await this.taskManager.updateTask(task.id, {
          status: message.content.status,
          output: message.content.output,
          error: message.content.error
        });
      }
    }
  }

  private async handleStatusMessage(message: Message): Promise<void> {
    logger.info(`📊 Status update from ${message.fromAgent}: ${message.content.status}`);
    
    // Update agent status in registry
    await this.agentRegistry.updateAgentStatus(message.fromAgent, message.content.status);
  }

  private async handleErrorMessage(message: Message): Promise<void> {
    logger.error(`❌ Error from ${message.fromAgent}: ${message.content.error}`);
    
    // Trigger error recovery if needed
    if (message.content.severity === 'critical') {
      await this.initiateErrorRecovery(message.fromAgent, message.content.error);
    }
  }

  private async handleArtifactMessage(message: Message): Promise<void> {
    logger.info(`📄 Artifact from ${message.fromAgent}: ${message.content.artifact.type}`);
    
    // Store artifact in session
    const session = this.sessions.get(message.sessionId);
    if (session) {
      if (!session.sharedState.artifacts) {
        session.sharedState.artifacts = [];
      }
      session.sharedState.artifacts.push(message.content.artifact);
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
            ...message,
            toAgent: agentId
          });
        }
      }
    }
  }

  private async handleAgentRequest(request: any, fromAgent: string, session: CoordinationSession): Promise<void> {
    switch (request.type) {
      case 'capability_discovery':
        await this.handleCapabilityDiscovery(request, fromAgent, session);
        break;
      case 'task_delegation':
        await this.handleTaskDelegation(request, fromAgent, session);
        break;
      case 'resource_request':
        await this.handleResourceRequest(request, fromAgent, session);
        break;
      case 'coordination_request':
        await this.handleCoordinationRequest(request, fromAgent, session);
        break;
    }
  }

  private async handleCapabilityDiscovery(request: any, fromAgent: string, session: CoordinationSession): Promise<void> {
    const requiredCapabilities = request.capabilities;
    const availableAgents = await this.agentRegistry.findAgentsByCapabilities({ requiredSkills: requiredCapabilities });
    
    await this.messageBroker.sendMessage({
      sessionId: session.id,
      fromAgent: 'coordinator',
      toAgent: fromAgent,
      type: 'coordination',
      content: {
        response: 'capability_discovery',
        availableAgents
      },
      priority: 'medium'
    });
  }

  private async handleTaskDelegation(request: any, fromAgent: string, session: CoordinationSession): Promise<void> {
    const task = await this.taskManager.createTask({
      planId: request.planId,
      type: request.taskType,
      description: request.description,
      assignedAgent: request.targetAgent,
      dependencies: request.dependencies || [],
      input: request.input
    });
    
    await this.messageBroker.sendMessage({
      sessionId: session.id,
      fromAgent: 'coordinator',
      toAgent: request.targetAgent,
      type: 'task',
      content: {
        task,
        delegatedBy: fromAgent
      },
      priority: 'medium'
    });
  }

  private async handleResourceRequest(request: any, fromAgent: string, session: CoordinationSession): Promise<void> {
    // Handle resource requests (placeholder)
    logger.info(`🎯 Resource request from ${fromAgent}: ${request.resourceType}`);
  }

  private async handleCoordinationRequest(request: any, fromAgent: string, session: CoordinationSession): Promise<void> {
    // Handle coordination requests (placeholder)
    logger.info(`🎯 Coordination request from ${fromAgent}: ${request.requestType}`);
  }

  private async updatePlanProgress(planId: string): Promise<void> {
    const plan = this.activePlans.get(planId);
    if (!plan) return;

    const tasks = await this.taskManager.getTasksByPlan(planId);
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const failedTasks = tasks.filter(t => t.status === 'failed');

    if (completedTasks.length === tasks.length) {
      plan.status = 'completed';
      plan.endTime = Date.now();
      logger.info(`🎯 Enhanced plan completed: ${planId}`);
    } else if (failedTasks.length > 0 && failedTasks.length + completedTasks.length === tasks.length) {
      plan.status = 'failed';
      plan.endTime = Date.now();
      logger.error(`❌ Enhanced plan failed: ${planId}`);
    }
  }

  private async handleTaskFailure(task: Task): Promise<void> {
    logger.warn(`🔄 Handling task failure: ${task.id}`);
    
    // Try to find alternative agent
    const plan = this.activePlans.get(task.planId);
    if (plan) {
      const requiredCapabilities = this.inferRequiredCapabilities(task);
      const alternativeAgents = await this.agentRegistry.findAgentsByCapabilities({ requiredSkills: requiredCapabilities });
      
      if (alternativeAgents.length > 0) {
        const newTask = await this.taskManager.createTask({
          planId: task.planId,
          type: task.type,
          description: task.description,
          assignedAgent: alternativeAgents[0].id,
          dependencies: task.dependencies,
          input: task.input
        });
        logger.info(`🔄 Task reassigned to ${alternativeAgents[0].id}`);
      }
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

  private async initiateErrorRecovery(agentId: string, error: string): Promise<void> {
    logger.warn(`🚨 Initiating error recovery for agent ${agentId}: ${error}`);
    
    // Implementation depends on error type and severity
    // This is a placeholder for error recovery logic
  }

  // Public methods for external coordination
  async getActivePlans(): Promise<CoordinationPlan[]> {
    return Array.from(this.activePlans.values());
  }

  async getPlanStatus(planId: string): Promise<CoordinationPlan | null> {
    return this.activePlans.get(planId) || null;
  }

  async getCoordinationStats(): Promise<{
    totalPlans: number;
    activePlans: number;
    completedPlans: number;
    failedPlans: number;
    totalAgents: number;
    activeAgents: number;
    totalTasks: number;
    completedTasks: number;
    averagePlanDuration: number;
    successRate: number;
  }> {
    const plans = Array.from(this.activePlans.values());
    const agentStats = await this.agentRegistry.getRegistryStats();
    const taskStats = await this.taskManager.getTaskStats();
    
    const completedPlans = plans.filter(p => p.status === 'completed');
    const failedPlans = plans.filter(p => p.status === 'failed');
    
    const totalDuration = completedPlans.reduce((sum, plan) => {
      return sum + (plan.endTime ? plan.endTime - plan.startTime : 0);
    }, 0);
    
    const averagePlanDuration = completedPlans.length > 0 ? totalDuration / completedPlans.length : 0;
    const successRate = plans.length > 0 ? (completedPlans.length / plans.length) * 100 : 0;
    
    return {
      totalPlans: plans.length,
      activePlans: plans.filter(p => p.status === 'executing').length,
      completedPlans: completedPlans.length,
      failedPlans: failedPlans.length,
      totalAgents: agentStats.totalAgents,
      activeAgents: agentStats.byStatus.idle + agentStats.byStatus.busy,
      totalTasks: taskStats.total,
      completedTasks: taskStats.byStatus.completed,
      averagePlanDuration,
      successRate
    };
  }

  async cleanup(): Promise<void> {
    logger.info('🧹 Cleaning up Enhanced Agent Coordinator...');
    
    // Clean up old sessions and plans
    const cutoff = Date.now() - 3600000; // 1 hour
    
    // Clean up old sessions
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.lastActivity < cutoff) {
        this.sessions.delete(sessionId);
        logger.info(`🧹 Cleaned up old session: ${sessionId}`);
      }
    }
    
    // Clean up completed/failed plans
    for (const [planId, plan] of this.activePlans.entries()) {
      if ((plan.status === 'completed' || plan.status === 'failed') && 
          plan.endTime && plan.endTime < cutoff) {
        this.activePlans.delete(planId);
        logger.info(`🧹 Cleaned up old plan: ${planId}`);
      }
    }
    
    // Clean up registries
    await this.agentRegistry.cleanup();
    await this.taskManager.cleanup();
  }

  async shutdown(): Promise<void> {
    logger.info('🔥 Shutting down Enhanced Agent Coordinator...');
    
    // Cancel all active plans
    const activePlans = Array.from(this.activePlans.keys());
    for (const planId of activePlans) {
      await this.cancelPlan(planId);
    }
    
    // Shutdown components
    await this.taskManager.shutdown();
    await this.messageBroker.shutdown();
    
    // Clear all data
    this.activePlans.clear();
    this.sessions.clear();
    this.agentAssignments.clear();
    this.communicationChannels.clear();
    this.globalState.clear();
    this.capabilities.clear();
    
    logger.info('🔥 Enhanced Agent Coordinator shutdown complete');
  }

  async cancelPlan(planId: string): Promise<boolean> {
    const plan = this.activePlans.get(planId);
    if (!plan) return false;
    
    logger.info(`🚫 Cancelling enhanced plan: ${planId}`);
    
    // Cancel all tasks for this plan
    const planTasks = await this.taskManager.getTasksByPlan(planId);
    for (const task of planTasks) {
      if (task.status === 'pending' || task.status === 'running') {
        await this.taskManager.cancelTask(task.id);
      }
    }
    
    // Send cancellation message to agents
    await this.messageBroker.sendMessage({
      sessionId: plan.context.sessionId,
      fromAgent: 'coordinator',
      type: 'coordination',
      content: {
        action: 'plan_cancelled',
        planId: plan.id,
        reason: 'Plan cancelled by enhanced coordinator'
      },
      priority: 'high'
    });
    
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
    logger.info(`🚫 Enhanced plan cancelled: ${planId}`);
    
    return true;
  }
}