/**
 * Quality-Diversity Algorithms
 * Implementation of MAP-Elites, Novelty Search, and other QD algorithms
 * Inspired by Sakana AI's approach to diverse solution discovery
 */

import { log, LogContext } from '@/utils/logger';

import type {
  Archive,
  BehaviorDescriptor,
  DiversityMetrics,
  EvaluationResult,
  Individual,
  NoveltyRecord,
  Population,
  Task} from './types';

export interface QDConfig {
  archiveSize: number;
  behaviorDimensions: number;
  resolution: number[];
  noveltyThreshold: number;
  noveltyArchiveSize: number;
  kNearestNeighbors: number;
  diversityWeight: number;
  qualityWeight: number;
}

export interface MapElitesConfig extends QDConfig {
  cellReplacementStrategy: 'better_fitness' | 'novelty_preference' | 'age_based';
  elitismRate: number;
}

export class QualityDiversityEngine {
  private config: QDConfig;
  private archive: Archive;
  private noveltyArchive: NoveltyRecord[] = [];
  private behaviorDescriptor: BehaviorDescriptor;
  private evaluationHistory: Map<string, EvaluationResult[]> = new Map();

  constructor(config: Partial<QDConfig> = {}) {
    this.config = {
      archiveSize: 1000,
      behaviorDimensions: 2,
      resolution: [20, 20],
      noveltyThreshold: 0.1,
      noveltyArchiveSize: 500,
      kNearestNeighbors: 5,
      diversityWeight: 0.5,
      qualityWeight: 0.5,
      ...config
    };

    this.behaviorDescriptor = this.createDefaultBehaviorDescriptor();
    this.archive = this.initializeArchive();
    
    log.info('Quality-Diversity engine initialized', LogContext.AI, {
      archiveSize: this.config.archiveSize,
      behaviorDimensions: this.config.behaviorDimensions,
      resolution: this.config.resolution
    });
  }

  /**
   * MAP-Elites algorithm implementation
   */
  public async mapElites(
    population: Individual[],
    tasks: Task[],
    generations: number,
    config?: Partial<MapElitesConfig>
  ): Promise<Archive> {
    const mapConfig = { ...this.config, ...config } as MapElitesConfig;
    
    log.info('Starting MAP-Elites evolution', LogContext.AI, {
      generations,
      populationSize: population.length,
      archiveSize: this.config.archiveSize
    });

    // Initialize archive with population
    await this.initializeArchiveWithPopulation(population, tasks);

    for (let gen = 0; gen < generations; gen++) {
      const startTime = Date.now();
      
      // Generate offspring from archive
      const offspring = await this.generateOffspring(mapConfig);
      
      // Evaluate offspring
      for (const child of offspring) {
        await this.evaluateAndAddToArchive(child, tasks);
      }
      
      // Update archive metrics
      this.updateArchiveMetrics();
      
      // Log progress
      if (gen % 10 === 0 || gen === generations - 1) {
        log.info(`MAP-Elites generation ${gen}`, LogContext.AI, {
          archiveOccupancy: this.archive.occupancy,
          coverage: this.archive.coverage,
          qdScore: this.archive.qd_score,
          generationTime: Date.now() - startTime
        });
      }
    }

    log.info('MAP-Elites evolution completed', LogContext.AI, {
      finalOccupancy: this.archive.occupancy,
      finalCoverage: this.archive.coverage,
      finalQDScore: this.archive.qd_score
    });

    return this.archive;
  }

  /**
   * Novelty Search implementation
   */
  public async noveltySearch(
    population: Individual[],
    tasks: Task[],
    generations: number
  ): Promise<Individual[]> {
    log.info('Starting Novelty Search', LogContext.AI, {
      generations,
      populationSize: population.length
    });

    let currentPopulation = [...population];

    for (let gen = 0; gen < generations; gen++) {
      // Evaluate novelty for all individuals
      for (const individual of currentPopulation) {
        individual.fitness = await this.calculateNoveltyScore(individual, tasks);
      }

      // Select parents based on novelty
      const parents = this.selectNoveltyBasedParents(currentPopulation);
      
      // Generate offspring
      const offspring = await this.generateNoveltyOffspring(parents);
      
      // Update novelty archive
      this.updateNoveltyArchive(currentPopulation);
      
      // Replace population
      currentPopulation = [...parents, ...offspring].slice(0, population.length);
      
      if (gen % 10 === 0) {
        const avgNovelty = currentPopulation.reduce((sum, ind) => sum + ind.fitness, 0) / currentPopulation.length;
        log.info(`Novelty Search generation ${gen}`, LogContext.AI, {
          averageNovelty: avgNovelty,
          noveltyArchiveSize: this.noveltyArchive.length
        });
      }
    }

    // Return most novel individuals
    return currentPopulation
      .sort((a, b) => b.fitness - a.fitness)
      .slice(0, Math.floor(population.length * 0.1));
  }

