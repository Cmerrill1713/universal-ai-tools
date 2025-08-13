import { EventEmitter } from 'events';
export interface Dataset {
    id: string;
    name: string;
    path: string;
    format: 'json' | 'jsonl' | 'csv';
    totalSamples: number;
    trainingSamples: number;
    validationSamples: number;
    validationResults: DatasetValidationResult;
    preprocessingConfig: PreprocessingConfig;
    statistics: DatasetStatistics;
    createdAt: Date;
    updatedAt: Date;
}
export interface DatasetValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    qualityScore: number;
    sampleSize: number;
    duplicateCount: number;
    malformedEntries: number;
}
export interface PreprocessingConfig {
    maxLength: number;
    truncation: boolean;
    padding: boolean;
    removeDuplicates: boolean;
    shuffle: boolean;
    validationSplit: number;
    testSplit?: number;
    customFilters?: string[];
}
export interface DatasetStatistics {
    avgLength: number;
    minLength: number;
    maxLength: number;
    vocabSize: number;
    uniqueTokens: number;
    lengthDistribution: {
        [key: string]: number;
    };
    tokenFrequency: {
        [key: string]: number;
    };
}
export interface FineTuningJob {
    id: string;
    jobName: string;
    userId: string;
    status: JobStatus;
    baseModelName: string;
    baseModelPath: string;
    outputModelName: string;
    outputModelPath: string;
    datasetPath: string;
    datasetFormat: 'json' | 'jsonl' | 'csv';
    hyperparameters: Hyperparameters;
    validationConfig: ValidationConfig;
    progress: JobProgress;
    metrics: TrainingMetrics;
    evaluation: ModelEvaluation | null;
    resourceUsage: ResourceUsage;
    error?: JobError;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    updatedAt: Date;
}
export type JobStatus = 'created' | 'preparing' | 'training' | 'evaluating' | 'completed' | 'failed' | 'cancelled' | 'paused';
export interface Hyperparameters {
    learningRate: number;
    batchSize: number;
    epochs: number;
    maxSeqLength: number;
    gradientAccumulation: number;
    warmupSteps: number;
    weightDecay: number;
    dropout: number;
    optimizerType?: 'adam' | 'sgd' | 'adamw';
    scheduler?: 'linear' | 'cosine' | 'polynomial';
}
export interface ValidationConfig {
    splitRatio: number;
    validationMetrics: string[];
    earlyStopping: boolean;
    patience: number;
    minDelta?: number;
    evaluateEveryNSteps?: number;
}
export interface JobProgress {
    currentEpoch: number;
    totalEpochs: number;
    currentStep: number;
    totalSteps: number;
    progressPercentage: number;
    estimatedTimeRemaining?: number;
    lastUpdateTime: Date;
}
export interface TrainingMetrics {
    trainingLoss: number[];
    validationLoss: number[];
    trainingAccuracy?: number[];
    validationAccuracy?: number[];
    learningRates: number[];
    gradientNorms?: number[];
    perplexity?: number[];
    epochTimes: number[];
}
export interface ModelEvaluation {
    id: string;
    jobId: string;
    modelPath: string;
    evaluationType: 'training' | 'validation' | 'test' | 'final';
    metrics: EvaluationMetrics;
    sampleOutputs: SampleOutput[];
    evaluationConfig: EvaluationConfig;
    createdAt: Date;
}
export interface EvaluationMetrics {
    perplexity: number;
    loss: number;
    accuracy: number;
    bleuScore?: number;
    rougeScores?: {
        rouge1: number;
        rouge2: number;
        rougeL: number;
    };
    customMetrics?: {
        [key: string]: number;
    };
}
export interface SampleOutput {
    input: string;
    output: string;
    reference?: string;
    confidence?: number;
}
export interface EvaluationConfig {
    numSamples: number;
    maxTokens: number;
    temperature: number;
    topP: number;
    testDatasetPath?: string;
}
export interface ResourceUsage {
    memoryUsageMB: number;
    gpuUtilizationPercentage: number;
    estimatedDurationMinutes?: number;
    actualDurationMinutes?: number;
    powerConsumptionWatts?: number;
}
export interface JobError {
    message: string;
    details: unknown;
    retryCount: number;
    maxRetries: number;
    recoverable: boolean;
}
export interface HyperparameterOptimization {
    id: string;
    experimentName: string;
    baseJobId: string;
    userId: string;
    optimizationMethod: 'grid_search' | 'random_search' | 'bayesian' | 'genetic';
    parameterSpace: ParameterSpace;
    status: 'created' | 'running' | 'completed' | 'failed' | 'cancelled';
    trials: OptimizationTrial[];
    bestTrial?: OptimizationTrial;
    createdAt: Date;
    completedAt?: Date;
}
export interface ParameterSpace {
    learningRate: {
        min: number;
        max: number;
        step?: number;
    } | number[];
    batchSize: number[];
    epochs: {
        min: number;
        max: number;
    } | number[];
    dropout: {
        min: number;
        max: number;
        step?: number;
    };
    weightDecay: {
        min: number;
        max: number;
        step?: number;
    };
    [key: string]: unknown;
}
export interface OptimizationTrial {
    id: string;
    parameters: Hyperparameters;
    metrics: EvaluationMetrics;
    status: 'running' | 'completed' | 'failed';
    startTime: Date;
    endTime?: Date;
    jobId?: string;
}
export interface JobQueue {
    id: string;
    jobId: string;
    priority: number;
    queuePosition: number;
    estimatedResources: {
        memoryMB: number;
        gpuMemoryMB: number;
        durationMinutes: number;
    };
    dependsOnJobIds: string[];
    status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
    scheduledAt?: Date;
    startedAt?: Date;
    createdAt: Date;
}
export declare class MLXFineTuningService extends EventEmitter {
    private activeJobs;
    private jobQueue;
    private isProcessingQueue;
    private maxConcurrentJobs;
    private modelsPath;
    private datasetsPath;
    private tempPath;
    private supabase;
    constructor();
    loadDataset(datasetPath: string, name: string, userId: string, preprocessingConfig?: Partial<PreprocessingConfig>): Promise<Dataset>;
    private validateDataset;
    createFineTuningJob(jobName: string, userId: string, baseModelName: string, baseModelPath: string, datasetPath: string, hyperparameters?: Partial<Hyperparameters>, validationConfig?: Partial<ValidationConfig>): Promise<FineTuningJob>;
    startFineTuningJob(jobId: string): Promise<void>;
    pauseJob(jobId: string): Promise<void>;
    resumeJob(jobId: string): Promise<void>;
    cancelJob(jobId: string): Promise<void>;
    runHyperparameterOptimization(experimentName: string, baseJobId: string, userId: string, optimizationMethod: 'grid_search' | 'random_search' | 'bayesian' | 'genetic', parameterSpace: ParameterSpace, maxTrials?: number): Promise<HyperparameterOptimization>;
    evaluateModel(jobId: string, modelPath: string, evaluationType: 'training' | 'validation' | 'test' | 'final', evaluationConfig?: Partial<EvaluationConfig>): Promise<ModelEvaluation>;
    getJobProgress(jobId: string): Promise<JobProgress | null>;
    getJobMetrics(jobId: string): Promise<TrainingMetrics | null>;
    subscribeToJobProgress(jobId: string, callback: (progress: JobProgress) => void): () => void;
    exportModel(jobId: string, exportFormat?: 'mlx' | 'gguf' | 'safetensors', exportPath?: string): Promise<string>;
    deployModel(jobId: string, deploymentName?: string): Promise<string>;
    getQueueStatus(): Promise<{
        running: FineTuningJob[];
        queued: FineTuningJob[];
        totalCapacity: number;
        availableCapacity: number;
    }>;
    setJobPriority(jobId: string, priority: number): Promise<void>;
    listJobs(userId: string, status?: JobStatus): Promise<FineTuningJob[]>;
    getJob(jobId: string): Promise<FineTuningJob | null>;
    deleteJob(jobId: string): Promise<void>;
    getHealthStatus(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        activeJobs: number;
        queuedJobs: number;
        totalJobs: number;
        resourceUsage: {
            memoryUsageMB: number;
            diskUsageMB: number;
        };
        lastError?: string;
    }>;
    private ensureDirectories;
    private detectDatasetFormat;
    private readDatasetFile;
    private preprocessDataset;
    private calculateDatasetStatistics;
    private saveProcessedDataset;
    private createTrainingScript;
    private setupProcessHandlers;
    private handleTrainingOutput;
    private generateParameterCombinations;
    private runOptimizationTrial;
    private compareTrialMetrics;
    private shouldStopOptimization;
    private calculateEvaluationMetrics;
    private generateSampleOutputs;
    private loadTestDataset;
    private createModelExportScript;
    private runPythonScript;
    private startQueueProcessor;
    private canStartJob;
    private addJobToQueue;
    private removeJobFromQueue;
    private calculateDiskUsage;
    private getDirectorySize;
    private copyDirectory;
    private deleteDirectory;
    private saveDatasetToDatabase;
    private saveJobToDatabase;
    private updateJobInDatabase;
    private saveEvaluationToDatabase;
    private saveExperimentToDatabase;
    private updateExperimentInDatabase;
    private updateJobQueueInDatabase;
    private mapDatabaseJobToJob;
}
export declare const mlxFineTuningService: MLXFineTuningService;
export default mlxFineTuningService;
//# sourceMappingURL=mlx-fine-tuning-service.d.ts.map