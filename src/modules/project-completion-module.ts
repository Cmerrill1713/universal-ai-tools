/**
 * Project Completion Sub-Module
 * Activated when the assistant receives a request to complete a project
 * Works with existing agents to coordinate project completion
 */

import { EventEmitter } from 'events';
import { AgentRegistry } from '../agents/agent-registry.js';
import { log, LogContext } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

export interface ProjectCompletionRequest {
  projectPath: string;
  projectName: string;
  requirements?: string;
  targetLanguage?: string;
  priority?: 'low' | 'medium' | 'high';
  deadline?: Date;
}

export interface ProjectTask {
  id: string;
  name: string;
  description: string;
  assignedAgent?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  dependencies: string[];
  estimatedTime: number;
  createdAt: Date;
  completedAt?: Date;
}

export interface ProjectProgress {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  completionPercentage: number;
  estimatedTimeRemaining: number;
  currentPhase: string;
}

export class ProjectCompletionModule extends EventEmitter {
  private agentRegistry: AgentRegistry;
  private activeProjects: Map<string, ProjectState> = new Map();
  private taskQueue: ProjectTask[] = [];

  constructor(agentRegistry: AgentRegistry) {
    super();
    this.agentRegistry = agentRegistry;
    log.info('📋 Project Completion Module initialized', LogContext.SYSTEM);
  }

  /**
   * Main entry point when assistant wants to complete a project
   */
  async completeProject(request: ProjectCompletionRequest): Promise<string> {
    log.info(`🚀 Starting project completion: ${request.projectName}`, LogContext.PROJECT);
    
    const projectId = this.generateProjectId(request.projectName);
    
    try {
      // Phase 1: Project Analysis
      const analysis = await this.analyzeProject(request);
      
      // Phase 2: Task Planning
      const tasks = await this.createTaskPlan(analysis);
      
      // Phase 3: Agent Coordination
      await this.coordinateAgents(tasks);
      
      // Phase 4: Execute Project
      const result = await this.executeProject(projectId, tasks);
      
      return result;
    } catch (error) {
      log.error(`❌ Project completion failed: ${request.projectName}`, LogContext.PROJECT, { error });
      throw error;
    }
  }

  /**
   * Analyze the project to understand what needs to be done
   */
  private async analyzeProject(request: ProjectCompletionRequest): Promise<ProjectAnalysis> {
    log.info('🔍 Analyzing project structure and requirements...', LogContext.PROJECT);
    
    // Get the planner agent to analyze the project
    const plannerAgent = await this.agentRegistry.getAgent('planner');
    if (!plannerAgent) {
      throw new Error('Planner agent not available for project analysis');
    }

    // Analyze the project directory
    const projectStats = await this.getProjectStats(request.projectPath);
    
    // Use planner agent to create project analysis
    const analysisContext = {
      requestId: this.generateRequestId(),
      userRequest: `Analyze this project for completion: ${request.projectName}`,
      projectPath: request.projectPath,
      requirements: request.requirements,
      existingFiles: projectStats.files,
      projectType: await this.detectProjectType(request.projectPath)
    };

    const analysisResult = await plannerAgent.execute(analysisContext);
    
    // Type guard for analysis result
    const resultData = analysisResult.data as any;
    
    return {
      projectPath: request.projectPath,
      projectName: request.projectName,
      projectType: analysisContext.projectType,
      existingFiles: projectStats.files,
      missingComponents: resultData?.missingComponents || [],
      complexity: resultData?.complexity || 'medium',
      estimatedHours: resultData?.estimatedHours || 8
    };
  }

