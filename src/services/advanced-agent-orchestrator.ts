import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';
import { llmRouter } from './llm-router-rust';
import { redisService } from './redis-service-rust';
import { ParameterAnalytics } from './parameter-analytics-rust';
import { supabase } from '../config/supabase';

export interface AgentTask {
  id: string;
  type: 'analysis' | 'synthesis' | 'execution' | 'validation' | 'planning';
  priority: number;
  complexity: 'low' | 'medium' | 'high' | 'expert';
  context: Record<string, any>;
  dependencies: string[];
  estimatedDuration: number;
  maxRetries: number;
  deadline?: Date;
  requiredCapabilities: string[];
}

export interface AgentExecution {
  taskId: string;
  agentId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  result?: any;
  error?: string;
  confidence: number;
  performance: {
    latency: number;
    accuracy: number;
    resourceUsage: number;
  };
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  steps: AgentTask[];
  parallelism: 'sequential' | 'parallel' | 'hybrid';
  failureStrategy: 'abort' | 'continue' | 'retry' | 'fallback';
  successCriteria: {
    minConfidence: number;
    requiredSteps: string[];
    timeoutMs: number;
  };
}

interface AgentPerformanceProfile {
  agentId: string;
  capabilities: string[];
  averageLatency: number;
  accuracy: number;
  successRate: number;
  specializations: string[];
  lastUpdated: Date;
  performanceHistory: Array<{
    taskType: string;
    latency: number;
    accuracy: number;
    timestamp: Date;
  }>;
}

interface OrchestrationContext {
  sessionId: string;
  userId: string;
  workflowId: string;
  sharedMemory: Map<string, any>;
  globalContext: Record<string, any>;
  executionGraph: Map<string, string[]>;
  results: Map<string, any>;
}

export class AdvancedAgentOrchestrator extends EventEmitter {
  private activeExecutions = new Map<string, AgentExecution>();
  private agentPerformance = new Map<string, AgentPerformanceProfile>();
  private workflowTemplates = new Map<string, WorkflowTemplate>();
  private orchestrationContexts = new Map<string, OrchestrationContext>();
  private paramAnalytics: ParameterAnalytics;
  private isInitialized = false;

