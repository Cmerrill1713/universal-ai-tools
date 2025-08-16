/**
 * Population Manager
 * Handles population initialization, genetic operators, and selection strategies
 * Implements various evolutionary strategies for AI agent evolution
 */

import { log, LogContext } from '@/utils/logger';

import type {
  ConvergenceMetrics,
  CrossoverOperator,
  Genome,
  Individual,
  MutationOperator,
  Population,
  ReasoningStrategy, TaskType } from './types';
import { SelectionStrategy } from './types';

export interface PopulationConfig {
  size: number;
  eliteSize: number;
  maxAge: number;
  diversityThreshold: number;
  convergenceThreshold: number;
  selectionPressure: number;
}

export interface GeneticOperatorConfig {
  crossoverOperators: CrossoverOperator[];
  mutationOperators: MutationOperator[];
  mutationRate: number;
  crossoverRate: number;
  adaptiveRates: boolean;
}

export class PopulationManager {
  private config: PopulationConfig;
  private operatorConfig: GeneticOperatorConfig;
  private populationHistory: Population[] = [];
  private fitnessHistory: number[][] = [];
  private generationCounter = 0;

  constructor(
    populationConfig?: Partial<PopulationConfig>,
    operatorConfig?: Partial<GeneticOperatorConfig>
  ) {
    this.config = {
      size: 100,
      eliteSize: 10,
      maxAge: 50,
      diversityThreshold: 0.1,
      convergenceThreshold: 0.01,
      selectionPressure: 2.0,
      ...populationConfig
    };

    this.operatorConfig = {
      crossoverOperators: this.createDefaultCrossoverOperators(),
      mutationOperators: this.createDefaultMutationOperators(),
      mutationRate: 0.1,
      crossoverRate: 0.7,
      adaptiveRates: true,
      ...operatorConfig
    };

    log.info('Population Manager initialized', LogContext.AI, {
      populationSize: this.config.size,
      eliteSize: this.config.eliteSize,
      operatorCount: this.operatorConfig.mutationOperators.length
    });
  }