  /**
   * Create a detailed task plan for project completion
   */
  private async createTaskPlan(analysis: ProjectAnalysis): Promise<ProjectTask[]> {
    log.info('📋 Creating detailed task plan...', LogContext.PROJECT);
    
    const tasks: ProjectTask[] = [];
    const components = analysis.missingComponents || [];
    
    for (let i = 0; i < components.length; i++) {
      const component = components[i];
      if (!component) continue;
      
      const task: ProjectTask = {
        id: `task_${i + 1}`,
        name: `Implement ${component.name}`,
        description: component.description || `Implement the ${component.name} component`,
        assignedAgent: this.selectBestAgent(component.type),
        status: 'pending',
        dependencies: component.dependencies || [],
        estimatedTime: component.estimatedHours || 2,
        createdAt: new Date()
      };
      
      tasks.push(task);
    }
    
    // Add integration and testing tasks
    tasks.push({
      id: 'task_integration',
      name: 'Integration and Testing',
      description: 'Integrate all components and run tests',
      assignedAgent: 'code_assistant',
      status: 'pending',
      dependencies: tasks.map(t => t.id),
      estimatedTime: 1,
      createdAt: new Date()
    });

    log.info(`📝 Created ${tasks.length} tasks for project completion`, LogContext.PROJECT);
    return tasks;
  }

  /**
   * Coordinate agents to work on the project
   */
  private async coordinateAgents(tasks: ProjectTask[]): Promise<void> {
    log.info('🤖 Coordinating agents for project execution...', LogContext.PROJECT);
    
    // Group tasks by agent
    const agentTasks = new Map<string, ProjectTask[]>();
    
    for (const task of tasks) {
      const agentName = task.assignedAgent || 'planner';
      if (!agentTasks.has(agentName)) {
        agentTasks.set(agentName, []);
      }
      agentTasks.get(agentName)!.push(task);
    }

    // Prepare agents for coordination
    for (const [agentName, agentTaskList] of agentTasks) {
      log.info(`📋 Agent ${agentName} assigned ${agentTaskList.length} tasks`, LogContext.PROJECT);
      
      // Ensure agent is available
      const agent = await this.agentRegistry.getAgent(agentName);
      if (!agent) {
        log.warn(`⚠️ Agent ${agentName} not available, reassigning tasks`, LogContext.PROJECT);
        // Reassign to planner
        const plannerTasks = agentTasks.get('planner') || [];
        plannerTasks.push(...agentTaskList);
        agentTasks.set('planner', plannerTasks);
        agentTasks.delete(agentName);
      }
    }
  }

  /**
   * Execute the project by running tasks through agents
   */
  private async executeProject(projectId: string, tasks: ProjectTask[]): Promise<string> {
    log.info(`⚡ Executing project with ${tasks.length} tasks...`, LogContext.PROJECT);
    
    const projectState: ProjectState = {
      id: projectId,
      tasks,
      startTime: new Date(),
      status: 'in_progress',
      progress: {
        totalTasks: tasks.length,
        completedTasks: 0,
        inProgressTasks: 0,
        completionPercentage: 0,
        estimatedTimeRemaining: tasks.reduce((sum, t) => sum + t.estimatedTime, 0),
        currentPhase: 'Initialization'
      }
    };

    this.activeProjects.set(projectId, projectState);

    // Execute tasks in dependency order
    const executedTasks: string[] = [];
    
    while (executedTasks.length < tasks.length) {
      // Find tasks that can be executed (dependencies satisfied)
      const readyTasks = tasks.filter(task => 
        task.status === 'pending' && 
        task.dependencies.every(dep => executedTasks.includes(dep))
      );

      if (readyTasks.length === 0) {
        // Check for circular dependencies
        const pendingTasks = tasks.filter(t => t.status === 'pending');
        if (pendingTasks.length > 0 && pendingTasks[0]) {
          log.warn('🔄 Circular dependency detected, executing remaining tasks', LogContext.PROJECT);
          readyTasks.push(pendingTasks[0]);
        } else {
          break;
        }
      }

      // Execute ready tasks
      for (const task of readyTasks) {
        await this.executeTask(task);
        executedTasks.push(task.id);
        
        // Update progress
        projectState.progress.completedTasks++;
        projectState.progress.completionPercentage = 
          Math.round((projectState.progress.completedTasks / projectState.progress.totalTasks) * 100);
        
        this.emit('taskCompleted', task, projectState.progress);
        log.info(`✅ Task completed: ${task.name} (${projectState.progress.completionPercentage}%)`, LogContext.PROJECT);
      }
    }

    projectState.status = 'completed';
    projectState.endTime = new Date();
    
    const duration = projectState.endTime.getTime() - projectState.startTime.getTime();
    log.info(`🎉 Project completed in ${Math.round(duration / 1000)}s`, LogContext.PROJECT);
    
    this.emit('projectCompleted', projectId, projectState);
    return `Project ${projectId} completed successfully with ${projectState.progress.completedTasks} tasks`;
  }

