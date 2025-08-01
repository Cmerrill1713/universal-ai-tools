interface CoverageSummary {
    lines: {
        total: number;
        covered: number;
        skipped: number;
        pct: number;
    };
    statements: {
        total: number;
        covered: number;
        skipped: number;
        pct: number;
    };
    functions: {
        total: number;
        covered: number;
        skipped: number;
        pct: number;
    };
    branches: {
        total: number;
        covered: number;
        skipped: number;
        pct: number;
    };
}
interface TestResult {
    name: string;
    status: 'passed' | 'failed' | 'skipped';
    duration: number;
    coverage?: CoverageSummary;
    errors?: string[];
}
interface TestSummaryReport {
    timestamp: string;
    overallStatus: 'passed' | 'failed' | 'partial';
    testSuites: TestResult[];
    coverage: {
        overall: CoverageSummary;
        byCategory: Record<string, CoverageSummary>;
        qualityGate: 'excellent' | 'good' | 'fair' | 'poor';
    };
    metrics: {
        totalTests: number;
        passedTests: number;
        failedTests: number;
        skippedTests: number;
        totalDuration: number;
        averageDuration: number;
    };
    recommendations: string[];
    productionReadiness: {
        score: number;
        level: 'ready' | 'near-ready' | 'needs-work' | 'not-ready';
        blockers: string[];
        warnings: string[];
    };
}
export declare class TestSummaryGenerator {
    private testSuites;
    private results;
    private startTime;
    runTestSuite(suite: typeof this.testSuites[0]): Promise<TestResult>;
    generateCoverageReport(): Promise<CoverageSummary | null>;
    determineQualityGate(coverage: CoverageSummary): 'excellent' | 'good' | 'fair' | 'poor';
    calculateProductionReadiness(summary: TestSummaryReport): {
        score: number;
        level: 'ready' | 'near-ready' | 'needs-work' | 'not-ready';
        blockers: string[];
        warnings: string[];
    };
    generateRecommendations(summary: TestSummaryReport): string[];
    generateReport(): Promise<TestSummaryReport>;
    printSummary(summary: TestSummaryReport): void;
    saveReport(summary: TestSummaryReport): Promise<string>;
    run(): Promise<TestSummaryReport>;
}
export {};
//# sourceMappingURL=test-summary.d.ts.map