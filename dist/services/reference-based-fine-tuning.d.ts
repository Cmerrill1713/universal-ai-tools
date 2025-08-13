export interface ResearchReference {
    type: 'paper' | 'blog' | 'github' | 'arxiv' | 'website';
    url: string;
    title: string;
    authors?: string[];
    year?: number;
    technique: FineTuningTechnique;
    extractedParams?: ExtractedParameters;
}
export type FineTuningTechnique = 'evolutionary' | 'lora' | 'qlora' | 'prefix-tuning' | 'adapter-tuning' | 'prompt-tuning' | 'instruction-tuning' | 'rlhf' | 'dpo' | 'constitutional-ai' | 'chain-of-thought' | 'tree-of-thoughts' | 'self-consistency' | 'few-shot-learning' | 'meta-learning' | 'continual-learning' | 'federated-learning' | 'neural-architecture-search' | 'knowledge-distillation' | 'mixture-of-experts' | 'sparse-mixture-of-experts' | 'custom';
export interface ExtractedParameters {
    learningRate?: {
        min: number;
        max: number;
        optimal?: number;
    };
    batchSize?: number[];
    epochs?: {
        min: number;
        max: number;
    };
    warmupRatio?: number;
    weightDecay?: number;
    dropoutRate?: number;
    rankSize?: number;
    alphaScaling?: number;
    quantizationBits?: number;
    evolutionaryParams?: EvolutionaryParameters;
    customParams?: Record<string, any>;
}
export interface EvolutionaryParameters {
    populationSize: number;
    mutationRate: number;
    crossoverRate: number;
    selectionPressure: number;
    eliteRatio: number;
    generations: number;
    fitnessMetric: 'accuracy' | 'perplexity' | 'combined' | 'custom';
}
export interface ReferenceFineTuningRequest {
    agentName: string;
    references: ResearchReference[];
    targetCapabilities: string[];
    datasetPath: string;
    baseModel: string;
    experimentName: string;
    combineStrategies?: boolean;
    autoExtractParams?: boolean;
}
export declare class ReferenceBasedFineTuning {
    private techniqueImplementations;
    constructor();
    private initializeTechniques;
    extractParametersFromReferences(references: ResearchReference[]): Promise<ExtractedParameters>;
    private analyzeResearchContent;
    startReferenceBasedFineTuning(request: ReferenceFineTuningRequest): Promise<{
        jobId: string;
        technique: string;
        estimatedTime: number;
    }>;
    private implementEvolutionaryFineTuning;
    private implementLoRAFineTuning;
    private implementDPOFineTuning;
    proposeCustomFineTuning(agentName: string, proposal: string, references: string[]): Promise<ReferenceFineTuningRequest>;
    private selectPrimaryTechnique;
    private mergeParameters;
    private extractNumber;
    private extractEvolutionaryParams;
    private combineParameters;
    private createInitialPopulation;
    private randomizeHyperparameters;
    private randomizeArchitecture;
    private evaluatePopulationFitness;
    private selectParents;
    private createOffspring;
    private crossover;
    private mutate;
    private selectElite;
    private getBestIndividual;
    private convertToPreferenceFormat;
    private analyzeFineTuningProposal;
    private createResearchReference;
    private detectTechnique;
}
export declare const referenceBasedFineTuning: ReferenceBasedFineTuning;
//# sourceMappingURL=reference-based-fine-tuning.d.ts.map