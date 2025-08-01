/**
 * Project-Aware AB-MCTS Service
 * Extends the core AB-MCTS with project context understanding and task coordination
 */

import { ABMCTSService } from './ab-mcts-service';
import type { 
  ABMCTSAction, 
  ABMCTSConfig, 
  ABMCTSNode, 
  ABMCTSReward,
  AgentContext 
} from '@/types/ab-mcts';
import type { 
  Project, 
  ProjectTask
} from './project-orchestrator';
import { ProjectType, TaskPriority, TaskType } from './project-orchestrator';
import { LogContext, log } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface ProjectAwareContext extends AgentContext {
  project?: {
    id: string;
    name: string;
    type: ProjectType;
    phase: string;
    constraints: {
      complexity: string;
      quality: string;
      timeframe?: string;
    };
  };
  task?: {
    id: string;
    name: string;
    type: TaskType;
    priority: TaskPriority;
    dependencies: string[];
    requiredCapabilities: string[];
  };
  taskContext?: {
    relatedTasks: string[];
    projectProgress: number;
    availableResources: string[];
    previousDecisions: ProjectDecision[];
  };
}

export interface ProjectDecision {
  taskId: string;
  agentUsed: string;
  decision: string;
  outcome: 'success' | 'failure' | 'partial';
  confidence: number;
  timestamp: number;
  learnedPatterns: string[];
}

export interface ProjectMCTSConfig extends ABMCTSConfig {
  // Project-specific parameters
  projectTypeWeight: number; // Weight project type in selection
  taskPriorityWeight: number; // Weight task priority in rewards
  dependencyAwareness: boolean; // Consider task dependencies
  crossTaskLearning: boolean; // Learn from other tasks in project
  projectMemorySize: number; // Max decisions to remember per project
}

export interface ProjectTaskCoordination {
  projectId: string;
  taskId: string;
  coordinationStrategy: 'sequential' | 'parallel' | 'hybrid';
  resourceAllocation: Map<string, number>; // agent -> allocation percentage
  expectedInteractions: TaskInteraction[];
  riskAssessment: {
    probability: number;
    impact: string;
    mitigation: string;
  }[];
}

export interface TaskInteraction {
  fromTask: string;
  toTask: string;
  interactionType: 'data_dependency' | 'resource_sharing' | 'synchronization';
  strength: number; // 0-1
  timing: 'before' | 'during' | 'after';
}

export class ProjectAwareABMCTSService extends ABMCTSService {
  private projectConfigs: Map<string, ProjectMCTSConfig> = new Map();
  private projectDecisions: Map<string, ProjectDecision[]> = new Map();
  private taskCoordinations: Map<string, ProjectTaskCoordination> = new Map();
  private crossProjectLearning: Map<ProjectType, Map<TaskType, AgentPerformanceProfile>> = new Map();

  constructor(config: Partial<ProjectMCTSConfig> = {}) {
    const projectConfig: ProjectMCTSConfig = {
      maxIterations: 1000,
      maxDepth: 10,
      explorationConstant: Math.sqrt(2),
      discountFactor: 0.95,
      priorAlpha: 1,
      priorBeta: 1,
      maxBudget: 10000,
      timeLimit: 30000,
      parallelism: 4,
      learningRate: 0.1,
      updateFrequency: 10,
      minSamplesForUpdate: 3,
      pruneThreshold: 0.1,
      cacheSize: 10000,
      checkpointInterval: 100,
      // Project-specific defaults
      projectTypeWeight: 0.3,
      taskPriorityWeight: 0.4,
      dependencyAwareness: true,
      crossTaskLearning: true,
      projectMemorySize: 100,
      ...config
    };

    super(projectConfig);
    this.initializeCrossProjectLearning();
  }

  /**
   * Initialize cross-project learning patterns
   */
  private initializeCrossProjectLearning(): void {
    for (const projectType of Object.values(ProjectType)) {
      const taskTypeMap = new Map<TaskType, AgentPerformanceProfile>();
      for (const taskType of Object.values(TaskType)) {
        taskTypeMap.set(taskType, {
          bestAgents: [],
          averageTime: 5000,
          successRate: 0.8,
          qualityScore: 0.75,
          commonPatterns: [],
          lastUpdated: Date.now()
        });
      }
      this.crossProjectLearning.set(projectType, taskTypeMap);
    }
  }

