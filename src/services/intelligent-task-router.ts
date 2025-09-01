/**
 * Intelligent Task Router
 * Analyzes complex user requests and breaks them down into actionable tasks
 * Routes tasks to appropriate services and manages workflow execution
 */

import { LogContext, log } from '../utils/logger.js';
import { AutonomousMasterController } from './autonomous-master-controller.js';
import { ProjectCompletionService } from './project-completion-service.js';
import { homeAssistantService } from './home-assistant-service.js';
import { AgentRegistry } from '../agents/agent-registry.js';
import { intelligentParameterService } from './intelligent-parameter-service.js';

export interface TaskBreakdown {
  id: string;
  originalRequest: string;
  complexity: 'simple' | 'moderate' | 'complex' | 'multi_phase';
  estimatedTime: number; // in minutes
  tasks: TaskStep[];
  dependencies: TaskDependency[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  requiredResources: string[];
  successCriteria: string[];
}

export interface TaskStep {
  id: string;
  description: string;
  type: 'coding' | 'home_automation' | 'email' | 'research' | 'planning' | 'validation' | 'deployment';
  service: string;
  parameters: Record<string, any>;
  estimatedDuration: number;
  dependencies: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  result?: any;
  error?: string;
}

export interface TaskDependency {
  taskId: string;
  dependsOn: string[];
  type: 'sequential' | 'parallel' | 'conditional';
  condition?: string;
}

export interface WorkflowExecution {
  id: string;
  taskBreakdown: TaskBreakdown;
  status: 'planning' | 'executing' | 'completed' | 'failed' | 'paused';
  currentStep?: string;
  startTime: Date;
  endTime?: Date;
  results: Record<string, any>;
  logs: ExecutionLog[];
}

export interface ExecutionLog {
  timestamp: Date;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  taskId?: string;
  context?: Record<string, any>;
}

class IntelligentTaskRouter {
  private static instance: IntelligentTaskRouter;
  private projectCompletionService: ProjectCompletionService;
  private homeAssistantService: typeof homeAssistantService;
  private agentRegistry: AgentRegistry;
  private intelligentParams: typeof intelligentParameterService;
  
  private activeWorkflows: Map<string, WorkflowExecution> = new Map();
  private taskTemplates: Map<string, Partial<TaskBreakdown>> = new Map();

  private constructor() {
    this.projectCompletionService = ProjectCompletionService.getInstance();
    this.homeAssistantService = homeAssistantService;
    this.agentRegistry = new AgentRegistry();
    this.intelligentParams = intelligentParameterService;
    
    this.initializeTaskTemplates();
  }

  public static getInstance(): IntelligentTaskRouter {
    if (!IntelligentTaskRouter.instance) {
      IntelligentTaskRouter.instance = new IntelligentTaskRouter();
    }
    return IntelligentTaskRouter.instance;
  }

