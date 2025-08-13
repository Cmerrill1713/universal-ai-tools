import { EventEmitter } from 'events';
export interface MLXModel {
    id: string;
    name: string;
    baseModel: string;
    fineTunedAt: Date;
    method: 'lora' | 'qlora' | 'full';
    adapterPath?: string;
    modelPath: string;
    config: {
        task?: string;
        dataset?: string;
        epochs?: number;
        performance?: {
            loss: number;
            accuracy?: number;
            improvement?: number;
        };
    };
    size: number;
    status: 'ready' | 'loading' | 'failed';
}
export interface MLXInferenceOptions {
    temperature?: number;
    maxTokens?: number;
    topK?: number;
    topP?: number;
    repetitionPenalty?: number;
    seed?: number;
}
export declare class MLXProviderService extends EventEmitter {
    private models;
    private activeProcesses;
    private modelsDirectory;
    private isInitialized;
    private mlxServerPort;
    private validatePort;
    private mlxServerProcess;
    constructor();
    initialize(): Promise<void>;
    private startMLXServer;
    private scanForModels;
    registerFineTunedModel(modelId: string, baseModel: string, method: 'lora' | 'qlora' | 'full', modelPath: string, adapterPath?: string, config?: any): Promise<MLXModel>;
    loadModel(modelId: string): Promise<void>;
    generate(modelId: string, prompt: string, options?: MLXInferenceOptions): Promise<string>;
    unloadModel(modelId: string): Promise<void>;
    getModels(): MLXModel[];
    getModelsForDiscovery(): any[];
    private estimateTier;
    private inferCapabilities;
    private estimateSpeed;
    private getDirectorySize;
    shutdown(): Promise<void>;
    getStatistics(): any;
}
export declare const mlxProviderService: MLXProviderService;
//# sourceMappingURL=mlx-provider-service.d.ts.map