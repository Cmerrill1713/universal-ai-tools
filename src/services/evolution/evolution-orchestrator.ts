/**
 * Evolution Orchestrator
 * Main service that coordinates all evolutionary processes
 * Integrates with existing LLM routing, model discovery, and optimization services
 */

import { EventEmitter } from 'events';

import { log, LogContext } from '@/utils/logger';

import { modelDiscoveryService } from '../model-discovery-service';
import { multiTierLLM } from '../multi-tier-llm-service';
import { fitnessEvaluator } from './fitness-evaluator';
import { populationManager } from './population-manager';
import { qualityDiversityEngine } from './quality-diversity';
import { DiversityStrategy, SelectionStrategy, TaskType } from './types';
import type {
  Benchmark,
  EvolutionConfig,
  EvolutionResult,
  FitnessFunction,
  Individual,
  Population,
  Task} from './types';

export interface EvolutionExperiment {
  id: string;
  name: string;
  description: string;
  config: EvolutionConfig;
  startTime: Date;
  endTime?: Date;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  currentGeneration: number;
  bestIndividual?: Individual;
  population?: Population;
  results?: EvolutionResult;
  tasks: Task[];
  benchmarks: string[];
}

export interface OptimizationTarget {
  type: 'prompt_optimization' | 'parameter_tuning' | 'model_combination' | 'reasoning_strategy';
  taskTypes: TaskType[];
  objectives: string[];
  constraints: Record<string, any>;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export class EvolutionOrchestrator extends EventEmitter {
  private experiments: Map<string, EvolutionExperiment> = new Map();
  private activeExperiments: Set<string> = new Set();
  private optimizationQueue: OptimizationTarget[] = [];
  private isRunning = false;
  private maxConcurrentExperiments = 2;

  constructor() {
    super();
    this.setupEventHandlers();
    
    log.info('Evolution Orchestrator initialized', LogContext.AI, {
      maxConcurrentExperiments: this.maxConcurrentExperiments
    });
  }

  /**
   * Start comprehensive evolution experiment
   */
  public async startEvolution(
    name: string,
    config: Partial<EvolutionConfig>,
    tasks: Task[],
    benchmarks: string[] = []
  ): Promise<string> {
    const experimentId = this.generateExperimentId();
    
    const defaultConfig: EvolutionConfig = {
      populationSize: 50,
      maxGenerations: 100,
      eliteSize: 5,
      mutationRate: 0.1,
      crossoverRate: 0.7,
      noveltyThreshold: 0.1,
      archiveSize: 1000,
      evaluationBudget: 5000,
      fitnessFunction: {
        type: 'weighted_sum',
        weights: { accuracy: 0.4, efficiency: 0.3, creativity: 0.3 },
        objectives: ['accuracy', 'efficiency', 'creativity'],
        constraints: []
      },
      selectionStrategy: SelectionStrategy.TOURNAMENT,
      diversityStrategy: DiversityStrategy.QUALITY_DIVERSITY
    };

    const experiment: EvolutionExperiment = {
      id: experimentId,
      name,
      description: `Evolutionary optimization experiment: ${name}`,
      config: { ...defaultConfig, ...config },
      startTime: new Date(),
      status: 'pending',
      currentGeneration: 0,
      tasks,
      benchmarks
    };

    this.experiments.set(experimentId, experiment);
    
    // Start experiment if not at capacity
    if (this.activeExperiments.size < this.maxConcurrentExperiments) {
      await this.executeExperiment(experimentId);
    }

    log.info('Evolution experiment created', LogContext.AI, {
      experimentId,
      name,
      tasksCount: tasks.length,
      benchmarksCount: benchmarks.length
    });

    return experimentId;
  }

  /**
   * Execute evolution experiment
   */
  private async executeExperiment(experimentId: string): Promise<void> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    this.activeExperiments.add(experimentId);
    experiment.status = 'running';

    try {
      log.info('Starting evolution experiment execution', LogContext.AI, {
        experimentId,
        name: experiment.name
      });

      // Initialize population based on task types
      const taskTypes = [...new Set(experiment.tasks.map(task => task.type))];
      const population = populationManager.initializePopulation(taskTypes);
      experiment.population = population;

      // Initial fitness evaluation
      await this.evaluatePopulation(population, experiment.tasks, experiment.config.fitnessFunction);

      // Choose evolution strategy
      const result = await this.runEvolutionStrategy(experiment);
      
      experiment.results = result;
      experiment.status = 'completed';
      experiment.endTime = new Date();

      // Extract and store best individual
      experiment.bestIndividual = result.bestIndividual;

      // Integrate results with existing systems
      await this.integrateResults(experiment);

      this.emit('experiment-completed', {
        experimentId,
        results: result
      });

      log.info('Evolution experiment completed', LogContext.AI, {
        experimentId,
        generations: result.generationsRun,
        bestFitness: result.bestIndividual.fitness,
        timeElapsed: result.timeElapsed
      });

    } catch (error) {
      experiment.status = 'failed';
      experiment.endTime = new Date();
      
      log.error('Evolution experiment failed', LogContext.AI, {
        experimentId,
        error: error instanceof Error ? error.message : String(error)
      });

      this.emit('experiment-failed', {
        experimentId,
        error
      });
    } finally {
      this.activeExperiments.delete(experimentId);
      
      // Start next experiment in queue if any
      await this.processExperimentQueue();
    }
  }