  /**
   * Execute a single task using the appropriate agent
   */
  private async executeTask(task: ProjectTask): Promise<void> {
    log.info(`🔨 Executing task: ${task.name}`, LogContext.PROJECT);
    
    task.status = 'in_progress';
    
    try {
      const agent = await this.agentRegistry.getAgent(task.assignedAgent || 'planner');
      if (!agent) {
        throw new Error(`Agent ${task.assignedAgent} not available`);
      }

      const context = {
        requestId: this.generateRequestId(),
        userRequest: `Complete this task: ${task.name}. Description: ${task.description}`,
        taskId: task.id,
        taskName: task.name,
        taskDescription: task.description
      };

      const result = await agent.execute(context);
      
      if (result.success) {
        task.status = 'completed';
        task.completedAt = new Date();
      } else {
        task.status = 'failed';
        log.error(`❌ Task failed: ${task.name}`, LogContext.PROJECT, { error: result.message });
      }
      
    } catch (error) {
      task.status = 'failed';
      log.error(`❌ Task execution error: ${task.name}`, LogContext.PROJECT, { error });
    }
  }

  /**
   * Get current progress for a project
   */
  getProjectProgress(projectId: string): ProjectProgress | null {
    const project = this.activeProjects.get(projectId);
    return project?.progress || null;
  }

  /**
   * Get all active projects
   */
  getActiveProjects(): ProjectState[] {
    return Array.from(this.activeProjects.values());
  }

  // Utility methods
  private generateProjectId(projectName: string): string {
    return `project_${projectName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getProjectStats(projectPath: string): Promise<{ files: string[], directories: string[] }> {
    const files: string[] = [];
    const directories: string[] = [];

    try {
      const scan = async (dir: string) => {
        const items = await fs.readdir(dir);
        for (const item of items) {
          const itemPath = path.join(dir, item);
          const stat = await fs.stat(itemPath);
          
          if (stat.isDirectory()) {
            directories.push(itemPath);
            if (!item.startsWith('.') && item !== 'node_modules') {
              await scan(itemPath);
            }
          } else {
            files.push(itemPath);
          }
        }
      };

      await scan(projectPath);
    } catch (error) {
      log.warn(`⚠️ Could not scan project directory: ${projectPath}`, LogContext.PROJECT);
    }

    return { files, directories };
  }

  private async detectProjectType(projectPath: string): Promise<string> {
    const files: string[] = await fs.readdir(projectPath).catch(() => [] as string[]);
    
    if (files.includes('package.json')) return 'nodejs';
    if (files.includes('requirements.txt') || files.includes('setup.py')) return 'python';
    if (files.includes('Cargo.toml')) return 'rust';
    if (files.includes('go.mod')) return 'go';
    if (files.includes('pom.xml') || files.includes('build.gradle')) return 'java';
    if (files.includes('pubspec.yaml')) return 'flutter';
    
    return 'unknown';
  }

  private selectBestAgent(componentType: string): string {
    const agentMap: Record<string, string> = {
      'frontend': 'code_assistant',
      'backend': 'code_assistant', 
      'api': 'code_assistant',
      'database': 'code_assistant',
      'ui': 'code_assistant',
      'component': 'code_assistant',
      'service': 'code_assistant',
      'util': 'code_assistant',
      'test': 'code_assistant',
      'config': 'planner',
      'documentation': 'synthesizer'
    };

    return agentMap[componentType] || 'planner';
  }
}

// Supporting interfaces
interface ProjectAnalysis {
  projectPath: string;
  projectName: string;
  projectType: string;
  existingFiles: string[];
  missingComponents: Array<{
    name: string;
    type: string;
    description?: string;
    dependencies?: string[];
    estimatedHours?: number;
  }>;
  complexity: 'low' | 'medium' | 'high';
  estimatedHours: number;
}

interface ProjectState {
  id: string;
  tasks: ProjectTask[];
  startTime: Date;
  endTime?: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: ProjectProgress;
}

// ProjectCompletionModule already exported above