  /**
   * Enhanced orchestration with project awareness
   */
  async orchestrateProject(options: {
    project: Project;
    task: ProjectTask;
    agents: string[];
    explorationRate?: number;
    maxIterations?: number;
    context?: Record<string, any>;
  }): Promise<{
    bestAgent: string;
    expectedQuality: number;
    estimatedTime: number;
    coordination: ProjectTaskCoordination;
    reasoning: string;
    alternativeStrategies: Array<{
      agent: string;
      score: number;
      reasoning: string;
    }>;
  }> {
    log.info('🧠 Starting project-aware AB-MCTS orchestration', LogContext.PROJECT, {
      projectId: options.project.id,
      taskId: options.task.id,
      taskType: options.task.type,
      priority: options.task.priority,
      agentCount: options.agents.length
    });

    // Build project-aware context
    const projectContext: ProjectAwareContext = {
      userRequest: `Execute project task: ${options.task.name}`,
      requestId: `project_${options.project.id}_task_${options.task.id}_${Date.now()}`,
      workingDirectory: options.project.context.workingDirectory || process.cwd(),
      userId: 'project_system',
      project: {
        id: options.project.id,
        name: options.project.specification.name,
        type: options.project.specification.type,
        phase: options.project.progress.currentPhase,
        constraints: {
          complexity: options.project.specification.constraints.complexity,
          quality: options.project.specification.constraints.quality,
          timeframe: options.project.specification.constraints.timeframe
        }
      },
      task: {
        id: options.task.id,
        name: options.task.name,
        type: options.task.type,
        priority: options.task.priority,
        dependencies: options.task.dependencies,
        requiredCapabilities: options.task.requiredCapabilities
      },
      taskContext: {
        relatedTasks: this.findRelatedTasks(options.project, options.task),
        projectProgress: options.project.progress.overallCompletion,
        availableResources: options.project.context.externalResources,
        previousDecisions: this.getProjectDecisions(options.project.id)
      },
      ...options.context
    };

    // Get project-specific configuration
    const projectConfig = this.getProjectConfig(options.project);

    // Execute enhanced search with project awareness
    const searchResult = await this.search(
      projectContext, 
      options.agents,
      {
        useCache: true,
        enableParallelism: true,
        collectFeedback: true,
        verboseLogging: true
      }
    );

    // Analyze results with project context
    const analysis = await this.analyzeProjectResults(
      searchResult,
      options.project,
      options.task,
      projectConfig
    );

    // Create task coordination plan
    const coordination = await this.createTaskCoordination(
      options.project,
      options.task,
      analysis.bestAgent,
      options.agents
    );

    // Update cross-project learning
    await this.updateCrossProjectLearning(
      options.project.specification.type,
      options.task.type,
      analysis.bestAgent,
      analysis.expectedQuality
    );

    log.info('✅ Project-aware orchestration completed', LogContext.PROJECT, {
      projectId: options.project.id,
      taskId: options.task.id,
      selectedAgent: analysis.bestAgent,
      expectedQuality: analysis.expectedQuality,
      coordinationStrategy: coordination.coordinationStrategy
    });

    return {
      bestAgent: analysis.bestAgent,
      expectedQuality: analysis.expectedQuality,
      estimatedTime: analysis.estimatedTime,
      coordination,
      reasoning: analysis.reasoning,
      alternativeStrategies: analysis.alternatives
    };
  }

  /**
   * Find related tasks within the project for context
   */
  private findRelatedTasks(project: Project, currentTask: ProjectTask): string[] {
    return project.tasks
      .filter(task => 
        task.id !== currentTask.id && (
          // Same type
          task.type === currentTask.type ||
          // Dependent tasks
          task.dependencies.includes(currentTask.id) ||
          currentTask.dependencies.includes(task.id) ||
          // Same capabilities
          task.requiredCapabilities.some(cap => 
            currentTask.requiredCapabilities.includes(cap)
          )
        )
      )
      .map(task => task.id);
  }