  /**
   * Run evolution strategy based on configuration
   */
  private async runEvolutionStrategy(experiment: EvolutionExperiment): Promise<EvolutionResult> {
    const { config, tasks, population } = experiment;
    const startTime = Date.now();

    switch (config.diversityStrategy) {
      case DiversityStrategy.QUALITY_DIVERSITY:
        return await this.runQualityDiversityEvolution(experiment);
      
      case DiversityStrategy.NOVELTY_SEARCH:
        return await this.runNoveltySearchEvolution(experiment);
      
      case DiversityStrategy.BEHAVIORAL:
        return await this.runBehavioralEvolution(experiment);
      
      default:
        return await this.runStandardEvolution(experiment);
    }
  }

  /**
   * Quality-Diversity evolution strategy
   */
  private async runQualityDiversityEvolution(experiment: EvolutionExperiment): Promise<EvolutionResult> {
    const { config, tasks, population } = experiment;
    const startTime = Date.now();

    log.info('Running Quality-Diversity evolution', LogContext.AI, {
      experimentId: experiment.id,
      generations: config.maxGenerations
    });

    // Run MAP-Elites with Novelty Search
    const qdResult = await qualityDiversityEngine.qualityDiversityOptimization(
      population!.individuals,
      tasks,
      config.maxGenerations
    );

    // Get best individual from archive
    const sortedIndividuals = Array.from(qdResult.archive.cells.values())
      .sort((a, b) => b.fitness - a.fitness);
    if (sortedIndividuals.length === 0) {
      throw new Error('No individuals in archive');
    }
    const bestIndividual = sortedIndividuals[0];

    return {
      bestIndividual: bestIndividual!,
      population: {
        ...population!,
        individuals: Array.from(qdResult.archive.cells.values())
      },
      generationsRun: config.maxGenerations,
      totalEvaluations: qdResult.archive.cells.size,
      convergenceReached: true,
      timeElapsed: Date.now() - startTime,
      finalMetrics: {
        averageFitness: this.calculateAverageFitness(Array.from(qdResult.archive.cells.values())),
        bestFitness: bestIndividual?.fitness || 0,
        diversityScore: qdResult.archive.qd_score,
        convergenceScore: 0.9
      }
    };
  }

  /**
   * Novelty Search evolution strategy
   */
  private async runNoveltySearchEvolution(experiment: EvolutionExperiment): Promise<EvolutionResult> {
    const { config, tasks, population } = experiment;
    const startTime = Date.now();

    log.info('Running Novelty Search evolution', LogContext.AI, {
      experimentId: experiment.id,
      generations: config.maxGenerations
    });

    const novelIndividuals = await qualityDiversityEngine.noveltySearch(
      population!.individuals,
      tasks,
      config.maxGenerations
    );

    // Re-evaluate with fitness function to get best
    await this.evaluatePopulation(
      { ...population!, individuals: novelIndividuals },
      tasks,
      config.fitnessFunction
    );

    const sortedNovelIndividuals = novelIndividuals.sort((a, b) => b.fitness - a.fitness);
    if (sortedNovelIndividuals.length === 0) {
      throw new Error('No novel individuals found');
    }
    const bestIndividual = sortedNovelIndividuals[0];

    return {
      bestIndividual: bestIndividual!,
      population: { ...population!, individuals: novelIndividuals },
      generationsRun: config.maxGenerations,
      totalEvaluations: novelIndividuals.length * config.maxGenerations,
      convergenceReached: false,
      timeElapsed: Date.now() - startTime,
      finalMetrics: {
        averageFitness: this.calculateAverageFitness(novelIndividuals),
        bestFitness: bestIndividual?.fitness || 0,
        diversityScore: 0.8,
        convergenceScore: 0.3
      }
    };
  }

