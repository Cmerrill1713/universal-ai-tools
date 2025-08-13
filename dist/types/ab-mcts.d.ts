import type { AgentContext, AgentResponse } from '@/types';
export type { AgentContext, AgentResponse };
export interface ABMCTSNode {
    id: string;
    state: AgentContext;
    visits: number;
    totalReward: number;
    averageReward: number;
    ucbScore: number;
    thompsonSample: number;
    priorAlpha: number;
    priorBeta: number;
    children: Map<string, ABMCTSNode>;
    parent?: ABMCTSNode;
    depth: number;
    isTerminal: boolean;
    isExpanded: boolean;
    metadata: {
        agent?: string;
        action?: string;
        model?: string;
        timestamp: number;
        executionTime?: number;
        resourceCost?: number;
        confidenceInterval?: [number, number];
    };
}
export interface ABMCTSConfig {
    maxIterations: number;
    maxDepth: number;
    explorationConstant: number;
    discountFactor: number;
    priorAlpha: number;
    priorBeta: number;
    maxBudget: number;
    timeLimit: number;
    parallelism: number;
    learningRate: number;
    updateFrequency: number;
    minSamplesForUpdate: number;
    pruneThreshold: number;
    cacheSize: number;
    checkpointInterval: number;
}
export interface ABMCTSAction {
    agentName: string;
    agentType: 'cognitive' | 'personal' | 'evolved' | 'generated';
    estimatedCost: number;
    estimatedTime: number;
    requiredCapabilities: string[];
    modelRequirement?: string;
}
export interface ABMCTSReward {
    value: number;
    components: {
        quality: number;
        speed: number;
        cost: number;
        user_satisfaction?: number;
    };
    metadata: {
        executionTime: number;
        tokensUsed: number;
        memoryUsed: number;
        errors: number;
    };
}
export interface ABMCTSSearchResult {
    bestPath: ABMCTSNode[];
    bestAction: ABMCTSAction;
    confidence: number;
    alternativePaths: ABMCTSNode[][];
    searchMetrics: {
        nodesExplored: number;
        iterations: number;
        timeElapsed: number;
        averageDepth: number;
        branchingFactor: number;
    };
    recommendations: string[];
}
export interface BayesianPerformanceModel {
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
}
export interface BetaDistribution {
    alpha: number;
    beta: number;
    mean: number;
    variance: number;
    mode?: number;
}
export interface NormalDistribution {
    mean: number;
    variance: number;
    precision: number;
    standardDeviation: number;
}
export interface GammaDistribution {
    shape: number;
    rate: number;
    mean: number;
    variance: number;
}
export interface PerformanceObservation {
    timestamp: number;
    success: boolean;
    executionTime: number;
    resourceUsage: number;
    reward: number;
    context: Record<string, any>;
}
export interface ThompsonSamplingParams {
    useBeta: boolean;
    alphas: number[];
    betas: number[];
    useNormalGamma: boolean;
    means: number[];
    precisions: number[];
    shapes: number[];
    rates: number[];
    temperature: number;
    epsilon: number;
}
export interface ABMCTSTreeStorage {
    rootId: string;
    nodes: Record<string, SerializedNode>;
    metadata: {
        created: number;
        lastModified: number;
        iterations: number;
        bestScore: number;
        checkpointVersion: number;
    };
}
export interface SerializedNode {
    id: string;
    parentId?: string;
    childrenIds: string[];
    state: string;
    stats: {
        visits: number;
        totalReward: number;
        ucbScore: number;
        thompsonSample: number;
    };
    metadata: Record<string, any>;
}
export interface ABMCTSFeedback {
    nodeId: string;
    reward: ABMCTSReward;
    userRating?: number;
    errorOccurred: boolean;
    errorMessage?: string;
    timestamp: number;
    context: {
        taskType: string;
        userId?: string;
        sessionId: string;
    };
}
export interface ABMCTSVisualization {
    nodes: Array<{
        id: string;
        label: string;
        score: number;
        visits: number;
        depth: number;
        isLeaf: boolean;
        isBest: boolean;
    }>;
    edges: Array<{
        source: string;
        target: string;
        weight: number;
        label?: string;
    }>;
    metrics: {
        totalNodes: number;
        maxDepth: number;
        avgBranchingFactor: number;
        explorationRate: number;
    };
}
export interface ABMCTSExecutionOptions {
    useCache: boolean;
    enableParallelism: boolean;
    collectFeedback: boolean;
    saveCheckpoints: boolean;
    visualize: boolean;
    verboseLogging: boolean;
    fallbackStrategy: 'greedy' | 'random' | 'fixed';
}
export interface ABMCTSMixedModel {
    globalPriors: {
        successRate: BetaDistribution;
        executionTime: NormalDistribution;
        resourceUsage: GammaDistribution;
    };
    taskSpecificModels: Map<string, BayesianPerformanceModel>;
    sharedFeatures: string[];
    transferLearningWeight: number;
}
export interface ABMCTSResourceAllocation {
    cpuLimit: number;
    memoryLimit: number;
    timeSlice: number;
    priority: 'low' | 'medium' | 'high';
    preemptible: boolean;
}
export interface ABMCTSExperiment {
    id: string;
    name: string;
    variants: Array<{
        name: string;
        config: Partial<ABMCTSConfig>;
        weight: number;
    }>;
    metrics: string[];
    startTime: number;
    endTime?: number;
    status: 'active' | 'paused' | 'completed';
}
export declare function isABMCTSNode(obj: unknown): obj is ABMCTSNode;
export declare function isTerminalNode(node: ABMCTSNode): boolean;
export type NodeSelector = (node: ABMCTSNode) => number;
export type RewardFunction = (response: AgentResponse, context: AgentContext) => ABMCTSReward;
export type TerminationChecker = (node: ABMCTSNode, context: AgentContext) => boolean;
//# sourceMappingURL=ab-mcts.d.ts.map