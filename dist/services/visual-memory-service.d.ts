import type { ExpectedOutcome } from '@/types';
import type { GeneratedImage, ValidationResult, VisionAnalysis, VisualMemory } from '@/types/vision';
export interface VisualSearchResult {
    memory: VisualMemory;
    similarity: number;
}
export interface ConceptUpdate {
    concept: string;
    prototype: Float32Array;
    description?: string;
}
export declare class VisualMemoryService {
    private supabase;
    private memoryCache;
    private conceptCache;
    private readonly maxCacheSize;
    constructor();
    private initializeSupabase;
    storeVisualMemory(imagePath: string | Buffer, metadata?: Record<string, any>, userId?: string): Promise<VisualMemory>;
    searchSimilar(queryEmbedding: Float32Array | string | Buffer, limit?: number, threshold?: number): Promise<VisualSearchResult[]>;
    storeHypothesis(concept: string, hypothesis: string, generatedImage: GeneratedImage, expectedOutcome: ExpectedOutcome): Promise<string>;
    validateHypothesis(hypothesisId: string, actualAnalysis: VisionAnalysis): Promise<ValidationResult>;
    updateConcept(update: ConceptUpdate): Promise<void>;
    getRelatedConcepts(query: string, limit?: number): Promise<any[]>;
    storeLearningExperience(agentId: string, memoryId: string, prediction: ExpectedOutcome, actualOutcome: ExpectedOutcome, success: boolean): Promise<void>;
    private storeEmbedding;
    private getMemoryById;
    private searchInMemory;
    private cosineSimilarity;
    private calculateValidationScore;
    private generateLearningAdjustment;
    private calculateLearningDelta;
    private findDifferences;
    private safeStringifyReplacer;
    private mockValidation;
    private updateCache;
    shutdown(): Promise<void>;
}
export declare const visualMemoryService: VisualMemoryService;
export default visualMemoryService;
//# sourceMappingURL=visual-memory-service.d.ts.map