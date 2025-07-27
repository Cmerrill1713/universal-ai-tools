#!/usr/bin/env npx tsx
declare class HallucinationFixer {
    private fixes;
    private projectRoot;
    constructor(projectRoot: string);
    fixAll(): Promise<void>;
    private setupFixes;
    private createAbMctsService;
    private createFeedbackCollector;
    private createBayesianModel;
    private createThompsonSampling;
    private createAbMctsTypes;
    private createRedisServiceStub;
}
export { HallucinationFixer };
//# sourceMappingURL=fix-hallucinations.d.ts.map