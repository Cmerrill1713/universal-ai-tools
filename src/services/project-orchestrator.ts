/**
 * Project Orchestrator - Universal AI Tools
 * Transforms the sophisticated existing architecture into a universal project management system
 * Leverages: AB-MCTS, Dynamic Agent Spawner, Context Storage, DSPy Orchestration
 */

import { LogContext, log } from '@/utils/logger';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type { ABMCTSService } from './ab-mcts-service';
import type { ContextStorageService } from './context-storage-service';
import type { AlphaEvolveService } from './alpha-evolve-service';
import type { LLMRouterService } from './llm-router-service';
import { type ParallelAgentOrchestrator, type ParallelTask, createParallelAgentOrchestrator } from './parallel-agent-orchestrator';
import { type ProjectAwareABMCTSService, createProjectAwareABMCTS } from './project-aware-ab-mcts';
import type { AgentRegistry } from '@/agents/agent-registry';

export interface ProjectSpecification {
  name: string;
  type: ProjectType;
  description: string;
  requirements: string[];
  constraints: ProjectConstraints;
  userContext: Record<string, any>;
  expectedDeliverables: string[];
  successCriteria: string[];
}

export interface ProjectConstraints {
  timeframe?: string;
  budget?: number;
  resources?: string[];
  complexity: 'simple' | 'moderate' | 'complex' | 'enterprise';
  quality: 'draft' | 'production' | 'enterprise';
}

export enum ProjectType {
  PHOTO_ORGANIZATION = 'photo_organization',
  SOFTWARE_DEVELOPMENT = 'software_development',
  DATA_ANALYSIS = 'data_analysis',
  CONTENT_CREATION = 'content_creation',
  AUTOMATION = 'automation',
  RESEARCH = 'research',
  CUSTOM = 'custom'
}