  /**
   * Behavioral evolution strategy
   */
  private async runBehavioralEvolution(experiment: EvolutionExperiment): Promise<EvolutionResult> {
    const { config, tasks, population } = experiment;
    const startTime = Date.now();
    let currentPopulation = population!;

    log.info('Running Behavioral evolution', LogContext.AI, {
      experimentId: experiment.id,
      generations: config.maxGenerations
    });

    for (let gen = 0; gen < config.maxGenerations; gen++) {
      // Evaluate population
      await this.evaluatePopulation(currentPopulation, tasks, config.fitnessFunction);
      
      // Evolve generation with behavioral selection pressure
      currentPopulation = await populationManager.evolveGeneration(
        currentPopulation,
        config.selectionStrategy
      );

      // Update experiment
      experiment.currentGeneration = gen;
      experiment.population = currentPopulation;

      // Emit progress
      this.emit('generation-completed', {
        experimentId: experiment.id,
        generation: gen,
        bestFitness: Math.max(...currentPopulation.individuals.map(ind => ind.fitness)),
        averageFitness: this.calculateAverageFitness(currentPopulation.individuals)
      });

      if (gen % 10 === 0) {
        log.debug(`Behavioral evolution generation ${gen}`, LogContext.AI, {
          experimentId: experiment.id,
          bestFitness: Math.max(...currentPopulation.individuals.map(ind => ind.fitness))
        });
      }
    }

    const sortedIndividuals = currentPopulation.individuals
      .sort((a, b) => b.fitness - a.fitness);
    if (sortedIndividuals.length === 0) {
      throw new Error('No individuals in population');
    }
    const bestIndividual = sortedIndividuals[0];

    return {
      bestIndividual: bestIndividual!,
      population: currentPopulation,
      generationsRun: config.maxGenerations,
      totalEvaluations: config.maxGenerations * config.populationSize,
      convergenceReached: this.checkConvergence(currentPopulation),
      timeElapsed: Date.now() - startTime,
      finalMetrics: {
        averageFitness: this.calculateAverageFitness(currentPopulation.individuals),
        bestFitness: bestIndividual?.fitness || 0,
        diversityScore: currentPopulation.diversityMetrics.phenotypicDiversity,
        convergenceScore: this.calculateConvergenceScore(currentPopulation)
      }
    };
  }

  /**
   * Standard genetic algorithm evolution
   */
  private async runStandardEvolution(experiment: EvolutionExperiment): Promise<EvolutionResult> {
    const { config, tasks, population } = experiment;
    const startTime = Date.now();
    let currentPopulation = population!;
    let convergenceReached = false;

    log.info('Running Standard evolution', LogContext.AI, {
      experimentId: experiment.id,
      generations: config.maxGenerations
    });

    for (let gen = 0; gen < config.maxGenerations && !convergenceReached; gen++) {
      // Evaluate population
      await this.evaluatePopulation(currentPopulation, tasks, config.fitnessFunction);
      
      // Check convergence
      convergenceReached = this.checkConvergence(currentPopulation);
      
      // Evolve generation
      currentPopulation = await populationManager.evolveGeneration(
        currentPopulation,
        config.selectionStrategy
      );

      // Update experiment
      experiment.currentGeneration = gen;
      experiment.population = currentPopulation;

      // Emit progress
      this.emit('generation-completed', {
        experimentId: experiment.id,
        generation: gen,
        bestFitness: Math.max(...currentPopulation.individuals.map(ind => ind.fitness)),
        averageFitness: this.calculateAverageFitness(currentPopulation.individuals)
      });
    }

    const sortedIndividuals = currentPopulation.individuals
      .sort((a, b) => b.fitness - a.fitness);
    if (sortedIndividuals.length === 0) {
      throw new Error('No individuals in population');
    }
    const bestIndividual = sortedIndividuals[0];

    return {
      bestIndividual: bestIndividual!,
      population: currentPopulation,
      generationsRun: experiment.currentGeneration,
      totalEvaluations: experiment.currentGeneration * config.populationSize,
      convergenceReached,
      timeElapsed: Date.now() - startTime,
      finalMetrics: {
        averageFitness: this.calculateAverageFitness(currentPopulation.individuals),
        bestFitness: bestIndividual?.fitness || 0,
        diversityScore: currentPopulation.diversityMetrics.phenotypicDiversity,
        convergenceScore: this.calculateConvergenceScore(currentPopulation)
      }
    };
  }

