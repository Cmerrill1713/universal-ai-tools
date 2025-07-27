/**
 * Alpha Evolve Coordinator Service
 * Manages evolution across multiple agents and coordinates learning
 */

import { EventEmitter } from 'events';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AlphaEvolveSystem } from '../core/evolution/alpha-evolve-system.js';
import { EvolvedFileManagerAgent } from '../agents/evolved/evolved-file-manager-agent.js';
import type { BaseAgent } from '../agents/base_agent.js';

interface EvolutionTask {
  id: string;
  agentId: string;
  taskType: string;
  priority: number;
  context: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  performance?: number;
  timestamp: Date;
}

interface AgentEvolution {
  agentId: string;
  evolveSystem: AlphaEvolveSystem;
  agent: BaseAgent;
  evolutionMetrics: {
    tasksProcessed: number;
    averagePerformance: number;
    evolutionCycles: number;
    lastEvolved: Date;
  };
}

interface CrossAgentLearning {
  sourceAgent: string;
  targetAgent: string;
  knowledge: any;
  transferSuccess: boolean;
  improvement: number;
  timestamp: Date;
}

export class AlphaEvolveCoordinator extends EventEmitter {
  private supabase: SupabaseClient;
  private evolvingAgents: Map<string, AgentEvolution> = new Map();
  private taskQueue: EvolutionTask[] = [];
  private crossLearningHistory: CrossAgentLearning[] = [];
  private isProcessing = false;
  private globalEvolutionMetrics: any;
  private logger: any;

  constructor(supabase: SupabaseClient) {
    super();
    this.supabase = supabase;
    this.logger = console;
    this.globalEvolutionMetrics = {
      totalTasks: 0,
      successfulTasks: 0,
      totalEvolutions: 0,
      crossLearningEvents: 0,
      startTime: new Date(),
    };
    this.initialize();
  }

  /**
   * Initialize the coordinator
   */
  private async initialize(): Promise<void> {
    try {
      // Initialize evolved file manager
      await this.registerEvolvedAgent('file_manager', new EvolvedFileManagerAgent(this.supabase));

      // Start task processing loop
      this.startTaskProcessor();

      // Start cross-agent learning cycle
      this.startCrossLearningCycle();

      // Start global evolution analysis
      this.startGlobalEvolutionAnalysis();

      this.logger.info('Alpha Evolve Coordinator initialized');
    } catch (_error) {
      this.logger.error'Failed to initialize coordinator:', _error;
    }
  }

  /**
   * Register an agent for evolution
   */
  async registerEvolvedAgent(agentId: string, agent: BaseAgent): Promise<void> {
    try {
      // Create evolution system for agent
      const evolveSystem = new AlphaEvolveSystem(this.supabase, {
        populationSize: 20,
        mutationRate: 0.15,
        crossoverRate: 0.75,
        adaptationThreshold: 0.6,
        learningRate: 0.025,
      });

      // Initialize agent
      await agent.initialize();

      // Store agent evolution data
      const agentEvolution: AgentEvolution = {
        agentId,
        evolveSystem,
        agent,
        evolutionMetrics: {
          tasksProcessed: 0,
          averagePerformance: 0.5,
          evolutionCycles: 0,
          lastEvolved: new Date(),
        },
      };

      this.evolvingAgents.set(agentId, agentEvolution);

      // Set up agent-specific listeners
      this.setupAgentListeners(agentEvolution);

      this.logger.info(`Registered evolved agent: ${agentId}`);
      this.emit('agent_registered', { agentId });
    } catch (_error) {
      this.logger.error`Failed to register agent ${agentId}:`, _error;
      throw _error;
    }
  }

  /**
   * Submit task for evolved processing
   */
  async submitTask(agentId: string, taskType: string, context: any, priority = 5): Promise<string> {
    const task: EvolutionTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      agentId,
      taskType,
      priority,
      context,
      status: 'pending',
      timestamp: new Date(),
    };