  /**
   * Initialize common task templates for faster routing
   */
  private initializeTaskTemplates(): void {
    // App Development Templates
    this.taskTemplates.set('web_app_creation', {
      complexity: 'complex',
      estimatedTime: 45,
      tasks: [
        {
          id: 'plan_architecture',
          description: 'Plan application architecture and tech stack',
          type: 'planning',
          service: 'enhanced-planner-agent',
          parameters: { scope: 'web_application', detail_level: 'high' },
          estimatedDuration: 5,
          dependencies: [],
          status: 'pending'
        },
        {
          id: 'setup_project',
          description: 'Initialize project structure and dependencies',
          type: 'coding',
          service: 'project-completion',
          parameters: { action: 'scaffold', framework: 'react' },
          estimatedDuration: 10,
          dependencies: ['plan_architecture'],
          status: 'pending'
        },
        {
          id: 'implement_core',
          description: 'Implement core application logic',
          type: 'coding',
          service: 'enhanced-code-assistant-agent',
          parameters: { complexity: 'moderate' },
          estimatedDuration: 20,
          dependencies: ['setup_project'],
          status: 'pending'
        },
        {
          id: 'add_styling',
          description: 'Add styling and responsive design',
          type: 'coding',
          service: 'enhanced-code-assistant-agent',
          parameters: { focus: 'ui_ux' },
          estimatedDuration: 8,
          dependencies: ['implement_core'],
          status: 'pending'
        },
        {
          id: 'test_application',
          description: 'Test application functionality',
          type: 'validation',
          service: 'enhanced-code-assistant-agent',
          parameters: { test_type: 'functional' },
          estimatedDuration: 5,
          dependencies: ['add_styling'],
          status: 'pending'
        }
      ],
      requiredResources: ['code_generation', 'file_system', 'package_manager'],
      successCriteria: ['application_runs', 'tests_pass', 'responsive_design']
    });

    // Home Automation Templates
    this.taskTemplates.set('smart_home_routine', {
      complexity: 'moderate',
      estimatedTime: 15,
      tasks: [
        {
          id: 'analyze_devices',
          description: 'Analyze available smart home devices',
          type: 'research',
          service: 'home-assistant',
          parameters: { action: 'device_discovery' },
          estimatedDuration: 3,
          dependencies: [],
          status: 'pending'
        },
        {
          id: 'create_automation',
          description: 'Create smart home automation',
          type: 'home_automation',
          service: 'home-assistant',
          parameters: { type: 'automation_creation' },
          estimatedDuration: 8,
          dependencies: ['analyze_devices'],
          status: 'pending'
        },
        {
          id: 'test_automation',
          description: 'Test automation functionality',
          type: 'validation',
          service: 'home-assistant',
          parameters: { action: 'test_automation' },
          estimatedDuration: 4,
          dependencies: ['create_automation'],
          status: 'pending'
        }
      ],
      requiredResources: ['home_assistant_api', 'device_control'],
      successCriteria: ['automation_created', 'devices_respond', 'routine_functional']
    });
  }

  /**
   * Analyze a user request and break it down into actionable tasks
   */
  async analyzeAndBreakdown(request: string, context?: Record<string, any>): Promise<TaskBreakdown> {
    log.info(`🧠 Analyzing request: "${request}"`, LogContext.SERVICE);

    try {
      // Step 1: Classify the request complexity and type
      const classification = await this.classifyRequest(request, context);
      
      // Step 2: Check for existing templates
      const template = this.findMatchingTemplate(classification);
      
      // Step 3: Generate custom breakdown if no template matches
      const breakdown = template 
        ? await this.adaptTemplate(template, request, classification)
        : await this.generateCustomBreakdown(request, classification, context);

      // Step 4: Optimize task order and dependencies
      await this.optimizeTaskFlow(breakdown);

      log.info(`✅ Generated ${breakdown.tasks.length} tasks for request`, LogContext.SERVICE);
      
      return breakdown;

    } catch (error) {
      log.error('❌ Error analyzing request:', LogContext.SERVICE, { error });
      throw error;
    }
  }

  /**
   * Execute a task breakdown as a workflow
   */
  async executeWorkflow(breakdown: TaskBreakdown): Promise<WorkflowExecution> {
    const workflowId = this.generateWorkflowId();
    
    const workflow: WorkflowExecution = {
      id: workflowId,
      taskBreakdown: breakdown,
      status: 'planning',
      startTime: new Date(),
      results: {},
      logs: []
    };

    this.activeWorkflows.set(workflowId, workflow);
    
    log.info(`🚀 Starting workflow execution: ${workflowId}`, LogContext.SERVICE);
    
    try {
      workflow.status = 'executing';
      await this.executeTasksInOrder(workflow);
      
      workflow.status = 'completed';
      workflow.endTime = new Date();
      
      log.info(`✅ Workflow completed successfully: ${workflowId}`, LogContext.SERVICE);
      
    } catch (error) {
      workflow.status = 'failed';
      workflow.endTime = new Date();
      
      workflow.logs.push({
        timestamp: new Date(),
        level: 'error',
        message: `Workflow failed: ${error instanceof Error ? error.message : String(error)}`,
        context: { error }
      });
      
      log.error(`❌ Workflow failed: ${workflowId}`, LogContext.SERVICE, { error });
    }
    
    return workflow;
  }