  /**
   * Get project-specific MCTS configuration
   */
  private getProjectConfig(project: Project): ProjectMCTSConfig {
    if (this.projectConfigs.has(project.id)) {
      return this.projectConfigs.get(project.id)!;
    }

    // Create project-specific config based on project characteristics
    const baseConfig = this.config as ProjectMCTSConfig;
    const projectConfig: ProjectMCTSConfig = {
      ...baseConfig,
      // Adjust parameters based on project type
      maxIterations: this.getIterationsForProjectType(project.specification.type),
      explorationConstant: this.getExplorationForComplexity(project.specification.constraints.complexity),
      taskPriorityWeight: project.specification.constraints.quality === 'enterprise' ? 0.6 : 0.4,
      timeLimit: project.specification.constraints.timeframe ? 
        this.parseTimeframe(project.specification.constraints.timeframe) : baseConfig.timeLimit
    };

    this.projectConfigs.set(project.id, projectConfig);
    return projectConfig;
  }

  /**
   * Analyze AB-MCTS results with project context
   */
  private async analyzeProjectResults(
    searchResult: any,
    project: Project,
    task: ProjectTask,
    config: ProjectMCTSConfig
  ): Promise<{
    bestAgent: string;
    expectedQuality: number;
    estimatedTime: number;
    reasoning: string;
    alternatives: Array<{ agent: string; score: number; reasoning: string; }>;
  }> {
    // Get learned patterns for this project type and task type
    const learnedPatterns = this.crossProjectLearning
      .get(project.specification.type)
      ?.get(task.type);

    // Calculate scores for each agent considering project context
    const agentScores = new Map<string, number>();
    const alternatives: Array<{ agent: string; score: number; reasoning: string; }> = [];

    if (searchResult.bestPath && searchResult.bestPath.length > 0) {
      // Analyze the search tree results
      for (const node of searchResult.bestPath) {
        if (node.metadata?.agent) {
          const score = this.calculateProjectAwareScore(
            node,
            task,
            project,
            learnedPatterns,
            config
          );
          agentScores.set(node.metadata.agent, score);
          
          alternatives.push({
            agent: node.metadata.agent,
            score,
            reasoning: this.generateAgentReasoning(node, task, project, score)
          });
        }
      }
    }

    // Select best agent based on project-aware scoring
    const bestEntry = Array.from(agentScores.entries())
      .sort(([,a], [,b]) => b - a)[0];

    const bestAgent = bestEntry ? bestEntry[0] : 'personal_assistant'; // fallback
    const expectedQuality = bestEntry ? bestEntry[1] : 0.7;

    // Estimate time based on learned patterns and task complexity
    const estimatedTime = this.estimateTaskTime(task, bestAgent, learnedPatterns);

    const reasoning = this.generateProjectReasoning(
      bestAgent, 
      task, 
      project, 
      expectedQuality,
      learnedPatterns
    );

    return {
      bestAgent,
      expectedQuality,
      estimatedTime,
      reasoning,
      alternatives: alternatives.sort((a, b) => b.score - a.score).slice(0, 3)
    };
  }

  /**
   * Calculate project-aware score for agent selection
   */
  private calculateProjectAwareScore(
    node: ABMCTSNode,
    task: ProjectTask,
    project: Project,
    learnedPatterns: AgentPerformanceProfile | undefined,
    config: ProjectMCTSConfig
  ): number {
    let score = node.averageReward * 0.4; // Base AB-MCTS score

    // Project type alignment
    const projectTypeBonus = this.getProjectTypeAlignment(
      node.metadata.agent!,
      project.specification.type
    );
    score += projectTypeBonus * config.projectTypeWeight;

    // Task priority weighting
    const priorityMultiplier = this.getPriorityMultiplier(task.priority);
    score *= priorityMultiplier * config.taskPriorityWeight + (1 - config.taskPriorityWeight);

    // Learned pattern bonus
    if (learnedPatterns && learnedPatterns.bestAgents.includes(node.metadata.agent!)) {
      const patternBonus = learnedPatterns.successRate * learnedPatterns.qualityScore;
      score += patternBonus * 0.2;
    }

    // Capability alignment
    const capabilityAlignment = this.calculateCapabilityAlignment(
      node.metadata.agent!,
      task.requiredCapabilities
    );
    score += capabilityAlignment * 0.3;

    // Dependency awareness bonus
    if (config.dependencyAwareness && task.dependencies.length > 0) {
      const dependencyBonus = this.calculateDependencyBonus(
        node.metadata.agent!,
        task,
        project
      );
      score += dependencyBonus * 0.15;
    }
    return undefined;
    return undefined;

    return Math.min(1.0, Math.max(0.0, score));
  }

