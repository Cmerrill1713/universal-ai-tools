import { EventEmitter } from 'events';
export interface ModelGenome {
    id: string;
    generation: number;
    parents: string[];
    genes: {
        models: string[];
        layerSequence: LayerConfig[];
        weights: WeightConfig;
        scalingFactors: number[];
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
    ratios: Record<string, number>;
    sparsity?: number;
    density?: number;
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
export declare class EvolutionaryModelMergeService extends EventEmitter {
    private config;
    private population;
    private generation;
    private isEvolving;
    private evolutionHistory;
    private mergedModels;
    private fitnessCache;
    private readonly MAX_CACHE_SIZE;
    private readonly MAX_HISTORY_SIZE;
    constructor();
    evolve(targetTask: string, config?: Partial<EvolutionConfig>): Promise<EvolutionResult>;
    private initializePopulation;
    private createRandomGenome;
    private generateRandomLayerSequence;
    private generateRandomWeights;
    private evaluatePopulation;
    private evaluateFitness;
    private evaluateAccuracy;
    private evaluateSpeed;
    private evaluateSizeEfficiency;
    private evaluateDiversity;
    private createNextGeneration;
    private selectParent;
    private crossover;
    private mutate;
    private cloneGenome;
    private selectRandomModels;
    private calculateConvergence;
    private getAverageFitness;
    applyGenome(genome: ModelGenome): Promise<string>;
    private cleanupCache;
    getHistory(): Map<number, ModelGenome[]>;
    getMergedModels(): Map<string, any>;
    updateConfig(config: Partial<EvolutionConfig>): void;
    stop(): void;
}
export declare const evolutionaryModelMergeService: EvolutionaryModelMergeService;
//# sourceMappingURL=evolutionary-model-merge-service.d.ts.map