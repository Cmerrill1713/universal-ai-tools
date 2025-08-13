interface HealingPattern {
    id: string;
    pattern: string;
    frequency: number;
    lastSeen: Date;
    category: 'syntax' | 'runtime' | 'performance' | 'security';
    autoFixSuccess: number;
    context?: string;
}
interface ModelOptimizationTask {
    id: string;
    sourceModel: string;
    sourceType: 'ollama' | 'huggingface' | 'local';
    targetModel: string;
    optimizations: OptimizationType[];
    trainingData: TrainingDataPoint[];
    priority: 'high' | 'medium' | 'low';
    estimatedTime: number;
}
interface OptimizationType {
    type: 'code_quality' | 'error_prevention' | 'performance' | 'security';
    weight: number;
    patterns: string[];
}
interface TrainingDataPoint {
    input: string;
    output: string;
    category: string;
    confidence: number;
}
interface ModelConversionResult {
    success: boolean;
    originalModel: string;
    mlxModel: string;
    conversionTime: number;
    optimizations: string[];
}
declare class AdaptiveModelOptimizer {
    private isRunning;
    private healingMemoryFile;
    private optimizationQueue;
    private completedOptimizations;
    private mlxModelsPath;
    private ollamaModelsPath;
    private optimizationInterval;
    constructor();
    start(): Promise<void>;
    analyzeHealingPatterns(): Promise<void>;
    generateTrainingDataFromPatterns(patterns: HealingPattern[]): TrainingDataPoint[];
    generateSyntaxTrainingData(pattern: HealingPattern): TrainingDataPoint[];
    generatePerformanceTrainingData(pattern: HealingPattern): TrainingDataPoint[];
    generateSecurityTrainingData(pattern: HealingPattern): TrainingDataPoint[];
    generateRuntimeTrainingData(pattern: HealingPattern): TrainingDataPoint[];
    createOptimizationTasks(trainingData: TrainingDataPoint[], patterns: HealingPattern[]): Promise<void>;
    private executeSecureCommand;
    discoverAvailableModels(): Promise<Array<{
        name: string;
        type: 'ollama' | 'huggingface' | 'local';
    }>>;
    determineOptimizations(patterns: HealingPattern[]): OptimizationType[];
    calculatePriority(patterns: HealingPattern[]): 'high' | 'medium' | 'low';
    estimateOptimizationTime(trainingDataSize: number): number;
    runOptimizationCycle(): Promise<void>;
    executeOptimizationTask(task: ModelOptimizationTask): Promise<void>;
    convertToMLX(task: ModelOptimizationTask): Promise<ModelConversionResult>;
    private validateModelName;
    private validatePath;
    convertOllamaToMLX(task: ModelOptimizationTask): Promise<ModelConversionResult>;
    convertHuggingFaceToMLX(task: ModelOptimizationTask): Promise<ModelConversionResult>;
    convertLocalToMLX(task: ModelOptimizationTask): Promise<ModelConversionResult>;
    convertGGUFToMLX(ggufPath: string, mlxPath: string): Promise<void>;
    fineTuneWithHealingData(task: ModelOptimizationTask, modelPath: string): Promise<string>;
    validateOptimizedModel(modelPath: string): Promise<void>;
    private ensureDirectories;
    private removeTask;
    getStatus(): object;
    stop(): void;
}
export { AdaptiveModelOptimizer };
//# sourceMappingURL=adaptive-model-optimizer.d.ts.map