  /**
   * Quality-Diversity combined approach
   */
  public async qualityDiversityOptimization(
    population: Individual[],
    tasks: Task[],
    generations: number
  ): Promise<{
    archive: Archive;
    novelIndividuals: Individual[];
    qualityElites: Individual[];
  }> {
    log.info('Starting Quality-Diversity optimization', LogContext.AI, {
      generations,
      qualityWeight: this.config.qualityWeight,
      diversityWeight: this.config.diversityWeight
    });

    // Run MAP-Elites for quality + diversity
    const archive = await this.mapElites(population, tasks, Math.floor(generations * 0.7));
    
    // Run Novelty Search for pure diversity
    const novelIndividuals = await this.noveltySearch(
      Array.from(archive.cells.values()),
      tasks,
      Math.floor(generations * 0.3)
    );

    // Extract quality elites
    const qualityElites = Array.from(archive.cells.values())
      .sort((a, b) => b.fitness - a.fitness)
      .slice(0, 10);

    log.info('Quality-Diversity optimization completed', LogContext.AI, {
      archiveSize: archive.cells.size,
      novelIndividuals: novelIndividuals.length,
      qualityElites: qualityElites.length
    });

    return {
      archive,
      novelIndividuals,
      qualityElites
    };
  }

  /**
   * Calculate behavior descriptor for an individual
   */
  private async calculateBehaviorDescriptor(
    individual: Individual,
    tasks: Task[]
  ): Promise<number[]> {
    // Get or compute evaluation results
    let evaluationResults = this.evaluationHistory.get(individual.id);
    
    if (!evaluationResults) {
      // This would normally be computed by the fitness evaluator
      // For now, use a simplified calculation
      evaluationResults = tasks.map(task => this.createMockEvaluation(individual, task));
      this.evaluationHistory.set(individual.id, evaluationResults);
    }

    const firstResult = evaluationResults[0];
    if (!firstResult) {
      return [0, 0]; // Default behavior descriptor
    }
    return this.behaviorDescriptor.calculator(individual, firstResult);
  }

  /**
   * Default behavior descriptor calculator
   */
  private createDefaultBehaviorDescriptor(): BehaviorDescriptor {
    return {
      dimensions: this.config.behaviorDimensions,
      bounds: [
        [0, 1], // Creativity dimension
        [0, 1]  // Accuracy dimension
      ],
      resolution: this.config.resolution,
      calculator: (individual: Individual, result: EvaluationResult) => {
        // Calculate behavior based on evaluation metrics
        const {creativity} = result.metrics;
        const {accuracy} = result.metrics;
        return [creativity, accuracy];
      }
    };
  }

  /**
   * Initialize empty archive
   */
  private initializeArchive(): Archive {
    return {
      cells: new Map(),
      behaviorDescriptor: this.behaviorDescriptor,
      occupancy: 0,
      coverage: 0,
      qd_score: 0
    };
  }

  /**
   * Initialize archive with population
   */
  private async initializeArchiveWithPopulation(population: Individual[], tasks: Task[]): Promise<void> {
    for (const individual of population) {
      await this.evaluateAndAddToArchive(individual, tasks);
    }
    
    log.info('Archive initialized with population', LogContext.AI, {
      occupancy: this.archive.occupancy,
      totalCells: this.getTotalCells()
    });
  }

  /**
   * Evaluate individual and add to archive
   */
  private async evaluateAndAddToArchive(individual: Individual, tasks: Task[]): Promise<void> {
    // Calculate behavior descriptor
    const behaviorVector = await this.calculateBehaviorDescriptor(individual, tasks);
    individual.behaviorDescriptor = behaviorVector;

    // Get archive cell index
    const cellIndex = this.getCellIndex(behaviorVector);
    
    // Check if cell is empty or current individual is better
    const existingIndividual = this.archive.cells.get(cellIndex);
    
    if (!existingIndividual || individual.fitness > existingIndividual.fitness) {
      this.archive.cells.set(cellIndex, individual);
      
      if (!existingIndividual) {
        this.archive.occupancy++;
      }
    }
  }