  /**
   * Classify request complexity and type
   */
  private async classifyRequest(request: string, context?: Record<string, any>): Promise<any> {
    // Use the enhanced planner agent to analyze the request
    const agent = await this.agentRegistry.getAgent('enhanced-planner-agent');
    
    if (!agent) {
      throw new Error('Enhanced planner agent not available');
    }
    
    const analysis = await (agent as any).process({
      input: `Analyze this request and classify its complexity, type, and requirements: "${request}"`,
      context: {
        analysis_type: 'task_breakdown',
        detail_level: 'high',
        focus: ['complexity', 'type', 'resources', 'time_estimate']
      }
    });

    return {
      complexity: this.extractComplexity(request),
      type: this.extractRequestType(request),
      keywords: this.extractKeywords(request),
      estimatedTime: this.estimateTimeRequirement(request),
      analysis: analysis.response
    };
  }

  /**
   * Find matching task template
   */
  private findMatchingTemplate(classification: any): Partial<TaskBreakdown> | null {
    const { type, keywords } = classification;
    
    // Web app creation
    if (keywords.some((k: any) => ['app', 'website', 'web', 'application'].includes(k.toLowerCase()))) {
      return this.taskTemplates.get('web_app_creation') || null;
    }
    
    // Home automation
    if (keywords.some((k: any) => ['light', 'home', 'automation', 'smart', 'scene'].includes(k.toLowerCase()))) {
      return this.taskTemplates.get('smart_home_routine') || null;
    }
    
    return null;
  }

  /**
   * Adapt existing template to specific request
   */
  private async adaptTemplate(
    template: Partial<TaskBreakdown>,
    request: string,
    classification: any
  ): Promise<TaskBreakdown> {
    const breakdown: TaskBreakdown = {
      id: this.generateTaskId(),
      originalRequest: request,
      complexity: template.complexity || classification.complexity,
      estimatedTime: template.estimatedTime || classification.estimatedTime,
      tasks: template.tasks?.map(task => ({ ...task, id: this.generateTaskId() })) || [],
      dependencies: [],
      priority: this.determinePriority(request),
      requiredResources: template.requiredResources || [],
      successCriteria: template.successCriteria || []
    };

    // Customize tasks based on specific request
    await this.customizeTasks(breakdown, request, classification);
    
    return breakdown;
  }

  /**
   * Generate custom task breakdown
   */
  private async generateCustomBreakdown(
    request: string,
    classification: any,
    context?: Record<string, any>
  ): Promise<TaskBreakdown> {
    
    const breakdown: TaskBreakdown = {
      id: this.generateTaskId(),
      originalRequest: request,
      complexity: classification.complexity,
      estimatedTime: classification.estimatedTime,
      tasks: [],
      dependencies: [],
      priority: this.determinePriority(request),
      requiredResources: [],
      successCriteria: []
    };

    // Generate tasks based on request type
    if (classification.type === 'coding') {
      breakdown.tasks = await this.generateCodingTasks(request, classification);
      breakdown.requiredResources = ['code_generation', 'file_system', 'testing'];
    } else if (classification.type === 'home_automation') {
      breakdown.tasks = await this.generateHomeAutomationTasks(request, classification);
      breakdown.requiredResources = ['home_assistant_api', 'device_control'];
    } else {
      // Generic task breakdown
      breakdown.tasks = await this.generateGenericTasks(request, classification);
      breakdown.requiredResources = ['general_processing'];
    }

    return breakdown;
  }

