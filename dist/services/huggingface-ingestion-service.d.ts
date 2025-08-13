interface IngestionStats {
    modelsProcessed: number;
    datasetsProcessed: number;
    papersProcessed: number;
    errors: string[];
    startTime: Date;
    endTime?: Date;
}
export declare class HuggingFaceIngestionService {
    private supabase;
    private baseUrl;
    private hubUrl;
    private papersUrl;
    constructor();
    ingestHuggingFaceData(options?: {
        includeModels?: boolean;
        includeDatasets?: boolean;
        includePapers?: boolean;
        modelLimit?: number;
        datasetLimit?: number;
        paperLimit?: number;
        popularOnly?: boolean;
    }): Promise<IngestionStats>;
    private ingestModels;
    private ingestDatasets;
    private ingestPapers;
    private storeModel;
    private storeDataset;
    private storePaper;
    private generateEmbedding;
    private buildModelDescription;
    private buildDatasetDescription;
    private buildPaperContent;
    private generateModelSummary;
    private generateDatasetSummary;
    private generatePaperSummary;
    getIngestionStats(): Promise<{
        totalModels: number;
        totalDatasets: number;
        totalPapers: number;
        lastIngestion?: Date;
        topCategories: Array<{
            category: string;
            count: number;
        }>;
    }>;
}
export declare const huggingFaceIngestionService: HuggingFaceIngestionService;
export default huggingFaceIngestionService;
//# sourceMappingURL=huggingface-ingestion-service.d.ts.map