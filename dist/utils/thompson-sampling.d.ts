import type { BetaDistribution, ThompsonSamplingParams } from '@/types/ab-mcts';
export declare class BetaSampler {
    static sample(alpha: number, beta: number): number;
    private static sampleGamma;
    private static sampleNormal;
    static update(distribution: BetaDistribution, success: boolean): BetaDistribution;
    static confidenceInterval(distribution: BetaDistribution, confidence?: number): [number, number];
    private static quantileNormal;
}
export declare class NormalGammaSampler {
    static sample(mean: number, precision: number, shape: number, rate: number): {
        mean: number;
        precision: number;
    };
    static update(mean: number, precision: number, shape: number, rate: number, observation: number, observationPrecision?: number): {
        mean: number;
        precision: number;
        shape: number;
        rate: number;
    };
    static getStatistics(mean: number, precision: number, shape: number, rate: number): {
        expectedMean: number;
        variance: number;
    };
}
export declare class ThompsonSelector {
    private arms;
    private continuousArms;
    constructor();
    initializeArms(armNames: string[], priorAlpha?: number, priorBeta?: number): void;
    selectArm(temperature?: number): string;
    updateArm(armName: string, success: boolean): void;
    getArmStats(armName: string): {
        mean: number;
        confidence: [number, number];
        samples: number;
    } | null;
    getRankedArms(): Array<{
        name: string;
        mean: number;
        confidence: [number, number];
        samples: number;
    }>;
    reset(priorAlpha?: number, priorBeta?: number): void;
}
export declare class UCBCalculator {
    static ucb1(averageReward: number, totalVisits: number, nodeVisits: number, explorationConstant?: number): number;
    static ucbTuned(averageReward: number, rewardVariance: number, totalVisits: number, nodeVisits: number): number;
}
export declare class AdaptiveExplorer {
    private thompsonWeight;
    private ucbWeight;
    private adaptationRate;
    selectAction(thompsonScores: Map<string, number>, ucbScores: Map<string, number>, temperature?: number): string;
    adaptWeights(thompsonSuccess: boolean, ucbSuccess: boolean): void;
    getWeights(): {
        thompson: number;
        ucb: number;
    };
}
export declare function createThompsonParams(armCount: number, priorAlpha?: number, priorBeta?: number, temperature?: number): ThompsonSamplingParams;
export declare const defaultThompsonSelector: ThompsonSelector;
export declare const adaptiveExplorer: AdaptiveExplorer;
//# sourceMappingURL=thompson-sampling.d.ts.map