  /**
   * Create task coordination plan
   */
  private async createTaskCoordination(
    project: Project,
    task: ProjectTask,
    selectedAgent: string,
    availableAgents: string[]
  ): Promise<ProjectTaskCoordination> {
    const coordinationId = `coord_${project.id}_${task.id}`;

    // Determine coordination strategy based on task characteristics
    let strategy: 'sequential' | 'parallel' | 'hybrid' = 'sequential';
    
    if (task.requiredCapabilities.length > 2) {
      strategy = 'parallel'; // Multi-capability tasks benefit from parallel execution
    } else if (task.dependencies.length > 1) {
      strategy = 'hybrid'; // Complex dependencies need hybrid approach
    }

    // Calculate resource allocation
    const resourceAllocation = new Map<string, number>();
    resourceAllocation.set(selectedAgent, 0.7); // Primary agent gets 70%
    
    const supportingAgents = availableAgents
      .filter(agent => agent !== selectedAgent)
      .slice(0, 2); // Max 2 supporting agents
    
    supportingAgents.forEach((agent, index) => {
      resourceAllocation.set(agent, 0.15 * (index + 1)); // 15% each for supporting
    });

    // Identify task interactions
    const interactions = this.identifyTaskInteractions(project, task);

    // Assess risks
    const risks = this.assessTaskRisks(task, project, selectedAgent);

    const coordination: ProjectTaskCoordination = {
      projectId: project.id,
      taskId: task.id,
      coordinationStrategy: strategy,
      resourceAllocation,
      expectedInteractions: interactions,
      riskAssessment: risks
    };

    this.taskCoordinations.set(coordinationId, coordination);
    return coordination;
  }

  /**
   * Update cross-project learning patterns
   */
  private async updateCrossProjectLearning(
    projectType: ProjectType,
    taskType: TaskType,
    selectedAgent: string,
    expectedQuality: number
  ): Promise<void> {
    const patterns = this.crossProjectLearning.get(projectType)?.get(taskType);
    if (!patterns) return;

    // Update best agents list
    if (!patterns.bestAgents.includes(selectedAgent)) {
      patterns.bestAgents.push(selectedAgent);
      // Keep only top 5 agents
      patterns.bestAgents = patterns.bestAgents.slice(0, 5);
    }

    // Update quality score with exponential moving average
    const alpha = 0.1;
    patterns.qualityScore = patterns.qualityScore * (1 - alpha) + expectedQuality * alpha;
    patterns.lastUpdated = Date.now();

    log.info('📚 Updated cross-project learning patterns', LogContext.PROJECT, {
      projectType,
      taskType,
      selectedAgent,
      newQualityScore: patterns.qualityScore,
      bestAgents: patterns.bestAgents
    });
  }

  // Helper methods for scoring and analysis
  
  private getIterationsForProjectType(type: ProjectType): number {
    const iterations = {
      [ProjectType.PHOTO_ORGANIZATION]: 500,
      [ProjectType.SOFTWARE_DEVELOPMENT]: 1500,
      [ProjectType.DATA_ANALYSIS]: 1000,
      [ProjectType.CONTENT_CREATION]: 750,
      [ProjectType.AUTOMATION]: 1200,
      [ProjectType.RESEARCH]: 2000,
      [ProjectType.CUSTOM]: 1000
    };
    return iterations[type] || 1000;
  }

  private getExplorationForComplexity(complexity: string): number {
    const exploration = {
      'simple': 1.0,
      'moderate': 1.4,
      'complex': 1.8,
      'enterprise': 2.2
    };
    return exploration[complexity] || 1.4;
  }

  private parseTimeframe(timeframe: string): number {
    // Simple parsing - in production this would be more sophisticated
    if (timeframe.includes('minute')) return 60000;
    if (timeframe.includes('hour')) return 3600000;
    if (timeframe.includes('day')) return 86400000;
    return 30000; // Default 30 seconds
  }

