import { EventEmitter } from 'events';
import { log, LogContext } from '@/utils/logger';
import { modelDiscoveryService } from './model-discovery-service';
export class EvolutionaryModelMergeService extends EventEmitter {
    config;
    population = [];
    generation = 0;
    isEvolving = false;
    evolutionHistory = new Map();
    mergedModels = new Map();
    fitnessCache = new Map();
    MAX_CACHE_SIZE = 5000;
    MAX_HISTORY_SIZE = 20;
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
    async evolve(targetTask, config) {
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
        const maxEvolutionTime = 5 * 60 * 1000;
        const evolutionTimeout = Date.now() + maxEvolutionTime;
        try {
            this.population = await this.initializePopulation();
            for (let gen = 0; gen < this.config.generations; gen++) {
                if (Date.now() > evolutionTimeout) {
                    log.warn('Evolution timeout reached', LogContext.AI, { generation: gen });
                    break;
                }
                this.generation = gen;
                const evalPromise = this.evaluatePopulation(targetTask);
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Evaluation timeout')), 30000));
                try {
                    await Promise.race([evalPromise, timeoutPromise]);
                }
                catch (error) {
                    log.warn('Generation evaluation timeout', LogContext.AI, { generation: gen });
                    break;
                }
                this.population.sort((a, b) => b.fitness - a.fitness);
                this.evolutionHistory.set(gen, [...this.population]);
                if (this.evolutionHistory.size > this.MAX_HISTORY_SIZE) {
                    const oldestGen = Math.min(...Array.from(this.evolutionHistory.keys()));
                    this.evolutionHistory.delete(oldestGen);
                }
                this.cleanupCache();
                const convergence = this.calculateConvergence();
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
                if (convergence > 0.95) {
                    log.info('Evolution converged early', LogContext.AI, { generation: gen });
                    break;
                }
                await new Promise(resolve => setImmediate(resolve));
                if (gen < this.config.generations - 1) {
                    this.population = await this.createNextGeneration();
                }
            }
            const timeElapsed = Date.now() - startTime;
            const bestGenome = this.population[0];
            if (!bestGenome) {
                throw new Error('No viable genome found in population');
            }
            const result = {
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
        }
        finally {
            this.isEvolving = false;
        }
    }
    async initializePopulation() {
        const population = [];
        const availableModels = modelDiscoveryService.getModels();
        const candidateModels = availableModels.filter(m => this.config.targetCapabilities.some(cap => m.capabilities.includes(cap)));
        if (candidateModels.length < 2) {
            throw new Error('Not enough models for evolution');
        }
        for (let i = 0; i < this.config.populationSize; i++) {
            const genome = this.createRandomGenome(candidateModels);
            population.push(genome);
        }
        return population;
    }
    createRandomGenome(models) {
        const numModels = 2 + Math.floor(Math.random() * 3);
        const selectedModels = this.selectRandomModels(models, numModels);
        const layerSequence = this.generateRandomLayerSequence(selectedModels);
        const weights = this.generateRandomWeights(selectedModels);
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
    generateRandomLayerSequence(models) {
        const layers = [];
        const layerTypes = ['embedding', 'attention', 'mlp', 'norm'];
        const numLayers = 24 + Math.floor(Math.random() * 16);
        for (let i = 0; i < numLayers; i++) {
            const model = models[Math.floor(Math.random() * models.length)];
            const layerType = layerTypes[i % layerTypes.length] || 'attention';
            if (!model) {
                continue;
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
    generateRandomWeights(models) {
        const methods = ['dare_ties', 'linear', 'slerp', 'task_arithmetic'];
        const method = methods[Math.floor(Math.random() * methods.length)] || 'linear';
        const rawRatios = models.map(() => Math.random());
        const sum = rawRatios.reduce((a, b) => a + b, 0);
        const ratios = {};
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
    async evaluatePopulation(targetTask) {
        const evaluationPromises = this.population.map(genome => this.evaluateFitness(genome, targetTask));
        const fitnesses = await Promise.all(evaluationPromises);
        this.population.forEach((genome, i) => {
            const fitness = fitnesses[i];
            if (fitness !== undefined) {
                genome.fitness = fitness;
            }
        });
    }
    async evaluateFitness(genome, targetTask) {
        const cacheKey = JSON.stringify(genome.genes);
        if (this.fitnessCache.has(cacheKey)) {
            const cachedFitness = this.fitnessCache.get(cacheKey);
            if (cachedFitness !== undefined) {
                return cachedFitness;
            }
        }
        try {
            let fitness = 0;
            const accuracy = await this.evaluateAccuracy(genome, targetTask);
            fitness += accuracy * 0.4;
            const speed = await this.evaluateSpeed(genome);
            fitness += speed * 0.3;
            const sizeEfficiency = this.evaluateSizeEfficiency(genome);
            fitness += sizeEfficiency * 0.2;
            const diversity = this.evaluateDiversity(genome);
            fitness += diversity * 0.1;
            genome.metrics = {
                accuracy,
                speed,
                size: sizeEfficiency,
                diversity,
            };
            this.fitnessCache.set(cacheKey, fitness);
            return fitness;
        }
        catch (error) {
            log.warn('Fitness evaluation failed', LogContext.AI, {
                genomeId: genome.id,
                error: error instanceof Error ? error.message : String(error),
            });
            return 0;
        }
    }
    async evaluateAccuracy(genome, targetTask) {
        const { models } = genome.genes;
        const avgTier = models.reduce((sum, modelId) => {
            const model = modelDiscoveryService.getModels().find(m => m.id === modelId);
            return sum + (model?.tier || 2);
        }, 0) / models.length;
        const baseAccuracy = 0.6 + (avgTier / 4) * 0.3;
        return Math.min(1, baseAccuracy + (Math.random() - 0.5) * 0.1);
    }
    async evaluateSpeed(genome) {
        const { models } = genome.genes;
        const avgSize = models.reduce((sum, modelId) => {
            const model = modelDiscoveryService.getModels().find(m => m.id === modelId);
            return sum + (model?.sizeGB || 5);
        }, 0) / models.length;
        return Math.max(0, 1 - (avgSize / 30));
    }
    evaluateSizeEfficiency(genome) {
        const modelCount = genome.genes.models.length;
        const layerCount = genome.genes.layerSequence.length;
        const modelEfficiency = 1 / (1 + modelCount);
        const layerEfficiency = Math.max(0, 1 - (layerCount / 50));
        return (modelEfficiency + layerEfficiency) / 2;
    }
    evaluateDiversity(genome) {
        const { models } = genome.genes;
        const families = new Set();
        models.forEach(modelId => {
            const model = modelDiscoveryService.getModels().find(m => m.id === modelId);
            if (model?.metadata.family) {
                families.add(model.metadata.family);
            }
        });
        return families.size / Math.max(models.length, 1);
    }
    async createNextGeneration() {
        const nextGen = [];
        const elite = this.population.slice(0, this.config.eliteSize);
        nextGen.push(...elite.map(g => this.cloneGenome(g)));
        while (nextGen.length < this.config.populationSize) {
            if (Math.random() < this.config.crossoverRate) {
                const parent1 = this.selectParent();
                const parent2 = this.selectParent();
                const offspring = this.crossover(parent1, parent2);
                nextGen.push(offspring);
            }
            else {
                const parent = this.selectParent();
                const offspring = this.cloneGenome(parent);
                this.mutate(offspring);
                nextGen.push(offspring);
            }
        }
        return nextGen;
    }
    selectParent() {
        const tournamentSize = 3;
        const tournament = [];
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
        return bestTournament || fallbackGenome;
    }
    crossover(parent1, parent2) {
        const offspring = {
            id: `genome_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            generation: this.generation + 1,
            parents: [parent1.id, parent2.id],
            genes: {
                models: [],
                layerSequence: [],
                weights: parent1.genes.weights,
                scalingFactors: [],
            },
            fitness: 0,
            metrics: {},
        };
        const allModels = [...new Set([...parent1.genes.models, ...parent2.genes.models])];
        const numModels = Math.min(4, 2 + Math.floor(Math.random() * (allModels.length - 1)));
        offspring.genes.models = this.selectRandomModels(allModels.map(id => ({ id })), numModels).map(m => m.id);
        const maxLayers = Math.max(parent1.genes.layerSequence.length, parent2.genes.layerSequence.length);
        for (let i = 0; i < maxLayers; i++) {
            const source = Math.random() < 0.5 ? parent1 : parent2;
            if (i < source.genes.layerSequence.length) {
                const layer = source.genes.layerSequence[i];
                if (layer) {
                    offspring.genes.layerSequence.push({ ...layer });
                }
            }
        }
        offspring.genes.weights = {
            method: Math.random() < 0.5 ? parent1.genes.weights.method : parent2.genes.weights.method,
            ratios: {},
            sparsity: ((parent1.genes.weights.sparsity || 0) + (parent2.genes.weights.sparsity || 0)) / 2,
            density: ((parent1.genes.weights.density || 0) + (parent2.genes.weights.density || 0)) / 2,
        };
        const rawRatios = offspring.genes.models.map(() => Math.random());
        const sum = rawRatios.reduce((a, b) => a + b, 0);
        offspring.genes.models.forEach((modelId, i) => {
            const ratio = rawRatios[i];
            if (ratio !== undefined) {
                offspring.genes.weights.ratios[modelId] = ratio / sum;
            }
        });
        offspring.genes.scalingFactors = offspring.genes.models.map(() => 0.8 + Math.random() * 0.4);
        if (Math.random() < this.config.mutationRate) {
            this.mutate(offspring);
        }
        return offspring;
    }
    mutate(genome) {
        const mutationType = Math.floor(Math.random() * 4);
        switch (mutationType) {
            case 0:
                if (genome.genes.layerSequence.length > 0) {
                    const idx = Math.floor(Math.random() * genome.genes.layerSequence.length);
                    const layer = genome.genes.layerSequence[idx];
                    if (layer) {
                        layer.scalingWeight = 0.8 + Math.random() * 0.4;
                    }
                }
                break;
            case 1:
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
            case 2:
                if (genome.genes.scalingFactors.length > 0) {
                    const idx = Math.floor(Math.random() * genome.genes.scalingFactors.length);
                    if (idx < genome.genes.scalingFactors.length) {
                        genome.genes.scalingFactors[idx] = 0.8 + Math.random() * 0.4;
                    }
                }
                break;
            case 3:
                const methods = ['dare_ties', 'linear', 'slerp', 'task_arithmetic'];
                genome.genes.weights.method = methods[Math.floor(Math.random() * methods.length)] || 'linear';
                break;
        }
    }
    cloneGenome(genome) {
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
    selectRandomModels(models, count) {
        const selected = [];
        const available = [...models];
        while (selected.length < count && available.length > 0) {
            const idx = Math.floor(Math.random() * available.length);
            selected.push(available[idx]);
            available.splice(idx, 1);
        }
        return selected;
    }
    calculateConvergence() {
        if (this.population.length === 0)
            return 0;
        const fitnesses = this.population.map(g => g.fitness);
        const maxFitness = Math.max(...fitnesses);
        const minFitness = Math.min(...fitnesses);
        const range = maxFitness - minFitness;
        if (range === 0)
            return 1;
        const mean = fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length;
        const variance = fitnesses.reduce((sum, f) => sum + Math.pow(f - mean, 2), 0) / fitnesses.length;
        const stdDev = Math.sqrt(variance);
        return Math.max(0, 1 - (stdDev / range));
    }
    getAverageFitness() {
        if (this.population.length === 0)
            return 0;
        return this.population.reduce((sum, g) => sum + g.fitness, 0) / this.population.length;
    }
    async applyGenome(genome) {
        log.info('🔨 Applying genome to create merged model', LogContext.AI, {
            genomeId: genome.id,
            models: genome.genes.models,
            fitness: genome.fitness,
        });
        const mergedModelId = `merged_${Date.now()}`;
        this.mergedModels.set(mergedModelId, {
            genome,
            createdAt: new Date(),
            performance: genome.metrics,
        });
        return mergedModelId;
    }
    cleanupCache() {
        if (this.fitnessCache.size > this.MAX_CACHE_SIZE) {
            const entries = Array.from(this.fitnessCache.entries());
            this.fitnessCache.clear();
            entries.slice(-Math.floor(this.MAX_CACHE_SIZE / 2))
                .forEach(([key, value]) => this.fitnessCache.set(key, value));
            log.info('Cleaned fitness cache', LogContext.AI, {
                previousSize: entries.length,
                newSize: this.fitnessCache.size,
            });
        }
    }
    getHistory() {
        return new Map(this.evolutionHistory);
    }
    getMergedModels() {
        return new Map(this.mergedModels);
    }
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        log.info('Evolution config updated', LogContext.AI, this.config);
    }
    stop() {
        this.isEvolving = false;
    }
}
export const evolutionaryModelMergeService = new EvolutionaryModelMergeService();
//# sourceMappingURL=evolutionary-model-merge-service.js.map