export interface ProjectTask {
  id: string;
  projectId: string;
  name: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  dependencies: string[];
  assignedAgents: string[];
  requiredCapabilities: string[];
  estimatedDuration: number;
  actualDuration?: number;
  progress: number;
  context: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export enum TaskType {
  ANALYSIS = 'analysis',
  PREPARATION = 'preparation',
  EXECUTION = 'execution',
  VALIDATION = 'validation',
  OPTIMIZATION = 'optimization',
  DELIVERY = 'delivery'
}

export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  BLOCKED = 'blocked',
  CANCELLED = 'cancelled'
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface Project {
  id: string;
  specification: ProjectSpecification;
  tasks: ProjectTask[];
  agents: ProjectAgent[];
  status: ProjectStatus;
  progress: ProjectProgress;
  performance: ProjectPerformance;
  context: ProjectContext;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface ProjectAgent {
  id: string;
  type: string;
  capabilities: string[];
  specialization: string;
  performance: AgentProjectPerformance;
  assignedTasks: string[];
  status: 'active' | 'idle' | 'learning' | 'evolving';
}

export interface AgentProjectPerformance {
  tasksCompleted: number;
  averageTaskTime: number;
  successRate: number;
  qualityScore: number;
  learningRate: number;
}

export enum ProjectStatus {
  PLANNING = 'planning',
  IN_PROGRESS = 'in_progress',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface ProjectProgress {
  overallCompletion: number;
  tasksCompleted: number;
  totalTasks: number;
  currentPhase: string;
  estimatedCompletion: Date;
  actualStartDate: Date;
  milestones: ProjectMilestone[];
}

export interface ProjectMilestone {
  id: string;
  name: string;
  description: string;
  targetDate: Date;
  completedDate?: Date;
  dependencies: string[];
  deliverables: string[];
}

export interface ProjectPerformance {
  efficiency: number;
  qualityScore: number;
  resourceUtilization: number;
  timeAccuracy: number;
  costEffectiveness: number;
  userSatisfaction: number;
  learningGains: string[];
}

export interface ProjectContext {
  workingDirectory?: string;
  inputFiles: string[];
  outputFiles: string[];
  temporaryFiles: string[];
  externalResources: string[];
  apiEndpoints: string[];
  databaseConnections: string[];
  environmentVariables: Record<string, string>;
  userPreferences: Record<string, any>;
  projectMemory: ProjectMemoryEntry[];
}

export interface ProjectMemoryEntry {
  timestamp: Date;
  type: 'decision' | 'learning' | 'error' | 'success' | 'insight';
  content: string;
  context: Record<string, any>;
  relevanceScore: number;
}

export interface TaskExecutionResult {
  task: ProjectTask;
  success: boolean;
  result?: any;
  error?: string;
  executionTime: number;
  agentUsed?: string;
}

export class ProjectOrchestrator extends EventEmitter {
  private projects: Map<string, Project> = new Map();
  private activeProjects: Set<string> = new Set();
  private parallelOrchestrator: ParallelAgentOrchestrator | null = null;
  private projectAwareMCTS: ProjectAwareABMCTSService | null = null;
  
  constructor(
    private abmctsService: ABMCTSService,
    private contextService: ContextStorageService,
    private alphaEvolveService: AlphaEvolveService,
    private llmRouter: LLMRouterService,
    private agentRegistry?: AgentRegistry
  ) {
    super();
    this.setupEventHandlers();
    this.initializeParallelOrchestrator();
    this.initializeProjectAwareMCTS();
  }

  /**
   * Initialize the parallel agent orchestrator for faster execution
   */
  private async initializeParallelOrchestrator(): Promise<void> {
    if (this.agentRegistry) {
      try {
        this.parallelOrchestrator = createParallelAgentOrchestrator(
          this.agentRegistry,
          this.abmctsService,
          this.contextService
        );
        
        log.info('✅ Parallel Agent Orchestrator initialized', LogContext.PROJECT, {
          systemMetrics: this.parallelOrchestrator.getSystemMetrics()
        });
      } catch (error) {
        log.warn('⚠️ Failed to initialize parallel orchestrator, using fallback', LogContext.PROJECT, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Initialize the project-aware AB-MCTS for intelligent task coordination
   */
  private async initializeProjectAwareMCTS(): Promise<void> {
    try {
      this.projectAwareMCTS = createProjectAwareABMCTS({
        maxIterations: 800,
        explorationConstant: 1.6,
        projectTypeWeight: 0.35,
        taskPriorityWeight: 0.45,
        dependencyAwareness: true,
        crossTaskLearning: true,
        projectMemorySize: 200,
        timeLimit: 45000 // 45 seconds for complex project decisions
      });

      log.info('✅ Project-Aware AB-MCTS initialized', LogContext.PROJECT, {
        features: [
          'Project context understanding',
          'Task dependency awareness',
          'Cross-project learning',
          'Dynamic agent selection',
          'Risk assessment',
          'Coordination planning'
        ]
      });
    } catch (error) {
      log.warn('⚠️ Failed to initialize project-aware AB-MCTS, using standard AB-MCTS', LogContext.PROJECT, {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Create a new project from specification
   * Leverages existing AB-MCTS for intelligent task decomposition
   */
  async createProject(specification: ProjectSpecification): Promise<Project> {
    log.info('🎯 Creating new project', LogContext.PROJECT, {
      name: specification.name,
      type: specification.type,
      complexity: specification.constraints.complexity
    });

    const projectId = uuidv4();
    
    // Use AB-MCTS for intelligent project planning
    const projectPlan = await this.analyzeAndPlanProject(specification);
    
    const project: Project = {
      id: projectId,
      specification,
      tasks: projectPlan.tasks,
      agents: [],
      status: ProjectStatus.PLANNING,
      progress: {
        overallCompletion: 0,
        tasksCompleted: 0,
        totalTasks: projectPlan.tasks.length,
        currentPhase: 'planning',
        estimatedCompletion: projectPlan.estimatedCompletion,
        actualStartDate: new Date(),
        milestones: projectPlan.milestones
      },
      performance: {
        efficiency: 0,
        qualityScore: 0,
        resourceUtilization: 0,
        timeAccuracy: 0,
        costEffectiveness: 0,
        userSatisfaction: 0,
        learningGains: []
      },
      context: {
        inputFiles: [],
        outputFiles: [],
        temporaryFiles: [],
        externalResources: [],
        apiEndpoints: [],
        databaseConnections: [],
        environmentVariables: {},
        userPreferences: specification.userContext || {},
        projectMemory: []
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.projects.set(projectId, project);
    
    // Store project context in Supabase for persistence
    await this.persistProjectContext(project);
    
    this.emit('projectCreated', project);
    
    log.info('✅ Project created successfully', LogContext.PROJECT, {
      projectId,
      taskCount: project.tasks.length,
      estimatedDuration: projectPlan.estimatedDuration
    });

    return project;
  }

  /**
   * Start project execution
   * Leverages existing Dynamic Agent Spawner for project-specific agents
   */
  async startProject(projectId: string): Promise<void> {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    log.info('🚀 Starting project execution', LogContext.PROJECT, {
      projectId,
      name: project.specification.name
    });

    project.status = ProjectStatus.IN_PROGRESS;
    project.updatedAt = new Date();
    this.activeProjects.add(projectId);

    // Spawn required agents for this project type
    const requiredAgents = await this.determineRequiredAgents(project);
    project.agents = await this.spawnProjectAgents(project, requiredAgents);

    // Start task execution using existing orchestration
    await this.executeProjectTasks(project);

    this.emit('projectStarted', project);
  }

  /**
   * Get project status and progress
   */
  getProject(projectId: string): Project | undefined {
    return this.projects.get(projectId);
  }

  /**
   * List all projects with optional filtering
   */
  listProjects(filter?: {
    status?: ProjectStatus;
    type?: ProjectType;
    activeOnly?: boolean;
  }): Project[] {
    let projects = Array.from(this.projects.values());

    if (filter) {
      if (filter.status) {
        projects = projects.filter(p => p.status === filter.status);
      }
      if (filter.type) {
        projects = projects.filter(p => p.specification.type === filter.type);
      }
      if (filter.activeOnly) {
        projects = projects.filter(p => this.activeProjects.has(p.id));
      }
    }

    return projects.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Cancel a project and cleanup resources
   */
  async cancelProject(projectId: string, reason?: string): Promise<void> {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    log.info('🛑 Cancelling project', LogContext.PROJECT, {
      projectId,
      reason: reason || 'User requested'
    });

    project.status = ProjectStatus.CANCELLED;
    project.updatedAt = new Date();
    this.activeProjects.delete(projectId);

    // Cleanup project agents and resources
    await this.cleanupProjectResources(project);

    this.emit('projectCancelled', project, reason);
  }

  /**
   * Private: Analyze project and create execution plan using AB-MCTS
   */
  private async analyzeAndPlanProject(specification: ProjectSpecification): Promise<{
    tasks: ProjectTask[];
    milestones: ProjectMilestone[];
    estimatedCompletion: Date;
    estimatedDuration: number;
  }> {
    log.info('🧠 Analyzing project for intelligent planning', LogContext.PROJECT, {
      type: specification.type,
      complexity: specification.constraints.complexity
    });

    // Use existing AB-MCTS service for intelligent task decomposition
    const analysisPrompt = this.buildAnalysisPrompt(specification);
    
    const mctsResult = await this.abmctsService.orchestrate({
      task: analysisPrompt,
      agents: ['planner', 'synthesizer', 'retriever'],
      explorationRate: 0.3,
      maxIterations: 50,
      context: {
        projectType: specification.type,
        complexity: specification.constraints.complexity,
        requirements: specification.requirements
      }
    });

    // Parse MCTS result into structured tasks
    const tasks = this.parseTasksFromMCTSResult(mctsResult, specification);
    const milestones = this.generateMilestones(tasks);
    const estimatedDuration = this.calculateProjectDuration(tasks);
    const estimatedCompletion = new Date(Date.now() + estimatedDuration * 1000);

    return {
      tasks,
      milestones,
      estimatedCompletion,
      estimatedDuration
    };
  }

  private buildAnalysisPrompt(specification: ProjectSpecification): string {
    return `
Analyze and create a detailed execution plan for this project:

Project: ${specification.name}
Type: ${specification.type}
Description: ${specification.description}

Requirements:
${specification.requirements.map(req => `- ${req}`).join('\n')}

Constraints:
- Complexity: ${specification.constraints.complexity}
- Quality Level: ${specification.constraints.quality}
- Timeframe: ${specification.constraints.timeframe || 'Not specified'}

Expected Deliverables:
${specification.expectedDeliverables.map(del => `- ${del}`).join('\n')}

Please provide:
1. Detailed task breakdown with dependencies
2. Required agent capabilities for each task
3. Risk assessment and mitigation strategies  
4. Quality checkpoints and validation criteria
5. Resource requirements and timeline estimates

Focus on creating an optimal execution strategy that leverages our advanced AI orchestration capabilities.
    `.trim();
  }

  private parseTasksFromMCTSResult(mctsResult: any, specification: ProjectSpecification): ProjectTask[] {
    // This would parse the MCTS orchestration result into structured tasks
    // For now, create basic task structure based on project type
    const baseTasks = this.getBaseTasksForProjectType(specification.type);
    
    return baseTasks.map((task, index) => ({
      id: uuidv4(),
      projectId: '', // Will be set by caller
      name: task.name,
      description: task.description,
      type: task.type,
      status: TaskStatus.PENDING,
      priority: task.priority,
      dependencies: task.dependencies,
      assignedAgents: [],
      requiredCapabilities: task.requiredCapabilities,
      estimatedDuration: task.estimatedDuration,
      progress: 0,
      context: {},
      createdAt: new Date(),
      updatedAt: new Date()
    }));
  }

  private getBaseTasksForProjectType(type: ProjectType): Array<{
    name: string;
    description: string;
    type: TaskType;
    priority: TaskPriority;
    dependencies: string[];
    requiredCapabilities: string[];
    estimatedDuration: number;
  }> {
    switch (type) {
      case ProjectType.PHOTO_ORGANIZATION:
        return [
          {
            name: 'Analyze Photo Collection',
            description: 'Scan and analyze all photos for metadata, subjects, and quality',
            type: TaskType.ANALYSIS,
            priority: TaskPriority.HIGH,
            dependencies: [],
            requiredCapabilities: ['computer_vision', 'metadata_extraction'],
            estimatedDuration: 1800 // 30 minutes
          },
          {
            name: 'Create Organization Structure',
            description: 'Design optimal folder structure based on analysis',
            type: TaskType.PREPARATION,
            priority: TaskPriority.HIGH,
            dependencies: ['Analyze Photo Collection'],
            requiredCapabilities: ['file_management', 'pattern_recognition'],
            estimatedDuration: 600 // 10 minutes
          },
          {
            name: 'Organize Photos',
            description: 'Move and organize photos into structured folders',
            type: TaskType.EXECUTION,
            priority: TaskPriority.MEDIUM,
            dependencies: ['Create Organization Structure'],
            requiredCapabilities: ['file_operations', 'batch_processing'],
            estimatedDuration: 3600 // 1 hour
          }
        ];

      case ProjectType.SOFTWARE_DEVELOPMENT:
        return [
          {
            name: 'Architecture Design',
            description: 'Design system architecture and technical specifications',
            type: TaskType.ANALYSIS,
            priority: TaskPriority.CRITICAL,
            dependencies: [],
            requiredCapabilities: ['software_architecture', 'technical_design'],
            estimatedDuration: 7200 // 2 hours
          },
          {
            name: 'Database Schema Design',
            description: 'Create database schema and data models',
            type: TaskType.PREPARATION,
            priority: TaskPriority.HIGH,
            dependencies: ['Architecture Design'],
            requiredCapabilities: ['database_design', 'data_modeling'],
            estimatedDuration: 3600 // 1 hour
          },
          {
            name: 'Backend Development',
            description: 'Implement backend services and APIs',
            type: TaskType.EXECUTION,
            priority: TaskPriority.HIGH,
            dependencies: ['Database Schema Design'],
            requiredCapabilities: ['backend_development', 'api_design'],
            estimatedDuration: 14400 // 4 hours
          },
          {
            name: 'Frontend Development',
            description: 'Build user interface and frontend components',
            type: TaskType.EXECUTION,
            priority: TaskPriority.HIGH,
            dependencies: ['Backend Development'],
            requiredCapabilities: ['frontend_development', 'ui_design'],
            estimatedDuration: 10800 // 3 hours
          }
        ];

      default:
        return [
          {
            name: 'Project Analysis',
            description: 'Analyze project requirements and create execution plan',
            type: TaskType.ANALYSIS,
            priority: TaskPriority.HIGH,
            dependencies: [],
            requiredCapabilities: ['analysis', 'planning'],
            estimatedDuration: 1800
          },
          {
            name: 'Execute Project',
            description: 'Execute the main project tasks',
            type: TaskType.EXECUTION,
            priority: TaskPriority.MEDIUM,
            dependencies: ['Project Analysis'],
            requiredCapabilities: ['execution', 'problem_solving'],
            estimatedDuration: 3600
          }
        ];
    }
  }

  private generateMilestones(tasks: ProjectTask[]): ProjectMilestone[] {
    // Generate logical milestones based on task groups
    const milestones: ProjectMilestone[] = [];
    
    // Group tasks by type
    const tasksByType = tasks.reduce((acc, task) => {
      if (!acc[task.type]) acc[task.type] = [];
      acc[task.type].push(task);
      return acc;
    }, {} as Record<TaskType, ProjectTask[]>);

    Object.entries(tasksByType).forEach(([type, typeTasks]) => {
      const totalDuration = typeTasks.reduce((sum, task) => sum + task.estimatedDuration, 0);
      const targetDate = new Date(Date.now() + totalDuration * 1000);

      milestones.push({
        id: uuidv4(),
        name: `${type.charAt(0).toUpperCase() + type.slice(1)} Complete`,
        description: `All ${type} tasks completed`,
        targetDate,
        dependencies: typeTasks.map(t => t.id),
        deliverables: typeTasks.map(t => t.name)
      });
    });

    return milestones;
  }

  private calculateProjectDuration(tasks: ProjectTask[]): number {
    // Calculate critical path duration
    return tasks.reduce((total, task) => total + task.estimatedDuration, 0);
  }

  private async determineRequiredAgents(project: Project): Promise<string[]> {
    const requiredCapabilities = new Set<string>();
    
    project.tasks.forEach(task => {
      task.requiredCapabilities.forEach(cap => requiredCapabilities.add(cap));
    });

    // Map capabilities to agent types
    const capabilityToAgentMap: Record<string, string> = {
      computer_vision: 'vision_agent',
      metadata_extraction: 'metadata_agent',
      file_management: 'file_agent',
      software_architecture: 'architect_agent',
      backend_development: 'backend_agent',
      frontend_development: 'frontend_agent',
      database_design: 'database_agent',
      analysis: 'planner_agent',
      planning: 'planner_agent'
    };

    return Array.from(requiredCapabilities)
      .map(cap => capabilityToAgentMap[cap])
      .filter(Boolean);
  }

  private async spawnProjectAgents(project: Project, requiredAgentTypes: string[]): Promise<ProjectAgent[]> {
    // This would use the existing Dynamic Agent Spawner
    // For now, return mock agents
    return requiredAgentTypes.map(type => ({
      id: uuidv4(),
      type,
      capabilities: this.getAgentCapabilities(type),
      specialization: `Specialized for ${project.specification.type}`,
      performance: {
        tasksCompleted: 0,
        averageTaskTime: 0,
        successRate: 1.0,
        qualityScore: 0.8,
        learningRate: 0.1
      },
      assignedTasks: [],
      status: 'active' as const
    }));
  }

  private getAgentCapabilities(agentType: string): string[] {
    const capabilityMap: Record<string, string[]> = {
      vision_agent: ['computer_vision', 'image_analysis', 'metadata_extraction'],
      file_agent: ['file_operations', 'batch_processing', 'file_management'],
      architect_agent: ['software_architecture', 'system_design', 'technical_planning'],
      backend_agent: ['backend_development', 'api_design', 'database_integration'],
      frontend_agent: ['frontend_development', 'ui_design', 'user_experience'],
      database_agent: ['database_design', 'data_modeling', 'query_optimization'],
      planner_agent: ['analysis', 'planning', 'strategic_thinking']
    };

    return capabilityMap[agentType] || ['general_assistance'];
  }

  private async executeProjectTasks(project: Project): Promise<void> {
    log.info('🔄 Starting parallel project task execution', LogContext.PROJECT, {
      projectId: project.id,
      taskCount: project.tasks.length,
      agentCount: project.agents.length
    });

    // Group tasks by phase and dependencies for parallel execution
    const taskGroups = this.groupTasksForParallelExecution(project.tasks);
    
    // Execute task groups in sequence, but tasks within each group in parallel
    for (let groupIndex = 0; groupIndex < taskGroups.length; groupIndex++) {
      const taskGroup = taskGroups[groupIndex];
      
      log.info(`🚀 Executing task group ${groupIndex + 1}/${taskGroups.length}`, LogContext.PROJECT, {
        projectId: project.id,
        tasksInGroup: taskGroup.length,
        taskNames: taskGroup.map(t => t.name)
      });

      // Execute all tasks in this group in parallel
      const groupResults = await this.executeTaskGroupInParallel(project, taskGroup);
      
      // Update project progress
      this.updateProjectProgressFromResults(project, groupResults);
      
      // Check if any critical tasks failed
      const criticalFailures = groupResults.filter(r => 
        r.task.priority === TaskPriority.CRITICAL && r.success === false
      );
      
      if (criticalFailures.length > 0) {
        log.error('❌ Critical task failures detected, halting project execution', LogContext.PROJECT, {
          projectId: project.id,
          failedTasks: criticalFailures.map(f => f.task.name)
        });
        
        project.status = ProjectStatus.FAILED;
        await this.persistProjectContext(project);
        this.emit('projectFailed', project, criticalFailures);
        return;
      }
      
      log.info(`✅ Task group ${groupIndex + 1} completed`, LogContext.PROJECT, {
        projectId: project.id,
        successful: groupResults.filter(r => r.success).length,
        failed: groupResults.filter(r => !r.success).length
      });
    }

    // All task groups completed
    project.status = ProjectStatus.COMPLETED;
    project.progress.overallCompletion = 100;
    project.completedAt = new Date();
    
    await this.persistProjectContext(project);
    this.emit('projectCompleted', project);
    
    log.info('🎉 Project execution completed successfully', LogContext.PROJECT, {
      projectId: project.id,
      totalTasks: project.tasks.length,
      duration: Date.now() - project.createdAt.getTime()
    });
  }

  private async persistProjectContext(project: Project): Promise<void> {
    // Store project in Supabase context storage
    await this.contextService.storeContext({
      content: JSON.stringify(project),
      category: 'project',
      source: 'project_orchestrator',
      userId: 'system',
      projectPath: project.context.workingDirectory,
      metadata: {
        projectId: project.id,
        projectType: project.specification.type,
        status: project.status
      }
    });
  }

  private async cleanupProjectResources(project: Project): Promise<void> {
    // Cleanup temporary files, release agents, etc.
    log.info('🧹 Cleaning up project resources', LogContext.PROJECT, {
      projectId: project.id
    });
  }

  /**
   * Group tasks for parallel execution based on dependencies and types
   */
  private groupTasksForParallelExecution(tasks: ProjectTask[]): ProjectTask[][] {
    const taskGroups: ProjectTask[][] = [];
    const completedTasks = new Set<string>();
    const remainingTasks = [...tasks];

    while (remainingTasks.length > 0) {
      // Find tasks that can run in parallel (no dependencies or all dependencies completed)
      const readyTasks = remainingTasks.filter(task => 
        task.dependencies.every(depId => completedTasks.has(depId))
      );

      if (readyTasks.length === 0) {
        // Handle circular dependencies or missing dependencies
        log.warn('⚠️ Circular or missing dependencies detected', LogContext.PROJECT, {
          remainingTasks: remainingTasks.map(t => t.name),
          completedTasks: Array.from(completedTasks)
        });
        
        // Add remaining tasks to final group
        taskGroups.push([...remainingTasks]);
        break;
      }

      // Group ready tasks by type for better resource utilization
      const groupedByType = readyTasks.reduce((groups, task) => {
        if (!groups[task.type]) groups[task.type] = [];
        groups[task.type].push(task);
        return groups;
      }, {} as Record<TaskType, ProjectTask[]>);

      // Create parallel groups, prioritizing critical tasks
      const criticalTasks = readyTasks.filter(t => t.priority === TaskPriority.CRITICAL);
      const nonCriticalTasks = readyTasks.filter(t => t.priority !== TaskPriority.CRITICAL);

      if (criticalTasks.length > 0) {
        taskGroups.push(criticalTasks);
        // Mark critical tasks as completed
        criticalTasks.forEach(t => completedTasks.add(t.id));
        // Remove from remaining tasks
        criticalTasks.forEach(t => {
          const index = remainingTasks.findIndex(rt => rt.id === t.id);
          if (index !== -1) remainingTasks.splice(index, 1);
        });
      }

      if (nonCriticalTasks.length > 0) {
        taskGroups.push(nonCriticalTasks);
        // Mark non-critical tasks as completed
        nonCriticalTasks.forEach(t => completedTasks.add(t.id));
        // Remove from remaining tasks
        nonCriticalTasks.forEach(t => {
          const index = remainingTasks.findIndex(rt => rt.id === t.id);
          if (index !== -1) remainingTasks.splice(index, 1);
        });
      }
    }

    log.info('📊 Task grouping completed for parallel execution', LogContext.PROJECT, {
      totalTasks: tasks.length,
      groupCount: taskGroups.length,
      groupSizes: taskGroups.map(g => g.length)
    });

    return taskGroups;
  }

  /**
   * Execute a group of tasks in parallel using available agents
   */
  private async executeTaskGroupInParallel(
    project: Project, 
    taskGroup: ProjectTask[]
  ): Promise<TaskExecutionResult[]> {
    const startTime = Date.now();
    
    log.info('⚡ Executing task group in parallel', LogContext.PROJECT, {
      projectId: project.id,
      taskCount: taskGroup.length,
      tasks: taskGroup.map(t => `${t.name} (${t.priority})`)
    });

    // Create execution promises for each task
    const executionPromises = taskGroup.map(async (task): Promise<TaskExecutionResult> => {
      const taskStartTime = Date.now();
      
      try {
        // Find optimal agent for this task
        const optimalAgent = this.findOptimalAgentForTask(project, task);
        
        // Create task context for agent execution
        const taskContext = {
          userRequest: `Execute project task: ${task.name}`,
          task: {
            id: task.id,
            name: task.name,
            description: task.description,
            type: task.type,
            priority: task.priority,
            requiredCapabilities: task.requiredCapabilities
          },
          project: {
            id: project.id,
            name: project.specification.name,
            type: project.specification.type,
            context: project.context
          },
          workingDirectory: project.context.workingDirectory || process.cwd(),
          requestId: `${project.id}_${task.id}_${Date.now()}`
        };

        log.info(`🎯 Executing task: ${task.name}`, LogContext.PROJECT, {
          projectId: project.id,
          taskId: task.id,
          agentUsed: optimalAgent?.type || 'default',
          priority: task.priority
        });

        // Execute task using enhanced project-aware coordination
        let result;
        if (this.projectAwareMCTS && (task.priority === TaskPriority.CRITICAL || task.requiredCapabilities.length > 2)) {
          // Use project-aware AB-MCTS for complex/critical tasks
          log.info(`🧠 Using project-aware AB-MCTS for task: ${task.name}`, LogContext.PROJECT, {
            projectId: project.id,
            taskId: task.id,
            priority: task.priority,
            capabilities: task.requiredCapabilities
          });

          const orchestrationResult = await this.projectAwareMCTS.orchestrateProject({
            project,
            task,
            agents: task.requiredCapabilities.slice(0, 3),
            explorationRate: 0.25,
            maxIterations: 50,
            context: taskContext
          });

          // Execute with the selected optimal agent
          result = await this.executeSingleTask(task, {
            ...taskContext,
            selectedAgent: orchestrationResult.bestAgent,
            orchestrationReasoning: orchestrationResult.reasoning,
            expectedQuality: orchestrationResult.expectedQuality,
            coordination: orchestrationResult.coordination
          });

          // Record the decision for learning
          this.projectAwareMCTS.recordProjectDecision({
            taskId: task.id,
            agentUsed: orchestrationResult.bestAgent,
            decision: orchestrationResult.reasoning,
            outcome: 'success', // Will be updated based on actual result
            confidence: orchestrationResult.expectedQuality,
            timestamp: Date.now(),
            learnedPatterns: []
          });

        } else if (task.priority === TaskPriority.CRITICAL || task.requiredCapabilities.length > 2) {
          // Fallback to standard AB-MCTS for complex/critical tasks
          result = await this.abmctsService.orchestrate({
            task: taskContext.userRequest,
            agents: task.requiredCapabilities.slice(0, 3),
            explorationRate: 0.2,
            maxIterations: 30,
            context: taskContext
          });
        } else {
          // Use direct agent execution for simpler tasks
          result = await this.executeSingleTask(task, taskContext);
        }

        // Update task status
        task.status = TaskStatus.COMPLETED;
        task.progress = 100;
        task.completedAt = new Date();
        task.actualDuration = Date.now() - taskStartTime;

        return {
          task,
          success: true,
          result,
          executionTime: Date.now() - taskStartTime,
          agentUsed: optimalAgent?.type
        };

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        log.error(`❌ Task execution failed: ${task.name}`, LogContext.PROJECT, {
          projectId: project.id,
          taskId: task.id,
          error: errorMessage,
          executionTime: Date.now() - taskStartTime
        });

        // Update task status
        task.status = TaskStatus.FAILED;
        task.updatedAt = new Date();

        return {
          task,
          success: false,
          error: errorMessage,
          executionTime: Date.now() - taskStartTime
        };
      }
    });

    // Wait for all tasks in the group to complete
    const results = await Promise.all(executionPromises);
    
    const totalTime = Date.now() - startTime;
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    log.info('📊 Task group execution completed', LogContext.PROJECT, {
      projectId: project.id,
      totalTime: `${totalTime}ms`,
      successful,
      failed,
      parallelSpeedup: `${Math.round(results.reduce((sum, r) => sum + r.executionTime, 0) / totalTime * 100)}%`
    });

    return results;
  }

  /**
   * Execute a single task with optimal agent selection using real agents
   */
  private async executeSingleTask(task: ProjectTask, context: any): Promise<any> {
    if (this.agentRegistry) {
      try {
        // Find optimal agent based on task capabilities
        const optimalAgentName = this.agentRegistry.findOptimalAgent(task.requiredCapabilities);
        
        if (optimalAgentName) {
          log.info(`🎯 Executing task with optimal agent`, LogContext.PROJECT, {
            taskId: task.id,
            taskName: task.name,
            agentUsed: optimalAgentName,
            capabilities: task.requiredCapabilities
          });

          // Execute task using the optimal agent
          const result = await this.agentRegistry.processRequest(optimalAgentName, context);
          
          return {
            success: true,
            message: `Task '${task.name}' completed successfully by ${optimalAgentName}`,
            result,
            outputs: [result],
            metadata: {
              taskType: task.type,
              agentUsed: optimalAgentName,
              confidence: 0.85
            }
          };
        } else {
          // No optimal agent found, use agent orchestration
          log.info(`🔀 Using agent orchestration for task`, LogContext.PROJECT, {
            taskId: task.id,
            taskName: task.name,
            capabilities: task.requiredCapabilities
          });

          const supportingAgents = task.requiredCapabilities.slice(0, 2); // Limit to 2 supporting agents
          const primaryAgent = 'personal_assistant'; // Default primary agent

          const result = await this.agentRegistry.orchestrateAgents(
            primaryAgent,
            supportingAgents,
            context
          );

          return {
            success: true,
            message: `Task '${task.name}' completed through agent orchestration`,
            result,
            outputs: [result.primary, ...result.supporting.map(s => s.result)],
            metadata: {
              taskType: task.type,
              primaryAgent,
              supportingAgents,
              synthesized: !!result.synthesis,
              confidence: 0.8
            }
          };
        }
      } catch (error) {
        log.error(`❌ Real agent execution failed for task: ${task.name}`, LogContext.PROJECT, {
          taskId: task.id,
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }
    } else {
      // Fallback to mock result if no agent registry available
      log.warn(`⚠️ No agent registry available, using mock execution`, LogContext.PROJECT, {
        taskId: task.id,
        taskName: task.name
      });
      
      return {
        success: true,
        message: `Task '${task.name}' completed (mock execution)`,
        outputs: [],
        metadata: {
          taskType: task.type,
          executionTime: Math.random() * 1000 + 500,
          confidence: 0.7,
          isMock: true
        }
      };
    }
  }

  /**
   * Find the optimal agent for a specific task based on capabilities and performance
   */
  private findOptimalAgentForTask(project: Project, task: ProjectTask): ProjectAgent | null {
    // Find agents with matching capabilities
    const capableAgents = project.agents.filter(agent => 
      task.requiredCapabilities.some(cap => agent.capabilities.includes(cap))
    );

    if (capableAgents.length === 0) {
      return null;
    }

    // Select agent with best performance for this task type
    const optimalAgent = capableAgents.reduce((best, current) => {
      const bestScore = this.calculateAgentTaskScore(best, task);
      const currentScore = this.calculateAgentTaskScore(current, task);
      return currentScore > bestScore ? current : best;
    });

    return optimalAgent;
  }

  /**
   * Calculate agent suitability score for a specific task
   */
  private calculateAgentTaskScore(agent: ProjectAgent, task: ProjectTask): number {
    let score = 0;

    // Capability match score
    const matchingCapabilities = task.requiredCapabilities.filter(cap => 
      agent.capabilities.includes(cap)
    ).length;
    score += (matchingCapabilities / task.requiredCapabilities.length) * 50;

    // Performance score
    score += agent.performance.successRate * 30;
    score += (1 - agent.performance.averageTaskTime / 10000) * 10; // Prefer faster agents
    score += agent.performance.qualityScore * 10;

    return score;
  }

  /**
   * Update project progress based on task execution results
   */
  private updateProjectProgressFromResults(project: Project, results: TaskExecutionResult[]): void {
    const completedTasks = results.filter(r => r.success).length;
    project.progress.tasksCompleted += completedTasks;
    
    // Update overall completion percentage
    project.progress.overallCompletion = Math.round(
      (project.progress.tasksCompleted / project.progress.totalTasks) * 100
    );

    // Update project performance metrics
    const avgExecutionTime = results.reduce((sum, r) => sum + r.executionTime, 0) / results.length;
    const successRate = results.filter(r => r.success).length / results.length;
    
    project.performance.efficiency = Math.min(100, project.performance.efficiency + (successRate * 10));
    project.performance.timeAccuracy = Math.max(0, 100 - (avgExecutionTime / 1000)); // Simplified calculation
    
    project.updatedAt = new Date();

    log.info('📈 Project progress updated', LogContext.PROJECT, {
      projectId: project.id,
      overallCompletion: project.progress.overallCompletion,
      tasksCompleted: project.progress.tasksCompleted,
      totalTasks: project.progress.totalTasks,
      efficiency: project.performance.efficiency
    });
  }

  private setupEventHandlers(): void {
    this.on('projectCreated', (project: Project) => {
      log.info('📝 Project created event', LogContext.PROJECT, {
        projectId: project.id,
        type: project.specification.type
      });
    });

    this.on('projectStarted', (project: Project) => {
      log.info('🚀 Project started event', LogContext.PROJECT, {
        projectId: project.id,
        agentCount: project.agents.length
      });
    });

    this.on('projectCompleted', (project: Project) => {
      log.info('🎉 Project completed event', LogContext.PROJECT, {
        projectId: project.id,
        duration: project.completedAt ? 
          project.completedAt.getTime() - project.createdAt.getTime() : 0,
        tasksCompleted: project.progress.tasksCompleted,
        efficiency: project.performance.efficiency
      });
    });

    this.on('projectFailed', (project: Project, failures: TaskExecutionResult[]) => {
      log.error('💥 Project failed event', LogContext.PROJECT, {
        projectId: project.id,
        failureCount: failures.length,
        failedTasks: failures.map(f => f.task.name)
      });
    });
  }
}

// Export singleton instance factory - will be created in server.ts with proper dependencies
export let projectOrchestrator: ProjectOrchestrator | null = null;

export function createProjectOrchestrator(
  abmctsService: ABMCTSService,
  contextService: ContextStorageService,
  alphaEvolveService: AlphaEvolveService,
  llmRouter: LLMRouterService,
  agentRegistry?: AgentRegistry
): ProjectOrchestrator {
  projectOrchestrator = new ProjectOrchestrator(
    abmctsService,
    contextService,
    alphaEvolveService,
    llmRouter,
    agentRegistry
  );
  return projectOrchestrator;
}