  /**
   * Execute tasks in the correct order respecting dependencies
   */
  private async executeTasksInOrder(workflow: WorkflowExecution): Promise<void> {
    const { taskBreakdown } = workflow;
    const completedTasks = new Set<string>();
    
    while (completedTasks.size < taskBreakdown.tasks.length) {
      const readyTasks = taskBreakdown.tasks.filter(task => 
        task.status === 'pending' && 
        task.dependencies.every(dep => completedTasks.has(dep))
      );
      
      if (readyTasks.length === 0) {
        throw new Error('Workflow deadlock: no tasks ready to execute');
      }
      
      // Execute ready tasks in parallel if possible
      const parallelTasks = readyTasks.slice(0, 3); // Limit parallelism
      
      await Promise.all(parallelTasks.map(async (task) => {
        try {
          workflow.currentStep = task.id;
          task.status = 'in_progress';
          
          workflow.logs.push({
            timestamp: new Date(),
            level: 'info',
            message: `Starting task: ${task.description}`,
            taskId: task.id
          });
          
          const result = await this.executeTask(task);
          task.result = result;
          task.status = 'completed';
          completedTasks.add(task.id);
          
          workflow.results[task.id] = result;
          
          workflow.logs.push({
            timestamp: new Date(),
            level: 'success',
            message: `Completed task: ${task.description}`,
            taskId: task.id,
            context: { result }
          });
          
        } catch (error) {
          task.status = 'failed';
          task.error = error instanceof Error ? error.message : String(error);
          
          workflow.logs.push({
            timestamp: new Date(),
            level: 'error',
            message: `Failed task: ${task.description} - ${error instanceof Error ? error.message : String(error)}`,
            taskId: task.id,
            context: { error }
          });
          
          // Check if this failure should stop the workflow
          if (this.isCriticalTask(task)) {
            throw new Error(`Critical task failed: ${task.description}`);
          }
        }
      }));
    }
  }

  /**
   * Execute a single task
   */
  private async executeTask(task: TaskStep): Promise<any> {
    const { service, parameters } = task;
    
    switch (service) {
      case 'project-completion':
        return await this.projectCompletionService.handleProjectCompletionRequest(
          task.description, 
          parameters
        );
        
      case 'home-assistant':
        if (parameters.action === 'device_discovery') {
          return await (this.homeAssistantService as any).getAvailableDevices();
        } else {
          // For now, create a basic toggle command - this should be enhanced with proper parsing
          const haCommand = {
            action: 'toggle' as const,
            entity: task.description.includes('light') ? 'light.main' : 'switch.main'
          };
          return await this.homeAssistantService.executeCommand(haCommand);
        }
        
      default:
        // Use agent registry for other services
        const agent = await this.agentRegistry.getAgent(service);
        if (!agent) {
          throw new Error(`Agent not found: ${service}`);
        }
        return await (agent as any).process({
          input: task.description,
          context: parameters
        });
    }
  }

  // Utility methods
  private extractComplexity(request: string): 'simple' | 'moderate' | 'complex' | 'multi_phase' {
    const complexWords = ['complex', 'advanced', 'sophisticated', 'enterprise', 'full-featured'];
    const simpleWords = ['simple', 'basic', 'quick', 'small'];
    
    if (complexWords.some(word => request.toLowerCase().includes(word))) {
      return 'complex';
    } else if (simpleWords.some(word => request.toLowerCase().includes(word))) {
      return 'simple';
    } else if (request.split(' ').length > 20) {
      return 'complex';
    } else {
      return 'moderate';
    }
  }

  private extractRequestType(request: string): string {
    const codingWords = ['app', 'website', 'code', 'function', 'component', 'build', 'create'];
    const homeWords = ['light', 'temperature', 'home', 'automation', 'smart'];
    const emailWords = ['email', 'message', 'send', 'compose'];
    
    if (codingWords.some(word => request.toLowerCase().includes(word))) return 'coding';
    if (homeWords.some(word => request.toLowerCase().includes(word))) return 'home_automation';
    if (emailWords.some(word => request.toLowerCase().includes(word))) return 'email';
    
    return 'general';
  }

