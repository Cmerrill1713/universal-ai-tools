export interface FactualityResult {
    verified: boolean;
    content: string;
    references?: Array<{
        title?: string;
        url?: string;
        snippet?: string;
    }>;
    lookedUp?: boolean;
}
export declare function checkAndCorrectFactuality(originalContent: string, userQuery: string, options?: {
    userId?: string;
    requestId?: string;
    projectPath?: string;
}): Promise<FactualityResult>;
//# sourceMappingURL=factuality-guard.d.ts.map