  /**
   * Evaluate population fitness
   */
  private async evaluatePopulation(
    population: Population,
    tasks: Task[],
    fitnessFunction: FitnessFunction
  ): Promise<void> {
    const evaluationPromises = population.individuals.map(individual =>
      fitnessEvaluator.evaluateIndividual(individual, tasks, fitnessFunction)
    );

    await Promise.all(evaluationPromises);
  }

  /**
   * Integrate evolution results with existing systems
   */
  private async integrateResults(experiment: EvolutionExperiment): Promise<void> {
    if (!experiment.bestIndividual) return;

    const { bestIndividual } = experiment;

    try {
      // Register optimized configuration with multi-tier LLM
      await this.registerOptimizedConfiguration(bestIndividual, experiment.tasks);

      // Update model discovery service with new preferences
      await this.updateModelPreferences(bestIndividual);

      // Store results for future experiments
      await this.storeExperimentResults(experiment);

      log.info('Evolution results integrated', LogContext.AI, {
        experimentId: experiment.id,
        bestFitness: bestIndividual.fitness
      });

    } catch (error) {
      log.error('Failed to integrate evolution results', LogContext.AI, {
        experimentId: experiment.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Register optimized configuration
   */
  private async registerOptimizedConfiguration(individual: Individual, tasks: Task[]): Promise<void> {
    // This would integrate with the existing multi-tier LLM system
    const config = {
      promptTemplate: individual.genes.promptTemplate,
      systemPrompt: individual.genes.systemPrompt,
      parameters: individual.genes.parameters,
      reasoningStrategy: individual.genes.reasoningStrategy,
      fitness: individual.fitness,
      taskTypes: [...new Set(tasks.map(t => t.type))],
      optimizedFor: tasks.map(t => t.id)
    };

    // Store in memory or database for use by multi-tier LLM
    log.info('Registered optimized configuration', LogContext.AI, {
      individualId: individual.id,
      fitness: individual.fitness,
      taskTypes: config.taskTypes
    });
  }

  /**
   * Update model preferences in discovery service
   */
  private async updateModelPreferences(individual: Individual): Promise<void> {
    // Update model discovery service with learned preferences
    const preferences = {
      models: individual.genes.modelPreferences,
      contextSize: individual.genes.contextSize,
      performance: individual.fitness
    };

    log.info('Updated model preferences', LogContext.AI, {
      preferences: preferences.models,
      performance: preferences.performance
    });
  }

  /**
   * Store experiment results
   */
  private async storeExperimentResults(experiment: EvolutionExperiment): Promise<void> {
    // Store in database or file system for future reference
    const results = {
      experimentId: experiment.id,
      bestIndividual: experiment.bestIndividual,
      finalMetrics: experiment.results?.finalMetrics,
      config: experiment.config,
      tasks: experiment.tasks
    };

    log.debug('Stored experiment results', LogContext.AI, {
      experimentId: experiment.id,
      bestFitness: results.bestIndividual?.fitness
    });
  }

  /**
   * Optimize specific targets automatically
   */
  public async optimizeTarget(target: OptimizationTarget): Promise<string> {
    // Create tasks based on optimization target
    const tasks = await this.generateTasksForTarget(target);
    
    // Create evolution configuration
    const config: Partial<EvolutionConfig> = {
      populationSize: 30,
      maxGenerations: 50,
      fitnessFunction: {
        type: 'weighted_sum',
        weights: this.getWeightsForTarget(target),
        objectives: target.objectives,
        constraints: []
      },
      diversityStrategy: DiversityStrategy.QUALITY_DIVERSITY
    };

    // Start evolution experiment
    const experimentId = await this.startEvolution(
      `Auto-optimization: ${target.type}`,
      config,
      tasks
    );

    return experimentId;
  }

  /**
   * Generate tasks for optimization target
   */
  private async generateTasksForTarget(target: OptimizationTarget): Promise<Task[]> {
    // This would generate appropriate tasks based on the target type
    const tasks: Task[] = [];
    
    for (const taskType of target.taskTypes) {
      // Get benchmark for this task type
      const benchmark = fitnessEvaluator.getBenchmark(taskType);
      if (benchmark) {
        tasks.push(...benchmark.tasks);
      }
    }

    // If no benchmark tasks, create default tasks
    if (tasks.length === 0) {
      tasks.push(...this.createDefaultTasks(target.taskTypes));
    }

    return tasks;
  }

  /**
   * Create default tasks for task types
   */
  private createDefaultTasks(taskTypes: TaskType[]): Task[] {
    const tasks: Task[] = [];
    
    taskTypes.forEach(taskType => {
      tasks.push({
        id: `default_${taskType}_${Date.now()}`,
        type: taskType,
        description: `Default ${taskType} task`,
        input: `Test input for ${taskType}`,
        evaluationCriteria: ['accuracy', 'relevance'],
        difficulty: 'medium',
        domain: taskType
      });
    });

    return tasks;
  }

  /**
   * Get weights for optimization target
   */
  private getWeightsForTarget(target: OptimizationTarget): Record<string, number> {
    const defaultWeights: Record<string, number> = {
      accuracy: 1.0,
      efficiency: 1.0,
      creativity: 1.0,
      relevance: 1.0
    };

    // Adjust weights based on target type
    switch (target.type) {
      case 'prompt_optimization':
        return { accuracy: 0.4, relevance: 0.4, efficiency: 0.2 };
      
      case 'parameter_tuning':
        return { accuracy: 0.5, efficiency: 0.3, creativity: 0.2 };
      
      case 'reasoning_strategy':
        return { accuracy: 0.6, relevance: 0.3, efficiency: 0.1 };
      
      default:
        return defaultWeights;
    }
  }

  /**
   * Utility methods
   */
  private calculateAverageFitness(individuals: Individual[]): number {
    if (individuals.length === 0) return 0;
    return individuals.reduce((sum, ind) => sum + ind.fitness, 0) / individuals.length;
  }

  private checkConvergence(population: Population): boolean {
    const variance = population.convergenceMetrics.populationVariance;
    return variance < 0.01; // Convergence threshold
  }

  private calculateConvergenceScore(population: Population): number {
    return Math.max(0, 1 - population.convergenceMetrics.populationVariance);
  }

  private async processExperimentQueue(): Promise<void> {
    // Process queued optimization targets
    if (this.optimizationQueue.length > 0 && this.activeExperiments.size < this.maxConcurrentExperiments) {
      const target = this.optimizationQueue.shift()!;
      await this.optimizeTarget(target);
    }
  }

  private setupEventHandlers(): void {
    this.on('experiment-completed', (event) => {
      log.info('Evolution experiment completed event', LogContext.AI, event);
    });

    this.on('experiment-failed', (event) => {
      log.error('Evolution experiment failed event', LogContext.AI, event);
    });

    this.on('generation-completed', (event) => {
      log.debug('Evolution generation completed event', LogContext.AI, event);
    });
  }

  private generateExperimentId(): string {
    return `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Public methods for experiment management
   */
  public getExperiment(experimentId: string): EvolutionExperiment | undefined {
    return this.experiments.get(experimentId);
  }

  public getAllExperiments(): EvolutionExperiment[] {
    return Array.from(this.experiments.values());
  }

  public getActiveExperiments(): EvolutionExperiment[] {
    return Array.from(this.activeExperiments)
      .map(id => this.experiments.get(id))
      .filter((exp): exp is EvolutionExperiment => exp !== undefined);
  }

  public async pauseExperiment(experimentId: string): Promise<void> {
    const experiment = this.experiments.get(experimentId);
    if (experiment && experiment.status === 'running') {
      experiment.status = 'paused';
      this.activeExperiments.delete(experimentId);
      log.info('Evolution experiment paused', LogContext.AI, { experimentId });
    }
  }

  public async resumeExperiment(experimentId: string): Promise<void> {
    const experiment = this.experiments.get(experimentId);
    if (experiment && experiment.status === 'paused') {
      if (this.activeExperiments.size < this.maxConcurrentExperiments) {
        await this.executeExperiment(experimentId);
      }
    }
  }

  public getEvolutionStats(): {
    totalExperiments: number;
    activeExperiments: number;
    completedExperiments: number;
    averageGenerations: number;
  } {
    const experiments = Array.from(this.experiments.values());
    const completed = experiments.filter(exp => exp.status === 'completed');
    const avgGenerations = completed.length > 0
      ? completed.reduce((sum, exp) => sum + exp.currentGeneration, 0) / completed.length
      : 0;

    return {
      totalExperiments: experiments.length,
      activeExperiments: this.activeExperiments.size,
      completedExperiments: completed.length,
      averageGenerations: avgGenerations
    };
  }
}

export const evolutionOrchestrator = new EvolutionOrchestrator();
export default evolutionOrchestrator;