  private extractKeywords(request: string): string[] {
    return request.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 10);
  }

  private estimateTimeRequirement(request: string): number {
    const complexity = this.extractComplexity(request);
    const baseTime = {
      'simple': 10,
      'moderate': 25,
      'complex': 60,
      'multi_phase': 120
    };
    
    return baseTime[complexity];
  }

  private determinePriority(request: string): 'low' | 'medium' | 'high' | 'urgent' {
    const urgentWords = ['urgent', 'asap', 'immediately', 'critical'];
    const highWords = ['important', 'priority', 'needed'];
    
    if (urgentWords.some(word => request.toLowerCase().includes(word))) return 'urgent';
    if (highWords.some(word => request.toLowerCase().includes(word))) return 'high';
    return 'medium';
  }

  private async optimizeTaskFlow(breakdown: TaskBreakdown): Promise<void> {
    // Basic optimization - ensure logical task order
    breakdown.tasks.sort((a, b) => {
      if (a.dependencies.length === 0 && b.dependencies.length > 0) return -1;
      if (b.dependencies.length === 0 && a.dependencies.length > 0) return 1;
      return a.estimatedDuration - b.estimatedDuration;
    });
  }

  private async customizeTasks(
    breakdown: TaskBreakdown,
    request: string,
    classification: any
  ): Promise<void> {
    // Customize task parameters based on specific request details
    // This is where we'd add more sophisticated customization logic
  }

  private async generateCodingTasks(request: string, classification: any): Promise<TaskStep[]> {
    return [
      {
        id: this.generateTaskId(),
        description: 'Analyze requirements and plan implementation',
        type: 'planning',
        service: 'enhanced-planner-agent',
        parameters: { scope: 'coding', detail: request },
        estimatedDuration: 5,
        dependencies: [],
        status: 'pending'
      },
      {
        id: this.generateTaskId(),
        description: 'Implement the requested functionality',
        type: 'coding',
        service: 'project-completion',
        parameters: { request },
        estimatedDuration: classification.estimatedTime * 0.7,
        dependencies: [],
        status: 'pending'
      },
      {
        id: this.generateTaskId(),
        description: 'Test and validate the implementation',
        type: 'validation',
        service: 'enhanced-code-assistant-agent',
        parameters: { action: 'test', scope: request },
        estimatedDuration: classification.estimatedTime * 0.3,
        dependencies: [],
        status: 'pending'
      }
    ];
  }

  private async generateHomeAutomationTasks(request: string, classification: any): Promise<TaskStep[]> {
    return [
      {
        id: this.generateTaskId(),
        description: 'Execute home automation command',
        type: 'home_automation',
        service: 'home-assistant',
        parameters: { command: request },
        estimatedDuration: classification.estimatedTime,
        dependencies: [],
        status: 'pending'
      }
    ];
  }

  private async generateGenericTasks(request: string, classification: any): Promise<TaskStep[]> {
    return [
      {
        id: this.generateTaskId(),
        description: 'Process user request',
        type: 'research',
        service: 'enhanced-personal-assistant-agent',
        parameters: { request },
        estimatedDuration: classification.estimatedTime,
        dependencies: [],
        status: 'pending'
      }
    ];
  }

  private isCriticalTask(task: TaskStep): boolean {
    return task.type === 'planning' || task.description.includes('critical') || task.description.includes('required');
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateWorkflowId(): string {
    return `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get active workflows
   */
  getActiveWorkflows(): WorkflowExecution[] {
    return Array.from(this.activeWorkflows.values());
  }

  /**
   * Get workflow by ID
   */
  getWorkflow(id: string): WorkflowExecution | undefined {
    return this.activeWorkflows.get(id);
  }
}

export default IntelligentTaskRouter;
export { IntelligentTaskRouter };