  /**
   * Get cell index for behavior vector
   */
  private getCellIndex(behaviorVector: number[]): string {
    const indices = behaviorVector.map((value, dim) => {
      const bounds = this.behaviorDescriptor.bounds[dim];
    if (!bounds) {
      return 0; // Default index for missing bounds
    }
    const [min, max] = bounds;
      const normalized = (value - min) / (max - min);
      const index = Math.floor(normalized * (this.config.resolution[dim] ?? 10));
      return Math.max(0, Math.min((this.config.resolution[dim] ?? 10) - 1, index));
    });
    
    return indices.join(',');
  }

  /**
   * Generate offspring for MAP-Elites
   */
  private async generateOffspring(config: MapElitesConfig): Promise<Individual[]> {
    const offspring: Individual[] = [];
    const archiveIndividuals = Array.from(this.archive.cells.values());
    
    if (archiveIndividuals.length < 2) {
      return offspring;
    }

    const offspringCount = Math.min(50, archiveIndividuals.length);
    
    for (let i = 0; i < offspringCount; i++) {
      // Select parents randomly from archive
      const parent1 = archiveIndividuals[Math.floor(Math.random() * archiveIndividuals.length)];
      const parent2 = archiveIndividuals[Math.floor(Math.random() * archiveIndividuals.length)];
      
      if (!parent1 || !parent2) {
        continue; // Skip if parents not found
      }
      const child = await this.crossoverAndMutate(parent1, parent2);
      offspring.push(child);
    }
    
    return offspring;
  }

  /**
   * Calculate novelty score for an individual
   */
  private async calculateNoveltyScore(individual: Individual, tasks: Task[]): Promise<number> {
    const behaviorVector = await this.calculateBehaviorDescriptor(individual, tasks);
    
    // Find k nearest neighbors in archive + current population
    const allBehaviors = [
      ...this.noveltyArchive.map(record => record.behaviorVector),
      ...Array.from(this.archive.cells.values()).map(ind => ind.behaviorDescriptor)
    ].filter(bv => bv && bv.length > 0);

    if (allBehaviors.length === 0) {
      return 1.0; // Maximum novelty if no comparison available
    }

    // Calculate distances to all other behaviors
    const distances = allBehaviors.map(otherBehavior => 
      this.calculateBehaviorDistance(behaviorVector, otherBehavior)
    );

    // Sort distances and take k nearest
    distances.sort((a, b) => a - b);
    const kNearest = distances.slice(0, Math.min(this.config.kNearestNeighbors, distances.length));
    
    // Novelty is average distance to k nearest neighbors
    return kNearest.reduce((sum, dist) => sum + dist, 0) / kNearest.length;
  }

  /**
   * Calculate distance between behavior vectors
   */
  private calculateBehaviorDistance(behavior1: number[], behavior2: number[]): number {
    if (behavior1.length !== behavior2.length) {
      return 1.0; // Maximum distance for incompatible vectors
    }

    if (behavior1.length !== behavior2.length || behavior1.length === 0) {
      return 1.0; // Maximum distance for incompatible or empty vectors
    }
    
    const sumSquaredDiffs = behavior1.reduce((sum, val, i) => {
      const diff = val - (behavior2[i] ?? 0);
      return sum + diff * diff;
    }, 0);

    return Math.sqrt(sumSquaredDiffs);
  }

  /**
   * Select parents based on novelty
   */
  private selectNoveltyBasedParents(population: Individual[]): Individual[] {
    // Sort by novelty (fitness in this context)
    const sorted = [...population].sort((a, b) => b.fitness - a.fitness);
    
    // Select top half as parents
    return sorted.slice(0, Math.floor(population.length / 2));
  }