  /**
   * Initialize a random population
   */
  public initializePopulation(taskTypes: TaskType[]): Population {
    const individuals: Individual[] = [];

    for (let i = 0; i < this.config.size; i++) {
      const individual = this.createRandomIndividual(taskTypes);
      individuals.push(individual);
    }

    const population: Population = {
      id: this.generatePopulationId(),
      individuals,
      generation: 0,
      archive: new Map(),
      bestIndividuals: [],
      diversityMetrics: this.calculateDiversityMetrics(individuals),
      convergenceMetrics: this.initializeConvergenceMetrics(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.populationHistory.push(population);
    this.generationCounter = 0;

    log.info('Population initialized', LogContext.AI, {
      populationId: population.id,
      size: individuals.length,
      diversity: population.diversityMetrics.phenotypicDiversity
    });

    return population;
  }

  /**
   * Evolve population for one generation
   */
  public async evolveGeneration(
    population: Population,
    selectionStrategy: SelectionStrategy = SelectionStrategy.TOURNAMENT
  ): Promise<Population> {
    const startTime = Date.now();
    this.generationCounter++;

    // Sort by fitness
    population.individuals.sort((a, b) => b.fitness - a.fitness);

    // Update best individuals
    population.bestIndividuals = this.selectElites(population.individuals);

    // Calculate convergence metrics
    population.convergenceMetrics = this.calculateConvergenceMetrics(population);

    // Adaptive rate adjustment
    if (this.operatorConfig.adaptiveRates) {
      this.adjustEvolutionRates(population);
    }

    // Create new generation
    const newIndividuals: Individual[] = [];

    // Keep elites
    const elites = this.selectElites(population.individuals);
    newIndividuals.push(...elites.map(elite => this.cloneIndividual(elite)));

    // Generate offspring to fill the rest
    while (newIndividuals.length < this.config.size) {
      const parents = this.selectParents(population.individuals, selectionStrategy);
      
      if (Math.random() < this.operatorConfig.crossoverRate) {
        // Crossover
        const parent1 = parents[0];
        const parent2 = parents[1];
        if (!parent1 || !parent2) {
          continue; // Skip if parents not found
        }
        const offspring = await this.crossover(parent1, parent2);
        newIndividuals.push(offspring);
      } else {
        // Clone and mutate
        const parent = parents[0];
        if (!parent) {
          continue; // Skip if parent not found
        }
        const clone = this.cloneIndividual(parent);
        await this.mutate(clone);
        newIndividuals.push(clone);
      }
    }

    // Trim to exact population size
    newIndividuals.splice(this.config.size);

    // Age individuals
    this.ageIndividuals(newIndividuals);

    // Remove old individuals
    const survivingIndividuals = this.removeOldIndividuals(newIndividuals);

    // Create new population
    const newPopulation: Population = {
      id: this.generatePopulationId(),
      individuals: survivingIndividuals,
      generation: population.generation + 1,
      archive: population.archive,
      bestIndividuals: this.selectElites(survivingIndividuals),
      diversityMetrics: this.calculateDiversityMetrics(survivingIndividuals),
      convergenceMetrics: this.calculateConvergenceMetrics(population),
      createdAt: population.createdAt,
      updatedAt: new Date()
    };

    // Update history
    this.populationHistory.push(newPopulation);
    this.updateFitnessHistory(newPopulation);

    log.debug(`Generation ${newPopulation.generation} evolved`, LogContext.AI, {
      populationSize: newPopulation.individuals.length,
      bestFitness: newPopulation.bestIndividuals[0]?.fitness || 0,
      averageFitness: this.calculateAverageFitness(newPopulation.individuals),
      diversity: newPopulation.diversityMetrics.phenotypicDiversity,
      evolutionTime: Date.now() - startTime
    });

    return newPopulation;
  }

  /**
   * Select parents for reproduction
   */
  public selectParents(
    individuals: Individual[],
    strategy: SelectionStrategy,
    count: number = 2
  ): Individual[] {
    switch (strategy) {
      case SelectionStrategy.TOURNAMENT:
        return this.tournamentSelection(individuals, count);
      
      case SelectionStrategy.ROULETTE:
        return this.rouletteWheelSelection(individuals, count);
      
      case SelectionStrategy.RANK:
        return this.rankSelection(individuals, count);
      
      default:
        return this.tournamentSelection(individuals, count);
    }
  }

  /**
   * Tournament selection
   */
  private tournamentSelection(individuals: Individual[], count: number): Individual[] {
    const selected: Individual[] = [];
    const tournamentSize = Math.max(2, Math.floor(individuals.length * 0.05));

    for (let i = 0; i < count; i++) {
      const tournament: Individual[] = [];
      
      // Select random individuals for tournament
      for (let j = 0; j < tournamentSize; j++) {
        const randomIndex = Math.floor(Math.random() * individuals.length);
        const selectedIndividual = individuals[randomIndex];
        if (selectedIndividual) {
          tournament.push(selectedIndividual);
        }
      }
      
      // Select best from tournament
      tournament.sort((a, b) => b.fitness - a.fitness);
      const winner = tournament[0];
        if (winner) {
          selected.push(winner);
        }
    }

    return selected;
  }

  /**
   * Roulette wheel selection
   */
  private rouletteWheelSelection(individuals: Individual[], count: number): Individual[] {
    const selected: Individual[] = [];
    const totalFitness = individuals.reduce((sum, ind) => sum + Math.max(0, ind.fitness), 0);

    if (totalFitness === 0) {
      // Fallback to random selection
      return individuals.slice(0, count);
    }

    for (let i = 0; i < count; i++) {
      const random = Math.random() * totalFitness;
      let cumulativeFitness = 0;
      
      for (const individual of individuals) {
        cumulativeFitness += Math.max(0, individual.fitness);
        if (cumulativeFitness >= random) {
          selected.push(individual);
          break;
        }
      }
    }

    return selected;
  }

  /**
   * Rank-based selection
   */
  private rankSelection(individuals: Individual[], count: number): Individual[] {
    const sorted = [...individuals].sort((a, b) => b.fitness - a.fitness);
    const ranks = sorted.map((_, index) => sorted.length - index);
    const totalRank = ranks.reduce((sum, rank) => sum + rank, 0);
    
    const selected: Individual[] = [];
    
    for (let i = 0; i < count; i++) {
      const random = Math.random() * totalRank;
      let cumulativeRank = 0;
      
      for (let j = 0; j < sorted.length; j++) {
        cumulativeRank += ranks[j] ?? 0;
        if (cumulativeRank >= random) {
          const selectedIndividual = sorted[j];
          if (selectedIndividual) {
            selected.push(selectedIndividual);
          }
          break;
        }
      }
    }

    return selected;
  }

  /**
   * Crossover operation
   */
  public async crossover(parent1: Individual, parent2: Individual): Promise<Individual> {
    // Select random crossover operator
    const operator = this.selectRandomOperator(this.operatorConfig.crossoverOperators);
    
    const childGenes = await this.applyCrossoverOperator(operator, parent1.genes, parent2.genes);
    
    return {
      id: this.generateIndividualId(),
      genes: childGenes,
      fitness: 0,
      behaviorDescriptor: [],
      age: 0,
      parentIds: [parent1.id, parent2.id],
      generation: Math.max(parent1.generation, parent2.generation) + 1,
      createdAt: new Date(),
      evaluations: []
    };
  }

  /**
   * Apply specific crossover operator
   */
  private async applyCrossoverOperator(
    operator: CrossoverOperator,
    genes1: Genome,
    genes2: Genome
  ): Promise<Genome> {
    switch (operator.type) {
      case 'uniform':
        return this.uniformCrossover(genes1, genes2);
      
      case 'blend':
        return this.blendCrossover(genes1, genes2, (operator.parameters?.alpha ?? 0.5));
      
      case 'single_point':
        return this.singlePointCrossover(genes1, genes2);
      
      default:
        return this.uniformCrossover(genes1, genes2);
    }
  }

  /**
   * Uniform crossover
   */
  private uniformCrossover(genes1: Genome, genes2: Genome): Genome {
    return {
      promptTemplate: Math.random() < 0.5 ? genes1.promptTemplate : genes2.promptTemplate,
      systemPrompt: Math.random() < 0.5 ? genes1.systemPrompt : genes2.systemPrompt,
      parameters: {
        temperature: Math.random() < 0.5 ? genes1.parameters.temperature : genes2.parameters.temperature,
        topP: Math.random() < 0.5 ? genes1.parameters.topP : genes2.parameters.topP,
        maxTokens: Math.random() < 0.5 ? genes1.parameters.maxTokens : genes2.parameters.maxTokens,
        frequencyPenalty: Math.random() < 0.5 ? genes1.parameters.frequencyPenalty : genes2.parameters.frequencyPenalty,
        presencePenalty: Math.random() < 0.5 ? genes1.parameters.presencePenalty : genes2.parameters.presencePenalty
      },
      reasoningStrategy: Math.random() < 0.5 ? genes1.reasoningStrategy : genes2.reasoningStrategy,
      modelPreferences: this.combineArrays(genes1.modelPreferences, genes2.modelPreferences),
      contextSize: Math.max(genes1.contextSize, genes2.contextSize)
    };
  }

  /**
   * Blend crossover for numerical parameters
   */
  private blendCrossover(genes1: Genome, genes2: Genome, alpha: number): Genome {
    const blendNumeric = (val1: number, val2: number) => {
      const min = Math.min(val1, val2);
      const max = Math.max(val1, val2);
      const range = max - min;
      const lower = min - alpha * range;
      const upper = max + alpha * range;
      return lower + Math.random() * (upper - lower);
    };

    return {
      promptTemplate: Math.random() < 0.5 ? genes1.promptTemplate : genes2.promptTemplate,
      systemPrompt: Math.random() < 0.5 ? genes1.systemPrompt : genes2.systemPrompt,
      parameters: {
        temperature: blendNumeric(genes1.parameters.temperature, genes2.parameters.temperature),
        topP: blendNumeric(genes1.parameters.topP, genes2.parameters.topP),
        maxTokens: Math.round(blendNumeric(genes1.parameters.maxTokens, genes2.parameters.maxTokens)),
        frequencyPenalty: blendNumeric(genes1.parameters.frequencyPenalty, genes2.parameters.frequencyPenalty),
        presencePenalty: blendNumeric(genes1.parameters.presencePenalty, genes2.parameters.presencePenalty)
      },
      reasoningStrategy: Math.random() < 0.5 ? genes1.reasoningStrategy : genes2.reasoningStrategy,
      modelPreferences: this.combineArrays(genes1.modelPreferences, genes2.modelPreferences),
      contextSize: Math.round(blendNumeric(genes1.contextSize, genes2.contextSize))
    };
  }

  /**
   * Single point crossover
   */
  private singlePointCrossover(genes1: Genome, genes2: Genome): Genome {
    // For complex genomes, use a simple approach
    const useFirst = Math.random() < 0.5;
    return {
      promptTemplate: useFirst ? genes1.promptTemplate : genes2.promptTemplate,
      systemPrompt: useFirst ? genes1.systemPrompt : genes2.systemPrompt,
      parameters: useFirst ? genes1.parameters : genes2.parameters,
      reasoningStrategy: useFirst ? genes1.reasoningStrategy : genes2.reasoningStrategy,
      modelPreferences: useFirst ? genes1.modelPreferences : genes2.modelPreferences,
      contextSize: useFirst ? genes1.contextSize : genes2.contextSize
    };
  }

  /**
   * Mutation operation
   */
  public async mutate(individual: Individual): Promise<void> {
    for (const operator of this.operatorConfig.mutationOperators) {
      if (Math.random() < operator.probability) {
        await this.applyMutationOperator(operator, individual);
      }
    }
  }

  /**
   * Apply specific mutation operator
   */
  private async applyMutationOperator(operator: MutationOperator, individual: Individual): Promise<void> {
    switch (operator.type) {
      case 'gaussian':
        this.gaussianMutation(individual, operator.strength);
        break;
      
      case 'uniform':
        this.uniformMutation(individual, operator.strength);
        break;
      
      case 'prompt_mutation':
        await this.promptMutation(individual);
        break;
      
      case 'bit_flip':
        this.bitFlipMutation(individual);
        break;
    }
  }

  /**
   * Gaussian mutation for numerical parameters
   */
  private gaussianMutation(individual: Individual, strength: number): void {
    const params = individual.genes.parameters;
    
    // Mutate temperature
    if (Math.random() < 0.3) {
      params.temperature += this.gaussianRandom() * strength;
      params.temperature = Math.max(0.1, Math.min(2.0, params.temperature));
    }
    
    // Mutate topP
    if (Math.random() < 0.3) {
      params.topP += this.gaussianRandom() * strength;
      params.topP = Math.max(0.1, Math.min(1.0, params.topP));
    }
    
    // Mutate penalties
    if (Math.random() < 0.2) {
      params.frequencyPenalty += this.gaussianRandom() * strength;
      params.frequencyPenalty = Math.max(0.0, Math.min(2.0, params.frequencyPenalty));
    }
  }

  /**
   * Uniform mutation
   */
  private uniformMutation(individual: Individual, strength: number): void {
    const params = individual.genes.parameters;
    
    if (Math.random() < 0.2) {
      params.maxTokens += Math.floor((Math.random() - 0.5) * 200 * strength);
      params.maxTokens = Math.max(50, Math.min(4000, params.maxTokens));
    }
  }

  /**
   * Prompt mutation
   */
  private async promptMutation(individual: Individual): Promise<void> {
    const mutationTypes = [
      'add_instruction',
      'modify_template',
      'change_reasoning'
    ];
    
    const mutationType = mutationTypes[Math.floor(Math.random() * mutationTypes.length)];
    
    switch (mutationType) {
      case 'add_instruction':
        individual.genes.promptTemplate = this.addInstructionToPrompt(individual.genes.promptTemplate);
        break;
      
      case 'modify_template':
        individual.genes.promptTemplate = this.modifyPromptTemplate(individual.genes.promptTemplate);
        break;
      
      case 'change_reasoning':
        individual.genes.reasoningStrategy = this.mutateReasoningStrategy(individual.genes.reasoningStrategy);
        break;
    }
  }

  /**
   * Bit flip mutation for discrete choices
   */
  private bitFlipMutation(individual: Individual): void {
    // Randomly change model preferences
    if (Math.random() < 0.1) {
      const models = ['gpt-4', 'claude-3', 'gemini-pro', 'llama-2', 'mixtral'];
      const newModel = models[Math.floor(Math.random() * models.length)];
      
      const modelPrefs = individual.genes.modelPreferences;
      if (modelPrefs && newModel && !modelPrefs.includes(newModel)) {
        modelPrefs.push(newModel);
      }
    }
  }

  /**
   * Helper methods for genome manipulation
   */
  private addInstructionToPrompt(prompt: string): string {
    const instructions = [
      'Think step by step.',
      'Provide detailed reasoning.',
      'Consider multiple approaches.',
      'Verify your answer.',
      'Explain your methodology.'
    ];
    
    const instruction = instructions[Math.floor(Math.random() * instructions.length)];
    return `${prompt}\n${instruction}`;
  }

  private modifyPromptTemplate(template: string): string {
    // Simple template modifications
    return template
      .replace('Solve', 'Carefully solve')
      .replace('Analyze', 'Thoroughly analyze')
      .replace('Explain', 'Clearly explain');
  }

  private mutateReasoningStrategy(strategy: ReasoningStrategy): ReasoningStrategy {
    const types = ['cot', 'tree_of_thoughts', 'react', 'self_consistency', 'debate'];
    const newType = types[Math.floor(Math.random() * types.length)] as any;
    
    return {
      ...strategy,
      type: newType
    };
  }

  /**
   * Utility methods
   */
  private createRandomIndividual(taskTypes: TaskType[]): Individual {
    const promptTemplates = this.getPromptTemplatesForTasks(taskTypes);
    const systemPrompts = this.getSystemPromptsForTasks(taskTypes);
    
    return {
      id: this.generateIndividualId(),
      genes: {
        promptTemplate: promptTemplates[Math.floor(Math.random() * promptTemplates.length)] || 'Solve the following problem: {input}',
        systemPrompt: systemPrompts[Math.floor(Math.random() * systemPrompts.length)] || 'You are a helpful AI assistant.',
        parameters: {
          temperature: 0.1 + Math.random() * 1.4,
          topP: 0.1 + Math.random() * 0.9,
          maxTokens: Math.floor(50 + Math.random() * 3950),
          frequencyPenalty: Math.random() * 2.0,
          presencePenalty: Math.random() * 2.0
        },
        reasoningStrategy: {
          type: 'cot',
          parameters: {},
          chains: []
        },
        modelPreferences: ['gpt-4', 'claude-3'],
        contextSize: Math.floor(1000 + Math.random() * 7000)
      },
      fitness: 0,
      behaviorDescriptor: [],
      age: 0,
      parentIds: [],
      generation: 0,
      createdAt: new Date(),
      evaluations: []
    };
  }

  private getPromptTemplatesForTasks(taskTypes: TaskType[]): string[] {
    const templates = [
      'Solve the following problem: {input}',
      'Analyze this task: {task_description}\nInput: {input}',
      'Given the task "{task_description}", provide a solution for: {input}',
      'Task: {task_description}\nProblem: {input}\nSolution:'
    ];
    
    return templates;
  }

  private getSystemPromptsForTasks(taskTypes: TaskType[]): string[] {
    return [
      'You are a helpful AI assistant that provides accurate and detailed responses.',
      'You are an expert problem solver with deep analytical capabilities.',
      'You are a creative and innovative AI that thinks outside the box.',
      'You are a precise and methodical AI that follows systematic approaches.'
    ];
  }

  private selectElites(individuals: Individual[]): Individual[] {
    return individuals
      .sort((a, b) => b.fitness - a.fitness)
      .slice(0, this.config.eliteSize);
  }

  private cloneIndividual(individual: Individual): Individual {
    return {
      ...individual,
      id: this.generateIndividualId(),
      genes: JSON.parse(JSON.stringify(individual.genes)),
      parentIds: [individual.id],
      generation: individual.generation + 1,
      createdAt: new Date(),
      evaluations: []
    };
  }

  private ageIndividuals(individuals: Individual[]): void {
    individuals.forEach(ind => ind.age++);
  }

  private removeOldIndividuals(individuals: Individual[]): Individual[] {
    return individuals.filter(ind => ind.age < this.config.maxAge);
  }

  private calculateAverageFitness(individuals: Individual[]): number {
    if (individuals.length === 0) return 0;
    return individuals.reduce((sum, ind) => sum + ind.fitness, 0) / individuals.length;
  }

  private calculateDiversityMetrics(individuals: Individual[]): any {
    if (individuals.length === 0) {
      return {
        behaviorCoverage: 0,
        phenotypicDiversity: 0,
        genotypicDiversity: 0,
        noveltyScore: 0
      };
    }

    const fitnessValues = individuals.map(ind => ind.fitness);
    const temperatureValues = individuals.map(ind => ind.genes.parameters.temperature);
    
    return {
      behaviorCoverage: 0.5, // Would be calculated from actual behavior space
      phenotypicDiversity: this.calculateVariance(fitnessValues),
      genotypicDiversity: this.calculateVariance(temperatureValues),
      noveltyScore: 0.5 // Would be calculated from novelty archive
    };
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }

  private calculateConvergenceMetrics(population: Population): ConvergenceMetrics {
    const currentFitness = population.individuals.map(ind => ind.fitness);
    const avgFitness = currentFitness.reduce((sum, f) => sum + f, 0) / currentFitness.length;
    
    // Calculate fitness stagnation
    const recentGenerations = this.fitnessHistory.slice(-5);
    const fitnessStagnation = recentGenerations.length > 1 
      ? this.calculateStagnation(recentGenerations)
      : 0;

    return {
      fitnessStagnation,
      populationVariance: this.calculateVariance(currentFitness),
      eliteStability: this.calculateEliteStability(population),
      improvementRate: this.calculateImprovementRate()
    };
  }

  private calculateStagnation(generations: number[][]): number {
    if (generations.length < 2) return 0;
    
    const improvements = generations.slice(1).map((gen, i) => {
      const prevGeneration = generations[i];
      if (!prevGeneration || prevGeneration.length === 0) return null;
      const prevAvg = prevGeneration.reduce((sum, f) => sum + f, 0) / prevGeneration.length;
      if (!gen || gen.length === 0) return null;
      const currAvg = gen.reduce((sum, f) => sum + f, 0) / gen.length;
      return currAvg - prevAvg;
    }).filter((improvement): improvement is number => improvement !== null);
    
    return improvements.filter(imp => imp <= 0).length / improvements.length;
  }

  private calculateEliteStability(population: Population): number {
    // Simplified - would compare elite individuals across generations
    return 0.8;
  }

  private calculateImprovementRate(): number {
    if (this.fitnessHistory.length < 2) return 0;
    
    const recent = this.fitnessHistory.slice(-2);
    if (recent.length < 2 || !recent[0] || !recent[1] || recent[0].length === 0 || recent[1].length === 0) return 0;
    const prevAvg = recent[0].reduce((sum, f) => sum + f, 0) / recent[0].length;
    const currAvg = recent[1].reduce((sum, f) => sum + f, 0) / recent[1].length;
    
    return (currAvg - prevAvg) / Math.abs(prevAvg);
  }

  private initializeConvergenceMetrics(): ConvergenceMetrics {
    return {
      fitnessStagnation: 0,
      populationVariance: 1.0,
      eliteStability: 0,
      improvementRate: 0
    };
  }

  private adjustEvolutionRates(population: Population): void {
    const convergence = population.convergenceMetrics;
    
    // Increase mutation rate if converged
    if (convergence.fitnessStagnation > 0.7) {
      this.operatorConfig.mutationRate = Math.min(0.5, this.operatorConfig.mutationRate * 1.1);
    } else if (convergence.improvementRate > 0.1) {
      this.operatorConfig.mutationRate = Math.max(0.05, this.operatorConfig.mutationRate * 0.9);
    }
  }

  private updateFitnessHistory(population: Population): void {
    const fitness = population.individuals.map(ind => ind.fitness);
    this.fitnessHistory.push(fitness);
    
    // Keep only recent history
    if (this.fitnessHistory.length > 50) {
      this.fitnessHistory = this.fitnessHistory.slice(-50);
    }
  }

  private combineArrays<T>(arr1: T[], arr2: T[]): T[] {
    const combined = [...new Set([...arr1, ...arr2])];
    return combined.slice(0, Math.max(arr1.length, arr2.length));
  }

  private selectRandomOperator<T>(operators: T[]): T {
    if (operators.length === 0) {
      throw new Error('No operators available for selection');
    }
    const selected = operators[Math.floor(Math.random() * operators.length)];
    if (!selected) {
      throw new Error('Failed to select operator');
    }
    return selected;
  }

  private gaussianRandom(): number {
    // Box-Muller transformation for Gaussian random numbers
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  private createDefaultCrossoverOperators(): CrossoverOperator[] {
    return [
      { type: 'uniform', probability: 0.7, parameters: {} },
      { type: 'blend', probability: 0.2, parameters: { alpha: 0.5 } },
      { type: 'single_point', probability: 0.1, parameters: {} }
    ];
  }

  private createDefaultMutationOperators(): MutationOperator[] {
    return [
      { type: 'gaussian', probability: 0.1, strength: 0.1, parameters: {} },
      { type: 'uniform', probability: 0.05, strength: 0.2, parameters: {} },
      { type: 'prompt_mutation', probability: 0.03, strength: 1.0, parameters: {} },
      { type: 'bit_flip', probability: 0.02, strength: 1.0, parameters: {} }
    ];
  }

  private generateIndividualId(): string {
    return `ind_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generatePopulationId(): string {
    return `pop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Public getter methods
   */
  public getPopulationHistory(): Population[] {
    return [...this.populationHistory];
  }

  public getCurrentGeneration(): number {
    return this.generationCounter;
  }

  public getConfig(): PopulationConfig {
    return { ...this.config };
  }

  public getOperatorConfig(): GeneticOperatorConfig {
    return { 
      ...this.operatorConfig,
      crossoverOperators: [...this.operatorConfig.crossoverOperators],
      mutationOperators: [...this.operatorConfig.mutationOperators]
    };
  }
}

export const populationManager = new PopulationManager();
export default populationManager;