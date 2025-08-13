export interface DiscoveredModel {
    id: string;
    name: string;
    provider: 'ollama' | 'lmstudio' | 'mlx' | 'local';
    size?: number;
    sizeGB?: number;
    tier: 1 | 2 | 3 | 4;
    capabilities: string[];
    estimatedSpeed: 'instant' | 'fast' | 'moderate' | 'slow';
    metadata: {
        quantization?: string;
        family?: string;
        modified?: string;
        digest?: string;
    };
}
export interface TaskRequirements {
    type: string;
    needs: string[];
    priority: 'speed' | 'quality' | 'balanced';
    complexity: number;
    maxLatencyMs?: number;
    minQuality?: number;
}
export declare class ModelDiscoveryService {
    private discoveredModels;
    private lastDiscovery;
    private discoveryInterval;
    private providerStatus;
    constructor();
    private startAutoDiscovery;
    discoverAllModels(): Promise<DiscoveredModel[]>;
    private discoverOllamaModels;
    private discoverLMStudioModels;
    private discoverMLXModels;
    private classifyModel;
    private detectTier;
    private detectCapabilities;
    private estimateSpeed;
    private estimateSizeFromName;
    private estimateSize;
    private extractModelFamily;
    private groupByTier;
    getModels(): DiscoveredModel[];
    getModelsByProvider(provider: string): DiscoveredModel[];
    getModelsByTier(tier: number): DiscoveredModel[];
    getModelsWithCapability(capability: string): DiscoveredModel[];
    findBestModel(requirements: TaskRequirements): DiscoveredModel | null;
    private scoreModel;
    getProviderStatus(): Map<string, boolean>;
    hasCapability(capability: string): boolean;
}
export declare const modelDiscoveryService: ModelDiscoveryService;
//# sourceMappingURL=model-discovery-service.d.ts.map