  /**
   * Generate offspring for novelty search
   */
  private async generateNoveltyOffspring(parents: Individual[]): Promise<Individual[]> {
    const offspring: Individual[] = [];
    
    for (let i = 0; i < parents.length; i++) {
      const parent1 = parents[i];
      const parent2Index = Math.floor(Math.random() * parents.length);
      const parent2 = parents[parent2Index];
      
      if (!parent1 || !parent2) {
        continue; // Skip if parents not found
      }
      const child = await this.crossoverAndMutate(parent1, parent2);
      offspring.push(child);
    }
    
    return offspring;
  }

  /**
   * Update novelty archive with new individuals
   */
  private updateNoveltyArchive(population: Individual[]): void {
    for (const individual of population) {
      if (individual.fitness > this.config.noveltyThreshold && individual.behaviorDescriptor) {
        const record: NoveltyRecord = {
          individualId: individual.id,
          behaviorVector: individual.behaviorDescriptor,
          noveltyScore: individual.fitness,
          nearestNeighbors: [], // Would be populated with actual nearest neighbor IDs
          timestamp: new Date()
        };
        
        this.noveltyArchive.push(record);
      }
    }

    // Keep archive size manageable
    if (this.noveltyArchive.length > this.config.noveltyArchiveSize) {
      // Remove oldest records
      this.noveltyArchive.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      this.noveltyArchive = this.noveltyArchive.slice(0, this.config.noveltyArchiveSize);
    }
  }