  constructor() {
    super();
    this.paramAnalytics = new ParameterAnalytics();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.paramAnalytics.initialize();
      await this.loadWorkflowTemplates();
      await this.loadAgentPerformanceProfiles();
      await this.initializeDefaultTemplates();
      
      this.isInitialized = true;
      Logger.info('Advanced Agent Orchestrator initialized');
    } catch (error) {
      Logger.error('Failed to initialize Advanced Agent Orchestrator:', error);
      throw error;
    }
  }

  /**
   * Execute a complex multi-agent workflow
   */
  async executeWorkflow(
    workflowId: string,
    context: Record<string, any>,
    options: {
      sessionId?: string;
      userId?: string;
      parallelism?: 'sequential' | 'parallel' | 'hybrid';
      priority?: number;
    } = {}
  ): Promise<{
    executionId: string;
    results: Map<string, any>;
    performance: {
      totalTime: number;
      agentMetrics: Map<string, any>;
      efficiency: number;
    };
  }> {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const template = this.workflowTemplates.get(workflowId);

    if (!template) {
      throw new Error(`Workflow template not found: ${workflowId}`);
    }

    Logger.info(`Starting workflow execution: ${workflowId}`, { executionId });

    const orchestrationContext: OrchestrationContext = {
      sessionId: options.sessionId || executionId,
      userId: options.userId || 'anonymous',
      workflowId,
      sharedMemory: new Map(),
      globalContext: context,
      executionGraph: new Map(),
      results: new Map()
    };

    this.orchestrationContexts.set(executionId, orchestrationContext);

    const startTime = Date.now();

    try {
      // Analyze workflow and optimize execution plan
      const optimizedPlan = await this.optimizeExecutionPlan(template, context);
      
      // Execute based on parallelism strategy
      let results: Map<string, any>;
      switch (options.parallelism || template.parallelism) {
        case 'parallel':
          results = await this.executeParallel(executionId, optimizedPlan);
          break;
        case 'sequential':
          results = await this.executeSequential(executionId, optimizedPlan);
          break;
        case 'hybrid':
          results = await this.executeHybrid(executionId, optimizedPlan);
          break;
        default:
          throw new Error(`Unknown parallelism strategy: ${template.parallelism}`);
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Calculate performance metrics
      const agentMetrics = this.calculateAgentMetrics(executionId);
      const efficiency = this.calculateExecutionEfficiency(executionId, totalTime);

      // Update agent performance profiles
      await this.updateAgentPerformanceProfiles(executionId);

      // Store execution results
      await this.storeExecutionResults(executionId, results, {
        totalTime,
        agentMetrics,
        efficiency
      });

      Logger.info(`Workflow execution completed: ${workflowId}`, {
        executionId,
        totalTime,
        efficiency,
        resultCount: results.size
      });

      return {
        executionId,
        results,
        performance: {
          totalTime,
          agentMetrics,
          efficiency
        }
      };

    } catch (error) {
      Logger.error(`Workflow execution failed: ${workflowId}`, error);
      await this.handleExecutionFailure(executionId, error as Error);
      throw error;
    } finally {
      this.orchestrationContexts.delete(executionId);
    }
  }

  /**
   * Dynamically spawn agents based on task complexity
   */
  async spawnAgent(
    taskType: string,
    context: Record<string, any>,
    requirements: {
      capabilities: string[];
      complexity: 'low' | 'medium' | 'high' | 'expert';
      maxLatency?: number;
      minConfidence?: number;
    }
  ): Promise<string> {
    const agentId = `agent_${taskType}_${Date.now()}`;
    
    // Select optimal model tier based on complexity
    const modelTier = this.selectModelTier(requirements.complexity);
    
    // Get optimized parameters for this task type
    const optimalParams = await this.paramAnalytics.optimize({
      model: modelTier,
      taskType,
      constraints: {
        maxLatency: requirements.maxLatency || 5000,
        minAccuracy: requirements.minConfidence || 0.8
      }
    });

    // Create specialized system prompt
    const systemPrompt = await this.generateAgentSystemPrompt(
      taskType,
      requirements.capabilities,
      context
    );

    // Register agent with performance tracking
    this.registerAgent(agentId, {
      taskType,
      capabilities: requirements.capabilities,
      complexity: requirements.complexity,
      modelTier,
      parameters: optimalParams
    });

    Logger.info(`Spawned specialized agent: ${agentId}`, {
      taskType,
      complexity: requirements.complexity,
      modelTier
    });

    return agentId;
  }

  /**
   * Create workflow template from task pattern
   */
  async createWorkflowTemplate(
    name: string,
    description: string,
    tasks: Partial<AgentTask>[],
    options: {
      parallelism?: 'sequential' | 'parallel' | 'hybrid';
      failureStrategy?: 'abort' | 'continue' | 'retry' | 'fallback';
      successCriteria?: {
        minConfidence: number;
        requiredSteps: string[];
        timeoutMs: number;
      };
    } = {}
  ): Promise<string> {
    const templateId = `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Convert partial tasks to full tasks with defaults
    const completeTasks: AgentTask[] = tasks.map((task, index) => ({
      id: task.id || `task_${index}`,
      type: task.type || 'analysis',
      priority: task.priority || 1,
      complexity: task.complexity || 'medium',
      context: task.context || {},
      dependencies: task.dependencies || [],
      estimatedDuration: task.estimatedDuration || 5000,
      maxRetries: task.maxRetries || 3,
      deadline: task.deadline,
      requiredCapabilities: task.requiredCapabilities || []
    }));

    // Analyze task dependencies and optimize order
    const optimizedTasks = this.optimizeTaskOrder(completeTasks);

    const template: WorkflowTemplate = {
      id: templateId,
      name,
      description,
      steps: optimizedTasks,
      parallelism: options.parallelism || 'hybrid',
      failureStrategy: options.failureStrategy || 'retry',
      successCriteria: options.successCriteria || {
        minConfidence: 0.8,
        requiredSteps: completeTasks.map(t => t.id),
        timeoutMs: 300000
      }
    };

    this.workflowTemplates.set(templateId, template);
    await this.saveWorkflowTemplate(template);

    Logger.info(`Created workflow template: ${name}`, { templateId });

    return templateId;
  }

  /**
   * Get agent performance analytics
   */
  async getAgentAnalytics(agentId?: string): Promise<{
    overall: {
      totalExecutions: number;
      averageLatency: number;
      successRate: number;
      topPerformers: string[];
    };
    agents: AgentPerformanceProfile[];
    trends: {
      latencyTrend: Array<{ date: string; value: number }>;
      accuracyTrend: Array<{ date: string; value: number }>;
    };
  }> {
    const agents = agentId 
      ? [this.agentPerformance.get(agentId)].filter(Boolean) as AgentPerformanceProfile[]
      : Array.from(this.agentPerformance.values());

    const overall = {
      totalExecutions: agents.reduce((sum, agent) => sum + agent.performanceHistory.length, 0),
      averageLatency: agents.reduce((sum, agent) => sum + agent.averageLatency, 0) / agents.length || 0,
      successRate: agents.reduce((sum, agent) => sum + agent.successRate, 0) / agents.length || 0,
      topPerformers: agents
        .sort((a, b) => b.successRate - a.successRate)
        .slice(0, 5)
        .map(agent => agent.agentId)
    };

    const trends = this.calculatePerformanceTrends(agents);

    return { overall, agents, trends };
  }

  private async optimizeExecutionPlan(
    template: WorkflowTemplate,
    context: Record<string, any>
  ): Promise<AgentTask[]> {
    // Analyze task complexity and resource requirements
    const optimizedTasks = [...template.steps];

    // Sort by priority and dependencies
    optimizedTasks.sort((a, b) => {
      if (a.dependencies.includes(b.id)) return 1;
      if (b.dependencies.includes(a.id)) return -1;
      return b.priority - a.priority;
    });

    // Adjust complexity based on context
    for (const task of optimizedTasks) {
      if (context.complexity === 'auto') {
        task.complexity = this.estimateTaskComplexity(task, context);
      }
    }

    return optimizedTasks;
  }

  private async executeParallel(
    executionId: string,
    tasks: AgentTask[]
  ): Promise<Map<string, any>> {
    const results = new Map<string, any>();
    const promises = tasks.map(task => this.executeTask(executionId, task));

    const taskResults = await Promise.allSettled(promises);

    taskResults.forEach((result, index) => {
      const task = tasks[index];
      if (result.status === 'fulfilled') {
        results.set(task.id, result.value);
      } else {
        Logger.error(`Task failed: ${task.id}`, result.reason);
        results.set(task.id, { error: result.reason });
      }
    });

    return results;
  }

  private async executeSequential(
    executionId: string,
    tasks: AgentTask[]
  ): Promise<Map<string, any>> {
    const results = new Map<string, any>();
    const context = this.orchestrationContexts.get(executionId);

    for (const task of tasks) {
      try {
        // Check dependencies
        const dependenciesMet = task.dependencies.every(depId => 
          results.has(depId) && !results.get(depId)?.error
        );

        if (!dependenciesMet) {
          throw new Error(`Dependencies not met for task: ${task.id}`);
        }

        // Update task context with previous results
        const taskContext = {
          ...task.context,
          previousResults: Object.fromEntries(results),
          sharedMemory: context ? Object.fromEntries(context.sharedMemory) : {}
        };

        const result = await this.executeTask(executionId, {
          ...task,
          context: taskContext
        });

        results.set(task.id, result);

        // Update shared memory
        if (context && result.sharedData) {
          Object.entries(result.sharedData).forEach(([key, value]) => {
            context.sharedMemory.set(key, value);
          });
        }

      } catch (error) {
        Logger.error(`Sequential task failed: ${task.id}`, error);
        results.set(task.id, { error: (error as Error).message });
        
        // Handle failure based on strategy
        if (this.workflowTemplates.get(context?.workflowId || '')?.failureStrategy === 'abort') {
          throw error;
        }
      }
    }

    return results;
  }

  private async executeHybrid(
    executionId: string,
    tasks: AgentTask[]
  ): Promise<Map<string, any>> {
    const results = new Map<string, any>();
    const context = this.orchestrationContexts.get(executionId);
    const taskGroups = this.groupTasksByDependencies(tasks);

    for (const group of taskGroups) {
      if (group.length === 1) {
        // Execute single task
        const task = group[0];
        try {
          const result = await this.executeTask(executionId, task);
          results.set(task.id, result);
        } catch (error) {
          results.set(task.id, { error: (error as Error).message });
        }
      } else {
        // Execute group in parallel
        const promises = group.map(task => 
          this.executeTask(executionId, task).catch(error => ({ error: error.message }))
        );
        
        const groupResults = await Promise.all(promises);
        group.forEach((task, index) => {
          results.set(task.id, groupResults[index]);
        });
      }
    }

    return results;
  }

  private async executeTask(executionId: string, task: AgentTask): Promise<any> {
    const execution: AgentExecution = {
      taskId: task.id,
      agentId: `agent_${task.type}_${Date.now()}`,
      status: 'running',
      startTime: new Date(),
      confidence: 0,
      performance: {
        latency: 0,
        accuracy: 0,
        resourceUsage: 0
      }
    };

    this.activeExecutions.set(task.id, execution);
    this.emit('taskStarted', { executionId, task, execution });

    try {
      const startTime = Date.now();

      // Select optimal model for task
      const modelTier = this.selectModelTier(task.complexity);
      
      // Get optimized parameters
      const optimalParams = await this.paramAnalytics.optimize({
        model: modelTier,
        taskType: task.type,
        constraints: {
          maxLatency: task.estimatedDuration,
          minAccuracy: 0.8
        }
      });

      // Generate task-specific prompt
      const prompt = await this.generateTaskPrompt(task);

      // Execute via LLM router
      const response = await llmRouter.generateResponse(
        modelTier,
        [{ role: 'user', content: prompt }],
        optimalParams
      );

      const endTime = Date.now();
      const latency = endTime - startTime;

      // Parse and validate result
      const result = this.parseTaskResult(response.content, task);
      const confidence = this.calculateResultConfidence(result, task);

      execution.status = 'completed';
      execution.endTime = new Date();
      execution.result = result;
      execution.confidence = confidence;
      execution.performance = {
        latency,
        accuracy: confidence,
        resourceUsage: this.calculateResourceUsage(task, latency)
      };

      this.emit('taskCompleted', { executionId, task, execution });

      return result;

    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date();
      execution.error = (error as Error).message;

      this.emit('taskFailed', { executionId, task, execution, error });

      throw error;
    } finally {
      this.activeExecutions.delete(task.id);
    }
  }

  private selectModelTier(complexity: 'low' | 'medium' | 'high' | 'expert'): string {
    const tierMap = {
      'low': 'fast-response',
      'medium': 'assistant',
      'high': 'code-expert',
      'expert': 'expert-reasoning'
    };
    return tierMap[complexity];
  }

  private async generateAgentSystemPrompt(
    taskType: string,
    capabilities: string[],
    context: Record<string, any>
  ): Promise<string> {
    const basePrompts = {
      'analysis': 'You are an expert analyst focused on deep examination and insight extraction.',
      'synthesis': 'You are a synthesis specialist who combines information from multiple sources.',
      'execution': 'You are an execution agent focused on implementing solutions and taking action.',
      'validation': 'You are a validation expert who verifies correctness and quality.',
      'planning': 'You are a strategic planner who creates comprehensive action plans.'
    };

    const base = basePrompts[taskType as keyof typeof basePrompts] || basePrompts.analysis;
    const capabilitiesText = capabilities.length > 0 
      ? `\nYour specialized capabilities include: ${capabilities.join(', ')}.`
      : '';

    const contextText = Object.keys(context).length > 0
      ? `\nCurrent context: ${JSON.stringify(context, null, 2)}`
      : '';

    return `${base}${capabilitiesText}${contextText}

Always provide structured, actionable responses. Include confidence scores for your assessments.
Focus on accuracy and practical value in your outputs.`;
  }

  private async generateTaskPrompt(task: AgentTask): Promise<string> {
    const context = JSON.stringify(task.context, null, 2);
    
    return `Task: ${task.type.toUpperCase()}

Context:
${context}

Requirements:
- Priority: ${task.priority}
- Complexity: ${task.complexity}
- Required capabilities: ${task.requiredCapabilities.join(', ')}
- Estimated duration: ${task.estimatedDuration}ms

Please execute this task and provide a structured response with:
1. Main result/output
2. Confidence score (0-1)
3. Any shared data for other tasks
4. Next steps or recommendations

Response format should be JSON with these fields.`;
  }

  private parseTaskResult(content: string, task: AgentTask): any {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(content);
      return parsed;
    } catch {
      // If not JSON, create structured response
      return {
        content,
        type: task.type,
        confidence: 0.7,
        timestamp: new Date().toISOString()
      };
    }
  }

  private calculateResultConfidence(result: any, task: AgentTask): number {
    // Base confidence from result
    let confidence = result.confidence || 0.7;

    // Adjust based on task complexity
    const complexityMultiplier = {
      'low': 1.0,
      'medium': 0.9,
      'high': 0.8,
      'expert': 0.7
    }[task.complexity];

    confidence *= complexityMultiplier;

    // Adjust based on result completeness
    if (typeof result === 'object' && result !== null) {
      const fieldCount = Object.keys(result).length;
      confidence *= Math.min(1.0, fieldCount / 5); // Normalize to 5 expected fields
    }

    return Math.max(0, Math.min(1, confidence));
  }

  private calculateResourceUsage(task: AgentTask, latency: number): number {
    const baseUsage = {
      'low': 1,
      'medium': 2,
      'high': 4,
      'expert': 8
    }[task.complexity];

    // Factor in actual vs estimated time
    const timeRatio = latency / task.estimatedDuration;
    return baseUsage * Math.max(0.1, timeRatio);
  }

  private groupTasksByDependencies(tasks: AgentTask[]): AgentTask[][] {
    const groups: AgentTask[][] = [];
    const processed = new Set<string>();

    while (processed.size < tasks.length) {
      const currentGroup: AgentTask[] = [];
      
      for (const task of tasks) {
        if (processed.has(task.id)) continue;
        
        // Check if all dependencies are processed
        const dependenciesMet = task.dependencies.every(depId => processed.has(depId));
        
        if (dependenciesMet) {
          currentGroup.push(task);
          processed.add(task.id);
        }
      }
      
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      } else {
        // Break circular dependencies
        const remaining = tasks.filter(t => !processed.has(t.id));
        groups.push([remaining[0]]);
        processed.add(remaining[0].id);
      }
    }

    return groups;
  }

  private calculateAgentMetrics(executionId: string): Map<string, any> {
    const metrics = new Map<string, any>();
    // Implementation would collect metrics from active executions
    return metrics;
  }

  private calculateExecutionEfficiency(executionId: string, totalTime: number): number {
    // Calculate efficiency based on expected vs actual time
    return 0.85; // Placeholder
  }

  private estimateTaskComplexity(task: AgentTask, context: Record<string, any>): 'low' | 'medium' | 'high' | 'expert' {
    // Analyze context size, dependencies, and requirements
    const contextSize = JSON.stringify(context).length;
    const dependencyCount = task.dependencies.length;
    const capabilityCount = task.requiredCapabilities.length;

    const score = (contextSize / 1000) + (dependencyCount * 2) + capabilityCount;

    if (score < 2) return 'low';
    if (score < 5) return 'medium';
    if (score < 10) return 'high';
    return 'expert';
  }

  private optimizeTaskOrder(tasks: AgentTask[]): AgentTask[] {
    // Topological sort considering dependencies and priorities
    const sorted = [...tasks];
    
    sorted.sort((a, b) => {
      // Dependencies first
      if (a.dependencies.includes(b.id)) return 1;
      if (b.dependencies.includes(a.id)) return -1;
      
      // Then by priority
      return b.priority - a.priority;
    });

    return sorted;
  }

  private async loadWorkflowTemplates(): Promise<void> {
    try {
      const { data: templates, error } = await supabase
        .from('workflow_templates')
        .select('*');

      if (error) throw error;

      templates?.forEach(template => {
        this.workflowTemplates.set(template.id, template);
      });
    } catch (error) {
      Logger.warning('Failed to load workflow templates from database:', error);
    }
  }

  private async loadAgentPerformanceProfiles(): Promise<void> {
    try {
      const { data: profiles, error } = await supabase
        .from('agent_performance_profiles')
        .select('*');

      if (error) throw error;

      profiles?.forEach(profile => {
        this.agentPerformance.set(profile.agent_id, {
          agentId: profile.agent_id,
          capabilities: profile.capabilities,
          averageLatency: profile.average_latency,
          accuracy: profile.accuracy,
          successRate: profile.success_rate,
          specializations: profile.specializations,
          lastUpdated: new Date(profile.last_updated),
          performanceHistory: profile.performance_history || []
        });
      });
    } catch (error) {
      Logger.warning('Failed to load agent performance profiles:', error);
    }
  }

  private async initializeDefaultTemplates(): Promise<void> {
    // Create default workflow templates if none exist
    if (this.workflowTemplates.size === 0) {
      await this.createDefaultTemplates();
    }
  }

  private async createDefaultTemplates(): Promise<void> {
    // Complex Analysis Workflow
    await this.createWorkflowTemplate(
      'Complex Analysis',
      'Multi-step analysis with validation and synthesis',
      [
        {
          id: 'initial-analysis',
          type: 'analysis',
          complexity: 'high',
          priority: 1,
          requiredCapabilities: ['deep_reasoning', 'complex_analysis']
        },
        {
          id: 'validation',
          type: 'validation',
          complexity: 'medium',
          priority: 2,
          dependencies: ['initial-analysis'],
          requiredCapabilities: ['validation', 'quality_assessment']
        },
        {
          id: 'synthesis',
          type: 'synthesis',
          complexity: 'expert',
          priority: 3,
          dependencies: ['initial-analysis', 'validation'],
          requiredCapabilities: ['synthesis', 'insight_extraction']
        }
      ],
      {
        parallelism: 'hybrid',
        failureStrategy: 'retry',
        successCriteria: {
          minConfidence: 0.85,
          requiredSteps: ['initial-analysis', 'validation', 'synthesis'],
          timeoutMs: 300000
        }
      }
    );

    // Code Development Workflow
    await this.createWorkflowTemplate(
      'Code Development',
      'Complete code development with review and testing',
      [
        {
          id: 'planning',
          type: 'planning',
          complexity: 'medium',
          priority: 1,
          requiredCapabilities: ['planning', 'architecture']
        },
        {
          id: 'implementation',
          type: 'execution',
          complexity: 'high',
          priority: 2,
          dependencies: ['planning'],
          requiredCapabilities: ['code_generation', 'implementation']
        },
        {
          id: 'review',
          type: 'validation',
          complexity: 'medium',
          priority: 3,
          dependencies: ['implementation'],
          requiredCapabilities: ['code_review', 'quality_assessment']
        }
      ]
    );
  }

  private registerAgent(agentId: string, config: any): void {
    this.agentPerformance.set(agentId, {
      agentId,
      capabilities: config.capabilities || [],
      averageLatency: 0,
      accuracy: 0,
      successRate: 0,
      specializations: [config.taskType],
      lastUpdated: new Date(),
      performanceHistory: []
    });
  }

  private async updateAgentPerformanceProfiles(executionId: string): Promise<void> {
    // Implementation would update profiles based on execution results
  }

  private async storeExecutionResults(
    executionId: string,
    results: Map<string, any>,
    performance: any
  ): Promise<void> {
    try {
      await redisService.set(`execution:${executionId}`, {
        results: Object.fromEntries(results),
        performance,
        timestamp: new Date().toISOString()
      }, 3600); // Cache for 1 hour
    } catch (error) {
      Logger.error('Failed to store execution results:', error);
    }
  }

  private async handleExecutionFailure(executionId: string, error: Error): Promise<void> {
    Logger.error(`Execution ${executionId} failed:`, error);
    this.emit('executionFailed', { executionId, error });
  }

  private async saveWorkflowTemplate(template: WorkflowTemplate): Promise<void> {
    try {
      const { error } = await supabase
        .from('workflow_templates')
        .upsert({
          id: template.id,
          name: template.name,
          description: template.description,
          steps: template.steps,
          parallelism: template.parallelism,
          failure_strategy: template.failureStrategy,
          success_criteria: template.successCriteria,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
    } catch (error) {
      Logger.error('Failed to save workflow template:', error);
    }
  }

  private calculatePerformanceTrends(agents: AgentPerformanceProfile[]): any {
    // Calculate trends from performance history
    return {
      latencyTrend: [],
      accuracyTrend: []
    };
  }

  async shutdown(): Promise<void> {
    // Cancel active executions
    for (const [taskId, execution] of this.activeExecutions) {
      execution.status = 'cancelled';
      this.emit('taskCancelled', { taskId, execution });
    }

    this.activeExecutions.clear();
    this.orchestrationContexts.clear();

    Logger.info('Advanced Agent Orchestrator shut down');
  }
}

export const advancedAgentOrchestrator = new AdvancedAgentOrchestrator();