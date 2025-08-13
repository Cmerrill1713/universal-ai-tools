import type { ABMCTSReward, BayesianPerformanceModel, BetaDistribution, GammaDistribution, NormalDistribution, PerformanceObservation } from '@/types/ab-mcts';
export declare class BayesianModel implements BayesianPerformanceModel {
    agentName: string;
    taskType: string;
    successRate: BetaDistribution;
    executionTime: NormalDistribution;
    resourceUsage: GammaDistribution;
    observations: PerformanceObservation[];
    lastUpdated: number;
    totalSamples: number;
    expectedPerformance: number;
    confidenceInterval: [number, number];
    reliability: number;
    private timeParams;
    private resourceParams;
    constructor(agentName: string, taskType: string);
    update(observation: PerformanceObservation): void;
    private updateResourceUsage;
    private updatePerformanceMetrics;
    private calculateConsistency;
    predict(context: Record<string, any>): {
        expectedReward: number;
        expectedTime: number;
        expectedResources: number;
        confidence: number;
    };
    private sampleExecutionTime;
    private sampleResourceUsage;
    private getContextMultiplier;
    getStatistics(): {
        successRate: {
            mean: number;
            confidence: [number, number];
        };
        executionTime: {
            mean: number;
            stdDev: number;
        };
        resourceUsage: {
            mean: number;
            variance: number;
        };
        reliability: number;
        samples: number;
    };
    compareTo(other: BayesianModel): {
        betterSuccess: number;
        fasterExecution: number;
        moreEfficient: number;
        overallBetter: number;
    };
    toJSON(): string;
    static fromJSON(json: string): BayesianModel;
}
export declare class BayesianModelRegistry {
    private models;
    getModel(agentName: string, taskType: string): BayesianModel;
    updateModel(agentName: string, taskType: string, reward: ABMCTSReward, executionTime: number, context: Record<string, any>): void;
    getBestAgent(taskType: string, availableAgents: string[]): {
        agent: string;
        confidence: number;
        expectedPerformance: number;
    };
    getRankings(taskType: string): Array<{
        agent: string;
        performance: number;
        reliability: number;
        samples: number;
    }>;
    serialize(): string;
    static deserialize(data: string): BayesianModelRegistry;
}
export declare const bayesianModelRegistry: BayesianModelRegistry;
//# sourceMappingURL=bayesian-model.d.ts.map