  /**
   * Crossover and mutation operation
   */
  private async crossoverAndMutate(parent1: Individual, parent2: Individual): Promise<Individual> {
    // Create child genome by combining parents
    const childGenes = {
      promptTemplate: Math.random() < 0.5 ? parent1.genes.promptTemplate : parent2.genes.promptTemplate,
      systemPrompt: Math.random() < 0.5 ? parent1.genes.systemPrompt : parent2.genes.systemPrompt,
      parameters: {
        temperature: (parent1.genes.parameters.temperature + parent2.genes.parameters.temperature) / 2,
        topP: (parent1.genes.parameters.topP + parent2.genes.parameters.topP) / 2,
        maxTokens: Math.floor((parent1.genes.parameters.maxTokens + parent2.genes.parameters.maxTokens) / 2),
        frequencyPenalty: (parent1.genes.parameters.frequencyPenalty + parent2.genes.parameters.frequencyPenalty) / 2,
        presencePenalty: (parent1.genes.parameters.presencePenalty + parent2.genes.parameters.presencePenalty) / 2
      },
      reasoningStrategy: Math.random() < 0.5 ? parent1.genes.reasoningStrategy : parent2.genes.reasoningStrategy,
      modelPreferences: this.combineArrays(parent1.genes.modelPreferences, parent2.genes.modelPreferences),
      contextSize: Math.max(parent1.genes.contextSize, parent2.genes.contextSize)
    };

    // Apply mutations
    if (Math.random() < 0.3) { // 30% mutation rate
      childGenes.parameters.temperature += (Math.random() - 0.5) * 0.2;
      childGenes.parameters.temperature = Math.max(0.1, Math.min(2.0, childGenes.parameters.temperature));
    }

    if (Math.random() < 0.2) { // 20% mutation rate for prompts
      childGenes.promptTemplate = this.mutatePrompt(childGenes.promptTemplate);
    }

    // Create new individual
    const child: Individual = {
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

    return child;
  }

  /**
   * Combine two arrays with some randomness
   */
  private combineArrays<T>(arr1: T[], arr2: T[]): T[] {
    const combined = [...new Set([...arr1, ...arr2])];
    // Randomly sample from combined array
    const sampleSize = Math.min(combined.length, Math.max(arr1.length, arr2.length));
    return combined.slice(0, sampleSize);
  }

  /**
   * Mutate a prompt template
   */
  private mutatePrompt(prompt: string): string {
    const mutations = [
      (p: string) => p + '\nThink step by step.',
      (p: string) => p.replace('Analyze', 'Carefully analyze'),
      (p: string) => p + '\nProvide detailed reasoning.',
      (p: string) => p.replace('Solve', 'Systematically solve'),
      (p: string) => p + '\nConsider multiple perspectives.'
    ];

    const mutationIndex = Math.floor(Math.random() * mutations.length);
    const mutation = mutations[mutationIndex];
    if (!mutation) {
      return prompt; // Return original if no mutation found
    }
    return mutation(prompt);
  }

  /**
   * Update archive metrics
   */
  private updateArchiveMetrics(): void {
    const totalCells = this.getTotalCells();
    this.archive.occupancy = this.archive.cells.size;
    this.archive.coverage = this.archive.cells.size / totalCells;
    
    // QD-score: sum of all fitness values in archive
    this.archive.qd_score = Array.from(this.archive.cells.values())
      .reduce((sum, individual) => sum + individual.fitness, 0);
  }

  /**
   * Get total possible cells in archive
   */
  private getTotalCells(): number {
    return this.config.resolution.reduce((product, res) => product * res, 1);
  }

  /**
   * Create mock evaluation for testing
   */
  private createMockEvaluation(individual: Individual, task: Task): EvaluationResult {
    return {
      taskId: task.id,
      taskType: task.type,
      score: Math.random(),
      metrics: {
        accuracy: Math.random(),
        coherence: Math.random(),
        creativity: Math.random(),
        efficiency: Math.random(),
        factualness: Math.random(),
        relevance: Math.random(),
        diversity: Math.random()
      },
      executionTime: 1000,
      resourceUsage: {
        tokensUsed: 100,
        apiCalls: 1,
        computeTime: 1000,
        memoryUsed: 1024
      },
      errorRate: 0,
      timestamp: new Date()
    };
  }

  /**
   * Generate unique individual ID
   */
  private generateIndividualId(): string {
    return `qd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Public getter methods
   */
  public getArchive(): Archive {
    return { ...this.archive, cells: new Map(this.archive.cells) };
  }

  public getNoveltyArchive(): NoveltyRecord[] {
    return [...this.noveltyArchive];
  }

  public getArchiveStats(): {
    occupancy: number;
    coverage: number;
    qdScore: number;
    diversityMetrics: DiversityMetrics;
  } {
    const individuals = Array.from(this.archive.cells.values());
    
    return {
      occupancy: this.archive.occupancy,
      coverage: this.archive.coverage,
      qdScore: this.archive.qd_score,
      diversityMetrics: this.calculateDiversityMetrics(individuals)
    };
  }

  /**
   * Calculate diversity metrics for a population
   */
  private calculateDiversityMetrics(individuals: Individual[]): DiversityMetrics {
    if (individuals.length === 0) {
      return {
        behaviorCoverage: 0,
        phenotypicDiversity: 0,
        genotypicDiversity: 0,
        noveltyScore: 0
      };
    }

    // Behavior coverage: how much of behavior space is covered
    const behaviorCoverage = this.archive.coverage;

    // Phenotypic diversity: diversity in fitness values
    const fitnessValues = individuals.map(ind => ind.fitness);
    const fitnessVariance = this.calculateVariance(fitnessValues);
    const phenotypicDiversity = Math.sqrt(fitnessVariance);

    // Genotypic diversity: diversity in parameters
    const temperatureValues = individuals.map(ind => ind.genes.parameters.temperature);
    const tempVariance = this.calculateVariance(temperatureValues);
    const genotypicDiversity = Math.sqrt(tempVariance);

    // Average novelty score
    const noveltyScores = individuals
      .map(ind => ind.behaviorDescriptor)
      .filter(bd => bd && bd.length > 0)
      .map(bd => this.calculateBehaviorNovelty(bd));
    
    const averageNovelty = noveltyScores.length > 0 
      ? noveltyScores.reduce((sum, score) => sum + score, 0) / noveltyScores.length
      : 0;

    return {
      behaviorCoverage,
      phenotypicDiversity,
      genotypicDiversity,
      noveltyScore: averageNovelty
    };
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) {return 0;}
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }

  private calculateBehaviorNovelty(behaviorVector: number[]): number {
    const allBehaviors = Array.from(this.archive.cells.values())
      .map(ind => ind.behaviorDescriptor)
      .filter(bd => bd && bd.length > 0);

    if (allBehaviors.length === 0) {return 1.0;}

    const distances = allBehaviors.map(otherBehavior =>
      this.calculateBehaviorDistance(behaviorVector, otherBehavior)
    );

    distances.sort((a, b) => a - b);
    const kNearest = distances.slice(0, Math.min(this.config.kNearestNeighbors, distances.length));
    
    return kNearest.reduce((sum, dist) => sum + dist, 0) / kNearest.length;
  }
}

export const qualityDiversityEngine = new QualityDiversityEngine();
export default qualityDiversityEngine;