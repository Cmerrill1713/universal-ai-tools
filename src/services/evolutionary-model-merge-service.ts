/**
 * Evolutionary Model Merge Service
 * Implements Sakana AI's approach to automatically discover optimal model combinations
 * using evolutionary algorithms in both parameter and data flow space
 */

import { EventEmitter } from 'events';

import { log, LogContext } from '@/utils/logger';

import { dynamicModelRouter } from './dynamic-model-router';
import type { DiscoveredModel} from './model-discovery-service';
import {modelDiscoveryService } from './model-discovery-service';

export interface ModelGenome {
  id: string;
  generation: number;
  parents: string[];
  genes: {
    models: string[];              // Source model IDs
    layerSequence: LayerConfig[];  // Layer arrangement
    weights: WeightConfig;         // Weight mixing ratios
    scalingFactors: number[];      // Input/output scaling
  };
  fitness: number;
  metrics: {
    accuracy?: number;
    speed?: number;
    size?: number;
    diversity?: number;
  };
}

export interface LayerConfig {
  sourceModel: string;
  layerIndex: number;
  layerType: 'attention' | 'mlp' | 'norm' | 'embedding';
  scalingWeight: number;
}

export interface WeightConfig {
  method: 'dare_ties' | 'linear' | 'slerp' | 'task_arithmetic';
  ratios: Record<string, number>;  // Model ID to weight ratio
  sparsity?: number;               // For DARE
  density?: number;                // For pruning
}

export interface EvolutionConfig extends Record<string, unknown> {
  populationSize: number;
  generations: number;
  mutationRate: number;
  crossoverRate: number;
  eliteSize: number;
  fitnessFunction: 'accuracy' | 'speed' | 'balanced' | 'custom';
  targetCapabilities: string[];
}

export interface EvolutionResult {
  bestGenome: ModelGenome;
  population: ModelGenome[];
  generation: number;
  convergence: number;
  timeElapsed: number;
}

export class EvolutionaryModelMergeService extends EventEmitter {
  private config: EvolutionConfig;
  private population: ModelGenome[] = [];
  private generation = 0;
  private isEvolving = false;
  private evolutionHistory: Map<number, ModelGenome[]> = new Map();
  private mergedModels: Map<string, any> = new Map();
  private fitnessCache: Map<string, number> = new Map();
  private readonly MAX_CACHE_SIZE = 5000;
  private readonly MAX_HISTORY_SIZE = 20;

  constructor() {
    super();
    
    this.config = {
      populationSize: 50,
      generations: 100,
      mutationRate: 0.2,
      crossoverRate: 0.7,
      eliteSize: 5,
      fitnessFunction: 'balanced',
      targetCapabilities: ['general'],
    };
  }

