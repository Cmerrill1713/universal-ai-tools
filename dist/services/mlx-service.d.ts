export interface MLXConfig {
    pythonPath?: string;
    modelsPath?: string;
    timeout?: number;
}
export interface FineTuningRequest {
    modelName: string;
    datasetPath: string;
    outputPath: string;
    hyperparameters?: {
        learningRate?: number;
        batchSize?: number;
        epochs?: number;
        maxSeqLength?: number;
        gradientAccumulation?: number;
    };
    validation?: {
        splitRatio?: number;
        validationPath?: string;
    };
}
export interface InferenceRequest {
    modelPath: string;
    prompt: string;
    parameters?: {
        maxTokens?: number;
        temperature?: number;
        topP?: number;
        rawPrompt?: boolean;
    };
}
export interface MLXMetrics {
    totalInferences: number;
    totalTrainingJobs: number;
    successfulInferences: number;
    successfulTrainingJobs: number;
    averageInferenceTime: number;
    modelsLoaded: string[];
    isInitialized: boolean;
    hardwareInfo: {
        device: string;
        memory: string;
        unified: boolean;
    };
}
export declare class MLXService {
    private config;
    private pythonProcess;
    private isInitialized;
    private pendingRequests;
    private metrics;
    private modelsPath;
    private circuitBreaker;
    constructor(config?: MLXConfig);
    private initialize;
    private checkMLXInstallation;
    private startMLXBridge;
    private createMLXBridgeScript;
    private handlePythonResponse;
    private detectHardware;
    runInference(request: InferenceRequest): Promise<any>;
    fineTuneModel(request: FineTuningRequest): Promise<any>;
    listModels(): Promise<any>;
    getMetrics(): MLXMetrics;
    healthCheck(): Promise<any>;
    private updateMetrics;
    shutdown(): Promise<void>;
}
export declare const mlxService: MLXService;
export default mlxService;
//# sourceMappingURL=mlx-service.d.ts.map