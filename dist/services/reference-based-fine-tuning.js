import { log, LogContext } from '@/utils/logger';
import { mlxFineTuningService } from './mlx-fine-tuning-service';
export class ReferenceBasedFineTuning {
    techniqueImplementations;
    constructor() {
        this.techniqueImplementations = new Map();
        this.initializeTechniques();
    }
    initializeTechniques() {
        this.techniqueImplementations.set('evolutionary', {
            name: 'Sakana AI Evolutionary Fine-Tuning',
            description: 'Uses evolutionary algorithms to discover optimal architectures',
            implementation: this.implementEvolutionaryFineTuning.bind(this),
            defaultParams: {
                evolutionaryParams: {
                    populationSize: 20,
                    mutationRate: 0.1,
                    crossoverRate: 0.7,
                    selectionPressure: 2.0,
                    eliteRatio: 0.1,
                    generations: 50,
                    fitnessMetric: 'combined',
                },
            },
        });
        this.techniqueImplementations.set('lora', {
            name: 'Low-Rank Adaptation (LoRA)',
            description: 'Efficient fine-tuning with low-rank matrices',
            implementation: this.implementLoRAFineTuning.bind(this),
            defaultParams: {
                rankSize: 8,
                alphaScaling: 16,
                dropoutRate: 0.1,
                learningRate: { min: 0.0001, max: 0.001, optimal: 0.0003 },
            },
        });
        this.techniqueImplementations.set('dpo', {
            name: 'Direct Preference Optimization',
            description: 'Fine-tune based on preference data without RL',
            implementation: this.implementDPOFineTuning.bind(this),
            defaultParams: {
                betaCoefficient: 0.1,
                learningRate: { min: 0.00001, max: 0.0001, optimal: 0.00005 },
            },
        });
    }
    async extractParametersFromReferences(references) {
        const allParams = {};
        for (const ref of references) {
            try {
                log.info('📚 Extracting parameters from reference', LogContext.AI, {
                    title: ref.title,
                    url: ref.url,
                });
                if (!globalThis.fetch)
                    continue;
                const response = await globalThis.fetch(ref.url);
                const content = await response.text();
                const extractedParams = await this.analyzeResearchContent(content, ref.technique);
                this.mergeParameters(allParams, extractedParams);
                ref.extractedParams = extractedParams;
            }
            catch (error) {
                log.warn('⚠️ Failed to extract from reference', LogContext.AI, {
                    url: ref.url,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
        return allParams;
    }
    async analyzeResearchContent(content, technique) {
        const params = {};
        const lrPatterns = [
            /learning\s*rate[:=]\s*([\d.e-]+)/gi,
            /lr[:=]\s*([\d.e-]+)/gi,
            /α\s*=\s*([\d.e-]+)/gi,
        ];
        for (const pattern of lrPatterns) {
            const matches = content.matchAll(pattern);
            for (const match of matches) {
                const lr = parseFloat(match[1]);
                if (!isNaN(lr)) {
                    params.learningRate = params.learningRate || { min: lr, max: lr };
                    params.learningRate.optimal = lr;
                }
            }
        }
        const batchPatterns = [/batch\s*size[:=]\s*(\d+)/gi, /batch[:=]\s*(\d+)/gi, /B\s*=\s*(\d+)/gi];
        const batchSizes = [];
        for (const pattern of batchPatterns) {
            const matches = content.matchAll(pattern);
            for (const match of matches) {
                const size = parseInt(match[1], 10);
                if (!isNaN(size)) {
                    batchSizes.push(size);
                }
            }
        }
        if (batchSizes.length > 0) {
            params.batchSize = [...new Set(batchSizes)];
        }
        if (technique === 'evolutionary') {
            params.evolutionaryParams = this.extractEvolutionaryParams(content);
        }
        else if (technique === 'lora') {
            params.rankSize = this.extractNumber(content, /rank[:=]\s*(\d+)/i) || 8;
            params.alphaScaling = this.extractNumber(content, /alpha[:=]\s*(\d+)/i) || 16;
        }
        return params;
    }
    async startReferenceBasedFineTuning(request) {
        log.info('🔬 Starting reference-based fine-tuning', LogContext.AI, {
            agent: request.agentName,
            references: request.references.length,
            techniques: request.references.map((r) => r.technique),
        });
        let extractedParams = {};
        if (request.autoExtractParams) {
            extractedParams = await this.extractParametersFromReferences(request.references);
        }
        const primaryTechnique = this.selectPrimaryTechnique(request.references);
        const implementation = this.techniqueImplementations.get(primaryTechnique);
        if (!implementation) {
            throw new Error(`No implementation found for technique: ${primaryTechnique}`);
        }
        const combinedParams = this.combineParameters(extractedParams, implementation.defaultParams, request.references);
        const result = await implementation.implementation({
            agentName: request.agentName,
            baseModel: request.baseModel,
            datasetPath: request.datasetPath,
            parameters: combinedParams,
            targetCapabilities: request.targetCapabilities,
            experimentName: request.experimentName,
        });
        return {
            jobId: result.jobId,
            technique: primaryTechnique,
            estimatedTime: result.estimatedTime,
        };
    }
    async implementEvolutionaryFineTuning(config) {
        const evolutionParams = config.parameters.evolutionaryParams;
        log.info('🧬 Starting evolutionary fine-tuning', LogContext.AI, {
            populationSize: evolutionParams.populationSize,
            generations: evolutionParams.generations,
        });
        const population = await this.createInitialPopulation(config.baseModel, evolutionParams.populationSize);
        let fitnessScores = [];
        for (let gen = 0; gen < evolutionParams.generations; gen++) {
            fitnessScores = await this.evaluatePopulationFitness(population, config.datasetPath, evolutionParams.fitnessMetric);
            const parents = this.selectParents(population, fitnessScores, evolutionParams.selectionPressure);
            const offspring = await this.createOffspring(parents, evolutionParams.crossoverRate, evolutionParams.mutationRate);
            population.splice(0);
            population.push(...this.selectElite(population, fitnessScores, evolutionParams.eliteRatio));
            population.push(...offspring);
            log.info(`🧬 Generation ${gen + 1}/${evolutionParams.generations}`, LogContext.AI, {
                bestFitness: Math.max(...fitnessScores),
                avgFitness: fitnessScores.reduce((a, b) => a + b) / fitnessScores.length,
            });
        }
        const bestIndividual = this.getBestIndividual(population, fitnessScores);
        return mlxFineTuningService.createFineTuningJob('evolutionary-tuning', config.userId || 'system', config.baseModel, config.baseModelPath || config.baseModel, config.datasetPath, bestIndividual.hyperparameters, {
            splitRatio: 0.2,
            validationMetrics: ['loss', 'accuracy'],
            earlyStopping: true,
            patience: 3,
        });
    }
    async implementLoRAFineTuning(config) {
        log.info('🔗 Starting LoRA fine-tuning', LogContext.AI, {
            rank: config.parameters.rankSize,
            alpha: config.parameters.alphaScaling,
        });
        const hyperparameters = {
            learningRate: config.parameters.learningRate.optimal || 0.0003,
            batchSize: 4,
            epochs: 3,
            maxSeqLength: 2048,
            gradientAccumulation: 1,
            warmupSteps: 100,
            weightDecay: 0.01,
            dropout: config.parameters.dropoutRate || 0.1,
        };
        return mlxFineTuningService.createFineTuningJob('lora-tuning', config.userId || 'system', config.baseModel, config.baseModelPath || config.baseModel, config.datasetPath, hyperparameters, {
            splitRatio: 0.2,
            validationMetrics: ['loss', 'perplexity'],
            earlyStopping: true,
            patience: 5,
        });
    }
    async implementDPOFineTuning(config) {
        log.info('🎯 Starting DPO fine-tuning', LogContext.AI, {
            beta: config.parameters.betaCoefficient,
        });
        const preferenceDataset = await this.convertToPreferenceFormat(config.datasetPath);
        return mlxFineTuningService.createFineTuningJob('dpo-tuning', config.userId || 'system', config.baseModel, config.baseModelPath || config.baseModel, preferenceDataset, {
            learningRate: config.parameters.learningRate?.optimal || 0.00005,
            batchSize: 2,
            epochs: 1,
            maxSeqLength: 2048,
            gradientAccumulation: 4,
            warmupSteps: 100,
            weightDecay: 0.01,
            dropout: 0.1,
        }, {
            splitRatio: 0.1,
            validationMetrics: ['loss', 'preference_accuracy'],
            earlyStopping: true,
            patience: 2,
        });
    }
    async proposeCustomFineTuning(agentName, proposal, references) {
        log.info('💡 Agent proposing custom fine-tuning', LogContext.AI, {
            agent: agentName,
            proposal: proposal.substring(0, 100),
        });
        const intent = await this.analyzeFineTuningProposal(proposal);
        const researchRefs = [];
        for (const url of references) {
            try {
                if (!globalThis.fetch)
                    throw new Error('Fetch not available');
                const response = await globalThis.fetch(url);
                const content = await response.text();
                const ref = await this.createResearchReference(url, content);
                researchRefs.push(ref);
            }
            catch (error) {
                log.warn('Failed to fetch reference', LogContext.AI, { url, error });
            }
        }
        return {
            agentName,
            references: researchRefs,
            targetCapabilities: intent.capabilities,
            datasetPath: intent.suggestedDataset || 'auto-generated',
            baseModel: intent.suggestedModel || 'qwen2.5:7b',
            experimentName: `${agentName}_custom_${Date.now()}`,
            combineStrategies: intent.combineStrategies,
            autoExtractParams: true,
        };
    }
    selectPrimaryTechnique(references) {
        const techniqueCounts = new Map();
        for (const ref of references) {
            techniqueCounts.set(ref.technique, (techniqueCounts.get(ref.technique) || 0) + 1);
        }
        let maxCount = 0;
        let primaryTechnique = 'lora';
        for (const [technique, count] of techniqueCounts) {
            if (count > maxCount) {
                maxCount = count;
                primaryTechnique = technique;
            }
        }
        return primaryTechnique;
    }
    mergeParameters(target, source) {
        if (source.learningRate) {
            target.learningRate = target.learningRate || { min: 1e-5, max: 1e-3 };
            target.learningRate.min = Math.min(target.learningRate.min, source.learningRate.min);
            target.learningRate.max = Math.max(target.learningRate.max, source.learningRate.max);
            if (source.learningRate.optimal) {
                target.learningRate.optimal = source.learningRate.optimal;
            }
        }
        if (source.batchSize) {
            target.batchSize = [...new Set([...(target.batchSize || []), ...source.batchSize])];
        }
    }
    extractNumber(content, pattern) {
        const match = content.match(pattern);
        return match ? parseInt(match[1], 10) : null;
    }
    extractEvolutionaryParams(content) {
        return {
            populationSize: this.extractNumber(content, /population\s*size[:=]\s*(\d+)/i) || 20,
            mutationRate: parseFloat(content.match(/mutation\s*rate[:=]\s*([\d.]+)/i)?.[1] || '0.1'),
            crossoverRate: parseFloat(content.match(/crossover\s*rate[:=]\s*([\d.]+)/i)?.[1] || '0.7'),
            selectionPressure: parseFloat(content.match(/selection\s*pressure[:=]\s*([\d.]+)/i)?.[1] || '2.0'),
            eliteRatio: parseFloat(content.match(/elite\s*ratio[:=]\s*([\d.]+)/i)?.[1] || '0.1'),
            generations: this.extractNumber(content, /generations[:=]\s*(\d+)/i) || 50,
            fitnessMetric: 'combined',
        };
    }
    combineParameters(extracted, defaults, references) {
        return {
            ...defaults,
            ...extracted,
        };
    }
    async createInitialPopulation(baseModel, size) {
        const population = [];
        for (let i = 0; i < size; i++) {
            population.push({
                id: `individual_${i}`,
                hyperparameters: this.randomizeHyperparameters(),
                architecture: this.randomizeArchitecture(),
                fitness: 0,
            });
        }
        return population;
    }
    randomizeHyperparameters() {
        return {
            learningRate: Math.random() * 0.001 + 0.00001,
            batchSize: [2, 4, 8, 16][Math.floor(Math.random() * 4)],
            epochs: Math.floor(Math.random() * 5) + 1,
            maxSeqLength: 2048,
            gradientAccumulation: [1, 2, 4][Math.floor(Math.random() * 3)],
            warmupSteps: Math.floor(Math.random() * 200) + 50,
            weightDecay: Math.random() * 0.1,
            dropout: Math.random() * 0.3,
        };
    }
    randomizeArchitecture() {
        return {
            attentionHeads: [8, 12, 16][Math.floor(Math.random() * 3)],
            hiddenLayers: Math.floor(Math.random() * 4) + 10,
            activationFunction: ['gelu', 'relu', 'swish'][Math.floor(Math.random() * 3)],
        };
    }
    async evaluatePopulationFitness(population, datasetPath, metric) {
        return population.map(() => Math.random());
    }
    selectParents(population, fitness, pressure) {
        const parents = [];
        const tournamentSize = Math.ceil(population.length * 0.1);
        for (let i = 0; i < population.length / 2; i++) {
            const tournament = [];
            for (let j = 0; j < tournamentSize; j++) {
                const idx = Math.floor(Math.random() * population.length);
                tournament.push({ individual: population[idx], fitness: fitness[idx] });
            }
            tournament.sort((a, b) => (b.fitness ?? 0) - (a.fitness ?? 0));
            parents.push(tournament[0].individual);
        }
        return parents;
    }
    async createOffspring(parents, crossoverRate, mutationRate) {
        const offspring = [];
        for (let i = 0; i < parents.length - 1; i += 2) {
            if (Math.random() < crossoverRate) {
                const child1 = this.crossover(parents[i], parents[i + 1]);
                const child2 = this.crossover(parents[i + 1], parents[i]);
                offspring.push(child1, child2);
            }
            else {
                offspring.push({ ...parents[i] }, { ...parents[i + 1] });
            }
        }
        for (const child of offspring) {
            if (Math.random() < mutationRate) {
                this.mutate(child);
            }
        }
        return offspring;
    }
    crossover(parent1, parent2) {
        return {
            id: `offspring_${Date.now()}_${Math.random()}`,
            hyperparameters: {
                learningRate: Math.random() > 0.5
                    ? parent1.hyperparameters.learningRate
                    : parent2.hyperparameters.learningRate,
                batchSize: Math.random() > 0.5
                    ? parent1.hyperparameters.batchSize
                    : parent2.hyperparameters.batchSize,
                epochs: Math.random() > 0.5 ? parent1.hyperparameters.epochs : parent2.hyperparameters.epochs,
            },
            architecture: {},
            fitness: 0,
        };
    }
    mutate(individual) {
        if (Math.random() < 0.3) {
            individual.hyperparameters.learningRate *= 0.5 + Math.random() * 2;
        }
        if (Math.random() < 0.3) {
            individual.hyperparameters.dropout = Math.random() * 0.3;
        }
    }
    selectElite(population, fitness, ratio) {
        const sorted = population
            .map((ind, idx) => ({ individual: ind, fitness: fitness[idx] }))
            .filter((item) => item.fitness !== undefined)
            .sort((a, b) => (b.fitness || 0) - (a.fitness || 0));
        const eliteCount = Math.ceil(population.length * ratio);
        return sorted.slice(0, eliteCount).map((item) => item.individual);
    }
    getBestIndividual(population, fitness) {
        let bestIdx = 0;
        let bestFitness = fitness[0];
        for (let i = 1; i < fitness.length; i++) {
            if ((fitness[i] ?? 0) > (bestFitness ?? 0)) {
                bestFitness = fitness[i] ?? 0;
                bestIdx = i;
            }
        }
        return {
            ...population[bestIdx],
            fitness: bestFitness,
        };
    }
    async convertToPreferenceFormat(datasetPath) {
        return `${datasetPath}.preference`;
    }
    async analyzeFineTuningProposal(proposal) {
        return {
            capabilities: ['reasoning', 'code_generation'],
            suggestedModel: 'qwen2.5:7b',
            suggestedDataset: null,
            combineStrategies: false,
        };
    }
    async createResearchReference(url, content) {
        const title = content.match(/<title>(.*?)<\/title>/i)?.[1] || 'Unknown Title';
        const technique = this.detectTechnique(content);
        return {
            type: url.includes('arxiv') ? 'arxiv' : 'website',
            url,
            title,
            technique,
            year: new Date().getFullYear(),
        };
    }
    detectTechnique(content) {
        const techniqueKeywords = {
            evolutionary: ['evolution', 'genetic', 'population', 'mutation'],
            lora: ['low-rank', 'lora', 'adaptation'],
            dpo: ['preference', 'dpo', 'direct preference'],
            rlhf: ['reinforcement', 'human feedback', 'rlhf'],
        };
        for (const [technique, keywords] of Object.entries(techniqueKeywords)) {
            if (keywords.some((kw) => content.toLowerCase().includes(kw))) {
                return technique;
            }
        }
        return 'custom';
    }
}
export const referenceBasedFineTuning = new ReferenceBasedFineTuning();
//# sourceMappingURL=reference-based-fine-tuning.js.map