  /**
   * Start evolutionary process
   */
  public async evolve(
    targetTask: string,
    config?: Partial<EvolutionConfig>
  ): Promise<EvolutionResult> {
    if (this.isEvolving) {
      throw new Error('Evolution already in progress');
    }

    this.isEvolving = true;
    this.generation = 0;
    this.config = { ...this.config, ...config };

    log.info('🧬 Starting evolutionary model merge', LogContext.AI, {
      targetTask,
      populationSize: this.config.populationSize,
      generations: this.config.generations,
    });

    const startTime = Date.now();

    const maxEvolutionTime = 5 * 60 * 1000; // 5 minutes max
    const evolutionTimeout = Date.now() + maxEvolutionTime;
    
    try {
      // Initialize population
      this.population = await this.initializePopulation();
      
      // Evolution loop with timeout protection
      for (let gen = 0; gen < this.config.generations; gen++) {
        // Check timeout
        if (Date.now() > evolutionTimeout) {
          log.warn('Evolution timeout reached', LogContext.AI, { generation: gen });
          break;
        }
        
        this.generation = gen;
        
        // Evaluate fitness with timeout
        const evalPromise = this.evaluatePopulation(targetTask);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Evaluation timeout')), 30000)
        );
        
        try {
          await Promise.race([evalPromise, timeoutPromise]);
        } catch (error) {
          log.warn('Generation evaluation timeout', LogContext.AI, { generation: gen });
          break;
        }
        
        // Sort by fitness
        this.population.sort((a, b) => b.fitness - a.fitness);
        
        // Store history with size limit
        this.evolutionHistory.set(gen, [...this.population]);
        if (this.evolutionHistory.size > this.MAX_HISTORY_SIZE) {
          // Keep only recent generations
          const oldestGen = Math.min(...Array.from(this.evolutionHistory.keys()));
          this.evolutionHistory.delete(oldestGen);
        }
        
        // Clean up cache if it gets too large
        this.cleanupCache();
        
        // Check convergence
        const convergence = this.calculateConvergence();
        
        // Emit progress
        this.emit('generation-complete', {
          generation: gen,
          bestFitness: this.population[0]?.fitness ?? 0,
          averageFitness: this.getAverageFitness(),
          convergence,
        });
        
        log.info(`Generation ${gen} complete`, LogContext.AI, {
          bestFitness: (this.population[0]?.fitness ?? 0).toFixed(4),
          convergence: convergence.toFixed(4),
        });
        
        // Early stopping if converged
        if (convergence > 0.95) {
          log.info('Evolution converged early', LogContext.AI, { generation: gen });
          break;
        }
        
        // Yield to event loop
        await new Promise(resolve => setImmediate(resolve));
        
        // Create next generation
        if (gen < this.config.generations - 1) {
          this.population = await this.createNextGeneration();
        }
      }
      
      const timeElapsed = Date.now() - startTime;
      const bestGenome = this.population[0];
      if (!bestGenome) {
        throw new Error('No viable genome found in population');
      }
      
      const result: EvolutionResult = {
        bestGenome,
        population: this.population,
        generation: this.generation,
        convergence: this.calculateConvergence(),
        timeElapsed,
      };
      
      log.info('✅ Evolution completed', LogContext.AI, {
        bestFitness: result.bestGenome.fitness.toFixed(4),
        generations: this.generation,
        timeElapsed: `${(timeElapsed / 1000).toFixed(1)}s`,
      });
      
      return result;
    } finally {
      this.isEvolving = false;
    }
  }

  /**
   * Initialize random population
   */
  private async initializePopulation(): Promise<ModelGenome[]> {
    const population: ModelGenome[] = [];
    const availableModels = modelDiscoveryService.getModels();
    
    // Filter models by target capabilities
    const candidateModels = availableModels.filter(m =>
      this.config.targetCapabilities.some(cap => m.capabilities.includes(cap))
    );
    
    if (candidateModels.length < 2) {
      throw new Error('Not enough models for evolution');
    }
    
    for (let i = 0; i < this.config.populationSize; i++) {
      const genome = this.createRandomGenome(candidateModels);
      population.push(genome);
    }
    
    return population;
  }

  /**
   * Create random genome
   */
  private createRandomGenome(models: DiscoveredModel[]): ModelGenome {
    // Select 2-4 random models
    const numModels = 2 + Math.floor(Math.random() * 3);
    const selectedModels = this.selectRandomModels(models, numModels);
    
    // Generate random layer sequence
    const layerSequence = this.generateRandomLayerSequence(selectedModels);
    
    // Generate random weight configuration
    const weights = this.generateRandomWeights(selectedModels);
    
    // Generate scaling factors
    const scalingFactors = selectedModels.map(() => 0.8 + Math.random() * 0.4);
    
    return {
      id: `genome_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      generation: this.generation,
      parents: [],
      genes: {
        models: selectedModels.map(m => m.id),
        layerSequence,
        weights,
        scalingFactors,
      },
      fitness: 0,
      metrics: {},
    };
  }

  /**
   * Generate random layer sequence
   */
  private generateRandomLayerSequence(models: DiscoveredModel[]): LayerConfig[] {
    const layers: LayerConfig[] = [];
    const layerTypes: LayerConfig['layerType'][] = ['embedding', 'attention', 'mlp', 'norm'];
    
    // Typical transformer has ~32 layers
    const numLayers = 24 + Math.floor(Math.random() * 16);
    
    for (let i = 0; i < numLayers; i++) {
      const model = models[Math.floor(Math.random() * models.length)];
      const layerType = layerTypes[i % layerTypes.length] || 'attention';
      
      if (!model) {
        continue; // Skip if no model available
      }
      
      layers.push({
        sourceModel: model.id,
        layerIndex: i,
        layerType,
        scalingWeight: 0.8 + Math.random() * 0.4,
      });
    }
    
    return layers;
  }

  /**
   * Generate random weight configuration
   */
  private generateRandomWeights(models: DiscoveredModel[]): WeightConfig {
    const methods: WeightConfig['method'][] = ['dare_ties', 'linear', 'slerp', 'task_arithmetic'];
    const method = methods[Math.floor(Math.random() * methods.length)] || 'linear';
    
    // Generate ratios that sum to 1
    const rawRatios = models.map(() => Math.random());
    const sum = rawRatios.reduce((a, b) => a + b, 0);
    const ratios: Record<string, number> = {};
    
    models.forEach((model, i) => {
      if (model?.id && rawRatios[i] !== undefined) {
        ratios[model.id] = rawRatios[i] / sum;
      }
    });
    
    return {
      method,
      ratios,
      sparsity: method === 'dare_ties' ? Math.random() * 0.5 : 0,
      density: Math.random() * 0.3 + 0.7,
    };
  }

  /**
   * Evaluate population fitness
   */
  private async evaluatePopulation(targetTask: string): Promise<void> {
    const evaluationPromises = this.population.map(genome =>
      this.evaluateFitness(genome, targetTask)
    );
    
    const fitnesses = await Promise.all(evaluationPromises);
    
    this.population.forEach((genome, i) => {
      const fitness = fitnesses[i];
      if (fitness !== undefined) {
        genome.fitness = fitness;
      }
    });
  }

  /**
   * Evaluate individual genome fitness
   */
  private async evaluateFitness(genome: ModelGenome, targetTask: string): Promise<number> {
    // Check cache
    const cacheKey = JSON.stringify(genome.genes);
    if (this.fitnessCache.has(cacheKey)) {
      const cachedFitness = this.fitnessCache.get(cacheKey);
      if (cachedFitness !== undefined) {
        return cachedFitness;
      }
    }
    
    try {
      // Simulate model merging and evaluation
      // In practice, this would:
      // 1. Merge models according to genome
      // 2. Run evaluation on test set
      // 3. Measure performance metrics
      
      let fitness = 0;
      
      // Accuracy component (simulated)
      const accuracy = await this.evaluateAccuracy(genome, targetTask);
      fitness += accuracy * 0.4;
      
      // Speed component
      const speed = await this.evaluateSpeed(genome);
      fitness += speed * 0.3;
      
      // Size efficiency
      const sizeEfficiency = this.evaluateSizeEfficiency(genome);
      fitness += sizeEfficiency * 0.2;
      
      // Diversity bonus
      const diversity = this.evaluateDiversity(genome);
      fitness += diversity * 0.1;
      
      // Store metrics
      genome.metrics = {
        accuracy,
        speed,
        size: sizeEfficiency,
        diversity,
      };
      
      // Cache result
      this.fitnessCache.set(cacheKey, fitness);
      
      return fitness;
    } catch (error) {
      log.warn('Fitness evaluation failed', LogContext.AI, {
        genomeId: genome.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Evaluate accuracy (simulated)
   */
  private async evaluateAccuracy(genome: ModelGenome, targetTask: string): Promise<number> {
    // In practice, run model on test set
    // For now, simulate based on model quality
    const {models} = genome.genes;
    const avgTier = models.reduce((sum, modelId) => {
      const model = modelDiscoveryService.getModels().find(m => m.id === modelId);
      return sum + (model?.tier || 2);
    }, 0) / models.length;
    
    // Higher tier models generally have better accuracy
    const baseAccuracy = 0.6 + (avgTier / 4) * 0.3;
    
    // Add randomness to simulate evaluation variance
    return Math.min(1, baseAccuracy + (Math.random() - 0.5) * 0.1);
  }

  /**
   * Evaluate speed
   */
  private async evaluateSpeed(genome: ModelGenome): Promise<number> {
    // Calculate based on model sizes
    const {models} = genome.genes;
    const avgSize = models.reduce((sum, modelId) => {
      const model = modelDiscoveryService.getModels().find(m => m.id === modelId);
      return sum + (model?.sizeGB || 5);
    }, 0) / models.length;
    
    // Smaller models are faster
    return Math.max(0, 1 - (avgSize / 30));
  }

  /**
   * Evaluate size efficiency
   */
  private evaluateSizeEfficiency(genome: ModelGenome): number {
    // Prefer fewer models and layers
    const modelCount = genome.genes.models.length;
    const layerCount = genome.genes.layerSequence.length;
    
    const modelEfficiency = 1 / (1 + modelCount);
    const layerEfficiency = Math.max(0, 1 - (layerCount / 50));
    
    return (modelEfficiency + layerEfficiency) / 2;
  }

  /**
   * Evaluate diversity
   */
  private evaluateDiversity(genome: ModelGenome): number {
    // Reward using models from different families
    const {models} = genome.genes;
    const families = new Set<string>();
    
    models.forEach(modelId => {
      const model = modelDiscoveryService.getModels().find(m => m.id === modelId);
      if (model?.metadata.family) {
        families.add(model.metadata.family);
      }
    });
    
    return families.size / Math.max(models.length, 1);
  }

  /**
   * Create next generation
   */
  private async createNextGeneration(): Promise<ModelGenome[]> {
    const nextGen: ModelGenome[] = [];
    
    // Keep elite
    const elite = this.population.slice(0, this.config.eliteSize);
    nextGen.push(...elite.map(g => this.cloneGenome(g)));
    
    // Fill rest with offspring
    while (nextGen.length < this.config.populationSize) {
      if (Math.random() < this.config.crossoverRate) {
        // Crossover
        const parent1 = this.selectParent();
        const parent2 = this.selectParent();
        const offspring = this.crossover(parent1, parent2);
        nextGen.push(offspring);
      } else {
        // Clone and mutate
        const parent = this.selectParent();
        const offspring = this.cloneGenome(parent);
        this.mutate(offspring);
        nextGen.push(offspring);
      }
    }
    
    return nextGen;
  }

  /**
   * Select parent using tournament selection
   */
  private selectParent(): ModelGenome {
    const tournamentSize = 3;
    const tournament: ModelGenome[] = [];
    
    for (let i = 0; i < tournamentSize; i++) {
      const idx = Math.floor(Math.random() * this.population.length);
      const genome = this.population[idx];
      if (genome) {
        tournament.push(genome);
      }
    }
    
    tournament.sort((a, b) => b.fitness - a.fitness);
    const bestTournament = tournament[0];
    const fallbackGenome = this.population[0];
    if (!bestTournament && !fallbackGenome) {
      throw new Error('No valid genome available for selection');
    }
    return bestTournament || fallbackGenome; // We've already checked for undefined above
  }

  /**
   * Crossover two genomes
   */
  private crossover(parent1: ModelGenome, parent2: ModelGenome): ModelGenome {
    const offspring: ModelGenome = {
      id: `genome_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      generation: this.generation + 1,
      parents: [parent1.id, parent2.id],
      genes: {
        models: [],
        layerSequence: [],
        weights: parent1.genes.weights, // Will be updated
        scalingFactors: [],
      },
      fitness: 0,
      metrics: {},
    };
    
    // Crossover models
    const allModels = [...new Set([...parent1.genes.models, ...parent2.genes.models])];
    const numModels = Math.min(4, 2 + Math.floor(Math.random() * (allModels.length - 1)));
    offspring.genes.models = this.selectRandomModels(
      allModels.map(id => ({ id } as any)),
      numModels
    ).map(m => m.id);
    
    // Crossover layers (uniform crossover)
    const maxLayers = Math.max(
      parent1.genes.layerSequence.length,
      parent2.genes.layerSequence.length
    );
    
    for (let i = 0; i < maxLayers; i++) {
      const source = Math.random() < 0.5 ? parent1 : parent2;
      if (i < source.genes.layerSequence.length) {
        const layer = source.genes.layerSequence[i];
        if (layer) {
          offspring.genes.layerSequence.push({ ...layer });
        }
      }
    }
    
    // Crossover weights
    offspring.genes.weights = {
      method: Math.random() < 0.5 ? parent1.genes.weights.method : parent2.genes.weights.method,
      ratios: {},
      sparsity: ((parent1.genes.weights.sparsity || 0) + (parent2.genes.weights.sparsity || 0)) / 2,
      density: ((parent1.genes.weights.density || 0) + (parent2.genes.weights.density || 0)) / 2,
    };
    
    // Recalculate weight ratios for offspring models
    const rawRatios = offspring.genes.models.map(() => Math.random());
    const sum = rawRatios.reduce((a, b) => a + b, 0);
    offspring.genes.models.forEach((modelId, i) => {
      const ratio = rawRatios[i];
      if (ratio !== undefined) {
        offspring.genes.weights.ratios[modelId] = ratio / sum;
      }
    });
    
    // Crossover scaling factors
    offspring.genes.scalingFactors = offspring.genes.models.map(() =>
      0.8 + Math.random() * 0.4
    );
    
    // Apply mutation
    if (Math.random() < this.config.mutationRate) {
      this.mutate(offspring);
    }
    
    return offspring;
  }

  /**
   * Mutate genome
   */
  private mutate(genome: ModelGenome): void {
    const mutationType = Math.floor(Math.random() * 4);
    
    switch (mutationType) {
      case 0: // Mutate layer sequence
        if (genome.genes.layerSequence.length > 0) {
          const idx = Math.floor(Math.random() * genome.genes.layerSequence.length);
          const layer = genome.genes.layerSequence[idx];
          if (layer) {
            layer.scalingWeight = 0.8 + Math.random() * 0.4;
          }
        }
        break;
        
      case 1: // Mutate weights
        const modelIds = Object.keys(genome.genes.weights.ratios);
        if (modelIds.length > 0) {
          const rawRatios = modelIds.map(() => Math.random());
          const sum = rawRatios.reduce((a, b) => a + b, 0);
          modelIds.forEach((id, i) => {
            const ratio = rawRatios[i];
            if (ratio !== undefined) {
              genome.genes.weights.ratios[id] = ratio / sum;
            }
          });
        }
        break;
        
      case 2: // Mutate scaling factors
        if (genome.genes.scalingFactors.length > 0) {
          const idx = Math.floor(Math.random() * genome.genes.scalingFactors.length);
          if (idx < genome.genes.scalingFactors.length) {
            genome.genes.scalingFactors[idx] = 0.8 + Math.random() * 0.4;
          }
        }
        break;
        
      case 3: // Mutate method
        const methods: WeightConfig['method'][] = ['dare_ties', 'linear', 'slerp', 'task_arithmetic'];
        genome.genes.weights.method = methods[Math.floor(Math.random() * methods.length)] || 'linear';
        break;
    }
  }

  /**
   * Clone genome
   */
  private cloneGenome(genome: ModelGenome): ModelGenome {
    return {
      ...genome,
      id: `genome_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      generation: this.generation + 1,
      parents: [genome.id],
      genes: JSON.parse(JSON.stringify(genome.genes)),
      fitness: 0,
      metrics: {},
    };
  }

  /**
   * Select random models
   */
  private selectRandomModels(models: any[], count: number): any[] {
    const selected: any[] = [];
    const available = [...models];
    
    while (selected.length < count && available.length > 0) {
      const idx = Math.floor(Math.random() * available.length);
      selected.push(available[idx]);
      available.splice(idx, 1);
    }
    
    return selected;
  }

  /**
   * Calculate convergence
   */
  private calculateConvergence(): number {
    if (this.population.length === 0) {return 0;}
    
    const fitnesses = this.population.map(g => g.fitness);
    const maxFitness = Math.max(...fitnesses);
    const minFitness = Math.min(...fitnesses);
    const range = maxFitness - minFitness;
    
    if (range === 0) {return 1;}
    
    // Calculate standard deviation
    const mean = fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length;
    const variance = fitnesses.reduce((sum, f) => sum + Math.pow(f - mean, 2), 0) / fitnesses.length;
    const stdDev = Math.sqrt(variance);
    
    // Convergence increases as std dev decreases
    return Math.max(0, 1 - (stdDev / range));
  }

  /**
   * Get average fitness
   */
  private getAverageFitness(): number {
    if (this.population.length === 0) {return 0;}
    return this.population.reduce((sum, g) => sum + g.fitness, 0) / this.population.length;
  }

  /**
   * Apply best genome to create merged model
   */
  public async applyGenome(genome: ModelGenome): Promise<string> {
    log.info('🔨 Applying genome to create merged model', LogContext.AI, {
      genomeId: genome.id,
      models: genome.genes.models,
      fitness: genome.fitness,
    });
    
    // In practice, this would:
    // 1. Load the source models
    // 2. Apply the merging recipe (weights, layers)
    // 3. Save the merged model
    // 4. Register with model discovery service
    
    const mergedModelId = `merged_${Date.now()}`;
    
    // Store merged model info
    this.mergedModels.set(mergedModelId, {
      genome,
      createdAt: new Date(),
      performance: genome.metrics,
    });
    
    return mergedModelId;
  }

  /**
   * Clean up cache to prevent memory leaks
   */
  private cleanupCache(): void {
    if (this.fitnessCache.size > this.MAX_CACHE_SIZE) {
      // Keep only half the cache (most recent entries)
      const entries = Array.from(this.fitnessCache.entries());
      this.fitnessCache.clear();
      
      // Keep recent half based on timestamp in key (rough heuristic)
      entries.slice(-Math.floor(this.MAX_CACHE_SIZE / 2))
        .forEach(([key, value]) => this.fitnessCache.set(key, value));
        
      log.info('Cleaned fitness cache', LogContext.AI, {
        previousSize: entries.length,
        newSize: this.fitnessCache.size,
      });
    }
  }

  /**
   * Get evolution history
   */
  public getHistory(): Map<number, ModelGenome[]> {
    return new Map(this.evolutionHistory);
  }

  /**
   * Get merged models
   */
  public getMergedModels(): Map<string, any> {
    return new Map(this.mergedModels);
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<EvolutionConfig>): void {
    this.config = { ...this.config, ...config };
    log.info('Evolution config updated', LogContext.AI, this.config as Record<string, unknown>);
  }

  /**
   * Stop evolution
   */
  public stop(): void {
    this.isEvolving = false;
  }
}

// Singleton instance
export const evolutionaryModelMergeService = new EvolutionaryModelMergeService();