  private getProjectTypeAlignment(agent: string, projectType: ProjectType): number {
    // Agent-project type alignment scores
    const alignments: Record<string, Record<ProjectType, number>> = {
      'code_assistant': {
        [ProjectType.SOFTWARE_DEVELOPMENT]: 0.9,
        [ProjectType.AUTOMATION]: 0.7,
        [ProjectType.DATA_ANALYSIS]: 0.6,
        [ProjectType.PHOTO_ORGANIZATION]: 0.3,
        [ProjectType.CONTENT_CREATION]: 0.4,
        [ProjectType.RESEARCH]: 0.5,
        [ProjectType.CUSTOM]: 0.5
      },
      'retriever': {
        [ProjectType.RESEARCH]: 0.9,
        [ProjectType.DATA_ANALYSIS]: 0.8,
        [ProjectType.CONTENT_CREATION]: 0.7,
        [ProjectType.SOFTWARE_DEVELOPMENT]: 0.6,
        [ProjectType.PHOTO_ORGANIZATION]: 0.5,
        [ProjectType.AUTOMATION]: 0.6,
        [ProjectType.CUSTOM]: 0.6
      },
      'planner': {
        [ProjectType.SOFTWARE_DEVELOPMENT]: 0.8,
        [ProjectType.AUTOMATION]: 0.9,
        [ProjectType.RESEARCH]: 0.7,
        [ProjectType.DATA_ANALYSIS]: 0.7,
        [ProjectType.CONTENT_CREATION]: 0.6,
        [ProjectType.PHOTO_ORGANIZATION]: 0.6,
        [ProjectType.CUSTOM]: 0.8
      }
    };

    return alignments[agent]?.[projectType] || 0.5;
  }

  private getPriorityMultiplier(priority: TaskPriority): number {
    const multipliers = {
      [TaskPriority.LOW]: 0.8,
      [TaskPriority.MEDIUM]: 1.0,
      [TaskPriority.HIGH]: 1.3,
      [TaskPriority.CRITICAL]: 1.6
    };
    return multipliers[priority] || 1.0;
  }

  private calculateCapabilityAlignment(agent: string, capabilities: string[]): number {
    // This would be more sophisticated in production
    const agentCapabilities: Record<string, string[]> = {
      'code_assistant': ['code_generation', 'code_analysis', 'refactoring', 'debugging'],
      'retriever': ['information_retrieval', 'context_gathering', 'search', 'research'],
      'planner': ['planning', 'task_decomposition', 'strategy', 'coordination'],
      'synthesizer': ['synthesis', 'consensus', 'analysis', 'integration'],
      'personal_assistant': ['assistance', 'coordination', 'task_management', 'communication']
    };

    const agentCaps = agentCapabilities[agent] || [];
    const matches = capabilities.filter(cap => agentCaps.includes(cap)).length;
    return matches / Math.max(capabilities.length, 1);
  }

  private calculateDependencyBonus(agent: string, task: ProjectTask, project: Project): number {
    // Bonus for agents that have successfully handled dependent tasks
    const decisions = this.getProjectDecisions(project.id);
    const dependentDecisions = decisions.filter(d => 
      task.dependencies.includes(d.taskId) && d.agentUsed === agent && d.outcome === 'success'
    );
    
    return Math.min(0.2, dependentDecisions.length * 0.05);
  }

  private identifyTaskInteractions(project: Project, task: ProjectTask): TaskInteraction[] {
    const interactions: TaskInteraction[] = [];
    
    // Find interactions with dependent tasks
    task.dependencies.forEach(depId => {
      interactions.push({
        fromTask: depId,
        toTask: task.id,
        interactionType: 'data_dependency',
        strength: 0.8,
        timing: 'before'
      });
    });

    // Find resource sharing with similar tasks
    project.tasks
      .filter(t => t.id !== task.id && 
        t.requiredCapabilities.some(cap => task.requiredCapabilities.includes(cap)))
      .forEach(relatedTask => {
        interactions.push({
          fromTask: task.id,
          toTask: relatedTask.id,
          interactionType: 'resource_sharing',
          strength: 0.5,
          timing: 'during'
        });
      });

    return interactions;
  }