    this.taskQueue.push(task);
    this.taskQueue.sort((a, b) => b.priority - a.priority);

    this.emit('task_submitted', task);

    // Trigger immediate processing if not busy
    if (!this.isProcessing) {
      this.processNextTask();
    }

    return task.id;
  }

  /**
   * Get task status
   */
  async getTaskStatus(taskId: string): Promise<EvolutionTask | null> {
    const task = this.taskQueue.find((t) => t.id === taskId);
    if (task) return task;

    // Check completed tasks in database
    try {
      const { data } = await this.supabase
        .from('ai_file_operations')
        .select('*')
        .eq('id', taskId)
        .single();

      return data;
    } catch (_error) {
      return null;
    }
  }

  /**
   * Start task processing loop
   */
  private startTaskProcessor(): void {
    setInterval(() => {
      if (!this.isProcessing && this.taskQueue.length > 0) {
        this.processNextTask();
      }
    }, 100);
  }

  /**
   * Process next task in queue
   */
  private async processNextTask(): Promise<void> {
    if (this.isProcessing || this.taskQueue.length === 0) return;

    this.isProcessing = true;
    const task = this.taskQueue.find((t) => t.status === 'pending');

    if (!task) {
      this.isProcessing = false;
      return;
    }

    try {
      task.status = 'processing';
      this.emit('task_started', task);

      // Get agent evolution
      const agentEvolution = this.evolvingAgents.get(task.agentId);
      if (!agentEvolution) {
        throw new Error(`Agent ${task.agentId} not found`);
      }

      // Process task with evolved agent
      const startTime = Date.now();
      const result = await agentEvolution.agent.execute({
        requestId: task.id,
        userRequest: task.context._request|| '',
        timestamp: new Date(),
        ...task.context,
      });

      // Calculate performance
      const performance = this.calculateTaskPerformance(result, Date.now() - startTime);

      // Update task
      task.status = result.success ? 'completed' : 'failed';
      task.result = result;
      task.performance = performance;

      // Learn from task
      await agentEvolution.evolveSystem.learnFromPattern(task.taskType, task.context, {
        success: result.success,
        performance,
      });

      // Update agent metrics
      this.updateAgentMetrics(agentEvolution, performance);

      // Store task result
      await this.storeTaskResult(task);

      // Check for cross-agent learning opportunities
      await this.checkCrossLearningOpportunity(task, agentEvolution);

      this.emit('task_completed', task);
      this.globalEvolutionMetrics.totalTasks++;
      if (result.success) this.globalEvolutionMetrics.successfulTasks++;
    } catch (_error) {
      task.status = 'failed';
      task.result = { _error _errormessage };
      this.logger.error`Task ${task.id} failed:`, _error;
      this.emit('task_failed', { task, _error});
    } finally {
      // Remove from queue
      const index = this.taskQueue.indexOf(task);
      if (index > -1) {
        this.taskQueue.splice(index, 1);
      }
      this.isProcessing = false;
    }
  }

  /**
   * Setup listeners for agent evolution events
   */
  private setupAgentListeners(agentEvolution: AgentEvolution): void {
    const { evolveSystem, agentId } = agentEvolution;

    evolveSystem.on('pattern_learned', (data) => {
      this.emit('agent_pattern_learned', { agentId, ...data });
      this.checkPatternSharing(agentId, data._pattern;
    });

    evolveSystem.on('adaptation_applied', (data) => {
      this.emit('agent_adaptation', { agentId, ...data });
    });

    evolveSystem.on('evolution_completed', (metrics) => {
      agentEvolution.evolutionMetrics.evolutionCycles++;
      agentEvolution.evolutionMetrics.lastEvolved = new Date();
      this.globalEvolutionMetrics.totalEvolutions++;
      this.emit('agent_evolved', { agentId, metrics });
    });
  }

  /**
   * Start cross-agent learning cycle
   */
  private startCrossLearningCycle(): void {
    setInterval(async () => {
      await this.performCrossAgentLearning();
    }, 300000); // Every 5 minutes
  }

  /**
   * Perform cross-agent learning
   */
  private async performCrossAgentLearning(): Promise<void> {
    const agents = Array.from(this.evolvingAgents.entries());
    if (agents.length < 2) return;

    for (let i = 0; i < agents.length; i++) {
      for (let j = i + 1; j < agents.length; j++) {
        const [sourceId, sourceEvolution] = agents[i];
        const [targetId, targetEvolution] = agents[j];

        // Get best strategies from source
        const sourceStrategy = await sourceEvolution.evolveSystem.getBestStrategy();
        if (!sourceStrategy || sourceStrategy.genome.fitness < 0.7) continue;

        // Check if strategy could benefit target
        const compatibility = this.assessStrategyCompatibility(sourceStrategy, targetId);
        if (compatibility < 0.5) continue;

        // Transfer knowledge
        const transfer = await this.transferKnowledge(
          sourceEvolution,
          targetEvolution,
          sourceStrategy
        );

        if (transfer.success) {
          this.crossLearningHistory.push({
            sourceAgent: sourceId,
            targetAgent: targetId,
            knowledge: transfer.knowledge,
            transferSuccess: true,
            improvement: transfer.improvement,
            timestamp: new Date(),
          });

          this.globalEvolutionMetrics.crossLearningEvents++;
          this.emit('cross_learning_success', {
            source: sourceId,
            target: targetId,
            improvement: transfer.improvement,
          });
        }
      }
    }
  }

  /**
   * Start global evolution analysis
   */
  private startGlobalEvolutionAnalysis(): void {
    setInterval(async () => {
      await this.analyzeGlobalEvolution();
    }, 600000); // Every 10 minutes
  }

  /**
   * Analyze global evolution patterns
   */
  private async analyzeGlobalEvolution(): Promise<void> {
    const _analysis= {
      timestamp: new Date(),
      agentPerformance: new Map<string, any>(),
      globalPatterns: [],
      recommendations: [],
    };

    // Analyze each agent
    for (const [agentId, evolution] of this.evolvingAgents) {
      const status = await evolution.evolveSystem.getEvolutionStatus();
      const patterns = await evolution.evolveSystem.getPatternInsights();

      _analysisagentPerformance.set(agentId, {
        fitness: status.averageFitness,
        generation: status.generation,
        patterns: patterns.totalPatterns,
        performance: evolution.evolutionMetrics.averagePerformance,
      });
    }

    // Identify global patterns
    const globalPatterns = this.identifyGlobalPatterns();
    _analysisglobalPatterns = globalPatterns;

    // Generate recommendations
    _analysisrecommendations = this.generateEvolutionRecommendations(_analysis;

    // Store analysis
    await this.storeGlobalAnalysis(_analysis;

    this.emit('global_analysis_complete', _analysis;
  }

  /**
   * Helper methods
   */
  private calculateTaskPerformance(result: any, latency: number): number {
    let performance = 0;

    if (result.success) performance += 0.4;
    if (result.confidence > 0.8) performance += 0.2;
    if (latency < 1000) performance += 0.2;
    if (latency < 500) performance += 0.1;
    if (result.data && Object.keys(result.data).length > 0) performance += 0.1;

    return Math.min(1, performance);
  }

  private updateAgentMetrics(evolution: AgentEvolution, performance: number): void {
    const metrics = evolution.evolutionMetrics;
    metrics.tasksProcessed++;

    // Update average performance with exponential moving average
    const alpha = 0.1;
    metrics.averagePerformance = alpha * performance + (1 - alpha) * metrics.averagePerformance;
  }

  private async storeTaskResult(task: EvolutionTask): Promise<void> {
    try {
      await this.supabase.from('ai_file_operations').insert({
        id: task.id,
        operation_type: task.taskType,
        context: task.context,
        result: task.result,
        performance: {
          score: task.performance,
          status: task.status,
        },
        strategy_id: task.result?.metadata?.strategyUsed?.id,
        timestamp: task.timestamp,
      });
    } catch (_error) {
      this.logger.error'Failed to store task result:', _error;
    }
  }

  private async checkCrossLearningOpportunity(
    task: EvolutionTask,
    sourceEvolution: AgentEvolution
  ): Promise<void> {
    if (task.performance && task.performance > 0.8) {
      // High-performing task - check if other agents could benefit
      for (const [targetId, targetEvolution] of this.evolvingAgents) {
        if (targetId === task.agentId) continue;

        const similarity = this.calculateTaskSimilarity(task.taskType, targetId);
        if (similarity > 0.6) {
          // Similar task type - share learning
          await this.shareTaskLearning(task, sourceEvolution, targetEvolution);
        }
      }
    }
  }

  private async checkPatternSharing(agentId: string, ___pattern any): Promise<void> {
    if (_patternconfidence < 0.8) return;

    // Share high-confidence patterns with similar agents
    for (const [targetId, targetEvolution] of this.evolvingAgents) {
      if (targetId === agentId) continue;

      const relevance = this.assessPatternRelevance(_pattern targetId);
      if (relevance > 0.7) {
        await targetEvolution.evolveSystem.learnFromPattern(_pattern_pattern _patterncontext, {
          success: true,
          performance: _patternconfidence,
        });
      }
    }
  }

  private assessStrategyCompatibility(strategy: any, targetAgentId: string): number {
    // Simple compatibility check based on gene traits
    const targetAgent = this.evolvingAgents.get(targetAgentId);
    if (!targetAgent) return 0;

    // Check if strategy genes are relevant to target agent
    let relevantGenes = 0;
    for (const gene of strategy.genome.genes) {
      if (this.isGeneRelevantToAgent(gene, targetAgentId)) {
        relevantGenes++;
      }
    }

    return relevantGenes / strategy.genome.genes.length;
  }

  private async transferKnowledge(
    source: AgentEvolution,
    target: AgentEvolution,
    strategy: any
  ): Promise<unknown> {
    try {
      // Extract transferable knowledge
      const knowledge = {
        genes: strategy.genome.genes.filter((g) => this.isGeneRelevantToAgent(g, target.agentId)),
        performance: strategy.performance,
        mutations: strategy.mutations.filter((m) => m.beneficial),
      };

      // Measure target performance before transfer
      const beforePerformance = target.evolutionMetrics.averagePerformance;

      // Apply knowledge to target
      // This would integrate with the target's evolution system
      // For now, we'll simulate the transfer

      // Measure improvement
      const afterPerformance = beforePerformance * 1.1; // Simulated improvement
      const improvement = afterPerformance - beforePerformance;

      return {
        success: improvement > 0,
        knowledge,
        improvement,
      };
    } catch (_error) {
      this.logger.error'Knowledge transfer failed:', _error;
      return { success: false, improvement: 0 };
    }
  }

  private isGeneRelevantToAgent(gene: any, agentId: string): boolean {
    // Check if gene trait is relevant to agent type
    const agentSpecificTraits = {
      file_manager: ['organization_preference', 'search_recursion_depth', 'caching_behavior'],
      code_assistant: ['code_analysis_depth', 'refactoring_strategy', 'documentation_level'],
      photo_organizer: ['image__analysis, 'categorization_method', 'duplicate_detection'],
    };

    const relevantTraits = agentSpecificTraits[agentId] || [];
    return relevantTraits.includes(gene.trait) || gene.trait.includes('general');
  }

  private calculateTaskSimilarity(taskType: string, agentId: string): number {
    // Calculate similarity between task type and agent capabilities
    const agentTaskTypes = {
      file_manager: ['organize', 'search', 'duplicate', 'cleanup'],
      code_assistant: ['analyze', 'refactor', 'document', 'debug'],
      photo_organizer: ['categorize', 'tag', 'deduplicate', 'enhance'],
    };

    const agentTasks = agentTaskTypes[agentId] || [];
    return agentTasks.some((t) => taskType.includes(t)) ? 0.8 : 0.2;
  }

  private async shareTaskLearning(
    task: EvolutionTask,
    source: AgentEvolution,
    target: AgentEvolution
  ): Promise<void> {
    // Share successful task _patternwith target agent
    await target.evolveSystem.learnFromPattern(
      `shared_${task.taskType}`,
      {
        originalAgent: task.agentId,
        taskContext: task.context,
        performance: task.performance,
      },
      {
        success: true,
        performance: task.performance * 0.8, // Slightly reduced for transfer
      }
    );
  }

  private assessPatternRelevance(___pattern any, agentId: string): number {
    // Assess how relevant a _patternis to a specific agent
    const agentPatterns = {
      file_manager: ['file', 'organize', 'duplicate', 'search'],
      code_assistant: ['code', 'analyze', 'refactor', 'syntax'],
      photo_organizer: ['image', 'photo', 'visual', 'metadata'],
    };

    const relevantTerms = agentPatterns[agentId] || [];
    const patternStr = JSON.stringify(_pattern.toLowerCase();

    let matches = 0;
    for (const term of relevantTerms) {
      if (patternStr.includes(term)) matches++;
    }

    return matches / relevantTerms.length;
  }

  private identifyGlobalPatterns(): any[] {
    const patterns = [];

    // Pattern 1: Performance trends
    const performanceTrend = this.analyzePerformanceTrends();
    if (performanceTrend.significant) {
      patterns.push({
        type: 'performance_trend',
        direction: performanceTrend.direction,
        agents: performanceTrend.agents,
      });
    }

    // Pattern 2: Cross-learning effectiveness
    const crossLearningSuccess = this.analyzeCrossLearning();
    if (crossLearningSuccess.rate > 0.7) {
      patterns.push({
        type: 'effective_cross_learning',
        successRate: crossLearningSuccess.rate,
        bestPairs: crossLearningSuccess.pairs,
      });
    }

    // Pattern 3: Task type specialization
    const specialization = this.analyzeTaskSpecialization();
    patterns.push(...specialization);

    return patterns;
  }

  private analyzePerformanceTrends(): any {
    let improving = 0;
    const declining = 0;
    const agents = [];

    for (const [agentId, evolution] of this.evolvingAgents) {
      const trend = evolution.evolutionMetrics.averagePerformance > 0.6 ? 'improving' : 'stable';
      if (trend === 'improving') improving++;
      agents.push({ agentId, trend });
    }

    return {
      significant: improving > this.evolvingAgents.size / 2,
      direction: improving > declining ? 'improving' : 'stable',
      agents,
    };
  }

  private analyzeCrossLearning(): any {
    const recentTransfers = this.crossLearningHistory.filter(
      (t) => Date.now() - t.timestamp.getTime() < 3600000 // Last hour
    );

    const successfulTransfers = recentTransfers.filter((t) => t.transferSuccess);
    const rate =
      recentTransfers.length > 0 ? successfulTransfers.length / recentTransfers.length : 0;

    const pairCounts = new Map<string, number>();
    for (const transfer of successfulTransfers) {
      const pair = `${transfer.sourceAgent}-${transfer.targetAgent}`;
      pairCounts.set(pair, (pairCounts.get(pair) || 0) + 1);
    }

    const bestPairs = Array.from(pairCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([pair]) => pair);

    return { rate, pairs: bestPairs };
  }

  private analyzeTaskSpecialization(): any[] {
    const specializations = [];

    for (const [agentId, evolution] of this.evolvingAgents) {
      if (evolution.evolutionMetrics.averagePerformance > 0.8) {
        specializations.push({
          type: 'agent_specialization',
          agentId,
          performance: evolution.evolutionMetrics.averagePerformance,
          tasksProcessed: evolution.evolutionMetrics.tasksProcessed,
        });
      }
    }

    return specializations;
  }

  private generateEvolutionRecommendations(_analysis any): string[] {
    const recommendations = [];

    // Check overall performance
    const avgPerformance =
      Array.from(_analysisagentPerformance.values()).reduce((sum, p) => sum + p.performance, 0) /
      _analysisagentPerformance.size;

    if (avgPerformance < 0.6) {
      recommendations.push('Consider increasing mutation rate to explore more strategies');
    }

    if (avgPerformance > 0.85) {
      recommendations.push(
        'System performing well - consider reducing evolution frequency to save resources'
      );
    }

    // Check cross-learning
    if (this.crossLearningHistory.length < 10) {
      recommendations.push('Enable more cross-agent learning to share successful strategies');
    }

    // Check for stagnant agents
    for (const [agentId, perf] of _analysisagentPerformance) {
      if (perf.generation > 50 && perf.fitness < 0.5) {
        recommendations.push(`Agent ${agentId} may need architecture revision`);
      }
    }

    return recommendations;
  }

  private async storeGlobalAnalysis(_analysis any): Promise<void> {
    try {
      await this.supabase.from('ai_evolution_history').insert({
        generation_id: `global_${Date.now()}`,
        fitness_score: this.calculateGlobalFitness(_analysis,
        success_rate:
          this.globalEvolutionMetrics.successfulTasks /
          Math.max(1, this.globalEvolutionMetrics.totalTasks),
        adaptation_rate: this.calculateGlobalAdaptationRate(),
        learning_cycles: this.globalEvolutionMetrics.totalEvolutions,
        mutation_rate: 0.15, // Default from config
        crossover_rate: 0.75, // Default from config
        population_snapshot: {
          agentPerformance: Object.fromEntries(_analysisagentPerformance),
          globalPatterns: _analysisglobalPatterns,
          recommendations: _analysisrecommendations,
        },
        timestamp: _analysistimestamp,
      });
    } catch (_error) {
      this.logger.error'Failed to store global _analysis', _error;
    }
  }

  private calculateGlobalFitness(_analysis any): number {
    const performances = Array.from(_analysisagentPerformance.values());
    if (performances.length === 0) return 0;

    const avgFitness = performances.reduce((sum, p) => sum + p.fitness, 0) / performances.length;
    const avgPerformance =
      performances.reduce((sum, p) => sum + p.performance, 0) / performances.length;

    return (avgFitness + avgPerformance) / 2;
  }

  private calculateGlobalAdaptationRate(): number {
    let totalAdaptations = 0;

    for (const evolution of this.evolvingAgents.values()) {
      // This would need to track adaptations per agent
      totalAdaptations += evolution.evolutionMetrics.evolutionCycles;
    }

    return totalAdaptations / Math.max(1, this.evolvingAgents.size);
  }

  /**
   * Public API
   */
  async getGlobalStatus(): Promise<unknown> {
    const agentStatuses = new Map<string, any>();

    for (const [agentId, evolution] of this.evolvingAgents) {
      const status = await evolution.evolveSystem.getEvolutionStatus();
      agentStatuses.set(agentId, {
        ...status,
        metrics: evolution.evolutionMetrics,
      });
    }

    return {
      agents: Object.fromEntries(agentStatuses),
      globalMetrics: this.globalEvolutionMetrics,
      taskQueueLength: this.taskQueue.length,
      crossLearningEvents: this.crossLearningHistory.length,
      uptime: Date.now() - this.globalEvolutionMetrics.startTime.getTime(),
    };
  }

  async getAgentEvolution(agentId: string): Promise<unknown> {
    const evolution = this.evolvingAgents.get(agentId);
    if (!evolution) return null;

    return {
      status: await evolution.evolveSystem.getEvolutionStatus(),
      patterns: await evolution.evolveSystem.getPatternInsights(),
      metrics: evolution.evolutionMetrics,
    };
  }

  async getCrossLearningHistory(limit = 50): Promise<CrossAgentLearning[]> {
    return this.crossLearningHistory
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }
}

export default AlphaEvolveCoordinator;