  private assessTaskRisks(task: ProjectTask, project: Project, agent: string): Array<{
    probability: number;
    impact: string;
    mitigation: string;
  }> {
    const risks = [];

    // Dependency risk
    if (task.dependencies.length > 2) {
      risks.push({
        probability: 0.3,
        impact: 'Task may be delayed due to dependency chain',
        mitigation: 'Monitor dependent tasks closely and prepare fallback options'
      });
    }

    // Complexity risk
    if (task.requiredCapabilities.length > 3) {
      risks.push({
        probability: 0.4,
        impact: 'High complexity may lead to quality issues',
        mitigation: 'Use multiple agents in coordination for validation'
      });
    }

    // Agent mismatch risk
    const alignment = this.getProjectTypeAlignment(agent, project.specification.type);
    if (alignment < 0.6) {
      risks.push({
        probability: 0.25,
        impact: 'Agent may not be optimal for this project type',
        mitigation: 'Consider using supporting agents with better alignment'
      });
    }

    return risks;
  }

  private estimateTaskTime(
    task: ProjectTask, 
    agent: string, 
    patterns: AgentPerformanceProfile | undefined
  ): number {
    let baseTime = task.estimatedDuration || 5000;
    
    // Adjust based on learned patterns
    if (patterns) {
      baseTime = patterns.averageTime;
    }
    return undefined;
    return undefined;

    // Adjust based on task complexity
    const complexityMultiplier = {
      [TaskPriority.LOW]: 0.8,
      [TaskPriority.MEDIUM]: 1.0,
      [TaskPriority.HIGH]: 1.3,
      [TaskPriority.CRITICAL]: 1.5
    }[task.priority] || 1.0;

    return Math.round(baseTime * complexityMultiplier);
  }

  private generateAgentReasoning(
    node: ABMCTSNode, 
    task: ProjectTask, 
    project: Project, 
    score: number
  ): string {
    const quality = score > 0.8 ? 'excellent' : score > 0.6 ? 'good' : 'moderate';
    return `Agent ${node.metadata.agent} scored ${score.toFixed(2)} (${quality}) for ${task.type} task in ${project.specification.type} project. ` +
           `Factors: capability alignment, project type fit, learned patterns from similar tasks.`;
  }

  private generateProjectReasoning(
    agent: string,
    task: ProjectTask,
    project: Project,
    quality: number,
    patterns: AgentPerformanceProfile | undefined
  ): string {
    let reasoning = `Selected ${agent} for task "${task.name}" in ${project.specification.type} project. `;
    reasoning += `Expected quality: ${(quality * 100).toFixed(1)}%. `;
    
    if (patterns && patterns.bestAgents.includes(agent)) {
      reasoning += `Agent has proven performance in similar ${task.type} tasks. `;
    }
    
    if (task.priority === TaskPriority.CRITICAL) {
      reasoning += `High priority task requires reliable agent with strong track record. `;
    }
    
    return undefined;
    
    return undefined;
    
    return reasoning;
  }

  private getProjectDecisions(projectId: string): ProjectDecision[] {
    return this.projectDecisions.get(projectId) || [];
  }

  /**
   * Record a project decision for learning
   */
  recordProjectDecision(decision: ProjectDecision): void {
    const projectId = decision.taskId.split('_')[0]; // Extract project ID from task ID
    const decisions = this.getProjectDecisions(projectId);
    decisions.push(decision);
    
    // Keep only recent decisions
    const maxDecisions = (this.config as ProjectMCTSConfig).projectMemorySize || 100;
    if (decisions.length > maxDecisions) {
      decisions.splice(0, decisions.length - maxDecisions);
    }
    return undefined;
    return undefined;
    
    this.projectDecisions.set(projectId, decisions);
  }
}

interface AgentPerformanceProfile {
  bestAgents: string[];
  averageTime: number;
  successRate: number;
  qualityScore: number;
  commonPatterns: string[];
  lastUpdated: number;
}

// Export singleton
export let projectAwareABMCTS: ProjectAwareABMCTSService | null = null;

export function createProjectAwareABMCTS(config?: Partial<ProjectMCTSConfig>): ProjectAwareABMCTSService {
  projectAwareABMCTS = new ProjectAwareABMCTSService(config);
  return projectAwareABMCTS;
}